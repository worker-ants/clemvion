# Maintainability Review

## 대상
- `codebase/backend/src/nodes/core/node-handler.interface.ts` (JSDoc 전용 편집, 런타임 로직/타입 변경 없음)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (plan 문서 갱신)
- `review/code/2026/07/25/23_37_31/**`, `review/code/2026/07/25/23_52_56/**`, `review/consistency/2026/07/25/23_37_31/**` — 이전 리뷰 세션의 harness 산출물(자동 생성 JSON/MD 리포트). 코드가 아니므로 가독성/네이밍/함수 길이/중첩/매직넘버/순환복잡도 기준이 적용되지 않아 본 리뷰 스코프에서 제외.

이번 diff 는 이전 세션(23_52_56)에서 이미 지적·수정된 WARNING(W1: 요약-소비자 리스트 불일치, W2: 원본 줄번호 인용)이 반영된 최종 상태다. 직접 파일을 열어 대조한 결과 두 수정 모두 반영되어 있고, 인용 스타일(`Trigger.type` 표, `spec/1-data-model.md`)은 파일 내 기존 관례(`§섹션`, `CONVENTIONS Principle 7`, `CCH-AD-05` 등 안정 식별자 인용, 예: 10행 `4-execution-engine §6.1.1`, 78행 `13-replay-rerun.md §7.2`)와 일치함을 확인했다.

### 발견사항

- **[INFO]** JSDoc 코멘트 블록의 지속적 비대화
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` — `abortSignal` 필드 JSDoc (게이트 214~245)
  - 상세: `abortSignal` 필드 하나의 JSDoc 이 producer 열거·consumer 열거(5개 세부 메커니즘)·negative-case 서술(chat-channel 제외 근거, CCH-AD-05·`executionEvents$` 구독 방향·`Trigger.type` 표 인용 포함)까지 30여 줄로 누적됐다. 근거 상세가 SoT 인 `spec/conventions/node-cancellation.md` 와 코드 JSDoc 양쪽에 존재하게 되어, spec 이 갱신돼도 JSDoc 이 조용히 stale 해질 수 있는 경로다(자동 동기화 검증 없음 — RESOLUTION.md 의 INFO4 도 같은 갭을 "이번 스코프 강제 아님"으로 인지하고 보류함).
  - 제안: 강제 아님. 다만 향후 소비자 목록이 또 늘어나면(예: 신규 커머스 채널) JSDoc 은 "무엇을/왜"만 남기고 세부 메커니즘 설명은 spec 문서 링크로 위임하는 편이 장기적으로 유지 부담을 줄인다.

- **[INFO]** 동일 근거 문단의 3중 중복
  - 위치: `node-handler.interface.ts`(238~244행) JSDoc, `plan/in-progress/node-cancellation-residual-signal-propagation.md`(35~45행), `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(192~211행)
  - 상세: "chat-channel 은 노드가 아니라 webhook 트리거의 `config.chatChannel` 변형 / outbound 어댑터(CCH-AD-05) / `abortSignal` 참조 0건" 이라는 동일 논지가 표현만 바꿔 3곳에 반복 기재되어 있다. plan 라이프사이클(완료 기록 동결) 특성상 plan 쪽 중복은 이력 보존 목적이라 감내 가능하나, 코드 JSDoc 까지 포함해 총 3곳이라 향후 근거가 바뀔 경우 일부만 갱신되고 나머지가 stale 해질 위험은 여전히 존재한다.
  - 제안: 필수 아님(이전 리뷰 라운드에서도 동일 결론). 코드 JSDoc 은 결론 요약만 유지하고 상세 근거는 plan/spec 문서로 위임하는 안을 고려할 수 있으나, 이번 PR 스코프에서 강제할 사안은 아니다.

- **[INFO]** consumer 목록의 열거 스타일과 negative-case 서술 방식 불일치
  - 위치: `node-handler.interface.ts` 게이트 225~244 (`abortSignal` JSDoc 의 소비자 bullet 목록 vs 그 뒤 chat-channel 산문 문단)
  - 상세: HTTP/DB/AI/Email/Cafe24·MakeShop 은 `- ` bullet 로 열거되는 반면, chat-channel(해당 없음 케이스)은 리스트 밖 별도 산문 문단으로 서술되어 있다. "지원하는 소비자" 목록과 "애초에 대상이 아닌 사례"를 구분한 의도로 보이며 오류는 아니지만, 독자가 처음 볼 때 왜 하나만 다른 형식인지 즉시 파악하기 어렵다.
  - 제안: 강제 아님. 원한다면 "signal 미지원 노드는 무시 가능" bullet 옆에 "chat-channel: 노드 아님, 대상 아님(하단 설명 참조)" 한 줄을 추가해 목록 완결성을 높일 수 있다.

- **[INFO]** plan 문서 편집은 순수 텍스트 정정(체크박스 갱신 + 근거 서술) — 가독성·구조 문제 없음. `worktree:` frontmatter 값 갱신은 트리비얼 housekeeping.

## 요약
이번 변경은 순수 JSDoc/문서 정정이며 런타임 로직·타입·제어 흐름을 건드리지 않아 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 등 전통적 유지보수성 지표는 해당 사항이 없다. 직접 파일을 열어 대조한 결과 이전 세션에서 지적된 WARNING(요약-소비자 리스트 불일치, 불안정한 줄번호 인용)은 이미 수정되어 있고 파일 내 기존 인용 관례와도 일치한다. 남은 관찰 사항은 모두 INFO 수준으로, JSDoc 근거 문단의 점진적 비대화와 코드/plan 문서 간 동일 근거의 3중 중복인데, 둘 다 이전 리뷰 라운드에서도 동일하게 확인되었고 plan 라이프사이클·이번 PR 스코프상 강제 조치가 필요하지 않다.

## 위험도
LOW
