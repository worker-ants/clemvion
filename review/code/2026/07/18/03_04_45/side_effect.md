# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight (03_04_45)

## 조사 방법 / payload 한계 고지

`prompt_file`(2617줄)이 담은 27개 파일은 전부 `review/code/2026/07/18/{01_44_21,02_25_54}/**`·
`review/consistency/2026/07/17/19_46_54/**`·`spec/7-channel-web-chat/2-sdk.md` — 즉 지난 두 라운드의
리뷰 산출물 문서와 spec frontmatter 소변경뿐이며, 이번 라운드가 실제로 검증해야 할 코드 커밋
`94b66b212`(`use-widget.ts`/`use-widget-eager-start.test.ts`)의 diff 자체는 payload 안에 없다.
과거 여러 라운드(01_44_21 scope/security/side_effect 등)에서 반복 관측된 것과 동일한 payload
대표성/truncation 패턴이다. 호출자가 명시적으로 지시한 대로 `git show 94b66b212`로 저장소를 직접
읽어 검증했다.

- `git show 94b66b212 --stat` / `--numstat` : `use-widget.ts` **+1/-1**(1줄 교체), `use-widget-eager-start.test.ts`
  +33/-15. 커밋 메시지 주장(코드 버그 없음, deps 배열 1줄 + 테스트 대칭화)과 파일 스코프가 정확히 일치.
- **격리 검증**: 공유 워크트리(`webchat-boot-single-flight-8c92b4`, 다른 리뷰어 — concurrency/documentation/
  requirement/testing worktree가 동시에 떠 있는 것을 `git worktree list`로 확인)는 읽기 전용으로만 썼다.
  ESLint A/B 비교를 위해 scratchpad 하위에 `git worktree add --detach`로 두 개의 격리 워크트리를 만들어
  (`side-effect-ab-before`=부모 `262ef8e5b`, `side-effect-ab-after`=`94b66b212` 그 자체) 검증 후
  `git worktree remove --force`로 제거, `git status --porcelain`로 공유 워크트리 무변경을 확인했다.
- node_modules는 rsync 실카피 대신 **디렉터리 심링크**로 부트스트랩했다(`codebase/channel-web-chat/node_modules`
  전체를 공유 워크트리로 심링크). pnpm isolated linker의 상대경로 심링크(`eslint -> ../../../node_modules/.pnpm/...`)가
  물리적 부모 경로(공유 워크트리) 기준으로 정상 해석됨을 `realpath`로 먼저 확인한 뒤, `.bin/eslint` 셸 shim이
  아닌 `eslint/bin/eslint.js`를 `node`로 직접 호출해 shim의 비-realpath 경로 계산 이슈를 우회했다. MEMORY의
  "심링크 통짜 금지"는 `next dev`/turbopack 앱 디렉터리 전제라 CLI(eslint) 1회 실행엔 적용되지 않음을 실측
  확인(정상 동작).

---

## 발견사항

