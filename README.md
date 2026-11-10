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

### 🔊 朗读（Edge TTS 神经语音）
- **微软云端神经语音**：47 个英文音色（`Ava`、`Andrew`、`Jenny`、`Guy`…），音质远好于系统自带的旧式合成器
- **四个入口**：顶栏「朗读」按钮整章朗读、段落悬浮 `♪` 单段朗读、划词弹卡朗读选中内容、点击正文句子从该句起读
- **句级精准高亮**：服务端返回每句的真实时间戳，高亮按音频时间轴推进并自动跟随滚动
- **控制条**：播放/暂停、停止、上一句/下一句、语速（0.5–2.0×）、音色选择、进度显示
- **播放中即时调速**：拖语速滑杆，当前这段立刻变速（`playbackRate` 补偿），下一段直接按新语速合成，衔接处实际语速连续
- **分段合成**：按约 700 字符切段、边播边合成，首句等待从整章的 40 秒级降到约 4 秒
- **零依赖调用**：Host 侧常驻一个 Python 进程跑 `speech.py`（依赖 `edge-tts`），逐段合成不再付进程启动开销
- 语速与音色偏好随其他设置一起持久化

### 💬 AI 问答侧栏
- 文章右侧内嵌对话面板，提问自动附带当前章节全文（≤8000 字符）
- 多轮追问（带最近 5 轮历史），流式输出，Markdown 安全渲染（加粗/斜体/标题/列表）
- 每期对话独立存档，收起面板/切期/重启 App 都不丢；可一键清空
- 面板宽度可拖拽调节（260~720px），宽度记忆；开合状态完全由用户控制，换文章不自动弹开

### 🧩 其他
- 划词弹卡一体化把手条：拖动、内容摘要、折叠三合一；折叠后缩为一条标题条，不再有孤立小按钮
- **状态持久化到文件**：AI 对话存档、「已存」徽标、阅读进度、偏好设置（字号/PDF 模式/侧栏宽度/语速/音色）全部保存在本地状态文件中，彻底根治"重启丢状态"；首次运行自动迁移 localStorage 旧数据
- **GitHub API 自动认证**：检测到 GitHub CLI 登录时自动携带其 token（限额 60 → 5000 次/小时，运行时读取凭据，不存储不写库），期号树与章节列表两个调用点都带认证；配合全仓 Trees API + ETag 304 缓存，日常刷新几乎零配额消耗
- 渲染错误兜底：组件崩溃降级为错误横幅 + 重试，绝不白屏
- 中英双语界面，跟随 Harness 主题（`--dsw-alias-*` tokens）

## 📦 安装

### 方式一：dsh CLI 一条命令安装（推荐）

```bash
dsh plugin --profile <profile名> add git+https://github.com/zhu3899/english-journal-reader.git
```

`--profile` 填你的 profile 名（Desktop 默认是 `desktop`，用 `dsh --help` 可确认）。这条命令全自动完成三件事：**从 GitHub 直接拉包安装**（无需先 clone）、**注册依赖**到 profile 的 `package.json`、**声明 bundle 启用**。重启 Harness 生效。

其他管理命令：

```bash
dsh plugin --profile desktop list                          # 列出已装插件
dsh plugin --profile desktop remove @local/journal-reader  # 卸载
```

### 方式二：插件管理器界面安装

克隆仓库后，在 DeepSeek Harness 界面打开 **插件 → 已安装 → 从目录安装**，选择克隆出的 `english-journal-reader` 目录即可。

> 「从目录安装」会自动完成包注册（写入 profile 的 `node_modules`）和启用声明两步，装完重启 Harness 生效。之后插件更新了代码，重新执行一次「从目录安装」（或重启）即可加载新版。

### 方式三：完全手动（不使用任何工具）

<details>
<summary>展开查看完整步骤</summary>

插件要被 Harness 加载需要满足两个条件：**包出现在 profile 的 `node_modules` 里**（Harness 按包名查找）+ **在 `cordis.patch.yml` 里声明启用**。手动安装就是把这两步自己做一遍：

```powershell
# 1. 克隆仓库到任意位置
git clone https://github.com/zhu3899/english-journal-reader.git D:\repos\english-journal-reader

# 2. 把包目录"挂"进 profile 的 node_modules（Junction = 文件系统级快捷方式，不占双份磁盘；
#    用复制整个文件夹代替也可以）
New-Item -ItemType Junction `
  -Path "$env:DSH_PROFILE_DIR\node_modules\@local\journal-reader" `
  -Target "D:\repos\english-journal-reader"

# 3. 用文本编辑器打开 profile 的启用清单
notepad "$env:DSH_PROFILE_DIR\cordis.patch.yml"

# 4. 在文件末尾追加以下内容（与现有条目对齐，保持 YAML 缩进）后保存：
```

```yaml
- insert:
    - id: journal-reader
      name: '@local/journal-reader'
      config: {}
```

```powershell
# 5. 重启 Harness，左侧栏出现「外刊精读台」图标即安装成功
```

