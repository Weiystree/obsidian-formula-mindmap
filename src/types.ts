export interface FMMNode {
	id: string;
	parent: string | null;
	x: number;
	y: number;
	latex: string;
}

export interface FMMData {
	version: 1;
	nodes: FMMNode[];
}

export const DEFAULT_ROOT_LATEX = '\\text{中心主题}';

export function genId(): string {
	try {
		const c: any = typeof crypto !== 'undefined' ? crypto : null;
		if (c?.randomUUID) return c.randomUUID().slice(0, 8);
	} catch (e) {
		/* ignore */
	}
	return Math.random().toString(36).slice(2, 10);
}

export function emptyData(): FMMData {
	return {
		version: 1,
		nodes: [{ id: genId(), parent: null, x: 0, y: 0, latex: DEFAULT_ROOT_LATEX }],
	};
}

export const DEFAULT_DATA_JSON = JSON.stringify(emptyData());

export function serializeData(data: FMMData): string {
	return JSON.stringify(data);
}

/** 解析代码块内容；非法时返回 null */
export function parseData(src: string): FMMData | null {
	try {
		const raw = JSON.parse(src.trim());
		if (!raw || !Array.isArray(raw.nodes)) return null;
		const seen = new Set<string>();
		const nodes: FMMNode[] = [];
		for (const n of raw.nodes) {
			if (!n || typeof n.id !== 'string' || !n.id) continue;
			if (seen.has(n.id)) continue;
			seen.add(n.id);
			nodes.push({
				id: n.id,
				parent: typeof n.parent === 'string' && n.parent ? n.parent : null,
				x: Number(n.x) || 0,
				y: Number(n.y) || 0,
				latex: typeof n.latex === 'string' ? n.latex : '',
			});
		}
		const ids = new Set(nodes.map((n) => n.id));
		for (const n of nodes) if (n.parent && !ids.has(n.parent)) n.parent = null;
		if (nodes.length === 0) return emptyData();
		return { version: 1, nodes };
	} catch (e) {
		return null;
	}
}

/** 从整篇笔记文本中提取 ```fmm 代码块内容 */
export function extractBlock(text: string): string | null {
	const m = /```fmm[^\S\n]*\n([\s\S]*?)\n?```/.exec(text);
	return m ? m[1] : null;
}

/** 把 JSON 写回笔记文本中的 fmm 代码块（没有则追加到末尾） */
export function replaceBlock(text: string, json: string): string {
	const block = '```fmm\n' + json + '\n```';
	const re = /```fmm[^\S\n]*\n[\s\S]*?\n?```/;
	if (re.test(text)) {
		return text.replace(re, () => block);
	}
	const base = text.trimEnd();
	return (base ? base + '\n\n' : '') + block + '\n';
}

/** maybeChildId 是否为 ancestorId 的后代 */
export function isDescendant(data: FMMData, maybeChildId: string, ancestorId: string): boolean {
	let cur = data.nodes.find((n) => n.id === maybeChildId);
	const guard = new Set<string>();
	while (cur && cur.parent && !guard.has(cur.parent)) {
		guard.add(cur.parent);
		if (cur.parent === ancestorId) return true;
		cur = data.nodes.find((n) => n.id === cur!.parent);
	}
	return false;
}

export function descendantsOf(data: FMMData, id: string): FMMNode[] {
	const out: FMMNode[] = [];
	const stack = [id];
	while (stack.length) {
		const cur = stack.pop()!;
		for (const n of data.nodes) {
			if (n.parent === cur) {
				out.push(n);
				stack.push(n.id);
			}
		}
	}
	return out;
}
