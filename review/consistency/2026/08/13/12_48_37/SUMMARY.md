# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. WARNING 3건 · INFO 2건.

## 전체 위험도
**LOW** — diff 는 §9.8→§4.4 SoT 재배치 + docstring 정정(2줄)뿐이지만, 그 재배치 자체가 만든 "SoT 이관 후 자매 참조 누락" 패턴이 spec/4-nodes/7-trigger/providers/ 3개 문서와 plan 라인 인용 2건에서 재발했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | chat-channel dedup SoT 를 `data-flow/14 §2.2` 로 이관했는데, `spec/4-nodes/7-trigger/providers/{discord,slack,telegram}.md` 3곳은 여전히 옛 메커니즘 리터럴(`SET NX EX 30`, 키 포맷)을 인라인한 채 "SoT: chat-channel CCH-SE-02" 로 못박고 있어 포인터가 한 칸 어긋남. 값 자체는 현재 일치해 즉시 기능 영향 없음 | `spec/4-nodes/7-trigger/providers/discord.md:324`, `slack.md:301`, `telegram.md:235` | `spec/5-system/15-chat-channel.md` CCH-SE-02 / `spec/data-flow/14-chat-channel.md#22-redis` (실제 SoT) | 세 문서를 "요구사항: CCH-SE-02 / 상세 SoT: data-flow/14 §2.2" 로 분리 — 이번 diff 가 `2-navigation/4-integration.md:1294` 에 이미 적용한 것과 동일 패턴. project-planner 소관 |
| 2 | convention_compliance | 컨텍스트 예산 초과로 target scope 자체 파일 24개 + 핵심 conventions 8개(`node-output.md`, `chat-channel-adapter.md`, `error-codes.md`, `swagger.md` 등)가 프롬프트에서 절단됨. 판정 위험 최고 4건만 CWD 직접 Read 로 보완 확인, 나머지(`6-presentation/*`, 일부 `4-integration/*`)는 전수 대조 못함 | `## Target 문서` 번들 전체 (프롬프트 조립 단계) | — (검토 프로세스 완전성 문제, target 문서 결함 아님) | 다음 회차에 `spec/4-nodes/` 를 하위영역별로 분할 재실행하거나 `related_specs` 예산 확대. orchestrator 소관 |
| 3 | plan_coherence | §4.4 신설(+17줄 순증)로 `spec/4-nodes/4-integration/4-cafe24.md` 이후 절이 전부 밀렸는데, `plan/in-progress/node-output-redesign/cafe24.md` 의 미해결 `[ ]` TODO 2건(L213, L216)이 여전히 옛 라인 번호(254, 348)를 인용해 스테일해짐 | `spec/4-nodes/4-integration/4-cafe24.md` §4.4 삽입 지점 | `plan/in-progress/node-output-redesign/cafe24.md:213,216` (및 완료 항목 L167, L178) | `4-cafe24.md:254`→`271`, `:348`→§6(353) 기준 재확인, `:322-334`→`339-351` 로 정정. developer 트랙, 급하지 않음(주기적 라인 재검증 관행 있음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/data-flow/5-integration.md:156` 의 "상세: Cafe24 노드 §9.8" 참조가 §4.4 신설을 반영 안 함. 직전 코드 리뷰(`12_37_46`)에서 이미 포착돼 명시적으로 유예된 항목 | `spec/data-flow/5-integration.md:156` | 우선순위 낮음, 별도 조치 불요. 후속 정리 시 "§4.4(키)·§9.8(알고리즘)" 로 분리 권장 |
| 2 | convention_compliance | Cafe24 4xx 에러 코드(`CAFE24_404`/`CAFE24_422`/`CAFE24_4XX`/`CAFE24_5XX`)가 raw HTTP status 를 이름에 노출 — `error-codes.md` §1 "의미 기반 명명" 과 애매하게 걸치나, 기존부터 있던 pass-through 패턴이라 이번 diff 신규 위반 아님 | `spec/4-nodes/4-integration/4-cafe24.md` §6 | target 수정 불요. `error-codes.md` §1/§3 에 "raw status 기반 pass-through 코드는 별도 허용 범주" 한 줄 명시 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | chat-channel dedup SoT 이관 시 provider 문서 3곳 자매 참조 누락 (WARNING) + data-flow/5-integration.md 유예 항목 잔존 (INFO) |
| rationale_continuity | NONE | webhook docstring 정정은 기존 spec Rationale(R-CC-19 등 "fixed-window")과 완전히 정합. 위반 없음 |
| convention_compliance | LOW | 프롬프트 절단으로 전수 대조 미완(WARNING, 프로세스 문제) + Cafe24 에러코드 명명 애매지대(INFO, 기존 패턴) |
| plan_coherence | LOW | §4.4 삽입으로 인한 spec 라인 이동이 별개 in-progress plan 의 TODO 라인 인용 2건을 스테일하게 만듦 (WARNING). 주 추적 plan(`backend-lint-gate-broken-on-main.md`)은 diff 와 정확히 일치 |
| naming_collision | NONE | 신규 식별자 없음 — 전부 기존 Redis 키/요구사항 ID 의 SoT 재배치 |

## 권장 조치사항
1. (WARNING #1, project-planner) `spec/4-nodes/7-trigger/providers/{discord,slack,telegram}.md` 의 "SoT: chat-channel CCH-SE-02" 를 "요구사항: CCH-SE-02 / 상세 SoT: data-flow/14 §2.2" 형태로 분리 — 동일 SoT-이관 패턴이 이 PR 안에서만 3번째 재발이므로 이번에 함께 정리 권장.
2. (WARNING #3, developer) `plan/in-progress/node-output-redesign/cafe24.md` 의 라인 인용 4곳(L167, L178, L213, L216)을 §4.4 삽입 반영해 재검증. 급하지 않으나 다음 착수 전 정정.
3. (WARNING #2, orchestrator) 다음 `--impl-prep`/`--impl-done` 실행 시 `spec/4-nodes/` 예산 초과로 인한 target/convention 절단을 줄이도록 하위영역 분할 또는 예산 확대 검토.
4. (INFO 2건) 급하지 않음 — 별도 조치 불요, 후속 정리 타이밍에 반영 권장.
---

## 이 라운드 처분 (main Claude)

**WARNING 1·3 + INFO 1 반영, WARNING 2 는 하네스 사안이라 기록.**

**WARNING 1 (provider 3종 SoT 참조) — 반영.** 세 문서를
"요구사항: CCH-SE-02 / 키·TTL·게이트 순서 상세 SoT: data-flow/14 §2.2" 로 갈랐다.

> **이번 PR 에서 같은 형태가 세 번째다.** SoT 를 옮길 때마다 참조자를 놓쳤다 —
> ① `2-navigation:1294`(코드 리뷰가 잡음) ② §4.4 안의 상수 값 중복(내가 잡음)
> ③ provider 3종(consistency 가 잡음). 매번 "이번엔 다 봤다" 고 생각했다.
>
> 원인은 **참조자를 찾는 방법이 매번 즉흥적**이었던 것이다. 옮긴 절의 앵커
> (`#98-...`)를 저장소 전역으로 grep 하면 한 번에 나왔을 일을, 기억에 의존해
> "관련 있어 보이는 문서" 만 열었다. **SoT 이관은 앵커 문자열 전수 grep 을 절차로
> 삼아야 한다** — 이 교훈을 plan 항목에 박았다.

**WARNING 3 (plan 라인 인용 stale) — 반영.** §4.4 신설이 +17줄이라 그 아래 절이 전부 밀렸고,
`node-output-redesign/cafe24.md` 의 spec 라인 인용 3곳이 한 번에 stale 이 됐다. 실측
(`4-cafe24.md:254`→271, `:348`→§6은 353)으로 고치고 **절 이름을 먼저 적는 표기**로 바꿨다 —
절 이름은 삽입에 밀리지 않는다.

> 요약 에이전트는 stale 대상을 **L167·L178·L213·L216 네 곳**이라 했는데, 실측하니 L167·L178 은
> `cafe24.handler.ts` 라인 인용이라 이 편집과 **무관**했다. 실제 대상은 L212·213·216 이다.
> 요약을 그대로 받아 적었으면 무관한 두 줄을 건드리고 진짜 한 줄(L212)을 놓쳤을 것이다.

**INFO 1 (`data-flow/5-integration.md:156`) — 반영.** 직전 라운드에서 "급하지 않음" 으로 유예된
항목인데, WARNING 1 과 **같은 결함 클래스**라 같은 턴에 처리했다. 유예 근거가 "우선순위" 였지
"성격이 다름" 이 아니었다.

**WARNING 2 (프롬프트 예산 초과 절단) — 무조치, 기록.** `spec/4-nodes/` 대상 파일 24개 +
conventions 8개가 stub 으로 절단됐다. checker 가 스스로 위험 최고 4건을 워킹트리에서 직접
Read 해 보완했고, **나머지는 전수 대조하지 못했음을 명시**했다 — 그 정직한 한계 표기가 이
보고서에서 가장 값어치 있는 부분이다. orchestrator 예산 사안이라 이 PR 범위 밖이고,
[[feedback_consistency_spec_mode_budget]] 과 같은 뿌리다.

**INFO 2 (`CAFE24_404` 명명) — 무조치.** 기존 pass-through 패턴이고 이번 diff 신규 아님.
