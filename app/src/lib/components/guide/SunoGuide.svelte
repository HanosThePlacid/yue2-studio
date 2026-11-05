<script lang="ts">
	import CopyBlock from '$lib/components/CopyBlock.svelte';
</script>

<section>
	<p class="muted">
		Suno is a hosted tool, and its features change between versions and plans. These tips follow how Custom mode generally works
		(Style field plus Lyrics field). Check the current Suno UI for exact limits.
	</p>

	<h2>1. Split the two fields correctly</h2>
	<ul>
		<li><strong>Style of Music:</strong> global sound. Genre, era, BPM, key instruments, vocal type, mood, production. Front-load the most important words, because earlier tags weigh more.</li>
		<li><strong>Lyrics:</strong> words <em>plus</em> meta tags in <code>[square brackets]</code>. Anything in brackets is an instruction and is not sung.</li>
		<li>Anything in <code>(parentheses)</code> inside the lyrics usually <em>is</em> sung, as backing vocals, echoes, or ad-libs. Use parentheses for <code>(hallelujah)</code>, not for directions.</li>
	</ul>
	<CopyBlock label="Style of Music" text="cinematic worship rock, 76 BPM, deep male lead vocal, choir, piano, strings, pounding toms, emotional build, stadium reverb" />

	<h2>2. Give one section its own vocal style or instrument</h2>
	<p>
		Put the direction <em>inside the section tag</em>, after a colon or dash. Suno applies it to that section only, on top of the global style.
		This is the main trick for "whisper the verse, choir on the chorus, violin solo in the bridge".
	</p>
	<CopyBlock
		label="Lyrics field"
		text={`[Intro: solo cello, no drums]

[Verse 1: whispered male vocal, fingerpicked acoustic guitar]
Mondom néktek, bizony...
Kövekkel támad rám...

[Pre-Chorus: rising strings, building drums]
...

[Chorus: full choir, powerful belting, big drums]
Kemény ez a beszéd, ki hallgathatja hát?
(ki hallgathatja hát?)

[Verse 2: rap verse, trap hi-hats]
...

[Bridge: spoken word, ambient pads only]
...

[Instrumental: violin solo]

[Final Chorus: key change, choir and orchestra]
...

[Outro: fade out, piano only]
[End]`}
	/>
	<table>
		<thead><tr><th>Goal</th><th>Tag pattern that tends to work</th></tr></thead>
		<tbody>
			<tr><td>Vocal delivery for one part</td><td><code>[Verse: whispered]</code> <code>[Chorus: belted, gritty]</code> <code>[Verse 2: rap]</code> <code>[Bridge: spoken word]</code></td></tr>
			<tr><td>Who sings</td><td><code>[Verse: female vocal]</code> <code>[Chorus: duet]</code> <code>[Chorus: choir]</code> <code>[Verse: male and female call and response]</code></td></tr>
			<tr><td>Instrument feature</td><td><code>[Instrumental: violin solo]</code> <code>[Guitar Solo]</code> <code>[Piano Interlude]</code> <code>[Sax Solo]</code></td></tr>
			<tr><td>Energy shape</td><td><code>[Build]</code> <code>[Drop]</code> <code>[Breakdown]</code> <code>[Break]</code> <code>[Hook]</code></td></tr>
			<tr><td>Arrangement change</td><td><code>[Chorus: half-time]</code> <code>[Final Chorus: key change]</code> <code>[Verse: drums drop out]</code></td></tr>
			<tr><td>Clean ending</td><td><code>[Outro]</code> then <code>[Fade Out]</code> or <code>[End]</code> on its own line</td></tr>
		</tbody>
	</table>

	<h2>3. Small tricks</h2>
	<ul>
		<li>Keep tag directions short (1–4 descriptors). Long sentences in tags get ignored or sung.</li>
		<li>Stretch vowels to hold notes (<code>sooo-ul</code>, <code>haaa-le-lu-jah</code>). CAPS on a word adds emphasis or shouting.</li>
		<li>Put a blank line between sections, and keep verse lines a similar length.</li>
		<li>Say the language in the style (<code>Hungarian lyrics</code>) when you're not writing in English.</li>
		<li>
			Use the <strong>Exclude styles</strong> field (newer versions) for what you don't want, such as <code>autotune, female vocal</code>.
			This works better than writing "no X" in the style.
		</li>
		<li>If your version has <strong>Style Influence / Weirdness</strong> sliders, higher style influence follows your tags more strictly.</li>
		<li>
			<strong>Workflows:</strong> <em>Extend</em> continues from a timestamp, with new tags for the new part. <em>Replace section</em> regenerates one
			span. <em>Cover</em> keeps the melody in a new style. <em>Persona</em> reuses a voice across songs.
		</li>
	</ul>

	<h2>4. Suno ↔ YuE2 translation</h2>
	<table>
		<thead><tr><th>Suno</th><th>In YuE2 Studio</th></tr></thead>
		<tbody>
			<tr><td>Style of Music field</td><td>Style / tags field (same idea, same comma style). Also start with the language.</td></tr>
			<tr><td><code>[Verse]</code>, <code>[Chorus]</code>, <code>[Bridge]</code>…</td><td>Same tags, and they work.</td></tr>
			<tr><td><code>[Verse: whispered, piano only]</code></td><td>Partly. Put the tag on its own line, then a short <code>(whispered, piano only)</code> cue line. A softer effect, so try several seeds.</td></tr>
			<tr><td><code>[Instrumental: violin solo]</code></td><td>Use an empty <code>[Interlude]</code>. A solo instrument can't be chosen reliably, so mention it in the style prompt.</td></tr>
			<tr><td>(backing vocals in parentheses)</td><td>May be sung, skipped, or read as a cue. Varies by seed.</td></tr>
			<tr><td>Exclude styles</td><td>Not supported. Leave the unwanted thing out of the prompt instead.</td></tr>
			<tr><td>Extend / Replace section / Cover / Persona</td><td>Not supported. Regenerate with a pinned seed and edited text.</td></tr>
			<tr><td>Style Influence slider</td><td>Roughly the <strong>CFG scale</strong> (Advanced options).</td></tr>
			<tr><td>Song length</td><td><strong>Target length</strong> (Advanced options).</td></tr>
			<tr><td>Two variations per click</td><td><strong>New take</strong> on any card, or the Compare tab for style A/B tests.</td></tr>
		</tbody>
	</table>
</section>
