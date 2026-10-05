// 冒烟测试：在 Node 里用桩模块代替 obsidian，验证 main.js 能正常加载并导出插件类
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

const mod = require('../main.js');
const cls = mod.default || mod;
if (typeof cls !== 'function') {
	console.error('FAIL: no plugin class exported from main.js');
	process.exit(1);
}
console.log('SMOKE OK: exported plugin class =', cls.name);
