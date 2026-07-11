# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 2건 (닫힌 enum 위반, 기각된 아키텍처 원칙 재도입)이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — `cancelledBy='channel_idle_timeout'` 이 EIA/WS-protocol/chat-channel-adapter 4개 문서에 박제된 닫힌 3값 union 을 깨고, B-2 backstop 메커니즘이 execution-engine 이 두 차례 명시적으로 기각한 "신규 주기 스캐너" 대안을 논증 없이 재도입한다. 둘 다 spec 편집(`## 변경안`) 전에 반드시 정정 필요.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, naming_collision (수렴) | `cancelledBy='channel_idle_timeout'` — 닫힌 3값 union(`"user"\|"system"\|"timeout"`)을 조율 없이 4번째 값으로 확장 | `plan/in-progress/spec-decide-webchat-execution-residuals.md` §(B) B-2 "회수 동작" (~L116, ~L128), §변경안 (2) (~L192) | `spec/5-system/14-external-interaction-api.md §6.5`, `spec/5-system/6-websocket-protocol.md §4.1`, `spec/conventions/chat-channel-adapter.md` L133/L342, `spec/5-system/3-error-handling.md`, backend TS 리터럴 union(`chat-channel/types.ts:405`) — 5개 spec/코드 지점이 닫힌 3값을 SoT 로 선언. 동일 spec §8 큐 대기 초과 선례는 `cancelledBy='timeout'` 재사용 + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` 신설로 이 패턴을 이미 확립함 | `cancelledBy` 는 기존 값(`'timeout'` — idle-wait 도 timeout 이라 §8 선례와 대칭) 재사용 + 신규 `error.code='CHANNEL_IDLE_TIMEOUT'`(UPPER_SNAKE_CASE)로 세분화하도록 B-2 정책 문구 수정. 채택 시 `변경안 (2)`·`spec_impact` 에 EIA §6.5/WS-protocol §4.1/`error-handling.md` 동반 갱신 등재 |
| 2 | rationale_continuity | B-2 backstop 이 execution-engine 이 **두 차례** (§7.1/§7.2 크래시 복구, §7.4 orphan-pending 회수) 명시적으로 기각한 "신규 주기 scheduled job(cron/BullMQ repeatable)" 대안을 근거 대조 없이 재도입 | `plan/in-progress/spec-decide-webchat-execution-residuals.md` §(B) B-2 "메커니즘(참고, developer 결정)" (~L108-110), "구현 위임 메모" 2번 (~L219) | `spec/5-system/4-execution-engine.md` Rationale — "recovery loop 주기적 스캔 추가" 기각 (L1352: "운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖"), "신규 주기 스캐너 미도입" 원칙 (L1597: "§7.1/§7.4 가 반복 확정한" 엔진 전역 아키텍처 원칙) | (택2 채택) **의도적 예외 명시**: park 상태엔 애초에 BullMQ job 이 없어(§7.4 L834) §7.1 의 "heartbeat→stalled-job 일원화" 전제가 성립하지 않는다는 구조적 차이를 R-B2 에 근거로 남기고, `4-execution-engine.md` Rationale 원칙 항목 자체에도 "job 부재 park 상태의 client-abandonment 회수는 예외"를 함께 갱신 (재대조 시 재충돌 방지) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | R-B2 근거가 auth-session §3.1 의 "미구현(Planned)" 401 낙관적 refresh 분기를 기정사실처럼 인용 | §(B) B-2 "판정 신호 = 토큰 영구 만료" 둘째 불릿 (~L123-125) | `spec/7-channel-web-chat/3-auth-session.md §3.1` 상단 배너 — "…`401→낙관적 refresh 1회` 는 여전히 미구현(Planned)" | 논거를 §3 시퀀스 7(이미 구현된 진행 중 세션 proactive refresh) + JWT exp 하드 사실로 한정하고, reload-401 인용엔 "(현재 Planned)" caveat 추가 |
| 2 | rationale_continuity | §7.4 무기한 보존 invariant 의 "**워크플로우 정의** timeout" carve-out 을 "**채널 정의** timeout"으로 조용히 확장하면서 "불변식 본문은 무변경(이미 허용됨)"이라고 소급 서술 | §"불변식과의 관계" 항목1, §변경안 (3) | `spec/5-system/4-execution-engine.md:930` — carve-out 원문은 "노드별 `formConfig.timeout` 등 워크플로우 정의된 별도 timeout"으로 스코프 한정 | §7.4 원문을 "워크플로우 정의 timeout 뿐 아니라 채널이 판정하는 provably un-continuable 상태(§B-2)도 포함"으로 소폭 확장하고, R-B2 에 "이는 신규 확장 결정"이라 명시 |
| 3 | convention_compliance | plan 파일명이 `spec-draft-<name>.md` 명명 규약과 다른 `spec-decide-` prefix 사용 | 파일 경로 | `.claude/skills/project-planner/SKILL.md` — 기존 39개 파일 전부 `spec-draft-*` | `spec-draft-webchat-execution-residuals.md` 로 리네임 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | cross_spec | 신규 요구사항 ID(`EIA-RL-07` 등) 미확정 — 현재 미사용(충돌 없음), lock 만 필요 | spec 편집 시 ID 확정 |
| 2 | plan_coherence | 크로스링크 앵커 오류: `EIA-AU-05` 링크가 `#93-인증`(=§9.3 트랜잭션/발송순서)을 가리킴, 올바른 앵커 `#33-인증` | target·spec 편집 양쪽 정정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `cancelledBy` 닫힌 union 위반(CRITICAL) + auth-session Planned 배너 오인용(WARNING) + 요구사항 ID 미확정(INFO) |
| rationale_continuity | HIGH | B-2 가 기각된 "신규 주기 스캐너" 원칙 재도입(CRITICAL) + §7.4 carve-out 소급 서술(WARNING). 그 외 연속성 양호 |
| convention_compliance | HIGH | `cancelledBy` 닫힌 enum 규약 위반(CRITICAL, 수렴) + `spec-decide-` 파일명 이탈(WARNING) |
| plan_coherence | LOW | 40개 in-progress plan 전수 대조 — 우회·미해소·누락 없음. 앵커 오탈자(INFO) 1건만 |
| naming_collision | HIGH | `cancelledBy='channel_idle_timeout'` 닫힌 union 충돌(CRITICAL, 수렴). 그 외 식별자(R9/EIA-RL-06/EIA-AU-05/V060/TOKEN_EXPIRED/§5.4 cancel)는 충돌 없음. **journal.jsonl 복구** (disk-write gap 으로 파일 미기록됨) |