- **[정상 확인]** ESLint A/B: `sessionEstablished` dep 누락 경고가 이 커밋에서 실제로 사라짐 — 재현 완료
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:685`(`start()` useCallback deps 배열).
  - 상세: 격리 워크트리에서 `node <eslint 실경로> src/widget/use-widget.ts` 직접 실행 결과:
    - **BEFORE**(부모 `262ef8e5b`, dep 누락 상태): `685:6  warning  React Hook useCallback has a missing
      dependency: 'sessionEstablished'. Either include it or remove the dependency array
      react-hooks/exhaustive-deps` — **1건 재현**.
    - **AFTER**(`94b66b212` 자체, 그리고 현재 `HEAD`=`61e07f3ec`에서 `npx eslint`로 재확인): **0 problems**
      (무출력).
    커밋이 이 파일에서 정확히 1줄(`+1/-1`)만 건드렸고 그 1줄이 바로 이 deps 배열이므로 "경고 소멸"이 이
    diff 자체에 인과적으로 귀속됨을 확인했다. `git diff --stat 94b66b212..HEAD -- use-widget.ts`가 공백(이후
    커밋에서 이 파일 재변경 없음)임도 확인해 현재 HEAD의 "0건" 상태가 이 커밋의 효과임을 재확인했다.
  - 제안: 없음(주장 그대로 실측 검증됨).

- **[정상 확인]** dep 추가가 콜백 재생성 등 부작용을 유발하지 않음 — 이중 근거(정적 안정성 + 실제 소비
  경로)로 확인
  - 위치: `use-widget.ts:325`(`const sessionEstablished = useCallback(() => streamRef.current !== null, [])`),
    `:685`(`start` deps), `:786`(`open = useCallback(..., [start])`), `:844`(`newChat` deps 일부),
    `:914-917`(`apiRef` ref-sync effect, deps 생략 — 매 렌더 갱신), `:956-1085`(마운트 effect, `[]` deps로
    고정 — `apiRef.current.open()`을 브릿지 커맨드 핸들러 안에서 호출).
  - 상세: 두 겹으로 확인했다.
    1. **정적 안정성**: `sessionEstablished`의 deps가 리터럴 빈 배열 `[]`이므로(`streamRef`는 `useRef` —
       항상 동일 객체) React는 이 컴포넌트 인스턴스의 생명주기 동안 이 콜백의 참조를 결코 재생성하지
       않는다. `start`의 memo 판정은 6개 deps 전항목 `Object.is` AND이고, 새로 추가된 항목이 매 렌더 항상
       `true`(변경 없음)로 평가되므로 전체 판정 결과는 나머지 5개 기존 deps(`openStream, persist,
       seedWaitingFromStatus, scheduleRefresh, isStale`)만으로 결정된다 — 이 diff 전후로 `start`의 재생성
       빈도는 **바이트 단위로 동일**하다.
    2. **소비 경로 무관성(반사실적 방어)**: 설사 `start`의 참조가 매 렌더 바뀌었다고 가정해도(가정일 뿐,
       실제로는 위 1.에 의해 불가능), 실제 부작용(webhook `POST` 발행 등)을 자동으로 일으키는 유일한 지점은
       마운트 effect(`:956`) 내부에 등록된 `bridge.onCommand` 핸들러(`apiRef.current.open()`, `:1032`)인데,
       이 마운트 effect 자체가 `[]` deps로 고정돼 있다(`:1085`, "마운트 1회. 핸들러는 ref 기반이라 deps
       생략" 주석 + `eslint-disable-next-line react-hooks/exhaustive-deps`) — `open`/`start`의 identity
       변화와 무관하게 재실행되지 않는다. `apiRef`(`:915`, deps 없이 매 렌더 `apiRef.current = {...}`로만
       갱신)를 통해 "항상 최신 함수를 ref로 읽기" 패턴이 이 자동 호출 경로를 identity 변화로부터 완전히
       절연한다. `open`(`:786`)·`newChat`(`:844`) 자신이 `start`를 deps로 갖는 것은 사실이지만, 이 두
       콜백은 UI 액션/브릿지 커맨드로만 **명시 호출**되지 자동 재실행되는 `useEffect`의 트리거가 아니므로,
       재생성 자체가 곧바로 추가 실행으로 이어지는 경로가 없다.
    파일 전체에 `useEffect`는 정확히 3곳(`:605`, `:915`, `:956`)뿐이며 셋 다 deps 생략(매 렌더 실행,
    하지만 각각 단순 ref 대입뿐이라 무해) 또는 `[]`(마운트 1회) 패턴만 쓴다 — `start`/`open`/
    `sessionEstablished`를 실제 deps 로 갖는 `useEffect`는 하나도 없다.
  - 제안: 없음 — 두 근거 모두 코드 정독·구조 추적으로 확인, 잔여 위험 없음.

- **[정상 확인]** 프로덕션 부작용 표면 무변경 — `use-widget.ts`는 이 diff로 정확히 1줄만 변경(+1/-1)
  - 위치: `git show --numstat 94b66b212` → `1  1  codebase/channel-web-chat/src/widget/use-widget.ts`.
  - 상세: 변경된 유일한 라인은 `start()` useCallback의 deps 배열 자체(`[...], isStale]` →
    `[..., isStale, sessionEstablished]`)이며, 함수 본문·시그니처·export·다른 훅의 deps·import 문·환경
    변수 접근·파일시스템 접근·네트워크 호출 경로 어디에도 이 diff가 닿지 않는다. `useWidget()`의 공개
    인터페이스(반환 shape, `actions` 객체 구성 — `:1091`)도 무변경.
  - 제안: 없음.

- **[정상 확인]** 테스트 전용 변경(대칭 헬퍼 추출)도 전역 상태 격리 계약을 깨지 않음
  - 위치: `use-widget-eager-start.test.ts:1,185-195`(파일 최상단 `beforeEach`/`afterEach` —
    `afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); })`, 이번 diff로 무변경),
    `:3396-3480`부근(`raceStartVsResendSingleStream(resendResolvesFirst)` 헬퍼 추출 + 2개 `it()` 분리).
  - 상세: 기존 단일 테스트(`it()` 안에서 직접 `vi.stubGlobal("EventSource", ...)`·`vi.stubGlobal("fetch", ...)`
    호출)를 공용 async 헬퍼로 추출해, `resendResolvesFirst` 파라미터로 두 방향(C=start 먼저 / D=재전송
    먼저)을 각각 별도 `it()`에서 호출하는 구조로 바꿨다. 헬퍼가 호출될 때마다(=매 `it()`마다) 새로
    `vi.stubGlobal`을 거는데, 파일 전역 `afterEach`가 이 diff로 손대지 않은 채 그대로 유지돼 있어 각
    테스트 종료마다 스텁이 자동 해제된다 — 두 신규 테스트 간, 그리고 파일 내 다른 테스트로의 전역 모킹
    누출 위험 없음. 제거된 지역 변수 `latestEs`는 원본에서도 실제 단언(assertion)에 쓰인 적이 없는 dead
    store였음을 diff 대조로 확인했다(커버리지 손실 아님, 순수 정리).
  - 제안: 없음.

- **[INFO, 이번 커밋 범위 밖]** 테스트 파일에 이 diff와 무관한 기존 eslint 경고 1건 관찰
  - 위치: `use-widget-eager-start.test.ts:657`(`const fetchMock = installFetch(...)` —
    `@typescript-eslint/no-unused-vars`, "W1: webhook 실패 → state.error 는 일반화 문구" 테스트).
  - 상세: A/B eslint 검증 과정에서 부수적으로 함께 관찰됐다 — 부모 커밋(`262ef8e5b`)과 대상 커밋
    (`94b66b212`) 양쪽 모두 **동일하게** 이 경고가 존재한다(이번 diff의 실제 hunk 범위인 3396~3480행과
    무관한 별개 테스트, 657행). 즉 이번 diff로 새로 생기거나 없어진 경고가 아니라 이 브랜치 이전부터
    있던 debt다. 커밋 메시지의 "eslint 클린 재확인"은 이번 fix 대상(`sessionEstablished` dep) 문맥의
    진술로 읽히며, 이 무관한 기존 경고를 반증하지 않는다(별도 파일 전체 스캔을 요구한 진술이 아님).
    이번 커밋의 부작용으로 귀속되지 않으므로 side_effect 판정에는 영향 없음 — 참고용으로만 기록한다.
  - 제안: 이번 fix 범위 밖. 별도 정리 시점(테스트 하우스키핑)에 처리 권장 — 이 리뷰의 위험도 판정에는
    반영하지 않음.

---

## 요약

이번 라운드의 핵심 검증 대상인 `94b66b212`는 두 파일만 건드렸다 — `use-widget.ts`는 정확히 1줄
(`start()` useCallback deps 배열에 `sessionEstablished` 추가)만 변경, `use-widget-eager-start.test.ts`는
직전(02_25_54) 리뷰가 지적한 비대칭 mutation 커버리지 갭을 메우는 대칭 테스트 2개로의 리팩토링(공용
헬퍼 추출, 순수 테스트 전용)이다. ESLint A/B를 격리 워크트리 두 곳(부모 커밋·대상 커밋)에서 직접
재현한 결과, 부모에서는 `685:6 react-hooks/exhaustive-deps` 경고 1건이 존재했고 대상 커밋 및 현재
HEAD에서는 정확히 0건으로 사라졌음을 실측 확인했다 — 호출자가 요청한 "HEAD 0건" 주장이 그대로
성립한다. dep 추가가 콜백 재생성 등 부작용을 유발하는지는 두 겹으로 검증했다: (1) `sessionEstablished`
자신이 빈 deps 배열(`[]`)로 정의돼 마운트 생명주기 동안 참조가 결코 바뀌지 않으므로 `start`의 memo
판정·재생성 빈도는 이 diff 전후로 수학적으로 동일하고, (2) 설령 반사실적으로 참조가 바뀌었다 해도
`start`/`open`의 identity에 반응해 자동으로 재실행되는 `useEffect`가 이 훅에 하나도 없다(유일한 마운트
effect는 `[]` deps + ref 기반 최신값 읽기 패턴으로 identity 변화로부터 절연돼 있다) — 이중 방어 구조라
실질적 위험이 없다. 테스트 리팩토링도 파일 전역 `afterEach(unstubAllGlobals/restoreAllMocks)` 계약을
건드리지 않아 두 신규 테스트 간·다른 테스트로의 전역 모킹 누출 위험이 없고, 제거된 지역 변수는 원래도
미사용 dead store였다. 부수적으로 이 diff와 무관한 기존 eslint 경고(`fetchMock` unused, 657행,
부모·대상 커밋 양쪽에 동일 존재)를 관찰했으나 이번 커밋 범위 밖으로 판정 근거에서 제외했다. 전역 변수·
환경 변수·파일시스템·네트워크·공개 인터페이스 표면에 이 커밋이 닿는 지점은 없다. 신규 CRITICAL·
WARNING 없음.

## 위험도

NONE
