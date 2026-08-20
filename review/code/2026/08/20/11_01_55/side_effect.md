# 부작용(Side Effect) 리뷰 — `token` 계열 값·키 패턴 마스킹 (재검토 라운드)

## 검토 범위 및 방법

이번 diff 는 `2026/08/17/14_00_15` 코드 리뷰 + `13_31_57`/`14_00_50` consistency 리뷰가 이미
한 차례 검토한 변경(`token` 계열 마스킹 정규식 확장)에 더해, 그 라운드의 WARNING 5건을 실제로
반영한 `RESOLUTION.md` 커밋과 두 consistency 세션의 산출물 파일 일체를 `review/**` 아래
신규 커밋하는 내용을 포함한다. 핵심 프로덕션 코드 5개 파일을 직접 `Read` 로 열어 실제 소스
줄 번호와 diff 게이트 번호가 일치하는지 대조했다.

## 발견사항

- **[INFO]** 공유 정규식 SoT(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN` ×2 미러)를
  넓히는 편집이라 이 diff 안에서 관측 가능한 출력이 바뀌는 소비자 수가 가장 많다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:42`
    (`SECRET_LEAK_PATTERNS` 값 패턴), `codebase/backend/src/shared/utils/sanitize-error-message.ts:104`
    (`CREDENTIAL_KEY_PATTERN`), `codebase/backend/src/modules/websocket/websocket.service.ts:78`
    (`CREDENTIAL_KEY_PATTERN` 미러)
  - 상세: 세 상수는 모듈-스코프 `const` 이지만 `redactSecrets`/`deepRedactSecrets`/
    `sanitizePayloadForWs`/`redactMcpSecrets`/`sanitizeMcpErrorMessage` 를 거쳐
    thread-renderer, terminal-error-payload, WS emit, MCP 에러, execution-engine 알림 등
    다수의 egress 표면에 영향을 준다. `[A-Za-z0-9_-]*token`/`[a-z0-9_-]*token` 로의 확장은
    이 표면 전체의 마스킹 출력을 한 번에 바꾼다 — 예: `nextPageToken` 같은 불투명 커서도
    이제 마스킹된다(코드 스스로 "accepted false positive" 로 명시하고 캐너리로 고정함).
    함수 시그니처·export 표면 자체는 변경되지 않았다. 이 blast radius 는 이미 이전
    라운드(`review/code/2026/08/17/14_00_15/side_effect.md`)가 INFO 로 포착·기록했고,
    plan 문서에 427 suites/8,832 GREEN 실측이 남아 있어 이번 재검토에서 새로 발견된 위험은
    아니다.
  - 제안: 조치 불필요. 향후 이 세 상수를 다시 넓힐 때도 동일하게 전수 소비자를 재확인할 것.

- **[INFO]** `MCP_EXTRA_SECRET_PATTERNS` 가 빈 배열이 되어 `redactMcpSecrets` 의 첫 번째
  for 루프가 상시 no-op
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:54`(배열 선언) 및
    `redactMcpSecrets` 함수 본문의 `for (const [pattern, replacement] of MCP_EXTRA_SECRET_PATTERNS)`
    루프(직접 `Read` 로 확인한 실제 파일 74행 — 이 구간은 diff 게이트가 잘려 번호가 없어
    파일을 직접 열어 대조함)
  - 상세: 배열이 비어 루프 바디가 한 번도 실행되지 않지만, 공용 `SECRET_LEAK_PATTERNS` 가
    동일 형태(bare `token=`)를 상위집합으로 흡수함을 `mcp-error-codes.spec.ts` 8건 GREEN 으로
    이미 검증했고, JSDoc(39–53행)이 "훅을 의도적으로 남겨 둔다"는 이유를 명시한다. 기능
    회귀는 아니며, 이 역시 이전 라운드가 이미 INFO 로 기록한 지점이다.
  - 제안: 조치 불필요.

- **[INFO]** `websocket.service.spec.ts` 신규 테스트가 공유 mock 상태에 의존하지 않는지
  확인 — 문제 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:51-57`
    (`beforeEach` 에서 `gateway = { broadcastToChannel: jest.fn() }` 매 테스트 재생성),
    신규 `it('token 계열 오탐 경계...')` 케이스가 `gateway.broadcastToChannel.mock.calls[0][2]`
    를 읽는 지점(:169-181)
  - 상세: `calls[0]` 인덱싱이 이전 테스트의 호출 잔여와 섞이는 것 아닌지 확인했다.
    `beforeEach` 가 매 `it` 마다 `gateway`/`service` 를 새로 만들어(모듈 스코프 mock 재사용
    없음) 각 테스트의 `mock.calls` 는 항상 그 테스트 자신의 호출만 담는다 — 상태 누수 없음.
  - 제안: 조치 불필요(확인용 기록).

- **[INFO]** 이번 diff 는 `review/code/2026/08/17/14_00_15/**`·`review/consistency/2026/08/17/{13_31_57,14_00_50}/**` 산출물 24개 파일을 신규 커밋한다 — "예상치 못한 파일시스템 부작용"에 해당하는지 확인
  - 위치: 파일 10~36 (`RESOLUTION.md`, `SUMMARY.md`, `meta.json`, `_retry_state.json`,
    각 관점별 리뷰 `.md` 등)
  - 상세: 이 파일들은 코드 실행 중 생성되는 부작용이 아니라, CLAUDE.md 가 규정한 "코드 리뷰
    산출물은 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, 일관성 검토 산출물은
    `review/consistency/...`" 저장 위치 규약에 따라 이전 리뷰·consistency-check 세션이 만든
    산출물을 그대로 커밋한 것이다. 런타임 코드(`redactSecrets` 등)가 파일시스템에 쓰는 로직은
    이번 diff 에 없다.
  - 제안: 조치 불필요 — 규약에 부합하는 의도된 기록물.

## 확인했으나 문제 없는 항목

- **함수 시그니처/공개 API**: `redactSecrets`, `deepRedactSecrets`, `deepRedactSecretsPreserving`,
  `redactMcpSecrets`, `sanitizeMcpErrorMessage`, `emitBackgroundRunEvent`,
  `sanitizePayloadForWs` — 전부 파라미터·반환 타입 불변.
- **전역 변수**: 이번 diff 로 새로 도입된 모듈-스코프 `let`/가변 전역 없음. 기존
  `SANITIZE_CACHE`(`websocket.service.ts`, WeakMap)·`MASKED_MARKERS` 는 이번 diff 가
  건드리지 않았고 정규식 확장과 무관하게 동일하게 동작.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음 — 순수 정규식 치환 로직.
- **이벤트/콜백 계약**: WS emit(`broadcastToChannel`) 호출 인자 구조·호출 시점·MCP 에러
  redact 파이프라인의 호출 순서 모두 불변. 값의 **내용**(마스킹 여부)만 바뀐다.
- **재마스킹 방지 계약**: `MASKED_MARKERS`/마커 상수 로직은 이번 diff 에서 변경되지 않았고,
  패턴 확장이 그 계약을 우회하지 않는다.

## 요약

핵심 변경은 세 개의 공유 정규식 상수(`SECRET_LEAK_PATTERNS` 값 패턴, `CREDENTIAL_KEY_PATTERN`
×2 미러)를 `token` 접두 계열까지 흡수하도록 넓히고, MCP 전용 중복 패턴을 비워 흡수시킨 것이다.
함수 시그니처·공개 API·환경 변수·네트워크 호출·이벤트 계약은 전혀 변경되지 않았고, 새로
도입된 전역 가변 상태도 없다. 유일하게 주목할 부작용 축은 **공유 정규식 SoT 를 넓히면 다수의
다운스트림 소비자(웹소켓 emit, 대화 스레드, 종결 에러 페이로드, MCP 에러, execution-engine
알림 등)의 마스킹 출력이 동시에 바뀐다**는 점인데, 이는 이번 변경의 의도된 목적이고 이전
리뷰 라운드가 이미 INFO 로 포착·기록했으며 427 suites 실측·뮤테이션 검증·캐너리 테스트로
뒷받침돼 있다. 이번 재검토에서 새로 발견된 부작용은 없다. `review/**` 아래 24개 파일 신규
커밋도 프로젝트 산출물 저장 규약에 따른 의도된 기록이지 런타임 부작용이 아니다.

## 위험도

LOW
