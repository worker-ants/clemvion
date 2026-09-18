# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 대상(`plan/in-progress/spec-draft-deletion-cascade-indexes.md`, V112~V116 FK 인덱스 마이그레이션)은 `spec/conventions/migrations.md` §5 규약(DROP-먼저 + CONCURRENTLY 패턴, V111 선례)과 정합하고, 신규 식별자 5종·e2e 파일 1개 모두 grep 0건으로 충돌 없음이 독립 재확인됨.

## 전체 위험도
**LOW** — 기능적 위반은 0건이나, impl-prep 번들 예산 초과로 실제 관련 규약(`migrations.md`)이 3개 checker(cross_spec/rationale_continuity/convention_compliance) 모두에서 자동 로드에 실패한 하네스 결함이 재발(WARNING)했고, 이번 건은 각 checker 가 번들 밖에서 직접 Read 로 보완해 판정에는 영향이 없었음이 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec / rationale_continuity / convention_compliance (중복 통합) | impl-prep 번들 예산 초과로 `spec/conventions/` 274개 중 268개(97.8%) 본문 생략 — 하필 이번 작업이 직접 인용하는 `migrations.md` 및 ②출력포맷·④API문서 규약(`swagger.md`·`error-codes.md` 등) SoT 문서가 전부 생략 대상에 포함 | 조립된 프롬프트(`_prompts/*.md`) 전체 — Cafe24/Makeshop API 카탈로그(수백 개 field-level 문서)가 알파벳/디렉토리 순서상 먼저 걸려 예산을 소진 | 기존 하네스 결함(`feedback_consistency_spec_mode_budget.md`)의 3번째 재발 | 이번 결과는 3개 checker 전원이 번들 밖에서 `migrations.md` 등을 직접 Read 로 보완해 위반 없음을 확인했으므로 재실행 불요. 다만 번들러가 plan 의 `spec_impact`/구현 절이 실제 참조하는 파일을 카탈로그류보다 우선 적재하도록 하드닝 권고 (harness 개선, 이 PR 블로커 아님) |
| 2 | convention_compliance | `cafe24-api-catalog/_overview.md` 가 형제 파일(`category.md`·`store.md`·`translation.md`)과 달리 lifecycle frontmatter(`id`/`status`/`code`) 없음 | `spec/conventions/cafe24-api-catalog/_overview.md` 최상단 | `spec/conventions/spec-impl-evidence.md` §7.1 카탈로그 frontmatter 면제 범위(원문 truncate 로 정확한 문구 미확인) | `_overview.md` 에 frontmatter 추가 또는 §7.1 에 "디렉토리 진입점은 면제 밖" 명시. 이번 PR 범위 밖(별도 착수 권장) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `restricted` 빈칸 사유 각주 개수 불일치 — `store.md` 는 3개 operation id 를 들지만 SoT 인 `cafe24-restricted-scopes.md` 는 2개만 열거(`paymentmethods_paymentproviders_update_display` 누락) | `spec/conventions/cafe24-api-catalog/store.md` §Rationale ↔ `spec/conventions/cafe24-restricted-scopes.md` §Trade-off | `cafe24-restricted-scopes.md` 에 누락된 operation id 추가하여 두 문서 열거 일치 |
| 2 | plan_coherence | `cafe24-api-catalog` mains_update/mains_delete 존재 여부 모순 — `_overview.md` Rationale 은 "docs 부재 확정"이라 하나 `category/mains.md` 는 여전히 PUT/DELETE 를 실존 항목으로 기재. 2026-07-26 다른 무관 티켓에서 발견돼 `cafe24-backlog-residual.md` 로 이관됐고 이번에도 또 다른 무관 티켓(본 draft)에서 재발견 — 이번 PR 범위와 무관, 이미 plan 추적 중 | `spec/conventions/cafe24-api-catalog/_overview.md` ↔ `category.md`/`category/mains.md` | `cafe24-backlog-residual.md` 의 해당 항목(Cafe24 공식 docs PUT/DELETE 실존 재확인)을 독립적으로 착수해 닫을 것 — "무관한 티켓에 딸려서만 재발견"되는 패턴 2회째 |
| 3 | convention_compliance | 일부 convention 문서(`cafe24-api-catalog/_overview.md`, `cafe24-api-metadata.md`)가 명시적 `## Overview` 헤딩 없이 본문 시작 — 같은 폴더 `audit-actions.md` 는 헤딩 있음(스타일 불일치) | 두 문서 intro 문단 직후 | 두 문서에 `## Overview` 헤딩 추가 (CLAUDE.md 권장 3섹션 구성) |
| 4 | convention_compliance | `codebase/backend/migrations/README.md` §2 `-- DOWN:` 예시가 일반 트랜잭션 형태만 보이고, 실제 V105·V106·V109~V111 이 쓰는 CONCURRENTLY 전용 한 줄 변형은 미기재 | `codebase/backend/migrations/README.md` §2 | README §2 예시 아래 CONCURRENTLY 전용 `-- DOWN(...)：` 변형 예시 추가 |
| 5 | naming_collision | 인덱스 검증 e2e 패턴 이원화 — 기존 선례(V111)는 "리소스별 삭제 e2e 파일에 얹기", 이번 draft 는 3개 테이블에 걸친 "전용 파일"(`deletion-cascade-indexes.e2e-spec.ts`) 신설. 이름 충돌은 없음 | `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (신규) | 충돌 아니므로 이 PR 은 변경 불요. 다음 유사 인덱스 PR 에서 두 패턴 중 하나로 수렴할지는 별도 판단 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 번들 예산 갭(WARNING 1, migrations.md 미로드) + 각주 불일치(INFO 1). 로드된 범위(감사 로그·Cafe24 카탈로그) 내 CRITICAL 없음 |
| rationale_continuity | LOW | migrations.md 를 직접 Read 로 보완, V112~V116 이 §5 DROP-먼저 규칙(V111 성문화)을 정확히 인용·준수함을 확인. 예산 갭은 INFO로 등재만 |
| convention_compliance | LOW | 번들 예산 갭(WARNING) + `_overview.md` frontmatter 결여(WARNING) + Overview 헤딩/README 예시 갭(INFO 2). 마이그레이션 규약 자체는 준수 확인 |
| plan_coherence | NONE | draft 가 migrations.md §5 규약과 완전 정합. 기존 미해결 cafe24 모순(무관 항목) 1건만 INFO로 재확인 |
| naming_collision | NONE | 신규 식별자 5종(인덱스명)+V112~V116+e2e 파일 1개 전수 grep 0건 재확인. 애플리케이션 코드 변경 없음 |

## 권장 조치사항
1. 이번 PR(V112~V116 FK 인덱스 마이그레이션)은 착수 가능 — BLOCK 사유 없음. 5개 checker 모두 CRITICAL 0건이며, plan 이 `migrations.md` §5 규약(V111 선례)을 정확히 인용·준수함이 독립적으로 재확인됨.
2. developer 는 구현 착수 직전 `python3 scripts/check-migration-versions.py --base origin/main` 를 재실행해, 이 세션과 실제 커밋 사이 시간차 동안 다른 PR 이 V112 를 선점하지 않았는지 확인 (naming_collision 제안, `migrations.md` §6.2 절차).
3. (harness 개선, 비차단) impl-prep/─spec 번들러가 conventions 디렉토리 순회 시 plan 의 `spec_impact`/구현 절이 실제 참조하는 파일을 Cafe24/Makeshop API 카탈로그류보다 우선 적재하도록 하드닝 — 동일 결함이 이번 라운드에서 3개 checker 전원에게서 재확인됨.
4. (별도 항목, 비차단) `spec/conventions/cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 추가 또는 `spec-impl-evidence.md` §7.1 예외 범위에 디렉토리 진입점 지위를 명시.
5. (별도 항목, 비차단) `cafe24-backlog-residual.md` 의 mains_update/mains_delete 존재 여부 재확인 항목을 독립적으로 착수해 닫을 것 — 무관한 티켓 스코프에 딸려 두 번째로 재발견됨.
