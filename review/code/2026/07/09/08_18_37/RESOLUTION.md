# RESOLUTION — 슬러그 라우팅 ai-review round 3 (2026-07-09 08_18_37)

대상: round-2 fix 커밋(`624848071`). 위험도 MEDIUM · Critical 0 · Warning 6.
round 1(18_24_41)·round 2(07_56_16) 는 각 세션 SUMMARY 로 종결됨. 본 라운드가 real bug 1건을
잡아 수정했고, 나머지는 테스트/문서 보강·저위험 defer 다.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 비고 |
|---|---|---|---|
| W1 | requirement | **[real bug]** `rerun-modal.tsx` 재실행 성공 네비게이션이 slug 미부착 bare path 였음 → `buildWorkspaceHref(slug, ...)` 로 교정 (multi-line `router.push(` 라 round-1 단일행 grep 이 놓침). JSDoc·회귀 테스트(slug 케이스) 동반 | 본 커밋 |
| W2 | requirement | round-1 RESOLUTION 의 fresh-review 커버리지 서술 정정 — "9 reviewer" → "9 중 7 산출(2건 disk-write 갭 재발), Critical 0" | 본 커밋 |
| W5 | testing | `workspace-store.test.ts` 에 `setWorkspaces` 전용 블록 추가 — 현재 id 유지/미존재 폴백/빈 목록 null/`loaded:true` 4케이스 | 본 커밋 |
| W6 | testing | `href.test.ts` 보안 회귀를 `it.each` 로 분리 + CR(`\r`)/LF(`\n`)/slug+control-char 케이스 추가 | 본 커밋 |
| W3 | architecture | **defer** — open-redirect 방어가 `buildWorkspaceHref`(강화됨) vs `isSafeRedirectPath`(`error-page.tsx`, `//` 만) 비대칭. **`isSafeRedirectPath` 소비 배선은 아직 없음**(redirect 파라미터 소비 미구현)이라 라이브 도달 불가 + 공용 유틸 추출은 무관 파일(error-page) 침범 = 본 PR scope 밖. redirect 소비 로직 추가 시 공용화하는 조건부 후속으로 이관 | 후속 |
| W4 | architecture | **defer** — store↔resolve-fallback `import type` 순환 안전성이 lint 미강제(안전성은 tsc 로 검증됨). `consistent-type-imports`/`no-cycle` 룰 추가 또는 타입 중립 위치 이전은 리포지토리 전역 lint 정책 변경이라 별도 트랙 | 후속 |

## 미산출 reviewer (파이프라인 갭)

`documentation`·`user_guide_sync` 2 reviewer 가 manifest success 이나 output 파일 부재(Workflow
disk-write 갭 재발). user_guide_sync 는 round-2 에서 NONE(매트릭스 미매칭) 확정됐고, documentation
은 본 변경이 CHANGELOG/spec 각주 추가라 저위험. 산출된 12 reviewer 전부 Critical 0.

## TEST 결과

- **lint**: 통과 (0 err)
- **unit**: 통과 (260 files, 5114 pass / 1 skip — round-3 신규 +11)
- **build**: 통과 (route 충돌 0)
- **e2e**: 통과 — backend supertest 243 + FE Playwright(slug-routing 4). fix 후 재수행은 §재수행 참조

## 수렴 판단 (convergence)

ai-review 3라운드(전부 Critical 0) + `--impl-done` consistency BLOCK:NO 완료. 위험도 궤적이
수렴적(round1 실 gap → round2 follow-up → round3 real bug 1건, 이제 수정)이고, round-3 real
bug(W1)는 이미 ~30곳에서 검증된 `buildWorkspaceHref` 패턴의 1개 인스턴스(멀티라인 표기로 누락됐던
것)를 동일 패턴으로 교정 + 단위테스트로 lock 했다. 잔여는 defer(W3·W4, 저위험/scope 밖)뿐.
본 fix 커밋에 대한 최종 fresh review 를 1회 더 수행해 real bug 부재를 확인한다(§재수행).

## §재수행

- fix 커밋 후 backend e2e(243)·FE Playwright(slug-routing 4) 재통과.
- 최종 fresh ai-review 결과는 본 세션 이후 리뷰 세션 SUMMARY 로 갱신.
