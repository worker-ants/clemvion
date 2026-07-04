# Plan 정합성 검토 — workflow-level cap validated write DTO

## 검토 메모 (payload scope 이슈)

`_prompts/plan_coherence.md` 의 payload 는 `spec/5-system/` 를 대상으로 지정했으나 실제 본문 내용은 auth(1-auth.md)·knowledge-base(graph 확장)·cafe24 백로그·기타 진행 중 plan 문서 여러 건이 이어붙여진 것으로, 이번 변경(workflow-level cap validated write DTO)의 실제 target 코드/diff 는 payload 에 포함되어 있지 않았다. 지시에 따라 plan 문서와 코드를 직접 절대경로로 읽어 검토했다:

- `plan/in-progress/exec-intake-followups.md`
- `plan/in-progress/workflow-cap-validated-dto.md`
- `spec/5-system/4-execution-engine.md` §8 (concurrency cap 표)
- `codebase/backend/src/modules/workflows/{dto/update-workflow.dto.ts, dto/workflow-settings.dto.ts, dto/import-workflow.dto.ts, workflows.service.ts, workflows.controller.ts}` (HEAD, 워크트리 `workflow-cap-dto-bca77e`)
- git log: `4dd8d0701`(구현) · `c8dbd0f6e`(ai-review clean + INFO 보강)

## 발견사항

- **[INFO]** plan 체크리스트 미갱신 (실제 상태 후행)
  - target 위치: `plan/in-progress/workflow-cap-validated-dto.md` 체크리스트 `- [ ] ai-review + impl-done consistency`, `- [ ] PR`
  - 관련 plan: 동일 문서
  - 상세: git log 상 `c8dbd0f6e`(21:27) 커밋 메시지가 "8-reviewer ai-review(21_11_10) Critical/Warning 0" 을 명시하고 `review/code/2026/07/04/21_11_10/` 산출물(SUMMARY.md 등)까지 커밋되어 ai-review 단계는 이미 완료된 것으로 보이나, plan 문서의 체크박스는 아직 미체크 상태다. PR 생성 여부는 이 diff 범위에서 확인 불가.
  - 제안: 이번 검토 이후 커밋에서 `workflow-cap-validated-dto.md` 체크리스트를 실제 상태(ai-review 완료)로 갱신할 것. CRITICAL/WARNING 급은 아니며 plan 라이프사이클 위생 문제.

- **[INFO]** ImportWorkflowDto 비대칭 defer — spec 미반영은 의도된 것으로 확인됨
  - target 위치: `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` (`settings?: Record<string, unknown>`, opaque)
  - 관련 plan: `plan/in-progress/workflow-cap-validated-dto.md` "## 후속(별도) — ImportWorkflowDto.settings opaque 비대칭"
  - 상세: 실 코드 확인 결과 `ImportWorkflowDto.settings` 는 여전히 `@IsObject` 수준의 opaque Record 이며, 이번 PR 은 `UpdateWorkflowDto.settings` 만 strict nested DTO(`WorkflowSettingsDto`)로 전환했다. plan 은 이를 "낮은 우선순위 후속 검토"로 명시적으로 defer 했고, `spec/5-system/4-execution-engine.md` §8 이나 다른 spec 문서에도 import 경로의 검증 강도를 별도로 규정하는 문구가 없어 spec 과 충돌하지 않는다. frontmatter `spec_impact: none` 과 일치.
  - 제안: 별도 조치 불요 — defer 결정과 spec 상태가 이미 정합. 추적 메모로만 기록.

- **[INFO]** exec-intake-followups.md 잔여 항목과의 영향 관계 — 무관 확인
  - target 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`update` 메서드, settings spread-merge)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "곁들임 INFO 리팩터 묶음"(ARCH#4~6, MAINT#9) 및 "orphan pending backstop"
  - 상세: 이번 변경은 write-DTO 검증 계층(`UpdateWorkflowDto`/`WorkflowSettingsDto`)과 `workflows.service.update` 의 병합 로직만 건드리며, `resolveConcurrencyCap`·admission gate·`recoverStuckExecutions`·`execution-limits.ts` 등 exec-intake-followups.md 잔여 항목이 다루는 실행/큐 로직 코드는 diff 에 포함되지 않았다(`git diff --stat origin/main HEAD` 확인: 7개 파일, 전부 workflows 모듈+plan 문서). 잔여 항목들을 무효화하거나 새 후속을 만들 필요는 없다.
  - 제안: 조치 불요.

## 요약

`workflow-cap-validated-dto.md` 는 `exec-intake-followups.md` 의 "workflow-level cap validated write DTO" 항목을 그대로 이행했고, 설계(nested strict DTO + spread-merge)·권한(Editor+)·spec §8 정합성 모두 실제 코드(HEAD)와 일치한다. ai-review 는 이미 clean(Critical/Warning 0)으로 완료되어 커밋에 반영되었으나 plan 체크리스트는 이를 미반영 상태로 남겨 실제 진행 상태보다 뒤처져 있다(INFO). ImportWorkflowDto 비대칭은 명시적으로 defer 되었고 spec 어디에도 이를 규정하는 문구가 없어 정합하다. 다른 plan(exec-intake-followups.md 잔여 항목, orphan pending backstop 등)의 후속 항목을 무효화하거나 새로 만들어야 할 변경은 발견되지 않았다. 미해결 결정 우회나 선행 plan 미해소 사례도 없다.

BLOCK: NO

STATUS: SUCCESS
