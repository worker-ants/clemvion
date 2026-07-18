# 테스트(Testing) 코드 리뷰

## 검토 방법

정적 diff 검토에 더해, `output-shape.ts` 를 실제로 임시 훼손 → `vitest run` 재실행 →
원복(`git status`/`git diff --stat` 로 클린 확인) 하는 방식의 실측 mutation testing 을
직접 수행했다. 이 PR 자신이 채택한 검증 방법(RESOLUTION.md 의 M1~M4 표, requirement
리뷰어의 실측)과 동일한 방법론을 **PR 이 다루지 않은 잔여 분기**에 대해 추가로 적용했다.

기존 3개 신규 테스트(`output.interactionType alone`, `nested output.conversationConfig
alone`, `output.messages + meta.interactionType without status`)는 코드 추적으로
재확인 — 각각 `hasLegacyMessages && outputInteraction`, `hasConvConfig`,
`hasLegacyMessages && metaInteraction` 만을 참으로 만드는 fixture 가 맞고, 다른 5개
OR-변수는 모두 거짓으로 유지된다. RESOLUTION.md 의 M1/M2/M3 실측과 일치.

## 발견사항

- **[WARNING]** `isConversationOutput` 의 OR-체인에 이번 PR 이 다루지 않은 mutation 무방비 분기가 최소 4곳 더 남아있다 (실측 확인)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` — `isConversationOutput` 함수 (top-level 게이트 및 canonical 블록의 개별 guard 4곳)
  - 상세: 아래 4개 조건을 각각 소스에서 임시로 제거하고 `npx vitest run output-shape.test.ts`(35 tests)를 재실행한 결과, **매번 35/35 green** 이었다 (즉 어떤 기존 테스트도 이 mutation 을 잡지 못한다). 원복 후 `git diff --stat` 클린 확인 완료.
    1. top-level 게이트의 두 번째 disjunct `raw.conversationConfig != null` — 현재 이 disjunct 가 단독으로 참이 되는 시나리오(top-level `interactionType` 없이 top-level `conversationConfig`)를 검증하는 테스트가 없다. 기존 테스트들은 top-level `conversationConfig` 가 있는 fixture마다 top-level `interactionType: "ai_conversation"` 도 함께 실어, 첫 번째 disjunct만으로도 이미 참이 된다.
    2. 하단 canonical 블록 첫 OR-항의 `hasLegacyMessages &&` guard — `(outputInteraction || metaInteraction)` 로 완화해도(즉 `output.messages` 가 배열인지 여부와 무관하게 통과하도록 완화해도) green. `output.interactionType`/`meta.interactionType` 는 있지만 `output.messages` 가 배열이 아닌 음성 케이스가 없다.
    3. `looksLikeConversationEnd` 의 `hasResultMessages &&` guard — 제거해도(즉 `result.messages` 존재 여부와 무관하게 `endReason` 화이트리스트 매치만으로 참이 되도록 완화해도) green. `output.result.endReason` 만 있고 `output.result.messages` 가 없는 음성 케이스가 없다.
    4. `isCanonicalWaiting` 내부의 `&& hasLegacyMessages` — 제거해도(즉 `status === "waiting_for_input"` 단독으로 참이 되도록 완화해도) green. **이 넷 중 실무 영향이 가장 큰 항목**: `WaitingInteractionType` (`@/lib/conversation/interaction-type-registry`)에는 `ai_conversation` 외에 `form`/`buttons`/`ai_form_render` 도 있고, 이들도 `status: "waiting_for_input"` 을 지닌 채 정지한다. 이 guard 가 리팩터링 중 실수로 사라지면 폼/버튼 대기 노드가 `output.messages` 배열이 없어도 대화 미리보기 탭으로 오분류될 수 있는데, 이를 막아줄 회귀 테스트가 현재 없다.
  - 이 PR 의 커밋 메시지·JSDoc 이 명시한 문제의식("OR-체인 분기 하나를 통째로 지워도 green 을 유지했다")이 정확히 이 4곳에도 적용된다. 다만 PR 이 고친 3분기와 달리 이 4곳은 이번 diff 의 변경 대상(새 테스트 3개)에 포함되지 않았다.
  - 제안: 아래 4개 fixture 를 추가하면 4곳 모두 막힌다 (직접 작성 후 현재 코드 기준 `vitest run` 으로 기대값 통과 확인 완료):
    ```ts
    it("detects conversation via bare top-level conversationConfig (config key present, no top-level interactionType, no output)", () => {
      const raw = {
        config: { mode: "multi_turn" },
        conversationConfig: { message: "hi", turnCount: 1 },
      };
      expect(isConversationOutput(raw)).toBe(true);
    });

    it("rejects output.interactionType when output.messages is not an array", () => {
      const raw = {
        config: {},
        output: { interactionType: "ai_conversation" },
        meta: { model: "m" },
      };
      expect(isConversationOutput(raw)).toBe(false);
    });

    it("rejects a bare whitelisted endReason without result.messages", () => {
      const raw = {
        config: {},
        output: { result: { endReason: "completed" } },
        meta: { model: "m" },
      };
      expect(isConversationOutput(raw)).toBe(false);
    });

    it("rejects waiting_for_input status alone when output.messages is absent (e.g. a form/buttons waiting node)", () => {
      const raw = {
        config: { mode: "form" },
        output: { fields: { name: "bob" } },
        status: "waiting_for_input",
      };
      expect(isConversationOutput(raw)).toBe(false);
    });
    ```

- **[INFO]** 신규 테스트 3건의 주석이 소스 내부 지역 변수명(`hasLegacyMessages`, `outputInteraction`, `hasConvConfig`, `metaInteraction`)에 직접 결합돼 있다
  - 위치: `output-shape.test.ts` L735-791 (`isConversationOutput / unwrapNodeOutput regression` describe 블록 말미)
  - 상세: maintainability 리뷰어가 이미 지적한 사항과 동일하나, 테스트 가독성·유지보수 관점에서도 유효하다 — 변수명이 바뀌면 테스트 자체는 fixture 기반이라 안전하지만 주석은 조용히 stale 해진다. 차단 사유는 아님.
  - 제안: maintainability 리뷰의 제안(조건을 필드 존재/부재로 서술하고 변수명은 괄호 부기)과 동일.

- **[INFO]** Mock 사용 없음 — 적절
  - 위치: `output-shape.test.ts` 신규 3건, `hydration-coverage.test.ts` 변경분
  - 상세: `isConversationOutput` 은 인자를 mutate 하지 않는 순수 함수이고 외부 의존성(네트워크·DB·시간)이 없어 mock/stub 이 전혀 필요 없다. 신규 테스트는 로컬 객체 리터럴만으로 정확히 대상 분기를 재현한다 — 실제 동작과의 괴리 없음.

- **[INFO]** 테스트 격리 확인
  - 상세: `beforeEach`/`afterEach`/module-level mutable fixture 없음. 각 `it` 블록이 독립된 `raw` 객체를 새로 생성한다. `npx vitest run` 단일 파일 실행과 2-파일 동시 실행 모두 42/42 green 으로 순서 의존성이 없음을 확인.

- **[INFO]** 회귀 유효성 확인
  - 상세: diff 는 순수 추가(3 tests) + 인접 파일의 주석 정정뿐이며 기존 34개 테스트의 바디는 변경되지 않았다. 원본 소스(`output-shape.ts`)를 원복한 상태에서 대상 2개 파일 전체 42/42 통과를 재확인했다 — 기존 테스트가 이번 변경 이후에도 유효하다.

- **[INFO]** 테스트 용이성 — 대상 함수는 이미 테스트 친화적 구조
  - 상세: `isConversationOutput(outputData: unknown)` 은 의존성 주입 없이 순수 입력→출력 함수라 fixture 리터럴만으로 모든 분기를 임의로 조합 가능하다. 이번 PR 이 이례적으로 많은 mutation-isolation 테스트를 손쉽게 추가할 수 있었던 것도 이 구조 덕분이다.

## 요약

이번 diff 는 프로덕션 로직 변경 없이 `isConversationOutput` OR-체인 중 기존에 mutation 무방비였던 3개 분기(`hasLegacyMessages && outputInteraction`, `hasConvConfig`, `hasLegacyMessages && metaInteraction`)를 정확히 고립시키는 회귀 테스트를 추가한다. 코드 추적과 RESOLUTION.md 의 실측(M1~M3)이 일치함을 확인했고, 신규 테스트의 격리 주장은 타당하다. 다만 동일한 실측 방법론(guard 임시 제거 → `vitest run` 재실행)을 이 함수의 **나머지 OR/AND guard 4곳**(top-level `conversationConfig` disjunct, 첫 OR-항의 `hasLegacyMessages` guard, `looksLikeConversationEnd` 의 `hasResultMessages` guard, `isCanonicalWaiting` 의 `hasLegacyMessages` guard)에 적용한 결과 전부 기존 테스트 스위트를 green 으로 통과시켜, 이 PR 이 표방한 "OR-체인 mutation 커버리지 완결"이 부분적임을 확인했다. 그중 `isCanonicalWaiting` 의 guard 는 실제 프로덕션 시나리오(form/buttons 대기 노드도 `waiting_for_input` 상태를 갖는다)와 직결돼 회귀 위험이 가장 크다. 이 PR 을 차단할 사유는 아니나(현재 동작 자체는 정확하고, 이번 diff 는 순수 테스트 하드닝이라 회귀 위험 없음), 같은 이월(carryover) 패턴으로 후속 작업에 반영할 가치가 있다. 나머지 테스트 격리·가독성·회귀 유효성·mock 적절성은 모두 양호하다.

## 위험도

LOW
