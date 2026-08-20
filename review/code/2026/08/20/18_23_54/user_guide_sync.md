STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows[] 20개)을 SoT로 적재하고 PROJECT.md §변경 유형 →
갱신 위치 매핑 본문을 보조로 참조. `git diff origin/main...HEAD --name-only`로 `review/**` 제외
34개 code/docs/dict/spec 파일 전량을 확인했고, working tree의 미커밋 변경(`masked-markers.ts`)도
함께 대조했다.

**핵심 관찰 — 이번 라운드는 직전 user-guide-sync 판정(`18_03_01`, NONE) 이후의 델타만 신규다.**
그 라운드 이후 변경은 두 가지뿐이다:

1. 커밋 `2c628f6ac` — `rerun-modal.tsx`/`rerun-modal.test.tsx`에 orphan 필드 타입 추론 로직
   (`inferTypeFromValue`) 추가 + JSDoc 정정 + `CHANGELOG.md` 헤드라인 범위 명시.
2. 미커밋 working tree 변경 — `masked-markers.ts`의 `scanForMarker`에서 깊이 체크와 마커 체크의
   순서를 맞바꿈 (depth guard가 먼저).

## 매칭된 trigger 재확인 (기존 2개, 변동 없음)

1. **`run-debug-flow-change`** (실행·디버깅 흐름 변경, semantic) — 이미 4개 MDX 전부 changeset에
   포함(`05-run-and-debug/run-results.{mdx,en.mdx}`, `running-a-workflow.{mdx,en.mdx}`).
2. **`new-ui-string`** (신규 UI 문자열, semantic) — `t("editor.runWithInputMasked")`,
   `t("history.rerun.maskedInputBlocked")` 2개 키, `dict/{ko,en}/{editor,history}.ts` 양쪽 존재.

## 델타 검증

- `git diff 2c628f6ac~1..2c628f6ac -- codebase/frontend codebase/backend`를 직접 열어 확인 — 신규
  `t("...")` 호출 없음, 신규 dict 키 없음, docs MDX 변경 없음. 순수 내부 로직(`inferTypeFromValue`
  타입 추론)·JSDoc 정정·테스트 캐너리 1건 추가뿐이라 매트릭스 어떤 trigger도 새로 열지 않는다.
- working tree의 `masked-markers.ts` 변경은 `scanForMarker` 내부 두 가드의 평가 순서 교환뿐 —
  사용자 노출 문자열·docs·dict 어느 것도 건드리지 않는다.
- `git diff origin/main...HEAD -- codebase/frontend/src '*.tsx' | grep -E '^\+.*\bt\("'`로 이번 PR
  전체의 신규 `t()` 호출을 재검색 — `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`
  2건만 확인(둘 다 이전 라운드에 이미 dict 양쪽 등록·검증됨). 신규 미등록 호출 없음.
- 영역 무관 확인(재확인): `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`,
  `codebase/packages/expression-engine/**`, `error-codes.ts`, `backend-labels.ts`, `locale.ts`, 신규
  `content/docs/<NN>-*/` 디렉토리, provider/integration — 이번 34파일 diff 어느 것도 해당 없음.

## 발견사항

없음 — 직전 라운드(`18_03_01`)가 확정한 "누락 0건" 판정 이후 추가된 두 변경 모두 매트릭스 trigger
표면을 새로 열지 않았다.

## 요약

매트릭스 20개 행 중 `run-debug-flow-change`·`new-ui-string` 2개가 매칭되고, 두 trigger의 필수
동반 갱신(유저 가이드 MDX 4파일, i18n dict ko/en 2쌍)은 여러 라운드에 걸쳐 이미 완결·재확인됐다.
이번 라운드에서 추가된 델타(`rerun-modal.tsx` 내부 타입 추론 로직 + `masked-markers.ts` 가드 순서
교환)는 신규 사용자 노출 문자열이나 docs 표면을 만들지 않아 기존 판정을 바꾸지 않는다. 누락 0건.

## 위험도

NONE
