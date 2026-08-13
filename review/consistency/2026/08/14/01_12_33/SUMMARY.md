# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — 검토 대상 자체가 무효(target 델타 0)이며, 그 근본 원인은 오케스트레이터의 워크트리/브랜치 라우팅 오류로 checker 권한 밖 문제

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | 검토 전제 자체가 무효 — target(`spec/5-system/`, EIA r8 cache-scope) 델타가 diff-base(`origin/main`) 대비 완전히 0. 이 워크트리(`eia-r8-cache-scope-4ae434`)는 실제로는 `spec/`를 전혀 건드리지 않는 무관한 브랜치(`claude/raw-query-audit-followups`, OAuth/execution-engine/knowledge-base RETURNING 튜플 버그 수정 14개 커밋)를 체크아웃 중이며, EIA r8 관련 실작업은 별도 워크트리 `eia-spec-r8-alignment-fff754`(브랜치 `claude/eia-spec-r8-alignment-fff754`, `plan/in-progress/spec-draft-eia-r8-alignment.md` 로 추적)에 있다 | `spec/5-system/14-external-interaction-api.md` §R8("Idempotency-Key 와 submit_form 검증 실패의 관계", "캐시 키 스코프", line 1135~1152) — 이미 origin/main 에 완성 병합된 상태로 확인됨(커밋 `a80599700`, `git merge-base --is-ancestor a80599700 origin/main` = true) | 프롬프트 `## ⚠️ 현재 구현 코드의 기준` 절이 지목한 워킹트리 전체(경로-브랜치 불일치) | 오케스트레이터가 `eia-r8-cache-scope-4ae434` 워크트리 경로를 EIA r8 작업으로 재매핑하거나, 실제 작업 워크트리 `eia-spec-r8-alignment-fff754`를 대상으로 5개 checker를 재호출. `plan/in-progress/spec-draft-eia-r8-alignment.md`는 실제 델타(있다면)를 재산정 후 `plan/complete/`로 이동하거나, 델타 0이면 폐기 처리 |

## planner 인계 (권한 밖 Critical)

