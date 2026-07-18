# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (01_44_21)

## 검증 방법

`prompt_file` 페이로드는 `review/consistency/2026/07/17/19_46_54/{plan_coherence,rationale_continuity}.md`
(신규 파일)와 `spec/7-channel-web-chat/2-sdk.md` frontmatter 4줄 추가만 담고 있어, "이번 라운드 핵심"이
지목한 실제 대상(`seedWaitingFromStatus`/`beginBootAttempt` JSDoc, `start()`/`applyConfig`/
`replay_unavailable` 주석, CHANGELOG 항목 3, plan 9·10번째 거울상 기록)을 포함하지 않았다 — file 1
(`plan_coherence.md`) 스스로 진단한 것과 동일한 payload 크기 제한 패턴으로 판단된다. 이를 신뢰하지 않고
worktree 절대경로로 직접 검증했다:

1. `git log`/`git show`로 재설계 커밋(`cffee0d28`)과 그 문서 정합 커밋(`206d27cee`)을 원본 diff로 확인.
2. `codebase/channel-web-chat/src/widget/use-widget.ts` 전문(1087줄)을 직접 Read해 JSDoc 텍스트와 실제
   구현(가드 분기·호출부 인자)을 라인 단위 대조.
3. `ts.getJSDocCommentsAndTags()`(channel-web-chat의 `typescript@5.9.3`, 컴파일러 API)로 지정된 11개 심볼
   (`worldGenRef`/`bootGenRef`/`unmountedRef`/`pendingResetRef`/`isStale`/`beginBootAttempt`/
   `cannotApplyConfig`/`isAttemptStale`/`sessionEstablished`/`establishConfig`/`seedWaitingFromStatus`)의
   JSDoc 부착 개수를 스크래치패드 스크립트로 재실측.
4. `CHANGELOG.md`·`plan/in-progress/webchat-boot-single-flight.md`를 `206d27cee` diff와 현재 파일 상태
   양쪽으로 대조하고, 인용된 리뷰어 구성(`requirement·testing·side_effect` 등)을 `review/code/2026/07/18/
   00_51_53/{SUMMARY,RESOLUTION}.md` 원본과 교차 확인.
5. `use-widget-eager-start.test.ts`(1971줄 diff 대상 파일, 현재 3300줄대)에서 "boot 축"/"boot 스냅샷" 문구
   전수 grep 후 각 발생 지점이 이번 재설계로 여전히 유효한지 개별 판정(`git log -L`로 각 블록의 최종 수정
   커밋 확인).
6. `npx tsc --noEmit`·`npx vitest run` 으로 코드가 실제로 컴파일/통과하는지 재확인(문서 드리프트가 순수
   주석 문제이지 기능 결함이 아님을 보장하기 위함).

## 발견사항

