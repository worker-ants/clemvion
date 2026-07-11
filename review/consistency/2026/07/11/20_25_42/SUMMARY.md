# Consistency Check 통합 보고서 (--impl-done EIA §14, PR-2 reaper)

> journal 복구: rationale_continuity(clean)·plan_coherence(INFO: plan 이미 complete/ 이동)·naming_collision(WARNING: Webchat vs 코드베이스 WebChat casing) — **3개 모두 Critical 0**. 아래 "3개 checker 미확인" 서술은 journal 복구로 해소, 실제 BLOCK: NO 확정.

**BLOCK: NO** — 확인된 checker(cross_spec, convention_compliance) 중 Critical 발견 없음. 단, 아래 **프로세스 이상**으로 3/5 checker 결과가 미확인 상태이므로 이 SUMMARY 를 "완전 통과"로 간주하지 말 것 (권장 조치사항 참고).

## ⚠ 프로세스 이상 — 3개 checker output 파일 디스크 미기록 (재시도 필요)

`rationale_continuity`, `plan_coherence`, `naming_collision` 3개 checker 는 호출자 results 매니페스트에 `status=success` 로 보고되었으나, 세션 디렉터리(`review/consistency/2026/07/11/20_25_42/`)에 해당 output 파일(`rationale_continuity.md`, `plan_coherence.md`, `naming_collision.md`)이 **존재하지 않는다** (실제 파일: `cross_spec.md`, `convention_compliance.md` 만 존재; `_prompts/` 안에는 5개 prompt 파일 모두 있음 — sub-agent 는 호출됐으나 output write 가 디스크에 반영되지 않은 것으로 보인다). 이는 알려진 "Workflow disk-write 갭" 패턴과 일치한다 — `status=success` 라도 output 파일 부재 시 실제 발견사항(특히 Critical)이 조용히 누락될 수 있다. journal.jsonl 등 복구 가능한 로그가 세션 디렉터리·worktree 어디에도 없어 본 에이전트는 이 3개 checker 의 실제 발견 내용을 복원할 수 없었다.

→ **이 3개 checker(특히 naming_collision — Critical 가능성이 가장 높은 카테고리)를 재실행하여 output 파일이 디스크에 실제로 기록됐는지 확인 후 본 SUMMARY 를 갱신할 것.** 현재 `BLOCK: NO` 는 확인 가능했던 2개 checker 기준이며, 미확인 3개 checker 의 결과를 대체하지 않는다.

## 전체 위험도
**LOW** (확인된 범위 한정) — cross_spec·convention_compliance 모두 Critical 없음, 동일한 WARNING 1건(문서 표 동기화 누락)에 수렴 + 사소한 INFO 3건. **단, 커버리지 40%(2/5 checker) 로 전체 위험도를 대표하지 않음 — 위 프로세스 이상 항목 우선 해소 필요.**

## Critical 위배 (BLOCK 사유)

