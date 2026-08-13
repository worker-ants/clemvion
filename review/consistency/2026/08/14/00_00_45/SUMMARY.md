# Consistency Check 통합 보고서

**BLOCK: YES** — `rationale_continuity` 가 [CRITICAL] 로 판정한 항목이 있어 하향 없이 그대로 반영합니다 (통합 규약 §3 하향 금지).

## 전체 위험도
**HIGH** — 이번 세션의 target(`spec/5-system/`, diff-base `origin/main`)에는 실제 diff 가 0건이다. "EIA §R8 캐시 키 스코프" 작업은 이미 다른 세션이 `origin/main` 에 병합 완료했고, 이 워크트리(`eia-r8-cache-scope-4ae434`)는 현재 무관한 브랜치(`claude/raw-query-audit-followups`, UPDATE RETURNING 튜플-shape 버그 수정)를 체크아웃 중이다. 5개 checker 중 3곳(`cross_spec`/`rationale_continuity`/`naming_collision`)이 독립적으로 이 사실을 확인했고, `rationale_continuity` 는 이를 CRITICAL 로 등급화했다 — "0 발견"을 spec 정합성의 보증으로 해석해서는 안 된다는 취지다. 별도로 이 워크트리에 실제로 존재하는 코드 diff(`update-returning-tuple-shape` 작업)에 대해서는 `plan_coherence` 가 실질 WARNING 2건을 발견했다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (+cross_spec INFO, naming_collision WARNING 이 같은 사실을 확인 — 최강 등급으로 통합) | Target diff 부재 — 검토 세션이 지목한 `spec/5-system/`(diff-base `origin/main`)에 실제 변경분이 0건. `git diff origin/main...HEAD --stat -- spec/` 무출력. 이 워크트리는 이미 다른 브랜치(`claude/raw-query-audit-followups`)로 재사용되어 있고, EIA §R8 캐시 스코프 작업은 별도 세션이 `origin/main` 에 이미 병합(#1154~#1158, #1160, #1162, #1166 등)했다. "발견 0"을 이번 target 의 정합성 보증으로 취급하면 거짓 음성이 된다 | `spec/5-system/**` 전체 (프롬프트가 지목한 diff-base `origin/main`), 워크트리 `eia-r8-cache-scope-4ae434` 자체 | `origin/main` 커밋 `72db62a7b`/`a80599700`/`8a2d13031`/`f59e2343d`/`ba3dbd676`/`0855000f2`/`1e9f3f238`/`9a4d3e32b` (이미 병합된 EIA §R8 변경) | (1) orchestrator/호출자는 이 워크트리·브랜치 라우팅을 재확인 — `eia-r8-cache-scope-4ae434` 라는 이름과 달리 현재 체크아웃은 EIA r8 작업과 무관. (2) 프로젝트 메모리 규약("델타 0 이면 PR 올리지 말고 폐기")에 따라 이 delta-0 세션은 그대로 진행하지 말고 폐기하거나 올바른 target 으로 재호출. (3) `plan/in-progress/spec-draft-eia-r8-alignment.md` (worktree: `eia-spec-r8-alignment-fff754`, 별개 워크트리 존재 확인됨)는 기술한 변경이 이미 `origin/main` 에 반영돼 있으므로 담당자가 실제 잔여 델타를 재산정한 뒤 `plan/complete/` 로 이동하거나 폐기 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 의 근본 원인은 spec 콘텐츠 결함이 아니라 **세션/워크트리 라우팅 불일치**(orchestrator 가 조립한 target·diff-base 가 이 워크트리의 실제 체크아웃 브랜치와 어긋남)다. spec 파일을 고쳐서 해소되는 문제가 아니므로 planner 인계 표에는 해당 없음 — 조치 주체는 이 consistency-check 를 호출한 orchestrator/main 세션이다. (없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `exec-intake-followups.md` 의 "admission 회귀 보강 완료(2026-07-04)" 항목이 이번 PR 이 고친 것과 **동일한 tuple-shape 버그**(`admitExecutionOrDefer` 조건부 UPDATE) 위에서 GREEN 이었다 — `origin/main:codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의 admission mock 이 `[{ id: 'eSQL' }]`(INSERT 형태) 로 세팅돼 있어 정확히 이 PR family 가 지적한 오형 mock 패턴. `ie-resume-turn-boundary-cancel.md`/`retry-turn-terminal-guard.md` 두 자매 plan 은 이미 소급 정정을 받았으나 `exec-intake-followups.md` 는 빠졌다 | `plan/in-progress/update-returning-tuple-shape.md` "## 소급 영향" 절(92~136행) | `plan/in-progress/exec-intake-followups.md:20-21` | `update-returning-tuple-shape.md` 의 소급 영향 조사를 `exec-intake-followups.md` 로 확장하고 20~21행에 동일한 소급 정정 배너 추가. 부수적으로 `plan/complete/exec-intake-queue-impl.md`·`plan/complete/orphan-pending-backstop.md` 도 같은 admission 경로 의존 여부 확인(우선순위 낮음) |
| 2 | plan_coherence | 신규 spec 위임 5건(특히 `spec/5-system/4-execution-engine.md` §1.1, `spec/conventions/node-cancellation.md` §2.4)이 이 PR family 가 확립한 단일 집결 티켓에 새 번호로 등재되지 않고 `update-returning-tuple-shape.md` 자신의 "후속" 절에 고립돼 있다. 5개 대상 문서 중 `node-cancellation.md` 만 `pending_plans:` 등재를 명시, 나머지 4개는 언급 없음 | `plan/in-progress/update-returning-tuple-shape.md:214-236` | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (SoT 위임 집결 티켓, `#7`/`#8`~`#11` 이미 보유) | 집결 티켓에 `#12`(가칭)로 5건 등재하거나 최소 포인터 한 줄 추가 — 안 하면 다음 planner 스윕에서 놓칠 위험 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | best-effort 로 이미 병합된 §R8 캐시 스코프 서술(캐시 키 패턴·닫힌 대상 목록·execution/route 축)을 `data-flow/15-external-interaction.md`·`4-execution-engine.md §9.2` 와 대조 — 세 문서 모두 정합. `execution-engine.md §9.2` 키 표에 `interaction:idempotency:*` 미등재는 `data-flow §15` L310 이 스스로 "별도 항목" 임을 명시한 알려진 경계라 실질 충돌 아님 | `spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md` §2.2, `spec/5-system/4-execution-engine.md` §9.2 | 조치 불요 |
| 2 | convention_compliance | 이 워크트리에 실제로 존재하는 코드 diff(신규 헬퍼 `updateReturningRows` + `execution-engine`/`knowledge-base`/`auth-oauth` 소비부)는 `spec/conventions/**` 가 규율하는 명명·출력 포맷(`node-output.md`)·API 문서·문서 구조 표면과 접점이 없고, 기존 `assertRowArray` 관용구를 그대로 재사용해 새 패턴을 도입하지 않았다 | `codebase/backend/src/common/utils/update-returning-rows.ts` 등 4파일 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target diff 0건(INFO) — 델타 0 확인. best-effort 로 이미 병합된 §R8 내용은 관련 spec 과 정합 |
| rationale_continuity | HIGH (개별 항목 [CRITICAL]) | Target diff 부재 — 워크트리가 무관한 브랜치를 체크아웃 중이라 Rationale 연속성 판정 표면 자체가 없음. "발견 0"을 보증으로 오독하지 말 것 |
| convention_compliance | NONE | spec/5-system diff 0건 확인. 워크트리에 실존하는 코드 diff는 직접 조회로 규약 위반 없음 확인 |
| plan_coherence | MEDIUM | 이 워크트리에 실존하는 diff(`update-returning-tuple-shape`) 기준 WARNING 2건 — 소급 정정 누락(`exec-intake-followups.md`), spec 위임 5건 미등재 |
| naming_collision | NONE (개별 항목 WARNING) | target diff 0건(델타 0, 프로세스 층위 WARNING). 워크트리 실존 diff 는 신규 식별자 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** orchestrator/호출자는 이 consistency-check 세션의 target·diff-base·워크트리 라우팅을 재확인한다. `eia-r8-cache-scope-4ae434` 워크트리는 현재 EIA r8 작업과 무관한 브랜치(`claude/raw-query-audit-followups`)를 체크아웃 중이며, "EIA §R8 캐시 키 스코프" 작업 자체는 이미 `origin/main` 에 병합 완료됐다(#1154~#1158, #1160, #1162, #1166). 프로젝트 메모리 규약("델타 0 이면 PR 올리지 말고 폐기")에 따라 이 세션을 그대로 밀어붙이지 말고 폐기하거나, 실제로 남은 작업이 있는 올바른 target 으로 재호출할 것.
2. `plan/in-progress/spec-draft-eia-r8-alignment.md` (별도 워크트리 `eia-spec-r8-alignment-fff754` 에 존재)가 기술하는 정정 내용이 `origin/main` 에 이미 반영됐는지 재확인 후, 잔여 델타가 없으면 `plan/complete/` 로 이동하거나 폐기.
3. `update-returning-tuple-shape.md` 의 소급 영향 조사를 `exec-intake-followups.md:20-21` 로 확장하고 동일한 소급 정정 배너 추가 (WARNING #1).
4. 신규 spec 위임 5건을 `spec-update-node-cancellation-shutdown-classification.md` 집결 티켓에 `#12`(가칭)로 등재 (WARNING #2).
