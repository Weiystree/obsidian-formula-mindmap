import { App, Modal, Notice, Setting } from 'obsidian';

export type ImportMode = 'auto' | 'single';

export class ImportModal extends Modal {
	constructor(
		app: App,
		private mode: ImportMode,
		private onSubmit: (text: string, mode: ImportMode) => void
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText('导入 AI 回答');
		this.contentEl.addClass('fmm-import-modal');
		this.contentEl
			.createEl('p', { text: '把 GPT 等 AI 的回答粘贴到下面（支持 Markdown 与 LaTeX）。' })
			.addClass('fmm-import-hint');

		const ta = this.contentEl.createEl('textarea');
		ta.addClass('fmm-import-textarea');
		ta.placeholder = '在此粘贴（Ctrl+V）…';

		new Setting(this.contentEl)
			.setName('导入方式')
			.setDesc('自动拆分：核心公式留成节点，推导/证明/例子折叠成彩色分组框。整段导入：全部内容算一条信息，不拆分。')
			.addDropdown((d) =>
				d
					.addOption('auto', '自动拆分（推荐）')
					.addOption('single', '整段作为一个节点（不拆分）')
					.setValue(this.mode)
					.onChange((v) => {
						this.mode = v as ImportMode;
					})
			);

		new Setting(this.contentEl)
			.addButton((b) =>
				b.setButtonText('从剪贴板读取').onClick(async () => {
					try {
						const t = await navigator.clipboard.readText();
						if (t && t.trim()) {
							ta.value = t;
						} else {
							new Notice('剪贴板是空的');
						}
					} catch (e) {
						new Notice('无法读取剪贴板，请手动粘贴');
					}
				})
			)
			.addButton((b) =>
				b.setCta().setButtonText('生成思维导图').onClick(() => {
					const v = ta.value.trim();
					if (!v) {
						new Notice('内容为空');
						return;
					}
					this.close();
					this.onSubmit(v, this.mode);
				})
			);

		ta.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}
