/**
 * Host half of the Journal Reader bundle.
 *
 * Serves same-origin HTTP routes under /jr/api (prefix route, node req/res style):
 *  - GET /jr/api/issues                        magazine index from the awesome-english-ebooks repo
 *  - GET /jr/api/issue?path=<issue dir>        one issue's chapter list (downloads + parses the epub)
 *  - GET /jr/api/chapter?path=<...>&index=N    one chapter's sanitized HTML
 *  - GET /jr/api/explain?text=<...>&mode=...   AI explanation streamed as plain text over ctx.llm
 *  - GET /jr/api/voices                       Edge TTS voice catalogue (neural voices)
 *  - POST /jr/api/speech                      Edge TTS synthesis; streams mp3 + sentence timings
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const REPO = { owner: 'hehonghui', repo: 'awesome-english-ebooks', branch: 'master' };
const MAGAZINES = [
	{ key: '01_economist', title: 'The Economist', zh: '经济学人', cadence: 'weekly', color: '#e3120b' },
	{ key: '02_new_yorker', title: 'The New Yorker', zh: '纽约客', cadence: 'weekly', color: '#1f2937' },
	{ key: '04_atlantic', title: 'The Atlantic', zh: '大西洋月刊', cadence: 'monthly', color: '#1d4ed8' },
	{ key: '05_wired', title: 'WIRED', zh: '连线', cadence: 'monthly', color: '#b45309' }
];
const ISSUE_DIR_RE = /^(?:[A-Za-z0-9]+_)?(\d{4})\.(\d{2})\.(\d{2})$/;
const YEAR_DIR_RE = /^\d{4}$/;
const SLUG_TITLE_RE = /^\S+\.\d{4}\.\d{2}\.\d{2}$/;
const LISTING_TTL_MS = 10 * 60 * 1000;
const MAX_EXPLAIN_CHARS = 2000;

const listingCache = new Map();
const parsedCache = new Map();
const inflight = new Map();
const transCache = new Map();
const cacheDir = path.join(os.tmpdir(), 'dsh-journal-reader');
// Persistent app-state file (chats archive, saved marks, reading progress, settings).
// DSH_PROFILE_DIR is NOT set in the app process, so locate the profile from this package's own
// path: <profile>/node_modules/@local/journal-reader/index.js → walk up to the profile root.
// Falls back to the dsh home if the walk fails.
function resolveProfileDir() {
	const candidates = [];
	if (process.env.DSH_PROFILE_DIR) candidates.push(process.env.DSH_PROFILE_DIR);
	let dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
	for (let i = 0; i < 6; i++) {
		const parent = path.dirname(dir);
		if (path.basename(dir) === 'node_modules' || parent === dir) {
			if (path.basename(dir) === 'node_modules') candidates.push(path.dirname(dir));
			break;
		}
		dir = parent;
	}
	for (const c of candidates) {
		try { if (existsSync(path.join(c, 'package.json')) && existsSync(path.join(c, 'node_modules'))) return c; } catch {}
	}
	try { return path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'profiles', 'desktop'); } catch {}
	return os.homedir();
}

// The tmp cache dir is proven writable by the app (epub/pdf caches live there); the profile
// dir failed writeState inside the app for unknown reasons (ACL fine, no lock — likely a
// filesystem filter driver interfering). Same persistence semantics, different location.
const stateFile = path.join(cacheDir, 'journal-reader-state.json');
const profileStateFile = path.join(resolveProfileDir(), 'journal-reader-state.json');
function initStateFile() {
	// One-time migration: if an older version left state in the profile location, carry it over.
	try {
		if (!fs.existsSync(stateFile) && fs.existsSync(profileStateFile)) {
			fs.copyFileSync(profileStateFile, stateFile);
		}
	} catch {}
}
initStateFile();
let lastWriteError = null;
const MODEL_INFO_CACHE_MS = 10 * 60 * 1000;

let LIBRARY_DIR = path.join(os.homedir(), 'Downloads', 'EnglishJournals');

function sanitizeFileName(name) {
	return String(name).replace(/[\\/:*?"<>|]+/g, '_').trim();
}

function libraryPathFor(magTitle, date) {
	const folder = path.join(LIBRARY_DIR, sanitizeFileName(magTitle));
	return path.join(folder, `${sanitizeFileName(magTitle)} ${date}.epub`);
}

function magForPath(issuePath) {
	const prefix = issuePath.split('/')[0];
	return MAGAZINES.find((mag) => mag.key === prefix) || null;
}

/** Ensure the issue's epub exists in the local library folder; returns the absolute saved path. */
async function saveToLibrary(issuePath) {
	const mag = magForPath(issuePath);
	if (!mag) throw new Error(`unknown magazine for path: ${issuePath}`);
	const rows = await cachedListing(issuePath, false, undefined);
	const epubFile = rows.find((row) => row.type === 'file' && /\.epub$/i.test(row.name));
	if (!epubFile) throw new Error('this issue has no epub file');
	const buffer = await loadEpub(issuePath, epubFile.name);
	const target = libraryPathFor(mag.title, issuePath.split('/').pop().replace(/^(?:.*?_)?(\d{4})\.(\d{2})\.(\d{2})$/, '$1-$2-$3'));
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.writeFile(target, buffer);
	return target;
}

async function handleRead(ctx, url, res) {
	const issuePath = url.searchParams.get('path');
	if (!issuePath || issuePath.includes('..') || !/^[0-9a-z_]+(?:\/[0-9a-z_.]+){1,3}$/i.test(issuePath)) return fail(res, 'invalid issue path', 400);
	try {
		const file = await saveToLibrary(issuePath);
		sendJson(res, 200, { saved: true, file });
	} catch (error) {
		fail(res, error.message || error, 500);
	}
}

// —— Persistent app state (origin-independent storage for chats/saved/progress/settings) ——
let stateWriteTimer = null;

function readState() {
	try {
		return JSON.parse(fsSync.readFileSync(stateFile, 'utf8'));
	} catch {
		return {};
	}
}

function writeState(state) {
	try {
		fsSync.writeFileSync(stateFile, JSON.stringify(state, null, 2));
		return true;
	} catch (error) {
		lastWriteError = String((error && error.code) || (error && error.message) || error);
		console.error('[journal-reader] state write failed:', lastWriteError);
		return false;
	}
}

/** Merge one top-level key into the state file with a short debounce to coalesce rapid writes. */
function mergeState(key, value) {
	const state = readState();
	state[key] = value;
	if (stateWriteTimer) clearTimeout(stateWriteTimer);
	// Write immediately; the debounce only re-writes the SAME snapshot (never a fresh readState,
	// which would clobber concurrent writes from another fiber generation with stale data).
	writeState(state);
	stateWriteTimer = setTimeout(() => writeState(state), 400);
}

