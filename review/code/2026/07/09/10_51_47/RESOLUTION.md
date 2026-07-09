# RESOLUTION — 슬러그 라우팅 하드닝 B (ai-review 10_51_47)

원 리뷰(`review/code/2026/07/09/10_51_47/SUMMARY.md`): 위험도 MEDIUM, **Critical 0 / Warning 3 / INFO 14**.
Warning 3건 전량 조치. fix 커버 fresh 리뷰(`review/code/2026/07/09/11_28_51`) = **LOW, Critical 0 / Warning 0**.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
|---|---|---|---|
| W1 | Maintainability | `buildExecutionHref` JSDoc 의 실재하지 않는 `no-restricted-syntax` ESLint 룰 서술을 실제 메커니즘(`__tests__/no-raw-execution-href.test.ts` vitest 소스텍스트 guard, ESLint AST 취약성 회피 사유)으로 정정 | `4647d3486` |
| W2 | Testing | slug-누락 latent broken-link **3개 사이트** 전부에 slug-present 회귀 테스트 추가: (1) executions 목록 row-click(`execution-list-page.test.tsx`, 기존 vacuous=slug null 폴백만 검증하던 케이스에 slug 존재 케이스 병기), (2) 실행상세 prev/next(`execution-detail-page.test.tsx` 신규 describe, 3-item 리스트로 prev=older·next=newer 확인), (3) dashboard row-click(`dashboard-page.test.tsx` 신규 파일). 활성 워크스페이스가 있으면 `/w/<slug>/...` 로 이동함을 단언 | `4647d3486` |
| W3 | Testing | `no-raw-execution-href.test.ts` 에 정규식 self-test(알려진 위반 문자열→match 3건, 안전 형태→non-match 4건, SRC fail-open sanity 1건) 추가 — regex 약화로 인한 조용한 guard 무력화 차단 | `4647d3486` |

INFO 14건(원 리뷰) + INFO 6건(fresh 리뷰)은 전부 비차단(선택적 개선·문서 완결성·조치 불요 성격)이라 미조치. 대표: fixture 중복(공용 헬퍼 추출), 매직넘버 50 근거 주석, prev/next disabled 경계값 케이스 — 모두 선택적 하드닝.

## TEST 결과

- **lint**: 통과 (0 errors, 12 warnings — 전부 pre-existing, 특히 `slide-drawer.tsx:30` unused eslint-disable 는 본 변경과 무관한 미변경 파일).
- **unit**: 통과 (263 files, 5153 passed / 1 skipped — B 관련 +13: dashboard 2·list 1·detail 2·guard self-test 8).
- **build**: 통과 (`next build --webpack`, 101/101 정적 페이지, 라우트 충돌 0).
- **e2e**: 통과 (`make e2e-test-full` = backend jest e2e 전량 PASS + Playwright `slug-routing.spec.ts` 포함 `status:passed` 0-fail, 클린 teardown). 마지막 코드 커밋 `4647d3486` 이후 재실행.

## SPEC-CONSISTENCY (--impl-done)

`review/consistency/2026/07/09/11_31_49/SUMMARY.md` = **BLOCK: NO** (5 checker 전량, Critical 0).
cross_spec WARNING 1건(`EH-DETAIL-06` 요구사항 ID 범위 드리프트)은 **금번 코드 변경과 무관한
pre-existing spec-vs-spec 이슈**로, spec 편집이 필요해 developer 권한 밖 → project-planner 후속
분리(spawn task `task_fa5d4e34`). 나머지 INFO 는 문서 완결성·비차단.

## 보류·후속 항목

1. **W2 잔여 소비처(비-latent-bug 사이트)** — `workflows/page.tsx` executions 액션·`run-results-drawer.tsx`·`execution-history-panel.tsx` "전체 실행" 링크·`trigger-history-dialog.tsx` 는 모두 동일 `buildExecutionHref` 헬퍼를 호출한다. 이 헬퍼는 신규 unit 테스트(`href.test.ts`)로 list/detail/null-slug 조합이 검증되고, `no-raw-execution-href` guard 로 raw 리터럴이 CI 차단되며, FE Playwright e2e(`slug-routing.spec.ts`)가 통과했다. **실제 slug-누락 버그였던 3개 사이트**에는 전용 회귀 테스트를 추가했고, 나머지는 이 3중 안전망으로 커버되므로 개별 컴포넌트 하니스 신설(특히 테스트 파일 부재인 run-results-drawer)은 비례성상 defer.
2. **EH-DETAIL-06 spec ID 드리프트** → project-planner (`task_fa5d4e34`). 본 PR 무관 pre-existing.
