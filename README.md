# Formula Mind Map（公式思维导图）

一个 Obsidian 插件：画布上的每个节点都可以**自由拖拽**，节点内容是渲染好的 **LaTeX 公式**，节点之间以思维导图的父子关系连线。

## 功能

- 自由画布：拖拽节点随意摆放，空白处拖动平移，滚轮缩放，右下角按钮适应视图
- 公式节点：双击节点弹出编辑器（LaTeX 源码 + 实时预览），用 Obsidian 内置 MathJax 渲染
- 思维导图结构：节点hover 时右上角 `+` 新建子节点；把一个节点拖到另一个节点上可改变父子关系（会阻止循环）
- 快捷操作：选中节点后 `Tab` 添加子节点、`Enter` 编辑、`Delete` 删除；双击空白新建根节点；右键菜单
- 数据保存在笔记里：每个导图对应一篇笔记，数据以 ` ```fmm ` JSON 代码块的形式存在笔记末尾，可手工编辑、可同步

## 使用

1. 启用插件后，点击左侧栏图标，或命令面板运行「打开当前笔记的公式思维导图（无则创建）」
2. 若当前活动笔记是 Markdown 笔记，导图数据会追加到该笔记末尾；否则会创建/打开 `公式思维导图.md`
3. 双击中心节点开始编辑公式，例如 `\frac{-b \pm \sqrt{b^2-4ac}}{2a}`

## 开发

```bash
npm install
npm run dev     # watch 模式，增量编译到 main.js
npm run build   # 类型检查 + 生产构建
node test/smoke.cjs
```

## 安装到库

把 `main.js`、`manifest.json`、`styles.css` 三个文件复制到：

```
<你的库>/.obsidian/plugins/formula-mindmap/
```

然后在 Obsidian「设置 → 第三方插件」中启用 Formula Mind Map。
