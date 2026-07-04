# 변경 범위(Scope) 리뷰

## 검토 대상

`git diff origin/main...HEAD` (15 files, 585 insertions / 8 deletions) — payload(`_prompts/scope.md`)와 완전히 일치 확인. 별도 fallback 불필요.

1. `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`
2. `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
3. `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규)
4. `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
5. `codebase/backend/src/modules/workflows/workflows.service.ts`
6. `codebase/backend/test/workflow-crud.e2e-spec.ts`
7. `plan/in-progress/workflow-cap-validated-dto.md` (신규)
8~15. `review/consistency/2026/07/04/20_55_13/**` (8개, 신규 — impl-prep consistency-check 산출물)

작업 의도(plan 문서 기준): `Workflow.settings.maxConcurrentExecutions` 를 opaque `Record<string, unknown>` passthrough 에서 nested validated DTO(`WorkflowSettingsDto`)로 전환, workspace 의 `UpdateWorkspaceSettingsDto` 와 대칭화. service 의 settings 저장 방식을 전체 교체(full-replace) 대신 병합(merge)으로 변경.

## 발견사항

### INFO — service.update 의 spread-merge 전환은 명세 범위 내 부수 변경이나 별도 관심사
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:1196-1211` (`Object.assign(workflow, dto)` → `settings` 분리 후 `{ ...(workflow.settings ?? {}), ...settings }` 병합)
- 상세: 이번 작업의 핵심 요청은 "validated DTO 도입"(입력 검증 강화)이다. `Object.assign` 전체 교체 → spread-merge 전환은 별개의 동작 변경(런타임 시맨틱 변경: 기존에는 `settings` PATCH 시 이전 키가 전부 사라졌으나 이제는 병합·보존됨)이다. 다만:
  - plan 문서(`plan/in-progress/workflow-cap-validated-dto.md` 설계 결정 3)에 사전에 명시되어 있고, "workspace 의 `updateWorkspaceSettings` 대칭"이라는 근거가 제시됨.
  - 사용자가 이번 검토 지시에서 "service.update 의 spread-merge 변경은 workspace 와의 의도된 대칭(symmetry)이며 DB 키 보존 목적의 in-scope 변경"이라고 명시적으로 확인함.
  - `workflows.service.spec.ts` 에 전용 유닛 테스트 3건이 추가되어 회귀 방지가 되어 있음.
  - 결론: 범위 이탈이 아니라 **문서화된 설계 결정의 일부**로 판단. Critical/Warning 아님, 참고 기록만 남김.

### INFO — consistency 산출물(review/consistency/**) 포함은 워크플로 규약상 정상
- 위치: `review/consistency/2026/07/04/20_55_13/*` (8개 파일)
- 상세: 프로젝트 규약상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 이 의무이며, 그 산출물은 `review/consistency/**` 에 커밋되어야 하는 표준 워크플로 결과물이다(코드 변경과 무관한 "혼입"이 아님). `_retry_state.json`, `meta.json` 등 오케스트레이션 상태 파일도 해당 skill 의 정형 산출물 스키마에 속함.
- 결론: 무관한 파일 혼입 아님. 발견사항 아님.

### INFO — `ImportWorkflowDto.settings` 는 이번 변경에서 그대로 opaque 유지 (의도된 범위 제외)
- 위치: 해당 DTO는 diff 대상에 없음(변경 없음)
- 상세: plan 문서와 consistency SUMMARY 양쪽에서 "import DTO는 opaque 유지, 별도 후속 검토"로 명시적으로 스코프 밖 처리했다. `PATCH`(strict) vs `import`(opaque) 간 비대칭이 남지만, 이는 의도적 축소 스코프이지 누락이 아니다. over-engineering 회피 관점에서 오히려 바람직한 절제.

### 그 외 항목 — 특이사항 없음
- 신규 파일 `workflow-settings.dto.ts` 는 단일 필드(`maxConcurrentExecutions`)만 정의 — 요청 스코프 정확히 일치, 확장 필드 없음(over-engineering 없음).
- `update-workflow.dto.ts` 변경은 import 추가(`ValidateNested`, `Type`, `WorkflowSettingsDto`)와 `settings` 필드 타입/데코레이터 전환뿐 — 다른 필드(`name`, `description`, `isActive`, `tags`, `folderId`) 무변경.
- 테스트 추가(`workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, `workflow-crud.e2e-spec.ts`)는 모두 이번 변경(검증 게이트 + spread-merge)만을 커버 — 무관한 케이스 추가나 리팩토링 없음.
- 포맷팅/주석/임포트 정리 중 실질 변경과 무관한 것 없음. 주석은 모두 이번 변경 설명(§8 admission gate, backstop 관계 등)에 직접 관련.
- `plan/in-progress/workflow-cap-validated-dto.md` 는 신규 plan 문서로 규약(frontmatter `worktree`/`spec_impact`)을 따름 — 무관한 plan 수정 없음.
- 설정 파일(`.eslintrc`, `tsconfig`, CI 등) 변경 없음.

## 요약

diff는 "workflow-level cap validated write DTO" 라는 단일 목적(validated nested DTO 도입 + workspace 대칭 spread-merge)에 정확히 수렴한다. 코드 변경 6개 파일은 모두 이 목적과 직결되며 무관한 리팩토링·포맷팅·주석·임포트 정리·기능 확장이 섞여 있지 않다. service.update 의 `Object.assign` → spread-merge 전환은 표면적으로는 "요청 이상"처럼 보일 수 있으나, plan 문서에 사전 설계 결정으로 명시되어 있고 사용자가 workspace 대칭 의도로 확인했으며 전용 테스트로 커버되어 범위 이탈로 보지 않는다. `review/consistency/**` 8개 산출물과 `plan/in-progress/**` 1개 파일은 프로젝트가 강제하는 impl-prep 워크플로 산출물로, 코드 변경과 무관한 혼입이 아니라 규약상 필수 동반 산출물이다. Import DTO 의 opaque 유지는 의도적 스코프 축소로 문서화되어 있어 누락이 아니다.

## 위험도

NONE

STATUS: SUCCESS
