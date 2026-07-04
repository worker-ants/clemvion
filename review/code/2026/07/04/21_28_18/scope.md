# 변경 범위(Scope) Review

- 대상: workflow-level cap validated write DTO (`workflow-cap-dto-bca77e`)
- Diff base 검증: payload 파일 목록(28개) vs `git diff origin/main...HEAD --stat` 완전 일치(같은 28 파일, 동일 삽입/삭제 라인수) → 페이로드 mis-scope 아님, fallback 불필요.

## 점검 관점별 분석

### 1. 의도 이상의 변경 / 4. 무관한 수정

핵심 코드 변경은 5 파일로 좁고 일관됨:

- `update-workflow.dto.ts`: `settings` 필드를 opaque `Record<string, unknown>` → nested `WorkflowSettingsDto` (`@ValidateNested @Type`)로 전환.
- `workflow-settings.dto.ts` (신규): `maxConcurrentExecutions` 단일 필드 검증 DTO.
- `workflows.service.ts`: `settings` 만 분리해 spread-merge, 나머지 필드는 기존 `Object.assign` 유지.
- `workflow-dto-validation.spec.ts` / `workflows.service.spec.ts` / `workflow-crud.e2e-spec.ts`: 위 변경에 대응하는 신규 테스트만 추가(기존 테스트 수정 없음, 순수 append).

`workflows.service.ts` 의 spread-merge 전환은 DTO 만 바꾸는 것보다 약간 넓어 보이나, plan(`plan/in-progress/workflow-cap-validated-dto.md` 설계 결정 §3)에 명시된 의도적 변경이며 DTO narrowing 의 직접적 귀결이다 — narrowed DTO 상태에서 기존 `Object.assign(workflow, dto)` 를 유지했다면 `settings` 전체가 `WorkflowSettingsDto` 인스턴스로 교체되어 DB 잔여 키(`existingKey` 등)가 매 PATCH 마다 소실되는 회귀가 발생한다. 즉 이 변경 없이는 DTO 전환 자체가 안전하지 않으므로 in-scope 로 판단한다. `settings` 외 필드(`name`/`isActive`/`tags`/`folderId`)의 `Object.assign` 경로는 손대지 않았다 — 최소 침습 확인.

`import-workflow.dto.ts` 는 plan 에 "opaque 유지(별도 후속)"로 명시했고 실제 diff 도 0 — 언급된 비대칭을 건드리지 않고 후속으로 미룬 판단이 diff 와 일치한다(약속과 실행 일치).

### 2. 불필요한 리팩토링

없음. 기존 로직 중 관련 없는 부분(다른 필드 처리, `create`/`duplicate` 등)의 구조 변경·정리 없음. `Object.assign` 은 그대로 유지, `settings` 분기만 추가.

### 3. 기능 확장 (over-engineering)

`WorkflowSettingsDto` 는 필드 1개(`maxConcurrentExecutions`)만 선언 — spec §8 이 요구하는 범위 그대로다. 여러 설정 키를 미리 확장하거나 불필요한 유틸/헬퍼를 추가하지 않았다. 클래스 JSDoc 에 "신규 설정 키는 여기 필드를 추가해 확장한다"는 안내가 있으나 이는 주석 수준의 가이드일 뿐 실제 코드로 선제 확장하지 않았으므로 over-engineering 으로 보지 않는다.

### 5. 포맷팅 변경

diff 전부 실질 변경(import 추가, 데코레이터 추가, 필드 타입 변경, JSDoc 갱신)과 결합되어 있고, 무관한 개행/들여쓰기 변경은 관찰되지 않는다.

### 6. 주석 변경

`update-workflow.dto.ts` 의 JSDoc 갱신(`/** 워크플로우 실행/UI 관련 설정 객체 */` → 검증 규칙 설명)과 `workflows.service.ts` 의 신규 주석은 모두 해당 필드의 동작 변경을 설명하는 목적 — 무관한 주석 편집 아님.

### 7. 임포트 변경

`update-workflow.dto.ts`: `ValidateNested`(class-validator), `Type`(class-transformer), `WorkflowSettingsDto` 추가 — 전부 신규 데코레이터 사용에 필요. `workflows.service.spec.ts`: `UpdateWorkflowDto` 타입 캐스팅용 임포트 추가, 사용됨. 미사용 임포트 없음.

### 8. 설정 변경

`.eslintrc`, `tsconfig`, CI 워크플로 등 프로젝트 설정 파일 변경 없음. `CHANGELOG.md` 항목 추가는 프로젝트 관례상 기대되는 워크플로 산출물(엔트리 1건, `## Unreleased` 하위 삽입 위치 정상, 기존 엔트리 미변경).

## 리뷰/컨센시스턴시 아티팩트 (파일 9~28)

`review/code/2026/07/04/21_11_10/**` (SUMMARY·retry_state·routing_decision·11개 reviewer 산출물)와 `review/consistency/2026/07/04/20_55_13/**` (SUMMARY·5개 산출물)는 이번 작업 흐름에서 필수로 동반되는 워크플로 산출물이다(developer SKILL 의 `impl-prep consistency` 의무 + 구현 완료 후 `ai-review` 의무, `.claude/docs/plan-lifecycle.md` 저장 위치 규약과도 일치하는 경로). 코드 변경과 무관한 별도 작업이 섞여 들어온 것이 아니라, 동일 작업의 필수 승인 프로세스 기록이므로 scope 위반으로 보지 않는다. 다만 이 다수의 산출물 파일이 code diff 리뷰 payload 에 원문 그대로 포함되어 리뷰 대상 파일 수를 28개로 부풀리는 점(신호 대 잡음)은 프로세스 관점의 사소한 비효율이나, "코드 변경 범위(scope)" 판정 대상은 아니다.

## plan 문서(`plan/in-progress/workflow-cap-validated-dto.md`)

신규 plan 문서는 frontmatter(`worktree`/`started`/`owner`/`spec_impact: [none]`)와 체크리스트가 규약을 따르고, 본문이 실제 diff(5개 핵심 파일)와 1:1 대응한다. 범위 외 항목(예: import DTO 강화, 다른 모듈 변경) 언급 없이 "별도 후속"으로 명확히 경계를 그었다.

## 요약

핵심 변경은 `UpdateWorkflowDto.settings` 를 opaque 에서 검증되는 nested DTO(`WorkflowSettingsDto`)로 좁히고, 이에 필요한 최소한의 service 병합 로직 조정과 대응 테스트(unit 3계층 + e2e)만 추가한 응집력 있는 변경이다. 서비스 레이어의 spread-merge 전환은 얼핏 추가 범위로 보이지만 DTO narrowing 의 안전성을 보장하기 위해 필수적인 동반 변경이며 plan 에 명시적으로 설계 결정으로 기록되어 있다. `ImportWorkflowDto` 등 인접 영역은 의도적으로 손대지 않았고 diff 로도 확인된다. 리팩토링·기능확장·포맷팅·주석·임포트·설정 관점 모두 이상 신호 없음. 동반된 CHANGELOG 항목과 review/consistency 아티팩트는 프로젝트 표준 워크플로 산출물로 scope 이탈이 아니다.

## 위험도

NONE
