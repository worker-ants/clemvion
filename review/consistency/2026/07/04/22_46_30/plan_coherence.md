# Plan 정합성 검토 결과

## 참고: payload mis-scope

`_prompts/plan_coherence.md` 의 "Target 문서" 섹션은 `spec/5-system/1-auth.md`(인증/인가/세션) 전체 본문을 담고 있어, 실제 target 인 "ImportWorkflowDto.settings opaque 비대칭" 작업(`plan/in-progress/import-workflow-settings-dto.md`)과 무관하다. 지시에 따라 payload 대신 plan 문서(`plan/in-progress/import-workflow-settings-dto.md`, `plan/in-progress/exec-intake-followups.md`, `plan/in-progress/workflow-cap-validated-dto.md`)와 관련 spec(`spec/5-system/4-execution-engine.md §2.4/§Rationale`)을 직접 읽어 분석했다.

## 발견사항

- **[INFO]** 후속 항목 정합 확인 — 계획대로 진행 중
  - target 위치: `plan/in-progress/import-workflow-settings-dto.md` 전체(설계 결정 1~3)
  - 관련 plan: `plan/in-progress/workflow-cap-validated-dto.md` "후속(별도) — ImportWorkflowDto.settings opaque 비대칭" 섹션(완료 처리된 선행 plan 이 명시적으로 분리 예고한 항목), `plan/in-progress/exec-intake-followups.md` "PR2b 후속" 두 번째 체크(완료) 항목의 각주 "후속(별도): ImportWorkflowDto.settings opaque 비대칭"
  - 상세: `import-workflow-settings-dto.md` 는 두 선행 plan 이 이미 명시적으로 예고·분리해 둔 후속 항목을 그대로 이행하는 것으로, 새로운 미해결 결정을 우회하거나 선행 plan 의 가정을 어기지 않는다. `WorkflowSettingsDto`(nested, `@IsInt @Min(1) maxConcurrentExecutions`)는 `workflow-cap-validated-dto.md` PR(완료, PR #805 로 지칭)에서 이미 만들어졌고 재사용만 하므로 신규 DTO/파일이 생기지 않는다. spec 근거(`spec/5-system/4-execution-engine.md` §2.4 참조, `Workflow.settings.maxConcurrentExecutions` 단일 키 스코프)도 선행 plan 과 target plan 이 동일하게 인용하고 있어 어긋나지 않는다.
  - 제안: 갱신 불요. 진행해도 무방.

- **[INFO]** service 계층 비대칭(merge vs replace)은 의도적으로 범위 밖으로 명시됨
  - target 위치: `plan/in-progress/import-workflow-settings-dto.md` "설계 결정 3" ("service `importWorkflow` 무변경(신규 생성이라 merge 불요)")
  - 관련 plan: `plan/in-progress/workflow-cap-validated-dto.md` "설계 결정 3" (`update` 는 spread-merge 채택, DB 잔여 키 보존)
  - 상세: `UpdateWorkflowDto` 경로는 merge(기존 settings 와 병합)이고 `ImportWorkflowDto` 경로는 신규 엔티티 생성이라 overwrite(`dto.settings ?? {}`)다. 이 비대칭은 이미 데이터 흐름상 자연스러운 차이(신규 생성 vs 기존 리소스 갱신)이며 target plan 이 "무변경" 으로 명확히 이유를 밝히고 있어 은폐된 결정이 아니다. 다만 향후 리뷰어가 "import 도 merge 해야 하는가" 재질문할 가능성이 있으므로, 구현 완료 후 PR 설명/CHANGELOG 에 "신규 생성이므로 merge 대상 자체가 없다" 는 근거를 한 줄 남겨두면 반복 문의를 줄일 수 있다.
  - 제안: 필수 아님. 체크리스트의 "CHANGELOG(import 엔드포인트 narrowing)" 항목 작성 시 이 근거를 한 줄 포함 권장.

- **[INFO]** exec-intake-followups.md 의 관련 없는 트랙과 혼동 주의
  - target 위치: 없음(정보성)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "exec-engine 무관 (별도 트랙)" — `spec/5-system/1-auth.md` 초대 에러코드 casing·WebAuthn 응답 포맷 Critical 2건
  - 상세: 동일 plan 파일 안에 "auth Critical 2건" 이 별도 트랙으로 명시돼 있는데, 금번 payload 의 mis-scope(target 문서가 통째로 `1-auth.md` 로 채워진 것)가 이 문구와 우연히 겹쳐 혼동을 유발할 소지가 있다. 실제로는 target 작업(ImportWorkflowDto)과 무관한 별개 결정 사항이다.
  - 제안: 없음. orchestrator 측 payload 생성 로직 점검을 권장(본 리뷰의 범위 밖이지만 재발 방지 차원에서 기록).

## 요약

Payload 가 `spec/5-system/1-auth.md` 전체로 mis-scope 되어 있어 plan 문서를 직접 읽어 분석했다. `import-workflow-settings-dto.md` 는 이미 완료된 `workflow-cap-validated-dto.md` PR 이 명시적으로 예고·분리해 둔 후속 항목을 그대로 이행하며, 재사용하는 `WorkflowSettingsDto`·spec 근거(§2.4 단일 키 스코프)·검증 강도 정책 모두 선행 plan 과 정합한다. 미해결 결정을 우회하거나 다른 plan 의 사전조건·후속 항목을 침해하는 지점은 발견되지 않았다. 유일한 실무 이슈는 orchestrator 의 payload 생성이 target 문서를 잘못 채운 것으로, 이는 plan 정합성과 무관한 별개 결함이다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
