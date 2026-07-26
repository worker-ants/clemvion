# Rationale 연속성 검토

## 검토 범위 메모

`--impl-done` (scope=`spec/conventions/`, diff-base=`origin/main`). `git diff origin/main --name-only` 로
실측한 결과 이번 PR 이 `spec/conventions/**` 에 준 diff 는 **0줄**이다. 실제 코드/plan 변경은:

- `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc 14줄)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md`
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`

프롬프트에 첨부된 "target 문서" 는 `spec/conventions/` 전체 스냅샷(대부분 cafe24-api-catalog 등
이번 PR 과 무관한 파일)이라, diff 자체보다 **"이번 PR 의 code+plan 결정이 target 문서(spec/conventions/*)의
기존 서술과 지금 어긋나 있는가"** 를 실측으로 확인했다 (`spec/conventions/node-cancellation.md` 직접 Read
+ `git log --oneline` 로 의도 확인).

## 발견사항

- **[WARNING]** `node-cancellation.md` 가 "chat-channel 은 노드" 라는 이제 반증된 전제를 여전히 담고 있다 (spec 미갱신 — 단, 이미 위임됨)
  - target 위치: `spec/conventions/node-cancellation.md` §1 목적 (line 24: "HTTP / DB / AI / Email / **chat-channel** / 이커머스 통합 Cafe24·MakeShop") 및 §6 구현 현황 표 (line 137: `chat-channel 노드 signal 전파 | — | 미구현 (Planned)`)
  - 과거 결정 출처: 동일 문서 자체가 SoT (`node-handler.interface.ts` JSDoc: "SoT: spec/conventions/node-cancellation.md") — §1/§6 은 "chat-channel 도 언젠가 signal 전파를 구현해야 할 대상 노드" 라는 전제를 깔고 있었다 (구코드 주석: "chat-channel 노드의 signal 전파는 후속 PR 에서 점진 통합").
  - 상세: 이번 PR 의 `node-handler.interface.ts` diff(커밋 `60542ee77`/`35aac3539`) 와 `plan/in-progress/node-cancellation-residual-signal-propagation.md`(체크박스 항목 정정) · `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 #5") 가 이 전제를 **반증**했다: `codebase/backend/src/nodes/**` 전 카테고리에 `chat` 노드 파일 0건, `node-types.constants.ts` 미등록. 실체는 `webhook` 트리거의 `config.chatChannel` 변형(`1-data-model.md:230`)이고 구현은 `modules/chat-channel/**` 어댑터로, `executionEvents$` 를 구독해 **outbound** 로 발송하는 방향이라(CCH-AD-05, `spec/5-system/15-chat-channel.md:58` 로 실측 확인) `abortSignal` cascade 대상 자체가 될 수 없다 — "Planned" 가 아니라 "won't-do (범주 오류)". 코드 JSDoc 은 이번 PR 에서 정정됐지만, 그 JSDoc 이 SoT 로 가리키는 `node-cancellation.md` 본문(§1 나열·§6 표 행)은 **아직 갱신되지 않아 코드-스펙 간 결정 불일치**가 남아 있다.
  - 완화 요인: developer 는 `spec/` 쓰기 권한이 없어 침묵 없이 명시적으로 위임했다 — `spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-25 #5)" 항목이 정확히 이 §1/§6 정정을 project-planner 앞으로 제안문까지 작성해 남겨뒀다(spec_impact 에도 `node-cancellation.md` 등재). 절차상 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 을 정확히 따른 것이라 **은폐된 위반이 아니라 처리 대기 중인 정당한 gap** 이다.
  - 제안: 병합 전 project-planner 가 이 위임을 처리하거나(§1 나열에서 chat-channel 제거 + §6 표 행을 "노드 아님 — 트리거 어댑터, cascade 대상 아님" 으로 정정 또는 삭제), 처리하지 않고 병합한다면 plan 의 pending 상태를 유지한 채 stale-checkbox 로 남기지 않도록 후속 추적을 명시할 것.

- **[INFO]** 같은 §6 표에 인접한 MakeShop/Cafe24 행도 구현 완료 후 상태 갱신 대기 중 (참고용, 본 checker 신규 발견 아님)
  - target 위치: `spec/conventions/node-cancellation.md` §6 (line 138-139)
  - 상세: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-25)" 항목이 이미 이 SPEC-DRIFT(구현 완료 `✓` 미반영)를 별도 리뷰(`review/code/2026/07/25/21_02_33` WARNING 2)에서 포착해 위임해 뒀다. Rationale 원칙 위반이라기보다 상태 표기 지연이라 INFO 로만 기록 — 위 WARNING 항목과 함께 project-planner 처리 시 동반 정리 대상.
  - 제안: 위 WARNING 항목과 동일 PR/커밋에서 함께 처리.

그 외 `spec/conventions/` 전체 스냅샷(cafe24-api-catalog, audit-actions 등)에는 이번 diff 가 닿지 않았고,
프롬프트에 포함된 "관련 Rationale 발췌"(0-overview/1-data-model/2-navigation 각 파일)와 대조해도
이번 PR 의 결정과 충돌하는 기각된 대안 재도입·원칙 위반 사례는 발견되지 않았다.

## 요약

이번 PR 의 실질 변경(코드: `node-handler.interface.ts` JSDoc, plan: 두 개의 in-progress 항목 갱신)은
"chat-channel 은 취소 신호 전파 대상 노드가 아니다" 라는, 실측 근거(노드 디렉터리 전수 확인·CCH-AD-05·
데이터 모델 트리거 정의)로 뒷받침된 정당한 결정 정정이다. 다만 그 결정이 뒤집는 과거 전제가 여전히
`spec/conventions/node-cancellation.md` §1/§6 본문에 남아 있어, 코드(SoT 를 이 문서로 지목)와 spec 문서가
일시적으로 어긋난 상태다. developer 는 spec 쓰기 권한이 없어 이 정정을 project-planner 앞으로 명시적으로
위임했으므로 이는 은폐된 Rationale 위반이 아니라 이미 추적 중인 정당한 gap 이며, 병합 전후로 project-planner
가 해당 plan 위임(§5, §"추가 위임" 계열)을 처리해 spec 을 code 와 재정합시키는 후속 조치가 필요하다.

## 위험도
LOW
