import { describe, expect, it } from 'vitest';
import { parsePromptMarkdown, slugifyTitle } from './importer';

const MD = `# Epic Bass Metal — "Nightfall Oath"

Target length: 60s (set Target length in seconds = 60, Planning mode = melody)

Inspired by metal.

**Style prompt:**

\`\`\`
symphonic power metal, 140 BPM, deep bass male vocal
\`\`\`

**Lyrics:**

\`\`\`
[Intro]
By the oath
\`\`\`
`;

describe('parsePromptMarkdown', () => {
	it('extracts name, style, lyrics, hints and folder tag', () => {
		const p = parsePromptMarkdown(MD, 'Bass song/bass-epic-metal.md')!;
		expect(p.name).toBe('Epic Bass Metal — "Nightfall Oath"');
		expect(p.style).toBe('symphonic power metal, 140 BPM, deep bass male vocal');
		expect(p.default_lyrics).toBe('[Intro]\nBy the oath');
		expect(p.bpm).toBe(140);
		expect(p.cot).toBe('melody');
		expect(p.target_seconds).toBe(60);
		expect(p.tags).toEqual(['Bass song']);
		expect(p.notes).toContain('Inspired by metal.');
	});
	it('returns null without a Style prompt block', () => {
		expect(parsePromptMarkdown('# just notes', 'x.md')).toBeNull();
	});
	it('falls back to the file name for the title', () => {
		expect(parsePromptMarkdown(MD.replace(/^# .+$/m, ''), 'sajat-dal.md')!.name).toBe('sajat dal');
	});
});

describe('slugifyTitle', () => {
	it('matches the legacy python slug', () => {
		expect(slugifyTitle('Gyere Ki: 02?')).toBe('Gyere_Ki_02');
		expect(slugifyTitle('  ')).toBe('untitled');
	});
});