async function handleState(ctx, req, res) {
	if (req.method === 'GET') {
		const url = new URL(String(req.url), 'http://localhost');
		const key = url.searchParams.get('key') || '';
		if (!/^[a-z_.]+$/i.test(key)) return fail(res, 'invalid state key', 400);
		const state = readState();
		sendJson(res, 200, { value: state[key] ?? null });
		return;
	}
	if (req.method === 'POST') {
		let body;
		try {
			body = JSON.parse(await readBody(req, 5 * 1024 * 1024));
		} catch {
			return fail(res, 'invalid JSON body', 400);
		}
		const key = typeof body.key === 'string' && /^[a-z_.]+$/i.test(body.key) ? body.key : '';
		if (!key) return fail(res, 'invalid state key', 400);
		if (body.value === undefined || body.value === null) {
			const state = readState();
			delete state[key];
			writeState(state);
		} else {
			mergeState(key, body.value);
		}
		sendJson(res, 200, { ok: true });
		return;
	}
	res.statusCode = 405;
	res.setHeader('allow', 'GET, POST');
	res.end();
}

function sendJson(res, status, value) {
	const body = JSON.stringify(value);
	res.statusCode = status;
	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	res.end(body);
}
function fail(res, message, status = 500) {
	sendJson(res, status, { error: String(message) });
}

const GH_RETRY_STATUS = new Set([502, 503, 504]);

/**
 * Whole-repo tree in ONE request (recursive): every magazine/issue directory at once.
 * A 304 (unchanged) costs nothing against the rate limit, so refreshes are quota-free.
 * Replaces the previous 8+ /contents calls per shelf load.
 * Auth: when the user has the GitHub CLI logged in, its token lifts the rate limit
 * from 60 to 5000 requests/hour; the token is read at request time, never stored.
 */
let ghTokenCache = { at: 0, token: null };

function ghExe() {
	const candidates = [
		process.env.GH_PATH || null,
		'C:/Program Files/GitHub CLI/gh.exe',
		'C:/Program Files (x86)/GitHub CLI/gh.exe'
	].filter(Boolean);
	for (const c of candidates) {
		try { if (existsSync(c)) return c; } catch {}
	}
	return 'gh';
}

async function ghToken() {
	if (Date.now() - ghTokenCache.at < 10 * 60 * 1000) return ghTokenCache.token;
	ghTokenCache = { at: Date.now(), token: null };
	try {
		const { execFile } = await import('node:child_process');
		const { promisify } = await import('node:util');
		const { stdout } = await promisify(execFile)(ghExe(), ['auth', 'token', '--hostname', 'github.com'], { timeout: 8000, windowsHide: true, encoding: 'utf8' });
		const token = String(stdout).trim();
		if (/^gh[pousr]_/.test(token) || (token.length >= 30 && !/\s/.test(token))) ghTokenCache.token = token;
	} catch {}
	return ghTokenCache.token;
}

/**
 * 403 的说明要区分两种情况：带 token 却被限流（5000/小时也用完了），
 * 和根本没带 token（未认证的 60 次/小时，很容易撞上）。
 */
function rateLimitMessage(token) {
	if (token) {
		return 'GitHub API rate limit reached (authenticated 5000 requests/hour); try again later';
	}
	return 'GitHub API rate limit reached (unauthenticated 60 requests/hour). '
		+ 'Sign in with the GitHub CLI (gh auth login) so the plugin can use a higher limit.';
}

async function fetchIssueTree(signal) {
	const api = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/git/trees/${REPO.branch}?recursive=1`;
	const state = readState();
	const saved = state.tree || null;
	const headers = {
		accept: 'application/vnd.github+json',
		'user-agent': 'dsh-journal-reader-plugin (+https://github.com/hehonghui/awesome-english-ebooks)'
	};
	const token = await ghToken();
	if (token) headers.authorization = `Bearer ${token}`;
	if (saved && saved.etag) headers['if-none-match'] = saved.etag;
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(api, { signal, headers });
		if (res.status === 304 && saved) return saved.data;
		if (res.ok) {
			const data = await res.json();
			mergeState('tree', { at: Date.now(), etag: res.headers.get('etag') || null, data });
			return data;
		}
		if (res.status === 403) throw new Error(rateLimitMessage(token));
		if (GH_RETRY_STATUS.has(res.status) && attempt < 2) {
			await new Promise((resolve, reject) => {
				const timer = setTimeout(resolve, 1200 * (attempt + 1));
				signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
			});
			continue;
		}
		throw new Error(`GitHub API HTTP ${res.status}`);
	}
}

/** Build the magazines/issues structure from one recursive tree response. */
function issuesFromTree(treeData) {
	const byMag = new Map(MAGAZINES.map((m) => [m.key, []]));
	for (const node of treeData.tree || []) {
		if (node.type !== 'tree') continue;
		const parts = node.path.split('/');
		if (parts.length < 2 || parts.length > 3) continue;
		const magKey = parts[0];
		if (!byMag.has(magKey)) continue;
		const match = ISSUE_DIR_RE.exec(node.path.split('/').pop());
		if (!match) continue;
		byMag.get(magKey).push({ dir: node.path.split('/').pop(), path: node.path, date: `${match[1]}-${match[2]}-${match[3]}` });
	}
	return MAGAZINES.map((mag) => {
		const issues = (byMag.get(mag.key) || []).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
		return { ...mag, issues, latest: issues[0] ?? null, error: null };
	});
}

async function ghContents(query, signal) {
	const api = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/${query.split('/').map(encodeURIComponent).join('/')}?ref=${REPO.branch}`;
	const cached = listingCache.get(query);
	const headers = {
		accept: 'application/vnd.github+json',
		'user-agent': 'dsh-journal-reader-plugin (+https://github.com/hehonghui/awesome-english-ebooks)'
	};
	// 同样要带 token：contents API 与 trees API 各有各的限额，
	// 漏掉认证就会撞上未认证的 60 次/小时。
	const token = await ghToken();
	if (token) headers.authorization = `Bearer ${token}`;
	if (cached && cached.etag) headers['if-none-match'] = cached.etag;
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(api, { signal, headers });
		if (res.ok) {
			const etag = res.headers.get('etag') || null;
			const data = await res.json();
			return { data, etag };
		}
		if (res.status === 304 && cached) return { data: cached.data, etag: cached.etag };
		if (res.status === 403) throw new Error(rateLimitMessage(token));
		if (GH_RETRY_STATUS.has(res.status) && attempt < 2) {
			await new Promise((resolve, reject) => {
				const timer = setTimeout(resolve, 1200 * (attempt + 1));
				signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
			});
			continue;
		}
		throw new Error(`GitHub API HTTP ${res.status}`);
	}
}

