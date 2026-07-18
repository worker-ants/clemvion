# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight (01_44_21)

## 사전 확인 — payload 한계

`prompt_file` 에 실린 diff 3건(`review/consistency/.../plan_coherence.md`·`rationale_continuity.md` 신규 파일,
`spec/7-channel-web-chat/2-sdk.md` frontmatter 4줄)은 **오케스트레이터가 지정한 "이번 라운드 핵심"인
되감기 방어 재설계(`cffee0d28`, `codebase/channel-web-chat/src/widget/use-widget.ts`)를 포함하지 않는다**
— `plan_coherence.md` 자신이 보고한 것과 같은 종류의 payload 크기 제한으로 보인다. 리뷰 목적(재설계
평가)을 충족하기 위해 payload 를 신뢰하지 않고 worktree 를 직접 조사했다:

- `git show cffee0d28`(`use-widget.ts`·`use-widget-eager-start.test.ts` diff 전문), `git log -S`(문구
  최초 도입 커밋 추적), 현재 `use-widget.ts`(1087줄) 전문 Read.
- `plan/in-progress/webchat-boot-single-flight.md`(400줄) 전문 + `webchat-usewidget-extraction.md` 전문.
- 직전 라운드 산출물 `review/code/2026/07/18/00_51_53/{maintainability,RESOLUTION}.md` 대조(이번 재설계가
  그 라운드의 WARNING 을 실제로 해소했는지 검증하기 위함).
- 실측: `npx tsc --noEmit`(clean) · `npx eslint src/widget/use-widget.ts`(clean) ·
  `npx vitest run src/widget/use-widget-eager-start.test.ts`(58 passed).

## 발견사항

