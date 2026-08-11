# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat` (impl-done)

## 검증 배경

직전 라운드(`15_50_56`)의 WARNING — `4-security.md §1`이 `apiBase` 두 입력 경로(쿼리 폴백 vs
`wc:boot`)를 상호배타로 서술했으나 실제로는 정상 임베드에서 둘 다 순차 발동한다는 지적 — 이후
spec 정정(`4479e771b`)과 코드 주석 정정(`df1375208`)이 들어갔다. 본 라운드는 그 정정이 (1) 코드와
정확히 맞는지, (2) 새 코드 주석 2곳이 서로/`§1`과 모순되지 않는지, (3) 다른 spec 문서에 상호배타
서술이 잔존하는지를 재확인한다.

## 확인 1 — 정정된 `§1` 서술이 코드와 맞는가

`4-security.md §1` `apiBase` 입력 검증 행의 주장을 코드로 직접 대조했다(워크트리 절대경로 Read/Grep):

- **"SDK 의 `resolveIframeTarget` 이 같은 `apiBase` 를 iframe src 쿼리에 싣는다"**
  → `codebase/packages/web-chat-sdk/src/bridge.ts:192-204` `resolveIframeTarget()` 이
  `new URLSearchParams({ apiBase: config.apiBase, trigger: config.triggerEndpointPath })` 로
  `iframeSrc` 를 구성. 확인됨.
- **"위젯 마운트 시 그 값으로 먼저 부팅 시도, 이어서 `wc:boot` postMessage 가 도착해 대체"**
  → `codebase/packages/web-chat-sdk/src/index.ts:81-94` `boot()` 는
  `resolveIframeTarget()` → `new WidgetBridge({ iframeSrc, ... })`(iframe 즉시 주입, src 에 쿼리 포함)
  → `bridge.post("wc:boot", config)` 순서로 호출한다. `WidgetBridge.post()`
  (`bridge.ts:83-91`)는 `!this.ready`(즉 `wc:ready` 수신 전)면 메시지를 `outbox` 에 버퍼링하고
  즉시 보내지 않는다 — `wc:ready` 는 위젯 iframe 이 로드된 뒤(비동기) 보내므로, iframe src 쿼리는
  구조적으로 `wc:boot` 보다 먼저 위젯에 도달한다. 위젯 측 `use-widget.ts:1348-1388` 도 동일 순서로
  구현돼 있다 — `bridge.onBoot` 핸들러를 먼저 등록한 뒤, 같은 effect 안에서 동기적으로
  `configFromQuery()` 폴백을 실행해 즉시 `runApplyConfig`. `wc:boot` 은 이후 postMessage 왕복으로
  도착. 확인됨.
- **"세대 판정으로 대체"** → `applyConfig()`(`use-widget.ts:1233-1250`)는 입력 경로(쿼리/boot)를
  구분하지 않고 항상 `beginBootAttempt()`(`use-session-generations.ts`)로 시도 토큰을 발급하고,
  이후 재검증(`cannotApplyConfig`/`isAttemptStale`)으로 더 나중 시도가 앞선 시도를 대체한다 —
  "쿼리 우선 적용 → 이어지는 `wc:boot` 시도가 세대 비교로 대체" 서술과 정확히 일치. 확인됨.
- **"코드 SoT: `use-widget.ts` 의 `safeApiBase`/`configFromQuery`/`mergeBootConfig`"** → 세 심볼
  모두 현재 `use-widget.ts` (204/226/241행)에 존재. 확인됨.

**결론**: `§1` 정정 서술은 코드와 어긋나는 부분이 없다.

## 확인 2 — 새 코드 주석 2곳이 `§1`과 모순되지 않는가

- `use-widget.ts` `configFromQuery()` JSDoc(1094-1101행): `"샘플/개발 전용"이 아니다 ... 모든
  임베드에서 발동한다 ... SoT: 4-security.md §1.` — `§1`의 "정상 임베드에서 둘 다 순차로
  발동한다"와 동일 주장, SoT 를 명시적으로 `§1`로 지목.
- `bridge.onBoot`/폴백 호출부 인라인 주석(1382-1384행): `"query param 만으로 부팅 시도 — host
  유무를 검사하지 않는다 ... 뒤이어 도착하는 wc:boot 이 세대 판정으로 대체한다."` — 역시 `§1`과
  동일 주장.