async function cachedListing(dirPath, force, signal) {
	const hit = listingCache.get(dirPath);
	if (!force && hit && Date.now() - hit.at < LISTING_TTL_MS) return hit.data;
	const pending = inflight.get(dirPath);
	if (pending && !force) return pending;
	const task = (async () => {
		try {
			// Persisted cache (survives restarts): fall back to it when quota is exhausted.
			const state = readState();
			const saved = (state.listings || {})[dirPath];
			if (!hit && !force && saved && Date.now() - saved.at < LISTING_TTL_MS * 6) {
				listingCache.set(dirPath, { at: saved.at, data: saved.data, etag: saved.etag || null });
				return saved.data;
			}
			const { data, etag } = await ghContents(dirPath, signal);
			listingCache.set(dirPath, { at: Date.now(), data, etag });
			const listings = (readState().listings || {});
			listings[dirPath] = { at: Date.now(), data, etag };
			mergeState('listings', listings);
			return data;
		} catch (error) {
			// Quota exhausted but we have ANY persisted copy: serve it rather than failing.
			if (!hit) {
				const state = readState();
				const saved = (state.listings || {})[dirPath];
				if (saved) {
					listingCache.set(dirPath, { at: saved.at, data: saved.data, etag: saved.etag || null });
					return saved.data;
				}
			}
			throw error;
		} finally {
			inflight.delete(dirPath);
		}
	})();
	inflight.set(dirPath, task);
	return task;
}

function rawUrl(...segments) {
	return `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/${segments.map(encodeURIComponent).join('/')}`;
}

async function handleIssues(ctx, url, res) {
	const force = url.searchParams.get('refresh') === '1';
	if (force) parsedCache.clear();
	try {
		// One tree request serves the whole shelf (or a free 304 when nothing changed).
		const treeData = await fetchIssueTree(undefined);
		const magazines = issuesFromTree(treeData);
		const llm = ctx.get('llm');
		sendJson(res, 200, {
			magazines,
			explainReady: Boolean(llm && typeof llm.stream === 'function'),
			repoHtml: `https://github.com/${REPO.owner}/${REPO.repo}`
		});
	} catch (error) {
		// Serve the persisted tree when quota/network fails, rather than an error page.
		const saved = readState().tree;
		if (saved && saved.data) {
			const llm = ctx.get('llm');
			sendJson(res, 200, {
				magazines: issuesFromTree(saved.data),
				explainReady: Boolean(llm && typeof llm.stream === 'function'),
				repoHtml: `https://github.com/${REPO.owner}/${REPO.repo}`,
				stale: true
			});
			return;
		}
		fail(res, error.message || error, 502);
	}
}

async function ensureParsed(issuePath) {
	let entry = parsedCache.get(issuePath);
	if (entry) return entry;
	const rows = await cachedListing(issuePath, false, undefined);
	const epubFile = rows.find((row) => row.type === 'file' && /\.epub$/i.test(row.name));
	if (!epubFile) throw Object.assign(new Error('this issue has no epub file'), { status: 404 });
	const files = {};
	for (const row of rows) {
		if (row.type !== 'file') continue;
		if (/\.epub$/i.test(row.name)) files.epub = row.name;
		if (/\.mobi$/i.test(row.name)) files.mobi = row.name;
		if (/\.pdf$/i.test(row.name)) files.pdf = row.name;
	}
	const buffer = await loadEpub(issuePath, epubFile.name);
	const parsed = parseEpub(buffer);
	const meta = {
		path: issuePath,
		dir: issuePath.split('/')[1],
		date: issuePath.split('/').pop().replace(/^(?:.*?_)?(\d{4})\.(\d{2})\.(\d{2})$/, '$1-$2-$3'),
		epub: epubFile.name,
		files,
		rawBase: `${issuePath}/`,
		chapters: parsed.chapters
	};
	entry = { meta, read: parsed.read, readBuffer: parsed.readBuffer };
	parsedCache.set(issuePath, entry);
	return entry;
}

/** Resolve an img src inside a chapter document to its zip-internal entry path. */
function resolveZipPath(chapterHref, src) {
	let dir = chapterHref && chapterHref.includes('/') ? chapterHref.slice(0, chapterHref.lastIndexOf('/') + 1) : '';
	let clean = src.split('#')[0].replace(/^\.?\//, '');
	while (clean.startsWith('../')) {
		clean = clean.slice(3);
		dir = dir.replace(/[^/]+\/$/, '');
	}
	return clean.startsWith('/') ? clean.slice(1) : dir + clean;
}

const ASSET_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };

async function handleAsset(ctx, url, res) {
	const issuePath = url.searchParams.get('path');
	const file = url.searchParams.get('file') || '';
	if (!issuePath || issuePath.includes('..') || !/^[0-9a-z_]+(?:\/[0-9a-z_.]+){1,3}$/i.test(issuePath)) return fail(res, 'invalid issue path', 400);
	if (!file || file.includes('..')) return fail(res, 'invalid asset path', 400);
	const ext = (file.split('.').pop() || '').toLowerCase();
	const contentType = ASSET_TYPES[ext];
	if (!contentType) return fail(res, 'unsupported asset type', 400);
	try {
		const entry = await ensureParsed(issuePath);
		const buffer = entry.readBuffer(file);
		res.statusCode = 200;
		res.setHeader('content-type', contentType);
		res.setHeader('content-length', String(buffer.length));
		res.setHeader('cache-control', 'private, max-age=86400');
		res.end(buffer);
	} catch (error) {
		fail(res, error.message || error, error.status || 404);
	}
}

async function handleIssue(ctx, url, res) {
	const issuePath = url.searchParams.get('path');
	if (!issuePath || issuePath.includes('..') || !/^[0-9a-z_]+(?:\/[0-9a-z_.]+){1,3}$/i.test(issuePath)) return fail(res, 'invalid issue path', 400);
	try {
		const entry = await ensureParsed(issuePath);
		sendJson(res, 200, entry.meta);
	} catch (error) {
		fail(res, error.message || error, error.status || 500);
	}
}

async function handleChapter(ctx, url, res) {
	const issuePath = url.searchParams.get('path');
	const index = Number(url.searchParams.get('index'));
	if (!issuePath || !Number.isInteger(index) || index < 0) return fail(res, 'invalid chapter request', 400);
	try {
		const entry = await ensureParsed(issuePath);
		const chapter = entry.meta.chapters[index];
		if (!chapter) return fail(res, 'chapter index out of range', 404);
		let html;
		try {
			html = entry.read(chapter.href);
		} catch (error) {
			return fail(res, `cannot read chapter: ${error.message || error}`, 500);
		}
		sendJson(res, 200, { index, title: chapter.title, html: sanitizeHtml(html, issuePath, chapter.href) });
	} catch (error) {
		fail(res, error.message || error, error.status || 500);
	}
}

