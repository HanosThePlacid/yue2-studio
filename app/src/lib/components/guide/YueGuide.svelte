<script lang="ts">
	import CopyBlock from '$lib/components/CopyBlock.svelte';
</script>

<section>
	<h2>What YuE2 is</h2>
	<p>
		YuE2 is an open lyrics-to-song model. It sings your lyrics in a style you describe as text, with the vocal
		and the backing track generated together as one full mix. Here it runs locally through
		<code>audiocpp_cli</code> on your GPU. The model is the 3B q4_0 GGUF, and nothing leaves your machine.
	</p>
	<ul>
		<li><strong>Input:</strong> two texts. A <em>style prompt</em> (genre, tempo, instruments, vocal, mood, mix) and <em>lyrics</em> with section tags.</li>
		<li><strong>Output:</strong> a stereo 48 kHz WAV in <code>output/</code>, typically 30 seconds to about 4 minutes.</li>
		<li><strong>Languages:</strong> it sings whatever language the lyrics are in. English and Chinese are strongest. Hungarian works, and naming the language first in the style helps (see Prompting).</li>
		<li>
			<strong>Speed:</strong> about 3× slower than real time on this setup (rtf ≈ 3.2). A 2-minute song takes about 6 minutes.
			The queue runs one song at a time, and the Generate tab shows progress live.
		</li>
	</ul>

	<h2>Controls in this app</h2>
	<table>
		<thead><tr><th>Control</th><th>What it does</th><th>When to touch it</th></tr></thead>
		<tbody>
			<tr>
				<td>Seed</td>
				<td>Fixes the randomness. Same seed with the same style and lyrics gives the same song.</td>
				<td>Pin a seed you like, then vary only the style to hear what a word changes. Use <em>New take</em> for a fresh seed.</td>
			</tr>
			<tr>
				<td>Planning mode (cot)</td>
				<td>
					<code>off</code> goes straight to audio (fastest). <code>melody</code> first writes a symbolic melody (ABC
					notation), and <code>full</code> also writes chords. Then it renders audio from that plan.
				</td>
				<td>Use <code>melody</code> for singable, structured tunes such as hymns and worship songs. Use <code>off</code> for quick sketches. Long or sparse lyrics make planning much slower.</td>
			</tr>
			<tr>
				<td>CFG scale</td>
				<td>How strictly it follows the prompt. The default is 1.01 with cot off and 1.0 otherwise. Range is 0–20.</td>
				<td>Raise it slightly (1.5–3) if it ignores your style. Lower it if the result sounds stiff or distorted.</td>
			</tr>
			<tr>
				<td>Target length</td>
				<td>Sets the min and max semantic tokens (≈ 0.04 s each). The model default range is 200–9000 tokens.</td>
				<td>Set it for short tests (20–60 s), or when the song keeps ending early or running on.</td>
			</tr>
		</tbody>
	</table>

	<h2>What it can't do (here)</h2>
	<ul>
		<li>Voice cloning, named artist voices, or "sound like X". Describe the voice instead.</li>
		<li>Uploading audio to extend, cover, or remix. Every generation starts from scratch.</li>
		<li>Separate stems, or editing one section in place. To change one part, regenerate with the same seed and tweak the text.</li>
		<li>
			Exact per-section instrumentation. The style prompt applies to the whole song. Section tags and
			parenthetical cues in the lyrics nudge individual parts but aren't guaranteed (see Prompting).
		</li>
	</ul>

	<h2>Recommended workflow</h2>
	<ol>
		<li>Draft a style and lyrics, then generate a <strong>30 s test</strong> with cot <code>off</code>.</li>
		<li>When the vibe is right, pin the seed and try 2–3 style variations. The <a href="/styles?tab=compare">Compare</a> tab does this side by side.</li>
		<li>Render the full length with cot <code>melody</code>. Flag the keepers (<code>keeper</code>, <code>final</code>) so the Gallery can find them.</li>
		<li>Save a style that works as a <a href="/styles">preset</a>, or keep it as a <code>song-prompts/*.md</code> file. Both show up here.</li>
	</ol>

	<h2>Raw CLI equivalent</h2>
	<CopyBlock
		text={`audiocpp_cli --task gen --family yue2 --model models/Yue2-3B-GGUF --backend cuda \\
  --session-option yue2.model_gguf=yue2-3b-q4_0.gguf \\
  --lyrics "[Verse]\\n..." \\
  --request-option style="Hungarian, worship ballad, 72 BPM, piano, warm male vocal" \\
  --request-option cot=melody --seed 831001 --out song.wav --metrics`}
	/>
</section>
