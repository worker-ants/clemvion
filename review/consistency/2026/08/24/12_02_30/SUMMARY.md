# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전문 모두 확보. CRITICAL 발견 0건.

## 전체 위험도
**MEDIUM** — CRITICAL 없음(BLOCK 불요)이나, cross_spec 이 지적한 wire `output` 래퍼/도메인값 구분 미반영(형제 문서 2곳)이 방치 시 재현 가능한 결함 위험을 남긴다는 점에서 checker 중 최고 등급(MEDIUM)을 그대로 반영.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 이 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | target 이 정정한 "wire `output` = `NodeHandlerOutput` 래퍼 전체, 도메인 값은 `output.output`" 구분이 `spec/5-system/` 밖 형제 문서 2곳에 미반영. 실 코드(`chat-channel.dispatcher.ts`, 3개 provider `extractRendered()`)는 이미 래퍼를 전제로 방어적으로 짜여 있어 현재 런타임 파손은 없으나, 두 문서의 명시적 타입 주석·서술은 여전히 옛(반증된) 이해를 담고 있어 그 주석을 SoT 로 신뢰해 새 코드를 짜면 재현 가능한 결함(`event.output.rendered` 직접 접근 → `undefined`)이 된다 | `spec/5-system/6-websocket-protocol.md` §4.1 (diff, 정정됨) | `spec/conventions/chat-channel-adapter.md:166-186`(특히 line 180 타입 주석) — WS §4.4 를 SoT 로 명시 인용하면서 반대로 서술; `spec/5-system/15-chat-channel.md:81` CCH-MP-06(`chat-channel-adapter.md §1.3` 인용) | `chat-channel-adapter.md:180` 타입 주석을 `NodeHandlerOutput`(래퍼 전체)로 정정하고 도메인 값이 `output.output` 임을 명시. `15-chat-channel.md:81` CCH-MP-06 의 `output.rendered` 표현도 `output.output.rendered`(+ legacy flat fallback 후보) 로 정정. target 과 같은 커밋 범위(planner 턴)에서 동시 갱신 |
| 2 | plan_coherence | 자기-반증형 소정정(CLAUDE.md 예외)의 필수 후행 게이트 — "`--impl-done` 을 그 spec 파일이 포함되는 scope 로 반드시 돌린다" — 가 `conversation-thread.md` §8.4 정정(커밋 `e6a017a18`) 이후 `spec/conventions/` 스코프로 실행된 기록이 plan/review 어디에도 없음. frontmatter 자신도 이 게이트를 "조건 5"로 인지하고 있으나 미이행. 선례 PR(`sse-nodeoutput-allowlist.md`)은 동일 예외 원용 시 게이트 실행 라운드(`00_26_17`)를 체크리스트에 명시 인용해 대비됨 | `plan/complete/node-output-envelope.md` frontmatter `spec_impact`(자기-반증형 소정정 블록) / `## 작업` 체크리스트 | `spec/conventions/conversation-thread.md` §8.4 정정 대상 문장 | 병합 전 `spec/conventions/`(또는 `conversation-thread.md` 포함 스코프)로 `--impl-done` 1회 실행해 BLOCK 여부 확인하고, 그 라운드 ID 를 `plan/complete/node-output-envelope.md` 체크리스트에 인용. 이미 병렬로 그 스코프가 돌았다면 결과만 소급 인용 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `CHANGELOG.md` 신규 nested blockquote(2026-08-24 정정)가 인접한 2026-08-23 단락 중간에 삽입되며 뒤따르는 "유예 사유였던 …" 문장의 지시대상이 흐려짐(사실관계 오류 아님, 순수 가독성) | `CHANGELOG.md` "Unreleased" 항목 | 2026-08-24 블록을 단락 맨 끝으로 이동하거나 "(2026-08-23 결정에 대해)" 앵커 문구 추가. 필수 아님 |
| 2 | convention_compliance | 같은 diff 로 나란히 수정된 `execution.node.completed`/`.failed` 두 행이 동일한 CONVENTIONS Principle 3.2 를 인용하면서 `completed` 행만 anchor 링크 없이 산문 인용(`failed` 행은 링크형, 문서 전반 지배적 패턴과 편차) | `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed` 행 | `[CONVENTIONS Principle 3.2](../conventions/node-output.md#32-outputerror-표준-형태)` 형태로 링크화. 강제 아님 |
| 3 | convention_compliance | KB 이벤트(`document:embedding_started` 등) colon+underscore 표기가 execution 계열 dot-notation 과 다름 — Rationale 에 이미 정당화 근거 명시된 기존(diff 밖) 의도적 예외 | `spec/5-system/6-websocket-protocol.md` §4.3 | 조치 불요, 참고 기록만 |
| 4 | naming_collision | 신규 완료 plan `plan/complete/node-output-envelope.md` 이 기존 대형 in-progress 트래커 `plan/in-progress/node-output-redesign/` 와 "node-output" 접두를 공유(스코프·위치·접미어는 명확히 다름 — egress 필터링 vs 도메인 shape) | `plan/complete/node-output-envelope.md` | 실질 충돌 아니므로 이름 변경 불요. 향후 "node-output" 접두 plan 이 더 늘면 `node-output-egress-*` 처럼 세분화 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | wire `output` 래퍼/도메인값 구분이 `chat-channel-adapter.md`·`15-chat-channel.md` 두 형제 문서에 미반영(코드는 이미 정합, 문서만 stale) |
| rationale_continuity | LOW | 결정 번복(`#1208` 유예 근거 반증) 처리는 6개 관련 문서 모두 취소선+캐너리 갱신까지 모범적. CHANGELOG 가독성 INFO 1건만 |
| convention_compliance | NONE | 8개 규약 항목 전수 확인 결과 위반 없음. INFO 2건(링크 형식 편차, 기존 예외 재확인)만 |
| plan_coherence | LOW | 정본 트래커 동기화는 탄탄하나 자기-반증형 소정정 후행 게이트(`--impl-done spec/conventions/`) 실행 증거 부재 |
| naming_collision | LOW | 신규 요구사항/엔티티/엔드포인트/이벤트/ENV 도입 없음. 신규 함수·plan 파일명 충돌 없음(INFO 1건은 실질 충돌 아님) |

## 권장 조치사항
1. `spec/conventions/chat-channel-adapter.md:180` 타입 주석과 `spec/5-system/15-chat-channel.md:81` CCH-MP-06 를 target 의 래퍼/도메인값 구분(`output.output`)에 맞춰 정정 — planner 턴에서 `spec/5-system/` target 정정과 같은 범위로 동시 갱신 (WARNING #1 해소)
2. 병합 전 `--impl-done` 을 `spec/conventions/` 포함 스코프로 1회 실행하고 그 라운드 ID 를 `plan/complete/node-output-envelope.md` 체크리스트에 인용 (WARNING #2 해소, 이미 병렬 실행됐다면 결과만 소급 인용)
3. (선택) `CHANGELOG.md` 중첩 인용 위치 조정, `execution.node.completed` 행 Principle 3.2 링크화 — 강제 아님