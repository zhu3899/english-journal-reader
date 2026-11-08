# 外刊精读台 · English Journal Reader

一个长在 AI 助手里的英文外刊阅读器 —— [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。数据来自 [awesome-english-ebooks](https://github.com/hehonghui/awesome-english-ebooks)（经济学人、纽约客、大西洋月刊、连线，每周/每月更新）。

> 别的阅读器只能"看"，它能"问"。

![icon](icon.svg)

## ✨ 功能

### 📖 期刊架
- 四本刊物卡片化展示，按「年-月」（周刊）/「年」（月刊）分组折叠，全量归档一键展开
- 每期一键阅读、GitHub 原页跳转、epub 下载
- **读过即收藏**：打开某一期，epub 自动存入本地期刊库（默认 `下载\EnglishJournals\<刊名>\`），已收藏期显示「已存」徽标

### 📚 双模式阅读器
- **文字版**：epub 自动下载解包（自研 zip reader），按 spine 拆章；章节进度记忆、字号调节、深浅色主题跟随、图片同源代理加载
- **PDF 版**：原版排版 100% 保真（Host 代理路由 + 浏览器原生渲染），纽约客这类转换质量差的刊物首选；按刊记忆偏好
- **智能目录**：板块/文章分层显示；从正文标题链接直接跳转对应章节（外站链接自动映射到本地章节）；封面/广告页自动过滤

### 🔍 划词学习（三粒度）
| 功能 | 说明 |
|---|---|
| 查词 | dictionaryapi.dev 释义 + 音标 + 例句，弹卡内即时显示 |
| 翻译 | 段落悬停「译」按钮逐段对照翻译；「对照」模式下随滚动懒翻译（进入视口才译），双层缓存（localStorage + 服务端），跨会话秒出 |
| AI 讲解 | 选中即讲：语法拆解、关键词汇、地道表达、背景知识，直接进入右侧 AI 问答侧栏，可多轮追问 |

### 💬 AI 问答侧栏
- 文章右侧内嵌对话面板，提问自动附带当前章节全文（≤8000 字符）
- 多轮追问（带最近 5 轮历史），流式输出，Markdown 渲染
- 每期对话独立存档，收起面板/切期/重启都不丢；可一键清空
- 面板宽度可拖拽调节（260~720px），宽度记忆

### 🧩 其他
- 弹窗可拖拽、可折叠，不挡正文
- 渲染错误兜底：组件崩溃降级为错误横幅 + 重试，绝不白屏
- 中英双语界面，跟随 Harness 主题（`--dsw-alias-*` tokens）

## 📦 安装

### 方式一：插件管理器安装（推荐）

```bash
git clone https://github.com/zhu3899/english-journal-reader.git
```

在 DeepSeek Harness 中打开 **插件 → 已安装 → 从目录安装**，选择克隆出的 `english-journal-reader` 目录即可。

### 方式二：手动复制

将仓库文件放入任意目录，在 Harness 的 `cordis.patch.yml` 中插入：

```yaml
- insert:
    - id: journal-reader
      name: '@local/journal-reader'
      config: {}
```

并把该目录链接/复制进 profile 的 `node_modules`。

## ⚙️ 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `libraryDir` | `下载\EnglishJournals` | 「读过即收藏」的本地期刊库目录（在 profile 的 cordis.patch.yml 中配置） |

```yaml
- id: journal-reader
  name: '@local/journal-reader'
  config:
    libraryDir: 'D:\EnglishJournals'
```

## 🔧 技术要点

- **零依赖 Host 半区**：GitHub Contents API 拉取期号索引（10 分钟缓存 + 请求去重），自研 zip/epub 解析器（central directory + inflateRaw），spine/NCX/nav 目录合成与 calibre 惯例标题提取
- **AI 能力走 Harness 原生管道**：`ctx.llm`（provider 无关），自动适配 thinking 模型的 reasoning effort 要求；翻译/问答双通道，多轮历史折叠为对话记录避免 adapter 校验问题
- **安全**：章节 HTML 服务端净化（script/iframe/事件属性剥离），图片走同源代理路由（扩展名白名单），Markdown 渲染先转义后白名单重建，外链弹卡自动匹配本地章节
- **缓存策略**：期号索引（内存 10min）、epub/PDF（磁盘，tmp）、翻译（内存 Map + localStorage 双层）、章节解析（内存）

## 📄 文件结构

```
├── package.json          # bundle 清单（dsh.bundle + dsh.client 双半区声明）
├── cordis.patch.yml      # Loader 插入行
├── index.js              # Host 半区：HTTP 路由、epub 解析、AI 管道
├── client.js             # Client 半区：期刊架/阅读器/划词/侧栏（React, 纯 createElement）
├── locale/               # 中英文案
└── icon.svg              # 插件图标
```

## 🙏 致谢

- [hehonghui/awesome-english-ebooks](https://github.com/hehonghui/awesome-english-ebooks) — 外刊数据源
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 插件宿主平台

## License

MIT
