# Testing 리뷰 — webhook 400 error.details[] (2026-06-28 12_45_21)

## 발견사항

- **[INFO]** `toTriggerParameterErrorDetails` 단위 테스트: 세 reason 모두 매핑 + 빈 배열 케이스 포함 — 완전
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts` L392–421
  - 상세: `missing_required`, `coerce_failed`, `invalid_schema` 세 분기 모두 exact-match 단언. 빈 배열 엣지케이스도 별도 케이스로 존재. 이전 RESOLUTION INFO #6·#7(중복 케이스 삭제, 테스트명 수정)이 이미 반영된 상태이다.
  - 제안: 없음 — 현재 상태 충분.

- **[INFO]** `hooks.service.spec.ts` mock 구조 — RESOLUTION WARNING #1 처리 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.spec.ts` L256–284
  - 상세: `resolveTriggerParameters`와 `toTriggerParameterErrorDetails`는 jest mock 없이 실제 구현체가 import·실행된다. `triggerRepo`, `nodeRepo`, `engine` 만 mock되며, 파라미터 변환 경로는 실 코드를 통과한다. RESOLUTION에 "real path가 검증됨 확인"으로 기록되었고, diff에서 변환 경로를 우회하는 모듈 mock이 없음을 확인했다. 이전 WARNING은 올바르게 해소됐다.
  - 제안: 없음.

- **[INFO]** `workflows.controller.spec.ts` manual-trigger 경로 — RESOLUTION INFO #4/#14 처리 확인
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/workflows/workflows.controller.spec.ts` L138–151
  - 상세: `INVALID_TRIGGER_PARAMETERS` + `details[]` 봉투 단언이 추가됐다. `response.code`, `response.details` 각각 별도 단언으로 검증하고, `executeMock.not.toHaveBeenCalled()` 도 유지됐다. webhook 경로(`hooks.service.spec`) 대칭이 갖춰졌다.
  - 제안: 없음.

- **[INFO]** e2e B3 — `TYPE_COERCION_FAILED` 서브케이스 포함 여부 (RESOLUTION INFO #5 처리 확인)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/test/webhook-trigger.e2e-spec.ts` B3 케이스 (L683–694)
  - 상세: B3 내에 `amount` 파라미터(number 타입)를 노드에 추가하고, `amount: 'not-a-number'` 전송 시 `TYPE_COERCION_FAILED` 필드코드를 단언하는 서브케이스가 포함됐다. MISSING_REQUIRED_FIELD(res)와 TYPE_COERCION_FAILED(res2) 두 시나리오가 단일 e2e 케이스 내에서 순차 검증된다.
  - 제안: 두 시나리오가 서로 다른 요청을 보내므로 격리는 양호하다. 단, 동일 워크플로에서 두 시나리오를 실행하므로 `orderId` 누락→`amount` 비숫자 순서가 고정된다. 향후 병렬 실행 시 공유 `path`(random UUID)로 인한 충돌 가능성 없음 — 이미 안전.

- **[INFO]** `INVALID_SCHEMA` runtime 미도달 경로 테스트
  - 위치: `resolve-trigger-parameters.spec.ts` L392–421
  - 상세: `invalid_schema`는 저장 시점 검증(`validateTriggerParameterSchema`)에서만 발생하고, webhook/manual 런타임 경로(`resolveTriggerParameters`)에서는 도달하지 않는다. 단위 테스트는 white-box 완전성으로 세 번째 entry를 포함하고 있으며 이는 유효한 선택이다. 단, JSDoc에 `invalid_schema`가 런타임 경로에서 미도달임을 명시하지 않아 향후 혼동 여지가 있다(INFO 수준, 차단 불필요).
  - 제안: `toTriggerParameterErrorDetails` JSDoc에 `@note invalid_schema is mapped for completeness; it is not reachable from runtime webhook/manual-trigger paths` 한 줄 추가 권장(선택).

- **[INFO]** e2e B3 직접 DB `UPDATE node` 조작
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` L636–646
  - 상세: 파라미터 설정을 API 경로 없이 DB에 직접 `UPDATE node SET config = $1 WHERE ...`으로 주입한다. 스키마 변경 시 조용히 깨질 수 있으며, 프로젝트 내 다른 e2e와 이질적인 관행이다. RESOLUTION INFO #10 에서 "후속 정리 사안"으로 기록됐고 본 리뷰도 동일하게 판단한다.
  - 제안: `setupNodeWithParameters(db, wfId, parameters)` 헬퍼 추출 후속 작업으로 남겨둔다.

- **[INFO]** 테스트 격리 — e2e B3 전용 워크플로 분리
  - 위치: `webhook-trigger.e2e-spec.ts` B3 케이스
  - 상세: B3는 `uniqueName('hook-b3')`와 새 `wfId`로 독립 워크플로를 생성하고, `endpointPath`도 `crypto.randomUUID()`로 분리한다. 공유 `workflowId`를 오염시키지 않아 다른 B/C 케이스와의 간섭이 없다. 격리 설계 양호.
  - 제안: 없음.

- **[INFO]** 구 flat 형식 회귀 단언
  - 위치: `webhook-trigger.e2e-spec.ts` L678–679
  - 상세: `res.body.errors`와 `res.body.error.errors`가 `undefined`임을 명시적으로 단언한다. 구 포맷으로의 회귀를 e2e 수준에서 방지하는 좋은 패턴이다.
  - 제안: `hooks.service.spec.ts`와 `workflows.controller.spec.ts` 단위 테스트에도 `response.errors`가 `undefined`임을 단언하면 회귀 방어가 더 강해진다(선택적 보강).

## 요약

변경된 코드 전체(신규 helper `toTriggerParameterErrorDetails`, `hooks.service` / `workflows.controller` 두 throw 경로, unit·e2e 테스트)에 대한 테스트 커버리지가 충분하다. 세 reason 분기 모두 unit 단언, 두 실서비스 경로(`INVALID_WEBHOOK_PAYLOAD` / `INVALID_TRIGGER_PARAMETERS`) 각각 단위 테스트, e2e B3에서 MISSING_REQUIRED_FIELD + TYPE_COERCION_FAILED 두 시나리오 실검증이 확인됐다. 이전 SUMMARY WARNING #1(mock 여부 불명확)은 실 구현체가 mock 없이 실행됨을 확인하고 RESOLUTION에서 올바르게 해소됐다. INFO 수준의 개선 여지(JSDoc runtime 미도달 명시, 단위 테스트에서 구 포맷 undefined 단언 추가, e2e DB 조작 헬퍼 추출)만 남아 있으며, 모두 차단 요인이 아니다.

## 위험도

NONE
