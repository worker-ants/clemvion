# RESOLUTION — spec-sync-602-followup / 16_45_33 (fresh re-review)

대상 commits: `f15b3cb9`(doc 정합) · `462e4499`(ai-review fix). RISK LOW / Critical 0 / Warning 1.
본 RESOLUTION: **추가 코드 변경 없음** — 잔여는 out-of-scope/false-positive/accept.

> 직전 review(16_34_50) 의 fix(462e4499) 후 fresh re-review. Critical 0 유지, 실질 발견 모두 해소.

| # | 분류 | 처리 | 근거 |
|---|------|------|------|
| W-1 | Testing | **defer (범위 밖)** | `/usage` e2e 커버리지 갭은 **#602 기능**의 후속 — 본 doc/swagger 슬라이스 변경 대상 아님. unit(getUsage periodCounts·responseCode 폴백)+frontend 커버리지는 #602 존재. 별도 MEDIUM 후속 추적. |
| I-1 | Maintainability | **이미 조치(오탐)** | `last24h` `@ApiProperty.description` 에 "(캘린더 일 경계 아님)" 이 462e4499 에 이미 추가됨 — TSDoc 과 일치. 리뷰어가 base(origin/main) 를 읽은 stale 판정. `git show HEAD:...dto.ts` 로 확인. |
| I-3 | Documentation | **이미 유효(오탐)** | `[R-6](6-config.md#rationale)` 의 `#rationale` 앵커는 `6-config.md:287 ## Rationale` 가 생성 — 링크 유효. |
| I-5 | Side Effect | **무관** | Swagger 스냅샷 테스트 존재 시 unit 단계에서 실패했을 것이나 unit PASS — 해당 스냅샷 테스트 부재 또는 영향 없음. |
| I-2 | Maintainability | **accept (장기)** | 파일 전체 `@ApiProperty type` 통일은 별도 리팩토링 — 본 슬라이스는 변경 필드만 정합. |
| I-4 | Security | **accept (범위 밖)** | `/usage` RBAC 가드는 기존 spec §2.17·§3.2 전제 — 본 diff 신규 도입 아님. |

## 결론
Critical 0. 실질 발견(I-1·I-3) 이미 조치/유효. W-1·I-2·I-4 는 범위 밖/장기 accept. 추가 코드 변경 없음 → 16_45_33 이 최신 commit(462e4499) postdate, freshness 충족.
