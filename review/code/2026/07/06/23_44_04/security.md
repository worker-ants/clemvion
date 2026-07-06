# 보안(Security) Review

## 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`dispatchExecutionFailedNotification` 에 `sanitizeErrorMessage` 적용)
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (로컬 `sanitizeErrorMessage` 제거, 공용 util import 로 대체)
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규 — 공용 유틸 추출)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (`getNotificationsService` ModuleRef 지연 해석 4분기 unit)
- `codebase/backend/test/background-monitoring.e2e-spec.ts` (`select:false` REST 미노출 e2e 단언)
- 나머지(plan/*.md, review/**/RESOLUTION.md 등)는 문서 산출물로 코드 보안 영향 없음(리뷰 스코프 제외)

이번 diff 는 직전 보안 리뷰(22_42_32)의 WARNING("`execution_failed` 알림 메시지가 원본 예외 메시지를 새니타이징 없이 인앱+이메일로 노출")에 대한 후속 조치로, 기존 `background-execution.processor.ts` 에 로컬로 있던 `sanitizeErrorMessage` 를 `sanitize-error-message.ts` 공용 util 로 추출하고 `execution-engine.service.ts` 의 `dispatchExecutionFailedNotification` 경로에도 동일하게 적용한 것이 핵심이다.

## 발견사항

- **[INFO]** 새니타이저 공용화로 방어 심도(defense in depth) 불일치 해소 — 이전 WARNING 정상 조치
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts:17-26`, `execution-engine.service.ts:4495`, `background-execution.processor.ts` (import 로 대체)
  - 상세: 기존에는 background 본문 실패 경로(processor)에만 stack trace·connection string 제거 + 500자 캡이 적용되고, top-level 실행 실패 알림(`dispatchExecutionFailedNotification`)에는 원본 `Error.message` 가 그대로 사용자向 표면(인앱+이메일)에 노출되는 비대칭이 있었다. 이번 변경으로 두 경로가 동일 함수를 import 해 공유하므로, 향후 한쪽만 갱신되고 다른 쪽이 누락되는 회귀 가능성이 구조적으로 줄었다(단일 진실 원천). 정규식 패턴(`STACK_TRACE_PATTERN`, `CONNECTION_STRING_PATTERN`)과 길이 캡(500자)은 이전과 동일하게 유지됨 — 로직 변경 없이 위치만 통합.
  - 제안: 없음. 적절한 조치.

- **[INFO]** 새니타이저의 커버리지 한계 — 정규식 기반이라 우회 가능한 패턴 존재 (기존부터 있던 한계, 이번 변경으로 악화되지 않음)
  - 위치: `sanitize-error-message.ts:12-15` (`CONNECTION_STRING_PATTERN`)
  - 상세: `CONNECTION_STRING_PATTERN` 은 `postgres/postgresql/redis/mongodb/mysql://` 스킴만 커버한다. 예를 들어 AWS 자격증명이 포함된 URL(`https://`), API 키 형태 토큰(`sk-...`, `AKIA...`), 일반 파일 경로(`/etc/passwd`, `C:\...`), 내부 IP 주소(`10.0.0.5:5432`) 등은 스킴 매칭에 걸리지 않아 그대로 통과한다. 주석에 명시된 대로 "credential 자체는 상위 계층(WS 마스킹)이 추가 차단"한다는 전제가 있으나, `dispatchExecutionFailedNotification` 은 이메일(SMTP) 채널로도 발송되며 WS 마스킹(`sanitizePayloadForWs`)은 WS 이벤트 페이로드에만 적용되는 것으로 보여 이메일 채널에는 그 방어선이 적용되지 않을 가능성이 있다. 이는 이번 diff 로 신규 도입된 취약점이 아니라 기존 새니타이저의 선존 한계를 그대로 재사용한 것이다.
  - 제안: 우선순위 낮음(INFO). 노드 실행 실패 메시지가 어떤 외부 시스템(DB, 커스텀 HTTP 노드 등)의 에러를 그대로 감싸 전달하는 경우가 실무에서 흔하다면, 화이트리스트 방식(허용된 패턴만 통과) 또는 좀 더 넓은 시크릿 패턴(AWS 키, generic Bearer 토큰, IP:port) 탐지로 확장하는 것을 후속 고려. 현재 스코프에서는 방어 심도 통일이라는 이번 fix 의 목적 달성으로 충분.

