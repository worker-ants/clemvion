# 유지보수성(Maintainability) Review — output-shape.ts JSDoc 정정 + plan 각주 정정

## 리뷰 대상

1. `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` 함수 상단 JSDoc 만 변경 (런타임 코드 무변경).
2. `plan/in-progress/is-conversation-output-restructure.md` — 각주 내 커밋 해시 인용 정정 (`f17fc18dd` → `f0ef4a821`) 1건.

두 파일 모두 이전 `/ai-review` 라운드(18_02_39, W#1·W#2)에 대한 후속 정정 커밋이며, 실행 표면(런타임 동작)을 바꾸지 않는 문서·주석 전용 변경이다.

## 발견사항

- **[INFO]** 새 JSDoc 이 고정하지 않은 인접 항목 하나가 여전히 코드 분기와 미묘하게 어긋난다
  - 위치: `output-shape.ts:120` (이번 diff 에서 손대지 않은 미변경 줄) — `- Legacy flat completed (top-level \`messages\` + \`interactionType\`)`
  - 상세: 이 항목이 가리키는 실제 분기(`output-shape.ts:145-151`)는 `raw.interactionType`(멀티턴 타입 매칭) 또는 `raw.conversationConfig != null` 만 검사하며 `raw.messages` 존재 여부는 전혀 확인하지 않는다. 즉 코드의 boolean 조건만 보면 `messages` 없이 `interactionType` 만으로도 이 분기가 true 를 반환한다. "payload shape 설명"(실제 legacy-flat-completed 레코드는 관례적으로 두 필드를 함께 가진다)으로 읽으면 방어 가능하지만, boolean 조건의 축자적 서술로 읽으면 부정확하다. 이 커밋의 취지가 "분기와 불일치하는 열거를 없앤다"(W#2)이므로, 같은 잣대를 이 인접 줄에도 적용했다면 더 철저했을 것 — 다만 이번 diff 가 손대지 않은 줄이라 이 커밋이 새로 만든 결함은 아니다.
  - 제안: 필요시 "이 분기는 `messages` 유무와 무관하게 `interactionType`/`conversationConfig` 만으로 판정한다"는 각주를 덧붙이거나, 서두의 "OR-chain over the payload shapes" 프레이밍(코드 조건이 아니라 데이터 형태 설명이라는 의도)을 이 항목에도 명시적으로 적용해 오독 여지를 줄인다. 시급하지 않음.

- **[INFO]** 함수 레벨 JSDoc 과 인접 인라인 주석이 "defensive fallback" 을 두 곳에서 독립적으로 서술
  - 위치: `output-shape.ts:125-129` (JSDoc "Wrapped waiting … plus a defensive fallback …") vs `output-shape.ts:184-187` (인라인 주석 "Canonical waiting shape: … defensive fallback")
  - 상세: 두 주석이 같은 분기(`isCanonicalWaiting = unwrapped.status === "waiting_for_input" && hasLegacyMessages`)를 각자의 산문으로 재서술한다. 내용은 현재 서로 일치하지만, 이 PR 의 근본 동기 자체가 "산문이 코드에서 독립적으로 뒤처져 실제 버그로 이어졌다"(#959, 이번 W#2)이므로, 같은 로직을 설명하는 산문이 두 곳에 흩어져 있으면 향후 한쪽만 갱신되고 다른 쪽이 stale 해질 재발 경로가 구조적으로 남는다. 파일의 기존 관례(다른 export 함수들도 상단 docstring + 인접 인라인 주석을 함께 쓴다)와는 일관되며, 새 JSDoc 이 "authoritative 는 코드, 목록은 이를 bound 하지 않는다"고 명시해 이 위험을 상당 부분 완화했다.
  - 제안: 조치 불요 — 향후 이 분기 조건을 바꿀 때 두 주석을 동시에 갱신하도록 리뷰 체크리스트에 남겨두는 정도로 충분. 지금 당장 병합할 필요는 없다.

- **[INFO]** JSDoc 블록이 함수 본문 대비 상당한 분량(약 24줄 vs 함수 본문 약 60줄)
  - 위치: `output-shape.ts:113-137`
  - 상세: 6개 항목을 모두 산문으로 나열해 길이가 늘었다. 다만 같은 파일의 `extractIeSnapshot`(파일 내 다른 위치)·`extractAiMetadata` docstring 도 유사하게 다항목 산문 스타일을 쓰고 있어 파일 컨벤션과는 일관된다. 새로 추가된 "branches are authoritative — this list documents them, it does not bound them" 문구가 "고정 개수/완전성 주장"을 명시적으로 철회해, 이 분량이 커져도 향후 리스트가 다시 stale 해졌을 때의 피해(거짓 보증에 대한 과신)를 구조적으로 낮춘다는 점에서 이번 변경의 핵심 가치는 분량이 아니라 이 disclaimer 자체다.
  - 제안: 없음. 현 상태로 충분.

- **[INFO — 검증 결과 공유]** plan 각주의 커밋 해시 정정이 실측과 일치함을 별도 확인
  - 위치: `plan/in-progress/is-conversation-output-restructure.md` (E-3b 각주)
  - 상세: `git cat-file -t f17fc18dd` → 유효 커밋(`fix(ai-end-reason): 리뷰 발견 배선 누락 3건 + …`)이지만 `git show f17fc18dd -- codebase/frontend/src/components/editor/run-results/output-shape.ts` 출력이 비어 있어 "해당 파일을 건드린 적이 없다"는 커밋 메시지의 주장과 일치한다. 반대로 `git show f0ef4a821 --stat`은 `interaction-type-registry.ts` 를 포함하고, 해당 커밋 diff 에 `IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean>` 신설이 실제로 포함돼 있어 정정된 인용이 맞다. 문서 226행의 기존 인용과도 이제 일치해 자기모순이 해소됐다.
  - 제안: 없음 — 정정이 정확함을 확인.

## 요약

이번 변경은 런타임 코드를 전혀 건드리지 않는 순수 문서(JSDoc 주석 + plan 각주) 정정으로, 위험 표면이 사실상 없다. `isConversationOutput` 의 JSDoc 이 "4개 shape" 라는 부정확한 고정 개수 주장을 제거하고 실제 6개 분기(이 PR 이 정정 대상으로 삼은 `looksLikeConversationEnd` 포함)를 모두 열거했으며, 무엇보다 "이 목록은 코드를 bound 하지 않는다"는 disclaimer 를 추가해 향후 같은 종류(주석이 코드보다 뒤처져 실제 버그로 번지는)의 재발 위험을 구조적으로 낮췄다 — 이는 이 PR 계열(#959, #961, 그리고 이 plan 자체)이 반복적으로 겪어온 "가드·문서의 거짓 보증" 문제에 정확히 대응하는 개선이다. 남은 지적은 모두 사소한 수준이다: (1) 이번 diff 가 손대지 않은 인접 항목("Legacy flat completed") 하나가 여전히 boolean 조건과 축자적으로는 어긋날 수 있고, (2) 함수 docstring 과 인접 인라인 주석이 동일 분기를 독립적으로 서술해 향후 동기화 부담이 남는다. 두 항목 모두 이번 커밋이 새로 만든 결함이 아니며 즉각 조치가 필요한 수준도 아니다. plan 문서의 해시 인용 정정은 git 이력으로 직접 대조 검증했고 정확하다.

## 위험도

NONE
