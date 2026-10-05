import { App, Modal, Notice, Setting } from 'obsidian';

export class ImportModal extends Modal {
	constructor(app: App, private onSubmit: (text: string) => void) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText('导入 AI 回答');
		this.contentEl.addClass('fmm-import-modal');
		this.contentEl
			.createEl('p', {
				text: '把 GPT 等 AI 的回答粘贴到下面（支持 Markdown 与 LaTeX），会自动保留核心公式，并把推导 / 证明 / 例子等内容折叠成不同颜色的分组框。',
			})
			.addClass('fmm-import-hint');

		const ta = this.contentEl.createEl('textarea');
		ta.addClass('fmm-import-textarea');
		ta.placeholder = '在此粘贴（Ctrl+V）…';

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
					this.onSubmit(v);
				})
			);

		ta.focus();
	}

	onClose() {
		this.contentEl.empty();
	}
}