- **[WARNING]** `beginBootAttempt` JSDoc 의 "3번 CRITICAL" 이력 카운트가 여전히 stale — 직전 라운드
  WARNING 이 미해소인데 `RESOLUTION.md` 는 "fix(전면 재작성)"로 기록
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:260-263`(`beginBootAttempt` JSDoc 본문) ·
    비교 대상 `review/code/2026/07/18/00_51_53/maintainability.md:13-27`(직전 라운드가 낸 WARNING) ·
    `review/code/2026/07/18/00_51_53/RESOLUTION.md:33-34`(해소 claim)
  - 상세: 직전 라운드(`00_51_53`) maintainability 리뷰는 "이 파일이 **비대칭 가드 누락으로 3번
    CRITICAL 을 냈다** — 한 호출부는 재검증하고 다른 호출부는 빠뜨리는 형태(`02_04_13` C1 · `08_29_33`
    W2 · `09_36_01` W5)" 라는 JSDoc 문장이, 바로 그 재발(같은 실패 유형의 `18_39_11`→`23_58_23`)을
    빠뜨려 "이 설계가 실제로 막아낸 범위"에 대한 독자 기대치를 낙관적으로 왜곡한다고 지적하고, "사례
    목록에 `23_58_23`(및 `18_39_11`)을 추가해 카운트를 갱신할 것"을 제안했다. `RESOLUTION.md` 는 이를
    "**fix** — 재설계에서 JSDoc 전면 재작성(거울상 카운트 서술 자체를 없애고 `sessionEstablished` 가
    진짜 불변식 으로 대체)"라고 기록했다. 그러나 `git show cffee0d28`(diff 전문, 위 investigate 로 확보)
    를 대조한 결과 이 문단(260-263행)은 **diff hunk 바깥의 미변경 컨텍스트**다 — `cffee0d28` 이 실제로
    건드린 곳은 같은 JSDoc 블록의 **다른 단락**(276-281행, `*(bootGenRef` 는 ... 로 시작하는 부분)뿐이고,
    거기서도 "3번" 이라는 숫자나 그 나열 자체는 등장하지 않는다(별개 서사 — "boot 세대는 proxy 였고 두
    번 구멍이 났다(18_39_11/00_51_53)"). `git log -S"비대칭 가드 누락으로 3번 CRITICAL"` 로 최초 도입
    지점을 추적하면 이 문구는 이 plan 의 **첫 커밋**(`d64f60243`)에서 작성된 뒤 이후 12개 커밋(본
    재설계 포함)을 거치는 동안 **한 번도 수정되지 않았다** — 즉 "카운트 서술 자체를 없앴다"는 claim 은
    실제 코드와 일치하지 않는다. 23_58_23 CRITICAL 은 (정확히 이 문단이 경고하는 패턴대로) `applyConfig`
    복원 분기만 boot 토큰으로 가드되고 `start()` 호출부가 무방비였던 사례이므로, "3번" 나열에 포함되지
    않은 것은 실질적 undercount 다. 코드 동작에는 영향이 없으나(순수 주석), 이 파일은 "같은 실패를 몇
    번 겪었는가"를 인라인 카운트로 추적해 재발을 막는 관행에 크게 의존하는 곳이고, 이번처럼 **해소
    claim 자체가 실측과 어긋나면** 다음 라운드가 "이미 처리됨"으로 오인해 재검증을 건너뛸 위험이 있다.
  - 제안: (a) 260-263행의 나열에 `18_39_11`/`23_58_23` 을 추가해 실제 재발 이력과 맞추거나, (b) 그
    사례들을 "비대칭 가드 누락"이 아니라 별개 실패 클래스(boot-axis proxy 자체의 의미 불일치)로 판단해
    의도적으로 제외했다면 그 구분을 한 줄로 명시할 것 — 침묵은 누락과 구분되지 않는다. 아울러 이
    plan 이 `complete/` 로 이동하기 전에 `RESOLUTION.md` 의 "전면 재작성" 서술을 실제 변경 범위(276-281행
    단락 추가, 260-263행은 미변경)에 맞게 정정할 것을 권고한다.

- **[INFO]** 재설계(boot 축 proxy → `sessionEstablished()` 직접 불변식) 는 실질적인 단순화이며, 세
  호출부 규칙이 명확하고 양방향 mutation 테스트로 고정됨
  - 위치: `use-widget.ts:307-323`(`sessionEstablished` 정의+JSDoc) · `:500-522`(`seedWaitingFromStatus`
    staleness 표+`@param opts.allowWhileStreaming`) · 세 호출부 — `:656`(`start()`, opts 생략=기본
    게이트) · `:989`(`applyConfig` 복원 분기, opts 생략=기본 게이트) · `:437`(`replay_unavailable`
    폴백, `{ allowWhileStreaming: true }` opt-in)
  - 상세: 이전 설계는 `seedWaitingFromStatus` 가 `attempt?: { boot: number }` 를 받되 호출부마다 의미가
    달랐다 — `applyConfig` 는 `beginBootAttempt()` 가 **발급**한 토큰을, `start()` 는 `bootGenRef.current`
    를 **읽기전용으로 스냅샷**한 값을 넘겼다(같은 타입, 다른 조달 방식). 이 비대칭(발급 vs 스냅샷)
    자체가 두 차례 결함의 근원이었다(`18_39_11`: 함수 경계 밖이라 게이트 미적용 / `00_51_53`: no-op
    재전송이 스냅샷을 거짓 stale 로 만들어 고착). 새 설계는 `opts?: { allowWhileStreaming?: boolean }`
    로 단순화됐다 — 세 호출부가 고를 수 있는 선택지가 "생략(기본값)" 또는 "`{ allowWhileStreaming:
    true }`" 둘뿐이고, 후자를 쓰는 곳은 정확히 1곳(자기 스트림 재동기화가 목적임이 이름 자체로 드러남)
    이다. 세대 카운터 비교(개념: "더 최신 시도가 이겼는가")를 `streamRef.current !== null` 이라는 직접
    관찰 가능한 사실("스트림이 이미 열렸는가")로 대체해, "이 값을 누가 어떻게 넘겨야 하는가"를 추론할
    필요 자체를 없앴다. `git show cffee0d28` 로 확인한 diff 는 순수 축소(파라미터 타입 단순화, 함수
    시그니처에서 `attempt` 완전 제거)이고 새로 추가된 분기는 `opts?.allowWhileStreaming` 검사 1줄뿐이라
    순환복잡도·중첩 깊이 증가가 없다. 커밋 메시지가 언급한 "mutation A(게이트 제거)→되감기 2건 실패,
    mutation B(opt-in 제거)→replay 재동기화 실패" 는 `use-widget-eager-start.test.ts` 의 대응 테스트
    (1240행 "replay_unavailable 수신 → getStatus 재조회로 현재 표면 재동기화(스트림 유지)" · 3293행
    신설 "webhook in-flight 중 아무것도 복원 못 하는 재전송이 start() 를 스피너에 고착시키지 않는다")
    로 뒷받침된다(직접 실행 확인: 58 passed).
  - 제안: 없음(양호). 이 판단이 다음 라운드에서 뒤집히지 않도록 유지.

- **[INFO]** `bootGenRef`/`cannotApplyConfig`/`isAttemptStale` 축소가 실제 호출 그래프와 일치 — 죽은
  코드 없음
  - 위치: `use-widget.ts:182`(`bootGenRef` 선언) · `:276-281`(축소 서술) · `:283-305`
    (`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 정의) · 호출부 `:956`(`beginBootAttempt()`)
    · `:959`(`cannotApplyConfig`) · `:998`(`isAttemptStale`)
  - 상세: grep 으로 전수 대조한 결과 `beginBootAttempt`·`cannotApplyConfig`·`isAttemptStale` 는 정의부
    자기참조(`isAttemptStale` 내부의 `cannotApplyConfig` 호출)를 제외하면 **오직 `applyConfig` 안에서만**
    각 1회 호출된다 — `start()`/`sendCommand`/`seedWaitingFromStatus` 는 더 이상 이 세 심볼을 참조하지
    않는다(`seedWaitingFromStatus` 의 `useCallback` deps 도 `cannotApplyConfig` → `sessionEstablished`
    로 정확히 갱신됨, 590행). 이는 276-281행이 새로 명시한 "`bootGenRef` 는 `applyConfig` 의 config
    적용 경합에만 쓴다"는 주장과 정확히 일치한다. 저장소 전역(코드·다른 테스트 파일)에서 옛 파라미터명
    `bootAtStart`·`attempt` 잔재도 없음을 확인(grep 0건). 미사용 import·미사용 타입도 없다(`tsc
    --noEmit`, `eslint` 모두 clean).
  - 제안: 없음(양호).

