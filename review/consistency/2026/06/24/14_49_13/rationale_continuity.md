# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-m1-residual-sync.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-24

---

## 발견사항

### [INFO] 편집 1-G: `startedAt?`/`finishedAt?` 추가는 기존 WS Rationale 의 합의 결정을 spec에 반영하는 것이나 출처 링크가 불완전함

- **target 위치**: 편집 1-G — `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 L533 각주
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` §Rationale "요소별 절대 발생 시각·소요시간 노출 — `startedAt`/`finishedAt` 동봉 (2026-06-03)"
- **상세**: WS 프로토콜 spec Rationale 은 `toolCalls[].startedAt`/`finishedAt` 추가 결정(기각된 대안: 파생 추정, 라이브 전용 클라이언트 stamp)을 이미 명문화했다. `meta.turnDebug[]` 영속 양쪽에 동일하게 싣는다는 것도 그 Rationale 에 명시되어 있으며(`"라이브 WS 이벤트와 meta.turnDebug[] JSON 영속 양쪽에 동일하게 싣는다"`), WS spec §4.4/§§586-646 에서 `toolCalls[].startedAt`/`finishedAt` 가 `meta.turnDebug[]` 에 영속됨을 이미 설명한다. target 의 편집 1-G 는 이 합의된 결정을 `1-ai-agent.md` L533 각주 shape 에 반영하는 것으로 Rationale 연속성에 어긋나지 않는다. 다만 편집 1-G 의 WS §4.4 정합 링크가 `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` 로 지정돼 있는데, 실제 `startedAt`/`finishedAt` 필드의 결정 SoT 는 WS spec §Rationale 항(`#요소별-절대-발생-시각소요시간-노출`)이므로 링크 대상이 정확도 측면에서 보완 여지가 있다.
- **제안**: 편집 1-G 각주의 `(ISO8601, 둘 다 optional, [WS §4.4](...))` 참조를 `[WS §4.4 + Rationale](../../5-system/6-websocket-protocol.md#요소별-절대-발생-시각소요시간-노출--startedatfinishedat-동봉-2026-06-03)` 로 보완하면 결정의 SoT 를 명확히 가리킬 수 있다. 필수 수정은 아님.

---

### [INFO] 편집 1-A ~ 1-F: M-1 god-handler 분할 자체의 Rationale 가 `1-ai-agent.md §12` 에 부재

- **target 위치**: 편집 1-A (§6 서두 레이어 주석), 1-B (§6.1 단계 2), 1-C (§6.2 서두), 1-D (§6.1 단계 1.3), 1-E (§6.1 단계 1.5), 1-F (§6.1 단계 2.7)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale 섹션 — M-1 분할 자체에 대한 항목 없음
- **상세**: target 의 모든 편집(1-A~1-F)은 M-1 god-handler 분할(`AiAgentHandler` → facade, `AiTurnExecutor`/`AiConditionEvaluator`/`AiMemoryManager` collaborator 위임) 을 "이미 발생한 코드 현실" 로 전제하고 doc-sync 만 수행한다. 기존 spec §6.1 단계 3.a (L373) 에 `AiConditionEvaluator.classifyToolCalls` 참조와 "M-1 god-handler 분할로 추출; `ai-agent.handler.ts` 는 무상태 collaborator 로 위임" 문구가 이미 있어 분할이 Rationale 없이 기록된 상태다. 즉 M-1 분할 자체의 설계 결정 배경(god-handler 분할의 이유, 단방향 위임 원칙 선택 이유, 대안 기각 내역)이 §12 에 아직 없다. target 이 이 상황을 변경하지 않고 doc-sync 주석만 추가하므로, target 자체가 이 공백을 악화시키지는 않는다. 그러나 편집 후에도 M-1 분할 Rationale 공백은 잔존한다.
- **제안**: 이번 doc-sync PR 범위가 "behavior 무변경 텍스트 동기화" 라 본 편집에서 §12 Rationale 항 신설을 강제할 필요는 없다. 다만 후속 project-planner 턴에서 `§12.15 M-1 god-handler 분할 근거` 항을 추가해 facade 패턴 채택 이유 / 단방향 위임 / 분할 대상 선택 기준을 기록하도록 권고한다.

---

## 요약

target 문서(`spec-draft-m1-residual-sync.md`)는 모든 편집을 "behavior 무변경 doc-sync" 로 제한하며, 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 내용이 없다. 편집 1-G 의 `startedAt?`/`finishedAt?` 추가는 WS 프로토콜 Rationale 에 이미 합의된 결정을 `1-ai-agent.md` 각주에 반영하는 것으로 연속성과 정합한다. M-1 god-handler 분할 자체의 Rationale 가 `§12` 에 부재한 점은 target 이 도입한 문제가 아니라 사전부터 존재하는 공백이며, target 이 이를 악화시키지는 않는다. 전반적으로 Rationale 연속성 관점의 위험은 없다.

---

## 위험도

NONE
