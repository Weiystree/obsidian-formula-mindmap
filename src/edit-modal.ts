import { App, Component, MarkdownRenderer, Modal, Setting } from 'obsidian';

export class FormulaEditModal extends Modal {
	private timer: number | null = null;
	private previewEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	// Modal 本身不是 Component，公式渲染需要一个挂载用的 Component
	private renderComponent = new Component();

	constructor(app: App, private latex: string, private onSubmit: (latex: string) => void) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText('编辑公式');
		this.contentEl.addClass('fmm-edit-modal');

		const inputWrap = this.contentEl.createDiv('fmm-edit-input');
		this.inputEl = inputWrap.createEl('textarea');
		this.inputEl.value = this.latex;
		this.inputEl.placeholder = '例如：\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}';

		const previewWrap = this.contentEl.createDiv('fmm-edit-preview');
		previewWrap.createDiv('fmm-edit-preview-label').setText('预览');
		this.previewEl = previewWrap.createDiv('fmm-edit-preview-body');

		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('取消').onClick(() => this.close()))
			.addButton((b) => b.setCta().setButtonText('保存').onClick(() => this.save()));

		this.inputEl.addEventListener('input', () => this.updatePreview());
		this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.save();
			}
		});

		this.renderComponent.load();

		this.updatePreview();
		this.inputEl.focus();
		const len = this.inputEl.value.length;
		this.inputEl.setSelectionRange(len, len);
	}

	private updatePreview() {
		if (this.timer) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.previewEl.empty();
			const v = this.inputEl.value.trim();
			if (!v) {
				this.previewEl.setText('（空公式）');
				this.previewEl.addClass('fmm-muted');
				return;
			}
			this.previewEl.removeClass('fmm-muted');
			MarkdownRenderer.render(this.app, '$$' + v + '$$', this.previewEl, '', this.renderComponent).catch(
				() => {
					this.previewEl.setText(v);
				}
			);
		}, 150);
	}

	private save() {
		this.onSubmit(this.inputEl.value.trim());
		this.close();
	}

	onClose() {
		if (this.timer) window.clearTimeout(this.timer);
		this.contentEl.empty();
		this.renderComponent.unload();
	}
}

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		title: string,
		message: string,
		confirmLabel: string,
		private onConfirm: () => void
	) {
		super(app);
		this.titleEl.setText(title);
		this.contentEl.createEl('p', { text: message });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('取消').onClick(() => this.close()))
			.addButton((b) =>
				b.setWarning().setButtonText(confirmLabel).onClick(() => {
					this.close();
					this.onConfirm();
				})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
