// Records the storyteller's and the White Rabbit's lines with ElevenLabs, one MP3 each, into voices/, and lists them
// in voices/index.json (which the game reads). Run it again after changing a line: only lines with no recording yet
// are made, and recordings of lines no longer in the game are removed.
//
//   node tools/make-voices.js --list     the lines and how many characters they come to; nothing is sent
//   node tools/make-voices.js            make the missing recordings (needs ELEVENLABS_API_KEY in .env or the environment)
//
// Only lines written out in full in index.html are recorded: speak('rabbit', '…'), speak('whitequeen', '…'), rabbitTip('…'), caption('…', ms, true),
// narrate('…'), voice('…') and voice('…', 'narrator' | 'rabbit'). Anything else is said in the device's own voice.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..'), out = path.join(root, 'voices');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const logic = html.slice(html.indexOf('<script id="logic">') + '<script id="logic">'.length);
const L = new Function('module', `${logic.slice(0, logic.indexOf('</script>'))}; return MazeLogic;`)({});

const TEXT = "'([^'\\n]+)'";
const SAID = [
  [new RegExp(`speak\\('rabbit',\\s*${TEXT}`, 'g'), 'rabbit'], [new RegExp(`rabbitTip\\(${TEXT}`, 'g'), 'rabbit'],
  [new RegExp(`voice\\(${TEXT},\\s*'rabbit'\\)`, 'g'), 'rabbit'], [new RegExp(`speak\\('whitequeen',\\s*${TEXT}`, 'g'), 'whitequeen'],
  [new RegExp(`caption\\(${TEXT},\\s*\\d+,\\s*true\\)`, 'g'), 'narrator'], [new RegExp(`narrate\\(${TEXT}\\)`, 'g'), 'narrator'],
  [new RegExp(`voice\\(${TEXT}(?:,\\s*'narrator')?\\)`, 'g'), 'narrator'],
];
const lines = new Map();   // a recording's name → { who, words }
for (const [pattern, who] of SAID) {
  for (const [, text] of html.matchAll(pattern)) {
    const words = L.spokenWords(text);
    if (words) lines.set(L.voiceKey(who, words), { who, words });
  }
}

const count = (who) => [...lines.values()].filter((l) => l.who === who);
for (const who of Object.keys(L.RECORDED)) {
  console.log(`${who} (${L.RECORDED[who]}): ${count(who).length} lines, ${count(who).reduce((n, l) => n + l.words.length, 0)} characters`);
}
if (process.argv.includes('--list')) {
  for (const [name, { words }] of lines) console.log(`  ${name}  ${words}`);
  process.exit(0);
}

const env = fs.existsSync(path.join(root, '.env')) ? fs.readFileSync(path.join(root, '.env'), 'utf8') : '';
// (The key: ELEVENLABS_API_KEY, or any variable in .env named for ElevenLabs, or a line that is just the key itself.)
const key = process.env.ELEVENLABS_API_KEY
  || (env.match(/^\s*(?:export\s+)?\w*(?:ELEVEN|XI_API)\w*\s*[=:]\s*["']?([^"'\s]+)/im) || env.match(/^\s*(?:\w+\s*[=:]\s*)?["']?(sk_\w+)/m) || [])[1];
if (!key) {
  console.error('No ELEVENLABS_API_KEY found in .env or the environment.');
  process.exit(1);
}
const api = (url, options = {}) => fetch(`https://api.elevenlabs.io/v1/${url}`, { ...options, headers: { 'xi-api-key': key.trim(), 'content-type': 'application/json' } });

(async () => {
  fs.mkdirSync(out, { recursive: true });
  // The voices' ids: looked up by name in the account; a key that may only make speech (not list voices) uses
  // ElevenLabs' own ids for its stock voices instead.
  const STOCK = { Lily: 'pFZP5JQG7iQjIQuC4Bku', Gigi: 'jBpfuIE2acCO8z3wKNLl', Jenny: '7o3vIXfwm98KKuNfGmuY' };
  const list = await api('voices'), voices = list.ok ? (await list.json()).voices : [], ids = {};
  for (const [who, name] of Object.entries(L.RECORDED)) {
    const found = voices.find((v) => v.name.toLowerCase().startsWith(name.toLowerCase()));
    ids[who] = found ? found.voice_id : STOCK[name];
    if (!ids[who]) throw new Error(`No voice called ${name} in this account. Add it under "My Voices" on elevenlabs.io.`);
  }
  let made = 0;
  for (const [name, { who, words }] of lines) {
    const file = path.join(out, `${name}.mp3`);
    if (fs.existsSync(file)) continue;
    const res = await api(`text-to-speech/${ids[who]}?output_format=mp3_44100_64`, {
      method: 'POST', body: JSON.stringify({ text: words, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs said ${res.status} to "${words}": ${(await res.text()).slice(0, 200)}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`  recorded ${name}  ${words}`);
    made++;
  }
  let removed = 0;
  for (const file of fs.readdirSync(out)) {
    if (file.endsWith('.mp3') && !lines.has(file.slice(0, -4))) { fs.unlinkSync(path.join(out, file)); removed++; }
  }
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify([...lines.keys()].filter((name) => fs.existsSync(path.join(out, `${name}.mp3`))).sort(), null, 1)}\n`);
  console.log(`${made} recorded, ${removed} removed, ${lines.size} in voices/index.json`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
