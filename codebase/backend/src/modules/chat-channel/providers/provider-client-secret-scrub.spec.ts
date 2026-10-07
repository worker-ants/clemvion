import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * 채팅 채널 프로바이더 클라이언트(`providers/<프로바이더>/<프로바이더>-client.ts`)는 실패 원문을
 * 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 `replaceKnownSecret` 으로 지운다(NERV Task
 * `CLE-T-H0GF4K`). 공유 래퍼가 없어 클라이언트마다 손으로 건다. 그래서 새 `fetch(` 경로가 생겼는데
 * 치환을 빠뜨리면 여기서 잡는다. 기준은 «치환 호출 수 ≥ fetch 호출 수» 다.
 *
 * 어댑터의 `fetch(`(Slack `response_url`)는 봇 토큰을 쓰지 않아 대상이 아니다.
 */
describe('프로바이더 클라이언트 — fetch 경로마다 알려진 비밀 치환이 있다', () => {
  const root = __dirname;
  const clients = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(root, d.name, `${d.name}-client.ts`))
    .filter((file) => {
      try {
        readFileSync(file);
        return true;
      } catch {
        return false;
      }
    });

  it('클라이언트 파일을 셋 이상 찾는다(열거가 비면 아무것도 검사하지 않는다)', () => {
    expect(clients.length).toBeGreaterThanOrEqual(3);
  });

  it.each(clients.map((file) => [file.slice(root.length + 1), file]))(
    '%s',
    (_name, file) => {
      const src = readFileSync(file, 'utf8');
      const fetches = src.match(/\bfetch\(/g)?.length ?? 0;
      const replaces = src.match(/\breplaceKnownSecret\(/g)?.length ?? 0;
      expect(fetches).toBeGreaterThan(0);
      expect(replaces).toBeGreaterThanOrEqual(fetches);
    },
  );
});
