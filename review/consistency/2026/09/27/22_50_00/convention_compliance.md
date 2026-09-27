# 정식 규약 준수 검토 — `spec/2-navigation/1-workflow-list.md` (cross-workspace-refs)

## 검토 범위

- target: `spec/2-navigation/1-workflow-list.md` (scope 델타 1개 파일)
- 대조: `spec/conventions/**` 전수(예산 절단된 항목은 실제 파일을 절대경로로 직접 Read 해 대체 확인 — `error-codes.md` · `swagger.md` · `spec-impl-evidence.md` · `frontend-layering.md` · `review-citations.md`)
- 실제 diff: `git diff origin/main...HEAD -- spec/2-navigation/1-workflow-list.md` + `codebase/` 구현 diff(`reference-in-scope.ts`, `folders.service.ts`, `workflows.service.ts` 등)를 함께 대조해, spec 서술이 실제 wire 형태와 일치하는지 확인

## 발견사항

- **[INFO]** `details[]` 원소에 `code='INVALID_FIELD'` 인용 누락
  - target 위치: §3 API 표 `POST /api/workflows` · `PATCH /api/workflows/:id` · §3.1 `POST /api/folders` · `PATCH /api/folders/:id` (이번 diff로 추가된 4줄)
  - 위반 규약: 엄밀한 위반은 아님 — `spec/conventions/error-codes.md` §4.2 및 `spec/5-system/2-api-convention.md` §5.3(`details` 배열 형태)와 형태상 어긋나지 않는다.
  - 상세: 새로 추가된 4곳은 `details[].field='folderId'` / `details[].field='parentId'` 만 인용하고 `details[].code='INVALID_FIELD'`는 적지 않는다. 실제 구현(`codebase/backend/src/common/utils/reference-in-scope.ts`)은 모든 거부 항목에 `code: ErrorCode.INVALID_FIELD`를 하드코딩해서 싣는다. 같은 도메인의 형제 문서 `spec/2-navigation/2-trigger-list.md`(§2.3.1)는 동일 성격의 오류를 `details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`로 field+code를 함께 인용하는 관례를 쓰고 있어, 이번 4곳만 code를 생략한 것이 국소적으로 비대칭이다.
  - 제안: 4곳에 `details[].code='INVALID_FIELD'`를 추가해 wire 계약을 완전히 인용하면, 다음에 이 문서만 읽는 사람이 코드 값을 추론할 필요가 없어진다. 다만 이는 규약 위반이 아니라 완결성 제안이므로 이번 PR에서 필수 대응은 아니다.

- **[INFO]** `## Overview` 섹션 부재 (사전 존재 패턴, 이번 PR 도입 아님)
  - target 위치: 문서 전체 — frontmatter 뒤 바로 `# Spec: 워크플로우 목록 화면` → `## 1. 화면 구조`
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장" 및 각 SKILL.md
  - 상세: `spec/2-navigation/` 17개 형제 문서 중 `## Overview` 헤딩을 가진 것은 `6-config.md` 1개뿐이고 나머지 16개(본 문서 포함)는 모두 동일하게 생략한다. 즉 이번 PR이 만든 편차가 아니라 이 영역 전체의 기존 관행이며, `1-workflow-list.md`는 그 관행을 그대로 따른 것뿐이다.
  - 제안: 이번 PR 범위에서 조치할 사안 아님. 영역 전체를 일괄 정리할지는 별도 planner 턴에서 판단할 문제로 남긴다.

## 확인했으나 위반 아님으로 판정한 항목 (근거를 남겨 재검토 비용을 줄임)

- **에러 코드 명명**: 이번 diff가 참조하는 `VALIDATION_ERROR`(prefix-less 시스템 전역 코드) · `INVALID_FIELD`는 모두 기존 코드 재사용이며 신규 코드 발행이 없다. `error-codes.md` §1 의미 기반 명명·§3 예외 레지스트리 어디에도 저촉되지 않는다.
- **`details[]` 배열 표기**: 새로 추가된 `details[].field='folderId'` / `details[].field='parentId'`는 실제 구현(`reference-in-scope.ts`가 `details: items.map(...)`로 배열을 구성)과 정확히 일치한다. 종전 텍스트에는 이 표기가 없었으므로 이번 PR이 새로 들여온 것이고, `spec/5-system/2-api-convention.md` §5.3(`details` 배열 형태)과도 부합한다.
- **frontmatter (`spec-impl-evidence.md` 대조)**: `pending_plans:`에 `plan/in-progress/cross-workspace-refs.md`를 추가한 것은 실제로 그 경로에 plan이 존재(`worktree`/`owner`/`started` 필드 포함)하고 `spec_impact`에 본 문서가 등재돼 있어 §2.1·§4 가드 요건과 맞는다. 같은 목록에 이미 있던 `plan/complete/workflow-duplicate-nodes-edges.md` 항목(완료된 plan을 `pending_plans`가 계속 가리키는 형태)은 규약 위반처럼 보일 수 있으나, 같은 문서 §Rationale R-11이 "공유 트래커가 `complete/`로 이동해도 이 문서 몫의 항목이 남아 있으면 그대로 인용 가능"이라고 명시적으로 허용한 패턴이라 위반 아님(다른 두 항목이 아직 `in-progress`라 `status` 승격 가드도 걸리지 않는다).
- **`common/` → `nodes/` 역방향 import** (`reference-in-scope.ts`가 `../../nodes/core/error-codes`를 import): 실재하는 층 위반이지만 (a) 그 규율은 `spec/conventions/**.md` 파일이 아니라 `common/utils/password.util.ts`의 코드 주석에만 있어 이번 검토의 "정식 규약(spec/conventions/**)" 범위 밖이고, (b) 이미 같은 PR의 `/ai-review` 3R(`review/code/2026/09/27/22_36_12` W1)이 발견해 "수렴 예외"로 등재했고 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-27 등재분)에 developer 후속으로 이미 추적 중이다. 재-flag 하지 않는다.
- **Swagger/DTO 명명**: 본 문서가 언급하는 `ExportWorkflowDto` · `WorkflowSettingsDto` · `UpdateWorkflowDto`는 `swagger.md` §1-7(`Update` 접두는 top-level 요청 바디에만)과 어긋나지 않는다(이번 diff는 이 DTO들의 명명을 바꾸지 않았다).
- **CHANGELOG**: 이번 변경에 대응하는 `## Unreleased` 항목이 추가돼 있다(memory 관례 "CHANGELOG 항목은 수정의 일부다" 충족).

## 요약

`spec/2-navigation/1-workflow-list.md`의 이번 변경분(폴더/워크플로 참조 소속 검사 관련 API 표 2곳 갱신 + Rationale §3 정정 각주 + `pending_plans` 1건 추가)은 `spec/conventions/**`의 명명·출력 포맷·프런트매터 규약과 실제 구현(`reference-in-scope.ts` 계열) 모두에 부합한다. 새로 인용한 `VALIDATION_ERROR` / `details[].field=` 표기는 코드가 실제로 내보내는 배열 형태와 정확히 일치하고, 신규 에러 코드 발행도 없다. 발견된 것은 두 건의 INFO(：`details[].code` 인용 완결성, `## Overview` 섹션 부재)뿐이며 후자는 이 PR이 만든 편차가 아니라 `2-navigation` 영역 전체의 기존 패턴이다. 별도로 확인한 `common/`→`nodes/` 역방향 import는 spec/conventions 파일이 규정한 사항이 아니고 이미 같은 PR 리뷰 라운드에서 수렴 예외로 처리·추적 중이라 재기재하지 않았다.

## 위험도

NONE