> `$env:DSH_PROFILE_DIR` 是 Harness 自动设置的环境变量，指向当前 profile 目录（如 `C:\Users\<你>\.dsh\profiles\desktop`）。用 Junction 的好处：以后在 D:\repos 里 `git pull` 更新插件，无需重新安装，重启即生效。

</details>

## ⚙️ 配置

插件无需配置即可使用（AI 讲解/翻译/问答依赖 Harness 设置里已配置的默认模型）。唯一可选的自定义项：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `libraryDir` | `下载\EnglishJournals` | 「读过即收藏」的本地期刊库目录（在 profile 的 cordis.patch.yml 中配置） |

```yaml
- id: journal-reader
  name: '@local/journal-reader'
  config:
    libraryDir: 'D:\EnglishJournals'
```

### 朗读功能的前置条件

朗读走 Edge TTS，需要 Host 能启动一个装了 `edge-tts` 的 Python：

```bash
pip install edge-tts
```

插件会依次在这些位置找 Python：

1. `DSH_HOME\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`（用户目录运行时）
2. DSH 安装目录内的 `runtime\primary-runtime\dependencies\python\python.exe`
3. `PATH` 上的 `python` / `python3`

> 找不到 `edge_tts` 时朗读会明确报错（`edge_tts is not installed`），其余功能不受影响。

## 🔧 技术要点

- **零依赖 Host 半区**：GitHub Git Trees API 一次请求拉取全仓期号树（ETag 304 缓存，未变更零配额），自研 zip/epub 解析器（central directory + inflateRaw），spine/NCX/nav 目录合成与 calibre 惯例标题提取（含实体二次解码与转义标签还原）
- **AI 能力走 Harness 原生管道**：`ctx.llm`（provider 无关），自动适配 thinking 模型的 reasoning effort 要求；翻译/问答双通道，多轮历史折叠为对话记录避免 adapter 校验问题
- **朗读走常驻 Python 桥**：Host 拉起一个 `speech.py` 常驻进程，逐行收发 JSON 帧（音频 base64 + 逐句时间戳）；请求带唯一 id，因此当前段与预取段可以并发合成而不会串台；`speech.py` 改动后 Host 会比对 mtime 自动换进程
- **朗读时间轴**：高亮以 `audio.currentTime` 为准而非墙钟，所以播放中改变速会被自动吸收；服务端边界与本地切句做「完全匹配 → 前缀匹配 → 跳过多余边界」三级对齐
- **安全**：章节 HTML 服务端净化（script/iframe/事件属性剥离），图片走同源代理路由（扩展名白名单），Markdown 渲染先转义后白名单重建，外链弹卡自动匹配本地章节
- **状态持久化**：`/jr/api/state` 键值 API + 本地 JSON 文件（防抖合并写），客户端读写自动迁移 localStorage 旧数据
- **缓存策略**：全仓期号树（状态文件 + ETag）、epub/PDF（磁盘，tmp）、翻译（内存 Map + localStorage 双层）、章节解析（内存）

## 📄 文件结构

```
├── package.json          # bundle 清单（dsh.bundle + dsh.client 双半区声明）
├── cordis.patch.yml      # Loader 插入行
├── index.js              # Host 半区：HTTP 路由、epub 解析、AI 管道、Edge TTS 桥
├── client.js             # Client 半区：期刊架/阅读器/划词/朗读/侧栏（React, 纯 createElement）
├── speech.py             # Edge TTS 桥：常驻 Python 进程，逐行收发 JSON 帧
└── icon.svg              # 插件图标
```

> 中英文案内联在 `client.js` 的 `zh` / `en` 两张表里（走 `ctx.locale.register`），没有独立的 locale 文件。

## 🩺 常见问题

| 现象 | 原因与处理 |
|---|---|
| `GitHub API rate limit reached (unauthenticated 60 requests/hour)` | 未检测到 GitHub CLI 登录。执行 `gh auth login` 后重试；插件会自动带上 token，限额升到 5000 次/小时 |
| `synthesis failed: ... surrogates not allowed` | 正文含 emoji。插件已做三层防护（切分不切开代理对 / 过滤 emoji / Host 侧替换孤立代理项），若仍出现请附上具体章节 |
| `edge_tts is not installed` | Python 环境缺依赖：`pip install edge-tts` |
| 朗读一直显示「合成中…」 | 首次合成需要联网调用 Edge TTS，检查网络；整章较长时首句约需 4 秒 |
| 朗读没有声音 | 浏览器音频被占用，或系统静音；检查控制台是否有 `audio playback failed` |
| 高亮和声音对不上 | 刷新页面加载新 bundle；客户端代码不会自动热更新，除非 `pnpm run dev:web` 在跑 |
| 改了插件代码没生效 | Host 侧（`index.js`/`speech.py`）需重启 Harness；Client 侧（`client.js`）刷新页面即可 |

## 🙏 致谢

- [hehonghui/awesome-english-ebooks](https://github.com/hehonghui/awesome-english-ebooks) — 外刊数据源
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 插件宿主平台

## License

MIT
