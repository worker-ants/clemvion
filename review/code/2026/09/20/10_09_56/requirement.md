# 요구사항(Requirement) 리뷰 — SSRF 가드 소비자 넷의 catch 분기 (판정 vs 가드의 고장)

## 검토 방법

`plan/in-progress/ssrf-catch-instanceof.md` 가 선언한 목표("판정만 차단으로. 판정이 아니면 그 호출부의 «분류되지 않은
실패» 경로로")를 대상으로, diff 10개 코드 파일(생산 코드 5 + 테스트 5)을 실제 소스(`Read`)로 열어 line-level 로
대조했다. 관련 spec: `spec/2-navigation/4-integration.md`(연결 테스트 §5.3/§5.4/§5.5), `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query}.md`, `spec/5-system/3-error-handling.md`
§6.3/§6.3.1. 이 세션은 직전 라운드(`review/code/2026/09/20/09_35_16`, RESOLUTION 커밋 `e8d810405`)의 후속 라운드로,
그 라운드의 WARNING 5건이 실제로 고쳐졌는지도 소스 재확인으로 검증했다. 저장소에 뮤테이션은 가하지 않았다(정적
읽기만으로 판별 가능한 범위였다) — `git status --short` 로 트리 미변경 확인.

## 발견사항

- **[INFO]** 판정 아닌 가드 오류의 원문 메시지가 여전히 2개 경로에서 `sanitizeMessage` 없이 노출됨 — 직전 라운드
  WARNING 1 의 잔여분, 의도적으로 스코프아웃된 것으로 확인됨(신규 결함 아님)
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` 의 `testHttpConnection` catch 블록 —
    `message: clampMessage(describeFailure(err))` (guard TypeError 도 이 경로로 흐른다, `sanitizeMessage` 미적용).
    `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 의 redirect-hop 실패 catch —
    `const message = err instanceof Error ? err.message : String(err);` → `HTTP_TRANSPORT_FAILED` 로 원문 그대로 사용.
  - 상세: `RESOLUTION.md`(09_35_16) 가 "HTTP 연결 테스트(`describeFailure`→`clampMessage`)는 손대지 않았다 — 그 경로는
    이 PR 이 만든 것이 아니라 전송 실패 전부가 쓰는 기존 경로" 라고 명시적으로 스코프아웃했고, redirect-hop 경로는
    `outboundBlockReason` JSDoc 이 "노드는 `HTTP_TRANSPORT_FAILED`" 로 분류하도록 설계된 대로 정확히 동작한다(설계
    일치, 버그 아님). 오늘 가드가 던질 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `.toLowerCase()` TypeError)는
    host/IP 등 민감정보를 message 에 담지 않으므로 즉시 노출 리스크는 낮다. `spec/5-system/3-error-handling.md` §6.3
    은 로그의 민감정보(API Key·토큰·비밀번호·PII) 마스킹만 규정하고, 임의 내부 예외 message 의 클라이언트 노출까지
    금지하지 않는다 — spec 위반은 아니다.
  - 제안: 조치 불요(이미 결정·문서화됨). 후속 트래커에서 `describeFailure`/`HTTP_TRANSPORT_FAILED` 형제 경로 전체를
    한 번에 `sanitizeMessage` 로 통일할 때 같이 정리.

- **[WARNING]** `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 가
  여전히 누락 — 직전 라운드 WARNING 5 의 미해소 잔여
  - 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (파일 1~8행)
  - 상세: 이번 diff 가 `http-redirect.ts` 를 직접 수정하고(`SsrfBlockedError` import·재throw 분기) 신규 spec
    `http-redirect.spec.ts` 까지 만들었는데, 그 파일을 구현하는 `1-http-request.md` §4 step 9(리다이렉트 SSRF
    재검증)의 `code:` 증거 목록에는 없다. `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트와
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 양쪽이 이미 이 갭을 planner 항목으로 등재해 뒀고,
    developer 자기-반증형 소정정 대상이 아님(증거 목록 누락은 예고 문장 정정이 아니다)도 `RESOLUTION.md` 가 밝혔다 —
    판단 방향은 이미 맞다. 다만 병합 시점 기준으로는 **아직 미해소**이므로 spec fidelity 관점에서 재확인 차 등재한다.
  - 제안: 코드 수정 아님 — `project-planner` 턴에서 `code:` 에 `http-redirect.ts` 추가(이미 계획됨, 재차 확인 목적).

- **[INFO]** `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트가 아직 `/ai-review 수렴`·`--impl-done`·`트래커
  해소·plan/complete/ 이동` 셋 다 미체크(`[ ]`)인 채로, 같은 diff 안의 다른 트래커 문서는 이미 "2026-09-20 해소"로
  체크(`[x]`)하고 존재하지 않는 경로(`plan/complete/ssrf-catch-instanceof.md`)를 참조함
  - 위치: `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 섹션(하단 3개 항목) vs
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "SSRF 가드 소비자 넷의 catch…" 항목(`[x]` 처리 + `plan/complete/ssrf-catch-instanceof.md` 참조)
  - 상세: 두 문서가 서로 다른 완료 상태를 주장한다 — 사용자가 "머지했어"라고 전달했지만, 이 워크트리 안에서는 plan 이
    아직 `plan/in-progress/`에 있고 그 자신의 체크리스트도 리뷰 수렴·`--impl-done`·이동을 미완료로 표시한다. 이번
    리뷰(`10_09_56`)가 바로 그 "수렴" 단계이므로 워크플로 순서상 이상하지 않을 수 있으나, 트래커 쪽의 "해소" 체크와
    존재하지 않는 `plan/complete/` 경로 참조는 이 라운드가 끝나기 전에 앞서 기록된 것이라 시점상 이르다.
  - 제안: 이번 리뷰가 Critical/Warning 0 으로 수렴하면 마무리 커밋에서 plan 체크리스트 3항목 체크 + `plan/complete/`
    로 실제 이동해 두 문서의 서술을 일치시킨다(먼저 쓴 "해소" 기록이 사실이 되도록).

