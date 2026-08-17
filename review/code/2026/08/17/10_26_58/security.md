# 보안(Security) 코드 리뷰

## 조사 방법

프롬프트에 diff 가 생략된 파일(`background-runs.service.spec.ts`·`executions.service.spec.ts`·
`executions.service.ts`·`websocket.service.spec.ts`·`websocket.service.ts`·
`sanitize-error-message.spec.ts`·`sanitize-error-message.ts`)은 워크트리의 실제 소스를
`Read`/`Grep` 으로 직접 열어 대조했다. 인용 줄 번호는 그 원본 파일의 실제 줄 번호다(해당
파일 전체를 읽었으므로 게이트 숫자와 일치). 이번 diff는 egress 마스킹 관문을
`Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData`, WS emit(wire·fanout)
양쪽으로 확장하는 보안 하드닝 PR이며, 같은 changeset에 대해 이미 4라운드(`23_08_19`,
`23_50_03`, `00_23_57`, `00_47_01`)의 ai-review가 선행되어 CRITICAL 1건(재제출 경로 오염)을
포함해 다수 항목을 조치·수렴시킨 이력이 있다. 이번 라운드는 그 누적 결과물에 대한 독립
재검증이다.

## 발견사항

- **[INFO]** `SECRET_LEAK_PATTERNS` 가 접두사/키워드 없는 bare `token=` 형태를 포착하지 못한다 (기지의 잔여 갭, 트래커 등재됨)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:33`-`52` (`SECRET_LEAK_PATTERNS` 배열)
  - 상세: 배열의 두 번째 패턴은 `client-secret`/`access-token`/`api-key`/`password`/`passwd`/`pwd` 등 명시적 키워드 뒤의 `=`/`:` 만 잡고, `secret` 단독 키워드는 세 번째 패턴이 별도로 잡는다. 그러나 `token` 단독(예: `token=sk-live-abc123`, `access_token`/`refresh_token` 이 아닌 순수 `token`)은 이 배열의 어느 패턴에도 매칭되지 않는다. `RESOLUTION.md`(`review/code/2026/08/16/23_08_19/RESOLUTION.md`)에 이미 "이 PR 이 만든 결함이 아니고 패턴 확장은 캐너리가 막는 별건" 이라며 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 자매 항목으로 등재했다고 기록돼 있고, `redact-stored-error.spec.ts` 의 캐너리 테스트(`'[캐너리] 자격증명 없는 연결 문자열은 통과한다 — error 와 같은 잔여 갭'`)가 이 경계를 명시적으로 고정하고 있다.
  - 제안: 조치 불요(이미 트래커에 등재되어 별도 작업으로 추적 중). 후속 라운드에서 `token=` bare 키워드를 두 번째 패턴 대안군(`client[_-]secret|access[_-]token|...`)에 추가할 때 캐너리가 함께 갱신되어야 한다는 점만 재확인.

- **[INFO]** 자격증명이 없는 연결 문자열·내부 호스트명은 마스킹을 통과한다 (설계상 의도된 경계, 트래커 등재됨)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:18`-`21` (JSDoc "보장의 경계"), `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` / `redact-stored-error.spec.ts` 의 관련 캐너리
  - 상세: `deepRedactSecrets`/`redactSecrets` 는 `SECRET_LEAK_PATTERNS` 가 겨냥하는 **자격증명 값**만 마스킹하고, `postgres://db.internal:5432/prod` 처럼 자격증명이 없는 DSN·내부 호스트명은 그대로 응답에 실린다. 이는 코드 주석·테스트 캐너리로 명시적으로 문서화된 경계이며 내부 호스트명 노출 정도는 별건 심각도가 낮다.
  - 제안: 조치 불요. 내부 인프라 위상 정보(호스트명·포트) 노출까지 막고 싶다면 별도 결정 항목으로 트래커에 남길 만하나 이번 diff 범위는 아니다.

