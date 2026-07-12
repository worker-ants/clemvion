# Code Review 통합 보고서 (carousel 잘림 배너, 2R)

## 전체 위험도
**MEDIUM** — CRITICAL 0, WARNING 3(CHANGELOG 미갱신·테스트 부분반영·CSS 비대칭). security/user_guide_sync disk-write gap(반복 패턴, 실 결함 아님 — 이전 라운드 security NONE·user_guide_sync 는 catalog ko/en 추가로 doc-sync-matrix `new-widget-chrome-string` 충족).

## Critical
없음.

## 경고 (WARNING) — 처리
| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | 문서화 | CHANGELOG.md 미갱신 (#921 table 선례가 예고한 carousel 후속, 사용자-가시 소급 노출) | ✅ CHANGELOG Unreleased 항목 추가(#921 대칭) |
| 2 | 테스트 | 부분 반영 — carousel 우선순위 lock-in/no-op 테스트 + 복원 thread 컴포넌트 테스트 0건 | ✅ 우선순위 lock-in·null/문자열 no-op unit + payloadOf carousel 컴포넌트 테스트 추가, RESOLUTION 문구 정정 |
| 3 | CSS | `.wc-carousel-truncated` 규칙 부재(styles.ts 미갱신) → table 배너와 시각 비대칭 | ✅ styles.ts 에 `.wc-carousel-truncated`(= `.wc-table-truncated` 공유/대칭) 추가 |

## 참고 (INFO) — 처리
| # | 발견 | 처리 |
|---|------|------|
| 1 | asTotalCount tighten 이 toTable 소급 변경 | 의도된 spec §R8 정합, 회귀 커버 — PR 노트 명시 |
| 2 | dead-field 소급 노출 | 의도된 변경, PR 노트 명시 |
| 3 | CarouselData non-optional 필드 | 조치 불요(동일 diff 동기화) |
| 4 | 배너 JSX 2번째 반복 | rule-of-three — 3번째 시 추출 |
| 5 | ko `carousel.truncated` 명사 생략(en 은 items 포함) | ✅ "일부 항목만 표시돼요." 로 대칭(+spec §4) |
| 6 | toCarousel/toTable JSDoc 투영 미언급 | ✅ JSDoc 1줄 추가 |
| 7 | plan 완료 노트 테스트 카운트 344 stale | ✅ 350 갱신 |
| 8 | 이전 RESOLUTION "doc-sync-matrix 밖" 근거 부정확(결론은 맞음) | 아카이브 — 소급 수정 불요, 본 SUMMARY 에 정정 기록 |
| 9 | 이전 라운드 산출물·spec 편집 diff 포함 | 정상(Phase A/B 한 worktree) |

## 에이전트별 위험도
requirement LOW · scope NONE · side_effect LOW · maintainability LOW · testing MEDIUM(→W2) · documentation MEDIUM(→W1) · security/user_guide_sync disk-write gap(실 결함 아님, 위 판정)

## 권장 조치 → 처리
1. security/user_guide_sync 재실행 → 다음 fresh 라운드 수행(실 결함 아님 판정)
2. ✅ CHANGELOG
3. ✅ 테스트 보강(no-op/lock-in + 컴포넌트)
4. ✅ styles.ts CSS
5. ✅ plan count·ko 문구
