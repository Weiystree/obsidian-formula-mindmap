# Formula Mind Map（公式思维导图）

一个 Obsidian 插件：画布上的每个节点都可以**自由拖拽**，节点内容是渲染好的 **LaTeX 公式**，节点之间以思维导图的父子关系连线。

- GitHub 仓库：<https://github.com/Weiystree/obsidian-formula-mindmap>
- 插件 ID：`formula-mindmap` ｜ 版本：`0.1.0` ｜ 最低要求 Obsidian `1.4.0`
- 本地开发目录：`C:\Users\Weiyushan\.zcode\workspace\default\formula-mindmap`

---

## 一、项目从零到可用的过程（2026-10-05）

1. **源码编写**（TypeScript，从零手写，无现成仓库参考）：
   - `src/types.ts` —— 数据模型与序列化：节点结构 `{id, parent, x, y, latex}`、` ```fmm ` 代码块的解析/写回、父子关系工具函数
   - `src/view.ts` —— 核心画布视图：节点渲染（Obsidian 内置 MathJax 渲染公式）、自由拖拽、平移缩放、连线（SVG 贝塞尔曲线）、拖拽换父、右键菜单、快捷键、自动保存
   - `src/edit-modal.ts` —— 公式编辑弹窗（LaTeX 源码 + 实时预览）、删除确认弹窗
   - `src/main.ts` —— 插件入口：注册视图/命令/Ribbon 图标、` ```fmm ` 代码块处理器、数据块创建与维护
   - `styles.css` —— 全部界面样式（适配 Obsidian 明暗主题 CSS 变量）
2. **构建配置**：`package.json` + `tsconfig.json` + `esbuild.config.mjs`，`npm run build` 产出 `main.js`
3. **质量验证**：TypeScript 严格类型检查通过；`test/smoke.cjs` 冒烟测试（用桩模块代替 obsidian 加载产物，确认插件类正常导出）
4. **发布 GitHub**：推送到 `Weiystree/obsidian-formula-mindmap`，`main` 分支，提交 `f335365`（14 个文件，约 2900 行）
5. **安装进库**：装到 **`D:\Obsidian-Template-main\.obsidian\plugins\formula-mindmap\`**
   - 注：曾误装到 `D:\FLO.W Obsidian 1.0.32`，已完整删除，该库 plugins 目录下原有插件未受影响

## 二、功能清单

| 功能 | 操作 |
| --- | --- |
| 新建根节点 | 双击画布空白处 / 右键 → 新建根节点 |
| 编辑公式 | 双击节点 / 选中后按 `Enter` / 右键 → 编辑公式 |
| 添加子节点 | 节点悬停时点右上角 `+` / 选中后按 `Tab` / 右键 → 添加子节点 |
| 移动节点 | 按住节点拖动（画面上随处可放） |
| 改变父子关系 | 把节点拖到另一个节点上（自动阻止循环） |
| 平移画布 | 按住空白处拖动 |
| 缩放 | 滚轮（右下角有 `+` `−` `⤢适应视图` 按钮） |
| 删除节点 | 选中后按 `Delete` / 右键 → 删除节点（含子树，有确认） |
| 取消选中 | `Esc` 或点空白处 |
| 保存 | 改动后约 0.6 秒自动写回笔记，无需手动保存 |

公式语法为标准 LaTeX（不需要写 `$$` 定界符），例如 `\frac{-b \pm \sqrt{b^2-4ac}}{2a}`，由 Obsidian 内置 MathJax 渲染。

## 三、启用方法（Obsidian-Template-main 库）

1. 在该库窗口按 `Ctrl+R` 重载 Obsidian（新装插件需重载才会被识别）
2. 设置 → 第三方插件 → 启用 **Formula Mind Map**
3. 点左侧边栏的导图图标，或命令面板运行「打开当前笔记的公式思维导图（无则创建）」
4. 首次运行会创建 `公式思维导图.md` 并打开画布；若当时活动笔记是 Markdown 笔记，数据块会追加到那篇笔记末尾

## 四、数据存在哪里

每张导图对应一篇 Markdown 笔记，数据以 ` ```fmm ` JSON 代码块形式存在笔记里（通常在末尾）：

~~~
```fmm
{"version":1,"nodes":[{"id":"a1b2c3d4","parent":null,"x":0,"y":0,"latex":"\\text{中心主题}"}]}
```
~~~

- 可以直接手工编辑这段 JSON（改完在画布里重新打开笔记视图即可生效）
- 跟随 Obsidian 同步/备份机制走，不依赖插件私有存储
- 在阅读模式里，该代码块会显示为一个带「打开编辑视图」按钮的提示卡片

## 五、开发与更新流程

```bash
cd "C:\Users\Weiyushan\.zcode\workspace\default\formula-mindmap"
npm install      # 首次
npm run dev      # watch 模式开发
npm run build    # 类型检查 + 生产构建（产出 main.js）
node test/smoke.cjs
```

改完代码后更新到库（三条命令）：

```bash
cd "C:\Users\Weiyushan\.zcode\workspace\default\formula-mindmap"
npm run build
cp main.js manifest.json styles.css "/d/Obsidian-Template-main/.obsidian/plugins/formula-mindmap/"
```

然后在 Obsidian 里 `Ctrl+R` 即可看到新版。版本有实质更新时，记得同步改 `manifest.json` 的 `version` 并提交推送。

## 六、目录结构

```
formula-mindmap/
├── manifest.json          # 插件清单（id/版本/描述）
├── main.js                # 构建产物（Obsidian 实际加载的文件）
├── styles.css             # 样式
├── src/
│   ├── main.ts            # 插件入口
│   ├── view.ts            # 画布视图（核心逻辑）
│   ├── edit-modal.ts      # 公式编辑 / 删除确认弹窗
│   └── types.ts           # 数据模型与序列化
├── test/smoke.cjs         # 冒烟测试
├── esbuild.config.mjs     # 构建配置
├── tsconfig.json
└── package.json
```

## 七、卸载

直接删除 `<库>/.obsidian/plugins/formula-mindmap/` 文件夹即可；笔记里的 ` ```fmm ` 数据块是纯文本，删不删随你（删了插件也没了数据）。

## 八、分发范围说明

- **现在**：不在官方插件市场里，搜不到；只能手动安装（本库已装）
- **想给别人用**：仓库保持公开即可，对方装 BRAT 插件后填本仓库地址就能安装（可补 `versions.json` + GitHub Release 便于识别版本）
- **想上架官方市场**：补 `versions.json`、发 GitHub Release，然后向 `obsidianmd/obsidian-releases` 提 PR 走人工审核，通过后全网可搜可装
