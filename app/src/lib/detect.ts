// Metadata derived from free-text prompts. Shared by server (on write) and client (display).

export function detectBpm(style: string): number | null {
	const m = style.match(/(\d{2,3})\s*BPM/i);
	return m ? Number(m[1]) : null;
}

const HU_LETTERS = /[őűŐŰ]/;
const HU_ACCENTS = /[áéíóöúüÁÉÍÓÖÚÜ]/g;
const HU_WORDS = /\b(és|az|a|hogy|nem|van|én|te|ő|mi|ti|ők|Isten|Uram|szív|mert|de)\b/gi;

export function detectLanguage(lyrics: string): string {
	// Strip section tags like [Verse 1] so they don't skew the count.
	const text = lyrics.replace(/\[[^\]]*\]/g, ' ');
	if (HU_LETTERS.test(text)) return 'hu';
	const letters = text.replace(/[^\p{L}]/gu, '').length || 1;
	const accents = (text.match(HU_ACCENTS) ?? []).length;
	const words = (text.match(HU_WORDS) ?? []).length;
	if (accents / letters > 0.02 || words >= 5) return 'hu';
	return 'en';
}

const GENRE_WORDS =
	/(hip[\s-]?hop|rap|trap|drill|metal(core)?|rock|punk|pop|edm|house|techno|trance|dubstep|drum and bass|dnb|lo-?fi|synthwave|worship|gospel|hymn|ccm|choral|orchestral|cinematic|soundtrack|folk|country|blues|jazz|funk|soul|r&b|reggae|ballad|shanty|drone|chant|yodel|anthem|ambient|classical)/i;
const DESCRIPTOR_WORDS = /(hungarian|english|magyar|lyrics|language|vocal|voice|singer|singing|choir|bpm|mix|\bno\b|only|drums|bass\b|harmon|guitar|piano|strings|synth\b|male|female)/i;

/**
 * Genre = the first comma-separated token of the style that names a genre; falls back to the
 * first token that isn't a vocal/instrument/mix descriptor, then to the first token.
 */
export function detectGenre(style: string): string {
	const tokens = style
		.split(',')
		.map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
		.filter(Boolean);
	return (
		tokens.find((t) => GENRE_WORDS.test(t) && t.split(' ').length <= 5) ??
		tokens.find((t) => !DESCRIPTOR_WORDS.test(t)) ??
		tokens[0] ??
		'unknown'
	);
}

export const LANGUAGE_LABELS: Record<string, string> = {
	hu: 'Magyar',
	en: 'English',
	other: 'Other'
};
