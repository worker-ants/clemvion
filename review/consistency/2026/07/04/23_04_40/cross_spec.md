# Cross-Spec 일관성 검토 — cross_spec

## 대상

- target: `spec/2-navigation/` (검토 모드: --impl-done, diff-base=`origin/main`)
- 실질 변경: `ImportWorkflowDto.settings` 를 `Record<string, unknown>` (permissive) 에서
  `WorkflowSettingsDto` (strict nested, `UpdateWorkflowDto.settings` 와 동일 클래스 재사용) 로 변경.
  `workflows.service.ts` 는 검증된 DTO 인스턴스를 jsonb Record 로 스프레드 평탄화.
  `spec/2-navigation/1-workflow-list.md` §3.2 item 6 신설 + Rationale §2 에 "workflow `settings`
  는 permissive 예외에 포함되지 않는다" 구분 문장 추가.

## 검증 방법

- 워킹트리(`import-settings-dto-1df4ae`) 절대경로로 `import-workflow.dto.ts` /
  `update-workflow.dto.ts` / `workflow-settings.dto.ts` / `workflows.service.ts` 직접 확인.
- `git diff origin/main...HEAD` 로 실제 변경분과 payload 서술 일치 확인.
- payload 내 `spec/1-data-model.md` §2.3(Workspace.settings)/§2.4(Workflow.settings),
  `spec/2-navigation/1-workflow-list.md` §3.2/Rationale 전문 대조.

## 발견사항

검토 결과 target 변경이 다른 spec 영역과 충돌하는 지점은 발견되지 않았다.

- **[INFO]** 데이터 모델과의 정합성은 코드까지 3중으로 확인됨
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 item 6, Rationale §2 마지막 bullet
  - 대조 대상: `spec/1-data-model.md` §2.4 (Workflow.settings), §2.3 (Workspace.settings)
  - 상세: data-model §2.4 는 `Workflow.settings.maxConcurrentExecutions` 를 "미설정 시 기본 3" 으로 이미 스코프하고 있고, target 의 새 문장은 이를 인용만 할 뿐 재정의하지 않는다. 워크스페이스 레벨의 동일 이름 키(§2.3, 기본 10)와는 두 문서 모두 "Parallel 노드 `config.maxConcurrency`" 및 상호 간 스코프를 명시적으로 구분하고 있어 3-way(workspace cap / workflow cap / node-local concurrency) 네이밍 충돌 소지가 없다. 코드(`workflow-settings.dto.ts`)의 docstring 도 동일한 구분 문장을 그대로 반복하고 있어 spec-코드 간에도 어긋남이 없다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** permissive(§3.2 item 3, 노드 config) vs strict(§3.2 item 6, workflow settings) 구분이 Rationale 에 명확히 분리 기술됨
  - target 위치: Rationale §2 신설 bullet
  - 대조 대상: Rationale §2 기존 문단 (import 의 permissive config 정책)
  - 상세: 기존 Rationale §2 는 "노드 config parse 실패 시에도 import 를 거부하지 않는다" 는 일반 원칙을 서술하는데, 이번 신설 bullet 이 그 원칙에서 workflow-level `settings` 를 명시적으로 제외("이 permissive 예외에 포함되지 않는다")하는 문장을 덧붙였다. 문서 내부적으로 self-consistent — 원 정책을 뒤집는 것이 아니라 애초에 스코프 밖이었음을 사후 명확화한 것으로, 모순이 아니라 명료화다.
  - 제안: 없음.

- **[INFO]** import/patch 대칭 주장이 코드로 실증됨
  - target 위치: §3.2 item 6 "`UpdateWorkflowDto.settings`(patch)와 동일 strict 정책"
  - 대조 대상: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`, `import-workflow.dto.ts`
  - 상세: 두 DTO 가 동일한 `WorkflowSettingsDto` 클래스를 `@Type(() => WorkflowSettingsDto)` + `@ValidateNested()` 로 참조하여 실제로 동일 검증 로직을 공유한다. 서술과 구현이 정확히 일치.
  - 제안: 없음.

다른 관점(요구사항 ID·상태 전이·RBAC·계층 책임)에서는 이번 변경 범위(단일 DTO 필드 타입 강화 + jsonb 평탄화 + spec 문장 2곳)와 충돌할 여지가 있는 대상 자체가 없다. RBAC 는 변경 없음(`PATCH /api/workflows/:id` 는 기존과 동일 Editor+ 권한, import 엔드포인트 권한도 미변경). API 계약 관점에서는 응답 shape 변경이 없고 요청 바디의 `settings` 필드가 permissive object 에서 strict object 로 좁혀졌을 뿐이며, 이는 새 spec 요구사항 ID 를 만들지 않는 순수 검증 강화다.

## 요약

`ImportWorkflowDto.settings` 를 `WorkflowSettingsDto` 로 strict화하고 `UpdateWorkflowDto` 와 동일 DTO 를 공유하도록 한 이번 변경은 `spec/1-data-model.md` §2.3/§2.4 가 이미 확정해 둔 workspace-level 대 workflow-level `maxConcurrentExecutions` 스코프 구분, 그리고 Parallel 노드 `config.maxConcurrency` 와의 구분을 그대로 인용·재확인할 뿐 새로운 정의를 도입하지 않는다. `spec/2-navigation/1-workflow-list.md` 내부적으로도 노드 `config`(soft/permissive, item 3)와 workflow `settings`(hard/strict, item 6신설)의 경계가 Rationale §2 에 명확히 분리 기술되어 있어 기존 permissive 정책 문단과 모순되지 않는다. 코드(`workflow-settings.dto.ts`, `import-workflow.dto.ts`, `update-workflow.dto.ts`, `workflows.service.ts`)를 직접 대조한 결과 spec 서술과 실제 구현이 정확히 일치하며, 다른 spec 영역(§5-system/4-execution-engine §8 admission gate, RBAC, 노드 config 검증)과의 데이터 모델·API 계약·권한·계층 책임 충돌은 발견되지 않았다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
