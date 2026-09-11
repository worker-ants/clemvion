/**
 * `buildTriggerCallbackUrl` 직접 단위 테스트.
 *
 * 의존이 0이라 `Test.createTestingModule` 없이 그냥 부른다 — 이 함수를 provider 로 만들지 않은
 * 판정 기준이 여기서 그대로 보인다.
 *
 * **왜 이 파일이 생겼나**: `/ai-review` `review/code/2026/09/11/18_04_36` W1 이
 * *"이 함수를 겨냥한 단언이 없어 호출부 인자 스왑 뮤턴트가 jest 전량 GREEN"* 이라고 지적했다.
 * 스왑 자체는 **시그니처를 이름 인자로 바꿔 형태로 없앴지만**, 그 지적이 드러낸 진짜 갭 —
 * *"이 함수의 문자열 조립 규칙을 아무도 직접 단언하지 않는다"* — 은 그대로 남아 있었다.
 * 조립 규칙은 **분기가 셋**(fallback · 후행 슬래시 · 선행 슬래시)이고 셋 다 조용히 틀릴 수 있다.
 */
import { buildTriggerCallbackUrl } from './trigger-callback-url';

describe('buildTriggerCallbackUrl', () => {
  it('baseUrl + endpointPath 를 /api/hooks/ 로 잇는다', () => {
    expect(
      buildTriggerCallbackUrl({
        baseUrl: 'https://workflow-api.getit.co.kr',
        endpointPath: 'hook-abc',
      }),
    ).toBe('https://workflow-api.getit.co.kr/api/hooks/hook-abc');
  });

  /**
   * `app.config.ts` 가 이미 `APP_URL || 'http://localhost:3011'` 로 기본값을 박으므로 이 분기는
   * **프로덕션에서 발화하지 않는다** — mock `ConfigService` 전용이다. 그래서 더더욱 여기서
   * 고정한다: 실구동으로는 반증되지 않아 조용히 바뀔 수 있는 자리다.
   */
  it('baseUrl 이 undefined 면 dev 기본값으로 떨어진다', () => {
    expect(
      buildTriggerCallbackUrl({ baseUrl: undefined, endpointPath: 'hook-abc' }),
    ).toBe('http://localhost:3011/api/hooks/hook-abc');
  });

  /**
   * `??` 는 `null`/`undefined` 에만 걸린다 — **빈 문자열은 통과해 상대 경로가 나온다.**
   * `||` 로 바꾸고 싶어지는 자리라 현재 동작을 캐너리로 박아 둔다(이 PR 은 순수 이동이므로
   * 동작을 바꾸지 않는다). 바꾸려면 이 테스트를 **의도적으로** 고쳐야 한다.
   */
  it('baseUrl 이 빈 문자열이면 그대로 써서 상대 경로가 된다 (?? 의 현재 동작)', () => {
    expect(
      buildTriggerCallbackUrl({ baseUrl: '', endpointPath: 'hook-abc' }),
    ).toBe('/api/hooks/hook-abc');
  });

  it('baseUrl 의 후행 슬래시를 제거해 // 가 생기지 않는다', () => {
    expect(
      buildTriggerCallbackUrl({
        baseUrl: 'https://example.com/',
        endpointPath: 'hook-abc',
      }),
    ).toBe('https://example.com/api/hooks/hook-abc');
  });

  it('endpointPath 의 선행 슬래시를 제거한다', () => {
    expect(
      buildTriggerCallbackUrl({
        baseUrl: 'https://example.com',
        endpointPath: '/hook-abc',
      }),
    ).toBe('https://example.com/api/hooks/hook-abc');
  });

  // 위 둘이 **동시에** 걸리는 입력 — 한쪽 replace 만 살아 있어도 `//` 가 남아 갈린다.
  it('양쪽 슬래시가 겹쳐도 정확히 한 번만 잇는다', () => {
    expect(
      buildTriggerCallbackUrl({
        baseUrl: 'https://example.com/',
        endpointPath: '/hook-abc',
      }),
    ).toBe('https://example.com/api/hooks/hook-abc');
  });

  // 제거는 **후행 1개**만이다 — 경로 중간의 슬래시는 건드리지 않는다.
  it('baseUrl 의 하위 경로는 보존한다', () => {
    expect(
      buildTriggerCallbackUrl({
        baseUrl: 'https://example.com/gateway/',
        endpointPath: 'hook-abc',
      }),
    ).toBe('https://example.com/gateway/api/hooks/hook-abc');
  });
});