> 이 CRITICAL은 spec drift가 아니라 **오케스트레이터의 워크트리 라우팅 오류**가 근본 원인입니다. `developer`나 checker가 이 세션 내에서 수정할 수 있는 권한 범위 밖이며, planner의 spec 정정 문제도 아닙니다. 표는 형식을 맞춰 기록하되, 실제 조치 주체는 **오케스트레이터(호출자)**입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 워크트리-브랜치 매핑이 이 checker 세션 실행 시점에 이미 고정되어 있어, checker/summary-agent가 직접 재라우팅 불가. 근본 원인은 spec 내용이 아니라 orchestrator의 세션 경로 지정 | 오케스트레이터(호출자) — 워크트리 경로 재매핑 후 재실행. spec 자체 정정이 필요하면 그다음 project-planner | `eia-r8-cache-scope-4ae434` 워크트리를 올바른 브랜치로 재생성하거나 `eia-spec-r8-alignment-fff754`로 대상 교체 | `plan/in-progress/spec-draft-eia-r8-alignment.md` (status: in-progress, worktree: eia-spec-r8-alignment-fff754) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, plan_coherence | `OAUTH_STATE_MISMATCH`(400)가 여전히 `3-error-handling.md` 공용 에러 카탈로그(§1.2 인증/인가 에러)에 미등재 — 자매 코드 `KB_REEMBED_IN_PROGRESS`·`KB_REEXTRACT_IN_PROGRESS`(§1.8)는 등재됨. 이번 diff로 이 코드가 "튜플 shape 오인으로 상시 발동"에서 "실제 이상 상황에서만 발동"으로 의미가 복원되어 지금부터 실질 갭이 됨 | `spec/5-system/3-error-handling.md` §1.2 | `spec/conventions/error-codes.md` §1(적용 범위), `3-error-handling.md` 자체의 도메인별 카탈로그 등재 관례 | project-planner 턴에서 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12"(이미 §1.2로 위치 정정됨)를 집행 — `OAUTH_STATE_MISMATCH (400)` 행 추가 + `data-flow/2-auth.md` 상호링크. `developer`는 spec 쓰기 권한이 없어 이번 PR로는 반영 불가(정상). `status: implemented`라 R-5 `pending_plans:` 강제 대상도 아니어서 build 가드가 이 갭을 못 잡음 — 수동 추적 의존 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 번들 내 기존 spec 본문(1-auth.md·3-error-handling.md 전문·1-data-model.md 발췌) spot-check 결과 새 모순 없음(단, target 델타를 못 본 상태의 제한적 관찰) | `spec/5-system/1-auth.md`, `3-error-handling.md`, `1-data-model.md` | 조치 불요 |
| 2 | cross_spec | EIA §R8 캐시 스코프(line 1135~1152) vs `data-flow/15-external-interaction.md`(Redis 표) vs `3-error-handling.md` §1.6(409/410) 3개 문서 간 캐시 대상·키 스코프·fail-open 정책 모두 일치 확인 | `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/15-external-interaction.md`, `spec/5-system/3-error-handling.md` | 조치 불요 |
| 3 | rationale_continuity | 이 워크트리의 실제 diff(UPDATE/DELETE RETURNING 튜플 shape 버그 수정, auth-oauth/execution-engine/knowledge-base 4개 지점)는 기존 Rationale(OAuth state one-shot DELETE, 동시성 cap admission gate, KB CAS 락 race-free)을 위반하지 않고 오히려 수개월간 무력화돼 있던 invariant를 복원함 | `codebase/backend/src/modules/{auth,execution-engine,knowledge-base}/*.service.ts`, `common/utils/update-returning-rows.ts` | `plan/in-progress/update-returning-tuple-shape.md`의 `[planner 위임]` 소급 각주 항목(5개 문서: `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`data-flow/2-auth.md`·`conventions/node-cancellation.md`) 집행은 이미 등재되어 있어 별도 조치 불요 — planner 턴에서 확인만 |
| 4 | convention_compliance | 위임 plan이 초판에서 지정한 카탈로그 삽입 위치(§1.8)가 도메인상 어긋났었으나 `f5ab3040c`에서 §1.2로 이미 정정 완료 확인 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` | 조치 불요(완료 확인) |
| 5 | convention_compliance | 신규 코드 표면(`update-returning-rows.ts`, `AuthOAuthStateRow`)은 명명·출력 포맷 규약 위반 없음 | `codebase/backend/src/common/utils/update-returning-rows.ts` | 조치 불요 |
| 6 | plan_coherence | `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md` frontmatter `pending_plans`가 아직 `update-returning-tuple-shape.md`를 가리키지 않음 — 이미 §"추가 위임 #12" 부수 항목으로 등재되어 실행 대기 | `spec/5-system/4-execution-engine.md`, `8-embedding-pipeline.md`, `10-graph-rag.md` | planner가 §"추가 위임 #12" 집행 시 함께 반영 |
| 7 | plan_coherence | admission gate 원자성(§1.1)·CAS 락 소급 caveat 미반영 — 이미 plan에 등재되어 조치 불요 | `spec/5-system/4-execution-engine.md` §1.1, `8-embedding-pipeline.md` §7.3, `10-graph-rag.md` 동시 호출 표 | planner 턴에서 위 WARNING과 일괄 집행 |
| 8 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md`의 유일한 미해결 "결정 필요" 항목(SIGTERM/timeout 최종 상태 분류, `shutdown-state.service.ts`)은 이번 diff와 무관 — 충돌 없음 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` | 조치 불요 |
| 9 | naming_collision | 신규 식별자(`updateReturningRows`, `AuthOAuthStateRow`, `countCalls`, `__testing__` 디렉토리) 전수 확인 결과 기존 사용처와 충돌 없음 | `codebase/backend/src/common/utils/**`, `auth-oauth.service.ts` | 조치 불요 |
| 10 | naming_collision | `scope=spec/5-system/`로 라우팅됐으나 실제 diff는 코드 전용 — cross_spec/rationale_continuity가 지적한 워크트리 라우팅 오류와 동일 근본 원인의 다른 증상 | (스코프 설정 자체) | 위 Critical 항목의 재라우팅으로 함께 해소됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | target 델타 0 + 워크트리가 무관한 브랜치를 체크아웃 중, 검토 자체가 무효 |
| rationale_continuity | HIGH | 동일 워크트리 라우팅 오류 재확인(직전 라운드와 동일). 실제 diff는 기존 Rationale 준수·복원 방향 |
| convention_compliance | LOW | spec 변경 없음. `OAUTH_STATE_MISMATCH` 카탈로그 미등재 WARNING만 잔존(이미 위임됨) |
| plan_coherence | LOW | spec 변경 없음, plan과 충돌 없음. 동일 WARNING(카탈로그 미등재)만 잔존 |
| naming_collision | NONE | 신규 식별자 충돌 없음. 스코프 미스매치만 부기 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** 오케스트레이터가 `eia-r8-cache-scope-4ae434` 워크트리의 브랜치 상태를 재확인하고, EIA r8 cache-scope 작업의 실제 소재지(`eia-spec-r8-alignment-fff754` 워크트리 또는 그 후속)로 5개 checker를 재라우팅해 재실행한다. `spec/5-system/14-external-interaction-api.md` §R8이 이미 `origin/main`에 병합 완료(`a80599700`)된 것으로 확인되므로, 재확인 결과 델타가 여전히 0이면 이 리뷰 라운드 자체를 폐기하고 `plan/in-progress/spec-draft-eia-r8-alignment.md`를 완료 이동 또는 폐기 처리한다.
2. project-planner 턴에서 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 #12"를 집행 — `3-error-handling.md` §1.2에 `OAUTH_STATE_MISMATCH (400)` 행 추가, 관련 3개 문서(`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`)의 `pending_plans:`에 `update-returning-tuple-shape.md` 등재, 5개 문서에 소급 caveat 각주 반영.
3. 이번 워크트리에 실제로 존재하는 코드 diff(RETURNING 튜플 shape 버그 수정)는 spec/plan 관점에서 그 자체로는 문제가 없어 보이나, 이는 **이 checker 세트가 검토를 위임받은 target(spec/5-system/, EIA r8)이 아니므로** 별도 세션/PR 경로로 그 자체의 코드 리뷰·consistency-check가 이미 수행됐는지 확인이 필요하다.
