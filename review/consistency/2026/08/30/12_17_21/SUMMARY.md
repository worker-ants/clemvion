# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보(전문 인라인 authoritative), CRITICAL 발견 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, (a) impl-prep 번들 예산 초과로 `spec/conventions/` 335개 중 6개만 전문 검토됐고(naming_collision·plan_coherence 가 각각 MEDIUM 판정), (b) 이번 턴이 집행하려는 `[planner 위임]` 항목이 다른 plan 파일에 이미 선점된 "정본" 문구와 충돌 없이 동기화돼야 하는 실행 리스크가 구체적으로 확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 이 발견되지 않아 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (+ cross_spec·rationale_continuity·convention_compliance 공통 관찰) | `--impl-prep` 번들 예산 초과로 `spec/conventions/` 335개 중 328개(98%)가 "본문 생략됨" 처리 — error-codes/redis-keys/secret-store/node-output/execution-context/swagger/migrations/makeshop-* 등 신규 식별자·규약 정합 검증에 직결되는 파일 다수 미검증 | `spec/conventions/` 전체(6개 spec 파일만 전문 포함) | 없음(모순 아니라 검토 커버리지 결함) — 이 저장소에서 반복 관측된 기존 결함(orchestrator 번들링 예산 로직) | 재실행 시 청크 분할(파일별 또는 20~30개 batch)로 전문 포함되게 조정. 그 전까지 이번 회차의 "충돌/모순 없음" 판정을 절단된 328개 파일에는 적용 금지 — 미검증 상태로 간주 |
| 2 | plan_coherence | `node-cancellation.md` §2.4 각주가 다른 plan 파일(`spec-update-node-cancellation-shutdown-classification.md` #12 티켓)에 이미 "정본" 문구로 선점돼 있음 — 독립적으로 다시 쓰면 이 저장소에서 이미 두 번 틀린 문구(서술형 라벨 → 한 파일만 집계)를 세 번째로 반복할 위험 | `spec/conventions/node-cancellation.md` §2.4 (현재 각주 없음) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:625` (확정된 caveat 문구) | §2.4 각주는 `:625` 문구를 그대로(또는 동기화해) 사용. 반영 후 #12 표에서 `node-cancellation.md` 행을 완료로 표시 |
| 3 | plan_coherence | #12 집결 티켓 5건 중 4건(`execution-engine.md` §1.1·`embedding-pipeline.md` §7.3·`graph-rag.md` 동시호출 표·`data-flow/2-auth.md` OAuth state)이 `spec/conventions/` 밖이라 이번 턴 스코프상 구조적으로 닫을 수 없음(4건 모두 소급 각주 grep 0건 실측 확인) — plan 이 "5건 일괄"로 서술돼 있어 부분완료가 불분명해질 위험 | target 번들 스코프 `spec/conventions/` | `spec-update-node-cancellation-shutdown-classification.md:619-624` 표 4행 | 이번 턴에서 `node-cancellation.md` 몫만 닫는다면 #12 표에 "1/5 완료, 나머지 4건은 `spec/conventions/` 밖" 명시 |
| 4 | plan_coherence | `node-cancellation.md` frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 미등재 — plan 이 명시적으로 지시했고 target scope 안에 있어 이번 턴에서 처리 가능/필요 | `spec/conventions/node-cancellation.md` frontmatter (현재 1건만 등재) | `plan/in-progress/update-returning-tuple-shape.md:365` | frontmatter `pending_plans:` 에 해당 plan 경로 추가 |
| 5 | naming_collision | `cafe24-api-catalog/store.md` 의 `privacy_*` id 6개가 별도 `privacy` resource 와 네임스페이스상 혼동 소지(리터럴 충돌은 아님) — 스펙 저자 스스로 이미 인지·미해결로 남긴 항목 | `spec/conventions/cafe24-api-catalog/store.md` (`privacy_boards_get` 등 6개) | `spec/conventions/cafe24-api-catalog/privacy.md`, `approvalGroup: 'privacy'` | `store_privacy_*` 류로 재명명(breaking, 동반 갱신 필요)하거나 최소한 `_overview.md` 의 산문 각주를 `plan/in-progress/` 항목으로 승격해 유실 방지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | raw UPDATE/DELETE RETURNING 소비 규약이 `spec/conventions/` 어디에도 아직 없음(모순 아니라 부재, 4번째 독립 재발견 기록됨) | `spec/conventions/migrations.md` 등 grep 0건; `plan/in-progress/update-returning-tuple-shape.md` §후속 | 규약 신설 시 `execution-engine.md` §7.5·§7.4 의 "의도된 raw UPDATE 우회(경합 판정용 조건부 UPDATE, `affected` 기반)" 지점을 규약 적용 대상에서 명시적으로 제외하거나 상호 참조할 것 |
| 2 | rationale_continuity | `node-cancellation.md` §2.4 Rationale 이 이미 "새 guarded UPDATE 경로에서 affected=0→무조건 skip 을 기본 가정하지 말 것"(2026-08-15 두 차례 정정 이력, Stop 버튼 무음화 사고 포함)이라는 명시적 재발방지 규칙을 보유 — raw-update-guard 확장의 1차 체크포인트 | `spec/conventions/node-cancellation.md` §2.4, §Rationale | 신규/변경 guarded UPDATE 종결 경로가 있다면 affected=0 처리를 "무조건 skip" 인지 "재조회 후 분기" 인지 분류하고 근거를 Rationale 에 남길 것 |
| 3 | rationale_continuity | 엔진 상태전이 chokepoint invariant — `updateExecutionStatus`/`assertTransition` 우회는 "이미 허용된 전이의 원자화"로만 정당화됐고, 상태머신 allow-list 와 DB 가드 SQL predicate 비동기 갱신이 2026-07-30 CRITICAL 사고(재진입 기능 무동작)를 낳은 이력 있음 | `spec/5-system/4-execution-engine.md` line 1442, 80-96 | raw UPDATE 우회 스코프 확장 시 (a) 대상 전이가 `ALLOWED_TRANSITIONS` 기존 항목인지, (b) 상태머신·DB 가드 SQL 동반 갱신 여부, (c) 재발방지 캐너리 존재 여부 확인 |
| 4 | convention_compliance | conventions 문서 23개 중 8개만 명시적 `## Overview` 헤딩 사용, 나머지 15개는 인트로 프로즈로 대체 — "도메인 규칙" vs "형식/포맷 정의" 문서 성격 축을 따라 일관되게 갈림. CLAUDE.md/SKILL.md 는 이를 "권장"(강제 아님)으로 명시 | `spec/conventions/*.md` 전체 | 오독이 반복되면 `project-planner/SKILL.md` 에 "형식 정의류는 인트로 프로즈로 대체 가능" 한 줄 명문화 |
| 5 | plan_coherence | 신규 raw-SQL 결과 불변식을 `migrations.md` 에 끼워 넣으면 그 문서의 책임(마이그레이션 *파일* 버전 안전성)과 무관한 런타임 계약이 섞여 Overview 서술과 어긋남 | `spec/conventions/migrations.md` (raw/.query(/RETURNING/updateReturningRows 언급 0건) | 신규 전용 문서(예 `spec/conventions/raw-query-results.md`)로 승격 권장. (a) 튜플 언랩 + (b) snake_case 컬럼명 두 불변식 모두 포함(과거 (b) 누락이 `rememberMe` CRITICAL 로 실현된 전례) |
| 6 | cross_spec / convention_compliance / naming_collision | 검토 가능했던 범위 내 정합성 확인(조치 불요, 참고 기록): `audit-actions.md` ↔ `5-system/1-auth.md` §4.1 액션 카탈로그 완전 일치 · `cafe24-api-metadata.md` approvalGroup ↔ `cafe24-restricted-scopes.md` SoT 매핑 일치 · `makeshop-api-catalog/*` id prefix 화는 문서화된 의도적 충돌 회피(선례 계승) · `egress-masking.md` 실제 diff 는 심볼 인용·마커 비노출·SoT 분리 규약 100% 준수(코드 실측 대조 완료) · `scopeType`/`approvalGroup`/`oneOf` 는 `Node.category` 등과 문서화된 의도적 명명 회피, 코드 주석과 드리프트 없음 · `_overview.md` frontmatter 부재는 `spec-impl-evidence.md` 제외 목록에 명시된 설계 | 각 항목 상세는 원본 checker 보고서 참고 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | raw UPDATE/DELETE RETURNING 규약 부재(모순 아님) + 신설 시 §7.5 우회 지점 스코프 명시 필요. 완전 포함 문서(audit-actions·cafe24 카탈로그)는 SoT 와 100% 일치 |
| rationale_continuity | NONE | target 에 실제 diff 없음(delta 0). node-cancellation.md §2.4·execution-engine.md §7.5 의 살아있는 invariant 2건을 향후 diff 리뷰 최우선 점검 대상으로 확인 |
| convention_compliance | NONE | 실제 diff(`egress-masking.md` +3/-2)는 규약 완전 준수. 정적 스캔에서 CRITICAL/WARNING 없음. Overview 헤딩 비일관은 권장사항 수준 INFO |
| plan_coherence | MEDIUM | 이 턴이 집행하려는 `[planner 위임]` 항목이 다른 plan 파일(#12 티켓)에 이미 선점된 정본 문구와 동기화 필요 — 독립 재작성 시 3번째 반복 오류 위험. frontmatter `pending_plans:` 미등재도 확인 |
| naming_collision | MEDIUM | 328/334 파일 절단으로 검토 커버리지 2% 미만(신뢰도 저하). 검토된 범위 내 실제 충돌 0건이나 cafe24 store.md `privacy_*` id 네임스페이스 우려(저자 기인지·미해결)는 별도 확인 필요 |

## 권장 조치사항
1. 재실행 시 `spec/conventions/` 번들을 청크 분할(파일별 또는 20~30개 batch)해 전체가 전문 포함되도록 조정하고, naming_collision·rationale_continuity·cross_spec 을 재검증할 것 — 이번 회차의 "충돌 없음" 판정은 절단된 328개 파일에는 적용되지 않는다.
2. `node-cancellation.md` §2.4 각주는 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:625` 의 확정 문구를 그대로 사용하고, 반영 후 그 plan 의 #12 표에서 해당 행을 완료로, 나머지 4건은 "spec/conventions/ 밖, 별도 턴 필요"로 명시할 것.
3. `node-cancellation.md` frontmatter `pending_plans:` 에 `plan/in-progress/update-returning-tuple-shape.md` 를 추가할 것.
4. raw UPDATE/DELETE RETURNING 규약을 신설할 때 (a) `migrations.md` 대신 신규 전용 문서(예 `raw-query-results.md`)로 승격, (b) 튜플 언랩 + snake_case 컬럼명 두 불변식 모두 포함, (c) `execution-engine.md` §7.5·§7.4 의 의도된 raw UPDATE 우회 지점(경합 판정용 조건부 UPDATE)을 적용 대상에서 명시적으로 제외/상호 참조할 것.
5. `cafe24-api-catalog/store.md` 의 `privacy_*` id 네임스페이스 우려를 산문 각주로 남기지 말고 `plan/in-progress/` 항목으로 승격해 추적할 것(breaking 재명명 여부는 별도 판단).