- **[WARNING]** 재설계 이전 "boot 축" 메커니즘을 서술하는 회귀 테스트 주석 2곳이 재설계(`cffee0d28`) 이후
  실제 가드와 어긋남 — 기능은 정상이나 설명이 stale
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3042-3050`,
    `:3106-3109`
  - 상세: 두 블록 모두 `seedWaitingFromStatus`의 `WAITING` dispatch 보호 메커니즘을 **"boot 축"/
    `isAttemptStale`(checkpoint 2)** 로 서술한다 — `:3042`("**대체된 부팅 시도의 지연 `getStatus` 가
    살아있는 화면을 되감지 않는다** (boot 축)." + "호출부 checkpoint 2(`isAttemptStale`)는
    `seedWaitingFromStatus` 가 **반환한 뒤** 만 게이팅하는데 `WAITING` dispatch 는 함수 **안쪽**에서
    그보다 먼저 끝난다")와 `:3106`("같은 함수 안에서 표면 갱신은 **boot 축**을 보고(대체된 시도는
    그리지 않음)"). 이 두 서술은 `git log -L`로 확인한 작성 시점(각각 `fa1dceba5`·`d48a48aae`, 둘 다
    `cffee0d28` **이전**)엔 정확했다 — 당시 `seedWaitingFromStatus`는 `attempt?: { boot: number }`
    를 받아 `cannotApplyConfig(attempt)`(boot 세대 비교)로 `WAITING` dispatch를 게이팅했다. 그런데
    `cffee0d28`가 이 게이트를 **완전히 교체**했다 — 현재 `seedWaitingFromStatus`(`use-widget.ts:528-590`)
    는 `attempt` 인자 자체가 없고(`opts?: { allowWhileStreaming?: boolean }`로 대체), `WAITING`
    dispatch는 `if (!opts?.allowWhileStreaming && sessionEstablished()) return "stale";`
    (`:559`)로만 게이팅한다 — `isAttemptStale`/`cannotApplyConfig`/boot 세대는 이 함수 안 어디에도
    없다. 즉 두 테스트가 실제로 재현·고정하는 보호막은 이제 `sessionEstablished()`이지 boot 축이
    아니다(재설계 자신의 JSDoc이 정확히 이 두 라운드(`18_39_11`)를 "boot 세대 비교가 두 번 뚫린" 사례
    중 하나로 인용하며 교체 근거로 든다 — `use-widget.ts:507-516`). 테스트 자체는 여전히 통과한다
    (`npx vitest run ... -t "대체된 시도"` → 5 passed 확인, `tsc --noEmit` clean) — 순수 설명 텍스트만
    stale하다. 다만 이 파일은 스스로 "가드를 어느 축에 다느냐"를 반복 오판해 CRITICAL을 10회 낸
    이력을 명문화해 둔 자리라(`plan/in-progress/webchat-boot-single-flight.md:362-391` "9·10번째
    거울상"), 정확히 이 회귀를 고정하는 테스트의 주석이 **더는 존재하지 않는 게이트**를 원인으로
    지목하면, 향후 이 축을 다시 손대는 개발자가 "checkpoint 2가 여기 관여한다"고 오인해 잘못된
    안전 가정 위에서 리팩터링할 위험이 있다.
  - 제안: `:3042`의 레이블 `(boot 축)`을 `(sessionEstablished())`로 바꾸고, 본문에 "당시(18_39_11)
    원인은 checkpoint 2(`isAttemptStale`)의 함수 경계 미도달이었으나, 재설계(`cffee0d28`)로 이 가드는
    `sessionEstablished()` 로 교체됐다 — 이 테스트가 지금 고정하는 것은 그 가드다"를 추가. `:3106`의
    "표면 갱신은 boot 축을 보고"를 "표면 갱신은 `sessionEstablished()` 를 보고"로 정정. (참고: `:3113`의
    테스트 제목 "종료 확정은 boot 축을 보지 않는다"는 여전히 정확하다 — 종료 확정 분기는 재설계 전후
    한 번도 boot 축을 본 적이 없으므로 수정 불요.)

- **[INFO]** 핵심 검증 1 — `seedWaitingFromStatus` JSDoc 표(정책 = world / `sessionEstablished`)가
  실제 코드와 정확히 일치
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:500-522`(JSDoc 표 + `@param
    opts.allowWhileStreaming`), `:545`(world 게이트) · `:551-554`(종료 확정, world만) · `:559`
    (`sessionEstablished()` 게이트) · `:437`(`replay_unavailable` opt-in 호출) · `:656`(`start()`
    호출, opts 생략) · `:989`(`applyConfig` 호출, opts 생략)
  - 상세: JSDoc 표의 "종료 확정(`finalizeEnded`) │ world 만"은 `:545` `if (isStale(gen)) return
    "stale";`(world 축 `isStale`만, boot 축 참조 없음) 뒤에 오는 `:551-554` 종료 분기와 정확히
    대응한다. "표면 갱신(`WAITING` dispatch) │ `sessionEstablished()` — 스트림이 이미 열렸으면 스킵"은
    `:559`의 `if (!opts?.allowWhileStreaming && sessionEstablished()) return "stale";`와 라인 단위로
    일치한다. `@param opts.allowWhileStreaming`의 "`replay_unavailable` 폴백만 넘긴다 …
    `applyConfig`·`start()` 는 생략"이라는 서술은 세 호출부 전수 대조로 확인했다 — `replay_unavailable`
    (`:437`)만 `{ allowWhileStreaming: true }`를 넘기고, `start()`(`:656`)·`applyConfig`(`:989`) 는
    둘 다 opts 없이 호출한다(코드 검색으로 `seedWaitingFromStatus(` 호출부 3곳 전수 확인 — 그 외 호출
    없음). "자기 자신은 seed 뒤에 열므로 seed 시점엔 아직 안 열렸다"는 주장도 `openStream` 호출이 두
    호출부(`:660`, `:1000`) 모두 `seedWaitingFromStatus` await·outcome 게이팅 **이후**에 위치함을
    확인해 검증됐다.
  - 제안: 없음(검증됨).