- **[INFO]** `execution:<executionId>` WS 채널 구독 인가는 워크스페이스 소유만 검증하고 role 은 검사하지 않는다 (선존 상태, 이번 diff 가 만든 갭은 아니며 오히려 완화 방향)
  - 위치: `codebase/backend/src/modules/executions/execution-channel-authorizer.ts:26`-`40` (`ExecutionChannelAuthorizer.authorize`, `verifyOwnership(executionId, workspaceId)` 만 호출)
  - 상세: `authorize()`는 `workspaceId` 소유 여부만 확인하고 `role`(viewer/member/admin/owner)은 받지도 검사하지도 않는다. 즉 `execution:<id>` 채널 구독 인구는 `GET /api/executions/:id` 와 동일(워크스페이스 멤버 전원, viewer 포함)하다. 이번 diff의 `maskWireEnvelope`(`websocket.service.ts:356`-`394`)는 정확히 이 사실을 근거로 wire 단계에도 값-패턴 마스킹을 걸어 **내부 REST 읽기 경로와 노출 수준을 맞췄다** — 즉 이 diff는 이 갭을 새로 만든 것이 아니라 그 갭을 전제로 노출 표면을 좁히는 방향의 변경이다. role 기반 세분화 자체가 필요하다면 이는 이번 PR 범위를 벗어난 별도 인가 모델 결정이다.
  - 제안: 조치 불요(이번 diff 범위 밖, 오히려 완화). role 기반 접근 제어가 제품 요구사항이라면 별도 plan 항목으로 열 것을 권고.

- **[INFO]** `inputData`(`Execution` 레벨 한정)는 재제출 경로 보호를 위해 의도적으로 값-패턴 마스킹 대상에서 제외된다 — 외부 노출 표면(EIA 외부 API)에는 애초에 노출되지 않음을 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:57`-`91`(`MASKED_INPUT_DATA_REASON` 근거), `:1044`-`1045`(`toExecutionDto`), `:1108`-`1109`(`toResponseExecution`)
  - 상세: `grep -rn "inputData" codebase/backend/src/modules/external-interaction/` 결과 0건 — 외부 제3자용 EIA API(`external-interaction` 모듈)는 애초에 `inputData` 를 노출하지 않으므로, 이 carve-out으로 인한 잔여 평문 자격증명 노출은 **워크스페이스 내부 멤버(viewer 포함)로 스코프가 한정**된다(webhook 민감 헤더는 ingestion 시점에 이미 `[REDACTED]`). 다만 `workflow-assistant/tools/explore-tools.service.ts` 가 별도로 `inputData` 를 참조하는 경로가 존재하며, 이는 §R17 잔여 항목 "③ workflow-assistant LLM 도구의 약한 마스킹"으로 이미 별도 결정 항목으로 트래커에 열려 있고 이번 PR이 의도적으로 손대지 않은 범위임을 소스로 확인했다.
  - 제안: 조치 불요. carve-out의 근거(재제출 시 리터럴 `'***'` 오염 방지)가 타당하고 외부 노출 스코프가 실측으로 확인됨.

- **[INFO]** DB-at-rest는 마스킹되지 않은 원문을 그대로 보존한다 (egress-only 설계, 문서화된 트레이드오프)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:16`, `:60`-`61`
  - 상세: 이번 PR의 마스킹은 응답 직전(egress) 레이어에만 적용되고 DB 컬럼 값 자체는 원문으로 남는다. 이는 서버 로그·사후 디버깅 진실 보존을 위한 명시적 설계 결정(§R17과 동일 근거)이며 새로 도입된 리스크가 아니라 기존 `Execution.error` 마스킹과 동일한 정책을 `inputData`/`outputData`/WS emit으로 일관되게 확장한 것이다. DB 접근 권한이 있는 내부자/침해 시나리오에서는 여전히 평문이 노출된다는 점만 참고로 남긴다.
  - 제안: 조치 불요(설계 의도). 감사 로그·DB 접근 통제는 이 PR의 관심사 밖.

