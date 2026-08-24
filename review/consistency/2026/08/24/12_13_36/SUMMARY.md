# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견(문서 자기모순, 재현 가능한 필드 오접근). 근본 원인은 호출자(developer 세션) 권한 밖 spec drift 라 §planner 인계 경로로 처리한다.

## 전체 위험도
**HIGH** — `spec/conventions/chat-channel-adapter.md` §3 매핑표가 같은 파일 §1.3 JSDoc 및 SoT `15-chat-channel.md` CCH-MP-06 이 이번 diff 로 정정한 "wire `output` 래퍼/도메인값 구분"을 반영하지 못한 채 남아 문서가 자기모순 상태다. 코드에는 방어적 fallback 이 있어 즉시 런타임 파손은 없지만(convention_compliance/cross_spec/rationale_continuity 3개 checker 공통 확인), 이 표를 그대로 따르는 구현자는 `undefined` 필드 접근을 재현할 수 있다. 그 외 항목은 절차적 bookkeeping 갭(WARNING 1) 과 참고용 INFO 뿐이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance([CRITICAL]) — cross_spec·rationale_continuity 가 동일 결함을 [WARNING]으로 각각 지적(하향 금지 원칙에 따라 최고 등급 CRITICAL 로 통합) | `chat-channel-adapter.md` §3 "EIA / Internal Event → renderNode 매핑" 표의 `execution.node.completed`/`template` 서브케이스가 여전히 `` `output.rendered` `` 로 서술됨 — 이는 이 표가 SoT 로 직접 인용하는 CCH-MP-06 이 이미 정정된 상태와 어긋난다 | `spec/conventions/chat-channel-adapter.md:382` | 같은 파일 §1.3 `ChatChannelInternalEvent.output` JSDoc (`chat-channel-adapter.md:181-190`, 이번 diff 로 "래퍼 전체, 도메인 값은 `output.output`" 로 정정됨) + `spec/5-system/15-chat-channel.md` CCH-MP-06 (이번 diff 로 `output.output.rendered` 로 정정됨) | §3 표 `template` 셀을 `` `output.output.rendered` `` 로 정정 + §1.3 앵커 또는 "wire 래퍼 전체/도메인 값 한 겹 아래" 각주 병기. `git blame` 상 이 행은 2026-06-04 최초 작성 이후 이번 diff 에서 미변경(= 현재 세션이 쓴 문장이 아님) → 자기-반증형 소정정 조건1 불충족, project-planner 턴 필요(§planner 인계 참조) |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 등급 CRITICAL, `BLOCK: YES` 그대로 유지된다. 아래는 차단을 푸는 표가 아니라 다음 행동을 지정하는 표다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 대상 문장(`chat-channel-adapter.md:382`)은 2026-06-04 최초 작성 이후 이번 diff 에서 손대지 않음(`git blame` 확인) — 즉 **현재 세션(developer)이 쓴 문장이 아니라** CLAUDE.md 자기-반증형 소정정 조건1("developer 자신이 그 문서에 썼다")을 충족하지 못한다. 또한 §1/§3 은 어댑터 인터페이스-매핑 계약(API 계약 성격)이라 조건2(예고·트리거 한정, API 계약 제외)로도 배제된다 — `spec/conventions/` 정식 규약 수정은 project-planner 관할 | project-planner | `spec/conventions/chat-channel-adapter.md` §3 매핑표 `execution.node.completed`→`template` 셀을 `output.output.rendered` 로 정정(+ §1.3 각주/앵커 병기). §1.3 JSDoc 과 CCH-MP-06 은 이미 이번 diff 로 정정 완료된 상태라 이 표 셀이 마지막 남은 미러 | `plan/complete/node-output-envelope.md`(완료 확정 상태 — planner 재개 시 in-progress 환원 또는 소정정 후속 plan 신설 검토), 본 리포트 `review/consistency/2026/08/24/12_13_36/` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 자기-반증형 소정정 게이트(`--impl-done spec/conventions/`)의 실행 증거가 plan 체크리스트에 아직 인용되지 않음 — 본 라운드(`12_13_36`) 자체가 그 게이트 실행이지만, `plan/complete/node-output-envelope.md` 는 이 라운드 시작 전 이미 `complete/` 로 확정·커밋되어 체크리스트에 소급 인용이 없다 | `plan/complete/node-output-envelope.md` `## 작업` 체크리스트 | `spec/conventions/conversation-thread.md` §8.4 자기-반증형 소정정(커밋 `e6a017a18`) + CLAUDE.md 게이트 요건(조건5) | 위 CRITICAL 이 planner 턴으로 해소된 뒤, 체크리스트에 `12_13_36 (--impl-done spec/conventions/, BLOCK: YES → planner 인계)` + 후속 planner 정정 라운드 ID 를 함께 소급 기록. 선례: `plan/complete/sse-nodeoutput-allowlist.md` 의 `00_26_17` 인용 패턴 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 동일 "래퍼/도메인값 미반영" 패턴이 scope 밖(spec/conventions/ 아님) provider spec 3곳에도 존재 가능성 — 이번 게이트(`scope=spec/conventions/`) 판정 대상 아님, 함수 시그니처 확인 없이는 단정 불가 | `spec/4-nodes/7-trigger/providers/telegram.md:160`, `slack.md:233`, `discord.md:256` | 후속 `--impl-done spec/4-nodes/7-trigger/providers/` 라운드에서 래퍼/도메인 구분 정합성 확인 권고(강제 아님) |
| 2 | naming_collision | 신규 헬퍼 `narrowTopLevelNodeOutput` 및 유니온 파라미터 `'nodeOutput' \| 'output'` — 저장소 전체 검색 결과 기존 식별자와 충돌 없음 | `codebase/backend/src/modules/websocket/websocket.service.ts:182` | 조치 불요 |
| 3 | rationale_continuity | EIA §R17 "envelope.output" deny-list → fail-closed allowlist 재정정이 이전 유예 근거 보존·실측 근거·잔존 위험 고지·캐너리 갱신을 모두 갖춘 모범 사례 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요(참고용 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §3 표 잔존 `output.rendered` 미러 누락([WARNING], 통합 단계에서 CRITICAL 로 상향) |
| rationale_continuity | LOW | 동일 미러 누락([WARNING], 통합 단계에서 CRITICAL 로 상향) — 그 외 EIA §R17 재정정은 rationale 연속성 모범 사례 |
| convention_compliance | HIGH | 동일 결함을 [CRITICAL] 로 판정(문서 자기모순, 재현 가능한 `undefined` 필드 접근) — 본 통합에서 최종 채택 등급 |
| plan_coherence | LOW | 게이트 실행 증거 소급 기록 누락(절차적 WARNING), 실질 충돌·후속 누락 없음 |
| naming_collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) `spec/conventions/chat-channel-adapter.md:382` §3 표 `template` 셀을 `output.output.rendered` 로 정정 — **project-planner 턴에서 처리** (현재 developer 세션은 자기-반증형 소정정 조건1 불충족으로 직접 수정할 권한이 없음). 정정 후 `--impl-done spec/conventions/` 재실행으로 BLOCK 해소 확인.
2. planner 정정 완료 후 `plan/complete/node-output-envelope.md` `## 작업` 체크리스트에 본 라운드(`12_13_36`)와 후속 planner 라운드 ID 를 함께 소급 기록.
3. (비차단, 선택) `spec/4-nodes/7-trigger/providers/{telegram,slack,discord}.md` 의 `output.rendered` 표현이 래퍼/도메인 구분과 정합하는지 후속 스윕에서 확인.