async function loadEpub(issuePath, fileName) {
	await fs.mkdir(cacheDir, { recursive: true });
	const safe = issuePath.replace(/[^0-9a-z_.]/gi, '_');
	const target = path.join(cacheDir, `${safe}.epub`);
	try {
		const stat = await fs.stat(target);
		if (stat.isFile() && stat.size > 0) return await fs.readFile(target);
	} catch {}
	const res = await fetch(rawUrl(issuePath, fileName), {
		headers: { 'user-agent': 'dsh-journal-reader-plugin' }
	});
	if (!res.ok) throw new Error(`epub download failed: HTTP ${res.status}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	await fs.writeFile(target, buffer);
	return buffer;
}

async function loadPdf(issuePath, fileName) {
	await fs.mkdir(cacheDir, { recursive: true });
	const safe = issuePath.replace(/[^0-9a-z_.]/gi, '_');
	const target = path.join(cacheDir, `${safe}.pdf`);
	try {
		const stat = await fs.stat(target);
		if (stat.isFile() && stat.size > 0) return await fs.readFile(target);
	} catch {}
	const res = await fetch(rawUrl(issuePath, fileName), {
		headers: { 'user-agent': 'dsh-journal-reader-plugin' }
	});
	if (!res.ok) throw new Error(`pdf download failed: HTTP ${res.status}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	await fs.writeFile(target, buffer);
	return buffer;
}

async function handlePdf(ctx, url, res) {
	const issuePath = url.searchParams.get('path');
	if (!issuePath || issuePath.includes('..') || !/^[0-9a-z_]+(?:\/[0-9a-z_.]+){1,3}$/i.test(issuePath)) return fail(res, 'invalid issue path', 400);
	try {
		const rows = await cachedListing(issuePath, false, undefined);
		const pdfFile = rows.find((row) => row.type === 'file' && /\.pdf$/i.test(row.name));
		if (!pdfFile) return fail(res, 'this issue has no pdf file', 404);
		const buffer = await loadPdf(issuePath, pdfFile.name);
		res.statusCode = 200;
		res.setHeader('content-type', 'application/pdf');
		res.setHeader('content-length', String(buffer.length));
		res.setHeader('cache-control', 'private, max-age=86400');
		res.end(buffer);
	} catch (error) {
		fail(res, error.message || error, 500);
	}
}

function readBody(req, limit) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on('data', (chunk) => {
			size += chunk.length;
			if (size > limit) {
				reject(new Error('payload too large'));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

async function handleTranslate(ctx, req, res) {
	const llm = ctx.get('llm');
	if (!llm || typeof llm.stream !== 'function') return fail(res, 'LLM service is not available in this profile', 503);
	let body;
	try {
		body = JSON.parse(await readBody(req, 30000));
	} catch {
		return fail(res, 'invalid JSON body', 400);
	}
	const text = typeof body.text === 'string' ? body.text.trim() : '';
	if (!text) return fail(res, 'empty text', 400);
	if (text.length > 8000) return fail(res, 'text too long (max 8000 chars)', 400);
	if (transCache.has(text)) {
		res.statusCode = 200;
		res.setHeader('content-type', 'text/plain; charset=utf-8');
		res.setHeader('cache-control', 'no-store');
		res.end(transCache.get(text));
		return;
	}
	const model = await resolveModel(ctx, llm);
	if (!model) return fail(res, 'no model configured: set a default model in settings', 503);
	let aborted = false;
	const onAbort = () => { aborted = true; };
	req.on('aborted', onAbort);
	res.on('close', onAbort);
	res.statusCode = 200;
	res.setHeader('content-type', 'text/plain; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	let acc = '';
	let finish;
	try {
		const request_ = {
			provider: model.provider,
			model: model.model,
			maxTokens: 4096,
			...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
			messages: [{
				role: 'user',
				content: [{
					type: 'text',
					text: '你是专业的英文外刊译者。把下面的英文段落翻译成通顺、地道的中文：忠实原意与语气，专有名词保留原文（首次出现可在括号内补中文），习语按中文习惯表达。只输出译文，不要解释，不要复述原文。\n\n段落：\n' + text
				}]
			}]
		};
		for await (const chunk of llm.stream(request_)) {
			if (aborted) break;
			if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
				acc += chunk.text;
				res.write(chunk.text);
			} else if (chunk && chunk.type === 'finish') {
				finish = chunk.reason;
			}
		}
		if (!aborted && finish && finish.kind === 'error') {
			const note = finish.failure?.message ? `\n\n[翻译失败：${finish.failure.message}]` : '\n\n[翻译失败]';
			res.write(note);
		} else if (!aborted && acc) {
			transCache.set(text, acc);
			if (transCache.size > 400) transCache.delete(transCache.keys().next().value);
		}
	} catch (error) {
		if (!aborted) res.write(`\n\n[翻译失败：${error.message || error}]`);
	} finally {
		req.off('aborted', onAbort);
		res.off('close', onAbort);
		if (!res.writableEnded) res.end();
	}
}

/** Minimal zip reader for epub archives (stored + deflate entries via central directory). */
function parseEpub(buffer) {
	let eocd = -1;
	for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 65536); i--) {
		if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
	}
	if (eocd < 0) throw new Error('invalid epub: zip end-of-central-directory not found');
	const count = buffer.readUInt16LE(eocd + 10);
	let p = buffer.readUInt32LE(eocd + 16);
	const entries = new Map();
	for (let i = 0; i < count; i++) {
		if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== 0x02014b50) break;
		const method = buffer.readUInt16LE(p + 10);
		const compSize = buffer.readUInt32LE(p + 20);
		const nameLen = buffer.readUInt16LE(p + 28);
		const extraLen = buffer.readUInt16LE(p + 30);
		const commentLen = buffer.readUInt16LE(p + 32);
		const localOffset = buffer.readUInt32LE(p + 42);
		const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
		entries.set(name, { method, compSize, localOffset });
		p += 46 + nameLen + extraLen + commentLen;
	}
	function readBuffer(name) {
		const entry = entries.get(name);
		if (!entry) throw new Error(`missing zip entry: ${name}`);
		const lh = entry.localOffset;
		if (lh + 30 > buffer.length || buffer.readUInt32LE(lh) !== 0x04034b50) throw new Error(`bad local header: ${name}`);
		const nameLen = buffer.readUInt16LE(lh + 26);
		const extraLen = buffer.readUInt16LE(lh + 28);
		const start = lh + 30 + nameLen + extraLen;
		const data = buffer.slice(start, start + entry.compSize);
		if (entry.method === 0) return Buffer.from(data);
		if (entry.method === 8) return zlib.inflateRawSync(data);
		throw new Error(`unsupported zip compression method ${entry.method}`);
	}
	function read(name) {
		return readBuffer(name).toString('utf8');
	}
	function text(name) {
		return read(name);
	}
	const containerXml = text('META-INF/container.xml');
	if (!containerXml) throw new Error('invalid epub: missing META-INF/container.xml');
	const opfMatch = /full-path\s*=\s*"([^"]+)"/i.exec(containerXml);
	if (!opfMatch) throw new Error('invalid epub: no rootfile in container.xml');
	const opfPath = opfMatch[1];
	const opfXml = text(opfPath);
	if (!opfXml) throw new Error(`invalid epub: missing OPF ${opfPath}`);
	const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
	const manifest = new Map();
	for (const item of opfXml.matchAll(/<item\b[^>]*>/gi)) {
		const tag = item[0];
		const id = /\bid\s*=\s*"([^"]+)"/i.exec(tag);
		const href = /\bhref\s*=\s*"([^"]+)"/i.exec(tag);
		if (!id || !href) continue;
		manifest.set(id[1], { href: resolveHref(opfDir, href[1]), tag });
	}
	const spineOrder = [...opfXml.matchAll(/<itemref\b[^>]*\bidref\s*=\s*"([^"]+)"/gi)].map((m) => m[1]);
	let tocByHref = new Map();
	const navItem = [...manifest.values()].find((item) => /properties\s*=\s*"[^"]*\bnav\b/.test(item.tag));
	const ncxId = /<spine\b[^>]*\btoc\s*=\s*"([^"]+)"/i.exec(opfXml)?.[1];
	const ncxHref = ncxId ? manifest.get(ncxId)?.href : undefined;
	if (navItem) {
		const navXml = text(navItem.href);
		if (navXml) tocByHref = parseNavToc(navXml, opfDir);
	} else if (ncxHref) {
		const ncxXml = text(ncxHref);
		if (ncxXml) tocByHref = parseNcxToc(ncxXml, ncxHref.includes('/') ? ncxHref.slice(0, ncxHref.lastIndexOf('/') + 1) : '');
	}