- `safeApiBase()` JSDoc(1046-1071행, `## 왜 boot 경로에도 거는가`)도 같은 순차 발동 서사를
  반복하며 `4-security.md §R7`을 정본으로 지목하고 중복 서술을 피한다.

세 곳 모두 "쿼리가 먼저, `wc:boot`이 나중에 대체"라는 동일 사실을 다른 위치에서 서술할 뿐 서로
모순되는 진술은 없다. `§R7`(신규 Rationale)도 동일 사실관계(SDK 가 같은 값을 양쪽에 보낸다 →
병합에서 boot 이 나중에 덮는다 → 비대칭 검증이 무력화된다)를 근거로 제시해 `§1`·코드 주석과 정합.

## 확인 3 — 다른 spec 문서에 상호배타 서술이 남았는가 (전수 검색)

`spec/7-channel-web-chat` 번들 전체(`0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·
`3-auth-session.md`·`4-security.md`·`5-admin-console.md`·`_product-overview.md`)에서
`apiBase`·"직접 로드"·"샘플"·"host 없이"·"query param"·"쿼리 파라미터"·"쿼리 폴백"·"iframe src
쿼리"·"개발 전용"·"배타"·"둘 중 하나"를 전수 grep 하고 각 매치 지점의 본문을 확인했다:

- **`2-sdk.md`**: `BootConfig.apiBase` 필드 주석이 `4-security.md §1·§R7`을 참조만 한다 — 자체
  서술 없음.
- **`1-widget-app.md`**: 해당 영역에 `apiBase` 언급 자체가 없다 — 상호배타 서술이 애초에 존재하지
  않음.
- **`0-architecture.md`**: `<api-base>`/`WEB_CHAT_WIDGET_ORIGINS` 등 배포·CORS 문맥으로만 등장,
  입력 경로 순서·배타성 서술 없음.
- **`_product-overview.md`**: `apiBase` 언급 없음.
- **`5-admin-console.md §6.1`**(운영 콘솔 boot 전달 메커니즘, 1954-1968행): `"apiBase/trigger/
  locale 은 query param 으로 1차 전달(위젯은 configFromQuery() 로 부트스트랩)" → "iframe 이
  로드되면 wc:ready" → "콘솔은 wc:ready 수신 후 wc:boot 로 전체 boot config 전달" → "위젯은
  configFromQuery() 와 wc:boot payload 를 머지해 적용"` — 이미 "쿼리가 1차, `wc:boot`이 뒤이어
  머지"라는 순차·비배타 서술이었고, 이번 정정 이전부터도 상호배타로 읽히지 않는 문구였다. 수정
  불필요.
- **`3-auth-session.md`**: `apiBase`는 세션의 발급-origin 바인딩 문맥(`§R8`)으로만 등장, 입력
  경로 배타성과 무관.

전수 검색 결과, `§1` 외에 상호배타로 읽힐 여지가 있는 잔존 서술은 발견되지 않았다. 이번 라운드는
"복제본 하나만 고치기" 패턴이 재발하지 않았다.

## 발견사항

없음.

## 요약

`4-security.md §1`의 정정 서술("두 입력 경로 모두 검증하며, 정상 임베드에서 둘 다 순차 발동한다")은
`resolveIframeTarget`(`web-chat-sdk/src/bridge.ts`)·`boot()`(`web-chat-sdk/src/index.ts`)·
`use-widget.ts`(`configFromQuery`/`mergeBootConfig`/`applyConfig`의 generation 판정)를 직접 대조한
결과 코드와 정확히 일치한다. `configFromQuery()` JSDoc과 폴백 호출부 인라인 주석 2곳도 같은 사실을
서로 다른 표현으로 반복할 뿐 상호 모순이 없고, `§1`을 SoT 로 명시 지목해 중복 서술을 피했다.
`0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`_product-overview.md`·`3-auth-session.md`·
`5-admin-console.md` 전수 검색에서도 쿼리 경로를 "host 없는 직접 로드/샘플 전용"으로 잘못 서술하는
잔존 문구는 발견되지 않았다(`5-admin-console.md §6.1`은 애초부터 순차·머지 서술이었다). Cross-spec
일관성 관점에서 이번 PR 의 정정은 완결적이다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
