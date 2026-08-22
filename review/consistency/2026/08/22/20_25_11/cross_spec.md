# Cross-Spec 일관성 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 확인 (절대경로 워크트리 기준 실측)

`git diff origin/main...HEAD --stat` 를 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/masked-marker-cosmetic-followups-edb6f2`)에서
직접 실측했다. `codebase/**` 변경은 4개 파일뿐이다:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL`
  형제 3종(`missing_required`/`coerce_failed`/`invalid_schema`)에 JSDoc 신설. `code`/`message` 값 자체는
  origin/main 과 동일.
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — 함수 docstring
  한글화 + wrapper(`resolveTriggerParametersRejectingMasked`) 역참조·CI 가드·SoT 링크 추가.
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ReRunRequestDto.inputOverride` 의
  Swagger `description` 문자열에 마커 예약어·거부 코드·부분일치 통과 경계 추가.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — 영/한 혼재 인라인 주석을
  한국어로 통일(`errors` 아니라 `details` 라는 근거는 보존).

네 파일 모두 조건문·분기·반환값·타입 시그니처·호출 관계는 origin/main 과 동일 — diff 는 주석/
JSDoc/Swagger `description` 문자열뿐이다. `plan/complete/masked-marker-cosmetic-followups.md` 도
"동작 무변경·실행 코드 라인 0줄"로 명시하고, `git diff` 로 직접 확인한 결과와 일치한다.

`spec/**` 변경은 `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록에
`codebase/backend/src/modules/executions/executions.service.ts` **1줄 추가뿐**이며 본문 변경은 없다.
그 외 diff 는 `plan/**`·`review/**`(이번 세션 자체 산출물) 뿐이다.

## 확인한 교차 참조 (실측)

- **EIA §R17** (`spec/5-system/14-external-interaction-api.md`, 실제 앵커 `### R17. ...` 존재 확인 +
  L1540~L1690 대역에서 `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`/
  `reject-masked-resubmission` 실측): manual-trigger.md §6 이 서술하는 검사 시점(raw 우선 →
  resolve 후 재검사) · wrapper 분리 이유(base 는 Webhook/Schedule 공유라 넣지 않음) · CI 가드
  경로(`repo-guards/__tests__/masked-reject-callers-guard.ts`, 워크트리에 실재 확인:
  `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`) · 서버측 두 호출부
  (`POST /workflows/:id/execute`, `POST /executions/:id/re-run`) · 정확 일치만 감지(부분 일치는
  통과) 전부 EIA §R17 원문과 문구 수준까지 일치한다. 이번 diff 가 새로 추가한 JSDoc/Swagger
  description 은 이 SoT 를 산문으로 재인용한 것뿐이며 새 주장·모순을 추가하지 않는다.
- **`spec/1-data-model.md`**: 별도 모순 없음(이번 diff 는 데이터 모델 필드를 신설·변경하지 않음).
- **`spec/5-system/3-error-handling.md` §1.7** / **API 규약 §5.3** / **webhook §5.2**:
  `TriggerParameterErrorDetail` JSDoc 및 manual-trigger.md §6 이 인용하는 에러 봉투 형태
  (`{ error: { code, message, requestId, details } }`, field code `UPPER_SNAKE_CASE`)와 상충 없음.
- **`code:` frontmatter 공유** — 신규 추가된 `executions.service.ts` 는 이미
  `spec/2-navigation/14-execution-history.md` · `spec/5-system/13-replay-rerun.md` ·
  `spec/5-system/14-external-interaction-api.md` · `spec/5-system/6-websocket-protocol.md` ·
  `spec/conventions/node-cancellation.md` 5개 문서가 SoT 코드로 인용 중인 공유 서비스 파일이다
  (`grep -rl` 실측). 다중 영역이 한 서비스 파일을 공유 SoT 로 인용하는 것은 이 저장소의 기존
  관례이며 신규 충돌이 아니다. manual-trigger.md §6 본문이 이미 "Manual re-run (inputOverride) |
  ... | `executions.service.ts`" 로 서술 중이던 사실을 frontmatter 목록에 뒤늦게 반영한 정정이라
  정합성이 오히려 개선됐다.
- **`REASON_TO_DETAIL` 4종 JSDoc 신설**: `missing_required`/`coerce_failed`/`invalid_schema` 는
  이번에 처음 JSDoc 이 붙었으나 `code`/`message` 값 자체는 origin/main 과 동일 — 문서 밀도만
  변경, 요구사항 ID·에러 코드 재정의 없음.
- **선행 라운드 리뷰와의 대조** — 같은 세션 내 앞선 impl-done cross-spec 라운드
  (`review/consistency/2026/08/22/20_05_10/cross_spec.md`)가 동일 결론(NONE)을 남겼고, 본 라운드
  실측(diff stat·EIA §R17 문구·frontmatter 공유 목록)이 그 결론과 모두 일치한다 — 이후 코드
  변경이 없으므로 재확정한다.

## 발견사항

없음. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 target
변경분(주석/JSDoc/Swagger 한글화·보강 + frontmatter 1줄)이 다른 spec 영역과 새로 모순되는
지점을 찾지 못했다. 실질 동작·계약은 origin/main 이전 PR(#1188~#1191)에서 이미 확정되었고
EIA §R17 이 그 SoT 로 계속 참조되고 있으며, 이번 diff 는 그 SoT 를 여러 지점에 산문으로
재인용했을 뿐이다(재인용 지점이 늘어난 유지비는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
가 별도 항목(`19_36_12` requirement W1)으로 이미 추적 중이며, 이는 cross-spec 모순이 아니라
문서 동기화 리스크로 다뤄지는 것이 맞다).

## 요약

이번 target 변경(spec/4-nodes/7-trigger/ frontmatter 1줄 + 4개 코드 파일의 주석/JSDoc/Swagger
description 변경)은 이미 병합된 마스킹 마커 재제출 거부 기능에 대한 순수 문서화 followup 이며
spec 본문·코드 동작 모두 실질 변경이 없다. EIA §R17·데이터 모델·API 규약·error-handling §1.7·
webhook §5.2 등 target 이 참조하는 모든 교차 spec 섹션을 워크트리 절대경로로 직접 대조한 결과
데이터 모델, API 계약, 요구사항 ID, 상태 전이, RBAC, 계층 책임 어느 관점에서도 모순을 확인하지
못했다. 신규 추가된 frontmatter `code:` 항목도 이미 5개 spec 문서가 공유 SoT 로 인용 중인
파일이라 기존 다중-소유 관례와 부합한다.

## 위험도

NONE