- **[INFO]** `applyConfig` 복원 분기에 남은 이중 가드(`sessionEstablished()` 내부 + `isAttemptStale`
  checkpoint 2)의 "기능이 아니라 소유권 정합용" 성격이 상위 요약 JSDoc 에는 드러나지 않음
  - 위치: `use-widget.ts:986-999`(체크포인트 2 인라인 주석) vs `:276-281`(`beginBootAttempt` 요약 JSDoc)
  - 상세: `applyConfig` 복원 분기는 이제 두 개의 서로 다른 staleness 개념을 순차로 통과해야 한다 — (1)
    `seedWaitingFromStatus` 내부의 `sessionEstablished()` 가드("다른 시도가 이미 스트림을 열었나"), (2)
    seed 반환 직후의 `isAttemptStale(attempt)`(boot+world 토큰, "이 시도가 아직 config 적용 자격이
    있나"). 코드 자신의 인라인 주석(996행)이 이 두 번째 가드를 "**같은 세션이라 기능은 동일하나 소유권
    정합**"이라 명시한다 — 즉 이 지점에서 boot 축은 (이전처럼) 되감기 방지의 필수 방어선이 아니라
    "마지막 부팅이 스트림을 열었다"는 장부상 일관성만을 위해 남아 있다. 이 뉘앙스는 실제 사용 지점
    (993-997행)에는 정확히 적혀 있지만, `beginBootAttempt` 상단의 총론 JSDoc(276-281행, "`applyConfig`
    의 config 적용 경합에만 쓴다")은 "적용 경합"이라는 한 표현으로 두 가지 성격(기능적 필수 vs 장부상
    정합)을 뭉뚱그린다. 독자가 총론만 읽으면 checkpoint 2 를 제거했을 때의 실제 위험도(기능 회귀인지
    단순 소유권 로그 오염인지)를 오판할 수 있다.
  - 제안: 급하지 않음(INFO) — 필요 시 276-281행에 "단, `applyConfig` 복원 분기의 checkpoint 2 는 이제
    기능적 방어가 아니라 소유권 정합용(996행 참조)"이라는 한 줄만 추가해 지역 설명과 총론을 잇는다.

- **[INFO]** `useWidget()` 지속 성장(현재 파일 1087줄, 함수 본문 약 950줄, `useCallback` 27개) — 별도
  분리 plan 존재, 근거는 타당하나 인터림(interim) 가드는 부재
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`(전체) ·
    `plan/in-progress/webchat-usewidget-extraction.md`(분리 plan, `owner: developer`, `(unstarted)`)
  - 상세: 이번 재설계 자체는 순수 축소(파라미터 단순화)라 파일 크기에 미치는 영향은 미미하지만
    (`cffee0d28` diff stat: `+107/-62` 순증가 45줄), 최근 3라운드(23_58_23·00_51_53·이번)를 거치며
    파일이 계속 커지는 추세는 여전하다. 분리 대상(`useEiaSession` 후보)과 착수 전 확인할 설계 축(토큰
    캡슐화가 호출부 관점 축 수를 1개로 되돌리는지)·JSDoc 인접성 취약성의 lint/test 가드 전환까지 미리
    문서화돼 있어 이월 자체는 산문 매몰 없이 잘 추적되고 있다(직전 라운드 WARNING 이 정확히 이 분리를
    요구했고 그대로 이행됨). `eslint.config.mjs` 에 `max-lines`/`complexity` 규칙이 없다는 것도 직접
    확인했다 — 분리가 착수되기 전까지 파일이 계속 커져도 이를 조기 경보할 자동 장치는 없다. plan 자신이
    "구조를 고치는 것이 정확히 직전 회귀를 낳았다"는 이 코드베이스의 반복 교훈을 근거로 지금 당장의
    추출을 보류한 판단은 합리적이다(버그 수정 중 구조 리팩터를 얹지 않는다는 원칙과 일관).
  - 제안: 이번 PR 을 막을 사안 아님. `useEiaSession` 분리 착수 전까지, 최소 경보 장치로 이 파일 하나에
    한정한 `eslint max-lines-per-function`(경고 레벨) 도입을 저비용 조치로 고려할 것 — 강제 아님.

- **[INFO]** `sessionEstablished()` 네이밍이 인접 predicate 군(`isStale`/`isAttemptStale`/
  `cannotApplyConfig`)의 `is-`/`cannot-` 접두 컨벤션과 다름 — 이번 라운드 도입 아님, 재확인만
  - 위치: `use-widget.ts:252`(`isStale`) · `:296`(`cannotApplyConfig`) · `:301`(`isAttemptStale`) ·
    `:323`(`sessionEstablished`)
  - 상세: 세 predicate 는 `is`/`cannot` 접두로 boolean 질문 형태 네이밍인 반면 `sessionEstablished`
    는 형용사형 단독이다. `git log -S` 로 확인한 결과 이 이름은 이번 재설계가 아니라 훨씬 이전
    (`19e7a9405` "복원-스킵 판정에 이름 부여")에 정해졌고, 이번 라운드는 그 기존 predicate 의 **적용
    범위를 확장**했을 뿐 이름을 새로 짓지 않았다. 실사용(`if (!opts?.allowWhileStreaming &&
    sessionEstablished())`) 문맥에서는 오히려 자연스러운 영어 어순이라 가독성 손실은 미미하다.
  - 제안: 불필요(사소, pre-existing). 향후 이 파일을 `useEiaSession` 으로 추출할 때 공개 API 네이밍을
    정리하는 김에 함께 검토해도 되는 수준.

## 요약

이번 라운드의 핵심 변경(`cffee0d28`, 되감기 방어를 boot 세대 비교 proxy 에서 `sessionEstablished()`
직접 불변식으로 재설계)은 유지보수성 관점에서 실질적인 개선이다. 이전 설계가 "발급된 토큰"과
"읽기전용 스냅샷"이라는 같은 타입·다른 조달 방식의 비대칭으로 두 차례 CRITICAL 을 냈던 반면, 새 설계는
`opts?: { allowWhileStreaming?: boolean }` 라는 단일 opt-in 불리언으로 축소됐고 실사용은 정확히 1곳뿐이라
호출부가 "무엇을 넘겨야 하는가"를 추론할 필요 자체가 사라졌다. `bootGenRef`/`cannotApplyConfig`/
`isAttemptStale` 는 `applyConfig` 의 config 적용 경합이라는 좁은 역할로만 남았고, grep 전수 대조 결과
실제 호출 그래프도 그 축소와 정확히 일치해 죽은 코드나 시그니처 드리프트는 없다(`tsc`/`eslint`/대상
테스트 파일 58건 모두 clean 하게 직접 재확인). `useWidget()` 지속 성장에 대한 별도 분리 plan
(`webchat-usewidget-extraction.md`) 도 근거가 구체적이고 산문 매몰 없이 정식 추적되고 있어, 이번 PR
범위에서 구조 리팩터를 미룬 판단 자체는 타당하다. 다만 한 가지 명확한 결함을 실측으로 확인했다 —
`beginBootAttempt` JSDoc 의 "비대칭 가드 누락 3번 CRITICAL" 카운트(`02_04_13`·`08_29_33`·`09_36_01`)가
직전 라운드(`00_51_53`)에서 이미 stale(같은 실패 유형의 `18_39_11`/`23_58_23` 누락)로 지적됐음에도
실제로는 갱신되지 않았고, 그 라운드의 `RESOLUTION.md` 는 "JSDoc 전면 재작성으로 카운트 서술 자체를
없앴다"고 기록했으나 `git show`/`git log -S` 대조 결과 해당 문단은 diff 밖의 미변경 컨텍스트였다. 코드
동작에는 영향이 없는 주석 상의 문제이지만, 이 파일이 "같은 실패를 몇 번 겪었는가"라는 인라인 카운트에
크게 의존해 재발을 막아온 문서화 문화 자체의 신뢰도, 그리고 향후 라운드가 "이미 처리됨"으로 오인해
재검증을 건너뛸 위험을 고려하면 병합 전 정정을 권고한다.

## 위험도

LOW