## 핵심 확인 사항 (문제 없음)

- 4개 소비자 + 1개 동반 변경이 plan 이 표로 선언한 기대 동작과 **line-level 로 정확히 일치**한다:
  `http-request.handler.ts`(preflight) → 판정 아닌 오류는 `INTEGRATION_CALL_FAILED` + `port:'error'`(사용자 API 밖
  경로), `http-redirect.ts` `outboundBlockReason` → 판정 아닌 오류는 그대로 재throw(호출자가 `HTTP_TRANSPORT_FAILED`
  /`HTTP_CONNECT_FAILED` 로 분류), `database-query.handler.ts` → `INTEGRATION_CALL_FAILED` 로 승격(바깥 catch 의
  `mapDbError` fallback 을 우회), `database-connection-tester.ts` → `DB_CONNECT_FAILED` **결과**(던지지 않음,
  `dispatchTest` no-throw 계약 보존), `http-connection-tester.ts` → preflight 를 `try` 안으로 옮겨 같은 no-throw
  계약을 보존(동반 1건).
- `http-safety.ts` 실측 확인: `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 는 오늘 **모든** 판정 경로에서
  `SsrfBlockedError` 만 던지고, DNS lookup 실패는 fail-open(조용히 통과)이라 오늘은 비판정 오류가 발생할 유일한 경로가
  `isBlockedHostname` 의 `.toLowerCase()` TypeError(hostname 이 문자열이 아닐 때)뿐이라는 plan 의 주장이 소스와 일치한다.
  이 경로는 `validateCredentials`(`service-registry.ts`, `field.type==='string'` 검증)를 지나므로 API 로는 닿지 않는다는
  주장도 별도로 반증하지 않았다(plan 의 실측 근거로 수용).
  spec §5.3/§5.4 의 "그 밖(네트워크·타임아웃·TLS·없는 database 등) → `DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`" 캐치올
  버킷과 충돌하지 않는다(가드의 고장도 "그 밖"의 부분집합으로 타당).
- 직전 라운드 WARNING 1~4 는 모두 소스에서 재확인됨: (W1) HTTP 노드는 `toLogError(err).message`(`sanitizeMessage`
  경유)로 감싼 `IntegrationError`, DB 노드는 `sanitizeMessage`, DB 연결 테스트는 `clampMessage(sanitizeMessage(...))`
  적용 확인 — 노출 표면이 4곳 중 2곳으로 줄었다(위 INFO 참조). (W2) `AbortSignal.timeout` 생성이 preflight 통과
  **뒤**로 이동 확인. (W3) `http-redirect.spec.ts` `beforeEach` 에 `mockedHostGuard.mockResolvedValue(undefined)` 추가
  확인. (W4) `database-query.handler.ts` 의 stale 주석이 판정/비판정 두 갈래를 모두 반영하도록 갱신됨을 확인.
- 테스트 5건(신규 4 + 신설 파일 1) 모두 실제 구현 분기와 코드/메시지/던짐 여부가 일치 — 예를 들어
  `database-query.handler.spec.ts` 신규 테스트는 `connectMock` 미호출 + `logUsage` 의 `error.code ===
  'INTEGRATION_CALL_FAILED'` 를 함께 검증해 "쿼리 시작 전 승격" 이라는 주석의 주장과 부합한다.
- `IntegrationError` 생성자는 `(code, message)` 두 인자만 받고 `cause` 옵션이 없어 "원본 객체를 cause 로 붙이지
  않는다" 는 주석·`spec/5-system/3-error-handling.md` §6.3.1 C2 판정과 실제 구현이 일치한다.
- TODO/FIXME/HACK/XXX 류 미완성 주석 없음. 모든 분기가 성공/실패 양쪽 다 명시적 반환값(또는 명시적 재throw)을
  가진다 — 반환 누락 경로 없음.

## 요약

SSRF 가드 소비자 넷("판정" vs "가드의 고장"을 가르는 catch 분기)과 동반 변경 1건이 plan 이 선언한 기대 동작표와
spec 의 에러 코드 캐치올 버킷(`INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`)에 line-level 로
정확히 부합하며, 직전 리뷰 라운드의 WARNING 4건(타임아웃 예산 잠식·미mock DNS·메시지 마스킹·stale 주석)이 소스
재확인으로 모두 고쳐졌음을 검증했다. 남은 리스크는 전부 이미 문서화·추적 중인 잔여 항목뿐이다 — spec frontmatter
`code:` 목록 누락(WARNING, planner 턴 대기 중), 가드-고장 메시지의 부분적 미마스킹 2곳(INFO, 의도적 스코프아웃),
plan/트래커 완료 서술의 시점 불일치(INFO, 이번 라운드가 수렴하면 마무리 커밋에서 해소 가능). 기능 완전성·엣지
케이스·에러 시나리오·반환값 모두 정상이며 새로운 Critical 은 발견되지 않았다.

## 위험도

LOW