## 권장 조치사항

1. **(BLOCK 해소)** `cancelledBy='channel_idle_timeout'` 철회 → `cancelledBy='timeout'` 재사용 + `error.code='CHANNEL_IDLE_TIMEOUT'` 신설. EIA §6.5 / WS-protocol §4.1 / `error-handling.md` 동반 갱신을 `변경안`·`spec_impact` 에 등재.
2. **(BLOCK 해소)** B-2 backstop 의 주기 scheduled job 을 boot-only 원칙과의 **구조적 예외**(park=job 부재 → stalled 본령 전제 불성립 + tab-abandonment steady-state 누적)로 R-B2 및 engine Rationale 양쪽에 명문화.
3. (WARNING) R-B2 의 auth-session §3.1 Planned 인용 caveat / 논거 범위 축소.
4. (WARNING) §7.4 carve-out 확장을 "신규 확장 결정"으로 서술 + 원문 소폭 확장.
5. (WARNING) plan 파일명 `spec-draft-*` 리네임.
6. (INFO) `#93-인증` → `#33-인증` 정정, 신규 요구사항 ID lock.

> naming_collision 결과는 workflow disk-write gap 으로 파일 미기록 → main 이 journal.jsonl 에서 복구해 본 보고서에 반영함(커버리지 확보).
