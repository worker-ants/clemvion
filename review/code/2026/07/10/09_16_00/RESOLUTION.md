# RESOLUTION — ai-review (09_16_00, origin/main..HEAD rebased)

위험도 LOW / **Critical 0** / Warning 1. WARNING fix + INFO#4 fix. + 무관 main-red(Gate C) 동반 해소.

## 조치 항목
| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | maintainability | `$sourceItem.`/`$dataSource.` `getSample` 이 옵셔널 필드를 `as Record` 강제 캐스팅 — 안전성이 `available` 게이트 평가 순서라는 **타입 미강제 암묵 계약**에 의존 | **FIX** — `available` 필드 제거, `getSample` 반환 타입을 `Record<string,unknown> \| undefined` 로 정직하게. loop 에서 `const sample = getSample(d); if (sample === undefined) continue;` 로 게이팅. 캐스팅·순서 의존 제거(타입 안전). |
| INFO#4 | testing | `$dataSource.nested.` drill 테스트 부재($sourceItem 대비 비대칭) | **FIX** — nested drill 테스트 추가(parity). |
| INFO#1 | requirement | `$sourceItem`/`$dataSource` 트리거가 spec §7.1/§8.4.2 표 미기재 | 수용 — pre-existing, 본 PR 무관. project-planner 백로그. |
| INFO#2/#3/#5/#6 | perf/maint/test/doc | prefix 순서 짧은 `startsWith` 2회·잔여 대칭 중복·gate fall-through pin·필드 JSDoc | 수용 — 저위험/pre-existing. getSample 통합으로 #3(중복)·#6(계약 명시) 상당부분 완화. |

## 동반 수정 — main Gate C 언블록 (본 PR 무관 pre-existing main-red)
- `spec-plan-completion.test.ts`(Gate C) 가 **origin/main 에서 이미 red**였다: `plan/complete/expression-enricher-dry.md`(#880, **내 회귀** — `git mv` 가 spec_impact Edit 을 미스테이징한 [[reference_git_mv_unstaged_edits]] 트랩)·`eia-secret-masking-residuals.md`(#881) 두 완료 plan 이 `spec_impact` frontmatter 누락.
- **조치**: 전자에 `spec_impact: none`(behavior-preserving), 후자에 `spec_impact: [14-external-interaction-api.md]`(#881 이 실제 수정한 spec) 추가. Gate C 506/506 PASS 로 main-red 해소.

## TEST 결과
- lint: 통과
- unit: 통과 (suggestions 57 + Gate C 506 포함; 전체 재수행 §아래 — 이전 실패는 위 Gate C 언블록으로 해소)
- build: 통과
- e2e: 통과 (전체 재수행)

## 보류·후속
- spec §7.1/§8.4.2 자동완성 표에 `$sourceItem`/`$dataSource` 트리거 행 — project-planner 백로그.
