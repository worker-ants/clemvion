# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 모두 Critical 발견 없음(cross_spec/rationale_continuity/convention_compliance/plan_coherence: LOW, naming_collision: NONE).

## 전체 위험도
**LOW** — Critical 없음. 실제 diff(raw-SQL `UPDATE`/`DELETE ... RETURNING` 튜플 shape 버그 수정 8곳)는 기존 spec 계약을 위반하지 않고 오히려 장기 미작동 가드를 복원한다. 잔여 이슈는 (1) 이 세션의 target 프레이밍이 실제 diff 와 불일치(워크트리 재사용에 따른 harness 결함, 이미 기록된 known issue), (2) 소급 caveat·문서 stale 포인터 등 문서 갱신 지연 몇 건이다.

## 사전 확인 — target 프레이밍과 실제 diff 불일치 (5개 checker 전원 공통 확인)

5개 checker 모두 독립적으로 다음을 실측·보고했다:

- 프롬프트가 지목한 target(`spec/5-system/`, "EIA r8 캐시 스코프")과 이 워크트리
  (`eia-r8-cache-scope-4ae434`)의 실제 체크아웃 브랜치는 무관하다. `git diff origin/main...HEAD -- spec/`
  결과는 **0줄**이며, 실제 변경은 `codebase/backend/src/{modules/auth,modules/execution-engine,
  modules/knowledge-base,common/utils,common/__test-utils__}` 의 raw-SQL `RETURNING` 튜플 오독
  버그 수정(+ e2e 신설)뿐이다.
