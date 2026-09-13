import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const action = process.argv[2] ?? 'capture';
const event = await new Promise((done) => {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    try {
      done(JSON.parse(input));
    } catch {
      done({});
    }
  });
});
const cwd = event.cwd ?? process.cwd();
let root = cwd;
try {
  root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
} catch {}
const safe = String(event.session_id ?? 'local').replaceAll(/[^A-Za-z0-9_.-]/g, '_');
const stateDir = resolve(root, '.codex/review-receipt');
const stateFile = resolve(stateDir, `${safe}.json`);
mkdirSync(stateDir, { recursive: true });
let state = { events: [], emitted: 0, baseline: [] };
if (existsSync(stateFile)) {
  try {
    state = JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {}
}
const redact = (value) =>
  String(value).replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,]+/gi, '$1=[REDACTED]');
const status = () => {
  try {
    return execFileSync('git', ['-C', root, 'status', '--short'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3))
      .filter((path) => path !== '.agent_history.md');
  } catch {
    return [];
  }
};
if (action === 'baseline') {
  state.baseline = status();
} else if (action === 'capture') {
  const entry = {
    event: event.hook_event_name,
    tool: event.tool_name,
    time: new Date().toISOString(),
  };
  if (event.hook_event_name === 'UserPromptSubmit')
    entry.prompt = redact(event.prompt ?? event.user_prompt ?? '');
  else if (['Bash', 'apply_patch'].includes(event.tool_name) && event.tool_input?.command) {
    entry.command = redact(event.tool_input.command);
    const code = event.tool_output?.exit_code ?? event.tool_response?.exit_code;
    entry.result = code === 0 ? 'Success' : Number.isInteger(code) ? 'Fail' : '기록됨';
    entry.files =
      event.tool_name === 'apply_patch'
        ? [...entry.command.matchAll(/(?:Add|Update|Delete) File: (.+)/g)].map((match) => match[1])
        : [];
  } else entry.skip = true;
  if (!entry.skip) state.events.push(entry);
} else if (action === 'finalize') {
  const events = state.events.slice(state.emitted);
  const commands = events.filter((entry) => entry.command);
  const files = [
    ...new Set([
      ...events.flatMap((entry) => entry.files ?? []),
      ...status().filter((path) => !state.baseline.includes(path)),
    ]),
  ].sort();
  if (commands.length || files.length) {
    const prompt = [...events].reverse().find((entry) => entry.prompt)?.prompt ?? '기록되지 않음';
    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace('T', ' ');
    const lines = [
      `### 🧾 AI 작업 변경 영수증 (${now})`,
      '',
      `* **사용자 프롬프트**: ${prompt}`,
      '* **영향을 받은 파일 목록**:',
      ...(files.length
        ? files.map((path) => `  - \`변경 감지\` \`${path}\``)
        : ['  - 감지된 파일 없음']),
      '* **실행된 CLI 터미널 명령어**:',
      ...(commands.length
        ? commands.map((entry) => `  - \`${entry.command}\` (결과: ${entry.result})`)
        : ['  - 기록된 명령 없음']),
      '* **잔여 투두 및 리스크**:',
      '  - 훅은 지원되는 Codex 도구만 기록한다. 훅 신뢰 상태는 `/hooks`에서 확인한다.',
      '',
    ];
    const receipt = resolve(root, '.agent_history.md');
    writeFileSync(
      receipt,
      `${lines.join('\n')}${existsSync(receipt) ? readFileSync(receipt, 'utf8') : ''}`,
      'utf8',
    );
  }
  state.emitted = state.events.length;
}
writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