const chapters = [];
const seenHrefs = new Set();
for (const idref of spineOrder) {
	const item = manifest.get(idref);
	if (!item || !/x?html/i.test(item.href.split('.').pop() || '')) continue;
	const bare = item.href.split('#')[0];
	if (seenHrefs.has(bare.toLowerCase())) continue;
	seenHrefs.add(bare.toLowerCase());
	const base = bare.split('/').pop() || bare;
	if (/ad[-_]?page|advertisement/i.test(base)) continue;
	if (/cover/i.test(base)) {
		chapters.push({ index: chapters.length, href: bare, title: '封面 Cover', kind: 'section' });
		continue;
	}
	if (/(^|_)toc\b|book_toc/i.test(base)) {
		chapters.push({ index: chapters.length, href: bare, title: '目录 Contents', kind: 'section' });
		continue;
	}
	let docHtml = '';
	try {
		docHtml = read(bare) || '';
	} catch {
		docHtml = '';
	}
	const textLen = docHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
	let title = tocByHref.get(bare) || tocByHref.get(item.href) || '';
	title = (title || '').trim();
	if (SLUG_TITLE_RE.test(title)) title = '';
	const previous = chapters[chapters.length - 1];
	const sameAsPrevious = Boolean(title && previous && previous.title && previous.title.toLowerCase() === title.toLowerCase());
	// The New Yorker's ncx labels story chapters with the section name; only a tiny
	// back-to-back duplicate is a real divider page. Long texts are real content: never drop them.
	if (sameAsPrevious && textLen < 2000) continue;
	if (sameAsPrevious || !title) {
		// Prefer a more specific title extracted from the document itself.
		let inner = '';
		const heading = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/i.exec(docHtml);
		if (heading) {
			inner = cleanTitle(heading[2]);
			if (SLUG_TITLE_RE.test(inner)) inner = '';
		}
		if (!inner) {
			// calibre PDF conversions mark the story title as the first bold paragraph
			// after the section-link paragraph (no heading tags at all).
			const paras = [...docHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].slice(0, 6);
			for (const para of paras) {
				const tag = para[1];
				if (/<a\b[^>]*href\s*=\s*"[^"]*(?:magazine|category)\//i.test(tag)) continue;
				if (/<(b|strong)\b[^>]*>/i.test(tag) || /class\s*=\s*"[^"]*\bbold\b[^"]*"/i.test(tag)) {
					const boldEl = /<(?:b|strong|span)\b[^>]*class\s*=\s*"[^"]*\bbold\b[^"]*"[^>]*>([\s\S]*?)<\/(?:b|strong|span)>/i.exec(tag)
						|| /<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/i.exec(tag);
					const raw = boldEl ? boldEl[1] : tag;
					const text = cleanTitle(raw);
					if (text && text.length >= 2 && text.length <= 120 && !/^By\b/i.test(text) && !SLUG_TITLE_RE.test(text)) { inner = text; break; }
				}
			}
		}
		if (!inner) {
			const docTitle = /<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(docHtml);
			inner = docTitle ? cleanTitle(docTitle[1]) : '';
			if (SLUG_TITLE_RE.test(inner) || /^(untitled|unknown)$/i.test(inner)) inner = '';
		}
		if (inner && inner.toLowerCase() !== title.toLowerCase()) title = inner.slice(0, 100);
	}
	if (!title) {
		const text = cleanTitle(docHtml);
		const stripped = text.replace(/^\S+\.\d{4}\.\d{2}\.\d{2}\s*/, '');
		const head = stripped.slice(0, 600);
		if (/table of contents/i.test(head)) {
			title = '目录 Contents';
		} else {
			let hits = 0;
			for (const label of tocByHref.values()) if (label.length >= 4 && head.includes(label)) hits++;
			if (hits >= 4) title = '目录 Contents';
			else if (/^By\s/.test(stripped) && previous) title = `${previous.title} · Contributors`;
			else title = stripped.slice(0, 60);
		}
	}
	chapters.push({ index: chapters.length, href: bare, title: (title || '').trim(), kind: textLen < 2000 ? 'section' : 'article' });
}
	if (chapters.length === 0) throw new Error('invalid epub: empty spine');
	return {
		chapters,
		read(href) {
			return read(href);
		},
		readBuffer(href) {
			return readBuffer(href);
		}
	};
}

