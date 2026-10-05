import { FMMNode, genId } from './types';

export type FMMCategory =
	| 'proof'
	| 'derivation'
	| 'example'
	| 'theorem'
	| 'definition'
	| 'note'
	| 'code';

export const CATEGORY_LABELS: Record<FMMCategory, string> = {
	proof: '证明',
	derivation: '推导',
	example: '例子',
	theorem: '定理',
	definition: '定义',
	note: '注意',
	code: '代码',
};

const KEYWORD_RULES: Array<{ cat: FMMCategory; re: RegExp }> = [
	{ cat: 'proof', re: /^(?:证明|证[:：]|proof\b|q\.?e\.?d\b)/i },
	{ cat: 'derivation', re: /^(?:推导|推算|求解|解题|化简|计算过程|计算|derivation|solution\b)/i },
	{ cat: 'example', re: /^(?:例子|例题|举例|例[\s\d：:.、(（]|example\b|e\.?g\.\s*[:：]?)/i },
	{ cat: 'theorem', re: /^(?:定理|引理|命题|推论|theorem|lemma|proposition|corollary)/i },
	{ cat: 'definition', re: /^(?:定义|definition)/i },
	{ cat: 'note', re: /^(?:注意|提醒|备注|注[:：]|remark|note\b|caution|warning)/i },
	{ cat: 'code', re: /^(?:代码|code)/i },
];

interface Block {
	kind: 'heading' | 'math' | 'text' | 'code';
	text: string;
	gapBefore: boolean;
}

/** 把 \( \) 与 \[ \] 定界符统一成 $ 与 $$ */
function normalizeDelimiters(src: string): string {
	return src
		.replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner: string) => `$${inner}$`)
		.replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner: string) => `$$\n${inner}\n$$`);
}

function scanBlocks(src: string): Block[] {
	const lines = src.split(/\r?\n/);
	const blocks: Block[] = [];
	let buf: string[] = [];
	let mode: 'none' | 'math' | 'code' = 'none';
	let gapBefore = false;

	const flushText = () => {
		if (buf.join('').trim()) {
			blocks.push({ kind: 'text', text: buf.join('\n').trim(), gapBefore });
			gapBefore = false;
		}
		buf = [];
	};

	for (const line of lines) {
		if (mode === 'code') {
			buf.push(line);
			if (line.trim().startsWith('```')) {
				blocks.push({ kind: 'code', text: buf.join('\n').trim(), gapBefore });
				gapBefore = false;
				buf = [];
				mode = 'none';
			}
			continue;
		}
		if (mode === 'math') {
			buf.push(line);
			const joined = buf.join('\n').trim();
			if (line.trim().endsWith('$$') && joined.length > 4) {
				blocks.push({ kind: 'math', text: joined, gapBefore });
				gapBefore = false;
				buf = [];
				mode = 'none';
			}
			continue;
		}
		const t = line.trim();
		if (t.startsWith('```')) {
			flushText();
			mode = 'code';
			buf = [line];
			continue;
		}
		if (t.startsWith('$$')) {
			flushText();
			const inner = t.slice(2, -2).trim();
			if (t.endsWith('$$') && t.length > 4 && inner) {
				blocks.push({ kind: 'math', text: t, gapBefore });
				gapBefore = false;
			} else {
				buf = [line];
				mode = 'math';
			}
			continue;
		}
		if (/^#{1,6}\s/.test(t)) {
			flushText();
			blocks.push({ kind: 'heading', text: t, gapBefore });
			gapBefore = false;
			continue;
		}
		if (!t) {
			flushText();
			gapBefore = true;
			continue;
		}
		buf.push(line);
	}
	flushText();
	if (mode === 'math' && buf.join('').trim()) {
		blocks.push({ kind: 'math', text: buf.join('\n').trim(), gapBefore });
	}
	if (mode === 'code' && buf.join('').trim()) {
		blocks.push({ kind: 'code', text: buf.join('\n').trim(), gapBefore });
	}
	return blocks;
}

function cleanForDetect(line: string): string {
	return line
		.replace(/^#{1,6}\s*/, '')
		.replace(/^\s*(?:[-*+]|\d+[.、)])\s+/, '')
		.replace(/[*_`~>]/g, '')
		.trim();
}

function detectCategory(text: string): FMMCategory | null {
	const line = cleanForDetect(text.split(/\r?\n/)[0] ?? '');
	if (!line) return null;
	for (const rule of KEYWORD_RULES) {
		if (rule.re.test(line)) return rule.cat;
	}
	return null;
}

function truncate(s: string, n: number): string {
	const line = (s.split(/\r?\n/)[0] ?? '').trim();
	return line.length > n ? line.slice(0, n) + '…' : line;
}

function mathInner(blockText: string): string {
	let s = blockText.trim();
	if (s.startsWith('$$')) s = s.slice(2);
	if (s.endsWith('$$')) s = s.slice(0, -2);
	return s.trim();
}

function makeGroup(label: string, cat: FMMCategory, parentId: string): FMMNode {
	return {
		id: genId(),
		parent: parentId,
		x: 0,
		y: 0,
		latex: '',
		type: 'group',
		category: cat,
		label,
		collapsed: true,
	};
}

/**
 * 按内容估算文字节点的合适宽度：按「。！？；」切句，取最长句估宽，
 * 让换行基本落在句子边界上，避免出现太窄的碎框。
 */
export function suggestTextWidth(body: string): number {
	const cleaned = body.replace(/\s+/g, '').replace(/[*#`>\\|]/g, '');
	const sentences = cleaned.split(/[。！？；!?;]/).filter(Boolean);
	let longest = 0;
	for (const s of sentences) longest = Math.max(longest, s.length);
	const width = Math.round(longest * 13.5 + 36);
	return Math.min(560, Math.max(180, width));
}

