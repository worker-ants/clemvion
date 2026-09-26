# 신규 식별자 충돌 검토 — assistant-e2e-contract-gaps (--impl-prep)

## 검토 전제 확인

이번 `--impl-prep` 검토의 대상 plan(`plan/in-progress/assistant-e2e-contract-gaps.md`)은
`spec_impact: none` 이며, 작업 범위가 `codebase/backend/test/workflow-assistant.e2e-spec.ts`
**테스트 파일 한 곳**에 국한된다 (제품 코드·spec 변경 없음). bundle 에 실린 target 문서
`spec/3-workflow-editor/4-ai-assistant.md` 는 이번 작업으로 **새로 작성되거나 수정되는 문서가
아니다** — worktree 기준 `git diff --stat HEAD` 가 비어 있고, 해당 spec 파일은 기존 커밋
(`23929195d` 등)에서 이미 병합·구현 완료(`status: implemented`) 상태로 존재한다. 즉 이번 턴의
target 은 "새 식별자를 도입하는 신규/변경 spec" 이 아니라, 이미 구현되어 있는 기존 기능에 대한
**참조용 컨텍스트**로 번들링된 것이다.

plan 본문이 명시하는 처방 세 칸(§처방 1~3)도 다음과 같이 전부 **기존에 이미 존재하는 식별자**를
대상으로 한 테스트 단언 추가일 뿐, 신규 이름을 도입하지 않는다:

| 처방 항목 | 관련 식별자 | 기존 사용처 (사전 확인) |
|---|---|---|
| `data: null` 케이스 | `ApiOkWrappedNullableResponse` | `codebase/backend/src/common/swagger/api-wrapped.ts`, `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts`, `spec/conventions/swagger.md` 에 이미 정의·사용 중 |
| `sessions/latest` 분기 | `findLatestActive` (서비스 메서드) | `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`, `.controller.ts`, `migrations/V019__workflow_assistant.sql` 에 이미 존재 |
| 도구 호출 선택 키 생략 케이스 | `planStepId` / `planStepIds` / `signature` / `result` | 테스트 파일 내 기존 assertion(예: L261~263 부근)에서 이미 사용 중인 필드명 — 새 필드 추가 아님, 동일 필드에 대한 "전부 생략" 케이스 하나를 배열에 추가하는 것 |

새 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 이벤트/메시지명, 새 ENV
var·config key, 새 spec 파일 경로 중 어느 것도 이번 target 에 **새로** 도입되지 않는다.

## 발견사항

없음 — target 문서가 이번 턴에 신규 도입하는 식별자가 존재하지 않아 6개 점검 관점(요구사항 ID·
엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 모두 해당 사항 없음.

## 요약

이번 `--impl-prep` 호출의 실제 변경 스코프는 `codebase/backend/test/workflow-assistant.e2e-spec.ts`
에 국한된 테스트 전용 작업이며, 번들에 포함된 target spec(`spec/3-workflow-editor/4-ai-assistant.md`)은
이미 병합·구현 완료된 기존 문서로 이번 작업이 수정하거나 새로 도입하는 대상이 아니다. plan 이
명시한 세 처방 항목 모두 `ApiOkWrappedNullableResponse`·`findLatestActive`·`planStepId`/
`planStepIds`/`signature` 등 codebase 에 이미 존재하는 식별자를 대상으로 한 테스트 assertion
추가일 뿐이므로, "신규 식별자가 기존 사용처와 충돌하는가" 라는 본 checker 의 관점에서 검토할
신규 식별자 자체가 없다.

## 위험도

NONE
