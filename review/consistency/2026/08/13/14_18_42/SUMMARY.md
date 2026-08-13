# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec 이 CRITICAL 1건을 보고했다 (EIA Outbound Notification / 종결 WS 이벤트 payload 가 spec §6.3–§6.5·§4.1 계약과 실제 구현에서 크게 다름). 근본 원인은 spec 문서 자체의 drift 이며 developer 권한 밖이라 **§planner 인계** 항목으로 등재했지만, 등급/차단은 하향하지 않는다.

## 전체 위험도
**HIGH** — 1건의 CRITICAL(EIA outbound notification payload drift, spec 권한 밖 → planner 인계) + WARNING 2건(그중 1건은 이미 plan 에 P2 로 추적 중이나 미완료) + INFO 다수. 이번 diff(`origin/main..HEAD`, `49ffd54a2`+`599212bd0`) 자체는 spec/5-system/ 를 전혀 건드리지 않는 코드/테스트 전용 변경이며, CRITICAL/WARNING 은 모두 diff 이전부터 target 영역(spec/5-system/)에 존재하던 기존 drift 다(cross_spec 이 target 전체를 스캔해 발견).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | EIA Outbound Notification / 종결 WS 이벤트(`execution.completed`/`failed`/`cancelled`) 의 실제 발송 payload 최상위 키가 `payload` 이고 그 안도 `{status}`/`{status,error}` 수준의 얇은 shape 뿐인데, spec 은 `result:{outputs,finalNodeId,finalPort}`/`error:{code,message,nodeId,details?}`/`durationMs`/`nodeCount`/`failedNodeId` 를 포함하는 훨씬 풍부한 계약으로 문서화 — 외부 고객이 spec 을 신뢰해 연동하면 문서화된 필드 전부 `undefined` 를 받는다 | `spec/5-system/14-external-interaction-api.md` §6.3(L634-652)·§6.4(L654-672)·§6.5(L675-679), `spec/5-system/6-websocket-protocol.md` §4.1 표(L176-179) | `notification-fanout.service.ts` L123-137, `notification-dispatcher.types.ts` L29·L44-48, `execution-engine.service.ts` 의 `EXECUTION_COMPLETED`/`EXECUTION_FAILED` emit 전체, `chat-channel.dispatcher.ts` L527-585(방어 코드 + drift 자인 주석) | `project-planner` 위임 — (a) spec §6.3–§6.5·WS §4.1 을 실제 얇은 shape 로 재문서화하거나 (b) fanout/webhook processor 에 enrich 단계를 추가해 문서화된 필드를 실제로 채우는 구현 plan 신규 등록(코드 주석이 가리키는 `spec-update-execution-failed-payload-shape` 는 저장소에 한 번도 존재한 적 없음 — 붕 뜬 약속) |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 등급 CRITICAL·`BLOCK: YES` 그대로 유지된다. 아래는 차단 해제 장치가 아니라 다음 행동 지정.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 근본 해법이 spec 문서 재정의(어느 쪽을 SoT 로 할지 정책 결정) 또는 신규 구현 plan 발주이며, `developer` 는 `spec/` write 권한이 없다(CLAUDE.md skill 표) | project-planner | `spec/5-system/14-external-interaction-api.md` §6.3–§6.5 (outbound notification body 스키마) + `spec/5-system/6-websocket-protocol.md` §4.1 표(`execution.completed`/`failed`/`cancelled` payload 열) — 실제 구현("얇은 signal + payload 필드 + REST 재조회") 기준으로 재작성하거나, 반대로 enrich 구현을 새 plan 으로 발주 | cross_spec.md Critical #1; `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` L536-545 주석(PR #324, `febff61e7`, 2026-05-25 도입, 약속된 후속 plan 미존재) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `retry-turn.service.ts` `failRetryExecution` 이 `EXECUTION_CANCELLED` emit 시 `cancelledBy` 를 채우지 않음 — 같은 모듈의 다른 4개 취소 경로는 `emitCancellationEvent` 로 통일된 `cancelledBy` 계약을 이미 구현 | `spec/5-system/6-websocket-protocol.md` §4.1 L179, `spec/5-system/14-external-interaction-api.md` §6.5 L677-678 | `retry-turn.service.ts` L917-966 vs `execution-engine.service.ts` `emitCancellationEvent`(L1071-1096) | `failRetryExecution` 도 `emitCancellationEvent` 재사용. **이미 `plan/in-progress/retry-turn-terminal-guard.md` L272-278·L329 에 P2 로 등재돼 있으나 체크박스 미완료** — 이번 세션 실측으로도 미해결 재확인. developer 권한 내(codebase 수정)이므로 별도 planner 인계 불필요, 해당 plan 항목 마저 집행할 것 |
| 2 | cross_spec | `6-websocket-protocol.md` §4.1 이 `execution.cancelled` payload 를 flat `{cancelledBy}` 로 문서화하지만 EIA §6.5·실제 코드(`execution-engine.service.ts` L1084-1085, `chat-channel/types.ts` L405)는 nested `result.cancelledBy` 사용 — `spec/5-system/` 내부 두 문서의 직접 모순, 코드는 EIA(nested) 쪽이 맞음 | `spec/5-system/6-websocket-protocol.md` §4.1 L179 | `spec/5-system/14-external-interaction-api.md` §6.5 L677 | Critical #1 정정 작업과 함께 `6-websocket-protocol.md` §4.1 을 nested shape 로 정정, 존재하지 않는 `duration` 필드는 제거하거나 "미구현" 주석 부착. spec 수정이라 사실상 위 planner 인계와 동일 후속 작업으로 묶어 처리 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | EIA 계열 Redis 키(`interaction:idempotency:*`)가 `4-execution-engine.md` §9 키 인벤토리에 미등재 — `data-flow/15-external-interaction.md` 가 이미 self-flag 한 기존 갭 | `spec/5-system/4-execution-engine.md` §9 | §9 에 EIA 계열 키 행 추가 또는 `conventions/redis-keys.md` 로의 명시적 pointer 추가 |
| 2 | convention_compliance | 신규 admission guard(`Array.isArray` 방어) 의 내부 `Error` 메시지 언어(한국어)/접두 스타일이 파일 내 기존 관례와 완전히 통일돼 있지 않음 — 다만 이를 규율하는 규약 문서가 없고 유사 선례도 이미 존재해 위반 아님 | `execution-engine.service.ts:2932-2934` | 조치 불요. 팀이 통일하고 싶다면 `spec/conventions/error-codes.md` 에 "내부 전용 진단 Error" 신설 절 고려 |
| 3 | rationale_continuity | admission 가드가 `49ffd54a2`(return false/defer)→`599212bd0`(throw/롤백)로 자기 교정 — 최종 상태는 `4-execution-engine.md` Rationale "TOCTOU 원자화" 와 정합. 결정 번복 아님(같은 PR 체인 내 자기 교정) | `execution-engine.service.ts` `admitExecutionOrDefer` (line ~2919-2932) | 조치 불요. 필요시 Rationale 문단에 "드라이버 반환 shape 이상 시에도 트랜잭션 롤백 필수" 한 줄 보강 고려(필수 아님) |
| 4 | rationale_continuity | `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환은 spec 미문서화 상수의 가시성만 확장, 값/정책 불변 — Rationale 충돌 없음 | `executions.service.ts` (line ~60) | 조치 불요 |
| 5 | rationale_continuity | `chat-channel.dispatcher.spec.ts` 는 순수 테스트 전용 diff, 대상 프로덕션 코드(`isSubFilterNull` 분기) 는 diff 이전부터 존재 | `chat-channel.dispatcher.spec.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | EIA outbound notification payload shape 가 spec §6.3–§6.5·WS §4.1 계약과 실제 구현에서 근본적으로 다름(CRITICAL) + retry-turn cancelledBy 누락·WS/EIA nested-flat 모순(WARNING 2) + Redis 키 인벤토리 self-flag 갭(INFO) |
| rationale_continuity | NONE | spec 미변경 diff. admission 가드 defer→throw 자기교정이 오히려 Rationale "TOCTOU 원자화" 를 강화. Rationale 충돌 없음 |
| convention_compliance | NONE | spec 미변경 diff. API/이벤트/에러코드 봉투 등 규약 표면 미접촉. INFO 1건(내부 Error 문자열 스타일)만 관찰, 규약 근거 없어 위반 아님 |
| plan_coherence | NONE | diff 가 손댄 3개 백로그 항목 모두 유예 근거 재검증 후 착수, target frontmatter 의 3개 in-progress plan 과 미해결 전제 충돌 없음. admission-throw→BullMQ dead-letter 전파도 기존 orphan pending backstop 이 흡수 |
| naming_collision | NONE | spec/5-system/ 신규 파일·식별자 없음. 유일한 가시성 변경(`SNAPSHOT_CACHE_MAX_ENTRIES` export)도 전수 grep 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** `project-planner` 턴으로 EIA outbound notification payload 계약을 정정 — spec 을 실제 얇은 shape 에 맞추거나, enrich 구현 plan 을 신규 등록. 동일 턴에서 `6-websocket-protocol.md` §4.1 의 `execution.completed`/`failed`/`cancelled` 행도 함께 동기화(WARNING #2 도 이 작업으로 함께 해소).
2. `developer` 턴에서 `retry-turn.service.ts` `failRetryExecution` 이 `emitCancellationEvent` 를 재사용하도록 정리 — `plan/in-progress/retry-turn-terminal-guard.md` P2 항목 마저 집행(WARNING #1, 권한 내 작업).
3. 여유가 있으면 `4-execution-engine.md` §9 에 EIA 계열 Redis 키 행 추가(INFO #1, 저위험 문서 동기화).
4. 이번 diff(`49ffd54a2`+`599212bd0`) 자체는 위 Critical/Warning 과 무관한 순수 코드/테스트 정비이며 그 자체로는 추가 조치 불요 — 병합 여부는 위 1번(planner 인계) 처리와 별개로 판단 가능.
---

## 이 라운드 처분 (main Claude)

**BLOCK: YES 를 우회하지 않는다.** 다만 이 CRITICAL 은 **이번 diff 가 만든 것이 아니다** —
diff(`49ffd54a2`+`599212bd0`)는 `spec/5-system/` 을 전혀 건드리지 않는 코드/테스트 전용이고,
checker 도 그렇게 적었다. `--impl-done` 이 target 영역 전체를 스캔하며 선재 drift 를 집었다.

**전제를 직접 실측했다** (checker 를 그대로 받지 않았다):

| 확인 | 결과 |
|---|---|
| 실제 발송 shape | `emitExecution(id, EXECUTION_COMPLETED, { status })` → fanout 이 `{type,executionId,triggerId,workflowId,seq,payload,timestamp}` 로 감쌈 |
| spec §6.3 약속 | `result:{outputs,finalNodeId,finalPort}` · `durationMs` |
| 그 후속 plan 존재 | `git log --all -S "spec-update-execution-failed-payload-shape" -- plan/` → **0건** |

셋 다 checker 주장대로였다. **외부 계약이 거짓인 상태**이고, 2026-05-25 에 기록된 "코드를 spec
에 맞춘다" 는 의도는 **plan 이 만들어진 적조차 없어** 3개월 방치됐다.

**그런데 이건 택일이 필요한 결정이다** — 코드를 spec 에 맞출지(구현 프로젝트), spec 을 실제에
맞출지(외부 계약 축소). 비용과 결과가 크게 다르고 제품 판단이 섞인다. `developer` 가 임의로
고를 자리가 아니라 **planner 결정**이므로, 항목을 `backend-lint-gate-broken-on-main.md` 에
양쪽 선택지·근거와 함께 등재하고 사용자에게 방향을 묻는다.

WARNING 1(`failRetryExecution` 의 `cancelledBy` 누락)은 developer 권한 내이고 이미
`retry-turn-terminal-guard.md` 에 P2 로 등재돼 있다 — 교차 참조만 남기고 그 plan 에서 집행한다.
이 PR 에 끌어오면 스코프가 다른 모듈로 번진다.
