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
			biweekly: '双周刊',
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
			noIssues: '暂无可读期号',
			loadMore: '再加载 {n} 期',
			saved: '已存',
			saveFailed: '本地保存失败',
			chat: 'AI 问答',
			chatPlaceholder: '就这篇文章提问…（Enter 发送，Shift+Enter 换行）',
			chatHint: '提问会自动附带当前章节内容。例如：总结这篇文章、第三段是什么意思？',
			chatThinking: '正在思考…',
			send: '发送',
			chatHide: '收起面板（对话自动保存，随时可回来看）',
			chatClear: '清空本期的对话记录',
			translate: '翻译',
			transLoading: '翻译中…',
			dual: '对照',
			pdf: 'PDF',
			textMode: '文字版',
			readAloud: '朗读',
			speechPlay: '播放',
			speechPause: '暂停',
			speechStop: '停止',
			speechPrev: '上一句',
			speechNext: '下一句',
			speechAuto: '自动音色',
			speechRate: '语速',
			speechVoice: '音色',
			speechLoading: '合成中…',
			speechCloudGroup: '云端神经语音'
		};
		const en = {
			panel: 'Journal Reader',
			title: 'Journal Reader',
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
			biweekly: 'biweekly',
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
			noIssues: 'No readable issues yet',
			loadMore: 'Load {n} more issues',
			saved: 'Saved',
			saveFailed: 'Local save failed',
			chat: 'AI chat',
			chatPlaceholder: 'Ask about this article… (Enter to send, Shift+Enter for newline)',
			chatHint: 'Questions automatically include the current chapter. Try: summarize this, what does paragraph 3 mean?',
			chatThinking: 'Thinking…',
			send: 'Send',
			chatHide: 'Hide panel (the conversation is saved automatically)',
			chatClear: 'Clear this issue\'s conversation',
			translate: 'Translate',
			transLoading: 'Translating…',
			dual: 'Bilingual',
			pdf: 'PDF',
			textMode: 'Text',
			readAloud: 'Read aloud',
			speechPlay: 'Play',
			speechPause: 'Pause',
			speechStop: 'Stop',
			speechPrev: 'Previous sentence',
			speechNext: 'Next sentence',
			speechAuto: 'Auto voice',
			speechRate: 'Speed',
			speechVoice: 'Voice',
			speechLoading: 'Synthesizing…',
			speechCloudGroup: 'Cloud neural voices'
		};

		const CSS = [
			'.jr-page{height:100%;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}',
			'.jr-shell{max-width:960px;margin:0 auto;padding:28px 24px 48px}',
			'.jr-title{font-size:22px;font-weight:650;letter-spacing:.2px}',
			'.jr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}',
			'.jr-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}',
			'.jr-btn:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-btn:disabled{opacity:.5;cursor:default}',
			'.jr-grid{display:flex;flex-direction:column;gap:8px}',
			// 一行一刊：刊物信息在左，最新期在中间，展开按钮在右。
			// 展开后的期号列表是文档流里的内容，不做内部滚动——避免嵌套滚动条。
			'.jr-mag{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden}',
			'.jr-mag[data-open="true"]{border-color:var(--dsw-alias-border-l2)}',
			'.jr-mag-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
			'.jr-mag-row:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-chip{width:34px;height:34px;border-radius:8px;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;flex:none}',
			'.jr-mag-info{min-width:0;flex:1}',
			'.jr-mag-name{font-size:15px;font-weight:600}',
			'.jr-mag-meta{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:1px}',
			// 最新一期：直接可点开，不用先展开。
			'.jr-mag-latest{display:flex;align-items:center;gap:8px;flex:none;margin-left:auto}',
			'.jr-latest-date{font-size:13px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}',
			'.jr-latest-tag{font-size:11px;color:var(--dsw-alias-brand-primary);border:1px solid currentColor;border-radius:99px;padding:0 7px;line-height:16px}',
			'.jr-toggle{flex:none;width:22px;height:22px;border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;border-radius:6px}',
			'.jr-toggle:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
			'.jr-toggle[data-open="true"]{transform:rotate(90deg)}',
			// 展开区：跟在行下面，用文档流排布，没有内部滚动条。
			'.jr-issues{border-top:1px solid var(--dsw-alias-border-l1);padding:6px 14px 10px}',
			'.jr-issue{display:flex;align-items:center;justify-content:space-between;width:100%;padding:6px 8px;border:0;background:none;color:inherit;font:inherit;font-size:13px;border-radius:8px;cursor:pointer;text-align:left}',
			'.jr-issue:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-issue-date{font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;gap:8px}',
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
			'.jr-month{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:600;padding:9px 8px 4px;cursor:pointer;letter-spacing:.2px}',
			'.jr-month:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.jr-month-chevron{color:var(--dsw-alias-label-secondary);font-size:11px;width:10px;flex:none}',
			'.jr-month-count{margin-left:auto;color:var(--dsw-alias-label-secondary);font-weight:400;font-size:12px;opacity:.7}',
			'.jr-submonth{padding:4px 8px 2px;color:var(--dsw-alias-label-secondary);font-size:11px;letter-spacing:.2px}',
			'.jr-more{display:block;width:100%;margin-top:8px;padding:7px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}',
			'.jr-more:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
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
			'.jr-chat-thinking{display:flex;align-items:center;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:13px}',
			'.jr-chat-reasoning{width:100%;margin-top:6px;padding:6px 8px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6;white-space:pre-wrap;opacity:.75}',
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
			'.jr-hint{color:var(--dsw-alias-label-secondary);font-size:12px;padding:8px 2px 2px}',
			// —— 朗读（Web Speech API）——
			'.jr-speak-bar{display:flex;align-items:center;gap:6px;flex:none;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex-wrap:wrap}',
			'.jr-speak-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:3px 10px;font-size:12px;cursor:pointer;line-height:1.5}',
			'.jr-speak-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
			'.jr-speak-btn:disabled{opacity:.45;cursor:default}',
			'.jr-speak-btn[data-active="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}',
			'.jr-speak-icon{appearance:none;border:0;background:none;color:var(--dsw-alias-label-primary);cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;display:inline-flex;align-items:center}',
			'.jr-speak-icon:hover:not(:disabled){color:var(--dsw-alias-brand-primary)}',
			'.jr-speak-icon:disabled{opacity:.35;cursor:default}',
			'.jr-speak-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:3px 6px;font-size:12px;cursor:pointer;max-width:160px}',
			'.jr-speak-rate{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}',
			'.jr-speak-rate input[type="range"]{width:88px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
			'.jr-speak-status{font-size:12px;color:var(--dsw-alias-label-secondary);margin-left:auto;white-space:nowrap}',
			'.jr-speak-progress{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);font-size:12px}',
			// 朗读高亮：句子级标记，跟随朗读进度
			'.jr-sentence{border-radius:3px;transition:background-color .12s}',
			'.jr-sentence[data-state="active"]{background-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent);box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)}',
			'.jr-sentence[data-state="done"]{background-color:var(--dsw-alias-bg-layer-2)}',
			'.jr-para-btn[data-role="speak"]{right:auto;left:0;top:-12px}',
			'.jr-speak-word{text-decoration:underline dotted var(--dsw-alias-brand-primary);text-underline-offset:3px;cursor:pointer}'
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

		// —— 朗读（Web Speech API）：句子切分 + 引擎 ——
		// 缩写表：命中这些词时，句末的句点不切句（"Dr. Smith went home."）。
		const ABBR_ANY = new Set([
			'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc', 'eg', 'ie',
			'al', 'approx', 'inc', 'ltd', 'co', 'corp', 'dept', 'univ', 'assn', 'bros', 'phd',
			'md', 'ba', 'ma', 'bsc', 'msc', 'esp', 'viz', 'ibid', 'cf', 'ca'
		]);
		// 这些词只有在首字母大写时才算缩写（句末的 "no." 是句子，"No. 5" 是编号）。
		const ABBR_UPPER = new Set([
			'no', 'fig', 'vol', 'art', 'gen', 'gov', 'mar', 'dec', 'jan', 'feb', 'apr', 'jun',
			'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'mont', 'ave', 'blvd', 'rd', 'lt', 'col',
			'capt', 'maj', 'rev', 'hon', 'supt', 'msgr', 'est', 'min', 'max', 'avg', 'ph', 'fr'
		]);

		function endsWithAbbreviation(head) {
			const m = /([A-Za-z][A-Za-z.]*)\.$/.exec(String(head).trim());
			if (!m) return false;
			const raw = m[1];
			const word = raw.toLowerCase();
			if (raw.indexOf('.') >= 0) return true;   // U.S. / Ph.D. / e.g.
			if (raw.length === 1) return true;         // J. Smith
			if (ABBR_ANY.has(word)) return true;
			if (ABBR_UPPER.has(word) && raw[0] === raw[0].toUpperCase()) return true;
			return false;
		}

		/** 把超长句在逗号处再切一刀：单条 utterance 过长时浏览器会截断音频。 */
		/**
		 * 把过长的句子在逗号处再切一刀：单条 utterance 过长时浏览器会截断音频。
		 *
		 * 切点绝不能落在 UTF-16 代理对中间——emoji 会被劈成两半，
		 * 拼回去时中间多一个空格，就变成了 Python 无法编码的孤立代理项。
		 */
		function splitLong(piece) {
			if (piece.length <= 260) return [piece];
			const parts = [];
			let rest = piece;
			const safeCut = (index) => {
				// index 落在高代理之后时，后退一格让整个代理对留在前一段。
				const code = piece.charCodeAt(index - 1);
				if (index > 0 && code >= 0xd800 && code <= 0xdbff) return index - 1;
				return index;
			};
			while (rest.length > 260) {
				const window = rest.slice(0, 300);
				let cut = window.lastIndexOf(', ');
				if (cut < 120) cut = window.lastIndexOf('; ');
				if (cut < 120) {
					const at = safeCut(260);
					parts.push(rest.slice(0, at));
					rest = rest.slice(at);
					continue;
				}
				const at = safeCut(cut + 1);
				parts.push(rest.slice(0, at));
				rest = rest.slice(at);
			}
			if (rest.trim()) parts.push(rest);
			// 不在这里 trim：句子之间的空格正是靠它保留的。
			return parts.filter((p) => p.trim());
		}

		/**
		 * 按句末标点切句，避开缩写、小数与引号后的空格。
		 *
		 * **片段保留原始空白**：切句不能丢掉任何空格。
		 *  - 同一文本节点内切分：空白留在前一片的尾部（"Congress. In" 而不是 "Congress.In"）
		 *  - 跨标签边界：每个文本节点独立切分时，节点首尾的空白必须留在原处，
		 *    否则 "<a>James Talarico</a> became" 会粘成 "Talaricobecame"。
		 *
		 * 返回的片段是「原文片段」，朗读时再各自 trim。
		 */
		function splitSentences(text) {
			const source = String(text == null ? '' : text);
			if (!source.trim()) return [];
			// 记录首尾空白，切分完再放回去。
			const leading = source.match(/^\s*/)[0];
			const trailing = source.match(/\s*$/)[0];
			const core = source.slice(leading.length, source.length - trailing.length);
			if (!core) return [];

			const out = [];
			let start = 0;
			const re = /[.!?…]+["'”’»)\]]*/g;
			let match;
			while ((match = re.exec(core)) !== null) {
				const end = match.index + match[0].length;
				const before = core[match.index - 1];
				// 句点前必须是字母：排除小数、金额与纯数字。
				if (before === undefined || !/[A-Za-z]/.test(before)) continue;
				const after = core[end];
				if (after !== undefined && !/\s/.test(after)) continue;
				const head = core.slice(start, match.index);
				const punct = /[.!?…]$/.test(head) ? head : head + '.';
				if (endsWithAbbreviation(punct)) continue;
				// 切点到下一句之间的空白跟着前一片走，渲染时才不会丢。
				let next = end;
				while (next < core.length && /\s/.test(core[next])) next++;
				const piece = core.slice(start, next);
				if (piece.trim()) out.push(piece);
				start = next;
			}
			if (start < core.length) {
				const tail = core.slice(start);
				if (tail.trim()) out.push(tail);
			}
			if (out.length === 0) return [leading + core + trailing];
			// 首片带上前导空白，末片带上尾部空白。
			out[0] = leading + out[0];
			out[out.length - 1] = out[out.length - 1] + trailing;
			return out.flatMap(splitLong);
		}

		/**
		 * 把已渲染的正文按句拆成 <span class="jr-sentence">，
		 * 返回 [{ text, el, root }]，供朗读队列与高亮共用。
		 * 按 DOM 文档顺序收集，朗读顺序才与视觉顺序一致。
		 * 幂等：已经标注过的容器直接复用现有标记（React 不会重写内容未变的
		 * dangerouslySetInnerHTML，所以标记会一直留在 DOM 里）。
		 */
		function annotateSentences(container) {
			const result = { sentences: [] };
			if (!container || typeof document === 'undefined') return result;
			const existing = Array.from(container.querySelectorAll('.jr-sentence'));
			if (existing.length) {
				for (const el of existing) {
					result.sentences.push({ text: el.textContent || '', el, root: el.parentElement });
				}
				return result;
			}
			const roots = [];
			for (const child of Array.from(container.children)) {
				if (child.classList.contains('jr-para')) {
					// 段落块：真正承载 HTML 的内层 div。
					const inner = child.querySelector(':scope > div');
					if (inner) roots.push(inner);
					continue;
				}
				if (child.classList.contains('jr-center') || child.classList.contains('jr-error')) continue;
				if (child.classList.contains('jr-empty')) continue;
				if (child.tagName !== 'DIV') continue;
				roots.push(child);
			}
			for (const root of roots) {
				const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
					acceptNode(node) {
						const value = node.nodeValue || '';
						if (!value.trim()) return NodeFilter.FILTER_REJECT;
						const parent = node.parentElement;
						if (!parent) return NodeFilter.FILTER_REJECT;
						if (parent.closest('.jr-sentence')) return NodeFilter.FILTER_REJECT;
						if (parent.closest('script, style, noscript, button, textarea, input, select')) return NodeFilter.FILTER_REJECT;
						return NodeFilter.FILTER_ACCEPT;
					}
				});
				const nodes = [];
				for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
				for (const node of nodes) {
					const parts = splitSentences(node.nodeValue);
					if (parts.length === 0) continue;
					const frag = document.createDocumentFragment();
					for (const part of parts) {
						const span = document.createElement('span');
						span.className = 'jr-sentence';
						span.textContent = part;
						frag.appendChild(span);
						// 朗读与对齐用 trim 过的文本；渲染用的元素保留原始空白。
						result.sentences.push({ text: part.trim(), el: span, root });
					}
					if (node.parentNode) node.parentNode.replaceChild(frag, node);
				}
			}
			return result;
		}

		/** PDF 模式下没有可高亮的正文，直接从段落文本切句。 */
		function sentencesFromBlocks(blocks) {
			const out = [];
			for (const block of blocks || []) {
				if (block.type !== 'para' || !block.text) continue;
				for (const sentence of splitSentences(block.text)) {
					// 朗读用 trim 过的文本，和 DOM 路径保持一致。
					out.push({ text: sentence.trim(), el: null, root: null });
				}
			}
			return out;
		}

		const SpeakerIcon = () => h('svg', {
			viewBox: '0 0 20 20', width: 15, height: 15, 'aria-hidden': true,
			style: { display: 'block' }
		},
			h('path', {
				d: 'M4 7.5h2.6L10 4.6v10.8L6.6 12.5H4z',
				fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1.1, strokeLinejoin: 'round'
			}),
			h('path', {
				d: 'M12.6 7.2a3.6 3.6 0 0 1 0 5.6M14.6 5.4a6.4 6.4 0 0 1 0 9.2',
				fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round'
			})
		);

		/**
		 * 朗读引擎（Edge TTS 云端神经语音）。
		 *
		 * 一次请求拿到一段音频和逐句时间戳，所以高亮按真实时间轴推进，
		 * 而不是「念完一句再跳下一句」。
		 *
		 * 数据流：
		 *   /jr/api/speech → ndjson 帧 → 音频块解码成 Blob → Audio 播放
		 *   帧里的 boundary 事件给出每句的 offset/duration，用它算当前该高亮哪句。
		 *
		 * 分段：整章一次性合成要 40 秒以上，首句迟迟听不到。改为按段合成、
		 * 边播边合成下一段——合成速度约为朗读速度的 7 倍，来得及供给。
		 */
		const SEGMENT_CHARS = 700;

		const CloudSpeechEngine = class {
			constructor() {
				this.status = 'idle';
				this.index = -1;
				this.total = 0;
				this.rate = 1;
				this.voiceURI = '';
				this.voices = [];
				this.error = null;
				this.listeners = new Set();
				this.audio = null;
				this.objectUrl = null;
				this.timings = [];
				this.sentences = [];
				this.controllers = new Set();
				// 分段播放的状态
				this.segments = [];
				this.segmentFirstIndex = [];
				this.segmentIndex = 0;
				this.segmentBase = 0;      // 当前段在全局时间轴上的起点（秒）
				this.synthPromises = new Map();
				this.playToken = 0;        // 每次 play() 自增，淘汰过期的异步结果
				this.segmentSynthRate = 1; // 当前段合成时用的语速，用来算 playbackRate 补偿
			}
			subscribe(fn) {
				this.listeners.add(fn);
				return () => { this.listeners.delete(fn); };
			}
			emit() {
				const snap = this.snapshot();
				for (const fn of Array.from(this.listeners)) {
					try { fn(snap); } catch {}
				}
			}
			snapshot() {
				return {
					status: this.status,
					index: this.index,
					total: this.total,
					rate: this.rate,
					voiceURI: this.voiceURI,
					voices: this.voices,
					error: this.error
				};
			}
			/**
			 * 设置语速。
			 *
			 * 合成时用的是 edge_tts 的 rate 参数（声音自然），但那要等下一段合成
			 * 才生效。所以当前正在播的这一段用 playbackRate 立刻补偿：
			 *   实际语速 = 合成时的 rate × playbackRate
			 * 把 playbackRate 设成 新语速 / 本段合成语速，当前段就立刻变速；
			 * 下一段则直接用新语速合成。两者衔接处的实际语速是一致的。
			 */
			setRate(rate) {
				const next = Math.min(2, Math.max(0.5, Number(rate) || 1));
				if (next === this.rate) return;
				const previous = this.rate;
				this.rate = next;
				if (this.audio && this.segmentSynthRate > 0) {
					const playbackRate = next / this.segmentSynthRate;
					try { this.audio.playbackRate = playbackRate; } catch {}
					// 本段时间戳是按旧 playbackRate 铺的，现在要按新倍率重新缩放，
					// 否则高亮会和声音错位。
					const firstIndex = this.segmentFirstIndex[this.segmentIndex] ?? 0;
					const count = this.segments[this.segmentIndex]?.length ?? 0;
					const scale = previous / next;
					for (let i = 0; i < count; i++) {
						const timing = this.timings[firstIndex + i];
						if (!timing) continue;
						const relative = timing.offset - this.segmentBase;
						this.timings[firstIndex + i] = {
							offset: this.segmentBase + relative * scale,
							duration: timing.duration * scale
						};
					}
				}
				// 已经预取的那段是按旧语速合成的，语速变了就得丢掉重合成。
				if (this.synthPromises.size) {
					this.synthPromises.clear();
					this.prefetchSegment(this.segmentIndex + 1);
				}
				this.emit();
			}
			setVoice(voiceURI) {
				this.voiceURI = voiceURI || '';
				this.emit();
			}
			mark(index, state) {
				const sentence = this.sentences[index];
				if (sentence && sentence.el && sentence.el.isConnected) sentence.el.setAttribute('data-state', state);
			}
			clearMarks() {
				for (const sentence of this.sentences) {
					if (sentence && sentence.el && sentence.el.isConnected) sentence.el.removeAttribute('data-state');
				}
			}
			/** 拉取云端音色表；失败时保留空列表，控制条会显示为无音色可选。 */
			async loadVoices() {
				try {
					const res = await fetch('/jr/api/voices');
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					this.voices = Array.isArray(data.voices) ? data.voices : [];
					this.emit();
					return this.voices;
				} catch (error) {
					this.error = String(error.message || error);
					this.emit();
					return [];
				}
			}
			/**
			 * 请求一段音频。返回 { blob, timings } —— timings 是与 sentences 同序的
			 * { offset, duration } 列表，offset 单位为秒（相对本段起点）。
			 */
			async synthesize(text, voice, rate) {
				const controller = new AbortController();
				this.controllers.add(controller);
				// 用「本次请求自己的 controller」判断取消，而不是共享标志：
				// 共享标志在连续两次朗读时会串味——上一轮 abort 触发的拒绝，
				// 可能撞上新一轮刚把标志清掉的时刻，被误判成真实故障。
				const isAborted = () => controller.signal.aborted;
				const chunks = [];
				const timings = [];
				let failure = null;
				const handleFrame = (frame) => {
					if (frame.type === 'audio') {
						chunks.push(frame.data);
					} else if (frame.type === 'boundary') {
						timings.push({ offset: frame.offset, duration: frame.duration, text: frame.text });
					} else if (frame.type === 'error') {
						failure = new Error(frame.message || 'edge tts error');
					}
				};
				// emoji 与符号无法朗读，还会打乱文本的时间戳对齐——直接去掉。
				// 用 \u{...} 匹配整个代理对，避免只删掉一半留下孤立代理项。
				const spoken = String(text || '')
					.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
					.replace(/\s{2,}/g, ' ')
					.trim();
				try {
					const res = await fetch('/jr/api/speech', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ text: spoken, voice, rate }),
						signal: controller.signal
					});
					if (!res.ok) {
						let message = `HTTP ${res.status}`;
						try {
							const data = await res.json();
							if (data && data.error) message = data.error;
						} catch {}
						throw new Error(message);
					}
					const reader = res.body && res.body.getReader ? res.body.getReader() : null;
					if (reader) {
						const decoder = new TextDecoder();
						let pending = '';
						for (;;) {
							const { done, value } = await reader.read();
							if (done) break;
							pending += decoder.decode(value, { stream: true });
							let index;
							while ((index = pending.indexOf('\n')) >= 0) {
								const line = pending.slice(0, index).trim();
								pending = pending.slice(index + 1);
								if (!line) continue;
								try { handleFrame(JSON.parse(line)); } catch {}
							}
						}
					} else {
						const text2 = await res.text();
						for (const line of text2.split('\n')) {
							const trimmed = line.trim();
							if (!trimmed) continue;
							try { handleFrame(JSON.parse(trimmed)); } catch {}
						}
					}
					if (failure) throw failure;
					if (!chunks.length) throw new Error('no audio returned');
					const binary = chunks.map((c) => atob(c));
					const bytes = new Uint8Array(binary.reduce((sum, part) => sum + part.length, 0));
					let offset = 0;
					for (const part of binary) {
						for (let i = 0; i < part.length; i++) bytes[offset++] = part.charCodeAt(i);
					}
					return { blob: new Blob([bytes], { type: 'audio/mpeg' }), timings };
				} catch (error) {
					// 主动取消：Chromium 会抛 AbortError「BodyStreamBuffer was aborted」，
					// 这是预期行为，不该当成错误上报。
					if (isAborted()) return { blob: null, timings, aborted: true };
					throw error;
				} finally {
					this.controllers.delete(controller);
				}
			}

			/** 把句子切成若干段，每段不超过 SEGMENT_CHARS 字符。 */
			segmentSentences(sentences) {
				const segments = [];
				let current = [];
				let length = 0;
				for (const sentence of sentences) {
					const size = String(sentence.text || '').trim().length + 1;
					if (current.length && length + size > SEGMENT_CHARS) {
						segments.push(current);
						current = [];
						length = 0;
					}
					current.push(sentence);
					length += size;
				}
				if (current.length) segments.push(current);
				return segments;
			}

			/**
			 * 合成一段，返回 { blob, timings, rate }；
			 * timings 相对本段起点，rate 是这段实际使用的合成语速。
			 */
			async synthSegment(sentences) {
				const text = sentences.map((s) => String(s.text || '').trim()).join(' ');
				const rate = this.rate;
				const result = await this.synthesize(text, this.voiceURI || 'en-US-AvaNeural', rate);
				return { ...result, rate };
			}
			/** 预取下一段，让播放到段尾时音频已经就绪。 */
			prefetchSegment(segmentIndex) {
				if (segmentIndex >= this.segments.length) return;
				if (this.synthPromises.has(segmentIndex)) return;
				const token = this.playToken;
				const sentences = this.segments[segmentIndex];
				const promise = this.synthSegment(sentences)
					.then((result) => {
						// 播放已经被换掉了，丢弃这次结果。
						if (token !== this.playToken) return null;
						if (result && result.aborted) return null;
						return result;
					})
					.catch((error) => {
						if (token !== this.playToken) return null;
						throw error;
					});
				this.synthPromises.set(segmentIndex, promise);
			}
			/** 把服务端的时间戳与本地句子对齐（服务端可能多切/少切几句）。 */
			alignTimings(timings, sentences) {
				const out = [];
				let cursor = 0;
				for (const sentence of sentences) {
					const wanted = String(sentence.text || '').trim();
					// 先在当前位置找文本完全一致的边界。
					let found = -1;
					for (let i = cursor; i < timings.length; i++) {
						if (String(timings[i].text || '').trim() === wanted) { found = i; break; }
					}
					if (found < 0) {
						// 再按前缀匹配（服务端可能带上尾部标点差异）。
						for (let i = cursor; i < timings.length; i++) {
							const text = String(timings[i].text || '').trim();
							if (text && (wanted.startsWith(text) || text.startsWith(wanted))) { found = i; break; }
						}
					}
					if (found < 0) { out.push(null); continue; }
					cursor = found + 1;
					out.push({ offset: timings[found].offset, duration: timings[found].duration });
				}
				return out;
			}
			async play(sentences, startIndex) {
				if (!sentences || !sentences.length) return;
				this.stopAudio();
				this.playToken += 1;
				const token = this.playToken;
				this.sentences = sentences;
				this.total = sentences.length;
				this.error = null;
				this.index = Math.max(0, Math.min(sentences.length - 1, Number(startIndex) || 0));
				this.status = 'loading';
				this.emit();

				// 分段：整章一次性合成要 40 秒以上，首句迟迟听不到。
				// 改为按段合成、播完一段立刻续下一段。
				this.segments = this.segmentSentences(sentences);
				this.segmentFirstIndex = [];
				let cursor = 0;
				for (const segment of this.segments) {
					this.segmentFirstIndex.push(cursor);
					cursor += segment.length;
				}
				this.segmentIndex = 0;
				this.segmentBase = 0;
				this.timings = [];

				// 从包含 startIndex 的那一段开始播。
				let startSegment = 0;
				for (let i = 0; i < this.segmentFirstIndex.length; i++) {
					if (this.segmentFirstIndex[i] <= this.index) startSegment = i;
				}
				this.segmentIndex = startSegment;

				await this.playSegment(token, startSegment);
			}

			/**
			 * 播放一段：合成 → 播放 → 结束时接下一段。
			 * 合成失败就整段停下并报错。
			 */
			async playSegment(token, segmentIndex) {
				if (token !== this.playToken) return;
				const sentences = this.segments[segmentIndex];
				if (!sentences) { this.finishPlayback(token); return; }

				// 提前合成下一段，播到段尾时音频已就绪。
				this.prefetchSegment(segmentIndex + 1);

				let result;
				try {
					const pending = this.synthPromises.get(segmentIndex);
					result = pending ? await pending : await this.synthSegment(sentences);
				} catch (error) {
					if (token !== this.playToken) return;
					this.error = String(error.message || error);
					this.status = 'idle';
					this.emit();
					return;
				}
				if (token !== this.playToken) return;
				if (!result || result.aborted) return;   // 已被取消
				if (!result.blob) {
					this.error = 'no audio returned';
					this.status = 'idle';
					this.emit();
					return;
				}

				// 本段的时间戳换算到全局时间轴。
				// 本段合成时用的是 result.rate；如果播放时又改了语速（playbackRate 补偿），
				// 时间戳要按 playbackRate 缩放，否则高亮会跟声音错位。
				const synthRate = result.rate || this.rate;
				const playbackRate = this.rate / synthRate;
				const segmentTimings = this.alignTimings(result.timings, sentences);
				const base = this.segmentBase;
				const globalTimings = segmentTimings.map((timing) => (
					timing
						? { offset: timing.offset / playbackRate + base, duration: timing.duration / playbackRate }
						: null
				));
				const firstIndex = this.segmentFirstIndex[segmentIndex] ?? 0;
				for (let i = 0; i < globalTimings.length; i++) {
					this.timings[firstIndex + i] = globalTimings[i];
				}
				// 兜底只针对**本段内**没对齐上的句子。
				// 早先的写法会从 i=0 扫到整个数组，把前面段落已经填好的时间戳
				// 全部改写成 { offset: last, duration: 0.2 }，高亮因此错位。
				for (let i = firstIndex; i < firstIndex + globalTimings.length; i++) {
					if (this.timings[i]) continue;
					const previous = i > 0 ? this.timings[i - 1] : null;
					this.timings[i] = previous
						? { offset: previous.offset + previous.duration, duration: 0.2 }
						: { offset: base, duration: 0.2 };
				}

				this.releaseAudio();
				this.objectUrl = URL.createObjectURL(result.blob);
				const audio = new Audio(this.objectUrl);
				this.audio = audio;
				// 这段是按 synthRate 合成的；若播放期间语速被改过，用 playbackRate 补偿。
				this.segmentSynthRate = synthRate;
				try { audio.playbackRate = playbackRate; } catch {}
				audio.onended = () => {
					if (this.audio !== audio) return;
					this.nextSegment(token);
				};
				audio.onerror = () => {
					if (this.audio !== audio) return;
					this.error = 'audio playback failed';
					this.status = 'idle';
					this.emit();
				};
				try {
					await audio.play();
				} catch (error) {
					if (token !== this.playToken) return;
					this.error = String(error.message || error);
					this.status = 'idle';
					this.emit();
					return;
				}
				if (token !== this.playToken) return;
				this.status = 'playing';
				this.tick();
				this.emit();
			}

			/** 段结束：接下一段。 */
			nextSegment(token) {
				if (token !== this.playToken) return;
				const next = this.segmentIndex + 1;
				if (next >= this.segments.length) { this.finishPlayback(token); return; }
				this.segmentIndex = next;
				// 下一段的全局起点 = 上一段结束时的时间。
				const previous = this.segmentFirstIndex[this.segmentIndex - 1] ?? 0;
				const previousCount = this.segments[this.segmentIndex - 1].length;
				let base = this.segmentBase;
				for (let i = 0; i < previousCount; i++) {
					const timing = this.timings[previous + i];
					if (timing) base = Math.max(base, timing.offset + timing.duration);
				}
				this.segmentBase = base;
				this.playSegment(token, next);
			}

			finishPlayback(token) {
				if (token !== this.playToken) return;
				this.status = 'done';
				this.emit();
			}

			/** 释放当前音频对象与 blob URL。 */
			releaseAudio() {
				if (this.audio) {
					this.audio.onended = null;
					this.audio.onerror = null;
					try { this.audio.pause(); } catch {}
					try { this.audio.src = ''; } catch {}
					this.audio = null;
				}
				if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
			}

			/** 播放期间按真实时间轴推进高亮。 */
			tick() {
				if (this.status !== 'playing' || !this.audio) return;
				// 用 audio.currentTime 而不是墙钟：改了 playbackRate 之后，
				// currentTime 仍然是「音频播放到哪了」，墙钟却和声音脱节了。
				const elapsed = this.segmentBase + this.audio.currentTime;
				let active = -1;
				for (let i = 0; i < this.timings.length; i++) {
					const timing = this.timings[i];
					if (!timing) continue;
					if (elapsed >= timing.offset && elapsed < timing.offset + timing.duration) { active = i; break; }
					if (elapsed >= timing.offset + timing.duration) active = i;
				}
				if (active >= 0 && active !== this.index) {
					for (let i = 0; i < active; i++) this.mark(i, 'done');
					this.mark(active, 'active');
					const sentence = this.sentences[active];
					if (sentence) this.scrollTo(sentence);
					this.index = active;
					this.emit();
				}
				this.raf = requestAnimationFrame(() => this.tick());
			}
			scrollTo(sentence) {
				if (!sentence || !sentence.el || typeof sentence.el.scrollIntoView !== 'function') return;
				const wrap = sentence.el.closest('.jr-article-wrap');
				if (!wrap) return;
				const rect = sentence.el.getBoundingClientRect();
				const bounds = wrap.getBoundingClientRect();
				if (rect.top >= bounds.top + 40 && rect.bottom <= bounds.bottom - 40) return;
				sentence.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
			}
			toggle() {
				if (!this.audio) return;
				if (this.status === 'playing') {
					this.audio.pause();
					this.status = 'paused';
					this.emit();
					return;
				}
				if (this.status === 'paused') {
					// 用 audio.currentTime 做时间轴，暂停/恢复不需要任何补偿。
					this.audio.play().catch(() => {});
					this.status = 'playing';
					this.tick();
					this.emit();
				}
			}
			jump(delta) {
				if (!this.audio || !this.timings.length) return;
				const target = Math.max(0, Math.min(this.timings.length - 1, this.index + delta));
				const timing = this.timings[target];
				if (!timing) return;
				// 跳到别的段时，当前段的时间轴基准会失效——重启所在段的播放。
				const targetSegment = this.segmentIndexFor(target);
				if (targetSegment !== this.segmentIndex) {
					const token = this.playToken;
					this.segmentIndex = targetSegment;
					this.segmentBase = 0;
					for (let i = 0; i < target; i++) {
						const t = this.timings[i];
						if (t) this.segmentBase = Math.max(this.segmentBase, t.offset);
					}
					this.playSegment(token, targetSegment);
					return;
				}
				this.audio.currentTime = Math.max(0, timing.offset - this.segmentBase);
				for (let i = 0; i < target; i++) this.mark(i, 'done');
				this.mark(target, 'active');
				this.index = target;
				this.emit();
			}
			/** 某个句子属于哪一段。 */
			segmentIndexFor(sentenceIndex) {
				let result = 0;
				for (let i = 0; i < this.segmentFirstIndex.length; i++) {
					if (this.segmentFirstIndex[i] <= sentenceIndex) result = i;
				}
				return result;
			}
			stopAudio() {
				if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
				// abort 掉所有正在读的流：Chromium 会以 AbortError 拒绝那次 read()，
				// synthesize() 用自己 controller 的 signal 判定这是主动取消，不会当成故障。
				for (const controller of Array.from(this.controllers)) {
					try { controller.abort(); } catch {}
				}
				this.controllers.clear();
				this.synthPromises.clear();
				this.releaseAudio();
			}
			stop() {
				this.stopAudio();
				this.clearMarks();
				this.status = 'idle';
				this.index = -1;
				this.total = 0;
				this.timings = [];
				this.segments = [];
				this.segmentFirstIndex = [];
				this.emit();
			}
			dispose() {
				this.stop();
				this.listeners.clear();
			}
		};

		const JournalIcon = () => h('svg', {
			viewBox: '0 0 20 20', width: 20, height: 20, 'aria-hidden': true,
			style: { display: 'block' }
		},
			h('rect', { x: 3, y: 2.5, width: 14, height: 15, rx: 2, fill: 'currentColor', opacity: .16 }),
			h('path', { d: 'M5.5 6h5.5M5.5 8.6h9M5.5 11.2h9M5.5 13.8h4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none' }),
			h('rect', { x: 11.8, y: 12.6, width: 2.8, height: 2.8, rx: .7, fill: 'currentColor' })
		);

		/**
		 * 一行一刊的刊物条目。
		 *
		 * 折叠时只显示刊物信息 + 最新一期；点开才拉取完整期号列表
		 * （/jr/api/mag-issues），展开的列表在文档流里排布，没有内部滚动条。
		 */
		function MagazineRow({ mag, t, onOpen, savedSet, expanded, onToggle }) {
			const cadence = mag.cadence === 'weekly' ? t('weekly') : mag.cadence === 'biweekly' ? t('biweekly') : t('monthly');
			const latest = mag.latest;
			const latestPath = latest ? (latest.logicalPath || latest.path) : null;
			return h('div', { className: 'jr-mag', 'data-open': expanded ? 'true' : undefined },
				h('div', { className: 'jr-mag-row' },
					h('button', {
						className: 'jr-mag-info',
						style: { display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', flex: 1, minWidth: 0 },
						onClick: onToggle,
						'aria-expanded': expanded
					},
						h('div', { className: 'jr-chip', style: { background: mag.color } }, mag.title.charAt(0)),
						h('div', { style: { minWidth: 0 } },
							h('div', { className: 'jr-mag-name' }, mag.title),
							h('div', { className: 'jr-mag-meta' },
								`${mag.zh} · ${cadence} · ${t('issuesCount').replace('{n}', String(mag.count ?? 0))}`)
						)
					),
					latestPath ? h('div', { className: 'jr-mag-latest' },
						h('button', {
							className: 'jr-latest-date',
							style: { background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' },
							onClick: () => onOpen(latestPath),
							title: t('latest')
						}, latest.date),
						h('span', { className: 'jr-latest-tag' }, t('latest')),
						savedSet && savedSet.has(latestPath) ? h('span', { className: 'jr-issue-saved' }, t('saved')) : null
					) : null,
					h('button', {
						className: 'jr-toggle',
						onClick: onToggle,
						'aria-expanded': expanded,
						'data-open': expanded ? 'true' : undefined,
						title: expanded ? t('less') : t('more')
					}, '▸')
				),
				mag.error ? h('div', { className: 'jr-error', style: { margin: '0 14px 10px' } }, mag.error) : null
			);
		}

		/**
		 * 展开后的期号列表。
		 *
		 * 一次不铺开全部日期——经济学人有 97 期，全铺出来是一堵墙。
		 * 按「页」分：每页 PAGE_SIZE 期，底部「加载更多」继续往下翻。
		 * 页内仍按月份分组，最新一期带「最新」徽标。
		 */
		function IssueList({ mag, issues, t, onOpen, savedSet }) {
			const PAGE_SIZE = 12;
			const [page, setPage] = useState(1);
			const shown = issues.slice(0, page * PAGE_SIZE);
			const byMonth = mag.cadence !== 'monthly';

			const issueRow = (issue, isLatest) => h('div', {
				key: issue.logicalPath || issue.path,
				style: { display: 'flex', alignItems: 'center' }
			},
				h('button', { className: 'jr-issue', style: { flex: 1 }, onClick: () => onOpen(issue.logicalPath || issue.path) },
					// 徽标放在日期里，跟日期挨着；否则 flex 会把它们甩到行的另一头。
					h('span', { className: 'jr-issue-date' },
						issue.date,
						isLatest ? h('span', { className: 'jr-issue-latest' }, t('latest')) : null,
						savedSet && savedSet.has(issue.logicalPath || issue.path) ? h('span', { className: 'jr-issue-saved' }, t('saved')) : null
					)
				),
				h('a', {
					className: 'jr-link',
					href: `https://github.com/${mag.repo ? mag.repo.owner : 'hehonghui'}/${mag.repo ? mag.repo.repo : 'awesome-english-ebooks'}/tree/${mag.repo ? mag.repo.branch : 'master'}/${issue.path}`,
					target: '_blank', rel: 'noreferrer'
				}, t('onGithub'))
			);

			// 页内按月分组；周刊每月一期，杂志每月多期。
			const months = [];
			for (const issue of shown) {
				const key = byMonth ? issue.date.slice(0, 7) : issue.date.slice(0, 4);
				const last = months[months.length - 1];
				if (last && last.month === key) last.items.push(issue);
				else months.push({ month: key, items: [issue] });
			}

			const remaining = issues.length - shown.length;
			return h('div', { className: 'jr-issues' },
				months.map((group, gi) => h('div', { key: group.month },
					h('div', { className: 'jr-submonth' }, group.month),
					group.items.map((issue, index) => issueRow(issue, gi === 0 && index === 0))
				)),
				remaining > 0
					? h('button', {
						className: 'jr-more',
						onClick: () => setPage((p) => p + 1)
					}, t('loadMore').replace('{n}', String(remaining)))
					: null
			);
		}

		function ShelfView({ data, loading, error, t, onRefresh, onOpen, onRetry, savedSet }) {
			// 展开的刊物 key，以及它们已加载的期号列表。
			const [openKeys, setOpenKeys] = useState(() => new Set());
			const [issueLists, setIssueLists] = useState({});
			const [loadingKeys, setLoadingKeys] = useState(() => new Set());

			const toggle = useCallback((mag) => {
				const key = mag.key;
				setOpenKeys((current) => {
					const next = new Set(current);
					if (next.has(key)) { next.delete(key); return next; }
					next.add(key);
					// 第一次展开时才去拉完整期号列表。
					if (!issueLists[key] && !loadingKeys.has(key)) {
						setLoadingKeys((cur) => new Set(cur).add(key));
						fetch(`/jr/api/mag-issues?mag=${encodeURIComponent(key)}`)
							.then((res) => {
								if (!res.ok) throw new Error(`HTTP ${res.status}`);
								return res.json();
							})
							.then((payload) => {
								setIssueLists((cur) => ({ ...cur, [key]: payload.issues || [] }));
							})
							.catch(() => {
								setIssueLists((cur) => ({ ...cur, [key]: [] }));
							})
							.finally(() => {
								setLoadingKeys((cur) => {
									const next = new Set(cur);
									next.delete(key);
									return next;
								});
							});
					}
					return next;
				});
			}, [issueLists, loadingKeys]);

			if (loading) return h('div', { className: 'jr-center' }, h('span', { className: 'jr-spin' }), t('loading'));
			if (error) return h('div', { className: 'jr-shell' },
				h('div', { className: 'jr-error' }, error),
				h('div', { style: { marginTop: 12 } }, h('button', { className: 'jr-btn', onClick: onRetry }, t('retry')))
			);
			const magazines = data.magazines || [];
			return h('div', { className: 'jr-shell' },
				h('div', { className: 'jr-head' },
					h('div', null,
						h('div', { className: 'jr-title' }, t('title'))
					),
					h('button', { className: 'jr-btn', onClick: onRefresh }, t('refresh'))
				),
				h('div', { className: 'jr-grid' },
					magazines.map((mag) => {
						const expanded = openKeys.has(mag.key);
						const issues = issueLists[mag.key];
						return h('div', { key: mag.key },
							h(MagazineRow, {
								mag, t, onOpen, savedSet,
								expanded,
								onToggle: () => toggle(mag)
							}),
							expanded ? (loadingKeys.has(mag.key)
								? h('div', { className: 'jr-issues' },
									h('div', { className: 'jr-hint' },
										h('span', { className: 'jr-spin', style: { width: 12, height: 12, marginRight: 6 } }),
										t('loading'))
								)
								: issues && issues.length
									? h(IssueList, { mag, issues, t, onOpen, savedSet })
									: issues && !issues.length
										? h('div', { className: 'jr-issues' }, h('div', { className: 'jr-hint' }, t('noIssues')))
										: null
							) : null
						);
					})
				),
				h('div', { className: 'jr-hint', style: { marginTop: 16 } }, t('selectHint'))
			);
		}

		/**
		 * 读取 Host 的分帧响应（ndjson）。
		 * 每一帧是 { type: 'text' | 'reasoning' | 'done', text }。
		 * 思考与正文分开回调，客户端可以在思考期间就给出反馈。
		 */
		async function streamFrames(res, onText, onReasoning) {
			const reader = res.body && res.body.getReader ? res.body.getReader() : null;
			if (!reader) {
				// 没有流式响应时按整段处理（兼容降级路径）。
				const text = await res.text();
				if (text) onText(text);
				return text;
			}
			const decoder = new TextDecoder();
			let pending = '';
			let text = '';
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				pending += decoder.decode(value, { stream: true });
				let index;
				while ((index = pending.indexOf('\n')) >= 0) {
					const line = pending.slice(0, index).trim();
					pending = pending.slice(index + 1);
					if (!line) continue;
					let frame;
					try { frame = JSON.parse(line); } catch { continue; }
					if (frame.type === 'text') { text += frame.text || ''; onText(text); }
					else if (frame.type === 'reasoning') { onReasoning?.(frame.text || ''); }
				}
			}
			return text;
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

		function SelectionPopup({ popup, t, explainReady, onClose, onChat, onSpeak }) {
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
						// 走 Host 代理而不是浏览器直连：直连常被代理/防火墙拦下。
						const res = await fetch(`/jr/api/dict?word=${encodeURIComponent(popup.text)}`, { signal: controller.signal });
						if (!res.ok) {
							let message = `HTTP ${res.status}`;
							try {
								const data = await res.json();
								if (data && data.error) message = data.error;
							} catch {}
							throw new Error(message);
						}
						const data = await res.json();
						const entries = Array.isArray(data.entries) ? data.entries : [];
						if (!data.found || entries.length === 0) {
							setContent(t('wordNotFound'));
							setDictParts([]);
						} else {
							const parts = [];
							for (const entry of entries.slice(0, 2)) {
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
						title: t('readAloud'),
						onClick: () => { stop(); onSpeak(popup.text); }
					}, t('readAloud')),
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
			// 首次进入时的那一期。判断「换没换文章」要用它，不能用 magKey：
			// 同一本刊物的不同期号 magKey 相同。
			const initialPathRef = useRef(path);
			// 记录是否已经加载过章节元信息，用来区分「首次加载」与「换章」。
			const metaRef = useRef(null);

			// —— 朗读 ——
			const engineRef = useRef(null);
			const [speech, setSpeech] = useState(() => ({
				status: 'idle', index: -1, total: 0, rate: 1, voiceURI: '', voices: [],
				error: null
			}));
			const [speechOpen, setSpeechOpen] = useState(false);
			// 引擎必须在 effect 里创建：渲染期 new 会让 React 的严格模式挂载两次，
			// 多余的实例会留下未注销的监听。
			useEffect(() => {
				const engine = new CloudSpeechEngine();
				engineRef.current = engine;
				const prefs = readJson(SETTINGS_KEY, {});
				if (typeof prefs.speechRate === 'number') engine.setRate(prefs.speechRate);
				if (typeof prefs.speechVoice === 'string') engine.setVoice(prefs.speechVoice);
				const unsubscribe = engine.subscribe((snap) => setSpeech(snap));
				setSpeech(engine.snapshot());
				// 云端音色表是异步的，拉回来后控制条的下拉框才有选项。
				engine.loadVoices().catch(() => {});
				return () => {
					unsubscribe();
					engine.dispose();
					engineRef.current = null;
				};
			}, []);
			const changeSpeechRate = useCallback((value) => {
				const engine = engineRef.current;
				if (!engine) return;
				engine.setRate(value);
				const prefs = readJson(SETTINGS_KEY, {});
				prefs.speechRate = engine.rate;
				writeJson(SETTINGS_KEY, prefs);
			}, []);
			const changeSpeechVoice = useCallback((voiceURI) => {
				const engine = engineRef.current;
				if (!engine) return;
				engine.setVoice(voiceURI);
				const prefs = readJson(SETTINGS_KEY, {});
				prefs.speechVoice = voiceURI;
				writeJson(SETTINGS_KEY, prefs);
			}, []);

			const stopSpeech = useCallback(() => {
				const engine = engineRef.current;
				if (engine) engine.stop();
			}, []);

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
				//
				// 判断「换没换文章」必须比 path（具体期号），不能比 magKey：
				// 同一本刊物的两期 magKey 相同，用 magKey 判断会让「换一期」也保留
				// 对照模式，于是新一期一进来就自动翻译。
				const sameIssue = path === initialPathRef.current;
				setDual(sameIssue ? Boolean(initialDual) : false);
				if (!sameIssue) {
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
					dual,
					// 记录「对照」属于哪一期：换文章时不该继承它。
					dualPath: path
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
				// 换章就停朗读：否则上一章的语音会继续在后台念下去。
				const engine = engineRef.current;
				if (engine) engine.stop();
				setTransMap({});
				// 换章就关掉「对照」：新章节不该一进来就自动翻译。
				// 首次加载要保留 session 里恢复的开关，所以只在此后生效。
				if (metaRef.current) setDual(false);
				metaRef.current = meta;
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

			/**
			 * 把章节 HTML 拆成渲染块。
			 *
			 * 段落按钮（译 / ♪）只挂在 type='para' 的块上，所以得尽量多认出段落。
			 * 各刊的正文层级不一样：
			 *   经济学人  <body><p>…</p>…            ← 段落是 body 直子
			 *   纽约客    <body><a/><p>…</p><div/>     ← 混排
			 *   大西洋/连线 <body><div><p>…</p></div>  ← 段落包在 div 里
			 * 只扫 body 的直接子节点会漏掉后三本的全部段落，
			 * 所以这里递归下钻：遇到 div/section/article 等容器就进去找段落，
			 * 容器本身不再单独成块（否则同一段文字会被渲染两遍）。
			 */
			const blocks = useMemo(() => {
				if (!html) return [];
				try {
					const doc = new DOMParser().parseFromString(html, 'text/html');
					const out = [];
					// 只下钻这些容器：它们在 epub 里纯粹是排版用的壳。
					const CONTAINERS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE']);
					const visit = (nodes) => {
						for (const node of Array.from(nodes)) {
							if (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'BLOCKQUOTE')) {
								const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
								const hasImg = typeof node.querySelector === 'function' && Boolean(node.querySelector('img'));
								if (text.length < 2 && !hasImg) continue;
								out.push({ type: 'para', html: node.outerHTML, text });
							} else if (node.nodeType === 1 && CONTAINERS.has(node.tagName)) {
								// 容器里如果能找到段落，就用段落代替容器；
								// 只有图或纯装饰时才保留容器本身。
								const before = out.length;
								visit(node.childNodes);
								if (out.length === before) {
									const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
									const hasImg = typeof node.querySelector === 'function' && Boolean(node.querySelector('img'));
									if (text.length >= 2 || hasImg) {
										out.push({ type: 'raw', html: node.outerHTML });
									}
								}
							} else if (node.nodeType === 1) {
								out.push({ type: 'raw', html: node.outerHTML });
							} else if (node.nodeType === 3 && node.textContent.trim()) {
								out.push({ type: 'raw', html: node.textContent });
							}
						}
					};
					visit(doc.body.childNodes);
					return out;
				} catch {
					return [{ type: 'raw', html }];
				}
			}, [html]);

			/** 朗读当前章节正文；PDF 模式没有可高亮的 DOM，退化为只发声。 */
			const startSpeech = useCallback((startIndex) => {
				const engine = engineRef.current;
				if (!engine) return;
				const container = contentRef.current;
				const fromDom = container ? annotateSentences(container) : { sentences: [] };
				const sentences = fromDom.sentences.length ? fromDom.sentences : sentencesFromBlocks(blocks);
				if (!sentences.length) return;
				engine.play(sentences, startIndex || 0);
			}, [blocks]);

			const toggleSpeech = useCallback(() => {
				const engine = engineRef.current;
				if (!engine) return;
				if (engine.status === 'idle' || engine.status === 'done') {
					setSpeechOpen(true);
					startSpeech(0);
					return;
				}
				engine.toggle();
			}, [startSpeech]);

			const jumpSpeech = useCallback((delta) => {
				const engine = engineRef.current;
				if (!engine) return;
				engine.jump(delta);
			}, [startSpeech]);

			/** 单独朗读一段（或一段选中的文字）：只发声，不接管全文队列。 */
			const speakParagraph = useCallback((text) => {
				const engine = engineRef.current;
				if (!engine || !text) return;
				const sentences = splitSentences(text).map((sentence) => ({ text: sentence, el: null, root: null }));
				if (!sentences.length) return;
				setSpeechOpen(true);
				engine.play(sentences, 0);
			}, []);

			/** 从正文某处开始朗读整章（点击段落上的句子标记）。 */
			const speakFromSentence = useCallback((sentence) => {
				const engine = engineRef.current;
				if (!engine) return;
				const container = contentRef.current;
				const fromDom = container ? annotateSentences(container) : { sentences: [] };
				const sentences = fromDom.sentences.length ? fromDom.sentences : sentencesFromBlocks(blocks);
				if (!sentences.length) return;
				const index = Math.max(0, sentences.findIndex((item) => item.el === sentence));
				setSpeechOpen(true);
				engine.play(sentences, index < 0 ? 0 : index);
			}, [blocks]);

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
							const final = await streamFrames(res,
								(acc) => {
									setChat((c) => c && ({ ...c, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 && m.role === 'assistant' ? { ...m, text: acc } : m)) }));
								},
								(reasoning) => {
									// 思考过程单独累积，界面显示「正在思考…」而不是空白等待。
									setChat((c) => c && ({ ...c, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 && m.role === 'assistant' ? { ...m, reasoning } : m)) }));
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
				// 点击句子标记：从这句开始朗读整章。
				const sentenceEl = target.closest('.jr-sentence');
				if (sentenceEl && contentRef.current && contentRef.current.contains(sentenceEl)) {
					event.preventDefault();
					setPopup(null);
					speakFromSentence(sentenceEl);
					return;
				}
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
					h('button', {
						className: 'jr-btn',
						'data-active': speechOpen || speech.status === 'playing' || undefined,
						title: t('readAloud'),
						onClick: () => {
							setSpeechOpen(true);
							const engine = engineRef.current;
							// 还没开始就立刻开读；已在播放时只展开控制条。
							if (engine && (engine.status === 'idle' || engine.status === 'done')) startSpeech(0);
						}
					}, h(SpeakerIcon, null), ' ', t('readAloud')),
					h('button', { className: 'jr-btn', 'data-active': chatOpen || undefined, onClick: () => setChatOpen((open) => !open) }, t('chat')),
					viewMode === 'text' ? h('button', { className: 'jr-btn', 'data-active': dual || undefined, onClick: () => setDual(!dual) }, t('dual')) : null,
					meta && meta.files && meta.files.pdf ? h('button', {
						className: 'jr-btn', 'data-active': viewMode === 'pdf' || undefined,
						onClick: () => setModePref(viewMode === 'pdf' ? 'text' : 'pdf')
					}, viewMode === 'pdf' ? t('textMode') : t('pdf')) : null,
					meta && meta.files && meta.files.epub ? h('a', {
						className: 'jr-link',
						href: `https://raw.githubusercontent.com/${meta.repo ? meta.repo.owner : 'hehonghui'}/${meta.repo ? meta.repo.repo : 'awesome-english-ebooks'}/${meta.repo ? meta.repo.branch : 'master'}/${(meta.repoPath || meta.path).split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(meta.files.epub)}`,
						target: '_blank', rel: 'noreferrer'
					}, t('download')) : null
				),
				speechOpen ? h(SpeechBar, {
					speech, t,
					onToggle: toggleSpeech,
					onStop: stopSpeech,
					onJump: jumpSpeech,
					onRate: changeSpeechRate,
					onVoice: changeSpeechVoice,
					onClose: () => setSpeechOpen(false)
				}) : null,
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
									}, transMap[index] && transMap[index].state === 'done' ? '—' : '译') : null,
									block.text && block.text.length >= 2 ? h('button', {
										className: 'jr-para-btn',
										'data-role': 'speak',
										title: t('readAloud'),
										onClick: (event) => { event.stopPropagation(); speakParagraph(block.text); }
									}, '♪') : null
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
					onChat: (text, isWord) => { setPopup(null); openChatWithText(text, isWord); },
					onSpeak: (text) => { setPopup(null); speakParagraph(text); }
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
						: h('div', { key: i, className: 'jr-chat-msg jr-chat-bot' },
							// 思考过程：正文还没出来时，先显示正在思考的提示。
							m.streaming && !m.text && m.reasoning
								? h('div', { className: 'jr-chat-thinking' },
									h('span', { className: 'jr-spin', style: { width: 12, height: 12, marginRight: 6 } }),
									h('span', null, t('chatThinking')),
									m.reasoning.length > 120
										? h('div', { className: 'jr-chat-reasoning' }, m.reasoning.slice(-120))
										: null)
								: null,
							m.text ? h('div', { dangerouslySetInnerHTML: { __html: renderMarkdown(m.text) } }) : null
						))),
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
		// 期刊架摘要的本地缓存：首屏直接渲染，不用等网络。
		const SHELF_KEY = 'journal.reader.shelf';

		function SpeechBar({ speech, t, onToggle, onStop, onJump, onRate, onVoice, onClose }) {
			const playing = speech.status === 'playing';
			const paused = speech.status === 'paused';
			const loading = speech.status === 'loading';
			const voices = speech.voices || [];
			return h('div', { className: 'jr-speak-bar' },
				h('button', {
					className: 'jr-speak-icon',
					title: playing ? t('speechPause') : t('speechPlay'),
					disabled: loading,
					onClick: onToggle
				}, playing ? '❚❚' : '▶'),
				h('button', {
					className: 'jr-speak-icon',
					title: t('speechStop'),
					disabled: speech.status === 'idle',
					onClick: onStop
				}, '■'),
				h('button', {
					className: 'jr-speak-icon',
					title: t('speechPrev'),
					disabled: !speech.total,
					onClick: () => onJump(-1)
				}, '⏮'),
				h('button', {
					className: 'jr-speak-icon',
					title: t('speechNext'),
					disabled: !speech.total,
					onClick: () => onJump(1)
				}, '⏭'),
				h('label', { className: 'jr-speak-rate', title: t('speechRate') },
					t('speechRate'),
					h('input', {
						type: 'range', min: '0.5', max: '2', step: '0.1',
						value: String(speech.rate),
						onChange: (event) => onRate(Number(event.target.value))
					}),
					h('span', { className: 'jr-speak-progress' }, `${speech.rate.toFixed(1)}×`)
				),
				h('select', {
					className: 'jr-speak-select',
					value: speech.voiceURI,
					title: t('speechVoice'),
					onChange: (event) => onVoice(event.target.value)
				},
					h('option', { value: '' }, t('speechAuto')),
					voices.map((voice) => h('option', { key: voice.id, value: voice.id },
						`${voice.name.replace(/^en-US-/, '').replace(/Neural$/, '')}${voice.gender === 'Male' ? ' ♂' : voice.gender === 'Female' ? ' ♀' : ''}`))
				),
				loading ? h('span', { className: 'jr-speak-progress' }, t('speechLoading')) : null,
				speech.total ? h('span', { className: 'jr-speak-progress' },
					`${Math.max(0, speech.index + 1)} / ${speech.total}`) : null,
				speech.error ? h('span', { className: 'jr-speak-status', style: { color: 'var(--dsw-alias-state-error-primary)' } },
					speech.error) : null,
				h('button', { className: 'jr-speak-icon', title: t('close'), onClick: onClose }, '×')
			);
		}

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
			// 「对照」模式只对 session 里记录的那一期有效：
			// 打开别的文章时不应该自动继承翻译开关。
			const [initialDual] = useState(() => {
				const session = readJson(SESSION_KEY, {});
				if (!session || !session.dual) return false;
				return Boolean(session.reader && session.dualPath === session.reader.path);
			});

			const loadShelf = useCallback(async (refresh) => {
				// 先用本地缓存渲染，界面立刻出内容；再后台拉新数据覆盖。
				// 之前是「等网络 → 才有界面」，首屏白屏近 1.5 秒。
				if (!refresh) {
					const cached = readJson(SHELF_KEY, null);
					if (cached && Array.isArray(cached.magazines) && cached.magazines.length) {
						setShelf({ loading: false, error: null, data: cached });
					} else {
						setShelf({ loading: true, error: null, data: null });
					}
				} else {
					setShelf((current) => ({ ...current, loading: true, error: null }));
				}
				try {
					const data = await getJson(`/jr/api/issues${refresh ? '?refresh=1' : ''}`);
					setShelf({ loading: false, error: null, data });
					writeJson(SHELF_KEY, { magazines: data.magazines, at: Date.now() });
				} catch (err) {
					// 拉取失败时保留已渲染的缓存内容，只在什么都没有时才报错。
					setShelf((current) => (
						current.data
							? { ...current, loading: false, error: null }
							: { loading: false, error: String(err.message || err), data: null }
					));
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
