# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance,
plan_coherence, naming_collision) 전원 성공(전문 확보), CRITICAL 발견 0건.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 다만 `convention_compliance` 가 지적한 WS §4.1 이벤트 표의
Markdown 렌더 손상(표 이하 이벤트 카탈로그 전체 고아 행화)과, "wrapper vs 도메인 값" 불변식이
단일 SoT 없이 5개 문서에 중복 산문으로 흩어져 이번 세션에서만 4라운드 연쇄 정정을 유발한
구조적 문제는 재발 방지 관점에서 실질적 가치가 있어 MEDIUM 으로 판정.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `execution.node.failed` 행에 신규 설명(경고 문구+blockquote)을 표 셀 안에 닫는 `\|` 없이 삽입 — GFM 표가 그 지점에서 종료되어 이후 전 이벤트 카탈로그(`node.skipped`/`node.cancelled`/`waiting_for_input`/`ai_message`/`tool_call_*`/`message`/`user_message`)가 고아 행으로 렌더 손상 | `spec/5-system/6-websocket-protocol.md` L187–L193 §4.1 | 표는 표로 렌더된다는 문서 구조 invariant, CLAUDE.md 단일 진실 원칙이 전제하는 참조 가능성 | 신규 설명을 한 줄로 압축해 셀 안에 남기거나, 표 밖 각주(`#### 4.1-a`)로 분리 |
| 2 | convention_compliance | `NodeHandlerOutput` 래퍼 vs 도메인 값(`output.output`) 구분이 단일 SoT 없이 5개 문서(`chat-channel-adapter.md` §1.3/§3, `conversation-thread.md` §9.7, `6-websocket-protocol.md` §4.1, `15-chat-channel.md` CCH-MP-06)에 각기 다른 산문으로 중복 서술 | 위 5개 문서 각 해당 절 | `spec/conventions/node-output.md` Principle 0(정본이어야 할 5-필드 wrapper 정의) — 어느 사본도 이를 SoT 로 명시 인용 안 함. 같은 결함이 `10_44_28`→`12_02_30`→`12_13_36`→`12_24_55` 4라운드에 걸쳐 개별 정정됨(커밋 `feb1967a2`/`40ff94307`/`20ec30308`/`dc7debba6`) | `node-output.md` Principle 0 에 "wire envelope 적재 시 `envelope.output.output` 한 겹 더 아래" 문장을 정본 1회 추가, 나머지 4곳은 앵커 링크로 대체 |
| 3 | cross_spec | EIA §14 "재정정 (2026-08-24)" 블록이 `execution.node.completed`/`.failed` 의 외부 수신 채널로 "SSE/webhook/chat-channel" 을 열거 — 그러나 `notification-fanout.service.ts` `FANOUT_EVENTS` 는 이 두 이벤트를 애초에 webhook enqueue 대상에서 원천 배제(5종 whitelist 에 미포함) | `spec/5-system/14-external-interaction-api.md` §R17 "재정정 (2026-08-24)" 블록 | 같은 파일 기존 §R10(`:1311`, "화이트리스트 5종 변경 없음, 외부 SDK 미노출") 및 §6 채널별 봉투 표(`:600-610`, webhook 은 §6 전용 별도 표면) | "webhook" 을 문장에서 제거하고 "SSE/chat-channel" 로 좁히거나, "webhook(§6.1 5종)은 애초에 이 필드를 받지 않아 영향 밖" 명시. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 항목 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `chat-channel-adapter.md` §1.3 JSDoc 이 `output` 필드 전체에 `payload→output→config→flat` 단일 우선순위를 일반화했지만, 실제로는 노드 종류별로 다름(`template`=`extractRendered` 는 `flat→payload.rendered→output.rendered`, `carousel/table/chart`=`extractVisualPayload` 만 그 순서) | `spec/conventions/chat-channel-adapter.md` §1.3 vs §3 표 | §1.3 을 노드 종류별로 세분화하거나 §3 표로 위임 |
| 2 | convention_compliance | `output.output.*` wire 표기가 `node-output.md` Principle 8.1 의 명시 금지 패턴(`output.output.extracted.*`)과 문자열이 동일 — 실제로는 레이어가 다른 교차 계층 표기(핸들러 반환값 내부 이중래핑 vs envelope 필드명 우연 중복)라 규약 위반은 아니나 향후 오인 위험 | `chat-channel-adapter.md:382`, `6-websocket-protocol.md:187/190` vs `node-output.md` Principle 8.1 | Principle 8.1 옆에 "wire envelope 교차 계층 표기는 본 금지 대상 아님" 각주 추가 |
| 3 | plan_coherence | `conversation-thread.md` §1.1.1(line 47)이 `output.error`(1단) 표기를 그대로 사용 — §9.7 이 이미 2단(`output.output.error`)으로 정정한 것과 나란히 두면 5번째 stale 미러일 가능성(3회 반복 패턴: `40ff94307`/`feb1967a2`/`dc7debba6`). 도메인 개념 지칭인지 wire shape 주장인지 문면상 불확정이라 CRITICAL 로 확정하지 않음 | `spec/conventions/conversation-thread.md:47` | 다음 라운드 cross_spec 에서 정밀 소스-앵커 대조로 재확인 |
| 4 | plan_coherence | `plan/complete/node-output-envelope.md` `spec_impact` 에서 `conversation-thread.md` 가 두 카테고리(planner-턴/자기-반증형 소정정) 근거로 동시 언급되지만 리스트 항목은 1회만 등재 — Gate C 위반은 아니나 가독성상 개선 여지 | `plan/complete/node-output-envelope.md` spec_impact | 두 근거가 섞인 경우 파일명을 두 번 나열 + 각 항목 옆 근거 주석 (스타일 제안, 비차단) |
| 5 | naming_collision | `turnDebug` 동명이의 충돌(top-level AI turn1 emit vs `nodeOutput.meta.turnDebug`)은 이번 PR 범위 밖 — 별건으로 이미 CRITICAL 등재·추적 중, 이번 diff 가 악화시키지 않음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (별도 worktree) | 조치 불요, 혼동 방지용 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | EIA §14 재정정 블록의 webhook 오열거(WARNING) + JSDoc 우선순위 서술 불일치(INFO) |
| rationale_continuity | NONE | 두 편집 모두 상위 spec(WS §4.1, EIA §R17)에서 이미 실측·기록된 정정의 미러링. 기존 Rationale(R-CCA-N 등) 번복 없음 |
| convention_compliance | MEDIUM | WS §4.1 표 Markdown 렌더 손상(WARNING) + wrapper/도메인 구분 서술 5곳 중복(WARNING, 4라운드 연쇄 정정의 근본 원인) + `output.output.*` 문자열 혼동 소지(INFO) |
| plan_coherence | NONE | `spec_impact` 선언·자기-반증형 소정정 5조건·정본 트래커와 정확히 부합. §1.1.1 5번째 미러 가능성만 INFO |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API·이벤트명·ENV 신설 없음. 유일 신규 식별자(`narrowTopLevelNodeOutput`)는 비-export 내부 함수로 충돌 없음 |

