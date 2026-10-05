// 生成示例导图笔记：解析 examples/单摆-demo.md 并按视图的树状布局预排位置，
// 直接写进 Obsidian 库，用户打开笔记后点 Ribbon 图标即可看到成品导图。
const Module = require('module');
const origLoad = Module._load;
const obsidianStub = {};
for (const name of ['Plugin', 'ItemView', 'Modal', 'Menu', 'Notice', 'Setting', 'TFile', 'TAbstractFile', 'WorkspaceLeaf', 'Component']) {
	obsidianStub[name] = class {};
}
obsidianStub.MarkdownRenderer = { render: () => Promise.resolve() };
obsidianStub.addIcon = () => {};
obsidianStub.normalizePath = (p) => p;
Module._load = function (request) {
	if (request === 'obsidian') return obsidianStub;
	return origLoad.apply(this, arguments);
};

const fs = require('fs');
const { parseAIAnswer } = require('../main.js');

const md = fs.readFileSync(__dirname + '/../examples/单摆-demo.md', 'utf8');
const res = parseAIAnswer(md);
const nodes = res.nodes;
const root = nodes[0];
const kidsOf = (id) => nodes.filter((n) => n.parent === id);

// 尺寸估算（和视图渲染大致对齐，仅用于预排位置）
const estW = (n) => {
	if ((n.type ?? 'formula') === 'formula') return Math.min(460, Math.max(90, Math.round(n.latex.length * 11 + 44)));
	if (n.type === 'group') return Math.min(300, Math.max(120, Math.round((n.label || '').length * 13 + 46)));
	const w = n.w ?? Math.min(340, Math.round((n.body || n.label || '').replace(/\s/g, '').length * 14 + 36));
	return Math.max(90, w);
};
const estH = (n) => {
	const w = estW(n);
	if ((n.type ?? 'formula') === 'formula') return 58;
	if (n.type === 'group') return 54;
	const text = (n.body || n.label || '').replace(/\s+/g, '');
	const cpl = Math.max(6, Math.floor((w - 32) / 14));
	const lines = Math.max(1, Math.ceil(text.length / cpl));
	return lines * 19 + 26;
};

// 树状布局：根 → 第一层一列；各组孩子排右侧子列（组默认收起，展开即见）
root.x = 0;
root.y = 0;
let cy = 0;
for (const n of kidsOf(root.id)) {
	n.x = estW(root) + 90;
	n.y = cy;
	cy += estH(n) + 28;
}
for (const n of nodes) {
	if (n === root) continue;
	const kids = kidsOf(n.id);
	if (!kids.length) continue;
	let ky = n.y;
	for (const k of kids) {
		k.x = n.x + estW(n) + 90;
		k.y = ky;
		ky += estH(k) + 24;
	}
}

const json = JSON.stringify({ version: 1, nodes });
const note = '# 单摆的周期（示例导图）\n\n> 打开方式：让这篇笔记处于活动状态，然后点左侧栏的思维导图图标（或 Ctrl+P 运行「打开当前笔记的公式思维导图」）。\n\n```fmm\n' + json + '\n```\n';

const target = process.argv[2] || 'D:/Obsidian-Template-main/单摆的周期（示例导图）.md';
fs.writeFileSync(target, note, 'utf8');
console.log('written:', target, '| nodes:', nodes.length, '| bytes:', note.length);