- **[INFO]** `background_run_id` REST 비노출 회귀 가드 — e2e 단언이 실제 HTTP 응답 바디를 검증
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:238-251`
  - 상세: `GET /api/notifications` 응답에서 `backgroundRunId` 미노출(`not.toHaveProperty`) 과 `resourceId===workflowId` 를 단언한다. 이는 raw SQL 이 아닌 실제 REST 계층을 거치므로 컨트롤러/직렬화 경로 전체(엔티티 `select:false` 포함)를 blackbox 로 검증하는 유효한 회귀 가드다. 인증 헤더(`Bearer owner.accessToken`)와 워크스페이스 스코프(`X-Workspace-Id`)도 정상적으로 포함되어 있어 인가 컨텍스트 누락 없음.
  - 제안: 없음.

- **[INFO]** `getNotificationsService` unit 4분기 테스트 — private 필드 직접 조작(`asSvc()`)이지만 보안 영향 없음
  - 위치: `execution-engine.service.spec.ts:39-87`
  - 상세: 테스트가 `service as unknown as Svc` 캐스팅으로 private 필드(`notificationsService`, `moduleRef`, `resolvedNotificationsService`)를 직접 주입/관찰한다. 이는 테스트 전용 화이트박스 기법이며 프로덕션 코드 경로에는 영향이 없다. `ModuleRef.get` 이 throw 할 때 조용히 `undefined` 로 폴백하는 동작(`getNotificationsService`)도 검증되어, DI 조회 실패 시 예외가 상위로 전파되어 실행 흐름을 깨뜨리는 것을 방지하는 fail-safe 특성이 확인됨 — 가용성 관점에서 적절.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 전체 diff
  - 상세: 신규/변경 코드에 API 키, 비밀번호, 토큰 등 하드코딩된 값 없음. 테스트 파일의 mock 값(`'not found'` 에러 메시지 등)도 시크릿이 아님.
  - 제안: 없음.

- **[INFO]** 인젝션·인증/인가 관련 신규 취약점 없음
  - 위치: 전체 diff
  - 상세: 이번 변경은 SQL 쿼리 구성, 사용자 입력 파싱, 인증/인가 로직에 관여하지 않는다(문자열 새니타이징 유틸 추출 + DI 지연 해석 + 테스트 보강). 새로운 인젝션 벡터나 권한 검증 우회 지점이 도입되지 않았다.
  - 제안: 없음.

## 요약
이번 diff 는 직전 리뷰(22_42_32)에서 지적된 "에러 메시지 새니타이징이 background 경로에만 적용되고 top-level 실행 실패 알림 경로에는 누락"이라는 방어 심도 불일치 WARNING을 정확하고 최소한의 형태로 해소한다 — 로직 변경 없이 기존 새니타이저를 공용 util(`sanitize-error-message.ts`)로 추출해 두 발사 경로가 동일 함수를 공유하도록 리팩터링했다. 회귀 방지를 위한 `getNotificationsService` ModuleRef 지연 해석 unit 4건과 `background_run_id` REST 비노출 e2e 단언도 추가되어 검증 커버리지가 개선되었다. 새니타이저 자체는 스택트레이스/DB 연결 문자열 스킴에 한정된 정규식 기반이라 AWS 키·IP:port·파일 경로 등 다른 시크릿 패턴은 통과할 수 있는 선존 한계가 있으나, 이는 이번 변경이 새로 만든 취약점이 아니라 기존 유틸의 알려진 범위이며 방어 심도 통일이라는 이번 fix 의 목적을 손상시키지 않는다. 하드코딩 시크릿, 인젝션, 인증/인가 우회 등 신규 위험은 발견되지 않았다.

## 위험도
NONE