- **[INFO]** 핵심 검증 2 — `beginBootAttempt` JSDoc 괄호주(재설계분)와 `ts.getJSDocCommentsAndTags()`
  11심볼 전수 재실측 결과 이상 없음
  - 위치: `use-widget.ts:276-281`(`beginBootAttempt` 인접 괄호주), `:178-180`(`bootGenRef` JSDoc의
    "인접성 취약" 경고 — 재발 방지 문구, 이번 라운드가 실제로 그 규율을 지켰는지의 근거)
  - 상세: 괄호주 "`bootGenRef` 는 **`applyConfig` 의 config 적용 경합에만** 쓴다 … `start()`/
    `sendCommand`/`seedWaitingFromStatus` 는 이 축을 쓰지 않는다"는 실제 코드와 일치 — `bootGenRef`
    직접 참조는 `beginBootAttempt`(`:284`)·`cannotApplyConfig`(`:297`) 두 곳뿐이며(grep 전수 확인),
    `seedWaitingFromStatus`/`start`/`sendCommand` 어디에도 `bootGenRef` 참조가 없다. 00_51_53
    라운드가 지적했던 "거울상 카운트 stale"(당시 괄호주가 "start()는 world 축만으로 부족하다" 같은
    반증된 서술을 담고 있었음)은 이번 재설계로 그 문장 자체가 통째로 교체돼 사라졌다 — 재확인 결과
    카운트류 서술 없이 현재 메커니즘만 서술한다.
  - **컴파일러 API 재실측**: 스크래치패드 스크립트(`ts.createSourceFile` + `ts.getJSDocCommentsAndTags`)로
    11개 심볼 전수 확인 — **11개 전부 정확히 1개씩** JSDoc 부착(0개·중복 없음): `worldGenRef`(:161)·
    `bootGenRef`(:182)·`unmountedRef`(:184)·`pendingResetRef`(:221)·`isStale`(:252)·
    `beginBootAttempt`(:283)·`cannotApplyConfig`(:296)·`isAttemptStale`(:301)·
    `sessionEstablished`(:323)·`establishConfig`(:923)·`seedWaitingFromStatus`(:528). 이는
    `review/code/2026/07/18/00_51_53/RESOLUTION.md`("JSDoc 11심볼 전수 부착")의 주장과 일치하며, 이번
    라운드가 독립적으로 재확인한 결과다.
  - 제안: 없음(검증됨).

