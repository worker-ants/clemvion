# Resolution — edge §4/§5 ai-review 4회차 (2026-07-13 17:13)

원 위험도 **LOW** (CRITICAL 0 + WARNING 1). 이번 라운드 diff 는 대부분 3회차 리뷰 산출물 + spec status 였고, 유일한 WARNING 은 requirement 리뷰어가 실제 코드(커밋 `9036bb565`)를 대조해 찾은 SPEC-DRIFT. concurrency 는 router 가 skip(문서 위주 diff, disk-write gap 아님).

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | SPEC-DRIFT | spec §5 "현재 구현" 문단이 3회차 fix 의 `bytesApprox`(100KB 초과 근사 + 툴팁 `~`)를 미반영 — plan 에만 있고 spec 은 "정확 계산"처럼 서술 | **반영(코드 무변경, spec 갱신)** — §5 "현재 구현" 문단에 "크기 표시는 100KB 이하면 정확 `TextEncoder`, 초과하면 인코딩 생략·문자 수 하한 근사(`bytesApprox`)로 `~` 표기" 한 문장 추가. |

## INFO(반영/이월)
- (requirement/documentation #2) spec §5 ASCII 목업 `"items": [3 items]` 가 실제 렌더 `"items": "[3 items]"`(축약 결과가 문자열이라 JSON.stringify 따옴표)와 불일치 → **반영**: 목업을 실제 출력(`"[3 items]"`)에 맞게 정정.
- (testing #8) `failed` status hover 미검증 → **반영**: `seedResult("a", {...}, "failed")` → 출력 있으면 렌더(status 무관) 케이스 추가(component RTL 9→10).
- (perf #3) 바이트 상한이 `TextEncoder` 단계에만 적용되고 선행 `JSON.stringify` 자체는 무제한 → **이월(비차단)**: 정확 크기는 spec 요구, 미리보기는 축약이라 렌더 비용 작음, sweep 은 SHOW_DELAY 로 차단. stringify 스킵+abbreviate 근사 대체는 정확도 손실 대비 이득 작아 defer.
- (perf #4/#5) abbreviate eager 열거·`edges` prop-drill 재탐색 → 이월(영향 작음, §4-insert 후속).
- (arch #6/#7) 3중 조회 중복(`task_edb57ca2`)·God-component → 기존 defer 추적 유지.
- (process #1/#10/#11) 이번 라운드 router 가 실제 코드 diff 미배정(다수 reviewer 가 git 으로 직접 재확인해 갭 보완)·이전 라운드 리뷰어 산출물 H1/H3 포맷 혼재·EOF 개행 → 리뷰 인프라 참고사항, 본 PR 코드와 무관.
- (test #9) 콜백 순서(dismiss→setDataModalEdgeId) 통합 검증은 canvas RTL 하네스 부재로 이월.

## 검증
- tsc `--noEmit` clean · component RTL 10 passed · 관련 vitest 전체 이전 라운드 96→(failed 추가)97 통과 예상 · eslint 0 errors · e2e 44 suites/253 · fresh `/ai-review` 5회차로 최종 수렴 확인.
