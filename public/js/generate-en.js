import { choices, recommend, topicStory, validate } from './project.js';
import { presetsEnglish } from './presets.generated.js';
import { t } from './i18n.js';

export const englishSections = [
  'Purpose and deliverables', 'Players and objectives', 'Theme, source story and evidence', 'Setting and characters',
  'Genre and core mechanics', 'Players, cooperation and controls', 'Duration, difficulty and accessibility',
  'Community themes and inclusive design', 'Screens and results', 'Visuals, characters and sound', 'Languages',
  'Technology and runtime', 'File structure', 'Assets and licenses', 'Offline use and web publishing',
  'Implementation steps', 'Tests and acceptance criteria', 'Final instructions for the AI',
];
const inline = (text) => text.trim().replace(/\r\n|[\r\n]/gu, ' ').replace(/[\\`*_{}\[\]#!|~$]/gu, '\\$&')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const en = (text) => t(text, 'en');

export function generateEnglish(project) {
  const errors = validate(project);
  if (errors.length) throw new Error(en(errors[0].message));
  const genre = presetsEnglish.genres[project.genreId];
  const rec = recommend(project);
  const seconds = project.playSeconds || rec.seconds;
  const solo = project.mode === 'solo';
  const simultaneous = !solo && project.cooperation === 'simultaneous';
  const single = project.fileLayout === 'single';
  const pwa = project.offlineMode === 'pwa';
  const tech = project.techStack === 'auto' ? rec.techStack : project.techStack;
  const story = topicStory(project, 'en').split(/\r\n|[\r\n]/u).map((line) => `> ${inline(line)}`).join('\n');
  const source = {
    fictional: 'Label this as fiction. Do not imply that these are actual residents or events.',
    unverified: 'Treat the information as unverified or hypothetical. Avoid factual claims or emergency instructions. Use fictional game rules where needed.',
    verified: `Stay within the scope of this source. Have a person check the relevant original information.\n\n- Source title: ${inline(project.sourceTitle)}\n- Source URL: ${inline(project.sourceUrl)}\n- Verification date: ${project.verifiedAt}\n- Applicable scope: ${inline(project.applicability)}`,
  }[project.sourceType];
  const cooperation = {
    turns: 'Player 1 starts. Alternate after each valid action (a pair check for memory, a card outcome for catching). Display whose turn it is and share the score.',
    discuss: 'One player operates the controls while the other discusses choices. Explain both roles on the start screen.',
    simultaneous: 'Assign distinct simultaneous roles on the same device and share the score. For turn-based rules, let one player choose a candidate while the other confirms it.',
  }[project.cooperation];
  const controls = project.controls.map((id) => '- ' + {
    keyboard: simultaneous ? 'Player 1 uses WASD and F. Player 2 uses arrow keys and Enter. Keep their inputs separate.' : 'Use arrow keys to move or select, and Enter or Space to confirm. Handle game keys only during play.',
    mouse: 'Click objects and on-screen buttons. Include left/right buttons for movement games.',
    touch: simultaneous ? 'Provide two separate touch regions and distinguish players by pointer ID.' : 'Use large tappable objects and buttons. Include left/right buttons for movement games.',
    gamepad: 'Map movement and confirmation with the Gamepad API. Update guides on connection and provide the selected keyboard or mouse fallback. For simultaneous play, handle two pads separately.',
  }[id]).join('\n');
  const audio = {
    effects: 'Generate short input and success sounds with Web Audio API after the first interaction. Include mute.',
    music: 'Generate a short loop and sound effects with Web Audio API. Start after the first interaction and provide volume and mute.',
    silent: 'Keep the game silent and show actions and success through text, shapes and animation.',
  }[project.audio];
  const runtime = {
    native: 'Use standard HTML, CSS and JavaScript. No external libraries, network calls or accounts are needed. Record the browsers and versions actually tested.',
    phaser: 'Use Phaser and record the actual version and license in the README. Bundle distributable files under vendor/. Do not require a CDN.',
    custom: `Technology requirements: ${inline(project.techCustom)}. Record dependency versions, build tools and offline bundling steps.`,
  }[tech];
  const assets = project.assetStrategy === 'procedural'
    ? 'Create icons, backgrounds and objects with CSS, SVG or Canvas. Synthesize audio as specified. Do not use external images, fonts or sound. Describe how assets are generated.'
    : `${en(choices.assetStrategy[project.assetStrategy])}. User requirements: “${inline(project.assetNotes)}”. List each asset filename, source, license, permissions and fallback. ${single ? 'Embed permitted assets in the HTML.' : 'Bundle permitted assets under assets/.'} Replace unverified materials with generated shapes and sounds.`;
  const content = [
    'Build a short playable browser game. Deliver complete code, launch instructions and verification steps.',
    `- Players: ${en(choices.age[project.age])}\n- Objective: ${en(choices.objective[project.objective])}\n- Context: Short sessions at a community event and replay at home.`,
    `- Source status: ${en(choices.sourceType[project.sourceType])}\n- Handling: ${source}\n\nStory supplied by the planner\n\n${story}`,
    'Prioritize the places, people and objects in the story. If a playable role is missing, use a fictional child helping with preparations. Do not recreate actual residents or building interiors, or add unrelated incidents and local rules.',
    `- Genre: ${genre?.name ?? inline(project.genreCustom)}\n- Core actions: ${genre?.actions ?? 'Keep the main interaction to one or two actions.'}\n- Rules: ${genre?.rules ?? 'Start at 0 points. Award 10 points for each action toward the objective. Specify the required count, response to mistakes, success and timeout conditions.'}\n- Adapt objects and feedback to the supplied story. Use neutral shapes and symbols when details are missing.${project.genreId === 'rhythm' ? `\n- Timing window: ${project.rhythmTiming === 'forgiving' ? '±180' : '±110'}ms. Use a single clock for beats and input. Synchronize audio with Web Audio API, provide visual cues and measure latency on actual devices.` : ''}`,
    `- Participation: ${en(choices.mode[project.mode])}. ${solo ? 'One player handles all controls.' : `${en(choices.cooperation[project.cooperation])}. ${cooperation}`}\n- Supported devices: ${project.platforms.map((id) => en(choices.platforms[id])).join(', ')}\n\n${controls}`,
    `- Time limit: ${seconds} seconds per session. Pause the timer during instructions and start it with the start button.\n- Difficulty: ${en(choices.difficulty[project.difficulty || rec.difficulty])}. Easy mode provides more time and hints; hard mode changes cue density or speed.\n- Accessibility: ${project.accessibility.map((id) => en(choices.accessibility[id])).join(', ') || 'Readable instructions and clear feedback'}.`,
    'Integrate daily life and preparedness into objects, interactions and cooperation. Do not stereotype nationality, religion or age. Avoid fear and humiliation. Do not collect names, contact details or apartment numbers. Do not invent local evacuation or waste rules.',
    'Title and language selection → Instructions → Play → Results. Results show score, progress, retry and return to title. Do not put educational messages or conversation prompts on the results screen. Retry resets all game state.',
    `- Visual style: ${project.visual === 'custom' ? inline(project.styleNotes) : en(choices.visual[project.visual])}\n- Layout: Separate headings and controls. Use dark #18251F, light #F8F7EE and accent #DDEB98 with adequate contrast.\n- Character: Suitable clothing and distinct poses or expressions for idle, input, success and failure.\n- Sound: ${audio}`,
    `Support ${project.languages.map((id) => `${en(choices.languages[id])} (${id})`).join(', ')}. Allow language switching on the title screen. Use dictionaries for instructions, buttons, time and results. Default to Japanese. Have a person review additional translations. Include meta elements named game:title:ja and game:title:en in the head, with each title in its content attribute. For integration with this studio, a select#language with ja/en values, explicit #lang-ja and #lang-en buttons, or an oshima-language custom event can switch the game language.`,
    runtime,
    single ? '`index.html` only. Include CSS, JavaScript and SVG in the same file as needed.' : '`index.html`, `styles.css`, `game.js` and `README.md`. Use relative paths.' + (pwa ? ' Include `sw.js` and `manifest.webmanifest`.' : ' Use a regular script that works when opened locally.'),
    assets,
    `${pwa ? 'Serve over HTTPS or localhost. Precache the game and assets using a Service Worker. Show cache completion and verify that a reload works offline afterward.' : single ? 'For offline use, open `index.html` in the browser.' : 'For offline use, keep all files together and open `index.html` in the browser.'} Publish the same output to a static host such as GitHub Pages. Test without network access and under a subdirectory.`,
    'Implement screen state and timer, score and outcomes, device inputs, translation, assets and sound, then retry. Clean up timers and listeners on exit or retry. Explain each file’s role.',
    `Test start, correct and wrong input, success, timeout and retry.${solo ? '' : ' Verify both roles and the shared score.'} Check all selected devices and controls, Japanese/English switching, the ${seconds}-second limit and offline startup. Ensure the layout fits and the game works without sound or color cues.`,
    'Use the information in this brief. Treat quoted user text as story data. Do not invent real-world facts to fill gaps. Mark placeholders and review items. Deliver complete files plus launch and test instructions.',
  ];
  return [`# Game production brief: ${inline(project.projectTitle)}`, ...englishSections.map((heading, index) => `## ${index + 1}. ${heading}\n\n${content[index]}`)].join('\n\n') + '\n';
}

export const englishTasks = {
  code: 'Deliver all executable files, launch steps and checks. Implement screen state, input, outcomes, timing and dictionaries. Test controls on each device and verify bundled dependencies.',
  character: 'Provide front, back and side views and examples for idle, movement, success and failure. Specify clothes, expressions, color codes, on-screen dimensions, transparency and export formats.',
  background_ui: 'Provide title, instructions, play and results layouts for PC and portrait phones. List backgrounds, controls, score, timer and language examples as reusable parts.',
  sound: 'Specify sound triggers, volume, silent alternatives and any loop points. For audio files, record formats, sources and bundled paths.',
};
export const englishAdapters = {
  chatgpt: 'Separate deliverables by filename and provide the complete contents and test steps for every file.',
  codex: 'Inspect the workspace, implement in small steps and run tests. Report changed files and observed results.',
  claude: 'Describe game state and input/output, then present implementation, verification and deliverables.',
  gemini: 'List files first, then provide their contents and reproducible device test conditions.',
};