없음 (확인된 2개 checker 기준). 미확인 3개 checker(`rationale_continuity`, `plan_coherence`, `naming_collision`) 는 재시도 전까지 Critical 유무 불명.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance (중복 수렴) | 신규 BullMQ 큐 `webchat-idle-reaper` 가 `system-status-api.md §1` 모니터링 큐 레지스트리 표에 미등재 — PROJECT.md "신규 BullMQ 큐 추가" 매핑의 필수 갱신 위치(c) 누락. 코드(`MONITORED_QUEUES`)·e2e(`EXPECTED_QUEUE_NAMES`)·`data-flow/0-overview.md §4` 카탈로그(SoT)는 모두 정확히 동기화됐으나 이 요약 표만 뒤처짐. 해당 문서는 이미 반대 방향 drift(`agent-memory-extraction`)를 "⚠ 구현 갭" 주석으로 자체 추적 중이라 같은 성격의 누락이 재발한 것 | `spec/5-system/16-system-status-api.md §1` 대상 큐 레지스트리 표 | `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07/§R19 (구현 완료로 flip) + `system-status.constants.ts`(`MONITORED_QUEUES`) + `system-status.e2e-spec.ts`(`EXPECTED_QUEUE_NAMES`) | `spec/5-system/16-system-status-api.md §1` 표에 `webchat-idle-reaper \| system \| 1 (기본) \| repeatable cron (1분) — … ([EIA §3.4 EIA-RL-07/§R19])` row 를 `terminal-revoke-reconcile` row 와 동일 패턴으로 추가, 또는 기존 `agent-memory-extraction` gap 과 동일하게 "⚠ 구현 갭" 주석 병기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `1-data-model.md §2.13 Execution.error` 엔진 레벨 error.code 예시 열거에 `WEBCHAT_IDLE_TIMEOUT` 미포함 (기존 패턴의 연장, 카탈로그 SoT `3-error-handling.md §1` 에는 이미 정확히 등재됨) | `spec/1-data-model.md §2.13` | 우선순위 낮음 — 이후 §2.13 정리 시 `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT` 함께 추가하거나 "예시일 뿐, SoT 는 §3-error-handling §1" 로 문구 명확화 |
| 2 | cross_spec | `1-data-model.md §2.14 NodeExecution.status` 의 `cancelled` 정의가 AbortError 경로로만 좁게 기술되어 park(WAITING) 상태 direct UPDATE 취소 경로(`markWebchatIdleTimeout` 등)와 표면상 불일치해 보임 (신규 결함 아님, 기존 `cancelParkedExecution`/`markQueueWaitTimeout` 선례의 합성) | `spec/1-data-model.md §2.14` | 우선순위 낮음 — `cancelled` 설명에 "park(WAITING) 상태 direct 취소 UPDATE(사용자 취소·큐 대기 타임아웃·EIA-RL-07 idle-wait 등)" 케이스 병기 권장 |
| 3 | convention_compliance | EIA-RL-07 요구사항 행이 grace window env var 이름(`WEBCHAT_IDLE_REAP_GRACE_MS`)·기본값(3600000ms/1h)을 명시하지 않음 — 문서 내 다른 env-configurable 타임아웃(§8.3, §7.4 등)은 모두 변수명·기본값을 인라인 노출하는 관례 | `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 행 (line 145) | EIA-RL-07 행 또는 §R19 본문에 `WEBCHAT_IDLE_REAP_GRACE_MS`(기본 3600000ms/1h) 1회 명시 |
| 4 | convention_compliance | §10 구현 파일 구조 트리에 신규 파일(`webchat-idle-reaper.service.ts`/`.types.ts`) 미반영 — 형제 기능(`terminal-revoke-reconciler.*`)은 트리에 나열됨 | `spec/5-system/14-external-interaction-api.md` §10 (line 839-876) | `terminal-revoke-reconciler.*` 바로 아래에 `webchat-idle-reaper.service.ts`/`.types.ts` 2줄 + 설명 주석 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | target spec 은 잘 정합됨. 유일 실질 gap = `system-status-api.md §1` 큐 표 미갱신(WARNING). 나머지 2건은 기존 패턴 연장 INFO |
| convention_compliance | LOW | 에러코드 명명·닫힌 union·frontmatter·3섹션 구조·Rationale 기각대안 서술 모두 모범 준수. PROJECT.md 매핑 표의 필수 갱신 위치 1곳(system-status-api.md §1) 누락(WARNING) + 사소한 INFO 2건 |
| rationale_continuity | **재시도 필요** — status=success 보고됐으나 output 파일(`rationale_continuity.md`)이 디스크에 없음. 발견사항 미확인 | - |
| plan_coherence | **재시도 필요** — status=success 보고됐으나 output 파일(`plan_coherence.md`)이 디스크에 없음. 발견사항 미확인 | - |
| naming_collision | **재시도 필요** — status=success 보고됐으나 output 파일(`naming_collision.md`)이 디스크에 없음. 발견사항 미확인 | - |

## 권장 조치사항
1. **(최우선) `rationale_continuity`/`plan_coherence`/`naming_collision` 재실행** — output 파일이 세션 디렉터리에 실제로 write 되는지 확인 후 본 SUMMARY 갱신. 재시도 전까지 이 3개 영역의 Critical 유무는 불명이며, 이 SUMMARY 의 `BLOCK: NO` 는 확인된 2개 checker(cross_spec, convention_compliance) 기준일 뿐임.
2. `spec/5-system/16-system-status-api.md §1` 대상 큐 레지스트리 표에 `webchat-idle-reaper` row 추가 (cross_spec·convention_compliance 두 checker 가 독립적으로 수렴한 동일 WARNING).
3. (선택, 낮은 우선순위) `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 행에 `WEBCHAT_IDLE_REAP_GRACE_MS` 기본값 명시 + §10 파일 구조 트리에 신규 파일 2종 추가.
4. (선택, 낮은 우선순위) `spec/1-data-model.md §2.13`/`§2.14` 의 인라인 예시 열거·`cancelled` 정의 문구를 이번 PR 이 아닌 별도 정리 작업에서 보완.