function makeText(body: string, parentId: string, labelMax = 60): FMMNode {
	const node: FMMNode = {
		id: genId(),
		parent: parentId,
		x: 0,
		y: 0,
		latex: '',
		type: 'text',
		label: truncate(body, labelMax),
		body,
	};
	if (body.replace(/\s/g, '').length > 24) node.w = suggestTextWidth(body);
	return node;
}

export interface AIAnswerParseResult {
	rootId: string;
	nodes: FMMNode[];
}

/**
 * 把 AI 回答（Markdown + LaTeX）解析成导图节点（树状）：
 * - 独立的 $$ 公式块 → 核心公式节点（formula）
 * - 以「证明/推导/例子/定理/注意/代码」等开头的段落或标题 → 分组节点（group），
 *   组内每个段落/公式再拆成分组的孩子节点，实现层层展开
 * - 其余文字 → 文字节点（text）
 */
export function parseAIAnswer(raw: string): AIAnswerParseResult | null {
	const src = normalizeDelimiters((raw ?? '').trim());
	if (!src) return null;
	const blocks = scanBlocks(src);

	let title = '';
	let startIdx = 0;
	if (blocks.length && blocks[0].kind === 'heading' && /^#\s/.test(blocks[0].text)) {
		title = blocks[0].text.replace(/^#\s*/, '');
		startIdx = 1;
	} else {
		const firstTextIdx = blocks.findIndex((b) => b.kind === 'text');
		if (firstTextIdx >= 0) {
			const b = blocks[firstTextIdx];
			title = truncate(b.text, 40);
			if (!b.text.includes('\n') && b.text.length <= 40) startIdx = firstTextIdx + 1;
		}
	}
	if (!title) title = 'AI 回答';

	const root: FMMNode = {
		id: genId(),
		parent: null,
		x: 0,
		y: 0,
		latex: '',
		type: 'text',
		label: title,
		body: title,
	};
	const nodes: FMMNode[] = [root];
	let openGroup: FMMNode | null = null;
	const closeGroup = () => {
		openGroup = null;
	};

	for (let i = startIdx; i < blocks.length; i++) {
		const b = blocks[i];
		if (b.kind === 'heading') {
			const label = b.text.replace(/^#{1,6}\s*/, '');
			const level = (b.text.match(/^#+/) ?? ['#'])[0].length;
			const cat = detectCategory(b.text);
			if (cat) {
				const g = makeGroup(label, cat, root.id);
				nodes.push(g);
				openGroup = g;
			} else if (level >= 3 && openGroup) {
				// 三级以下的小标题并入当前分组，不打断
				nodes.push(makeText(b.text, openGroup.id, 40));
			} else {
				closeGroup();
				nodes.push(makeText(label, root.id, 60));
			}
			continue;
		}
		if (b.kind === 'math') {
			const inner = mathInner(b.text);
			if (!inner) continue;
			if (openGroup && !b.gapBefore) {
				nodes.push({ id: genId(), parent: openGroup.id, x: 0, y: 0, latex: inner, type: 'formula' });
				continue;
			}
			closeGroup();
			nodes.push({ id: genId(), parent: root.id, x: 0, y: 0, latex: inner, type: 'formula' });
			continue;
		}
		if (b.kind === 'code') {
			if (openGroup && !b.gapBefore) {
				nodes.push(makeText(b.text, openGroup.id, 20));
				continue;
			}
			closeGroup();
			const g = makeGroup(CATEGORY_LABELS.code, 'code', root.id);
			nodes.push(g);
			nodes.push(makeText(b.text, g.id, 20));
			openGroup = g;
			continue;
		}
		// text 段落
		const cat = detectCategory(b.text);
		if (cat) {
			const g = makeGroup(truncate(b.text, 30), cat, root.id);
			nodes.push(g);
			// 开组的这段文字本身作为组的第一个孩子，避免内容丢失
			nodes.push(makeText(b.text, g.id));
			openGroup = g;
			continue;
		}
		if (openGroup) {
			nodes.push(makeText(b.text, openGroup.id));
			continue;
		}
		nodes.push(makeText(b.text, root.id));
	}

	if (nodes.length === 1) {
		nodes.push(makeText(src, root.id, 80));
	}
	return { rootId: root.id, nodes };
}
