# 테스트(Testing) Review — 🔎 `rag` 행 신설 (최종 라운드, delta: b1698d538)

## 방법론

1회차 CRITICAL 2건(CT-S18(e) 부재, Inv-9 부재)의 fix 를 정적 리뷰로만 확인하지 않고, 실제로
`vitest run` 을 baseline 통과 → 프로덕션 코드에 의도적 mutation 주입 → 동일 테스트 재실행 →
red/green 관찰 → mutation 되돌림(clean revert 확인) 순서로 **경험적으로 검증**했다. 아래 발견의
근거는 이 재현 결과다.

## 발견사항

- **[CRITICAL]** Inv-9 테스트(`result-detail.test.tsx`)가 🔎 행(`RagRetrievalRow`)의 문서명
  **동일성**을 실제로는 검증하지 않는다 — chunk **개수**만 검증한다
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx:169-179` (Inv-9 `it` 블록)
  - 재현 (실측): `conversation-inspector.tsx` 의 `RagRetrievalRow` 에서 `sources` 계산을
    `item.rag?.sources ?? []` 대신 **길이(2)는 같지만 이름이 다른 decoy 배열**
    (`decoy1.md`/`decoy2.md`)로 바꿔치기하는 mutation 을 주입한 뒤:
    - `result-detail.test.tsx -t "Inv-9"` → **2 passed, 0 failed** (아무 것도 안 깨짐)
    - `src/components/editor/run-results` 전체(264개 테스트) → **264 passed** (다른 테스트도 전혀 못 잡음)
    mutation 을 되돌리면 다시 baseline(49 passed) 로 복귀함을 확인. 즉 🔎 행이 References 탭·
    turnRefIndex 와 **완전히 다른 문서**를 보여줘도 전체 스위트 어디서도 red 가 되지 않는다.
  - 원인 분석: 현재 3개 assertion 이 검증하는 대상이 실제로는 서로 다른 소스다.
    - ① `KB · 2개 청크` — `RagRetrievalRow` 의 `sources.length` 만 반영 (내용 무관, count 만 검증됨 — 이건 실제로 동작함, decoy 로 개수를 바꾸면 잡힌다)
    - ② `getAllByTitle("참조 탭에서 보기")` — `chips.length > 0` 만 확인, **두 chip(🔎 행 내부 chip
      vs assistant 버블 하단 chip) 중 어느 것의 텍스트 내용도 검사하지 않음**
    - ③ References 탭 클릭 후 `"환불.md"`/`"약관.md"` — 이건 `turnRefIndex` (References 탭·버블
      하단 chip 이 공유하는 소스) 에서 나온 것이라, 정작 **RagRetrievalRow 자신이 무엇을 보여주는지는
      한 번도 assert 되지 않는다**
    - 다시 말해 "🔎 행 자체의 문서명"과 "References 탭의 문서명"을 직접 비교하는 assertion 이
      test 안에 없다 — count 일치와 References 탭 정확성은 검증되지만, **Inv-9 이 pin 하려는
      "🔎 행 ↔ References 탭 identity" 축은 비어 있다.**
  - **검증된 수정안** (동일 mutation 에 대해 red 로 전환됨을 실측):
    ```ts
    // ② 다음에 추가 — 탭 전환 *전*에 실행해야 한다 (References 탭 클릭 시
    // Preview 탭 DOM 이 unmount 되어 🔎 행 chip 이 사라짐 — 실측 확인).
    // 🔎 행 chip 과 📚 chip(버블 하단) 둘 다 "환불.md · 약관.md" 를 보여줘야
    // Inv-9 이 성립 — RagRetrievalRow 가 다른 소스를 쓰면 이 매치 수가 준다.
    expect(
      screen.getAllByText(/환불\.md · 약관\.md/).length,
    ).toBeGreaterThanOrEqual(2);
    ```
    baseline(정상 구현)에서 2 matches → green, decoy mutation 주입 시 1 match →
    `expected 1 to be greater than or equal to 2` 로 정확히 실패함을 실측 확인했다. (탭 전환
    후에 넣으면 Preview 탭 컨텐츠가 이미 unmount 되어 `getAllByText` 가 0 matches 로 예외를
    던진다 — 반드시 ②와 같은 위치, 탭 클릭 이전에 넣어야 한다.)
  - 제안: 위 assertion (또는 동등하게 `within(ragRow)`/`within(chip)` 스코프로 문서명을 직접
    비교하는 assertion) 을 Inv-9 테스트에 추가. RESOLUTION.md 가 "Critical 3건 전부 해소" 로
    기록했지만, 이 항목은 테스트가 **존재는 하되 주장하는 불변량을 실제로 pin 하지 못하는** 상태라
    아직 완전히 닫히지 않았다.

- **[INFO]** CT-S18(e) 는 반대로 진짜로 동작한다 — 대조군으로 동일 방법 재현
  - `conversation-timeline-item.tsx` 의 rag 분기 텍스트를 decoy 로 바꿔치기하면
    `result-timeline.test.tsx -t "CT-S18"` 가 정확히 `screen.getByText(/환불\.md · 약관\.md/)`
    라인에서 `Unable to find an element` 로 즉시 red 가 됨을 실측 확인(원복 완료). 이 테스트는
    정공법 — 문서명을 값으로 직접 비교한다. Inv-9 테스트도 같은 패턴(값 비교)을 쓰면 위 CRITICAL
    이 해소된다.

- **[INFO]** (c) "CT-S18(e) 가 양 surface 동시성을 검증하는가" — 답: **개별 검증, 동시(단일
  render) 검증은 아님**. 이는 실질적 결함이 아니라고 판단해 조치 불요로 처리한다
  - `ResultTimeline`(사이드바) 과 `ResultDetail`(메인 패널)은 실제 앱에서도 서로 다른 최상위
    컴포넌트이며, 두 surface 를 한 테스트에서 동시에 mount 하려면 이 둘을 호스팅하는 상위
    패널 컴포넌트까지 렌더해야 한다 — 이는 이 두 unit 테스트 파일의 기존 스코프(각 컴포넌트
    단위)를 벗어난다. CT-S18(e) 는 `result-timeline.test.tsx` 에서 timeline surface 를,
    Inv-9 는 `result-detail.test.tsx` 에서 Preview/References surface 를 각각 독립적으로
    커버 — spec §9.10 표가 요구하는 "1차 테스트 파일" 3개(conversation-utils.test.ts +
    result-detail.test.tsx + result-timeline.test.tsx) 조합과 일치한다. "동시" 는 "두 surface
    모두 개별적으로 보장된다"는 의미로 해석하는 것이 기존 테스트 아키텍처와 정합적이다.

- **[INFO]** CT-S18 (b)(3중 신호 모두 다름) · (c)(`groupToolCallItems` 가 `rag` 를 claim 하지
  않음) 는 여전히 전용 assertion 없이 간접적으로만 뒷받침됨 — 이번 라운드 필수 아님
  - (b): 아이콘(Search vs Wrench)·컨테이너(dashed vs solid)·chip 텍스트가 다른 렌더 함수/분기이므로
    구조적으로 자동 충족되나, class/아이콘 자체를 assert 하는 테스트는 없다. RTL 관례상 스타일
    class 를 직접 assert 하는 경우가 드물어 이 프로젝트에서 강제할 필요는 낮다.
  - (c): `mergeRagRetrievalItems` 는 항상 **턴의 첫 assistant 앞**에 `rag` 항목을 삽입하므로
    (`conversation-utils.ts:958-` 부근 로직), `groupToolCallItems` 의 child-스캔 구간
    (parent assistant 이후) 에는 애초 `rag` 항목이 들어갈 수 없다 — spec 이 우려하는 "rag 가
    도구 child 를 밀어내는" 시나리오는 현재 삽입 위치 설계상 구조적으로 발생 불가능하다. 따라서
    `groupToolCallItems` 레벨에 `rag`+`tool` 혼합 배열을 직접 넣는 회귀 테스트가 없어도 위험은
    낮다 — 다만 향후 삽입 위치 로직이 바뀌면 이 가정이 깨지므로, 그때는 반드시 전용 테스트가
    필요하다는 점을 코드 주석에 남겨두는 정도가 적당하다 (이번 라운드 필수 아님).

- **[INFO]** fixture 이관(`ctS18RagAndToolSameTurn`/`ctS19NoTurnDebug` → `conversation-scenarios.ts`)
  은 §9.10 규약과 정합
  - `conversation-utils.test.ts` 는 CT-S1~S17 시절부터 `conversation-scenarios.ts` 를 한 번도
    import 하지 않았다(그 파일은 `ConversationItem[]`/`TurnRagDelta[]` 저수준 순수함수 입력을
    직접 리터럴로 구성 — `outputData` wire 포맷과 다른 레이어). 이번 이관은 `result-detail.test.tsx`/
    `result-timeline.test.tsx` 가 실제로 import 하는 `outputData` 포맷 fixture 만 단일화했고
    이는 기존 CT-S15/16/17 패턴과 정확히 일치한다 — 1회차에서 "conversation-utils.test.ts 도
    같은 fixture import" 로 제안했던 부분은 재확인 결과 기존 관례와 안 맞아 과잉 요구였다.
    이번 스코프 판단이 맞다.

## 요약

1회차 CRITICAL 2건 중 CT-S18(e)(실행 트리 timeline 노출)는 `result-timeline.test.tsx` 에 신설된
테스트가 실제로 값 비교 방식(`getByText(/환불\.md · 약관\.md/)`)으로 검증하고 있음을 mutation
주입으로 실측 확인했다 — 완전히 해소됐다. 반면 Inv-9(🔎 행·📚 chip·References 탭 `sources[]`
동일성)는 테스트가 새로 생겼지만, 세 표면 중 정작 **🔎 행 자신의 문서명 내용은 한 번도 값으로
비교되지 않는다** — chunk 개수(①)와 References 탭 정확성(③)만 검증되고, 그 사이를 잇는 identity
assertion 이 빠져 있다. `RagRetrievalRow` 가 다른 소스를 쓰도록 실제로 코드를 깨뜨려 봤더니
`src/components/editor/run-results` 디렉터리의 264개 테스트 전부가 통과했다 — 즉 이 라운드가
"해소"로 선언한 Inv-9 회귀 방지가 현재는 이름만 있고 실효가 없다. 검증된 한 줄짜리 수정안
(`getAllByText` 로 🔎 행·📚 chip 두 곳의 문서명이 실제로 일치하는지 개수까지 비교)을 제시했으며,
이 수정 없이는 향후 누군가 `RagRetrievalRow` 를 리팩터링해 별도 소스를 참조하게 만들어도 어떤
자동 테스트도 잡아내지 못한다. 나머지 항목(CT-S18 (b)(c), surface 동시성 해석, fixture 이관
스코프)은 실측 결과 이번 라운드에서 추가 조치가 필요하지 않다고 판단했다.

## 위험도

CRITICAL — 위 Inv-9 assertion 보강 전까지는 이 라운드가 닫으려던 CRITICAL #3 이 실질적으로
열려 있는 상태(테스트는 있으나 무력)로 남는다. 나머지는 조치 불필요.