## 확인했으나 문제 없음 (참고)

- SQL 인젝션: 변경된 서비스 파일 전부 TypeORM `createQueryBuilder`/파라미터 바인딩만 사용, 문자열 결합 쿼리 없음.
- ReDoS: `SECRET_LEAK_PATTERNS`(`sanitize-error-message.ts:33`-`52`) 전 패턴이 선형(중첩 정량자·backtracking 폭발 지점 없음)이며 lookbehind(`(?<=:\/\/)`)도 고정 길이라 안전.
- 프로토타입 오염: `deepRedactObject`(`sanitize-error-message.ts:231`-`268`)는 항상 `{ ...value }` 얕은 복사로 새 객체를 만들고 재귀 깊이 상한(`MAX_REDACT_DEPTH=10`)이 있어 DoS·오염 벡터가 제한적.
- 마커 재마스킹 방지(`isMaskedMarker`, `sanitize-error-message.ts:130`-`132`)는 `webhook ingestion [REDACTED]` 계약과 `WS 키-마스킹 [REDACTED]` 계약을 값-패턴 마스킹 층이 덮어쓰지 않도록 정확히 경계를 좁혀 구현했다 — 마커 문자열 자체가 시크릿이 아니므로 이 설계로 인한 신규 노출 벡터는 없음.
- `llmCalls`(에디터 전용 raw 디버그 필드) preserve 예외는 wire 단계에서만 값-마스킹을 건너뛰고, fanout 단계에서는 `stripExternalOnlyFields` 가 필드째 제거(`websocket.service.ts:412`-`417`)하므로 외부 노출 증가 없음 — 테스트로 고정됨(`websocket.service.spec.ts` "llmCalls 는 wire 에서 원문 유지" 케이스).
- 테스트 fixture 의 자격증명값(`Bearer eyJhbGciOiJIUzI1NiJ9.LEAKED`, `sk-live-CONTROL`, `postgres://user:pw@db.internal...`)은 전부 명백한 합성 테스트 값이며 실제 시크릿 하드코딩 아님.
- 새 응답 마스킹 관문 6곳(`findById`/`getChain`/`stop`/`toExecutionDto`/`nodeExecutions[]`/`BackgroundRunsService.toNodeExecutionDto`)이 `executions.service.ts:1072`-`1091` JSDoc 표로 정본화되어 있고, 실제 코드가 그 표와 일치함을 개별 확인 — 과거 반복된 "자매 표면 중 하나만 관문을 잃는" 결함 클래스가 구조적으로 억제됨.

## 요약

이번 changeset은 `Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData` 응답 egress에 값-패턴 자격증명 마스킹을 신설하고, WS emit(wire·fanout) 경로에도 같은 마스킹을 확장 적용하는 보안 하드닝 PR이다. 마스킹 로직(재귀 깊이 상한, copy-on-change, 키-이름/값-패턴 이중 방어, 마커 멱등성, 외부/내부 예외 경계)을 소스 레벨에서 직접 재검증한 결과 구조적 결함은 발견되지 않았고, SQL 인젝션·ReDoS·프로토타입 오염 등 전통적 인젝션류 취약점도 확인되지 않았다. 하드코딩된 시크릿도 없다(테스트 fixture는 합성 값). `inputData` carve-out은 재제출 경로 오염을 막기 위한 의도된 설계이며 외부 EIA API에는 애초에 노출되지 않음을 실측으로 확인했다. 남은 항목(`token=` bare 패턴 미포착, 자격증명 없는 DSN 통과, WS 채널 구독의 role 미검사)은 모두 이미 문서·트래커에 등재되었거나 이번 PR이 오히려 완화하는 방향의 선존 상태로, 신규 CRITICAL/WARNING 급 결함은 발견하지 못했다.

## 위험도
LOW
