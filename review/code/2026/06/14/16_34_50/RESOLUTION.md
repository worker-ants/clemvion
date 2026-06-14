# RESOLUTION — spec-sync-602-followup / 16_34_50

원본 commit: `f15b3cb9` (slice② doc 정합). RISK LOW / Critical 0 / Warning 2.

> fix commit 이 본 review(16_34_50)를 stale 하게 만든다 → fix 후 fresh `/ai-review` 한 번 더 (clean 이면 통과).

## 조치 (fix commit)

| # | 분류 | 조치 |
|---|------|------|
| I-1 | Maintainability | `last24h` `@ApiProperty.description` 에 "(캘린더 일 경계 아님)" 추가 — TSDoc 과 일치. |
| I-3/I-9 | Maintainability/Requirement | `AuthConfigUsageCallDto.responseCode` 에 `@ApiProperty({ type: String, ... })` 추가 — 인접 `sourceIp` 와 패턴 통일. |
| I-5 | Maintainability | webhook spec §7 step 7e·8b 의 `R-6` 텍스트 참조를 `[R-6](../2-navigation/6-config.md#rationale)` 링크로 교체. |
| W-1 | Side Effect | webhook spec 두 분기에 "schedule/manual 은 두 인자 생략 → 컬럼 NULL, ExecuteOptions triggerId variant 의 `sourceIp?`/`responseCode?` 는 optional" 명시 — 하위 호환 우려 해소. (실제 ExecuteOptions 는 #602 에서 이미 optional 선언·머지됨 — 코드 회귀 없음, spec 문구만 명확화.) |

## 오탐 / 범위 밖 (비조치)

| # | 분류 | 근거 |
|---|------|------|
| W-2 | Testing | `/usage` e2e 커버리지 갭은 **#602 기능**의 후속이지 본 슬라이스(doc/swagger 메타데이터)의 변경 대상이 아님. unit(periodCounts·responseCode 폴백)+frontend 커버리지는 #602 에 존재. e2e 추가는 별도 MEDIUM 후속(project-planner/developer 트랙). |
| I-6 | Database | V096 `CONCURRENTLY` 미사용은 **이미 머지된 마이그레이션**(#602) — 본 슬라이스는 data-model §3 doc 표에 인덱스 행을 추가했을 뿐. 변경 시 신규 마이그레이션 필요 → 별도 후속. |
| I-2 | Maintainability | 파일 전체 `type` 명시 통일은 장기 컨벤션 결정 — 본 슬라이스는 변경 필드만 정합. |
| I-7 | Scope | DTO description 한국어 정책은 코드베이스 다수 DTO 가 한국어 — 일관(차단 아님). |
| I-8/I-10 | Doc/Security | §1 다이어그램 각주·`/usage` RBAC 가드는 본 diff 범위 밖. |

## 결론

Critical 0. 조치 항목은 모두 mechanical·doc/메타데이터. 범위 밖/오탐은 별도 후속 추적. fresh re-review 로 freshness 충족 예정.
