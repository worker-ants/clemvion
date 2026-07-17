# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight

세션: `review/code/2026/07/17/17_48_20` · 브랜치 `claude/webchat-boot-single-flight-8c92b4`

## 사전 고지 — 리뷰 범위 재확정

`_prompts/maintainability.md` 는 37개 파일 diff 를 담고 있지만, `git merge-base`/`git log`/`git diff --stat`
로 직접 재확인한 결과 그중 31개(파일 1~12, 17~21, 23 이후 다수 — `.claude/_shared/**`, harness
orchestrator, sidebar 테스트, 과거 review 세션 산출물)는 **이 브랜치가 만든 변경이 아니다**. 이 세션
생성 1분 전 `origin/main` 에 병합된 무관 PR(#966, 하네스 report-path 공유화)이 2-dot diff 계산에
잘못 끌려온 것 — 같은 세션의 `scope.md` 가 이미 CRITICAL 로 동일 결론을 실측·기록해 두었다(타임라인
`14bc86a53`→17:46:17 커밋 4개, `origin/main` 은 17:47:29 에 #966 흡수, 세션 생성 17:48:20).

이 브랜치의 **진짜 diff**(merge-base `14bc86a53` 기준, 3-dot)는 6개 파일뿐이다:

- `codebase/channel-web-chat/src/lib/widget-state.ts`
- `codebase/channel-web-chat/src/lib/widget-state.test.ts`
- `codebase/channel-web-chat/src/widget/use-widget.ts`
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
- `plan/in-progress/webchat-boot-single-flight.md`
- `spec/7-channel-web-chat/2-sdk.md`

아래 유지보수성 판단은 이 6개 파일에 대해서만 내린다. 나머지 31개(특히 `.claude/_shared/report_paths.py`
삭제로 인한 3중 중복 재도입)는 이 PR 저자의 작업이 아니므로 유지보수성 결함으로 귀속하지 않는다 —
다만 세션을 고정 merge-base 로 재생성하지 않은 채 그대로 진행하면 이미 완료된 DRY 정리(#966)가
조용히 되돌려질 수 있다는 점만 환기해 둔다(조치는 `scope.md` CRITICAL 항목 소관).

## 발견사항

### Q1 — "축 누락 가드는 타입 검사로 막힌다"는 주장, 실측 검증

- **[WARNING]** `beginBootAttempt`/`isAttemptStale` JSDoc 의 "`isStale(gen)` 은 컴파일되지 않는다(축
  누락 가드를 타입 검사가 막는다)"는 주장은 **`gen` 이라는 특정 식별자를 재사용하는 경우에만** 참이다.
  구조적으로 동등한 다른 실수는 조용히 컴파일을 통과한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:254-256`(`beginBootAttempt` JSDoc의
    해당 주장), `:833-834`(`applyConfig` 호출부의 동일 주장 반복), `:262`(`beginBootAttempt` 반환
    타입 `{ world: number; boot: number }`, branding 없는 순수 number), `:241`(`isStale(gen: number)`).
  - 상세: 스크래치 디렉터리에서 이 파일과 동일한 타입 형태를 재현해 `tsc --strict --noEmit` 으로
    직접 검증했다(project `node_modules/.bin/tsc` 사용).
    - `isStale(gen)`(제거된 로컬 변수 그대로 참조) → **`TS2304: Cannot find name 'gen'`** 로 컴파일
      실패. 이 주장 자체는 사실이다.
    - 그러나 다음 세 줄은 모두 `tsc --strict` 를 **통과한다**(실측 exit code 0):
      - `if (isStale(attempt.world)) return;` — boot 축을 빠뜨린 가드. **정확히 이 리팩터가 막으려던
        버그 클래스**(비대칭 가드 누락 — 이 파일이 3번 CRITICAL 을 낸 그 계열)를 재현할 수 있다.
      - `if (isStale(worldGenRef.current)) return;` — await 뒤 시점의 "현재 값"을 그대로 넣어 자기
        자신과 비교하는 실수. `worldGenRef.current !== worldGenRef.current` 는 항상 `false` — 가드가
        **조용히 무력화**된다(컴파일 에러보다 나쁘다. 눈에 띄지 않기 때문). `isStale(gen)` 이 컴파일
        에러를 낼 때 "gen 대신 뭘 넣지?" 하며 가장 손쉽게 떠오르는 "수정"이 바로 이 형태라서, 실제로
        벌어질 법한 실수 경로다.
      - `if (isStale(attempt.boot)) return;` — 축 자체가 다른 값끼리 비교(world vs boot). 의미 없는
        비교지만 타입은 맞는다.
    - 즉 "컴파일되지 않는다"는 보호는 `worldGenRef`/`bootGenRef` 자체가 `applyConfig` 스코프 밖으로
      밀려난 구조적 차단이 아니라, **`gen` 이라는 로컬 변수가 우연히 없다는 사실**에 기대고 있다.
      `worldGenRef`(`use-widget.ts:161`)는 `isStale`/`beginBootAttempt`/`isAttemptStale` 과 마찬가지로
      `useWidget()` 클로저 안에 있으므로 `applyConfig` 에서 언제든 직접 읽을 수 있다(실제로
      `teardownSession`/`start()` 는 그렇게 한다) — Q에서 물은 "누군가 `applyConfig` 안에서
      `worldGenRef.current` 를 직접 읽으면?"은 문법적으로도 항상 가능하고, 위 실측대로 **의미까지
      깨뜨리며 컴파일된다.**
  - 제안: 이 파일의 원칙("가드는 규율이 아니라 구조") 자체를 재확인하는 차원에서, JSDoc 이 이 한계를
    스스로 명시하는 편이 안전하다 — 예: "이 보호는 `gen` 식별자 재사용만 막는다. `attempt.world`/
    `attempt.boot` 를 꺼내 `isStale` 에 넘기거나 `isStale(worldGenRef.current)` 처럼 새로 쓰면 컴파일은
    통과하지만 가드가 무력화되거나 축이 빠진다 — 리뷰에서 `applyConfig` 함수 본문 안의 `isStale(` 호출을
    grep 으로 잡을 것." 더 강한 구조적 차단(예: `applyConfig` 스코프 안의 `isStale(` 호출을 금지하는
    `no-restricted-syntax` ESLint 규칙)도 가능하나, `eslint.config.mjs` 는 현재 next 프리셋만 쓰고
    커스텀 규칙이 없어 새 인프라 도입 비용이 있다 — 이 파일의 기존 관례(문서+리뷰 프로세스)로도 지금까지는
    작동해 왔으므로 필수로 요구하지는 않는다.

### Q2 — `isStale` vs `isAttemptStale` 네이밍

- **[INFO]** 두 predicate 를 서로 바꿔 호출하는 실수는 **파라미터 타입이 달라(`number` vs
  `{world: number; boot: number}`)** 즉시 컴파일 에러가 난다 — 이 방향은 견고하다. 다만 이름 쌍의
  "일반성"이 실제 커버리지와 반대로 읽힐 여지가 있다: 더 짧고 범용적으로 들리는 `isStale` 이 실은
  **좁은(world 1축)** 체크이고, 더 길고 한정적인 `isAttemptStale` 이 `applyConfig` 문맥에서는 **더
  완전한** 체크다. 처음 보는 사람이 "짧은 이름 = 기본값/더 일반적인 것"이라는 직관으로 `isStale` 을
  집어 들면, 그 직관이 Q1 의 `isStale(attempt.world)` 실수로 그대로 이어질 수 있다.
  - 위치: `use-widget.ts:241`(`isStale`), `:265-270`(`isAttemptStale`).
  - 상세: JSDoc(정의부)과 호출부 주석이 축 범위를 계속 상기시켜 실질 위험은 낮게 관리되고 있다. 다만
    이름만으로는 축 범위를 읽어낼 수 없다는 점은 그대로다.
  - 제안: 필수는 아니나, 여유가 되면 `isStale` → `isWorldStale` 로 개명해 두 이름의 한정어 수준을
    맞추는 것을 고려할 수 있다(그러면 "어느 쪽이 더 넓은가"를 이름만으로 답할 필요가 없어진다).
    호출부가 `start`/`sendCommand`/`seedWaitingFromStatus`/`useTokenRefresh` 주입까지 4곳이라 이번
    PR 범위로 강제하기보다 후속 정리 후보로 남겨두는 편이 적절하다.

- **[INFO]** `establishConfig` 라는 최종 함수명이 plan 원안보다 책임 범위를 덜 드러낸다.
  - 위치: `use-widget.ts:809`(`const establishConfig = useCallback(...)`) vs
    `plan/in-progress/webchat-boot-single-flight.md:99`("이름 후보: `establishConfigAndConsumeReset
    (cfg): 'reset' | 'continue'`").
  - 상세: 이 함수는 config 확립 **그리고** 대기 중이던 리셋 소비, 두 가지를 한 번에 한다. 후자가 오히려
    이 함수를 비-async 로 유지해야 하는 핵심 이유(§B, "설계 방향" 참조)인데, 최종 이름은 전자만
    가리킨다. JSDoc 첫 줄과 반환 타입(`"reset" | "continue"`)이 보완하지만, 시그니처만 보이는 상황
    (IDE 자동완성 등)에서는 이름이 책임을 과소 대표한다.
  - 제안: 선택 사항 — plan 원안대로 개명하거나, 짧은 이름을 유지한다면 함수 선언부 바로 위 한 줄
    요약을 지금보다 더 앞에 배치해 hover 미리보기에서 곧바로 보이게 하는 정도로 충분하다.

### Q3 — 주석 밀도: 대체로 정당하나, 이번 diff 가 인접 주석을 낡게 만든 사례가 있다

- **[WARNING]** `widget-state.ts` 의 `WAITING` case 주석(이번 diff 가 건드리지 않은 기존 코드)이 이번
  diff 로 인해 사실과 어긋나게 됐다.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:155-159`(기존, 미변경) vs `:126-136`
    (`RESTORED`, 이번 diff 신설) · `:138-142`(`BOOTED`, 이번 diff 신설).
  - 상세: `WAITING` 케이스 주석은 "가드 범위는 WAITING 뿐이다 — `RESTORED`/`BOOTED`/`USER_MESSAGE`
    도 `state.phase` 를 검사하지 않고 무조건 전이하므로, 'ended 를 벗어나는 액션'의 리듀서 레벨
    불변식은 아직 없다"고 말한다. 그런데 바로 이 diff 가 `RESTORED`/`BOOTED` 에
    `if (state.phase === "ended") return state;` 가드를 추가했다(plan §A-6, mutation 으로 검증됨) —
    이제 이 문장은 `USER_MESSAGE` 에 대해서만 참이고 `RESTORED`/`BOOTED` 부분은 거짓이다. 코드 자체는
    올바르지만, 옆의 설명이 낡았다 — 이 파일 전체가 "왜"를 코드 옆에 남기는 것을 핵심 전략으로 삼는
    만큼 이런 드리프트는 그 전략의 신뢰도를 깎는다(정확히 harness 쪽 `report_paths.py` 삭제 diff가
    스스로 경계하는 "손복사 설명이 하나만 바뀌면 나머지가 조용히 낡는" 패턴과 같은 종류).
  - 제안: `WAITING` 주석의 해당 문장을 "`RESTORED`/`BOOTED` 는 A-6 로 가드됨(§136·§142), `USER_MESSAGE`
    만 아직 무조건 전이"로 갱신할 것. 한 줄 수정이라 이번 PR 에 포함하는 편이 다음 라운드로 미루는
    것보다 싸다.

- **[INFO]** `beginBootAttempt` JSDoc(`:254-256`)과 `applyConfig` 호출부 인라인 주석(`:833-834`)이
  "`gen`(world 단독)을 스코프에 두지 않아 `isStale(gen)` 이 컴파일되지 않는다"는 설명을 사실상 그대로
  반복한다. 정의부에 상세 근거, 호출부에 요약 리마인더를 두는 이 파일의 기존 관례와 일치해 새로운
  안티패턴은 아니지만, Q1 에서 지적한 과장된 확신이 두 곳에 복제돼 있다는 점은 부담이다. 이번 diff 가
  추가한 순수 주석량(대략 70줄 안팎)이 실제 로직 변경량(15~20줄)을 크게 웃돈다 — 3회 CRITICAL 이력을
  감안하면 비율 자체는 정당화되지만, `useWidget()` 훅이 이미 823줄(파일 전체 957줄)에 달해 이 파일이
  과거 한 차례 분리했던 것처럼(`useTokenRefresh`/`usePendingMessageQueue`, PR #746 "God hook 분리")
  `worldGenRef`/`bootGenRef`/`isStale`/`isAttemptStale`/`beginBootAttempt` 를 별도 훅으로 뽑아 독립
  단위로 테스트·문서화하는 방안은 장기적으로 검토할 가치가 있다. 다만 `teardownSession`/`start()`/
  unmount cleanup 등 여러 콜백이 `worldGenRef` 를 직접 mutate 하는 구조라 인터페이스 설계가 간단치
  않으므로 이번 PR 의 범위로 요구하지는 않는다.
  - 위치: `use-widget.ts:161-270`(가드 축 선언·predicate 군집), 파일 전체(957줄).
  - 제안: 향후 별도 작업으로 추출 검토. 이번 PR 은 현행 유지로 충분.

### Q4 — `guardedAwait` 미채택 근거(plan §A-0) 타당성

- **[INFO]** 미채택 판단 자체는 타당하다. 다만 plan/JSDoc 의 "구조로 강제" 프레이밍이 A 와 B 의 방어
  강도 차이를 가린다.
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:75-91`(A-0 문제 제기) · `:136-141`(A-0
    결정 기록, 특히 `:139` "B 가 쓰려던 '구조로 강제'를 A 에도 적용한 셈").
  - 상세: 토큰 캡슐화(채택안)는 "호출부가 축 개수를 몰라도 된다"는 실제 요구를 `guardedAwait` 만큼
    충족하면서, 이미 10라운드 리뷰를 통과한 `await → if (...) return;` 제어 흐름을 그대로 보존한다.
    `guardedAwait` 는 sentinel/throw 기반의 새 제어 흐름 추상을 도입해야 했을 것이고, 그 자체가 다시
    학습·리뷰 대상이 됐을 것이다. "축이 늘어도 predicate 한 곳만 바뀐다"는 확장성 논거도 두 방식이
    사실상 동등하다. 결정과 근거를 코드 이전에 plan 에 선기록한 순서(A-0 → A-1 → A-2)도 이 프로젝트의
    "결정 배경 기록" 관례에 부합한다 — 여기까지는 타당한 판단이다.
    그런데 Q1 에서 실측했듯 **B(`establishConfig` 비-async, `TS1308`)는 무조건적·견고한 컴파일 차단**
    인 반면 **A(`isStale(gen)` 미스코프)는 `gen` 식별자 재사용만 막는 국지적 차단**이라 방어 강도가
    다르다. plan 이 둘을 "구조로 강제"라는 같은 표현으로 묶으면, 다음에 이 파일을 만지는 사람이 "축
    가드도 B 급으로 안전하다"고 과신할 수 있다.
  - 제안: plan 및 JSDoc 에 "A 의 컴파일 차단은 B 의 `TS1308` 만큼 무조건적이지 않다"는 caveat 한 줄
    추가 — Q1 제안과 동일한 수정으로 함께 해소된다(별도 작업 불필요).

### 일반 체크리스트

- **[INFO]** `use-widget-eager-start.test.ts` 의 두 "혼합 순서" 테스트(겹친 부팅의 결과가 갈릴 때 /
  나중 진입이 차단으로 먼저 끝날 때, 각 80줄 안팎)는 fetch mock·EventSource 설치 보일러플레이트가
  거의 동일하다. 다만 주석(`:2346-2358`)이 "왜 둘 다 필요한지(서로 다른 mutation 을 잡는다)"를 명시해
  두어 테스트 **케이스** 자체의 중복이 아니라 **셋업 코드**의 중복이다. 이 저장소는 같은 종류의
  트레이드오프(`sidebar-test-utils.tsx` 관련 vitest 호이스팅 제약으로 mock 팩토리 추출을 포기한 전례,
  `plan/complete` 쪽 harness followups 문서 §5)를 이미 명시적으로 받아들인 바 있어, 이런 중복을
  의도적으로 감수하는 경향이 있는 것으로 보인다. 우선순위 낮은 관찰로만 남긴다. 위치:
  `use-widget-eager-start.test.ts:2277-2441` 부근.
- **[INFO]** 함수 길이/중첩/매직넘버: 이번 diff 로 새로 추가된 함수(`beginBootAttempt`,
  `isAttemptStale`, `establishConfig`)는 모두 짧고 단일 표현식 또는 10줄 내외다. `applyConfig` 는
  `establishConfig` 추출로 오히려 순수 코드 라인이 줄었고(로직이 이동), 중첩 깊이도 최대 2로 낮다.
  매직 넘버는 없다.
- **[INFO]** 일관성: 새 코드는 `useRef`+`useCallback` 가드 관용구, "ai-review `<날짜>` `<라운드>`
  `<항목>`" 인용 패턴, "최후 방어선"/"defense-in-depth" 표현을 기존 코드와 동일하게 재사용한다 —
  스타일 이탈이 없다. `widget-state.test.ts` 의 신규 `it.each` 2케이스도 기존 `reduce` 헬퍼·패턴을
  그대로 따른다(RESTORED/BOOTED 를 위해 거의 동일한 `it()` 을 복사하지 않고 파라미터화한 점은 오히려
  좋은 예).

## 요약

이 브랜치의 실제 diff(6파일)는 `applyConfig` 동시성 가드에 `bootGenRef` 축을 추가하면서, 이 파일이
3차례 CRITICAL 을 낸 "비대칭 가드 누락" 패턴을 토큰 캡슐화(`beginBootAttempt`/`isAttemptStale`)와
비-async 추출(`establishConfig`)로 구조화하려 시도했고, mutation 테스트·plan 문서화·기존 관례 준수
수준이 전반적으로 높다. 다만 `tsc --strict` 로 직접 검증한 결과, 핵심 안전 주장("축 누락 가드는 타입
검사로 막힌다")은 `gen` 식별자 재사용이라는 좁은 사례에만 유효하고, `attempt.world`/
`worldGenRef.current` 를 직접 `isStale` 에 넘기는 구조적으로 동등한 실수는 여전히 조용히 컴파일을
통과한다 — 이 파일 자신의 원칙("가드는 규율이 아니라 구조")에 비춰 문서의 확신도가 실제 보호 수준을
앞서 있다. 또한 `RESTORED`/`BOOTED` 에 종료-가드를 추가하면서, 인접한 `WAITING` 케이스의 기존 주석이
이제 사실과 어긋나게 됐다. 두 사안 모두 코드 동작 자체의 결함은 아니며(테스트 스위트 통과, 실제 버그
비유발) 문서-현실 간극이라는 점에서 유지보수성 범주의 정정 대상이고, 둘 다 한두 줄 수준의 저비용
수정으로 해소된다. `isStale`/`isAttemptStale` 네이밍 비대칭과 `establishConfig` 네이밍은 타입 안전망이
있어 실질 위험은 낮은 INFO 수준이며, `guardedAwait` 미채택 판단 자체는 근거가 견고하다. 참고로 이
리뷰 세션 페이로드에는 이 브랜치와 무관한 31개 파일(#966 stale-base 오염, `scope.md` 가 CRITICAL 로
별도 확인)이 섞여 있어 그 부분은 본 보고서의 판단에서 제외했다.

## 위험도

MEDIUM

(근거: 실제 신규 코드에 기능적 결함은 없고 테스트·문서화 수준도 높지만, 이 파일의 반복된 실패 계열과
직결된 안전-주장의 정밀도 문제(Q1)와 인접 주석 드리프트(Q3 첫 항목)가 실재해 정정이 필요하다. 둘 다
국소적이고 저비용으로 해소 가능해 HIGH/CRITICAL 로는 올리지 않는다. 리뷰 페이로드 자체의 stale-base
오염은 `scope.md` CRITICAL 로 이미 다뤄지고 있어 본 등급에는 반영하지 않았다.)
