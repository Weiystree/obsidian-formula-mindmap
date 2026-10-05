// 解析器测试：验证 AI 回答 → 树状导图节点的分类是否正确
const Module = require('module');
const origLoad = Module._load;
const obsidianStub = {};
for (const name of [
	'Plugin',
	'ItemView',
	'Modal',
	'Menu',
	'Notice',
	'Setting',
	'TFile',
	'TAbstractFile',
	'WorkspaceLeaf',
	'ButtonComponent',
	'PluginSettingTab',
	'Component',
	'ViewStateResult',
]) {
	obsidianStub[name] = class {};
}
obsidianStub.MarkdownRenderer = { render: () => Promise.resolve() };
obsidianStub.addIcon = () => {};
obsidianStub.normalizePath = (p) => p;
Module._load = function (request, parent, isMain) {
	if (request === 'obsidian') return obsidianStub;
	return origLoad.apply(this, arguments);
};

const assert = require('assert');
const { parseAIAnswer, suggestTextWidth } = require('../main.js');

// 用 String.raw 保留 LaTeX 反斜杠
const sample = String.raw`# 二次方程求根

一元二次方程 $ax^2+bx+c=0$ 的求解如下。

核心求根公式：
$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$

**证明**：配方得到
$$\left(x+\frac{b}{2a}\right)^2 = \frac{b^2-4ac}{4a^2}$$
两边开方即得。

例 1：解方程 $x^2-3x+2=0$。

注意：判别式 $\Delta>0$ 时有两个不等实根。
`;

const res = parseAIAnswer(sample);
assert(res, 'parseAIAnswer 应返回结果');
const { nodes } = res;
const root = nodes[0];
assert.strictEqual(root.type, 'text', '根节点应为文字节点');
assert.strictEqual(root.parent, null, '根节点无父节点');
assert.ok(root.label.includes('二次方程'), '标题应取自一级标题');

const children = nodes.slice(1);
const level1 = children.filter((n) => n.parent === root.id);
console.log('解析结果（第一层）：');
for (const n of level1) {
	const preview = (n.type === 'formula' ? n.latex : n.label ?? '').slice(0, 36).replace(/\n/g, ' ');
	console.log(`  [${n.type}${n.category ? '/' + n.category : ''}] ${preview}`);
}

// 期望：1 个独立核心公式 + 证明/例子/注意 三个分组（树状，组内有孩子）
const formulas = level1.filter((n) => n.type === 'formula');
assert.strictEqual(formulas.length, 1, '应恰好有 1 个独立核心公式节点');
assert.ok(formulas[0].latex.includes('frac'), '核心公式内容应保留 LaTeX');

const proof = level1.find((n) => n.type === 'group' && n.category === 'proof');
assert(proof, '应有「证明」分组');
const proofChildren = children.filter((n) => n.parent === proof.id);
assert.ok(proofChildren.length >= 2, '证明分组下应拆出至少 2 个子节点');
assert.ok(
	proofChildren.some((n) => n.type === 'formula' && n.latex.includes('frac')),
	'证明里的公式应拆成公式子节点'
);
assert.strictEqual(proof.collapsed, true, '分组默认折叠');

const example = level1.find((n) => n.type === 'group' && n.category === 'example');
assert(example, '应有「例子」分组');
assert.ok(children.some((n) => n.parent === example.id), '例子分组应有子节点');

const note = level1.find((n) => n.type === 'group' && n.category === 'note');
assert(note, '应有「注意」分组');

// 文字节点的智能宽度
const longText = children.find((n) => n.type === 'text' && (n.body ?? '').length > 24);
if (longText) {
	assert(typeof longText.w === 'number' && longText.w >= 180 && longText.w <= 560, '长文字应带估算宽度');
}
assert(typeof suggestTextWidth('短句。') === 'number', 'suggestTextWidth 应可用');
assert(suggestTextWidth('这是一个非常非常非常长的句子，包含很多很多的汉字用来测试宽度估算是否合理。') > 300, '长句应估出更大的宽度');

// 所有节点都挂在树上
for (const n of children) {
	assert(n.parent, '子节点应有父节点');
	assert(nodes.some((m) => m.id === n.parent), '父节点必须存在');
}

// 老数据兼容：无 type 字段按 formula 处理由视图层负责，这里验证解析空串
assert.strictEqual(parseAIAnswer('   '), null, '空输入应返回 null');

console.log('PARSER TEST OK');