- **[INFO]** 핵심 검증 3 — CHANGELOG 항목 3 재작성 + plan "9·10번째 거울상" 진행기록이 실제 커밋과
  전수 일치
  - 위치: `CHANGELOG.md:9`(항목 3), `plan/in-progress/webchat-boot-single-flight.md:362-400`
    ("## 후속 (23_58_23 · 00_51_53 처리 — 2026-07-18)"), 커밋 `206d27cee`
  - 상세: `git show 206d27cee -- CHANGELOG.md`로 diff 원본 대조 — 구 항목 3("대체된 시도가 화면을
    되감지 않는다", `applyConfig` 케이스만 서술)이 신 항목 3("지연 도착한 `getStatus` seed 가 화면을
    되감지 않는다", `start()` 고착 경로 포함)으로 교체됐고, 신규 서술의 "boot 세대 비교로 잡으려던
    초기 시도는 그 no-op 재전송을 '내가 대체됐다' 로 오판해 스피너에 영구 고착시켰고(3인 재현)"는
    과거형으로 정확히 프레이밍돼 있어(boot 비교를 "현재 메커니즘"이 아니라 "폐기된 초기 시도"로
    서술) 되돌려진/반증된 서술이 현재형으로 남아있는 패턴은 없다. plan의 "9번째(23_58_23)"·
    "10번째(00_51_53)" 절을 대응 커밋과 대조: 9번째 절의 "concurrency·requirement·side_effect 3인이
    독립 재현 → fix(`7cfbf2557`)"는 `git show 7cfbf2557`의 커밋 메시지("concurrency·requirement·
    side_effect 세 리뷰어가 독립적으로 … 재현")와 정확히 일치. 10번째 절의 "requirement·testing·
    side_effect 3인이 독립 재현"·"boot 축을 버리고 `sessionEstablished()` 로"는 `cffee0d28` 커밋
    메시지("requirement·testing·side_effect 3인 독립 재현" · "근본 원인: boot 축이 잘못된 추상")
    및 `review/code/2026/07/18/00_51_53/SUMMARY.md`("requirement · testing · side_effect (3인 독립)")
    와 라인 단위로 일치한다. mutation 양방향 서술("게이트 제거 → 되감기 2건 실패 / opt-in 제거 →
    replay 재동기화 실패")도 `RESOLUTION.md`(00_51_53)의 동일 서술과 일치.
  - **부수 확인**: 이전 라운드가 지적한 깨진 자기참조 `§후속-2`(plan:351)는 `206d27cee`에서
    `"아래 '## 이월 (신규)' 의 §NNN 항목"`으로 교체됐고, 실제로 그 절(`:358`)에 대응 내용이 존재함을
    확인 — 현재 파일 전체 heading 목록(`grep -n '^#'`)에 "후속-2"를 가리키는 phantom anchor는 남아있지
    않다(`:399`의 "§후속-2"는 "제거했다"는 과거 서술 문맥일 뿐 살아있는 참조가 아님).
  - 제안: 없음(검증됨).

- **[INFO]** README/설정 문서/API 문서 — 이번 라운드 대상 변경 없음
  - 상세: 이번 재설계는 `useWidget()` 내부 staleness 가드 로직 재배선(순수 버그 fix)이며, 신규
    공개 API·CLI 스크립트·환경변수·엔드포인트를 도입하지 않는다. `codebase/channel-web-chat/README.md`
    (`상태` 섹션)는 기능 단위 요약이라 이 내부 가드 축 변경을 반영할 필요가 없고, `.env.example`
    변경도 없다. `spec/7-channel-web-chat/2-sdk.md` §3(재전송) 본문은 이번 diff에서 변경되지 않았다
    (frontmatter `code:` 증거 링크만 이전 라운드 `7386acb72`에서 추가됨) — 재설계는 그 spec이 이미
    정의한 계약("마지막 wc:boot 적용")의 구현 세부만 바꿨으므로 spec 갱신 불필요(코드-스펙 갭 아님).
  - 제안: 없음.

- **[INFO]** `webchat-usewidget-extraction.md`의 hook 개수 근사치 — 변동 없음, 이미 지난 라운드에서
  저-우선순위로 유예됨(재확인만, 신규 이슈 아님)
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:18`("`useCallback` 26개·`useRef` 13개",
    "~1070줄")
  - 상세: 재설계 후 실측(`grep -c`) 결과 `useCallback` **27개**·`useRef` **13개**·**1087줄** —
    00_51_53 documentation 라운드가 이미 발견해 "우선순위 낮음, 착수 시점 갱신으로 충분"이라 명시
    유예한 것과 동일한 근소한 차이(26 vs 27, ~1070 vs 1087)이며 이번 재설계가 그 폭을 눈에 띄게
    넓히지 않았다. 새 드리프트가 아니므로 재차 조치를 요구하지 않는다.
  - 제안: 없음(기존 유예 유지).

- **[INFO]** `review/consistency/2026/07/17/19_46_54/{plan_coherence,rationale_continuity}.md` —
  문서화 관점에서 이상 없음
  - 상세: 두 파일은 이번 라운드보다 앞선 `/consistency-check --impl-done` 실행 산출물로, `review/
    consistency/**` 규약(중첩 ISO 타임스탬프 디렉터리)을 따른다. 인용된 라인 번호(`spec/7-channel-
    web-chat/1-widget-app.md:47`, `3-auth-session.md:78`, plan 라인 등)를 표본 대조한 결과 참조가
    유효했고, 두 문서 모두 자체 위험도(LOW/NONE)를 명시해 하네스 STATUS 계약을 지켰다. 이 두 파일은
    코드 docstring/README가 아니라 감사 산출물이므로 본 리뷰의 핵심 대상(재설계 코드)과는 별도
    트랙이다.
  - 제안: 없음.

## 요약

이번 라운드가 지정한 핵심 검증 항목(`seedWaitingFromStatus` JSDoc 표·`@param
opts.allowWhileStreaming`, `beginBootAttempt` JSDoc, `start()`/`applyConfig`/`replay_unavailable`
호출부 주석, CHANGELOG 항목 3, plan 9·10번째 거울상 진행기록)은 전부 `git show`/`ts.
getJSDocCommentsAndTags()`/코드 라인 대조로 **실제 코드·커밋과 정확히 일치함을 확인**했다 — 되돌려진
설계(boot 세대 비교)를 현재형으로 서술하는 잔존 텍스트는 프로덕션 JSDoc·CHANGELOG·plan 어디에도
없었다(전부 과거형으로 올바르게 프레이밍). JSDoc 11심볼 전수 부착(0개·중복 없음)도 독립 재실측으로
재확인됐다. 다만 검증 과정에서 프로덕션 JSDoc 바깥, 회귀 테스트 파일(`use-widget-eager-start.test.ts`)
두 곳(`:3042-3050`, `:3106-3109`)에서 재설계 **이전**(각각 `fa1dceba5`·`d48a48aae` 시점)에는 정확했으나
`cffee0d28`가 그 설명 대상 가드(boot 축/`isAttemptStale`)를 `sessionEstablished()`로 완전히 교체하면서
stale해진 주석을 새로 발견했다 — 테스트 자체는 여전히 통과하고(vitest·tsc 재확인) 기능 결함은 아니지만,
정확히 이 축(가드를 어느 신호에 거는가)에서 10회 CRITICAL을 낸 이 파일의 이력을 감안하면 사소하게
넘기기보다 다음 정리 커밋에서 함께 바로잡을 가치가 있다. 그 외 README·설정·API 문서는 이번 순수 내부
로직 재설계 범위상 갱신 대상이 없다.

## 위험도

LOW