function resolveHref(baseDir, href) {
	const clean = href.replace(/^\.\//, '');
	if (clean.startsWith('/')) return clean.slice(1);
	return baseDir + clean;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
function decodeEntities(text) {
	return text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
		.replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole);
}

/** Strip real tags, decode entities, then strip tags that were entity-escaped (&lt;em&gt; → em). */
function cleanTitle(text) {
	return decodeEntities(String(text).replace(/<[^>]+>/g, ''))
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function parseNavToc(navXml, baseDir) {
	const map = new Map();
	for (const anchor of navXml.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = cleanTitle(anchor[2]);
		const bare = resolveHref(baseDir, anchor[1].split('#')[0]);
		if (label && bare && !map.has(bare)) map.set(bare, label);
	}
	return map;
}

function parseNcxToc(ncxXml, baseDir) {
	const map = new Map();
	for (const point of ncxXml.matchAll(/<navPoint\b[^>]*>([\s\S]*?)<\/navPoint>/gi)) {
		const label = /<text[^>]*>([\s\S]*?)<\/text>/i.exec(point[1])?.[1];
		const src = /<content\b[^>]*\bsrc\s*=\s*"([^"]+)"/i.exec(point[1])?.[1];
		if (label && src) {
			const decoded = cleanTitle(label);
			const bare = resolveHref(baseDir, src.split('#')[0]);
			if (decoded && bare && !map.has(bare)) map.set(bare, decoded);
		}
	}
	return map;
}

function sanitizeHtml(html, issuePath, chapterHref) {
	let out = html;
	out = out.replace(/<\?xml[\s\S]*?\?>/gi, '');
	out = out.replace(/<!DOCTYPE[^>]*>/gi, '');
	out = out.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
	out = out.replace(/<style[\s\S]*?<\/style\s*>/gi, '');
	out = out.replace(/<head[\s\S]*?<\/head\s*>/gi, '');
	out = out.replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, '');
	out = out.replace(/<(object|embed|base|form|input|button|textarea)\b[\s\S]*?(?:<\/\1\s*>|\/?>)/gi, '');
	// Rewrite epub-internal image references to the same-origin asset proxy route.
	out = out.replace(/<img\b[^>]*>/gi, (tag) => {
		const srcMatch = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
		const src = srcMatch ? (srcMatch[1] ?? srcMatch[2] ?? '') : '';
		if (!src) return '';
		if (/^(data|https?):/i.test(src)) return tag;
		const full = resolveZipPath(chapterHref || '', src);
		const proxy = `/jr/api/asset?path=${encodeURIComponent(issuePath || '')}&file=${encodeURIComponent(full)}`;
		return tag.replace(/\bsrc\s*=\s*(?:"[^"]*"|'[^']*')/i, `src="${proxy}"`);
	});
	out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
	out = out.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
	// calibre escapes inline emphasis as entities (&lt;em&gt;…&lt;/em&gt;); restore the
	// whitelisted formatting tags so titles and body text render as emphasis, not literal markup.
	out = out.replace(/&lt;(\/?)(em|i|b|strong|cite|sup|sub)\s*&gt;/gi, '<$1$2>');
	return out;
}

function buildExplainPrompt(mode, text) {
	if (mode === 'word') {
		return [
			'你是英语词典助手兼外刊精读老师。请用中文讲解下面这个出现在英文外刊中的单词，按四段输出：',
			'1. 音标与词性标注下的核心释义（简明列出最常用的 2-3 个义项）；',
			'2. 词根词缀或记忆线索（如适用，没有就略过）；',
			'3. 在外刊语境中它的准确含义与语域（正式/口语）；',
			'4. 一个地道例句并给出中文翻译。',
			'直接输出讲解内容，不要复述指令。',
			'',
			`单词：${text}`
		].join('\n');
	}
	return [
		'你是英语外刊精读老师。请用中文精讲下面这句来自英文外刊的句子，按四段输出：',
		'1. 语法结构拆解：找出主干（主谓宾），逐个说明从句和修饰成分，用「修饰语 → 被修饰对象」的方式讲清楚；',
		'2. 关键词汇：挑 3-6 个值得学的词或短语，给出词性与释义；',
		'3. 地道表达：指出可借鉴的写作表达或固定搭配；',
		'4. 背景知识：补充理解这句话需要的背景（如适用，没有就略过）。',
		'直接输出讲解内容，不要复述指令。',
		'',
		`句子：${text}`
	].join('\n');
}

const modelInfoCache = new Map();

async function resolveModel(ctx, llm) {
	const selection = ctx.get('agentDefaultModel');
	if (selection && typeof selection.currentSelection === 'function') {
		const picked = selection.currentSelection();
		if (picked && picked.provider && picked.model) {
			const effort = await lowestReasoningEffort(llm, picked.provider, picked.model);
			return { provider: picked.provider, model: picked.model, ...(effort ? { reasoningEffort: effort } : {}) };
		}
	}
	const providers = typeof llm.listProviders === 'function' ? llm.listProviders() : [];
	for (const provider of providers) {
		try {
			const models = await llm.listModels(provider);
			const model = Array.isArray(models) ? models.find((m) => m && m.id)?.id ?? (typeof models[0] === 'string' ? models[0] : undefined) : undefined;
			if (model) {
				const effort = await lowestReasoningEffort(llm, provider, model);
				return { provider, model, ...(effort ? { reasoningEffort: effort } : {}) };
			}
		} catch {}
	}
	return null;
}

/** Some thinking-first models reject requests without an explicit effort; pick the lowest advertised one. */
async function lowestReasoningEffort(llm, provider, model) {
	const key = `${provider}/${model}`;
	if (modelInfoCache.has(key)) return modelInfoCache.get(key);
	let effort = null;
	try {
		const info = await llm.resolveModelInfo(provider, model);
		const first = info && info.reasoning && Array.isArray(info.reasoning.efforts) ? info.reasoning.efforts[0] : undefined;
		if (first && typeof first.id === 'string') effort = first.id;
	} catch {}
	modelInfoCache.set(key, effort);
	return effort;
}

