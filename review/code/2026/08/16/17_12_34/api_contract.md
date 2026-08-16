# API 계약(API Contract) 리뷰

## 대상 요약

이번 변경의 실질 코드 표면은 `codebase/backend/src/modules/executions/executions.service.ts` ·
`background-runs/background-runs.service.ts` · 신규 `shared/utils/redact-stored-error.ts` 6개
파일이다. 나머지(`.claude/docs/plan-lifecycle.md`, `plan/**`, `review/consistency/**`,
`spec/**`)는 계획·리뷰·명세 문서로 API 계약에 직접 영향이 없다.

핵심 변경: DB `Execution.error` / `NodeExecution.error` (jsonb) 컬럼 값을 **응답 egress
시점에** `redactStoredErrorForResponse`(`deepRedactSecrets` 위임)로 자격증명 패턴만
`***` 마스킹한다. 적용 지점은 `ExecutionsService.findById` · `getChain` · `stop` ·
`toExecutionDto`(목록) 4곳과 `BackgroundRunsService` body 노드 1곳, 그리고 `findById` 를
재사용하는 `POST /executions/:id/re-run`·WS `execution.snapshot` 이다.

## 발견사항

- **[INFO]** 널리 소비되는 필드(`error.message`)의 **값 내용**이 변경됨 — 클라이언트 공지 필요 여부
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:922` (`toResponseExecution`),
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`
  - 상세: 이번 변경은 응답 **스키마**(키·타입)는 바꾸지 않는다 — DTO 는 이미
    `error?: Record<string, unknown> | null` 로 선언돼 있고(`execution-response.dto.ts:71,167`,
    `background-run-response.dto.ts`), `redactStoredErrorForResponse` 의 반환 타입도 정확히
    이와 일치한다. 다만 `GET /api/executions/:id` · `/chain` · `/stop` · 목록 · WS
    `execution.snapshot` 을 통해 **이미 소비 중인** `error.message`/`error.details` 문자열 내용이
    자격증명 형태 부분 문자열을 만나면 `***` 로 바뀐다. 프런트가 실패 배너에 이 값을 그대로
    렌더한다는 점(주석에도 명시)을 고려하면 이는 의도된 보안 수정이지 결함이 아니지만,
    **response body 값이 바뀌는 API 동작 변경**이므로 하위 호환성 관점에서 "구조는 그대로,
    내용만 마스킹" 임을 API 소비자(내부 프런트 외 외부/내부 스크립트가 있다면)에 명확히
    공지할 가치가 있다.
  - 제안: 이미 spec(`spec/5-system/14-external-interaction-api.md` §R17, `12-background.md` §8.2,
    `6-websocket-protocol.md`, `14-execution-history.md` R-5 caveat)에 6개 문서로 정본 등재돼
    있어 문서화 요건은 충족됐다. 추가 조치는 불필요 — 참고 기록 수준.

- **[INFO]** `GET /api/executions/:id` 계열의 `@Roles` 게이트 부재는 이번 PR 범위 밖, 신규 회귀 아님
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:762` (`stop` 진입부 주석),
    `redact-stored-error.ts` 상단 doc comment
  - 상세: 코드 주석·spec 캐비엇이 반복해서 "이 엔드포인트엔 `@Roles` 게이트가 없어 viewer 를
    포함한 워크스페이스 멤버 전원이 조회한다"를 근거로 든다. 이는 **기존 설계**(spec
    `14-execution-history.md` R-5 가 의도적으로 문서화)이고 이번 diff 가 인가 로직을 건드리지도,
    악화시키지도 않는다 — 값 마스킹을 보완 통제로 추가했을 뿐이다. 문제로 등재하지 않되,
    "마스킹이 인가 부재의 대체물"이라는 프레이밍이 향후 다른 PR에서 "이미 안전하니 `@Roles`
    불필요"로 오독되지 않도록 spec 자신이 이미 그 경계를 명시(`R-5 의 대상 범위` 캐비엇,
    §R17 "단 R-5 의 직접 대상은 Config 탭" 문구)하고 있어 이 상태로 충분하다.

- **[INFO]** 응답 형식 일관성은 이번 변경으로 오히려 개선됨 (긍정 관찰, 조치 불요)
  - 위치: `executions.service.ts` `toResponseExecution` (구 `stripPrivateRelations`), 3개 반환
    지점(`findById`/`getChain`/`stop`)의 공통 관문화
  - 상세: 종전에는 종결 emit 경로(WS/SSE/webhook)만 마스킹되고 REST 읽기 경로·WS
    `execution.snapshot` 은 원문이라 **같은 API 필드가 전송 채널에 따라 다른 값**을 내보내는
    비일관 상태였다. 이번 변경이 4개 반환 지점을 단일 함수로 관문화해 REST·WS 스냅샷 간
    응답 값 parity 를 회복했다 — API 계약 일관성 관점에서 회귀가 아니라 정합화다.

요청 검증(파라미터/바디 validation), URL/경로 설계, 페이지네이션, 버전 관리, HTTP 에러 상태
코드 형식은 이번 diff 범위에서 변경되지 않았다 (background-runs 페이지네이션 커서·목록 API 는
기존 로직 그대로이며 diff 는 `error` 필드 한 줄만 건드림).

## 요약

이번 변경은 신규 엔드포인트·URL·요청 검증·페이지네이션·인가 로직을 건드리지 않는 **순수 응답
값 마스킹**이다. 응답 DTO 타입(`Record<string, unknown> | null`)과 마스킹 함수의 반환 타입이
정확히 일치해 스키마 breaking change 는 없고, 4개 REST 반환 지점 + WS 스냅샷을 단일 관문으로
묶어 종전에 존재하던 채널 간 값 비일관(같은 `Execution.error` 가 종결 emit 은 마스킹, 읽기
경로는 원문)을 해소했다는 점에서 오히려 계약 일관성이 개선됐다. `stop()` 의 반환값을 내부에서
소비하는 두 호출부(`interaction.service.ts`, `hooks.service.ts`)는 반환 execution 을 버리고
별도 쿼리로 상태만 재확인하므로 마스킹으로 인한 내부 로직 파급도 없음을 확인했다. 유일한
남은 고려사항은 `error.message` 처럼 이미 소비 중인 필드의 **내용**이 바뀐다는 점인데, spec
6개 문서에 정본 등재가 이미 완료돼 있어 추가 조치는 불필요하다.

## 위험도

LOW — CRITICAL/WARNING 없음. INFO 3건은 전부 기록 목적이며 조치 불요.
