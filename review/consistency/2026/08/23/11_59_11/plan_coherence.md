# Plan 정합성 검토 — `plan/in-progress/swagger-decisions.md`

## 검토 방법
- `plan/in-progress/**` 전수(`spec-sync-external-interaction-api-gaps.md` 등 65개 plan, 번들이 컨텍스트
  예산으로 절단된 파일은 파일시스템에서 직접 재확인) 대상으로 target 문서가 인용하는 정본 트래커
  (`spec-sync-external-interaction-api-gaps.md`)의 해당 3개 "사용자 판단 필요" 항목 원문을 대조.
- `ExecuteWorkflowDto`·`여분 키`·`길이 규칙`·`deprecat` 키워드로 다른 in-progress plan 에 상충·의존
  항목이 있는지 전수 grep.
- target 이 이미 부분 구현된 상태(uncommitted diff)라 실제 코드/스펙 반영이 plan 서술과 어긋나지
  않는지 대조.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

### 대조 상세 (참고용, 비-발견)

1. **① `execute` 여분 키 400 거부 → (b) 현행 유지**: 트래커
   `spec-sync-external-interaction-api-gaps.md:942-949` 의 미해결 항목(`execute-body-dto` 이연
   결정)과 정확히 대응한다. 트래커는 옵션을 명시하지 않고 "사용자 판단 필요"로만 열어 뒀고,
   target 은 그 판단을 "코드 무변경 + 비대칭(execute 미검증/re-run 검증)을 의도로 기록"으로
   집행한다 — 트래커가 이미 내려둔 결정과 충돌하지 않는다(트래커 자체는 결정을 내린 적이 없다).
2. **② `ExecuteWorkflowDto.input` 동명이의 → `deprecated: true`**: 트래커
   `:957-969` 가 "checker 가 제안한 `legacyInput` 리네임은 성립하지 않는다"는 동일한 실측 근거
   (`body?.input` 런타임 의존)를 이미 기록해 뒀고, target 은 그 결론을 그대로 승계해 리네임이
   아닌 `deprecated` 플래그로 집행한다. 코드(`execute-workflow.dto.ts`)·회귀 테스트
   (`workflows-execute-body.spec.ts`)에 이미 반영돼 있어 서술과 구현이 일치한다.
3. **③ `swagger.md §3` 길이 규칙 → (c) 강제 대상 아님 명문화**: 트래커
   `:990-999` 가 명시적으로 (a)/(b)/(c) 세 대안을 나열하며 "§3 예외 확장과는 별개 판단"이라고
   범위를 미리 갈라 뒀다. target 은 그중 (c)를 택했고, 이는 이미 별도로 종결된 "§3 보안·정책
   캐비엇 예외 확장"(`:911-931`, 2026-08-22 planner 턴에서 완료)과 충돌하지 않는다 — `swagger.md`
   Rationale 에 이미 두 절(`§3 보안·정책 캐비엇 예외` / `§3 DTO 길이는 왜 강제가 아닌가`)이 분리돼
   있어 병존한다.
4. **다른 plan 과의 상충 여부**: `10~40자`/`길이 규칙`/`ExecuteWorkflowDto`/`legacyInput`/
   `forbidNonWhitelisted` 키워드로 65개 in-progress plan 전수를 확인한 결과, 이 3개 결정에
   의존하거나 반대 방향을 전제하는 다른 plan 항목은 없었다(`node-output-redesign/*`·
   `exec-intake-followups.md` 의 `deprecat`/`forbidNonWhitelisted` 언급은 전혀 다른 엔드포인트·
   필드에 대한 것으로 무관).
5. **선행 조건**: target 이 가정하는 사전 조건(트래커에 3건이 "사용자 판단 필요"로 열려 있다는
   것, `execute-body-dto`·`§3 예외 확장` 선행 작업이 이미 머지됐다는 것)은 모두 `git log`
   (`ee7559635`, `4ba15859f` 등)와 트래커 본문으로 실측 확인되며, 아직 미해소된 선행 plan은
   없다.
6. **후속 항목**: target 의 "작업" 체크리스트에 이미 "트래커 3건 종결(결정과 사유 기록)"이
   포함돼 있어, 이 plan이 종료되면 `spec-sync-external-interaction-api-gaps.md` 의 대응 3개
   `[ ]` 를 함께 닫아야 한다는 후속 항목이 target 자체에 이미 반영돼 있다 — 별도로 추가할
   누락은 없다.

## 요약
target(`plan/in-progress/swagger-decisions.md`)이 인용하는 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)의 3개 "사용자 판단 필요" 항목과 1:1 대응하며,
각 결정(①현행 유지 ②`deprecated` 표시 ③강제 대상 아님 명문화)이 트래커가 이미 기록해 둔 실측
근거·대안 목록과 어긋나지 않는다. 다른 64개 in-progress plan 중 이 3개 결정에 의존하거나
반대 방향을 전제하는 항목은 발견되지 않았고, 코드·스펙 diff 는 이미 target 서술과 일치하게
반영돼 있다. 유일하게 남는 것은 target 자신의 체크리스트/트래커 체크박스 동기화(작업 완료 시
반영 예정)뿐이며 이는 이미 target 의 작업 목록에 포함돼 있다.

## 위험도
NONE