async function handleExplain(ctx, url, res, req) {
	const llm = ctx.get('llm');
	if (!llm || typeof llm.stream !== 'function') return fail(res, 'LLM service is not available in this profile', 503);
	const text = (url.searchParams.get('text') || '').trim();
	const mode = url.searchParams.get('mode') === 'word' ? 'word' : 'sentence';
	if (!text) return fail(res, 'empty text', 400);
	if (text.length > MAX_EXPLAIN_CHARS) return fail(res, `selection too long (max ${MAX_EXPLAIN_CHARS} chars)`, 400);
	const model = await resolveModel(ctx, llm);
	if (!model) return fail(res, 'no model configured: set a default model in settings', 503);
	let aborted = false;
	const onAbort = () => { aborted = true; };
	req.on('aborted', onAbort);
	res.on('close', onAbort);
	res.statusCode = 200;
	res.setHeader('content-type', 'text/plain; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	let finish;
	try {
		const request_ = {
			provider: model.provider,
			model: model.model,
			maxTokens: 2048,
			...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
			messages: [{ role: 'user', content: [{ type: 'text', text: buildExplainPrompt(mode, text) }] }]
		};
		for await (const chunk of llm.stream(request_)) {
			if (aborted) break;
			if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') res.write(chunk.text);
			else if (chunk && chunk.type === 'finish') finish = chunk.reason;
		}
		if (!aborted && finish && finish.kind === 'error') {
			const note = finish.failure?.message ? `\n\n[AI 讲解失败：${finish.failure.message}]` : '\n\n[AI 讲解失败]';
			res.write(note);
		}
	} catch (error) {
		if (!aborted) res.write(`\n\n[AI 讲解失败：${error.message || error}]`);
	} finally {
		req.off('aborted', onAbort);
		res.off('close', onAbort);
		if (!res.writableEnded) res.end();
	}
}

async function handleAsk(ctx, req, res) {
	const llm = ctx.get('llm');
	if (!llm || typeof llm.stream !== 'function') return fail(res, 'LLM service is not available in this profile', 503);
	let body;
	try {
		body = JSON.parse(await readBody(req, 60000));
	} catch {
		return fail(res, 'invalid JSON body', 400);
	}
	const history = Array.isArray(body.messages) ? body.messages : [];
	if (history.length === 0 || history.length > 24) return fail(res, 'messages must be a non-empty array (max 24)', 400);
	for (const m of history) {
		if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) return fail(res, 'each message needs role user/assistant and string content', 400);
	}
	const context = typeof body.context === 'string' ? body.context.slice(0, 8000) : '';
	const model = await resolveModel(ctx, llm);
	if (!model) return fail(res, 'no model configured: set a default model in settings', 503);
	let aborted = false;
	const onAbort = () => { aborted = true; };
	req.on('aborted', onAbort);
	res.on('close', onAbort);
	res.statusCode = 200;
	res.setHeader('content-type', 'text/plain; charset=utf-8');
	res.setHeader('cache-control', 'no-store');
	let finish;
	try {
		const sysText = '你是资深英语外刊精读助教。学生正在阅读英文外刊，请用中文回答他们关于文章的问题：解释词汇、语法、背景，或按要求总结、翻译。回答紧扣给出的文章片段；片段之外的信息请注明是背景知识。'
			+ (context ? '\n\n【当前文章片段】\n' + context : '');
		// Hand-built assistant messages lack the durable replay metadata the LLM adapter
		// requires, so multi-turn history is folded into one user message as a transcript.
		const lines = [];
		for (const m of history.slice(0, -1)) {
			lines.push(m.role === 'user' ? `【学生】${m.content}` : `【助教】${m.content}`);
		}
		const last = history[history.length - 1];
		let prompt = sysText;
		if (lines.length) prompt += '\n\n【之前的对话】\n' + lines.join('\n');
		prompt += '\n\n【学生】' + last.content;
		const request_ = {
			provider: model.provider,
			model: model.model,
			maxTokens: 4096,
			...(model.reasoningEffort ? { reasoningEffort: model.reasoningEffort } : {}),
			messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
		};
		for await (const chunk of llm.stream(request_)) {
			if (aborted) break;
			if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') res.write(chunk.text);
			else if (chunk && chunk.type === 'finish') finish = chunk.reason;
		}
		if (!aborted && finish && finish.kind === 'error') {
			const note = finish.failure?.message ? `\n\n[回答失败：${finish.failure.message}]` : '\n\n[回答失败]';
			res.write(note);
		}
	} catch (error) {
		if (!aborted) res.write(`\n\n[回答失败：${error.message || error}]`);
	} finally {
		req.off('aborted', onAbort);
		res.off('close', onAbort);
		if (!res.writableEnded) res.end();
	}
}

// —— Edge TTS（微软云端神经语音）——
// 一个常驻的 Python 子进程跑 speech.py，逐行收发 JSON 帧。这样每句合成的
// 开销只是一次 stdin 写入，不用反复付 Python 的启动时间。
// 进程不可用时返回 null，客户端会退回浏览器的 Web Speech API。
const speechState = {
	child: null,
	stdin: null,
	pending: new Map(),
	buffer: '',
	seq: 0,
	failed: false,
	scriptStamp: 0,     // speech.py 的 mtime，用来发现脚本改动并重启常驻进程
};

