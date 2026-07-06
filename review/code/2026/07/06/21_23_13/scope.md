# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan 항목 3(`dispatchEmails` decouple 검토)이 코드 변경 없이 "결정 대기"로 남아 리뷰 대상에서 제외됨
  - 위치: `plan/in-progress/notif-hardening-followups.md` 항목 3
  - 상세: plan 문서 자체에 "분석 완료 — 결정 대기"로 명시돼 있고 실제로 diff 어디에도 `dispatchEmails` 관련 코드 변경이 없다. 계획에 포함됐으나 구현하지 않은 것은 스코프를 부풀리지 않은 정상적 판단이며, 오히려 "요청 이상은 안 건드림" 원칙에 부합한다. 감점 요소 아님, 참고로만 기록.
  - 제안: 없음 (정상). 후속 PR 에서 사용자 결정 후 별도 처리 예정임이 plan 에 명시돼 있어 추적 가능.

- **[INFO]** `background-execution.processor.spec.ts` 테스트 케이스 제목 변경
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.spec.ts:148`
  - 상세: `it('falls back to executionId for resource attribution when backgroundRunId is empty (legacy NodeExecution)', ...)` → `it('keeps workflow deep-link and omits attribution when backgroundRunId is empty (legacy NodeExecution)', ...)`. 동작 자체가 바뀐 테스트이므로(legacy fallback 제거) 제목 변경은 실질 변경에 부수하는 정당한 갱신이며 무관한 리네이밍이 아니다.
  - 제안: 없음.

- **[INFO]** `notification-response.dto.ts` 의 Swagger 문서/예시 값 갱신 (`workflow.failed` → `execution_failed`, `execution`/`background_run` → `workflow`/`integration`/`workspace_invitation`)
  - 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts:14-21,588-621`
  - 상세: 이 변경은 새 컬럼(`background_run_id`) 도입에 따라 REST 계약 문서가 실제 발행값과 어긋나지 않도록 정합성을 맞추는 것으로, consistency-check WARNING(#2)에서 지적된 항목을 그대로 처리한 것이다. 범위 확장이 아니라 이번 변경이 유발한 문서 drift 를 좁힌 정당한 부수 수정.
  - 제안: 없음.

## 요약

변경 파일 15개는 plan `notif-hardening-followups.md` 항목 1(`background_failed` 딥링크/attribution 분리, migration V107)과 항목 2(execution_failed 통합 e2e 신설)를 정확히 커버하며, 각 코드 수정이 plan 체크리스트 항목과 1:1 대응된다. 마이그레이션(V107), 엔티티 컬럼 추가, `NotificationsService.findByResource → findByBackgroundRun` 개명, processor/서비스의 attribution 로직 변경, 관련 unit/e2e 테스트 갱신, 신규 e2e 파일, plan 문서 2건(작업 tracker + spec-update 위임 draft), 그리고 이 변경에 선행한 consistency-check 산출물(`review/consistency/...`)까지 모두 이번 작업의 직접 산출물이거나 필수 절차(impl-prep 게이트)의 증적이다. `NotificationsService.notify/createMany` 시그니처에 `backgroundRunId?` 필드 추가, DTO 문서 갱신, `executions.module.ts` 주석 갱신 등은 모두 컬럼 신설이라는 단일 변경이 자연스럽게 요구하는 연쇄 수정이며 별도의 리팩토링이나 기능 확장으로 보이지 않는다. 항목 3(email dispatch decouple)은 분석만 하고 코드 변경 없이 결정 대기로 남겨, 스코프를 임의로 확장하지 않은 점도 긍정적이다. 포맷팅/임포트/무관 파일 수정, 주석의 불필요한 추가·삭제 패턴은 발견되지 않았고, 모든 주석 변경은 딥링크/attribution 분리라는 변경 사유를 설명하는 데 직접 기여한다.

## 위험도
NONE
