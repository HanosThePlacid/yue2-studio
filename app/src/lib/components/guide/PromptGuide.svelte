<script lang="ts">
	import CopyBlock from '$lib/components/CopyBlock.svelte';

	const vocab: [string, string[]][] = [
		['Vocal', ['male vocal', 'female vocal', 'deep bass male vocal', 'choir', 'duet', 'falsetto', 'breathy', 'raspy', 'powerful belting', 'whispered', 'spoken word', 'rap verse', 'harmonized backing vocals', 'gang vocals']],
		['Genre', ['worship ballad', 'CCM', 'gospel', 'hymn', 'cinematic', 'orchestral', 'trap', 'boom bap', 'lo-fi hip hop', 'synthwave', 'indie pop', 'folk', 'metalcore', 'drum and bass', 'house']],
		['Mood', ['uplifting', 'triumphant', 'intimate', 'melancholic', 'haunting', 'dark', 'euphoric', 'nostalgic', 'tense', 'reverent']],
		['Instruments', ['piano', 'acoustic guitar', 'distorted electric guitar', 'strings', 'brass', 'organ', '808 bass', 'synth pads', 'arpeggiated synth', 'live drums', 'hand percussion', 'cello drone']],
		['Mix', ['polished radio-ready mix', 'warm analog', 'wide stereo', 'stadium reverb', 'raw live-room', 'lo-fi vinyl crackle', 'stripped-back']]
	];

	const tags: [string, string][] = [
		['[Intro]', 'Opening. Instrumental or a short vocal cold-open.'],
		['[Verse]', 'Story lines. New words each time.'],
		['[Pre-Chorus]', 'A short lift into the chorus.'],
		['[Chorus]', 'The hook. Repeat the same words each time so the melody repeats too.'],
		['[Bridge]', 'Contrast, usually once, before the last chorus.'],
		['[Interlude] / [Instrumental]', 'No lyrics under it. Lets the band breathe.'],
		['[Outro]', 'Closing and resolve.']
	];
</script>

<section>
	<h2>Style prompt formula</h2>
	<p>
		<strong>language → genre → BPM → instruments → vocal → mood → mix</strong>, comma-separated, most important first.
		There's no fixed tag list. The model reads it as plain text.
	</p>
	<CopyBlock label="English" text="English, cinematic worship rock, 76 BPM, piano, strings, pounding toms, deep powerful male vocal, choir on chorus, emotional, stadium reverb, radio-ready mix" />
	<CopyBlock label="Hungarian" text="Hungarian, majestic worship hymn, 72 BPM, church organ, strings, warm baritone male vocal, reverent, uplifting, wide stereo" />
	<ul>
		<li>Keep it to about 8–15 descriptors. More than that and the words start fighting each other.</li>
		<li>Give the BPM as a number (<code>90 BPM</code>) and a feel word (<code>laid-back</code>, <code>driving</code>). Together they work best.</li>
		<li>Say what you want, not what you don't. "No choir" tends to <em>add</em> choir.</li>
		<li>One lead vocal per prompt. Mixing <code>female vocal</code> and <code>male vocal</code> gives random switching unless you write a duet on purpose.</li>
	</ul>

	<h2>Lyrics and section tags</h2>
	<table>
		<thead><tr><th>Tag</th><th>Use</th></tr></thead>
		<tbody>
			{#each tags as [t, d] (t)}<tr><td><code>{t}</code></td><td>{d}</td></tr>{/each}
		</tbody>
	</table>
	<ul>
		<li>Put each tag on its own line and leave a blank line between sections.</li>
		<li>Aim for 4–8 lines per section and similar line lengths within a section. Even lines give an even melody.</li>
		<li>
			<strong>Steering one section:</strong> the style prompt covers the whole song, but YuE2 does react to cues in the lyrics.
			Put a short parenthetical on the first line of a section, like <code>(whispered, piano only)</code> or <code>(choir joins)</code>.
			You can also write the sound itself (<code>ooh</code>, <code>hey!</code>, yodel syllables). Results vary by seed, so try 2–3 seeds.
		</li>
		<li>An empty <code>[Interlude]</code> or <code>[Instrumental]</code> section is the most reliable way to get a gap with no vocals.</li>
	</ul>
	<CopyBlock
		label="Per-section cues"
		text={`[Intro]
(soft piano, no vocals)

[Verse]
(whispered, close to the mic)
Mondom néktek, bizony, mielőtt Ábrahám...

[Chorus]
(full choir joins, big drums)
Kemény ez a beszéd, ki hallgathatja hát?

[Interlude]

[Bridge]
(spoken word over strings)
...`}
	/>

	<h2>Hungarian lyrics</h2>
	<ul>
		<li>Start the style with <code>Hungarian,</code> so it doesn't drift into English-sounding pronunciation.</li>
		<li>
			Write in regular meter. <em>Felező nyolcas</em> (4|4) and <em>felező tizenkettes</em> (6|6) with the same syllable count on every line
			sing much more cleanly. The rules are in <code>magyarverselés/</code>.
		</li>
		<li>Strong end rhymes (<em>ragyog / vagyok</em>) give the model clear phrase endings.</li>
		<li>Avoid long quoted or bracketed text inside the lyrics. The model may sing the brackets' contents or skip them.</li>
	</ul>

	<h2>Vocabulary</h2>
	{#each vocab as [name, words] (name)}
		<div class="vocab">
			<span class="faint">{name}</span>
			<div class="row">{#each words as w (w)}<span class="chip">{w}</span>{/each}</div>
		</div>
	{/each}

	<h2>Tempo cheat sheet</h2>
	<table>
		<thead><tr><th>Feel</th><th>BPM</th></tr></thead>
		<tbody>
			<tr><td>Hymn / slow ballad</td><td>60–76</td></tr>
			<tr><td>Worship mid-tempo, lo-fi, R&amp;B</td><td>76–100</td></tr>
			<tr><td>Trap / hip hop (half-time feel)</td><td>70–95 or 140–160</td></tr>
			<tr><td>Pop / rock</td><td>100–128</td></tr>
			<tr><td>House / EDM</td><td>124–130</td></tr>
			<tr><td>Metal / punk</td><td>140–180</td></tr>
			<tr><td>Drum &amp; bass</td><td>170–175</td></tr>
		</tbody>
	</table>
</section>

<style>
	.vocab {
		display: grid;
		grid-template-columns: 90px 1fr;
		gap: 8px;
		margin: 6px 0;
		align-items: baseline;
	}
	.vocab .row {
		gap: 4px;
	}
	@media (max-width: 700px) {
		.vocab {
			grid-template-columns: 1fr;
		}
	}
</style>
