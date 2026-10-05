import {
	ItemView,
	Menu,
	MarkdownRenderer,
	Notice,
	TAbstractFile,
	TFile,
	ViewStateResult,
	WorkspaceLeaf,
} from 'obsidian';
import {
	descendantsOf,
	emptyData,
	extractBlock,
	FMMData,
	FMMNode,
	genId,
	isDescendant,
	parseData,
	replaceBlock,
	serializeData,
} from './types';
import { ConfirmModal, FormulaEditModal } from './edit-modal';

export const VIEW_TYPE_FMM = 'formula-mindmap-view';

type Gesture =
	| {
			kind: 'drag';
			id: string;
			startClientX: number;
			startClientY: number;
			startX: number;
			startY: number;
			moved: boolean;
	  }
	| {
			kind: 'pan';
			startClientX: number;
			startClientY: number;
			startTx: number;
			startTy: number;
			moved: boolean;
	  };

export class FormulaMindMapView extends ItemView {
	path = '';
	data: FMMData = { version: 1, nodes: [] };

	private canvasEl!: HTMLElement;
	private worldEl!: HTMLElement;
	private svgEl!: SVGSVGElement;
	private zoomLabelEl!: HTMLElement;
	private nodeEls = new Map<string, HTMLElement>();
	private renderTokens = new Map<string, number>();
	private scale = 1;
	private tx = 0;
	private ty = 0;
	private gesture: Gesture | null = null;
	private dropTargetId: string | null = null;
	private selectedId: string | null = null;
	private saveTimer: number | null = null;
	private dirty = false;
	private edgesScheduled = false;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_FMM;
	}

	getDisplayText(): string {
		return '公式思维导图';
	}

	getIcon(): string {
		return 'fmm-icon';
	}

	async setState(state: any, result: ViewStateResult): Promise<void> {
		if (state && typeof state.path === 'string') this.path = state.path;
		await super.setState(state, result);
	}

	getState(): any {
		return { ...super.getState(), path: this.path };
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('fmm-view-content');

		this.canvasEl = this.contentEl.createDiv('fmm-canvas');
		this.canvasEl.setAttribute('tabindex', '0');

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.classList.add('fmm-edges');
		this.svgEl = svg as unknown as SVGSVGElement;
		this.canvasEl.appendChild(this.svgEl);

		this.worldEl = this.canvasEl.createDiv('fmm-world');

		const hint = this.canvasEl.createDiv('fmm-hint');
		hint.setText(
			'双击空白：新建节点 · 双击节点：编辑公式 · Tab：添加子节点 · 右键：更多操作 · 拖到另一节点上：改变父子关系'
		);

		const zoom = this.canvasEl.createDiv('fmm-zoom');
		const btnOut = zoom.createEl('button', { text: '−' });
		btnOut.setAttribute('aria-label', '缩小');
		this.zoomLabelEl = zoom.createSpan('fmm-zoom-label');
		this.zoomLabelEl.setText('100%');
		const btnIn = zoom.createEl('button', { text: '+' });
		btnIn.setAttribute('aria-label', '放大');
		const btnFit = zoom.createEl('button', { text: '⤢' });
		btnFit.setAttribute('aria-label', '适应视图');
		btnOut.addEventListener('click', () => this.zoomBy(1 / 1.2));
		btnIn.addEventListener('click', () => this.zoomBy(1.2));
		btnFit.addEventListener('click', () => this.fitView());

		this.registerDomEvent(this.canvasEl, 'pointerdown', this.onPointerDown);
		this.registerDomEvent(this.canvasEl, 'pointermove', this.onPointerMove);
		this.registerDomEvent(this.canvasEl, 'pointerup', this.onPointerUp);
		this.registerDomEvent(this.canvasEl, 'pointercancel', this.onPointerCancel);
		this.registerDomEvent(this.canvasEl, 'dblclick', this.onDblClick);
		this.registerDomEvent(this.canvasEl, 'contextmenu', this.onContextMenu);
		this.registerDomEvent(this.canvasEl, 'wheel', this.onWheel, { passive: false });
		this.registerDomEvent(this.canvasEl, 'keydown', this.onKeyDown);

		this.registerEvent(this.app.vault.on('modify', this.onFileModify));
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (oldPath === this.path) this.path = file.path;
			})
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file.path === this.path) {
					new Notice('公式思维导图：笔记已被删除');
					this.leaf.detach();
				}
			})
		);

		await this.loadDataFromNote();
		await this.renderAll();
		requestAnimationFrame(() => this.fitView());
	}

	async onClose(): Promise<void> {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		if (this.dirty) {
			try {
				await this.saveNow();
			} catch (e) {
				/* ignore */
			}
		}
	}

	onResize(): void {
		this.scheduleEdges();
	}

	// ---------- 数据 ----------

	private async loadDataFromNote(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.path);
		if (file instanceof TFile) {
			const text = await this.app.vault.cachedRead(file);
			const block = extractBlock(text);
			const parsed = block ? parseData(block) : null;
			this.data = parsed ?? emptyData();
		} else {
			this.data = emptyData();
		}
	}

	private onFileModify = async (file: TAbstractFile): Promise<void> => {
		if (file.path !== this.path || this.dirty || this.gesture) return;
		const f = this.app.vault.getAbstractFileByPath(this.path);
		if (!(f instanceof TFile)) return;
		const text = await this.app.vault.cachedRead(f);
		const block = extractBlock(text);
		const parsed = block ? parseData(block) : null;
		if (!parsed) return;
		if (serializeData(parsed) === serializeData(this.data)) return;
		this.data = parsed;
		this.selectedId = null;
		await this.renderAll();
	};

	private scheduleSave(): void {
		this.dirty = true;
		if (this.saveTimer) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.saveNow();
		}, 600);
	}

	private async saveNow(): Promise<void> {
		this.dirty = false;
		const file = this.app.vault.getAbstractFileByPath(this.path);
		if (!(file instanceof TFile)) return;
		const json = serializeData(this.data);
		await this.app.vault.process(file, (text) => replaceBlock(text, json));
	}

	// ---------- 渲染 ----------

	private async renderAll(): Promise<void> {
		this.worldEl.replaceChildren();
		this.nodeEls.clear();
		const tasks: Promise<void>[] = [];
		for (const node of this.data.nodes) {
			this.createNodeEl(node);
			tasks.push(this.renderLatex(node.id, node.latex));
		}
		await Promise.all(tasks);
		this.updateEdges();
	}

	private createNodeEl(node: FMMNode): HTMLElement {
		const el = this.worldEl.createDiv('fmm-node');
		el.dataset.id = node.id;
		el.createDiv('fmm-node-content');
		const addBtn = el.createEl('button', { text: '+' });
		addBtn.addClass('fmm-node-add');
		addBtn.setAttribute('aria-label', '添加子节点');
		addBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (node.parent === null && !this.data.nodes.find((n) => n.id === node.id)) return;
			this.addChildNode(node.id);
		});
		this.nodeEls.set(node.id, el);
		this.positionNode(node);
		return el;
	}

	private async renderLatex(id: string, latex: string): Promise<void> {
		const el = this.nodeEls.get(id);
		if (!el) return;
		const token = (this.renderTokens.get(id) ?? 0) + 1;
		this.renderTokens.set(id, token);
		const content = el.querySelector('.fmm-node-content') as HTMLElement | null;
		if (!content) return;
		content.empty();
		content.removeClass('fmm-muted');
		content.removeClass('fmm-raw');
		const src = latex.trim();
		if (!src) {
			content.setText('（双击输入公式）');
			content.addClass('fmm-muted');
			this.scheduleEdges();
			return;
		}
		try {
			await MarkdownRenderer.render(this.app, '$$' + src + '$$', content, this.path, this);
		} catch (e) {
			content.setText(src);
			content.addClass('fmm-raw');
		}
		if (this.renderTokens.get(id) !== token) return;
		this.scheduleEdges();
	}

	private positionNode(node: FMMNode): void {
		const el = this.nodeEls.get(node.id);
		if (!el) return;
		el.style.left = node.x + 'px';
		el.style.top = node.y + 'px';
	}

	private nodeSize(node: FMMNode): { w: number; h: number } {
		const el = this.nodeEls.get(node.id);
		if (el) return { w: el.offsetWidth, h: el.offsetHeight };
		return { w: 120, h: 50 };
	}

	private scheduleEdges(): void {
		if (this.edgesScheduled) return;
		this.edgesScheduled = true;
		requestAnimationFrame(() => {
			this.edgesScheduled = false;
			this.updateEdges();
		});
	}

	private updateEdges(): void {
		const svg = this.svgEl;
		svg.replaceChildren();
		const NS = 'http://www.w3.org/2000/svg';
		for (const node of this.data.nodes) {
			if (!node.parent) continue;
			const parent = this.data.nodes.find((n) => n.id === node.parent);
			if (!parent) continue;
			const ps = this.nodeSize(parent);
			const cs = this.nodeSize(node);
			const x1 = parent.x + ps.w / 2;
			const y1 = parent.y + ps.h / 2;
			const x2 = node.x + cs.w / 2;
			const y2 = node.y + cs.h / 2;
			const dx = (x2 - x1) / 2;
			const path = document.createElementNS(NS, 'path');
			path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
			if (node.id === this.selectedId || node.parent === this.selectedId) {
				path.classList.add('fmm-edge-selected');
			}
			svg.appendChild(path);
		}
	}

	private applyTransform(): void {
		const t = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
		this.worldEl.style.transform = t;
		this.svgEl.style.transform = t;
		this.canvasEl.style.backgroundSize = `${24 * this.scale}px ${24 * this.scale}px`;
		this.canvasEl.style.backgroundPosition = `${this.tx}px ${this.ty}px`;
		this.zoomLabelEl.setText(Math.round(this.scale * 100) + '%');
	}

	// ---------- 交互 ----------

	private onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement | null;
		if (!target || typeof target.closest !== 'function') return;
		if (target.closest('.fmm-zoom') || target.closest('.fmm-node-add')) return;
		this.canvasEl.focus({ preventScroll: true });

		const nodeEl = target.closest('.fmm-node') as HTMLElement | null;
		if (nodeEl?.dataset.id) {
			const id = nodeEl.dataset.id;
			const node = this.data.nodes.find((n) => n.id === id);
			if (!node) return;
			this.select(id);
			this.gesture = {
				kind: 'drag',
				id,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startX: node.x,
				startY: node.y,
				moved: false,
			};
		} else {
			this.gesture = {
				kind: 'pan',
				startClientX: e.clientX,
				startClientY: e.clientY,
				startTx: this.tx,
				startTy: this.ty,
				moved: false,
			};
			this.canvasEl.addClass('fmm-panning');
		}
		try {
			this.canvasEl.setPointerCapture(e.pointerId);
		} catch (err) {
			/* ignore */
		}
	};

	private onPointerMove = (e: PointerEvent): void => {
		const g = this.gesture;
		if (!g) return;
		const dxScreen = e.clientX - g.startClientX;
		const dyScreen = e.clientY - g.startClientY;
		if (!g.moved && Math.abs(dxScreen) + Math.abs(dyScreen) > 3) {
			g.moved = true;
			if (g.kind === 'drag') {
				const el = this.nodeEls.get(g.id);
				if (el) {
					el.addClass('fmm-dragging');
					el.style.pointerEvents = 'none';
				}
			}
		}
		if (!g.moved) return;
		if (g.kind === 'pan') {
			this.tx = g.startTx + dxScreen;
			this.ty = g.startTy + dyScreen;
			this.applyTransform();
		} else {
			const node = this.data.nodes.find((n) => n.id === g.id);
			if (!node) return;
			node.x = g.startX + dxScreen / this.scale;
			node.y = g.startY + dyScreen / this.scale;
			this.positionNode(node);
			this.scheduleEdges();
			this.updateDropTarget(g.id, e);
		}
	};

	private onPointerUp = (e: PointerEvent): void => {
		const g = this.gesture;
		this.gesture = null;
		this.canvasEl.removeClass('fmm-panning');
		if (!g) return;
		try {
			this.canvasEl.releasePointerCapture(e.pointerId);
		} catch (err) {
			/* ignore */
		}
		if (g.kind === 'pan') {
			if (!g.moved) this.select(null);
			return;
		}
		const el = this.nodeEls.get(g.id);
		if (el) {
			el.removeClass('fmm-dragging');
			el.style.pointerEvents = '';
		}
		if (g.moved) this.scheduleSave();
		if (this.dropTargetId) {
			const target = this.dropTargetId;
			this.clearDropTarget();
			const node = this.data.nodes.find((n) => n.id === g.id);
			if (node && target !== g.id && !isDescendant(this.data, target, g.id)) {
				if (node.parent !== target) {
					node.parent = target;
					this.updateEdges();
					this.scheduleSave();
					new Notice('已调整父子关系');
				}
			}
		} else {
			this.clearDropTarget();
		}
	};

	private onPointerCancel = (): void => {
		this.gesture = null;
		this.canvasEl.removeClass('fmm-panning');
		this.clearDropTarget();
	};

	private clearDropTarget(): void {
		if (this.dropTargetId) {
			this.nodeEls.get(this.dropTargetId)?.removeClass('fmm-drop-target');
		}
		this.dropTargetId = null;
	}

	private updateDropTarget(dragId: string, e: PointerEvent): void {
		const hit = this.nodeAtClientPoint(e);
		let tid: string | null = null;
		if (hit && hit !== dragId && !isDescendant(this.data, hit, dragId)) tid = hit;
		if (tid === this.dropTargetId) return;
		if (this.dropTargetId) this.nodeEls.get(this.dropTargetId)?.removeClass('fmm-drop-target');
		this.dropTargetId = tid;
		if (tid) this.nodeEls.get(tid)?.addClass('fmm-drop-target');
	}

	private nodeAtClientPoint(e: PointerEvent): string | null {
		const els = document.elementsFromPoint(e.clientX, e.clientY);
		for (const el of els) {
			const nodeEl = (el as HTMLElement).closest?.('.fmm-node') as HTMLElement | null;
			if (nodeEl?.dataset.id) return nodeEl.dataset.id;
		}
		return null;
	}

	private onDblClick = (e: MouseEvent): void => {
		const target = e.target as HTMLElement | null;
		if (!target || typeof target.closest !== 'function') return;
		if (target.closest('.fmm-zoom')) return;
		e.preventDefault();
		const nodeEl = target.closest('.fmm-node') as HTMLElement | null;
		if (nodeEl?.dataset.id) {
			this.openEditor(nodeEl.dataset.id);
			return;
		}
		const { x, y } = this.screenToWorld(e.clientX, e.clientY);
		const node: FMMNode = { id: genId(), parent: null, x, y, latex: '' };
		this.data.nodes.push(node);
		this.createNodeEl(node);
		this.select(node.id);
		void this.renderLatex(node.id, node.latex);
		this.updateEdges();
		this.scheduleSave();
		this.openEditor(node.id);
	};

	private onContextMenu = (e: MouseEvent): void => {
		e.preventDefault();
		const target = e.target as HTMLElement | null;
		if (!target || typeof target.closest !== 'function') return;
		const menu = new Menu();
		const nodeEl = target.closest('.fmm-node') as HTMLElement | null;
		if (nodeEl?.dataset.id) {
			const id = nodeEl.dataset.id;
			menu.addItem((item) =>
				item.setTitle('编辑公式').setIcon('pencil').onClick(() => this.openEditor(id))
			);
			menu.addItem((item) =>
				item.setTitle('添加子节点').setIcon('plus').onClick(() => this.addChildNode(id))
			);
			menu.addSeparator();
			menu.addItem((item) =>
				item.setTitle('删除节点').setIcon('trash-2').onClick(() => this.deleteNode(id))
			);
		} else {
			menu.addItem((item) =>
				item.setTitle('新建根节点').setIcon('plus').onClick(() => {
					const { x, y } = this.screenToWorld(e.clientX, e.clientY);
					const node: FMMNode = { id: genId(), parent: null, x, y, latex: '' };
					this.data.nodes.push(node);
					this.createNodeEl(node);
					this.select(node.id);
					void this.renderLatex(node.id, node.latex);
					this.updateEdges();
					this.scheduleSave();
					this.openEditor(node.id);
				})
			);
			menu.addItem((item) =>
				item.setTitle('适应视图').setIcon('maximize').onClick(() => this.fitView())
			);
		}
		menu.showAtMouseEvent(e);
	};

	private onWheel = (e: WheelEvent): void => {
		e.preventDefault();
		const factor = Math.exp(-e.deltaY * 0.0015);
		this.zoomAt(e.clientX, e.clientY, factor);
	};

	private onKeyDown = (e: KeyboardEvent): void => {
		if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
			e.preventDefault();
			this.deleteNode(this.selectedId);
		} else if (e.key === 'Escape') {
			this.select(null);
		} else if (e.key === 'Enter' && this.selectedId) {
			e.preventDefault();
			this.openEditor(this.selectedId);
		} else if (e.key === 'Tab' && this.selectedId) {
			e.preventDefault();
			this.addChildNode(this.selectedId);
		}
	};

	// ---------- 操作 ----------

	private select(id: string | null): void {
		if (this.selectedId === id) return;
		if (this.selectedId) this.nodeEls.get(this.selectedId)?.removeClass('fmm-selected');
		this.selectedId = id;
		if (id) this.nodeEls.get(id)?.addClass('fmm-selected');
		this.updateEdges();
	}

	private openEditor(id: string): void {
		const node = this.data.nodes.find((n) => n.id === id);
		if (!node) return;
		new FormulaEditModal(this.app, node.latex, (latex) => {
			node.latex = latex;
			void this.renderLatex(id, latex);
			this.scheduleSave();
		}).open();
	}

	private addChildNode(parentId: string): void {
		const parent = this.data.nodes.find((n) => n.id === parentId);
		if (!parent) return;
		const siblingCount = this.data.nodes.filter((n) => n.parent === parentId).length;
		const ps = this.nodeSize(parent);
		const node: FMMNode = {
			id: genId(),
			parent: parentId,
			x: parent.x + ps.w + 90,
			y: parent.y + siblingCount * 70,
			latex: '',
		};
		this.data.nodes.push(node);
		this.createNodeEl(node);
		this.select(node.id);
		void this.renderLatex(node.id, node.latex);
		this.updateEdges();
		this.scheduleSave();
		this.openEditor(node.id);
	}

	private deleteNode(id: string): void {
		const node = this.data.nodes.find((n) => n.id === id);
		if (!node) return;
		const victims = [node, ...descendantsOf(this.data, id)];
		new ConfirmModal(
			this.app,
			'删除节点',
			`将删除该节点及其 ${victims.length - 1} 个子节点，确定吗？`,
			'删除',
			() => {
				const ids = new Set(victims.map((v) => v.id));
				this.data.nodes = this.data.nodes.filter((n) => !ids.has(n.id));
				for (const vid of ids) {
					this.nodeEls.get(vid)?.remove();
					this.nodeEls.delete(vid);
					this.renderTokens.delete(vid);
				}
				if (this.selectedId && ids.has(this.selectedId)) this.selectedId = null;
				if (this.data.nodes.length === 0) {
					const root = emptyData().nodes[0];
					this.data.nodes.push(root);
					this.createNodeEl(root);
					void this.renderLatex(root.id, root.latex);
				}
				this.updateEdges();
				this.scheduleSave();
			}
		).open();
	}

	// ---------- 视图变换 ----------

	private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
		const rect = this.canvasEl.getBoundingClientRect();
		return {
			x: (clientX - rect.left - this.tx) / this.scale,
			y: (clientY - rect.top - this.ty) / this.scale,
		};
	}

	private zoomAt(clientX: number, clientY: number, factor: number): void {
		const rect = this.canvasEl.getBoundingClientRect();
		const mx = clientX - rect.left;
		const my = clientY - rect.top;
		const newScale = Math.min(3, Math.max(0.2, this.scale * factor));
		if (newScale === this.scale) return;
		const k = newScale / this.scale;
		this.tx = mx - k * (mx - this.tx);
		this.ty = my - k * (my - this.ty);
		this.scale = newScale;
		this.applyTransform();
	}

	private zoomBy(factor: number): void {
		const rect = this.canvasEl.getBoundingClientRect();
		this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
	}

	private fitView(): void {
		const nodes = this.data.nodes;
		if (!nodes.length) return;
		const rect = this.canvasEl.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const n of nodes) {
			const s = this.nodeSize(n);
			minX = Math.min(minX, n.x);
			minY = Math.min(minY, n.y);
			maxX = Math.max(maxX, n.x + s.w);
			maxY = Math.max(maxY, n.y + s.h);
		}
		const pad = 80;
		const bw = Math.max(maxX - minX, 1);
		const bh = Math.max(maxY - minY, 1);
		const k = Math.min((rect.width - pad) / bw, (rect.height - pad) / bh, 1);
		this.scale = Math.max(0.2, Math.min(1, k));
		this.tx = (rect.width - bw * this.scale) / 2 - minX * this.scale;
		this.ty = (rect.height - bh * this.scale) / 2 - minY * this.scale;
		this.applyTransform();
	}
}
