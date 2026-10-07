import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { countCalls } from '../../../common/__test-utils__/source-scan';

/**
 * 채팅 채널 프로바이더 클라이언트(`providers/<프로바이더>/<프로바이더>-client.ts`)는 실패 원문을
 * 돌려주거나 로그에 남기기 전에 그 호출에 쓴 봇 토큰을 `replaceKnownSecret` 으로 지운다(NERV Task
 * `CLE-T-H0GF4K`). 공유 래퍼가 없어 클라이언트마다 손으로 건다. 그래서 «fetch 호출 수 · 치환 지점
 * 수» 를 클라이언트마다 고정한다. fetch 경로나 실패 원문이 나가는 자리(로그 · 반환값)가 늘면 여기가
 * 깨지고, 고친 사람이 새 자리에 치환을 걸었는지 보고 표를 고친다.
 *
 * 동작은 클라이언트별 spec(실제 fetch 오류 원문으로 반환값 · 로그에 토큰이 없음을 단언)이 지킨다.
 * 이 가드는 그 spec 이 다루지 않는 새 경로를 잡는 보조다. 어댑터의 `fetch(`(Slack `response_url`)는
 * 봇 토큰을 쓰지 않아 대상이 아니다. 주석 속 언급은 세지 않는다(`countCalls`).
 */
const EXPECTED: Record<string, { fetch: number; replaceKnownSecret: number }> =
  {
    // call · filesUploadV2 가 각자 원문 하나(`reason`)를 만들어 로그와 반환값에 쓴다.
    slack: { fetch: 2, replaceKnownSecret: 2 },
    // call 이 원문 하나를 만들어 로그와 반환값에 쓴다.
    discord: { fetch: 1, replaceKnownSecret: 1 },
    // 시도별 로그(cause 포함), 최종 로그(cause 포함), 반환값(message) 세 문장을 따로 만든다.
    telegram: { fetch: 1, replaceKnownSecret: 3 },
  };

describe('프로바이더 클라이언트 — fetch 경로와 실패 원문마다 알려진 비밀 치환이 있다', () => {
  const root = __dirname;
  const providers = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(join(root, name, `${name}-client.ts`)))
    .sort();

  it('클라이언트 목록이 표와 같다(새 프로바이더는 표에 더한다)', () => {
    expect(providers).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s', (name, expected) => {
    const src = readFileSync(join(root, name, `${name}-client.ts`), 'utf8');
    expect({
      fetch: countCalls(src, 'fetch'),
      replaceKnownSecret: countCalls(src, 'replaceKnownSecret'),
    }).toEqual(expected);
  });
});