## 권장 조치사항

1. **WS §4.1 표 문법 복구** — `execution.node.failed` 행의 신규 문단/blockquote 를 셀 밖 각주로 이동해 표 이하 이벤트 카탈로그 렌더 손상을 해소 (WARNING #1, 파급 범위 큼 — 이 문서가 여러 spec 에서 "SoT: WS §4.1" 로 반복 인용됨)
2. **wrapper/도메인 구분 서술 단일화** — `node-output.md` Principle 0 에 정본 문장 1회 추가, `chat-channel-adapter.md`/`conversation-thread.md`/`6-websocket-protocol.md`/`15-chat-channel.md` 4곳은 링크로 대체해 향후 라운드 재발(4회째) 방지 (WARNING #2)
3. **EIA §14 재정정 블록의 "webhook" 열거 정정** — `notification-fanout.service.ts` `FANOUT_EVENTS` 실측과 불일치, "SSE/chat-channel" 로 좁히거나 명시적 영향-밖 캐비엇으로 교체 (WARNING #3)
4. (선택) `chat-channel-adapter.md` §1.3 JSDoc 우선순위 서술을 노드 종류별로 세분화 (INFO #1)
5. (선택) `node-output.md` Principle 8.1 옆 wire 교차 계층 각주 추가 (INFO #2)
6. (다음 라운드) `conversation-thread.md:47` §1.1.1 이 5번째 stale 미러인지 cross_spec 정밀 대조로 확정 (INFO #3)