# Rationale 연속성 검토 결과

## 조사 방법 메모

전달된 prompt_file(`_prompts/rationale_continuity.md`)은 `spec/conventions/` 전체를 target 으로
번들링했으나, 실제 diff(커밋 `60542ee77` "docs(nodes): chat-channel 은 노드가 아니다")가 건드린
파일은 `codebase/backend/src/nodes/core/node-handler.interface.ts`(JSDoc) 와
`plan/in-progress/node-cancellation-residual-signal-propagation.md` /
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 뿐이며, `spec/conventions/`
파일 자체는 **이번 커밋에서 수정되지 않았다** (developer 는 `spec/` 쓰기 권한이 없어 위임만 남김 —
정상 프로세스). 프롬프트에서 컨텍스트 예산 초과로 생략된 `spec/conventions/node-cancellation.md` 를
포함해 관련 spec/plan 을 워킹트리에서 절대경로로 직접 읽어 대조했다.

## 발견사항

- **[INFO]** chat-channel 노드 미존재 결론은 새 발견이 아니라 기존 완료 기록의 재확인 — 교차 인용 보강 제안
  - target 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` §"잔여 항목" chat-channel 항목, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"
  - 과거 결정 출처: `plan/complete/parallel-p2-followups-done.md:14` — `- [N/A] chat-channel 노드 — 노드 자체가 없음 (Trigger 메커니즘으로 통합).` (작성일 2026-05-30/분리 2026-06-01, 즉 이번 커밋보다 약 2개월 앞서 이미 동일 결론이 확정돼 있었다)
  - 상세: 이번 커밋은 "착수 전 프로브에서 전제가 반증됐다"는 서술로 마치 신규 발견인 것처럼 기술하지만, 실제로는 `parallel-p2-followups-done.md` 가 그 시점에 이미 "chat-channel 노드는 없다"를 N/A 로 못박아 두었다. 결론 방향은 완전히 일치하므로 **모순은 아니다** — 오히려 `spec/conventions/node-cancellation.md` §1/§6 이 그 결론을 약 2개월간 반영하지 못한 채 "미구현(Planned)" 으로 남아 있었다는 spec 쪽 staleness 를 이번 커밋이 뒤늦게 바로잡는 그림이다.
  - 제안: `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5" 에 `parallel-p2-followups-done.md:14` 를 근거로 명시 인용하면, project-planner 가 spec 갱신 시 "왜 이 오류가 이렇게 오래 남아 있었는가"까지 Rationale 에 함께 남길 수 있어 향후 유사 staleness 재발 방지에 도움된다.

- **[WARNING]** spec SoT(`node-cancellation.md`)가 아직 코드 JSDoc 의 새 결론과 어긋난 채 남아있음 — 위임은 됐으나 반영 전까지 라이브 모순 상태
  - target 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` JSDoc (이번 커밋에서 "chat-channel 은 여기 해당하지 않는다"로 확정 서술)
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` §1 (24행) "장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop)" 및 §6 표(137행) `| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |`
  - 상세: 이번 커밋 이후 코드 주석은 "chat-channel 은 노드가 아니고 cascade 대상이 될 수 없다"를 사실로 서술하는 반면, 그 근거 SoT 여야 할 `spec/conventions/node-cancellation.md` 본문은 여전히 chat-channel 을 "노드"이자 "미구현 Planned" 항목으로 분류하고 있다. developer 가 `spec/` 쓰기 권한이 없어 `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #5"로 정확히 위임한 것은 프로젝트 컨벤션(구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임)에 정확히 부합하는 정상 처리다. 다만 그 위임이 project-planner 에 의해 실제로 반영되기 전까지는 spec(SoT)과 코드 주석이 서로 다른 결론을 주장하는 상태가 남는다 — Rationale 연속성 관점에서는 "결정 번복이 발생했으나 SoT 문서의 새 Rationale/본문 갱신이 아직 완료되지 않은" 전형적인 과도기로, 프로세스 위반은 아니지만 실제로 반영될 때까지 추적이 필요하다.
  - 제안: (a) project-planner 가 위임을 처리할 때 `spec/conventions/node-cancellation.md` §1 나열과 §6 표 행을 실제로 갱신, (b) 갱신 시 `spec/4-nodes/1-logic/10-parallel.md:244` ("본 PR 기준 signal-aware 는 HTTP 노드만 — DB / AI / Email / chat-channel 은 후속 PR")도 같은 오분류를 반복하고 있는지 함께 점검 — 다만 이 문장은 "본 PR 기준"이라는 시점 한정 수식이 있어 역사적 스냅샷 성격이 강하므로 반드시 고쳐야 하는 것은 아니며 planner 판단 사항.

- **[INFO]** `spec/4-nodes/1-logic/10-parallel.md:244` 가 delegation plan 의 `spec_impact` 목록에 없음
  - target 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` frontmatter `spec_impact:` (node-cancellation.md · execution-engine.md · 1-data-model.md · data-flow/3-execution.md 만 나열)
  - 과거 결정 출처: `spec/4-nodes/1-logic/10-parallel.md:244` — "DB / AI / Email / chat-channel 은 후속 PR" 서술이 동일 오분류(chat-channel=노드)를 담고 있음
  - 상세: 위 WARNING 과 같은 근본 원인이지만 다른 파일이라 별도로 기록. delegation plan 이 `spec_impact` 를 정확히 스코핑했다면 이 파일도 후보로 검토 대상에 넣는 편이 완결성이 높다. Critical 은 아님 — "본 PR 기준"이라는 시점 표기 때문에 살아있는 계약이 아니라 역사 기록으로 읽힐 여지가 크다.
  - 제안: planner 위임 처리 시 이 라인을 함께 확인해 (i) 그대로 두거나 (ii) "당시 기준" 임을 더 명확히 하는 각주를 단다.

## 요약

이번 target(커밋 `60542ee77`)은 `spec/conventions/node-cancellation.md`(§1 목적, §6 구현 현황 표)와
`spec/1-data-model.md §2.8`(`chat-channel 은 별도 type 이 아니라 webhook 트리거의 config.chatChannel
변형`), `spec/5-system/15-chat-channel.md`(CCH-AD-05: 어댑터는 `executionEvents$` 구독 방향의
outbound 전용)를 실측으로 대조한 결과와 완전히 정합한다. 또한 이 결론은 `plan/complete/
parallel-p2-followups-done.md`(2026-05-30/06-01)에 이미 `[N/A] chat-channel 노드 — 노드 자체가
없음`으로 기록돼 있던 것과도 일치해, **기각된 대안의 재도입도 아니고 합의 원칙 위반도 아니다.**
developer 가 `spec/` 쓰기 권한이 없어 실제 spec 본문 정정을 project-planner 에 명시적으로 위임(§6 표
행·§1 나열 정정 제안까지 구체적으로 남김)한 처리 방식도 프로젝트 컨벤션(구현 중 spec 변경 필요 시
developer 정지 후 위임)을 정확히 따른다. 남는 것은 그 위임이 실제 반영되기 전까지 spec 본문(SoT)과
코드 JSDoc 이 서로 다른 결론을 담은 **과도기적 불일치**뿐이며, 이는 프로세스 결함이 아니라 위임 자체의
본질적 특성이다. Rationale 연속성 관점에서 CRITICAL 은 없다.

## 위험도
LOW
