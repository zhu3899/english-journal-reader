/**
 * Client half of the Journal Reader bundle: a full main-panel page registered as
 * key "journal" plus its sidebar icon. Renders the magazine shelf, the epub
 * reader, the selection popup (dictionary lookup + streamed AI explanation),
 * and hands deep dives off to a conversation via uiWorkspace.startSession.
 */
window.__ModuleLoader__.load({
	id: '@local/journal-reader',
	factory(require) {
		const React = require('react');
		const { useState, useEffect, useRef, useCallback, useMemo } = React;
		const h = React.createElement;

		const NS = 'journal';
		const PANEL_ID = 'journal';
		const PROGRESS_KEY = 'journal.reader.progress';
		const SETTINGS_KEY = 'journal.reader.settings';

		const zh = {
			panel: '外刊精读台',
			title: '外刊精读台',
			subtitle: '英文外刊 · 数据来自 awesome-english-ebooks',
			refresh: '刷新',
			loading: '加载中…',
			retry: '重试',
			loadFailed: '加载失败',
			openLatest: '阅读最新一期',
			open: '打开',
			more: '更多往期',
			less: '收起',
			latest: '最新',
			opening: '正在打开这一期…',
			weekly: '周刊',
			monthly: '月刊',
			back: '返回期刊架',
			toc: '目录',
			fontSmaller: 'A-',
			fontLarger: 'A+',
			onGithub: 'GitHub',
			download: '下载',
			selectHint: '选中单词或句子，即可查词或 AI 精讲',
			lookup: '查词',
			explain: 'AI 讲解',
			close: '关闭',
			dictLoading: '查询词典中…',
			dictFailed: '词典查询失败',
			wordNotFound: '未找到该词的词典释义',
			explainLoading: 'AI 正在讲解…',
			explainFailed: 'AI 讲解失败',
			explainUnavailable: 'AI 讲解不可用：当前环境没有已配置的模型',
			chapterFallback: '第 {n} 节',
			noChapters: '这一期暂无可读章节',
			issuesCount: '{n} 期可读',
			saved: '已存',
			saveFailed: '本地保存失败',
			chat: 'AI 问答',
			chatPlaceholder: '就这篇文章提问…（Enter 发送，Shift+Enter 换行）',
			chatHint: '提问会自动附带当前章节内容。例如：总结这篇文章、第三段是什么意思？',
			send: '发送',
			chatHide: '收起面板（对话自动保存，随时可回来看）',
			chatClear: '清空本期的对话记录',
			translate: '翻译',
			transLoading: '翻译中…',
			dual: '对照',
			pdf: 'PDF',
			textMode: '文字版'
		};
		const en = {
			panel: 'Journal Reader',
			title: 'Journal Reader',
			subtitle: 'English magazines · data from awesome-english-ebooks',
			refresh: 'Refresh',
			loading: 'Loading…',
			retry: 'Retry',
			loadFailed: 'Failed to load',
			openLatest: 'Read the latest issue',
			open: 'Open',
			more: 'More issues',
			less: 'Collapse',
			latest: 'Latest',
			opening: 'Opening this issue…',
			weekly: 'weekly',
			monthly: 'monthly',
			back: 'Back to shelf',
			toc: 'Contents',
			fontSmaller: 'A-',
			fontLarger: 'A+',
			onGithub: 'GitHub',
			download: 'Download',
			selectHint: 'Select a word or a sentence to look it up or get an AI explanation',
			lookup: 'Lookup',
			explain: 'AI explain',
			close: 'Close',
			dictLoading: 'Querying dictionary…',
			dictFailed: 'Dictionary lookup failed',
			wordNotFound: 'No dictionary entry found',
			explainLoading: 'AI is explaining…',
			explainFailed: 'AI explanation failed',
			explainUnavailable: 'AI explanation is unavailable: no model is configured',
			chapterFallback: 'Section {n}',
			noChapters: 'No readable chapters in this issue',
			issuesCount: '{n} issues',
			saved: 'Saved',
			saveFailed: 'Local save failed',
			chat: 'AI chat',
			chatPlaceholder: 'Ask about this article… (Enter to send, Shift+Enter for newline)',
			chatHint: 'Questions automatically include the current chapter. Try: summarize this, what does paragraph 3 mean?',
			send: 'Send',
			chatHide: 'Hide panel (the conversation is saved automatically)',
			chatClear: 'Clear this issue\'s conversation',
			translate: 'Translate',
			transLoading: 'Translating…',
			dual: 'Bilingual',
			pdf: 'PDF',
			textMode: 'Text'
		};

		const CSS = [
			'.jr-page{height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
			'.jr-shell{max-width:960px;margin:0 auto;padding:28px 24px 48px}',
			'.jr-title{font-size:22px;font-weight:650;letter-spacing:.2px}',
			'.jr-sub{margin-top:4px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
			'.jr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px}',
			'.jr-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
			'.jr-btn:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-btn:disabled{opacity:.5;cursor:default}',
			'.jr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:16px;align-items:stretch}',
			'.jr-mag{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;min-height:0}',
			'.jr-mag-head{display:flex;align-items:center;gap:10px;flex:none}',
			'.jr-chip{width:34px;height:34px;border-radius:8px;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;flex:none}',
			'.jr-mag-name{font-size:15px;font-weight:600}',
			'.jr-mag-meta{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:1px}',
			'.jr-issues{margin-top:10px;border-top:1px solid var(--dsw-alias-border-l1);flex:1;min-height:0;overflow-y:auto;max-height:460px;scrollbar-width:thin;scrollbar-gutter:stable}',
			'.jr-issue{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 8px;border:0;background:none;color:inherit;font:inherit;font-size:13px;border-radius:8px;cursor:pointer;text-align:left}',
			'.jr-issue:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-issue-date{font-variant-numeric:tabular-nums}',
			'.jr-issue-latest{font-size:11px;color:var(--dsw-alias-brand-primary);border:1px solid currentColor;border-radius:99px;padding:0 7px;line-height:16px;margin-left:8px}',
			'.jr-issue-saved{font-size:11px;color:var(--dsw-alias-state-success-primary);border:1px solid currentColor;border-radius:99px;padding:0 7px;line-height:16px;margin-left:8px}',
			'.jr-para{position:relative}',
			'.jr-para-btn{position:absolute;right:0;top:-12px;opacity:0;transition:opacity .15s;appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-secondary);border-radius:99px;padding:1px 9px;font-size:11px;cursor:pointer;z-index:2}',
			'.jr-para:hover .jr-para-btn{opacity:1}',
			'.jr-para-btn:hover{color:var(--dsw-alias-brand-primary)}',
			'.jr-para-trans{margin:2px 0 16px;padding:8px 12px;border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);border-radius:0 8px 8px 0;color:var(--dsw-alias-label-secondary);font-size:.92em;line-height:1.75;white-space:pre-wrap}',
			'.jr-pdf{flex:1;width:100%;border:0;min-height:0}',
			'.jr-issue-links{display:flex;gap:10px;align-items:center;flex:none}',
			'.jr-link{color:var(--dsw-alias-label-secondary);font-size:12px;text-decoration:none}',
			'.jr-link:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}',
			'.jr-empty{padding:14px 8px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
			'.jr-month{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;padding:7px 8px;border-radius:8px;cursor:pointer}',
			'.jr-month:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-month-chevron{color:var(--dsw-alias-label-secondary);font-size:11px;width:10px;flex:none}',
			'.jr-month-count{margin-left:auto;color:var(--dsw-alias-label-secondary);font-weight:400;font-size:12px}',
			'.jr-error{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary);font-size:13px}',
			'.jr-spin{width:16px;height:16px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:jr-rotate .8s linear infinite;display:inline-block;flex:none}',
			'@keyframes jr-rotate{to{transform:rotate(360deg)}}',
			'.jr-center{display:flex;align-items:center;justify-content:center;gap:10px;padding:60px 0;color:var(--dsw-alias-label-secondary);font-size:14px}',
			'.jr-reader{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}',
			'.jr-topbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}',
			'.jr-topbar-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}',
			'.jr-body{flex:1;display:flex;min-height:0}',
			'.jr-toc{width:240px;flex:none;border-right:1px solid var(--dsw-alias-border-l1);overflow:auto;padding:10px 8px;background:var(--dsw-specific-sidebar-fill)}',
			'.jr-toc-item{display:block;width:100%;text-align:left;border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.jr-toc-item:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
			'.jr-toc-item[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-weight:600}',
			'.jr-toc-item[data-kind="section"]{font-weight:650;color:var(--dsw-alias-brand-primary);margin-top:6px}',
			'.jr-toc-item[data-kind="article"]{padding-left:22px;color:var(--dsw-alias-label-primary)}',
			'.jr-article-wrap{flex:1;overflow:auto;position:relative}',
			'.jr-article{max-width:720px;margin:0 auto;padding:36px 36px 90px;font-family:Georgia,"Times New Roman",serif;font-size:var(--jr-font-size,17px);line-height:1.8;color:var(--dsw-alias-label-primary)}',
			'.jr-article h1,.jr-article h2,.jr-article h3{line-height:1.35;margin:1.4em 0 .6em}',
			'.jr-article h1{font-size:1.5em}.jr-article h2{font-size:1.3em}.jr-article h3{font-size:1.12em}',
			'.jr-article p{margin:0 0 1em}',
			'.jr-article img{max-width:100%;height:auto;display:block;margin:1em auto}',
			'.jr-article blockquote{margin:1em 0;padding:2px 0 2px 14px;border-left:3px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}',
			'.jr-article a{color:var(--dsw-alias-brand-primary)}',
			'.jr-popup{position:fixed;z-index:60;max-width:460px;min-width:260px;max-height:340px;overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.22);padding:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary)}',
			'.jr-popup-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
			'.jr-popup-bar{display:flex;flex-direction:column;gap:10px}',
			'.jr-popup-grip{display:flex;align-items:center;gap:8px;width:100%;appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;padding:2px 2px;cursor:grab;user-select:none;text-align:left}',
			'.jr-popup-grip:active{cursor:grabbing}',
			'.jr-popup-grip:hover{color:var(--dsw-alias-label-primary)}',
			'.jr-popup-grip-dots{font-size:13px;letter-spacing:1px;flex:none}',
			'.jr-popup-grip-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary);font-weight:600}',
			'.jr-popup-grip-chevron{font-size:10px;flex:none;opacity:.8}',
			'.jr-popup-bar.is-collapsed .jr-popup-grip{padding:4px 2px}',
			'.jr-popup-bodywrap{padding-top:2px}',
			'.jr-drag{cursor:grab;color:var(--dsw-alias-label-secondary);font-size:14px;padding:0 3px;user-select:none;line-height:1}',
			'.jr-chat{width:380px;min-width:260px;flex:none;border-left:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);min-height:0;position:relative}',
			'.jr-chat-resize{position:absolute;left:-7px;top:0;bottom:0;width:14px;cursor:ew-resize;z-index:5}',
			'.jr-chat-resize:after{content:"";position:absolute;left:6px;top:0;bottom:0;width:2px;background:var(--dsw-alias-border-l2);border-radius:1px;transition:background .15s,width .15s,left .15s}',
			'.jr-chat-resize:hover:after,.jr-chat-resize:active:after{left:5px;width:3px;background:var(--dsw-alias-brand-primary)}',
			'.jr-chat-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);font-weight:600;font-size:13px}',
			'.jr-chat-msgs{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-height:0}',
			'.jr-chat-msg{font-size:13px;line-height:1.65;word-break:break-word}',
			'.jr-chat-msg h3{font-size:13px;margin:10px 0 4px}',
			'.jr-chat-msg p{margin:0 0 8px}',
			'.jr-chat-msg p:last-child{margin-bottom:0}',
			'.jr-chat-msg ul{margin:4px 0 8px;padding-left:18px}',
			'.jr-chat-msg li{margin:2px 0}',
			'.jr-chat-msg code{background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:0 4px;font-size:12px}',
			'.jr-chat-msg strong{font-weight:650}',
			'.jr-chat-user{align-self:flex-end;background:var(--dsw-alias-bg-layer-2);border-radius:10px;padding:8px 10px;max-width:88%}',
			'.jr-chat-bot{align-self:stretch}',
			'.jr-chat-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1);align-items:flex-end}',
			'.jr-chat-input textarea{flex:1;resize:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:6px 8px;min-height:46px}',
			'.jr-drag:active{cursor:grabbing}',
			'.jr-mini{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:99px;padding:4px 10px;font-size:12px;cursor:pointer}',
			'.jr-mini:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-mini[data-active="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}',
			'.jr-popup-body{white-space:pre-wrap;word-break:break-word;margin-top:10px}',
			'.jr-dict-word{font-size:15px;font-weight:650}',
			'.jr-dict-phon{color:var(--dsw-alias-label-secondary);margin-left:8px;font-size:12px}',
			'.jr-dict-pos{color:var(--dsw-alias-brand-primary);font-style:italic;margin-top:8px}',
			'.jr-dict-def{margin:2px 0 0 12px}',
			'.jr-hint{color:var(--dsw-alias-label-secondary);font-size:12px;padding:8px 2px 2px}'
		].join('\n');

		function insertStyles(css) {
			if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') return styles.insert(css);
			if (typeof document === 'undefined') return () => undefined;
			const tag = document.createElement('style');
			tag.textContent = css;
			document.head.appendChild(tag);
			return () => { tag.remove(); };
		}

		// Persistent state lives on the HOST side (a JSON file next to the profile), because
		// browser localStorage is origin-scoped and the GUI port changes every app restart —
		// per-origin storage would strand chats/progress in dead namespaces. localStorage is
		// still read once as a migration fallback for data written by older versions.
		const stateCache = {};
		const stateLoaded = {};
		function readJson(key, fallback) {
			if (stateLoaded[key]) {
				const v = stateCache[key];
				return v === undefined || v === null ? fallback : v;
			}
			// Synchronous localStorage fallback: bootstrap value until the host read resolves.
			let local = fallback;
			try {
				const raw = localStorage.getItem(key);
				if (raw) local = JSON.parse(raw);
			} catch {}
			stateLoaded[key] = false;
			fetch('/jr/api/state?key=' + encodeURIComponent(key)).then(async (r) => {
				if (!r.ok) { stateLoaded[key] = true; stateCache[key] = local; return; }
				const data = await r.json().catch(() => ({}));
				let value = data.value;
				// Migration: seed the host file from localStorage if the host has nothing yet.
				if ((value === undefined || value === null) && local !== undefined && local !== null && local !== fallback) {
					writeJson(key, local);
					value = local;
				}
				stateCache[key] = value === undefined || value === null ? fallback : value;
				stateLoaded[key] = true;
			}).catch(() => { stateLoaded[key] = true; stateCache[key] = local; });
			return local;
		}
		function writeJson(key, value) {
			stateCache[key] = value;
			stateLoaded[key] = true;
			try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
			fetch('/jr/api/state', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key, value })
			}).catch(() => {});
		}

		async function getJson(url, signal) {
			const res = await fetch(url, { signal });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
			return data;
		}

		function chapterTitleFallback(html, index, t) {
			const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html || '');
			if (heading) {
				const text = heading[1].replace(/<[^>]+>/g, '').trim();
				if (text) return text.slice(0, 80);
			}
			return t('chapterFallback').replace('{n}', String(index + 1));
		}

		function chatPrompt(text, isWord) {
			if (isWord) {
				return `我在外刊阅读中遇到这个单词：${text}\n请作为英语外刊老师，用中文讲解它的音标、核心释义（标注词性）、词根词缀记忆线索、在外刊语境中的准确含义，并给一个地道例句和翻译。`;
			}
			return `我在阅读英文外刊时遇到这个句子，请帮我精读讲解：先拆解语法结构（主干与修饰成分），再讲关键词汇与地道表达，最后补充必要的背景知识。请用中文。\n\n句子：${text}`;
		}

		const JournalIcon = () => h('svg', {
			viewBox: '0 0 20 20', width: 20, height: 20, 'aria-hidden': true,
			style: { display: 'block' }
		},
			h('rect', { x: 3, y: 2.5, width: 14, height: 15, rx: 2, fill: 'currentColor', opacity: .16 }),
			h('path', { d: 'M5.5 6h5.5M5.5 8.6h9M5.5 11.2h9M5.5 13.8h4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none' }),
			h('rect', { x: 11.8, y: 12.6, width: 2.8, height: 2.8, rx: .7, fill: 'currentColor' })
		);

		function MagazineCard({ mag, t, onOpen, savedSet }) {
			const issues = mag.issues || [];
			const byMonth = mag.cadence !== 'monthly';
			const groups = [];
			for (const issue of issues) {
				const key = byMonth ? issue.date.slice(0, 7) : issue.date.slice(0, 4);
				const last = groups[groups.length - 1];
				if (last && last.month === key) last.items.push(issue);
				else groups.push({ month: key, items: [issue] });
			}
			const [openMonths, setOpenMonths] = useState(() => new Set(issues.length ? [byMonth ? issues[0].date.slice(0, 7) : issues[0].date.slice(0, 4)] : []));
			const toggleMonth = (month) => setOpenMonths((current) => {
				const next = new Set(current);
				if (next.has(month)) next.delete(month);
				else next.add(month);
				return next;
			});
			const issueRow = (issue, isLatest) => h('div', { key: issue.path, style: { display: 'flex', alignItems: 'center' } },
				h('button', { className: 'jr-issue', style: { flex: 1 }, onClick: () => onOpen(issue.path) },
					h('span', { className: 'jr-issue-date' },
						issue.date,
						isLatest ? h('span', { className: 'jr-issue-latest' }, t('latest')) : null,
						savedSet && savedSet.has(issue.path) ? h('span', { className: 'jr-issue-saved' }, t('saved')) : null
					)
				),
				h('a', {
					className: 'jr-link',
					href: `https://github.com/hehonghui/awesome-english-ebooks/tree/master/${issue.path}`,
					target: '_blank', rel: 'noreferrer'
				}, t('onGithub'))
			);
			const cadence = mag.cadence === 'weekly' ? t('weekly') : t('monthly');
			return h('div', { className: 'jr-mag' },
				h('div', { className: 'jr-mag-head' },
					h('div', { className: 'jr-chip', style: { background: mag.color } }, mag.title.charAt(0)),
					h('div', { style: { minWidth: 0, flex: 1 } },
						h('div', { className: 'jr-mag-name' }, mag.title),
						h('div', { className: 'jr-mag-meta' }, `${mag.zh} · ${cadence}${issues.length ? ` · ${t('issuesCount').replace('{n}', String(issues.length))}` : ''}`)
					)
				),
				mag.error ? h('div', { className: 'jr-error' }, mag.error) : null,
				!mag.error && issues.length ? h('div', { className: 'jr-issues' },
					groups.map((group) => {
						const open = openMonths.has(group.month);
						return h('div', { key: group.month },
							h('button', {
								className: 'jr-month',
								onClick: () => toggleMonth(group.month),
								'aria-expanded': open
							},
								h('span', { className: 'jr-month-chevron' }, open ? '▾' : '▸'),
								h('span', null, group.month),
								h('span', { className: 'jr-month-count' }, String(group.items.length))
							),
							open ? group.items.map((issue, index) => issueRow(issue, index === 0 && group.month === groups[0].month)) : null
						);
					})
				) : null
			);
		}

		function ShelfView({ data, loading, error, t, onRefresh, onOpen, onRetry, savedSet }) {
			if (loading) return h('div', { className: 'jr-center' }, h('span', { className: 'jr-spin' }), t('loading'));
			if (error) return h('div', { className: 'jr-shell' },
				h('div', { className: 'jr-error' }, error),
				h('div', { style: { marginTop: 12 } }, h('button', { className: 'jr-btn', onClick: onRetry }, t('retry')))
			);
			const magazines = data.magazines || [];
			return h('div', { className: 'jr-shell' },
				h('div', { className: 'jr-head' },
					h('div', null,
						h('div', { className: 'jr-title' }, t('title')),
						h('div', { className: 'jr-sub' }, t('subtitle'))
					),
					h('button', { className: 'jr-btn', onClick: onRefresh }, t('refresh'))
				),
				h('div', { className: 'jr-grid' },
					magazines.map((mag) => h(MagazineCard, { key: mag.key, mag, t, onOpen, savedSet }))
				),
				h('div', { className: 'jr-hint', style: { marginTop: 16 } }, t('selectHint'))
			);
		}

		async function streamBody(res, onChunk) {
			const reader = res.body && res.body.getReader ? res.body.getReader() : null;
			if (!reader) {
				const text = await res.text();
				onChunk(text);
				return text;
			}
			const decoder = new TextDecoder();
			let acc = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += decoder.decode(value, { stream: true });
				onChunk(acc);
			}
			return acc;
		}

		async function postTranslate(text, signal, onChunk) {
			const res = await fetch('/jr/api/translate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text }),
				signal
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || `HTTP ${res.status}`);
			}
			return streamBody(res, onChunk);
		}

		function hashStr(s) {
			let hh = 5381;
			for (let i = 0; i < s.length; i++) hh = ((hh << 5) + hh + s.charCodeAt(i)) | 0;
			return (hh >>> 0).toString(36);
		}

		function escapeAttr(value) {
			return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		}

		/** Minimal safe Markdown for AI answers: escape first, then whitelist a few block/inline forms. */
		function renderMarkdown(text) {
			const escaped = String(text)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
			const lines = escaped.split(/\r?\n/);
			const out = [];
			let list = false;
			const closeList = () => { if (list) { out.push('</ul>'); list = false; } };
			const inline = (s) => s
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
				.replace(/`([^`]+)`/g, '<code>$1</code>');
			for (const raw of lines) {
				const line = raw.trim();
				if (!line) { closeList(); continue; }
				const heading = /^(#{1,6})\s+(.*)$/.exec(line);
				if (heading) { closeList(); out.push(`<h3>${inline(heading[2])}</h3>`); continue; }
				const item = /^[-*•]\s+(.*)$/.exec(line);
				if (item) {
					if (!list) { out.push('<ul>'); list = true; }
					out.push(`<li>${inline(item[1])}</li>`);
					continue;
				}
				closeList();
				out.push(`<p>${inline(line)}</p>`);
			}
			closeList();
			return out.join('');
		}

		const TRANS_KEY = 'journal.reader.translations';

		function SelectionPopup({ popup, t, explainReady, onClose, onChat }) {
			const [mode, setMode] = useState(null);
			const [content, setContent] = useState('');
			const [busy, setBusy] = useState(false);
			const [error, setError] = useState(null);
			const abortRef = useRef(null);
			const popupRef = useRef(null);
			const dragDataRef = useRef(null);
			const [pos, setPos] = useState(null);
			const [collapsed, setCollapsed] = useState(false);
			const beginDrag = useCallback((event) => {
				const el = popupRef.current;
				if (!el) return;
				const rect = el.getBoundingClientRect();
				dragDataRef.current = { startLeft: rect.left, startTop: rect.top, startX: event.clientX, startY: event.clientY, width: rect.width };
				setPos({ left: rect.left, top: rect.top, width: rect.width });
				try {
					event.dataTransfer.setData('text/plain', '');
					event.dataTransfer.effectAllowed = 'move';
				} catch {}
			}, []);
			const doDrag = useCallback((event) => {
				const d = dragDataRef.current;
				if (!d) return;
				setPos({
					left: Math.min(Math.max(8, d.startLeft + event.clientX - d.startX), window.innerWidth - 80),
					top: Math.min(Math.max(8, d.startTop + event.clientY - d.startY), window.innerHeight - 44),
					width: d.width
				});
			}, []);
			const endDrag = useCallback(() => { dragDataRef.current = null; }, []);
			useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

			const run = async (kind) => {
				setMode(kind); setBusy(true); setError(null); setContent('');
				const controller = new AbortController();
				abortRef.current = controller;
				try {
					if (kind === 'dict') {
						const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(popup.text)}`, { signal: controller.signal });
						if (!res.ok) { setContent(t('wordNotFound')); }
						else {
							const entries = await res.json();
							const parts = [];
							for (const entry of Array.isArray(entries) ? entries.slice(0, 2) : []) {
								if (entry.phonetic || (entry.phonetics || []).some((p) => p.text)) {
									parts.push({ kind: 'phon', text: entry.phonetic || entry.phonetics.find((p) => p.text)?.text });
								}
								for (const meaning of (entry.meanings || []).slice(0, 3)) {
									parts.push({ kind: 'pos', text: meaning.partOfSpeech });
									for (const def of (meaning.definitions || []).slice(0, 2)) {
										parts.push({ kind: 'def', text: def.definition + (def.example ? ` — e.g. ${def.example}` : '') });
									}
								}
							}
							setContent(parts.length === 0 ? t('wordNotFound') : null);
							setDictParts(parts);
						}
					} else if (kind === 'trans') {
						const acc = await postTranslate(popup.text, controller.signal, (current) => setContent(current));
						setContent(acc);
					}
				} catch (err) {
					if (controller.signal.aborted) return;
					setError(String(err.message || err));
				} finally {
					if (abortRef.current === controller) abortRef.current = null;
					setBusy(false);
				}
			};
			const [dictParts, setDictParts] = useState([]);

			const stop = (event) => { if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; } setMode(null); setBusy(false); };
			useEffect(() => { setMode(null); setContent(''); setError(null); setDictParts([]); setBusy(false); }, [popup.text, popup.rect.top]);

			const width = 460;
			const half = Math.min(230, Math.max(140, width / 2));
			const left = Math.min(Math.max(half + 8, popup.rect.left), window.innerWidth - half - 8);
			const below = popup.rect.top < 260;
			const style = below
				? { left, top: Math.max(8, popup.rect.bottom + 8), transform: 'translateX(-50%)' }
				: { left, top: Math.max(8, popup.rect.top - 8), transform: 'translate(-50%,-100%)' };

			return h('div', { className: 'jr-popup', ref: popupRef, style: pos || style, onClick: (e) => e.stopPropagation() },
				h('div', { className: collapsed ? 'jr-popup-bar is-collapsed' : 'jr-popup-bar' },
					h('button', {
						className: 'jr-popup-grip', draggable: collapsed || undefined,
						title: collapsed ? '拖动' : '收起面板（拖动）',
						onDragStart: beginDrag, onDrag: doDrag, onDragEnd: endDrag,
						onClick: () => { if (!collapsed) { stop(); setCollapsed(true); } }
					},
						h('span', { className: 'jr-popup-grip-dots', 'aria-hidden': true }, '⠿'),
						h('span', { className: 'jr-popup-grip-label' }, (mode === 'dict' && popup.text) || (mode === 'trans' && popup.text) || popup.text || ''),
						h('span', { className: 'jr-popup-grip-chevron', 'aria-hidden': true }, collapsed ? '▾' : '▴')
					),
					!collapsed && h('div', { className: 'jr-popup-actions' },
						popup.isWord ? h('button', {
							className: 'jr-mini', 'data-active': mode === 'dict' || undefined,
							disabled: busy && mode !== 'dict', onClick: () => run('dict')
						}, t('lookup')) : null,
						h('button', { className: 'jr-mini', onClick: () => run('trans') }, t('translate')),
						h('button', {
							className: 'jr-mini',
							disabled: !explainReady,
							title: explainReady ? undefined : t('explainUnavailable'),
							onClick: () => {
								if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
								setBusy(false); setMode(null);
								onClose();
								onChat(popup.text, popup.isWord);
							}
						}, t('explain')),
						h('button', { className: 'jr-mini', onClick: () => { stop(); onClose(); } }, t('close'))
					)
				),
				!collapsed && h('div', { className: 'jr-popup-bodywrap' },
					busy && !content ? h('div', { className: 'jr-hint' },
						h('span', { className: 'jr-spin', style: { width: 12, height: 12, marginRight: 6 } }),
						mode === 'dict' ? t('dictLoading') : mode === 'trans' ? t('transLoading') : t('explainLoading')
					) : null,
					error ? h('div', { className: 'jr-error', style: { marginTop: 8 } }, error) : null,
					!error && mode === 'dict' && dictParts.length ? h('div', null,
						h('div', { className: 'jr-dict-word' },
							popup.text,
							dictParts.filter((p) => p.kind === 'phon').map((p, i) => h('span', { key: i, className: 'jr-dict-phon' }, p.text))
						),
						dictParts.filter((p) => p.kind !== 'phon').map((p, i) => p.kind === 'pos'
							? h('div', { key: i, className: 'jr-dict-pos' }, p.text)
							: h('div', { key: i, className: 'jr-dict-def' }, p.text))
					) : null,
					!error && mode === 'dict' && dictParts.length === 0 && content && !busy ? h('div', { className: 'jr-popup-body' }, content) : null,
					!error && (mode === 'ai' || mode === 'trans') && content ? h('div', { className: 'jr-popup-body', dangerouslySetInnerHTML: { __html: renderMarkdown(content) } }) : null,
					!error && (mode === 'ai' || mode === 'trans') && busy && content ? h('div', { className: 'jr-hint', style: { marginTop: 6 } }, mode === 'trans' ? t('transLoading') : t('explainLoading')) : null
				)
			);
		}

		function ReaderView({ path, t, explainReady, onBack, initialChat, initialChatOpen, initialDual }) {
			const [meta, setMeta] = useState(null);
			const [metaError, setMetaError] = useState(null);
			const [chapterIndex, setChapterIndex] = useState(0);
			const [html, setHtml] = useState(null);
			const [chapterLoading, setChapterLoading] = useState(false);
			const [chapterError, setChapterError] = useState(null);
			const [tocOpen, setTocOpen] = useState(true);
			const [popup, setPopup] = useState(null);
			const contentRef = useRef(null);
			const abortRef = useRef(null);
			const pendingAnchorRef = useRef(null);
			const magKey = path.split('/')[0];
			const [viewMode, setViewMode] = useState(() => {
				const prefs = readJson(SETTINGS_KEY, {});
				if (prefs.pdfMode && prefs.pdfMode[magKey]) return prefs.pdfMode[magKey];
				return magKey.includes('new_yorker') ? 'pdf' : 'text';
			});
			const [dual, setDual] = useState(() => Boolean(initialDual));
			const [transMap, setTransMap] = useState({});
			const transAbortsRef = useRef(new Set());
			const [chat, setChat] = useState(() => (initialChat && Array.isArray(initialChat.msgs) ? initialChat : null));
			const [chatOpen, setChatOpen] = useState(() => Boolean(initialChatOpen));
			const [chatWidth, setChatWidth] = useState(() => {
				const prefs = readJson(SETTINGS_KEY, {});
				const w = Number(prefs.chatWidth);
				return Number.isFinite(w) && w >= 260 && w <= 720 ? w : 380;
			});
			const startChatResize = useCallback((event) => {
				event.preventDefault();
				const startX = event.clientX;
				const startW = chatWidth;
				const move = (ev) => {
					setChatWidth(() => {
						const next = Math.min(720, Math.max(260, startW - (ev.clientX - startX)));
						const prefs = readJson(SETTINGS_KEY, {});
						prefs.chatWidth = next;
						writeJson(SETTINGS_KEY, prefs);
						return next;
					});
				};
				const up = () => {
					window.removeEventListener('pointermove', move);
					window.removeEventListener('pointerup', up);
					document.body.style.userSelect = '';
				};
				window.addEventListener('pointermove', move);
				window.addEventListener('pointerup', up);
				document.body.style.userSelect = 'none';
			}, [chatWidth]);
			const chatAbortRef = useRef(null);
			const chatInputRef = useRef(null);
			const chatMsgsRef = useRef(null);
			const initialMagRef = useRef(magKey);

			const setModePref = useCallback((next) => {
				setViewMode(next);
				const prefs = readJson(SETTINGS_KEY, {});
				prefs.pdfMode = { ...(prefs.pdfMode || {}), [magKey]: next };
				writeJson(SETTINGS_KEY, prefs);
			}, [magKey]);
			useEffect(() => {
				const prefs = readJson(SETTINGS_KEY, {});
				setViewMode(prefs.pdfMode && prefs.pdfMode[magKey] ? prefs.pdfMode[magKey] : magKey.includes('new_yorker') ? 'pdf' : 'text');
				// Restoring a session keeps the saved toggle; switching to another issue resets it
				// and loads that issue's archived conversation — but never auto-opens the panel:
				// once the user closes it, it stays closed until they reopen it themselves.
				setDual(magKey === initialMagRef.current ? Boolean(initialDual) : false);
				if (magKey !== initialMagRef.current) {
					const archive = readJson(CHATS_KEY, {});
					const saved = archive[path];
					setChat(saved && Array.isArray(saved.msgs) && saved.msgs.length ? { msgs: saved.msgs, busy: false } : null);
					setChatOpen(false);
				}
			}, [magKey, path]);

			// Persist the reading session so leaving the panel (workspace, another page) and
			// coming back restores the open issue, the chat transcript, and the toggle.
			useEffect(() => {
				const session = {
					reader: { path },
					chat: chat && Array.isArray(chat.msgs) && chat.msgs.length ? { path, msgs: chat.msgs.map((m) => ({ role: m.role, text: m.text })) } : null,
					chatOpen: Boolean(chatOpen),
					dual
				};
				writeJson(SESSION_KEY, session);
			}, [path, chat, chatOpen, dual]);

			// Archive each issue's finished conversation in localStorage, so closing the
			// panel, switching issues, or restarting the app never loses the answers.
			useEffect(() => {
				if (!chat || !Array.isArray(chat.msgs)) return;
				const finished = chat.msgs.filter((m) => !m.streaming && m.text);
				if (finished.length === 0) return;
				const archive = readJson(CHATS_KEY, {});
				archive[path] = finished.map((m) => ({ role: m.role, text: m.text }));
				writeJson(CHATS_KEY, archive);
			}, [path, chat]);

			const [settings, setSettings] = useState(() => readJson(SETTINGS_KEY, { fontSize: 17 }));
			const changeFont = (delta) => setSettings((current) => {
				const next = { ...current, fontSize: Math.min(22, Math.max(14, (current.fontSize || 17) + delta)) };
				writeJson(SETTINGS_KEY, next);
				return next;
			});

			useEffect(() => {
				const controller = new AbortController();
				setMeta(null); setMetaError(null); setHtml(null); setPopup(null);
				getJson(`/jr/api/issue?path=${encodeURIComponent(path)}`, controller.signal)
					.then((data) => {
						setMeta(data);
						const progress = readJson(PROGRESS_KEY, {});
						const saved = Number(progress[path]);
						setChapterIndex(Number.isInteger(saved) && saved >= 0 && saved < data.chapters.length ? saved : 0);
					})
					.catch((err) => { if (!controller.signal.aborted) setMetaError(String(err.message || err)); });
				return () => controller.abort();
			}, [path]);

			useEffect(() => {
				if (!meta) return;
				const chapter = meta.chapters[chapterIndex];
				if (!chapter) return;
				if (abortRef.current) abortRef.current.abort();
				for (const controller of transAbortsRef.current) controller.abort();
				transAbortsRef.current.clear();
				setTransMap({});
				const controller = new AbortController();
				abortRef.current = controller;
				setChapterLoading(true); setChapterError(null);
				getJson(`/jr/api/chapter?path=${encodeURIComponent(path)}&index=${chapterIndex}`, controller.signal)
					.then((data) => { setHtml(data.html); setChapterLoading(false); })
					.catch((err) => { if (!controller.signal.aborted) { setChapterError(String(err.message || err)); setChapterLoading(false); } });
				const progress = readJson(PROGRESS_KEY, {});
				progress[path] = chapterIndex;
				writeJson(PROGRESS_KEY, progress);
				return () => controller.abort();
			}, [meta, chapterIndex, path]);

			useEffect(() => {
				const onPointerUp = (event) => {
					if (event.target && typeof event.target.closest === 'function' && event.target.closest('.jr-popup')) return;
					const selection = window.getSelection();
					if (!selection || selection.isCollapsed) { setPopup(null); return; }
					const text = selection.toString().trim();
					if (!text || text.length > 1500) { setPopup(null); return; }
					const node = selection.anchorNode;
					const container = contentRef.current;
					if (!node || !container) { setPopup(null); return; }
					const element = node.nodeType === 1 ? node : node.parentElement;
					if (!element || !container.contains(element)) { setPopup(null); return; }
					let rect;
					try { rect = selection.getRangeAt(0).getBoundingClientRect(); } catch { setPopup(null); return; }
					if (!rect || (rect.width === 0 && rect.height === 0)) { setPopup(null); return; }
					const isWord = /^[\p{L}][\p{L}'’-]*$/u.test(text);
					setPopup({ text, rect: { left: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom }, isWord });
				};
				const onKey = (event) => { if (event.key === 'Escape') setPopup(null); };
				document.addEventListener('pointerup', onPointerUp);
				document.addEventListener('keydown', onKey);
				return () => {
					document.removeEventListener('pointerup', onPointerUp);
					document.removeEventListener('keydown', onKey);
				};
			}, []);

			const blocks = useMemo(() => {
				if (!html) return [];
				try {
					const doc = new DOMParser().parseFromString(html, 'text/html');
					const out = [];
					for (const node of Array.from(doc.body.childNodes)) {
						if (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'BLOCKQUOTE')) {
							const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
							const hasImg = typeof node.querySelector === 'function' && Boolean(node.querySelector('img'));
							if (text.length < 2 && !hasImg) continue;
							out.push({ type: 'para', html: node.outerHTML, text });
						} else if (node.nodeType === 1) {
							out.push({ type: 'raw', html: node.outerHTML });
						} else if (node.nodeType === 3 && node.textContent.trim()) {
							out.push({ type: 'raw', html: node.textContent });
						}
					}
					return out;
				} catch {
					return [{ type: 'raw', html }];
				}
			}, [html]);

			const translateBlock = useCallback((index, text) => {
				const cache = readJson(TRANS_KEY, {});
				const key = hashStr(text);
				const cached = cache[key];
				if (cached) {
					setTransMap((current) => ({ ...current, [index]: { state: 'done', text: cached } }));
					return;
				}
				if (transAbortsRef.current.size === 0) transAbortsRef.current = new Set();
				const controller = new AbortController();
				transAbortsRef.current.add(controller);
				setTransMap((current) => ({ ...current, [index]: { state: 'loading', text: '' } }));
				postTranslate(text, controller.signal, (current) => {
					setTransMap((map) => (map[index] && map[index].state === 'loading' ? { ...map, [index]: { state: 'loading', text: current } } : map));
				})
					.then((final) => {
						setTransMap((map) => ({ ...map, [index]: { state: 'done', text: final } }));
						const store = readJson(TRANS_KEY, {});
						store[key] = final;
						writeJson(TRANS_KEY, store);
					})
					.catch((err) => {
						if (controller.signal.aborted) return;
						setTransMap((map) => ({ ...map, [index]: { state: 'error', text: String(err.message || err) } }));
					})
					.finally(() => transAbortsRef.current.delete(controller));
			}, []);

			const toggleTranslate = useCallback((index, text) => {
				setTransMap((current) => {
					const entry = current[index];
					if (entry && (entry.state === 'done' || entry.state === 'loading')) {
						if (entry.state === 'done') return { ...current, [index]: { state: 'hidden' } };
						return current;
					}
					return current;
				});
				const cache = readJson(TRANS_KEY, {});
				if (cache[hashStr(text)]) {
					translateBlock(index, text);
					return;
				}
				translateBlock(index, text);
			}, [translateBlock]);

			useEffect(() => {
				if (!dual || !html || chapterLoading) return;
				const container = contentRef.current;
				if (!container) return;
				const root = container.closest('.jr-article-wrap') || null;
				const observer = new IntersectionObserver((entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						observer.unobserve(entry.target);
						const idx = Number(entry.target.getAttribute('data-idx'));
						const block = blocks[idx];
						if (!block || block.type !== 'para' || !block.text || block.text.length < 2) continue;
						setTransMap((current) => {
							if (current[idx] && (current[idx].state === 'done' || current[idx].state === 'loading')) return current;
							translateBlock(idx, block.text);
							return current;
						});
					}
				}, { root, rootMargin: '160px' });
				container.querySelectorAll('.jr-para').forEach((el) => observer.observe(el));
				return () => observer.disconnect();
			}, [dual, html, chapterLoading, blocks, translateBlock]);

			const chatContext = useMemo(() => {
				const text = blocks.filter((b) => b.type === 'para' && b.text).map((b) => b.text).join('\n\n');
				return text.slice(0, 8000);
			}, [blocks]);

			const sendChat = useCallback((rawText) => {
				const clean = (rawText || '').trim();
				if (!clean) return;
				setChat((current) => {
					const base = current || { msgs: [], busy: false };
					if (base.busy) return base;
					const history = [...base.msgs.filter((m) => !m.streaming), { role: 'user', text: clean }];
					const controller = new AbortController();
					chatAbortRef.current = controller;
					(async () => {
						try {
							const res = await fetch('/jr/api/ask', {
								method: 'POST',
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify({
									// Keep only the recent turns: old exchanges fade out so long
									// sessions never hit the server's message cap.
									messages: history.slice(-10).map((m) => ({ role: m.role, content: m.text })),
									context: chatContext
								}),
								signal: controller.signal
							});
							if (!res.ok) {
								const data = await res.json().catch(() => ({}));
								throw new Error(data.error || `HTTP ${res.status}`);
							}
							const final = await streamBody(res, (acc) => {
								setChat((c) => c && ({ ...c, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 && m.role === 'assistant' ? { ...m, text: acc } : m)) }));
							});
							setChat((c) => c && ({ ...c, busy: false, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 && m.role === 'assistant' ? { role: 'assistant', text: final } : m)) }));
						} catch (err) {
							if (controller.signal.aborted) return;
							setChat((c) => c && ({ ...c, busy: false, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 && m.role === 'assistant' ? { role: 'assistant', text: `⚠ ${String(err.message || err)}` } : m)) }));
						} finally {
							chatAbortRef.current = null;
						}
					})();
					return { msgs: [...history, { role: 'assistant', text: '', streaming: true }], busy: true };
				});
			}, [chatContext]);

			const openChatWithText = useCallback((text, isWord) => {
				setChatOpen(true);
				sendChat(chatPrompt(text, isWord));
			}, [sendChat]);

			useEffect(() => {
				const el = chatMsgsRef.current;
				if (el) el.scrollTop = el.scrollHeight;
			}, [chat, chat && chat.msgs && chat.msgs.length]);

			const onArticleClick = (event) => {
				const target = event.target;
				if (!target || typeof target.closest !== 'function') return;
				const anchor = target.closest('a');
				if (!anchor || !contentRef.current || !contentRef.current.contains(anchor)) return;
				const raw = anchor.getAttribute('href') || '';
				event.preventDefault();
				if (!raw) return;
				if (/^(https?:|mailto:)/i.test(raw)) {
					// Section pages link out to the site even when the story ships inside the
					// epub: map the link text onto a chapter title first, fall back to opening the URL.
					if (meta) {
						const label = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
						const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
						const ln = norm(label);
						if (ln && ln.length >= 8) {
							const match = meta.chapters.findIndex((c) => {
								const ct = norm(c.title);
								if (ct.length < 8) return false;
								return ct.startsWith(ln) || ln.startsWith(ct) || ct.startsWith(ln.slice(0, 40)) || ln.startsWith(ct.slice(0, 40));
							});
							if (match >= 0) {
								pendingAnchorRef.current = '';
								setPopup(null);
								if (match !== chapterIndex) setChapterIndex(match);
								return;
							}
						}
					}
					window.open(raw, '_blank', 'noopener,noreferrer');
					return;
				}
				const container = contentRef.current;
				if (raw.startsWith('#')) {
					const id = raw.slice(1);
					const el = container.querySelector(`[id="${escapeAttr(id)}"], [name="${escapeAttr(id)}"]`);
					if (el) el.scrollIntoView({ block: 'start' });
					return;
				}
				if (!meta) return;
				const hashIndex = raw.indexOf('#');
				const pathPart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
				const fragment = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
				const currentHref = meta.chapters[chapterIndex] ? meta.chapters[chapterIndex].href : '';
				let dir = currentHref.includes('/') ? currentHref.slice(0, currentHref.lastIndexOf('/') + 1) : '';
				let clean = pathPart.replace(/^\.?\//, '');
				while (clean.startsWith('../')) {
					clean = clean.slice(3);
					dir = dir.replace(/[^/]+\/$/, '');
				}
				const resolved = (clean.startsWith('/') ? clean.slice(1) : dir + clean).toLowerCase();
				if (!resolved) return;
				let idx = meta.chapters.findIndex((c) => c.href.toLowerCase() === resolved);
				if (idx < 0) idx = meta.chapters.findIndex((c) => c.href.toLowerCase().endsWith(resolved));
				if (idx < 0) return;
				pendingAnchorRef.current = fragment;
				if (idx !== chapterIndex) {
					setPopup(null);
					setChapterIndex(idx);
				} else if (fragment) {
					const el = container.querySelector(`[id="${escapeAttr(fragment)}"], [name="${escapeAttr(fragment)}"]`);
					if (el) el.scrollIntoView({ block: 'start' });
				}
			};

			useEffect(() => {
				if (!html || chapterLoading) return;
				const container = contentRef.current;
				if (!container) return;
				const anchor = pendingAnchorRef.current;
				pendingAnchorRef.current = null;
				const el = anchor ? container.querySelector(`[id="${escapeAttr(anchor)}"], [name="${escapeAttr(anchor)}"]`) : null;
				if (el) el.scrollIntoView({ block: 'start' });
				else if (container.parentElement) container.parentElement.scrollTop = 0;
			}, [html, chapterLoading]);

			if (metaError) return h('div', { className: 'jr-shell' },
				h('div', { className: 'jr-error' }, metaError),
				h('div', { style: { marginTop: 12 } }, h('button', { className: 'jr-btn', onClick: onBack }, t('back')))
			);

			const chapters = meta ? meta.chapters : [];
			const issueTitle = meta ? `${meta.date}` : t('opening');

			return h('div', { className: 'jr-reader' },
				h('div', { className: 'jr-topbar' },
					h('button', { className: 'jr-btn', onClick: onBack }, '← ', t('back')),
					h('div', { className: 'jr-topbar-title' }, issueTitle),
					h('button', { className: 'jr-btn', onClick: () => setTocOpen(!tocOpen) }, t('toc')),
					h('button', { className: 'jr-btn', onClick: () => changeFont(-1) }, t('fontSmaller')),
					h('button', { className: 'jr-btn', onClick: () => changeFont(1) }, t('fontLarger')),
					h('button', { className: 'jr-btn', 'data-active': chatOpen || undefined, onClick: () => setChatOpen((open) => !open) }, t('chat')),
					viewMode === 'text' ? h('button', { className: 'jr-btn', 'data-active': dual || undefined, onClick: () => setDual(!dual) }, t('dual')) : null,
					meta && meta.files && meta.files.pdf ? h('button', {
						className: 'jr-btn', 'data-active': viewMode === 'pdf' || undefined,
						onClick: () => setModePref(viewMode === 'pdf' ? 'text' : 'pdf')
					}, viewMode === 'pdf' ? t('textMode') : t('pdf')) : null,
					meta && meta.files && meta.files.epub ? h('a', {
						className: 'jr-link',
						href: `https://raw.githubusercontent.com/hehonghui/awesome-english-ebooks/master/${meta.path.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(meta.files.epub)}`,
						target: '_blank', rel: 'noreferrer'
					}, t('download')) : null
				),
				viewMode === 'pdf' && meta && meta.files && meta.files.pdf ? h('div', { className: 'jr-body' },
				tocOpen && chapters.length ? h('nav', { className: 'jr-toc' },
						chapters.map((chapter) => {
							const title = chapter.title || chapterTitleFallback(null, chapter.index, t);
							return h('button', {
								key: chapter.index,
								className: 'jr-toc-item',
								'data-active': chapterIndex === chapter.index || undefined,
								'data-kind': chapter.kind === 'section' ? 'section' : 'article',
								title,
								onClick: () => { if (viewMode === 'pdf') setModePref('text'); setChapterIndex(chapter.index); }
							}, title);
						})
					) : null,
					h('iframe', { className: 'jr-pdf', src: `/jr/api/pdf?path=${encodeURIComponent(path)}`, title: issueTitle }),
					chatOpen ? h(ChatPanel, {
						chat: chat || { msgs: [], busy: false }, t, chatMsgsRef, chatInputRef, path,
						onClose: () => setChatOpen(false),
						onClear: () => {
							if (chatAbortRef.current) chatAbortRef.current.abort();
							setChat(null);
							const archive = readJson(CHATS_KEY, {});
							delete archive[path];
							writeJson(CHATS_KEY, archive);
						},
						onSend: sendChat
					}) : null
				) : h('div', { className: 'jr-body' },
					tocOpen && chapters.length ? h('nav', { className: 'jr-toc' },
						chapters.map((chapter) => {
							const title = chapter.title || chapterTitleFallback(null, chapter.index, t);
							return h('button', {
								key: chapter.index,
								className: 'jr-toc-item',
								'data-active': chapterIndex === chapter.index || undefined,
								'data-kind': chapter.kind === 'section' ? 'section' : 'article',
								title,
								onClick: () => setChapterIndex(chapter.index)
							}, title);
						})
					) : null,
					h('div', { className: 'jr-article-wrap', onClick: onArticleClick },
						h('article', {
							className: 'jr-article',
							ref: contentRef,
							style: { '--jr-font-size': `${settings.fontSize}px` }
						},
							chapterLoading ? h('div', { className: 'jr-center' }, h('span', { className: 'jr-spin' }), t('loading')) : null,
							chapterError ? h('div', { className: 'jr-error' }, chapterError) : null,
							!chapterLoading && !chapterError && blocks.length ? blocks.map((block, index) => block.type === 'para'
								? h('div', { key: index, className: 'jr-para', 'data-idx': index },
									h('div', { dangerouslySetInnerHTML: { __html: block.html } }),
									transMap[index] && transMap[index].state !== 'hidden' ? h('div', { className: 'jr-para-trans' },
										transMap[index].state === 'loading' && !transMap[index].text
											? h('span', null, h('span', { className: 'jr-spin', style: { width: 12, height: 12, marginRight: 6 } }), t('transLoading'))
											: transMap[index].state === 'error' ? transMap[index].text : transMap[index].text
									) : null,
									block.text && block.text.length >= 2 ? h('button', {
										className: 'jr-para-btn',
										title: t('translate'),
										onClick: (event) => { event.stopPropagation(); toggleTranslate(index, block.text); }
									}, transMap[index] && transMap[index].state === 'done' ? '—' : '译') : null
								)
								: h('div', { key: index, dangerouslySetInnerHTML: { __html: block.html } })) : null,
							!chapterLoading && !chapterError && !blocks.length && html !== null ? h('div', { className: 'jr-empty' }, t('noChapters')) : null
						)
					),
					chatOpen ? h(ChatPanel, {
						chat: chat || { msgs: [], busy: false }, t, chatMsgsRef, chatInputRef, path, width: chatWidth, onResizeStart: startChatResize,
						onClose: () => setChatOpen(false),
						onClear: () => {
							if (chatAbortRef.current) chatAbortRef.current.abort();
							setChat(null);
							const archive = readJson(CHATS_KEY, {});
							delete archive[path];
							writeJson(CHATS_KEY, archive);
						},
						onSend: sendChat
					}) : null
				),
				popup ? h(SelectionPopup, {
					key: `${popup.text}@${Math.round(popup.rect.top)}`,
					popup, t, explainReady,
					onClose: () => setPopup(null),
					onChat: (text, isWord) => { setPopup(null); openChatWithText(text, isWord); }
				}) : null
			);
		}

		function ChatPanel({ chat, t, chatMsgsRef, chatInputRef, path, width, onClose, onClear, onSend, onResizeStart }) {
			const msgs = Array.isArray(chat && chat.msgs) ? chat.msgs : [];
			return h('aside', { className: 'jr-chat', style: { width } },
				h('div', { className: 'jr-chat-resize', onPointerDown: onResizeStart, title: '拖动调宽' }),
				h('div', { className: 'jr-chat-head' },
					h('span', null, t('chat')),
					h('div', { style: { display: 'flex', gap: 6 } },
						msgs.length ? h('button', { className: 'jr-mini', title: t('chatClear'), onClick: onClear }, t('chatClear')) : null,
						h('button', { className: 'jr-mini', title: t('chatHide'), onClick: onClose }, '×'))),
				h('div', { className: 'jr-chat-msgs', ref: chatMsgsRef },
					msgs.length === 0 ? h('div', { className: 'jr-hint' }, t('chatHint')) : null,
					msgs.map((m, i) => m.role === 'user'
						? h('div', { key: i, className: 'jr-chat-msg jr-chat-user' }, m.text)
						: h('div', { key: i, className: 'jr-chat-msg jr-chat-bot', dangerouslySetInnerHTML: { __html: renderMarkdown(m.text) } }))),
				h('form', { className: 'jr-chat-input', onSubmit: (e) => { e.preventDefault(); const el = chatInputRef.current; if (!el) return; const v = el.value; el.value = ''; onSend(v); } },
					h('textarea', {
						ref: chatInputRef, rows: 2, placeholder: t('chatPlaceholder'),
						onKeyDown: (e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								const v = e.target.value;
								e.target.value = '';
								onSend(v);
							}
						}
					}),
					h('button', { className: 'jr-mini', type: 'submit', disabled: chat.busy }, t('send'))));
		}

		const SAVED_KEY = 'journal.reader.saved';
		const SESSION_KEY = 'journal.reader.session';
		const CHATS_KEY = 'journal.reader.chats';

		function JournalPage({ t }) {
			const [shelf, setShelf] = useState({ loading: true, error: null, data: null });
			const [savedSet, setSavedSet] = useState(() => new Set(readJson(SAVED_KEY, [])));
			const [reader, setReader] = useState(() => {
				const session = readJson(SESSION_KEY, {});
				return session && session.reader ? session.reader : null;
			});
			const [initialChat] = useState(() => {
				const session = readJson(SESSION_KEY, {});
				if (!session || !session.reader || !session.chat) return null;
				const saved = session.chat;
				if (saved.path !== session.reader.path || !Array.isArray(saved.msgs)) return null;
				return { msgs: saved.msgs, busy: false };
			});
			// The chat panel ALWAYS starts closed. History is one click away (topbar button);
			// a restored session must never pop the panel open by itself.
			const [initialChatOpen] = useState(() => false);
			const [initialDual] = useState(() => {
				const session = readJson(SESSION_KEY, {});
				return Boolean(session && session.dual);
			});

			const loadShelf = useCallback(async (refresh) => {
				setShelf({ loading: true, error: null, data: null });
				try {
					const data = await getJson(`/jr/api/issues${refresh ? '?refresh=1' : ''}`);
					setShelf({ loading: false, error: null, data });
				} catch (err) {
					setShelf({ loading: false, error: String(err.message || err), data: null });
				}
			}, []);
			useEffect(() => { loadShelf(false); }, [loadShelf]);

			const openIssue = useCallback((issuePath) => {
				setReader({ path: issuePath });
				writeJson(SESSION_KEY, { reader: { path: issuePath } });
				fetch(`/jr/api/read?path=${encodeURIComponent(issuePath)}`)
					.then((res) => (res.ok ? res.json() : null))
					.then((data) => {
						if (!data || !data.saved) return;
						setSavedSet((current) => {
							if (current.has(issuePath)) return current;
							const next = new Set(current);
							next.add(issuePath);
							writeJson(SAVED_KEY, [...next]);
							return next;
						});
					})
					.catch(() => {});
			}, []);

			if (reader) return h(ReaderView, {
				path: reader.path,
				t,
				explainReady: Boolean(shelf.data && shelf.data.explainReady),
				initialChat,
				initialChatOpen,
				initialDual,
				onBack: () => {
					setReader(null);
					writeJson(SESSION_KEY, {});
				}
			});
			return h('div', { className: 'jr-page' },
				h(ShelfView, {
					data: shelf.data,
					loading: shelf.loading,
					error: shelf.error,
					t,
					onRefresh: () => loadShelf(true),
					onRetry: () => loadShelf(false),
					onOpen: openIssue,
					savedSet
				})
			);
		}

		class JournalBoundary extends React.Component {
			constructor(props) { super(props); this.state = { error: null }; }
			static getDerivedStateFromError(error) { return { error }; }
			render() {
				if (this.state.error) {
					const message = String((this.state.error && this.state.error.message) || this.state.error);
					return h('div', { className: 'jr-shell' },
						h('div', { className: 'jr-error' }, message),
						h('div', { style: { marginTop: 12 } },
							h('button', { className: 'jr-btn', onClick: () => this.setState({ error: null }) }, '重试'))
					);
				}
				return this.props.children;
			}
		}

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'journal: dictionaries');
				ctx.effect(() => insertStyles(CSS), 'journal: styles');
				const t = ctx.locale.bind(NS);
				ctx.slots.inject('main', () => ctx.slots.register({
					name: 'main',
					key: PANEL_ID,
					locale: NS,
					inject: () => ({ t })
				}, (props) => h(JournalBoundary, null, h(JournalPage, props))));
				ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
					name: 'sidebar.panellist',
					id: PANEL_ID,
					order: 6,
					locale: NS,
					label: () => t('panel')
				}, JournalIcon));
			}
		};
	}
});
