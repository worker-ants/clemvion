# Cross-Spec 일관성 검토 — `swagger-decisions` (impl-done)

## 사전 참고 — 번들 예산 절단 + 실제 diff 범위 재확인

prompt 의 "Target 문서" 헤더는 `spec/5-system/` 로 표기돼 있고 `<git diff origin/main...HEAD --
code_areas>` 자체를 포함해 15개 파일이 컨텍스트 예산 초과로 절단돼 있었다. 절단된 파일을
근거로 판단하지 않기 위해, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/
swagger-decisions-d24f77`)에서 직접 `git diff origin/main...HEAD` 를 재실행해 실제 변경
범위를 확인했다:

- `spec/conventions/swagger.md` (본 변경의 핵심 — DTO `description` 길이 강제 해제 + 보안·정책
  캐비엇 재구성)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`input` 필드
  `deprecated: true` 추가)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (신규 단언)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 3항목 종결)
- `plan/in-progress/swagger-decisions.md`, `review/**` (작업 기록)

`spec/5-system/` 디렉토리 자체의 파일은 이번 diff 에 **포함되지 않는다** — prompt 의 "Target
문서" 헤더가 스코프를 넓게(관련 5-system 문서 전체) 잡은 것이지, 실제 변경 파일이 그 안에
있는 게 아니다. 따라서 아래 검토는 실제 diff(swagger.md + DTO deprecated 플래그)를 기준으로
다른 spec 영역과의 충돌 여부를 확인했다.

이 세션 이전에 동일 target 에 대해 `--spec` 모드 검토(`review/consistency/2026/08/23/
11_59_11/cross_spec.md`)가 이미 수행됐고 WARNING 2건 + INFO 1건을 남겼다. 이번 impl-done
검토는 (a) 그 WARNING/INFO 가 실제 구현본에 반영됐는지, (b) 구현 단계에서 새로 생긴 cross-spec
충돌이 있는지 두 가지를 확인하는 데 집중했다.

## 이전 `11_59_11` WARNING/INFO 반영 확인 (검증됨 — 재발 없음)

- **WARNING(3-way 길이 기준 미판정)**: 최종 `swagger.md §3` 은 엔드포인트 `summary`(10~20자,
  강제)·엔드포인트 `description`(50~150자, 강제)·DTO `description`(~40자, 지향) 3-way 표로
  명시적으로 갈랐다 (`spec/conventions/swagger.md:258-264`). 반영 확인.
- **WARNING(보안·정책 캐비엇 자기모순)**: "예외"→"반드시 적는다(지시)" 로 프레이밍을 뒤집어
  DTO 길이가 지향으로 바뀐 뒤에도 이 두 부류는 여전히 강제된다는 논리가 자기모순 없이
  성립한다 (`spec/conventions/swagger.md:271-286`, `## Rationale §3 보안·정책 캐비엇`
  절 480행 이하). 반영 확인.
- **INFO(실측 수치 drift)**: 새 Rationale(`### §3 DTO 길이는 왜 강제가 아닌가`, 422행 이하)이
  2026-08-22 수치(114/333)와 2026-08-23 재실측(116/335, 응답 58/128, 전체 174/463)을 병기하며
  차이의 원인(`ReRunRequestDto`·`ExecuteWorkflowDto` 필드 설명 추가로 모집단 변경)을 명시했다.
  반영 확인.

## 구현 단계 신규 변경에 대한 cross-spec 점검 (충돌 없음)

- **`ExecuteWorkflowDto.input` → `deprecated: true`**: 형제 `ExecuteNodeDto.input`
  (`codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`) 과의 동명이의는 코드
  확인으로 실재를 확인했다. `deprecated` 는 OpenAPI 메타데이터일 뿐 런타임 검증·와이어 계약을
  바꾸지 않으며(같은 diff 에서 `parameterValues ?? input.parameters` 합류 로직·마커 거부
  경로는 무변경), `spec/4-nodes/7-trigger/0-common.md:30`·`spec/data-flow/10-triggers.md:41`
  이 이미 `parameterValues` 를 1순위로 문서화하고 있어 "구식 필드에 deprecated 표시" 방향과
  모순되지 않는다.
- **`deprecated` 패턴 미일반화 주장 검증**: Rationale 은 "사례가 하나뿐이라 §1 로 일반화하지
  않는다"고 적는다. `codebase/backend/src/` 전체에서 `deprecated: true` 를 grep 한 결과 이
  1건이 유일해, 주장이 정확하다 — 다른 곳에 이미 쓰이고 있는 패턴을 "미일반화"라고 적어
  spec 과 코드가 어긋나는 상황은 아니다.
- **길이 규칙 비강제화의 타 spec 파급**: `spec/` 전체에서 `10~40`/`10-40`/`10~20`/`50~150`
  및 "DTO … description" 길이 서술을 재검색했으나 `spec/conventions/swagger.md` 밖에는
  이 수치를 인용하는 spec 문서가 없다 — 다른 영역 spec 이 이 규칙을 전제로 별도 판정을 내려둔
  곳이 없어 비강제화가 타 영역과 충돌하지 않는다.
- **`execute` 여분 키 미거부(현행 유지) 결정**: `spec/5-system/2-api-convention.md`·
  `spec/4-nodes/7-trigger/*.md` 어디에도 이 엔드포인트가 여분 top-level 키를 400 으로 거부
  한다는 서술이 없어(grep 0건), "현행 유지"가 기존 spec 서술과 상충하지 않는다. 이 결정은
  코드 무변경이라 diff 표면에도 없다.
- **트래커(`spec-sync-external-interaction-api-gaps.md`) 3항목 종결 서술**: 세 `- [ ]` → `- [x]`
  전환 각각에 결정·근거·집행 파일이 적혀 있고, 실제 `execute-workflow.dto.ts`/
  `workflows-execute-body.spec.ts`/`swagger.md` diff 와 1:1 대응해 문서-코드 drift 없음.

## 발견사항

없음 — 이번 diff 범위(swagger.md 길이 규약 재구성 + DTO 필드 `deprecated` 플래그)에서 다른
spec 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 발견하지
못했다. 이전 `--spec` 라운드가 지적한 자기모순 리스크(WARNING 2건)는 최종본에서 해소가
확인됐다.

## 요약

실제 diff 는 `spec/conventions/swagger.md` 의 DTO `description` 길이 규칙 재구성(강제→지향 +
보안·정책 캐비엇 재프레이밍)과 `ExecuteWorkflowDto.input` 필드에 대한 `deprecated: true`
메타데이터 추가 두 가지로, prompt 헤더가 표기한 `spec/5-system/` 범위보다 훨씬 좁다(해당
디렉토리 파일 자체는 이번 diff 에 없음). 두 변경 모두 (a) 다른 spec 문서가 인용·의존하는
수치나 필드 상태를 전제로 하지 않고, (b) 런타임 계약을 바꾸지 않는 문서/메타데이터
수준이라 cross-spec 충돌 표면이 원천적으로 작다. 직접 grep·코드 대조로 확인한 결과 데이터
모델·API 계약·상태 전이·RBAC·계층 책임 어느 축에서도 다른 영역과의 모순을 찾지 못했고,
선행 `--spec` 라운드가 지적한 자기모순 리스크(같은 파일 내 "예외" 프레이밍 붕괴, 실측치
drift)도 최종본에서 해소됐다.

## 위험도

NONE