function pythonCandidates() {
	const list = [];
	// DSH 自带的运行时（安装目录与用户目录各有一份）。
	const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
	const installRoot = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
	list.push(path.join(home, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'));
	list.push(path.join(installRoot, 'runtime', 'primary-runtime', 'dependencies', 'python', 'python.exe'));
	// PATH 上的 python。
	list.push('python');
	list.push('python3');
	return list;
}

function resolvePython() {
	for (const candidate of pythonCandidates()) {
		if (!candidate.includes(path.sep)) return candidate;
		try { if (existsSync(candidate)) return candidate; } catch {}
	}
	return null;
}

function speechScriptPath() {
	const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
	return path.join(dir, 'speech.py');
}

function emitFrame(frame) {
	const child = speechState.child;
	if (!child || !child.stdin || child.stdin.destroyed) return;
	try {
		child.stdin.write(JSON.stringify(frame) + '\n');
	} catch {}
}

function handleSpeechFrame(line) {
	let frame;
	try { frame = JSON.parse(line); } catch { return; }
	// speech.py 给每个响应带上请求 id：客户端会并发合成（当前段 + 预取下一段），
	// 没有 id 就无法把响应分发给正确的请求。
	const key = frame.id;
	const entry = key ? speechState.pending.get(key) : null;
	if (!entry) return;
	if (frame.type === 'error') {
		speechState.pending.delete(key);
		entry.reject(new Error(frame.message || 'edge tts error'));
		return;
	}
	if (frame.type === 'voices') {
		speechState.pending.delete(key);
		entry.resolve(frame.voices || []);
		return;
	}
	entry.onFrame?.(frame);
	if (frame.type === 'done') {
		speechState.pending.delete(key);
		entry.resolve?.();
	}
}

async function ensureSpeechProcess(ctx) {
	if (speechState.failed) return null;
	const script = speechScriptPath();
	// 常驻的 Python 进程会把启动时的脚本读进内存：改了 speech.py 之后，
	// 老进程仍在跑旧代码。这里比对 mtime，发现变化就换掉它。
	if (speechState.child && !speechState.child.killed) {
		let stamp = 0;
		try { stamp = fsSync.statSync(script).mtimeMs; } catch {}
		if (stamp && speechState.scriptStamp && stamp !== speechState.scriptStamp) {
			try { speechState.child.kill(); } catch {}
			speechState.child = null;
		} else {
			return speechState.child;
		}
	}
	const python = resolvePython();
	if (!python || !existsSync(script)) { speechState.failed = true; return null; }
	let stamp = 0;
	try { stamp = fsSync.statSync(script).mtimeMs; } catch {}
	const { spawn } = await import('node:child_process');
	let child;
	try {
		child = spawn(python, [script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
	} catch {
		speechState.failed = true;
		return null;
	}
	speechState.child = child;
	speechState.scriptStamp = stamp;
	speechState.buffer = '';
	child.stdout.setEncoding('utf8');
	child.stdout.on('data', (chunk) => {
		speechState.buffer += chunk;
		let index;
		while ((index = speechState.buffer.indexOf('\n')) >= 0) {
			const line = speechState.buffer.slice(0, index).trim();
			speechState.buffer = speechState.buffer.slice(index + 1);
			if (line) handleSpeechFrame(line);
		}
	});
	child.on('error', () => { speechState.failed = true; speechState.child = null; });
	child.on('exit', () => {
		speechState.child = null;
		for (const entry of speechState.pending.values()) {
			try { entry.reject(new Error('edge tts process exited')); } catch {}
		}
		speechState.pending.clear();
	});
	// 若 python 能启动但缺少 edge_tts，首个请求会收到 error 帧。
	return child;
}

async function requestSpeechFrame(request, onFrame, timeoutMs = 120000) {
	const child = await ensureSpeechProcess();
	if (!child) throw new Error('edge tts unavailable');
	return new Promise((resolve, reject) => {
		// 每个请求一个独立的 id 与键：客户端会并发合成（当前段 + 预取下一段），
		// 固定键会让后一个请求覆盖前一个的 pending，导致音频张冠李戴。
		const id = `r${++speechState.seq}`;
		const key = id;
		const timer = setTimeout(() => {
			speechState.pending.delete(key);
			reject(new Error('edge tts timeout'));
		}, timeoutMs);
		speechState.pending.set(key, {
			onFrame,
			resolve: (value) => { clearTimeout(timer); speechState.pending.delete(key); resolve(value); },
			reject: (error) => { clearTimeout(timer); speechState.pending.delete(key); reject(error); }
		});
		emitFrame({ ...request, id });
	});
}

async function handleVoices(ctx, res) {
	try {
		const voices = await requestSpeechFrame({ op: 'voices' }, null, 20000);
		sendJson(res, 200, { voices });
	} catch (error) {
		fail(res, error.message || error, 503);
	}
}

async function handleSpeech(ctx, req, res) {
	let body;
	try {
		body = JSON.parse(await readBody(req, 200000));
	} catch {
		return fail(res, 'invalid JSON body', 400);
	}
	const text = typeof body.text === 'string' ? body.text.trim() : '';
	if (!text) return fail(res, 'empty text', 400);
	if (text.length > 20000) return fail(res, 'text too long (max 20000 chars)', 400);
	// 孤立代理项（半个 emoji）会让 Python 的 UTF-8 编码直接失败。
	// 这里把落单的代理项替换掉，宁可少一个符号，也不要整段合成失败。
	const safeText = text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, ' ');
	const voice = typeof body.voice === 'string' && /^[A-Za-z0-9-]+$/.test(body.voice) ? body.voice : 'en-US-AvaNeural';
	const rate = Number.isFinite(Number(body.rate)) ? Math.min(2, Math.max(0.5, Number(body.rate))) : 1;
	const volume = Number.isFinite(Number(body.volume)) ? Math.min(1, Math.max(0.1, Number(body.volume))) : 1;

	res.statusCode = 200;
	res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
	res.setHeader('cache-control', 'no-store');

	// 响应是一串 JSON 行（与 speech.py 的帧协议一致），音频以 base64 承载。
	// 统一成一种帧格式，客户端就不必在二进制里猜哪里是 mp3、哪里是时间戳。
	const send = (frame) => {
		if (!res.writableEnded) res.write(JSON.stringify(frame) + '\n');
	};
	send({ type: 'header', voice, rate });
	try {
		await requestSpeechFrame({ op: 'synthesize', text: safeText, voice, rate, volume }, (frame) => {
			if (frame.type === 'audio') send({ type: 'audio', data: frame.data });
			else if (frame.type === 'boundary') {
				send({
					type: 'boundary',
					offset: frame.offset,
					duration: frame.duration,
					text: frame.text
				});
			}
		});
	} catch (error) {
		send({ type: 'error', message: String(error.message || error) });
	}
	send({ type: 'done' });
	res.end();
}

async function handle(ctx, req, res) {
	const url = new URL(String(req.url), 'http://localhost');
	const route = url.pathname.replace(/^\/jr\/api/, '') || '/';
	try {
		if (route === '/translate') {
			if (req.method !== 'POST') {
				res.statusCode = 405;
				res.setHeader('allow', 'POST');
				res.end();
				return;
			}
			return await handleTranslate(ctx, req, res);
		}
		if (route === '/ask') {
			if (req.method !== 'POST') {
				res.statusCode = 405;
				res.setHeader('allow', 'POST');
				res.end();
				return;
			}
			return await handleAsk(ctx, req, res);
		}
		if (route === '/state') return await handleState(ctx, req, res);
		// /speech 是 POST 路由，必须排在下面那个「只允许 GET」的通用守卫之前，
		// 否则 POST 会在到达它之前就被 405 拦下。
		if (route === '/speech') {
			if (req.method !== 'POST') {
				res.statusCode = 405;
				res.setHeader('allow', 'POST');
				res.end();
				return;
			}
			return await handleSpeech(ctx, req, res);
		}
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			res.statusCode = 405;
			res.setHeader('allow', 'GET');
			res.end();
			return;
		}
		if (route === '/issues') return await handleIssues(ctx, url, res);
		if (route === '/issue') return await handleIssue(ctx, url, res);
		if (route === '/chapter') return await handleChapter(ctx, url, res);
		if (route === '/read') return await handleRead(ctx, url, res);
		if (route === '/pdf') return await handlePdf(ctx, url, res);
		if (route === '/asset') return await handleAsset(ctx, url, res);
		if (route === '/explain') return await handleExplain(ctx, url, res, req);
		if (route === '/voices') return await handleVoices(ctx, res);
		fail(res, 'not found', 404);
	} catch (error) {
		if (!res.headersSent) fail(res, error.message || error, 500);
		else if (!res.writableEnded) res.end();
	}
}

export const inject = ['webServer'];

export function apply(ctx, config) {
	LIBRARY_DIR = config && config.libraryDir && String(config.libraryDir).trim()
		? path.resolve(String(config.libraryDir).trim().replace(/^~/, os.homedir()))
		: path.join(os.homedir(), 'Downloads', 'EnglishJournals');
	ctx.effect(() => ctx.webServer.register({
		kind: 'prefix',
		path: '/jr/api',
		handler: (req, res) => { handle(ctx, req, res); }
	}, 'journal-reader: /jr/api routes'), 'journal-reader: route registration');
}