- 이 harness 라우팅 결함(워크트리 이름 재사용 → 무관한 target 추론)은 **이미 동일 세션의
  `plan/in-progress/update-returning-tuple-shape.md`(§후속)에 원인·처방 후보와 함께 기록된
  known issue**다. 5개 checker 전원이 이를 CRITICAL 로 재상신하지 않고, 실제 존재하는 diff 를
  대상으로 각자의 관점(cross-spec/rationale/convention/plan/naming)에서 분석을 수행했다 —
  이는 프로젝트 메모리에 기록된 과거 오탐 패턴("워크트리 절대경로에서 작업 성격을 추론해
  spec 델타 0을 CRITICAL 로 오판")을 checker 들이 올바르게 회피한 결과다.
- (참고: `convention_compliance` 는 별도로, 이 워크트리 이름이 원래 가리켰을 "EIA §R8 idempotency
  캐시 스코프" 작업 자체는 이미 `origin/main` 에 `#1153`~`#1167` 로 완전히 머지되어 있음을
  확인했다 — 즉 이 세션이 그 작업을 다시 검토하려는 것이었다면 델타 0 인 게 정상이다.)

이 사실 자체는 target 문서의 결함이 아니라 **호출측(orchestrator) 세션 관리 이슈**이므로
Critical 위배 표에 올리지 않고 WARNING 으로 통합했다(아래).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 Critical 0건)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 이 없으므로 인계 대상 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 검토 세션의 target 프레이밍(`spec/5-system/`, "EIA r8 캐시 스코프")이 실제 diff·브랜치와 불일치 (워크트리 이름 재사용) | 워크트리 경로 `eia-r8-cache-scope-4ae434` / 실제 브랜치 (raw-query-audit-followups 계열) | 실제 `git diff origin/main...HEAD` (코드 전용, spec 무변경) | 이미 `plan/in-progress/update-returning-tuple-shape.md` §후속에 처방 후보(브랜치명·plan 파일 프롬프트 병기, 워크트리 재사용 시 rename 강제) 등재됨 — 신규 항목 불요. orchestrator 는 다음 세션 착수 전 워크트리-브랜치 정합 재확인 |
| 2 | rationale_continuity, plan_coherence | admission gate·CAS 락·종결 이벤트 가드가 "항상 작동한다"는 무조건적 보장으로 서술되어 있으나, 실측 결과 2026-06-14~08-13 사이 실제로는 한 번도 발동하지 않았음 — target 에 소급 caveat 미반영 | `spec/5-system/4-execution-engine.md` §1.1·§8, `spec/5-system/8-embedding-pipeline.md` §7.3.2, `spec/5-system/10-graph-rag.md` §7, `spec/data-flow/2-auth.md`(OAuth state 소비), `spec/conventions/node-cancellation.md` §2.4 | `plan/in-progress/update-returning-tuple-shape.md` 의 실측(TypeORM RETURNING 튜플 오독으로 8곳 가드 미발동) | 이미 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임(2026-08-14 #12)" 에 5개 문서 caveat 문구까지 구체적으로 등재됨(owner: project-planner) — project-planner 턴에서 #12 집행 시 위 3개 target 파일 frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 추가 + 각 절에 "8332d9a20(2026-08-13) 이전 미작동" 각주 반영 확인 |
| 3 | convention_compliance | `data-flow/15-external-interaction.md` §4 Redis 키 캐빗이 `conventions/redis-keys.md` 신설(#1160) 이후 stale — "§9.1 참고, EIA 키는 미등재" 라고 하지만 §9.1 은 이제 redirect-only 이고 EIA 키는 이미 `redis-keys.md §3` 에 등재됨 | `spec/data-flow/15-external-interaction.md` §4 외부 의존, Redis 행 (약 line 310) | `spec/5-system/4-execution-engine.md` §9.1(redirect-only 로 재작성됨, #1160) / `spec/conventions/redis-keys.md` §3 전역 인벤토리(`interaction:idempotency:...` 이미 등재) | 문장을 "키 형태·전역 인벤토리는 conventions/redis-keys.md 참고" 로 정정, "아직 미등재다(별도 항목)" 구절 삭제 — project-planner 턴에서 처리 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | raw-SQL `UPDATE/DELETE ... RETURNING` 튜플 shape 처방이 신규 헬퍼(`update-returning-rows.ts`) 1곳 + 기존 미이관 관용구 3곳(agent-memory-admin·stuck-document-recovery·integration-oauth)으로 분산, 정식 convention 문서 부재 | `spec/conventions/**` (RETURNING 다루는 문서 0건) | `spec/conventions/` 에 "raw query 결과 shape" 절 신설 고려 (project-planner 턴, 필수 아님) |
| 2 | rationale_continuity | `spec/conventions/node-cancellation.md` §2.4 "구현됨(2026-07-28)" 표현이 "retry 재진입 종결 경로" 항목에 한해 특히 오인 소지 큼(다른 두 항목은 이번 버그 영향 없음 확인됨) | `spec/conventions/node-cancellation.md:97-103` | 위 WARNING #2 와 동일 planner 턴에서, 문서 전체가 아니라 해당 단락에만 각주 추가 |
| 3 | convention_compliance | `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표에 `410 Gone` 행 누락 (EIA/webhook 에서 이미 사용 중, 이번 diff 와 무관한 기존 갭) | `spec/5-system/2-api-convention.md` §6 (line 197-213) | 후속 spec-sync 시 410 행 추가 고려, 우선순위 낮음 |
| 4 | plan_coherence | `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 에 `ie-resume-turn-boundary-cancel.md`/`spec-update-node-cancellation-shutdown-classification.md` 가 미등재(두 plan 의 `spec_impact` 는 이 문서를 포함) — 편도 가드(`spec-pending-plan-existence.test.ts`)라 구조적으로 강제 안 됨, 저장소 기존 패턴 | `spec/5-system/4-execution-engine.md` frontmatter | project-planner 스윕 시 참고, 급하지 않음 |
| 5 | naming_collision | target(`spec/5-system/`) 델타 0 — 코드 전용 PR 이라 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·env var·spec 경로 어느 것도 신규 도입되지 않음. 코드 레벨 신규 export `updateReturningRows` 는 spec 표면과 무관하며 충돌 없음 | `spec/5-system/` 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target 프레이밍 불일치(WARNING #1) + raw-SQL 관용구 분산(INFO #1). 실제 diff 는 OAuth state 소비·execution admission gate·KB CAS 락 3곳 모두 기존 spec 계약 위반을 바로잡는 방향으로 새 모순 없음 |
| rationale_continuity | LOW | 5개 spec 문서 소급 caveat 필요(WARNING #2, 이미 project-planner 위임 완료) + node-cancellation §2.4 표현 오인 소지(INFO #2). 기각된 대안 재도입·원칙 위반 없음 |
| convention_compliance | LOW | 리뷰 대상 무효 가능성 경고(WARNING #1) + data-flow/15 §4 stale 포인터(WARNING #3, 미위임 상태로 신규 발견) + 410 Gone 표 누락(INFO #3). CRITICAL 급 정식 규약 위반 없음 |
| plan_coherence | LOW | 3개 target 문서의 소급 caveat·`pending_plans` 미반영(WARNING #2, 이미 #12 로 위임) + frontmatter 비대칭(INFO #4). PR 이 plan 의 미해결 결정을 우회하는 사례 없음 |
| naming_collision | NONE | target 델타 0, 신규 식별자 없음 → 충돌 여지 자체가 없음(INFO #5) |

## 권장 조치사항

1. (BLOCK 해소 우선) 해당 없음 — Critical 없음, 이 PR(코드 전용 RETURNING 튜플 shape 수정)은 그대로 진행 가능.
2. orchestrator: 다음 세션 착수 전 워크트리(`eia-r8-cache-scope-4ae434`) 이름과 실제 체크아웃 브랜치의 정합을 재확인 — `plan/in-progress/update-returning-tuple-shape.md` §후속에 등재된 처방 후보(브랜치명 병기·재사용 시 rename)를 참고. 신규 처방 불요.
3. project-planner 턴: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #12 를 집행하여 `execution-engine.md`(§1.1·§8) · `embedding-pipeline.md`(§7.3.2) · `graph-rag.md`(§7) · `data-flow/2-auth.md` · `node-cancellation.md`(§2.4) 5개 문서에 "2026-08-13 이전 미작동" 소급 각주 + 해당 3개 target 파일 frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 등재.
4. project-planner 턴: `spec/data-flow/15-external-interaction.md` §4 Redis 키 캐빗 문장을 `conventions/redis-keys.md` 참조로 정정하고 "미등재" 구절 삭제.
5. (낮은 우선순위, 필수 아님) `spec/5-system/2-api-convention.md` §6 표에 `410 Gone` 행 추가, `spec/conventions/` 에 raw query RETURNING shape 절 신설 고려.