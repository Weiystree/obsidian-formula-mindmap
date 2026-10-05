import { MarkdownPostProcessorContext, Notice, Plugin, TFile, addIcon } from 'obsidian';
import { VIEW_TYPE_FMM, FormulaMindMapView } from './view';
import { DEFAULT_DATA_JSON, extractBlock, replaceBlock } from './types';

// 供外部（测试脚本等）使用解析器
export { parseAIAnswer, CATEGORY_LABELS } from './parser';

const FMM_ICON_ID = 'fmm-icon';
const FMM_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M8 10.8 16 6.4M8 13.2l8 4.4"/></svg>`;

const DEFAULT_NOTE_NAME = '公式思维导图.md';

function blockFromJson(json: string): string {
	return '```fmm\n' + json + '\n```';
}

export default class FormulaMindMapPlugin extends Plugin {
	async onload(): Promise<void> {
		addIcon(FMM_ICON_ID, FMM_ICON_SVG);

		this.registerView(VIEW_TYPE_FMM, (leaf) => new FormulaMindMapView(leaf));

		this.registerMarkdownCodeBlockProcessor('fmm', (source, el, ctx) => {
			this.renderEmbedHint(el, ctx.sourcePath);
		});

		this.addCommand({
			id: 'open-formula-mindmap',
			name: '打开当前笔记的公式思维导图（无则创建）',
			callback: () => {
				void this.openForActiveNote();
			},
		});

		this.addCommand({
			id: 'import-ai-answer',
			name: '把 AI 回答导入当前公式思维导图',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(FormulaMindMapView);
				if (!view) {
					new Notice('请先打开一张公式思维导图');
					return;
				}
				view.openImportModal();
			},
		});

		this.addRibbonIcon(FMM_ICON_ID, '公式思维导图', () => {
			void this.openForActiveNote();
		});
	}

	private renderEmbedHint(el: HTMLElement, sourcePath: string): void {
		el.empty();
		const box = el.createDiv('fmm-embed');
		const icon = box.createSpan('fmm-embed-icon');
		icon.innerHTML = FMM_ICON_SVG;
		const text = box.createDiv('fmm-embed-text');
		text.createDiv('fmm-embed-title').setText('公式思维导图');
		text.createDiv('fmm-embed-desc').setText('节点数据以此代码块形式保存在本笔记中。');
		const btn = box.createEl('button', { text: '打开编辑视图' });
		btn.addEventListener('click', () => {
			void this.openViewFor(sourcePath);
		});
	}

	private async openForActiveNote(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		let path: string;
		if (active && active.extension === 'md') {
			path = active.path;
		} else {
			path = await this.findOrCreateDefaultNote();
		}
		const file = await this.ensureMapNote(path);
		await this.openViewFor(file.path);
	}

	private async findOrCreateDefaultNote(): Promise<string> {
		const existing = this.app.vault.getAbstractFileByPath(DEFAULT_NOTE_NAME);
		if (existing instanceof TFile) return existing.path;
		try {
			await this.app.vault.create(DEFAULT_NOTE_NAME, blockFromJson(DEFAULT_DATA_JSON));
		} catch (e) {
			/* 并发创建等情况下文件已存在，忽略 */
		}
		return DEFAULT_NOTE_NAME;
	}

	/** 确保笔记中存在 fmm 数据块（没有就追加模板），返回笔记文件 */
	private async ensureMapNote(path: string): Promise<TFile> {
		let file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			const idx = path.lastIndexOf('/');
			if (idx > 0) await this.ensureFolder(path.slice(0, idx));
			return (await this.app.vault.create(path, blockFromJson(DEFAULT_DATA_JSON))) as TFile;
		}
		const text = await this.app.vault.read(file);
		if (!extractBlock(text)) {
			await this.app.vault.process(file, (t) => replaceBlock(t, DEFAULT_DATA_JSON));
		}
		return file;
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean);
		let cur = '';
		for (const part of parts) {
			cur = cur ? `${cur}/${part}` : part;
			try {
				await this.app.vault.createFolder(cur);
			} catch (e) {
				/* 已存在 */
			}
		}
	}

	private async openViewFor(path: string): Promise<void> {
		const { workspace } = this.app;
		for (const leaf of workspace.getLeavesOfType(VIEW_TYPE_FMM)) {
			const view = leaf.view;
			if (view instanceof FormulaMindMapView && view.path === path) {
				workspace.revealLeaf(leaf);
				return;
			}
		}
		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_FMM, state: { path }, active: true });
		new Notice('公式思维导图已打开', 1500);
		workspace.revealLeaf(leaf);
	}
}
