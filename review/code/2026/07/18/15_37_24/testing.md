# 테스트(Testing) 리뷰 — isConversationOutput OR-체인/AND-guard mutation 고립 테스트

## 검토 방법

산문 주장을 신뢰하지 않고 직접 재현했다:

1. `npx vitest run` 으로 두 대상 테스트 파일 실행 — **2 files / 46 tests 전부 통과**
   (`output-shape.test.ts` 39→46, `hydration-coverage.test.ts` 무변화 통과).
2. `output-shape.ts` 를 임시로 4가지 방식으로 훼손 → 재실행 → `cp` 백업으로 정확히 원복
   (`git status --short` 로 클린 확인). 각 훼손이 **오직 대응하는 신규 테스트 1개만** red 로
   전환시키는지 직접 확인:
   - **A** 첫 게이트의 top-level `conversationConfig` disjunct 제거 → `bare top-level
     conversationConfig` 테스트만 fail (45 passed / 1 failed)
   - **B** 첫 OR-항의 `hasLegacyMessages &&` AND-guard 제거 → `rejects
     output.interactionType when output.messages is absent` 테스트만 fail
   - **C** `looksLikeConversationEnd` 의 `hasResultMessages &&` AND-guard 제거 → `rejects a
     whitelisted endReason without result.messages` 테스트만 fail
   - **D** `isCanonicalWaiting` 의 `&& hasLegacyMessages` AND-guard 제거 → `rejects
     waiting_for_input status alone without output.messages` 테스트만 fail

   네 경우 모두 정확히 1개 테스트만 실패하고 나머지 45개는 그대로 통과했다 — RESOLUTION.md
   가 주장한 M1~M4(이전 3분기)·10_40_03 세션 후속 4분기 각각의 격리 주장이 **본 세션에서
   독립적으로 재확인됨**.
3. `MULTI_TURN_INTERACTION_TYPES`(`interaction-type-registry.ts`)에 `ai_conversation` 포함,
   `CONVERSATION_END_REASONS`(`@workflow/ai-end-reason`)에 `completed` 포함 확인 — 새 fixture
   들이 실제 화이트리스트 값에 의존하는 부분도 소스로 직접 검증.
4. `hydration-coverage.test.ts` 의 갱신된 주석이 가리키는 `buildConvConfigFromStructured`
   호출부가 `result-timeline.tsx:180`에 실재함을 `grep` 으로 확인 — 이전 리뷰(20_06_14)가
   지적한 라인 번호 drift(WARNING)가 함수명 참조로 교체되어 해소됐음을 재확인.

## 발견사항

- **[INFO]** `looksLikeConversationEnd` 의 세 번째 conjunct(`typeof endReason === "string"`,
  즉 `endReason` 키 자체가 없는 경우)를 단독으로 격리하는 음성 테스트가 없음
  - 위치: `output-shape.test.ts` — 기존 line 608 테스트(`rejects result.messages when
    endReason is outside the CONVERSATION_END_REASONS whitelist`)는 `endReason:
    "bogus_value"`(문자열이지만 화이트리스트 밖)만 다루고, `endReason` 필드가 아예 없는
    케이스(`typeof endReason === "string"` 자체가 false)는 어느 테스트도 단독으로
    겨냥하지 않는다.
  - 상세: 실측 결과 이 conjunct 를 제거해도(`typeof endReason === "string" &&` 삭제) 어차피
    `CONVERSATION_END_REASONS.has(undefined)` 는 `false` 이므로 현재 세트 밖에서는 mutation
    이 살아남지 않는다 — 즉 지금 당장 무방비는 아니다. 다만 그 이유가 "테스트가 잡아서"가
    아니라 "`Set.has(undefined)` 가 우연히 false" 라는 구현 세부에 의존하므로, 이 conjunct
    가 다른 방식(예: `??`)으로 리팩터될 경우 조용히 무방비가 될 수 있는 잠재 갭이다.
  - 제안: 차단 사유 아님. 필요시 `output.result.messages` 는 있지만 `endReason` 키 자체가
    없는 fixture 로 음성 테스트 1개 추가를 고려(선택 사항).

- **[INFO]** 신규 4개 테스트를 감싸는 주석이 "AND-guard 4곳"이라 통칭하지만, 첫 번째
  (`bare top-level conversationConfig`)는 실제로는 AND-guard 제거가 아니라 최상위 게이트의
  OR-disjunct 제거를 격리한다 (앞선 3개 OR-체인 테스트와 같은 성격)
  - 위치: `output-shape.test.ts` 신규 4개 블록 상단 주석(라인 629 부근에서 이어지는
    "아래 4개는...")
  - 상세: 테스트 자체와 개별 인라인 주석은 정확하다(“첫 게이트 두 번째 disjunct… 단독
    참”이라고 올바르게 서술). 상위 묶음 주석만 "AND-guard 4곳"이라는 표현으로 4개를
    동질화해, 정밀히 읽으면 1개는 분류상 다르다. 실질적 오해 소지는 낮음(각 테스트 바디
    주석이 정확하므로) — 스타일 지적.
  - 제안: 차단 사유 아님. 선택 사항.

- **[INFO]** 신규 4개 테스트는 이전 3개와 달리 내부 변수명이 아니라 페이로드 필드
  존재/부재로 주석을 서술 — 20_06_14 리뷰의 maintainability INFO(변수명 결합)를 이번
  배치에서 실제로 개선함
  - 위치: `output-shape.test.ts` 라인 98-101 부근 주석(“주석은 소스 변수명이 아니라
    페이로드 필드의 존재/부재로 서술”)과 그 아래 4개 테스트
  - 상세: 긍정적 발견 — 앞선 3개 테스트(`hasLegacyMessages && outputInteraction` 식으로
    변수명을 직접 인용)는 리팩터링 시 stale 해질 수 있다는 지적이 있었는데, 신규 4개는
    그 교훈을 반영해 필드명(`output.interactionType`, `output.messages` 등)으로만
    서술한다. 이전 3개는 RESOLUTION.md 에 따라 의도적으로 미조치(후속 고려)로 남아있어
    문서 불일치(SoT 분산)는 아님.
  - 제안: 없음(참고용, 회귀 아님).

## 요약

신규 4개 mutation 고립 테스트(및 이전 3개)의 격리 주장을 본 세션에서 소스 임시 훼손 +
재실행 + 정확한 원복으로 4건 모두 독립 재현했다 — 각 AND-guard/disjunct 제거 시 오직
대응 테스트 1개만 red 로 전환되고 나머지 45개는 영향받지 않았다. `isConversationOutput`
은 순수 함수(`unknown` 입력, 부작용 없음)라 mock 이 전혀 필요 없고 실제로 사용되지도
않으며, 각 fixture 는 로컬로 인라인 구성되어 테스트 간 의존성·순서 종속성이 없다.
`hydration-coverage.test.ts` 의 주석 정정도 실제 호출부(`result-timeline.tsx:180`)와
일치함을 확인했다. 유일한 잠재 갭은 `looksLikeConversationEnd` 의 `typeof endReason ===
"string"` conjunct를 `endReason` 필드 부재 케이스로 단독 격리하는 테스트가 없다는
점인데, 현재는 `Set.has(undefined) === false` 라는 구현 세부 덕에 우연히 안전하고 향후
리팩터 시에만 잠재적으로 무방비가 될 수 있는 저위험 INFO 다. 기존 39개 테스트는 fixture
변경 없이 그대로 유효하며 회귀 없음. 전반적으로 테스트 존재성·격리·가독성·회귀 유효성
모두 양호하고, 차단 사유가 되는 발견은 없다.

## 위험도
NONE
