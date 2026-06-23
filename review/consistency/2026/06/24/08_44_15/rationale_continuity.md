# Rationale 연속성 검토 결과

검토 모드: `--impl-done`
Target 문서: `spec/3-workflow-editor/4-ai-assistant.md`
변경 범위: `AssistantFinishGuard` 추출 (M-3 2단계) — `assistant-finish-guard.service.ts` 신설, `collect-pending-user-config.ts` 분리, `isPlanPendingApproval` → `active-plan-context.ts` 이동, `WorkflowAssistantStreamService` 관련 private 메서드 제거

---

## 발견사항

### 발견사항 1

- **[WARNING]** Spec Rationale 내부 불일치 — `finishBlockCount > 0` skip 조건이 이전 섹션에 여전히 기재됨
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` line 958 (`Part B review skip 조건` 소목록의 세 번째 항목)
  - 과거 결정 출처: 동일 파일 `## Rationale` → `항목 5. Review guard 항상 발동` (line 1072-1088)
  - 상세: `Part B review skip 조건` 섹션(line 952-961)의 skip 조건 목록에 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복` 이 아직 기재되어 있다. 그러나 같은 Rationale 내 항목 5 (line 1072-1088)는 이 조건을 "사용자 요구로 **제거**" 했다고 명시하며, "남은 skip 조건 (최소 안전망)" 목록에도 해당 항목이 없다. 구현(`assistant-finish-guard.service.ts` `shouldSkipReview`)은 항목 5를 따라 `finishBlockCount > 0` 체크가 없다. 즉 spec 본문(비Rationale 영역)·항목 5·구현은 일치하지만, `Part B review skip 조건` 소목록만 구식 상태로 남아 있다.
  - 제안: `spec/3-workflow-editor/4-ai-assistant.md` line 958의 `state.finishBlockCount > 0 …` 항목을 삭제하거나 "~~제거됨 (항목 5)~~" 취소선으로 처리해 두 Rationale 섹션 간 모순을 해소한다.

### 발견사항 2

- **[INFO]** M-3 2단계 추출 결정에 대한 Rationale 갱신 부재 — spec에 `AssistantFinishGuard` 추출을 언급하는 항목 없음
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` `## Rationale` 전체 (line 805-끝)
  - 과거 결정 출처: `plan/in-progress/refactor/02-architecture.md` M-3 옵션 비교표 — 옵션 B("가드는 `streamMessage` 잔류")를 명시 기각, 옵션 A("추출") 채택
  - 상세: plan 문서(02-architecture.md M-3)에는 `AssistantFinishGuard` 를 별도 `@Injectable` 로 추출하는 결정(옵션 A)과 기각된 대안(옵션 B — 가드 `streamMessage` 잔류)이 기록되어 있다. 그러나 spec Rationale 에는 이 구조적 변경 결정이 반영되지 않았다. 코드 주석(`assistant-finish-guard.service.ts` 클래스 JSDoc)과 plan 문서로 근거가 추적 가능하므로 기능 동작에는 영향이 없으나, spec Rationale 만 읽는 사람은 "왜 별도 서비스인가"를 알 수 없다.
  - 제안: spec Rationale `Part B` 또는 유지보수 체크리스트 아래에 M-3 2단계 결정 단락("가드 캡슐화 — `AssistantFinishGuard` 별도 `@Injectable` 으로 추출, 옵션 B 기각 근거")을 간략히 추가한다. 단 `spec/` 쓰기는 project-planner 역할의 전용 권한이므로, 개발자 단독으로 수정 불가 — 후속 spec 갱신 이슈로 등록 권장.

### 발견사항 3

- **[INFO]** `collect-pending-user-config.ts` 분리 결정의 Rationale 미기재
  - target 위치: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` (신규 파일), 관련 spec: `spec/3-workflow-editor/4-ai-assistant.md`
  - 과거 결정 출처: spec Rationale `Part B 유지보수 체크리스트` — "SRP 분리" follow-up 항목(line 1000)에 `ShadowWorkflow SRP 분리 (ShadowWorkflowErrorAdvisor)` 는 있으나 `collectPendingUserConfig` 분리는 별도 follow-up으로 명시되지 않음
  - 상세: `collect-pending-user-config.ts` 가 `WorkflowAssistantStreamService.collectPendingUserConfig` private 메서드를 독립 함수로 추출해 edit 경로와 review 가드가 공유하도록 한 것은 스펙 follow-up 목록에 없던 파생 결정이다. 기각 대안 재도입은 아니며, 위반이라기보다 미기록에 해당한다.
  - 제안: spec Rationale follow-up 항목에 "~~`collectPendingUserConfig` → `collect-pending-user-config.ts` 독립 함수 (M-3 2단계 완료)~~" 로 완료 표기 추가 권장 (project-planner 위임).

---

## 요약

Rationale 연속성 관점에서 가장 주목할 충돌은 **`spec/3-workflow-editor/4-ai-assistant.md` 내부의 `finishBlockCount > 0` skip 조건 이중 기재**다. 구현은 항목 5(최신 결정 — 조건 제거)를 올바르게 따르므로 동작 회귀는 없지만, 스펙 `Part B review skip 조건` 소목록이 아직 구식 상태라 미래 유지보수자가 혼란을 겪을 수 있다. M-3 2단계(`AssistantFinishGuard` 추출)는 plan 문서에서 옵션 B(잔류)를 명시 기각하고 옵션 A(추출)를 채택한 결정을 그대로 구현하므로 기각 대안 재도입은 없다. 나머지 발견사항은 모두 결정 누락(INFO) 수준이며 합의된 설계 원칙을 직접 위반하지 않는다.

---

## 위험도

LOW
