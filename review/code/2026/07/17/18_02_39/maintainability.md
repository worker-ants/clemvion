# 유지보수성(Maintainability) 리뷰

대상 커밋: `a8c9460564df00131fcb39c516d9ee8ca6a3383b`
`fix(ai-end-reason): 리뷰 WARNING#1,2,5,6,9,10 정리 — 고아 JSDoc·화이트리스트 사각지대·plan 정정`

대상 파일 7개: `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile.playwright-e2e`,
`codebase/frontend/src/components/editor/run-results/{output-shape.ts,__tests__/output-shape.test.ts}`,
`codebase/frontend/src/lib/conversation/__tests__/interaction-type-registry.test.ts`,
`codebase/packages/ai-end-reason/README.md`, `plan/in-progress/is-conversation-output-restructure.md`

이 커밋은 프로덕션 로직을 변경하지 않는 순수 "정리(cleanup)" 커밋이다 — Dockerfile 주석 drift 정정, 고아
JSDoc 삭제 + 재배치, 신규 negative-path 테스트 2건, README 섹션 보강, plan 실측 정정 각주. 모든 항목을
저장소 실물과 대조 검증했다.

## 발견사항

- **[INFO]** README 신규 섹션 표제가 "형제 패키지 4개 전부" 와 정확히 일치하지 않음
  - 위치: `codebase/packages/ai-end-reason/README.md` `## 빌드` / `## 사용(Exports)`
  - 상세: 커밋 메시지(SUMMARY#9)는 "형제 패키지 4개 전부가 갖는 `## 빌드` / `## 사용(Exports)` 섹션 추가"라고
    적었다. 4개 형제 패키지(`expression-engine`·`node-summary`·`chat-channel-validation`·`graph-warning-rules`)
    실물을 대조한 결과:
    - `## 빌드`: `expression-engine`·`node-summary`·`graph-warning-rules` 3곳엔 있으나 `chat-channel-validation`
      엔 없음 (4/4 아니라 3/4).
    - `## 사용(Exports)`: 이 정확한 표제는 4곳 어디에도 없음 — `expression-engine`·`node-summary`는
      `## 사용`(괄호 없음, 별도로 `## 주요 export` 섹션이 심볼 표를 담당), `chat-channel-validation`은
      `## Exports`(영문, "사용" 없음), `graph-warning-rules`는 아예 "사용" 절 없이 바로 `## 주요 export`로
      감. 신규 `## 사용(Exports)`는 넷 중 어느 것도 아닌 **제3의 변형**이다.
    - 내용 구조(코드블록 + 불릿 설명)는 `chat-channel-validation`의 `## Exports`와 가장 유사하다.
  - 제안: 패키지 5개(`ai-end-reason` 포함)의 README 절 표제를 하나의 관용구로 통일 — 예: 전부 `## 사용` +
    별도 `## 주요 export` 표로 맞추거나, 최소한 이번 신설 표제를 기존 넷 중 하나와 문자 그대로 일치시킨다.
    기능 영향은 없는 순수 문서 일관성 사안이라 후속 정리로 미뤄도 무방하다.

- **[INFO]** 재배치된 JSDoc의 "네 가지 shape" 열거가 현재 구현을 완전히 반영하지 못함 (이 diff 범위 밖, 사전 존재)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:113-124` (`isConversationOutput` 바로 위 JSDoc)
  - 상세: 이번 diff는 이 JSDoc을 "고아" 위치에서 함수 선언 바로 위로 **이동만** 했을 뿐 문구는 그대로다(git
    diff 확인 — 삭제된 블록과 추가된 블록의 텍스트가 동일). 그런데 함수 본문은 이번 diff에서 변경되지
    않았음에도 이미 문서화된 4가지 shape(legacy flat completed / new wrapped completed / new wrapped
    waiting / legacy waiting) 외에 `looksLikeConversationEnd`(post-Stage-5 `output.result.messages` +
    `endReason`, 테스트 `"detects post-Stage-5 ai_agent terminal..."`로 커버됨)와 `isCanonicalWaiting`
    (방어적 폴백: `status === 'waiting_for_input'` + `output.messages`, 테스트
    `"detects canonical waiting shape via status..."`로 커버됨) 두 분기를 추가로 처리한다. "네 가지"라는
    문구가 실제 분기 수보다 적다.
  - 제안: 이 diff의 결함은 아니다(내용을 편집하지 않고 위치만 옮김). 다만 이번 커밋이 이 정확한 JSDoc을
    "정리" 대상으로 명시적으로 다뤘으므로, 다음에 이 함수를 건드릴 때 shape 목록을 실제 분기 수에 맞게
    갱신하면 좋다.

- **[INFO]** `isConversationOutput`의 OR-체인 복잡도는 여전히 남아 있음 (의도적으로 이번 diff 범위 밖)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:125-179` (`isConversationOutput` 함수 본문 — 이번 diff에서 미변경)
  - 상세: 약 8개의 불리언 플래그(`hasResultMessages`/`hasLegacyMessages`/`outputInteraction`/`metaInteraction`/
    `hasConvConfig`/`looksLikeConversationEnd`/`isCanonicalWaiting` 등)를 계산해 4-way OR로 결합하는 단일
    함수다. 이 복잡도는 plan 문서(`plan/in-progress/is-conversation-output-restructure.md`)에 이미
    "architecture reviewer *반복적 heuristic OR-체인 확장 — 회귀 계열의 반복 진원지*"로 명시적으로
    추적되고 있고, 이번 커밋의 E-4 항목은 "동작·조건은 무변경"을 의도적으로 명시한다(회귀 위험 회피
    목적). 즉 알려진 채무이며 이번 diff가 그것을 늘리거나 줄이지 않는다.
  - 제안: 이번 diff에 대한 조치 요구 아님 — 이미 별도 백로그로 추적 중인 사안이라는 점만 기록.

## 정상 확인된 항목 (긍정적 관찰)

- **Dockerfile 주석 카운트 정정이 실측과 정확히 일치**: `codebase/backend/Dockerfile`(4→5), `codebase/frontend/Dockerfile.playwright-e2e`(4→5, 6→7) 모두 실제 `COPY codebase/packages/...` 라인 수를 직접 세어 대조한 결과 정확했다. 형제 파일 `codebase/frontend/Dockerfile`(이번 diff 미포함)은 개별 카운트 주석이 아예 없는 `COPY codebase/packages ./codebase/packages` 통짜 복사라 drift 대상이 아니었음도 확인 — 놓친 곳 없음.
- **고아 JSDoc 제거가 깨끗함**: 삭제 후 파일에 빈 주석 블록·중복 공백 등 잔여물이 없다(현재 파일 직접 확인).
- **신규 테스트 2건이 기존 스타일과 일관됨**: `output-shape.test.ts`의 negative-path 테스트는 인접 테스트들과 동일한 "설명 주석 + `it(...)` " 패턴을 따르고, 어떤 회귀 계열을 막는지(positive-only 사각지대) 명확히 서술한다. `interaction-type-registry.test.ts`는 `lib/conversation/__tests__/` 디렉터리의 기존 co-location 컨벤션(`conversation-utils.ts` ↔ `conversation-utils.test.ts`)을 그대로 따른다.
- **테스트 간 최소 중복**: 두 개의 `it` (정확 집합 assertion / 개별 `has()` 부정 assertion)이 논리적으로는 서로 포함 관계지만, 실패 시 더 구체적인 메시지를 주는 의도적 belt-and-suspenders 패턴으로 읽혀 문제 삼을 수준의 코드 중복은 아니다.
- **README `## 빌드` 절 내용이 실제 `package.json` scripts와 일치**: `npm run build`/`npm test`가 `ai-end-reason/package.json`의 `"build": "tsc"`/`"test": "jest"`와 정확히 대응.

## 요약

이번 커밋은 프로덕션 로직을 전혀 건드리지 않는 순수 정리 작업으로, 범위가 정확히 통제되어 있다.
Dockerfile 주석 카운트 정정은 실물과 대조 검증한 결과 완전히 정확했고, 고아 JSDoc 제거·재배치는 깨끗하게
적용되었으며, 신규 테스트 2건은 기존 코드베이스의 네이밍·주석·디렉터리 컨벤션을 잘 따르고 각각 무엇을
막는 회귀인지 명확히 서술한다. 유일한 흠은 README에 추가된 섹션 표제(`## 사용(Exports)`)가 "형제 패키지
4개 전부와 동일"이라는 커밋 메시지의 주장과 달리 실제로는 그 넷 중 어느 것과도 표제 문구가 정확히
일치하지 않는다는 점(3/4만 `## 빌드` 보유)으로, 기능에는 전혀 영향이 없는 순수 문서 일관성 사안이다.
`isConversationOutput`의 OR-체인 복잡도와 JSDoc의 "네 가지 shape" 서술이 실제 분기 수에 못 미치는 점은
모두 이번 diff 이전부터 존재했고 이번 diff가 편집하지 않은 영역이라 이 변경 자체의 결함으로 볼 수 없다.

## 위험도

LOW
