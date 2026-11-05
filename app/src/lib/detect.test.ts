import { describe, expect, it } from 'vitest';
import { detectBpm, detectGenre, detectLanguage } from './detect';

describe('detectBpm', () => {
	it('reads the BPM number', () => expect(detectBpm('trap, 90 BPM, 808s')).toBe(90));
	it('is case-insensitive and tolerates no space', () => expect(detectBpm('edm 128bpm')).toBe(128));
	it('returns null when absent', () => expect(detectBpm('slow ballad')).toBeNull());
});

describe('detectLanguage', () => {
	it('detects Hungarian by ő/ű', () => expect(detectLanguage('[Verse]\nMielőtt Ábrahám lett')).toBe('hu'));
	it('detects Hungarian by accents without ő/ű', () =>
		expect(detectLanguage('Szent, szent, szent a Seregek Ura, dicsőség')).toBe('hu'));
	it('defaults to English', () =>
		expect(detectLanguage('[Chorus]\nHold on to the sound, let it carry you now.')).toBe('en'));
	it('ignores section tags', () => expect(detectLanguage('[Verse: whispered]\nWe move through the night')).toBe('en'));
});

describe('detectGenre', () => {
	it('skips vocal descriptors to find the genre token', () =>
		expect(detectGenre('solo male vocal, one singer only, rap, trap drums')).toBe('rap'));
	it('takes the first genre token', () =>
		expect(detectGenre('cinematic worship rock, epic anthem, 76 BPM')).toBe('cinematic worship rock'));
	it('falls back to the first token', () => expect(detectGenre('mysterious, dreamy')).toBe('mysterious'));
	it('handles empty input', () => expect(detectGenre('')).toBe('unknown'));
});
