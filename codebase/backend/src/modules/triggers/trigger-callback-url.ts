/**
 * 트리거 inbound webhook 의 **callback URL 조립** — 단일 진입점.
 *
 * `TriggersService.buildCallbackUrl` private 메서드에서 뽑아냈다. 이유는 **소유자가 갈렸기
 * 때문**이다: 호출부 둘 중 `setupChatChannel` 은 `ChatChannelBinderService` 로 옮겨갔고
 * `rotateBotToken` 은 `TriggersService` 에 남았다. 양쪽이 각자 사본을 갖게 두면 URL 형태의
 * SoT 가 둘로 갈린다 — 이 저장소에서 반복된 결함 클래스다.
 *
 * **왜 Nest provider 가 아닌가**: 외부 의존이 0이다. 같은 판정 기준으로 이 모듈의
 * `chat-channel-input-rules.ts` 도 순수 함수다. `baseUrl` 을 인자로 받아 호출자가
 * `ConfigService` 를 쥔 채로 있게 한다 — 테스트가 그 값을 통제하고 있기 때문이다(아래).
 *
 * ---
 *
 * **`app.url` 은 `common/config/app.config.ts` 가 `APP_URL` env 로부터 등록한 canonical key.**
 * Telegram `setWebhook` 은 HTTPS 만 허용하므로 운영 env 는 반드시 `https://` 로 시작해야 한다.
 *
 * **`baseUrl` 이 없을 때의 fallback 은 프로덕션에선 발화하지 않는다 — 그래도 지우지 마라.**
 * `app.config.ts` 가 이미 `process.env.APP_URL || 'http://localhost:3011'` 로 기본값을 박아
 * `app.url` 을 만들기 때문에, 실제 구동에서 `configService.get('app.url')` 은 `undefined` 가
 * 될 수 없다. 이 `??` 가 실제로 타는 경로는 **`ConfigService` 가 mock 인 단위 테스트**뿐이고,
 * 그 동작을 고정하는 캐너리가 `triggers.service.spec.ts` 의 *"app.url 이 undefined 이면
 * fallback"* 이다. "죽은 코드" 로 보고 지우면 그 테스트만 깨진다.
 *
 * **알려진 중복 — 통합 대상.** `common/utils/app-base-url.ts` 의 `getAppBaseUrl()` 이 스스로
 * *"APP_URL 의 단일 표준 fallback"* 이라고 선언하고 있고, 기본값 리터럴과 후행 슬래시 제거가
 * 여기와 동일하다. 지금 합치지 않는 이유는 **읽는 소스가 다르기** 때문이다 —
 * `getAppBaseUrl()` 은 `process.env.APP_URL` 을 직접 읽고 이 경로는 `ConfigService` 를 거친다.
 * 갈아끼우면 트리거 단위 테스트 9개 모듈이 `ConfigService` mock 으로 쥐고 있는 통제권이
 * 사라진다(예: `'https://workflow-api.getit.co.kr'` 주입 후 단언). 즉 순수 이동이 아니라
 * **DI 변경**이라 별 PR 로 갈랐다.
 * (`--impl-prep` `review/consistency/2026/09/11/17_39_32` W4.)
 *
 * @param baseUrl `configService.get<string>('app.url')` 의 값. `undefined` 허용.
 * @param endpointPath `Trigger.endpointPath`. 선행 슬래시는 있어도 된다.
 */
export function buildTriggerCallbackUrl(
  baseUrl: string | undefined,
  endpointPath: string,
): string {
  const resolved = baseUrl ?? 'http://localhost:3011';
  return `${resolved.replace(/\/$/, '')}/api/hooks/${endpointPath.replace(/^\//, '')}`;
}
