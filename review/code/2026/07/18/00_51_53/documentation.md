# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (00_51_53)

## 검증 방법

이번 라운드가 지정한 핵심 검증 항목(직전 `23_58_23` documentation WARNING 2건의 `a2cd6ebb7` fix가
실제 코드/git 히스토리와 일치하는지, `start()` fix가 추가한 JSDoc이 코드와 일치하는지)을 최우선으로,
모든 판단을 `git show`/`git log`(커밋 객체 원본) 대조와 `ts.getJSDocCommentsAndTags()` 컴파일러 API
재실측으로 뒷받침했다.

**주의 — 트랜지언트 상태 오귀속 회피**: 검증 도중 `git status`가 `use-widget.ts`/
`use-widget-eager-start.test.ts`를 일시적으로 "modified(unstaged)"로 보고했고, 그 순간 워킹트리를
읽었을 때 `seedWaitingFromStatus(client, session)` 호출에서 `start()`의 boot 스냅샷 인자가 빠진 것처럼
보였다. 재확인(`git diff HEAD`)한 결과 그 상태는 즉시 사라졌고 워킹트리는 HEAD(`5eed8cf96`)와 다시
완전히 일치했다 — 공유 worktree에서 다른 프로세스가 순간적으로 파일을 건드린 아티팩트로 판단된다
(사용자 메모리의 "ai-review flaky 측정 아티팩트" 사례와 동일 패턴). 이 오탐을 피하기 위해 이후 모든
코드 대조는 워킹트리가 아니라 `git show HEAD:<path>`로 고정해 재확인했다. **결론: 이 항목은 실제
결함이 아니라 관측 아티팩트이며, 최종 HEAD 기준으로는 문제없다** — 아래 "핵심 검증 2"가 그 근거다.

## 발견사항

- **[INFO]** 핵심 검증 1 — 되돌려진 C1 메커니즘 서술 정정, 실측 일치 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2537-2624`(주석 3곳),
    커밋 `a2cd6ebb7`
  - 상세: `git show a2cd6ebb7`로 diff를 직접 대조했다. 정정 전 주석은 "대체된 시도의 seed는 종료를
    확정하지 않는다(`"stale"` 반환) … 살아있는 시도가 확정한다"고 서술했는데, 이는 `f1883470b`(flicker
    fix 라운드)에서 되돌려진 옛 설계다. 정정 후 주석("checkpoint 1(`cannotApplyConfig`)을 boot 축
    전용으로 바꿔 … 종료 확정 자체는 1차(대체된 시도)가 그대로 한다")을 실제 코드와 대조했다 —
    `cannotApplyConfig`(`use-widget.ts:290-293`)는 `unmountedRef`와 `bootGenRef`만 보고 world 축은
    보지 않으며, `seedWaitingFromStatus`(`:520-581`)의 종료 확정 분기(`:543-546`)는 `isStale(gen)`
    (world 전용) 게이트만 거치고 `attempt`/boot 축은 전혀 참조하지 않는다 — 정정된 서술과 코드가
    라인 단위로 일치한다. CHANGELOG(`:9`)의 "다만 종료 확정은 그대로 한다 — 종료는 세계의 사실이지
    시도의 소유물이 아니다" 문장과도 정합.
  - 제안: 없음(검증됨 — 추가 조치 불필요).

- **[INFO]** 핵심 검증 2 — plan의 "일어난 적 없는 단계" 서술 정정, 실측 일치 확인
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:351`, `:358`, 커밋 `a2cd6ebb7`
  - 상세: 정정 전 두 줄은 "`§106` → `§3(재전송)` 39건 정정"이라는, 실제로 한 번도 일어나지 않은 단일
    단계를 서술했다. 실제 git 히스토리를 직접 추적: (1) `fdaa06e98`(현재 해시로는 `d48a48aae` —
    리베이스로 해시만 바뀐 동일 커밋. 커밋 메시지·author date·stat 전부 동일함을 `git show`로 확인)가
    `§106`→`§110` 39건을 정정("`§106` → `§110` 39건 정정 — 내가 frontmatter에 넣은 4줄이 대상 문단을
    정확히 그만큼 밀어냈다"), (2) `7386acb72`가 `--impl-done 19_46_54` 체커 충돌 판정에 따라
    `§110`→`§3(재전송)` 41건을 추가 정정("41건을 `§3(재전송)`으로 교체"). 정정 후 plan 서술("클로즈
    표기 2단계 정정: (1) `§106` → `§110` 39건 …, (2) 후속 `--impl-done`이 … `§110` → `§3(재전송)`
    41건")은 이 실제 2단계 역사와 정확히 일치한다.
  - 제안: 없음(검증됨 — 추가 조치 불필요).

- **[INFO]** 핵심 검증 3 — `start()` fix로 변경된 JSDoc(`beginBootAttempt`·`seedWaitingFromStatus`
  `@param attempt`)이 코드와 일치, `ts.getJSDocCommentsAndTags()` 10심볼 재실측 결과 이상 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:271-276`(`beginBootAttempt` 인접
    괄호주), `:507-514`(`seedWaitingFromStatus` `@param attempt`), `:628`/`:651`(`start()` 구현),
    커밋 `7cfbf2557`
  - 상세: `git show HEAD:...`로 확정한 코드에서 `start()`는 `const bootAtStart = bootGenRef.current;`
    (:628)로 읽기전용 스냅샷을 캡처해 `seedWaitingFromStatus(client, session, { boot: bootAtStart })`
    (:651)로 넘긴다 — JSDoc의 "두 종류의 호출부가 넘긴다: `applyConfig` … 와 `start()`(… `bootGenRef.
    current`를 읽기전용 스냅샷으로 캡처해 넘긴다)" 서술과 정확히 일치한다. 세 호출부 전수 대조:
    `start()`(:651, `{boot: bootAtStart}`) · `applyConfig` 복원분기(:982, `attempt` 전체 토큰) ·
    `replay_unavailable` 폴백(:426, `attempt` 생략) — JSDoc이 "`replay_unavailable` 폴백만 생략한다"고
    적은 것과 일치. `beginBootAttempt` 인접 JSDoc의 "`start()`는 world 축만으로 부족하다 … `beginBoot
    Attempt()`로 세대를 올리지 않고 `bootGenRef.current`를 읽기만 한다" 서술도 실제 `start()`가
    `beginBootAttempt()`를 호출하지 않고 `bootGenRef.current`를 직접 읽는 것과 일치한다.
  - **컴파일러 API 재실측**: `ts.getJSDocCommentsAndTags()`(channel-web-chat의 `typescript@5.9.3`)로
    `worldGenRef`/`bootGenRef`/`unmountedRef`/`pendingResetRef`/`isStale`/`beginBootAttempt`/
    `cannotApplyConfig`/`isAttemptStale`/`sessionEstablished`/`seedWaitingFromStatus` 10개 심볼을
    HEAD 원본(`git show HEAD:...`를 스크래치패드에 추출)에서 전수 확인 — **10개 전부 정확히 1개씩**
    JSDoc 부착(0개·중복 없음). `bootGenRef`→`unmountedRef` 인접 순서(다른 선언이 끼지 않음)도 재확인.
    RESOLUTION.md의 "JSDoc 10심볼 전수 부착" 주장과 일치.
  - 제안: 없음(검증됨). 스크래치패드 스크립트·추출 파일은 검증 후 저장소 밖(세션 scratchpad)에만
    존재하므로 별도 정리 불요.

- **[WARNING]** plan 파일에 존재하지 않는 섹션을 가리키는 새 참조 — "§후속-2"
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:351` ("... 아래 §후속-2 참조."), 커밋
    `a2cd6ebb7`가 신규 도입
  - 상세: 이 문서는 `§<제목>` 표기를 실제 heading을 가리키는 데 일관되게 써 왔다 — 예: `:300`의
    "아래 §후속 참조"는 `:306`의 `## 후속 (18_39_11 처리 — 2026-07-17)`을 정확히 가리키고, `:345`의
    "위 §2의 짝 테스트"는 `:331`의 `### 2. 대체된 부팅의 지연 getStatus...`를 정확히 가리킨다(둘 다
    직접 확인). 그런데 `:351`이 신규로 추가한 "§후속-2"에 대응하는 heading은 파일 전체에 **없다**
    (`grep -n '^#'`로 전체 heading 22개 확인 — "후속"은 `:306` 하나뿐, "후속-2"는 어디에도 없음).
    문맥상 가리키려던 내용(naming_collision 체커의 "기존 관행" 판정 상세)은 실제로는 `:354`의
    `## 이월 (신규)` 섹션, 그중에서도 `:358` 불릿에 있다 — 즉 참조 대상 콘텐츠는 존재하지만 라벨이
    이 문서 자신의 표기 규약을 어긴 phantom anchor다. `plan/**` 문서는 렌더링되는 하이퍼링크가
    아니라 사람이 스크롤해서 찾으므로 실사용 영향은 낮으나, 이 fix 자체가 "문서 정확성" 정정
    커밋이라는 점에서 아이러니가 크고, `§NNN` 표기 취약성을 이 PR이 반복해 겪은 바로 그 패턴이다.
  - 제안: `:351`의 "아래 §후속-2 참조"를 "아래 '이월 (신규)' 참조" 또는 "§이월(신규)"처럼 실제
    heading을 가리키는 표기로 정정.

- **[WARNING]** plan 파일에 `23_58_23` 라운드 전체를 기록하는 "진행 기록/후속" 섹션이 없음
  - 위치: `plan/in-progress/webchat-boot-single-flight.md` (파일 끝, `:306-360`)
  - 상세: 이 plan 파일은 각 리뷰 라운드의 CRITICAL/WARNING과 그 처리를 산문 섹션으로 기록하는
    확립된 자기 컨벤션을 갖는다 — `## 진행 기록 — ai-review 17_36_57/17_48_20 CRITICAL 3건 반영`
    (:206), `## 진행 기록 — 7번째 거울상: StrictMode dev 파괴`(:272), `## 후속 (18_39_11 처리 —
    2026-07-17)`(:306, CRITICAL 3건 + WARNING 5건을 항목별로 서술) 등 매 라운드마다 예외 없이
    지켜졌다. 그런데 `23_58_23` 라운드 — 신규 CRITICAL 1건("9번째 거울상", `start()` 무방비로 화면
    되감기 + EventSource 이중생성)과 WARNING 5건(그중 2건이 바로 이번에 검증한 documentation
    정정)을 냈고 `7cfbf2557`+`a2cd6ebb7` 두 커밋으로 처리됐다 — 은 파일 전체에서 `:303`의 곁가지
    언급(`useEiaSession` 분리 근거로 "23_58_23 기준" 인용) **한 줄**을 빼면 어떤 섹션도 갖지 못했다
    (`grep -n '23_58_23\|18_39_11'`로 확인 — `18_39_11`은 전용 섹션 3곳에서 인용되는 반면
    `23_58_23`은 이 한 줄뿐). 이 plan은 곧 `plan/complete/`로 이동 예정(형제 문서
    `webchat-usewidget-extraction.md`가 "곧 `complete/` 이동"이라 명시)이며, 이동 시점에 산문으로만
    남은 서술이 묻히는 위험은 **이 plan 자신이 이미 경고한 바로 그 실패 유형**이다(`:356-357`,
    `--impl-done 19_46_54 plan_coherence` WARNING 인용 — "이 plan 자신이 A-6에 대해 경고한 바로 그
    이월 유실 실패 유형"). `review/code/2026/07/17/23_58_23/{SUMMARY,RESOLUTION}.md`에는 온전히
    기록돼 있으나, `review/code/**`는 감사 아카이브이지 이 기능의 SoT 서사가 아니다 — 지금까지
    모든 라운드가 review 산출물과 별개로 plan에도 요약을 남긴 것과 대비된다.
  - 제안: `complete/` 이동 전에 `## 후속 (23_58_23 처리 — 2026-07-17)` 섹션을 추가해 9번째
    거울상(`start()` 무방비) CRITICAL과 그 fix, WARNING 5건(이번에 검증한 documentation 2건 포함)을
    기존 라운드들과 같은 형식으로 요약 — 특히 "9번째 거울상"은 이 plan이 스스로 누적 집계해 온
    거울상 카운트(`webchat-usewidget-extraction.md`가 인용하는 "9번")의 원천이므로 plan 자신에 있는
    게 맞다.

- **[WARNING]** CHANGELOG의 §3(재전송) 항목이 `start()`(eager 부팅)의 "세번째 되감기 경로" fix를
  누락
  - 위치: `CHANGELOG.md:3-10`(특히 항목 3, `:9`)
  - 상세: 현재 CHANGELOG 항목 3("대체된 시도가 화면을 되감지 않는다")은 "겹친 두 부팅이 각자
    `getStatus`를 낸 뒤 대체된 쪽 응답이 뒤늦게 도착"하는 시나리오를 서술한다 — 이는 두 `wc:boot`
    재전송(둘 다 `applyConfig`/`beginBootAttempt` 경로)이 경합하는 `fa1dceba5`(C2, 18_39_11) 케이스다.
    그런데 `7cfbf2557`(23_58_23 CRITICAL, "**세번째** 되감기 경로")가 고친 건 다른 조합이다 —
    `start()`(패널 open 시 eager 부팅, `applyConfig`를 거치지 않음)의 지연 `getStatus`가 **나중에
    도착한 `wc:boot` 재전송**과 경합하는 경우로, 커밋 메시지 자신이 "단순 flicker가 아니라 **고착**
    — 되감긴 표면에 응답하면 지나간 nodeId로 명령이 나가 백엔드가 거부"라고 명시할 만큼 사용자 영향이
    더 크다(단순 화면 깜빡임이 아니라 대화가 진행 불가 상태로 굳는다). CHANGELOG 항목 3의 "겹친 두
    부팅"이라는 표현은 두 `wc:boot` 재전송을 가리키는 것으로 자연스럽게 읽혀 이 세번째 경로(eager
    start + 재전송)를 포함한다고 보기 어렵다. 이 저장소는 이런 누락을 스스로 반복 패턴으로 기록해
    왔다(`review/code/2026/07/17/18_39_11/scope.md` INFO: "이 저장소 스스로 '사용자 가시 fix의
    CHANGELOG 누락은 반복 지적된 패턴'이라 진행 기록에 적어 놓았는데, 바로 이번에 새로 추가된
    사용자 가시 fix 하나가 같은 방식으로 또 누락됐다" — 그 사례가 flicker fix였고, 지금 사례는
    `start()` 되감기다). `7cfbf2557`·`a2cd6ebb7` 둘 다 `CHANGELOG.md`를 건드리지 않았음을
    `git show --stat`으로 확인했다.
  - 제안: CHANGELOG 항목 3(또는 신규 항목 4)에 `start()`(eager 부팅)의 지연 seed가 재전송 이후
    화면을 되감고 두번째 SSE 연결을 여는 세번째 경로도 막았다는 문장을 추가.

- **[INFO]** `webchat-usewidget-extraction.md`의 hook 개수 근사치가 현재 코드와 소폭 어긋남(경미)
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:12`("`useCallback` 26개·`useRef` 13개")
  - 상세: HEAD 기준 실측(`grep -c "= useCallback("` / `"= useRef"`)은 `useCallback` **27개**·
    `useRef` **13개**다. `useRef`는 정확히 일치, `useCallback`은 1개 차이(26 vs 27). 줄 수
    ("877줄 → 이 PR 후 ~1070줄")도 실측 1080줄로 "~"(근사) 표기 범위 안이라 문제 아님. 이 문서는
    `(unstarted)` 백로그 정찰 메모이고 근사치("~1070줄")로 이미 스스로 정밀도를 낮춰 뒀으므로
    영향은 미미하다.
  - 제안: 우선순위 낮음. 착수 시점에 실측 갱신하면 충분, 지금 정정은 불필요.

- **[INFO]** Write 도구 잔재(`</content>`)가 신규 RESOLUTION.md 갱신분 말미에 재출현(기존에 알려진
  저위험 패턴)
  - 위치: `review/code/2026/07/17/23_58_23/RESOLUTION.md`(파일 끝), 커밋 `5eed8cf96`가 추가한 구간
  - 상세: `7386acb72`가 "SUMMARY/RESOLUTION 말미에 Write 도구 잔재(`</content>`)가 섞여 있던 것 제거
    … 같은 잔재가 과거 문서 20여 개에도 있으나 이 PR 범위 밖이라 별도 작업으로 분리"라고 이미
    명시적으로 스코프 아웃한 저장소 전역 패턴이다. `5eed8cf96`이 같은 파일에 새 내용을 append하며
    같은 잔재를 다시 남겼다 — 새 인스턴스일 뿐 새로운 문제 유형은 아니다.
  - 제안: 없음. 별도로 이미 분리된 저장소 전역 정리 작업 범위에 자연히 포함될 것.

## 요약

이번 라운드가 지정한 핵심 검증 3건(되돌려진 C1 메커니즘 서술 정정, plan의 2단계 §표기 정정, `start()`
fix의 JSDoc)은 모두 git 히스토리·코드 라인 대조·`ts.getJSDocCommentsAndTags()` 컴파일러 API 재실측으로
**정확함을 확인**했다 — 세 곳 모두 서술과 실제 코드가 일치하고, JSDoc 10심볼 전수 부착도 재확인됐다.
검증 과정에서 공유 worktree 동시편집으로 보이는 트랜지언트 오탐(`start()` 인자 누락처럼 보였던 상태)을
겪었으나 `git show HEAD:`로 고정 재확인해 실제 결함이 아님을 확정했다. 다만 이 검증 과정에서 새로운
문서화 갭 3건을 발견했다 — (1) `a2cd6ebb7`가 새로 도입한 plan 내 깨진 자기참조("§후속-2", 존재하지
않는 섹션), (2) `23_58_23` 라운드(신규 CRITICAL 1건 포함) 전체가 이 plan의 확립된 "진행 기록/후속"
컨벤션에서 유일하게 누락돼 있고 그 plan이 곧 `complete/`로 이동 예정이라 매몰 위험이 실재함, (3)
CHANGELOG가 `start()`의 세번째 되감기 경로(가장 심각한 "고착" 케이스) fix를 다루지 않아 이 저장소가
스스로 반복 지적해 온 "사용자 가시 fix의 CHANGELOG 누락" 패턴이 재발함. 셋 다 런타임·빌드·테스트에는
영향이 없고 내용 자체가 틀린 것도 아니지만(정보 누락형), (2)는 완료 이동 전에 닫지 않으면 영구
매몰되는 시한이 있고 (3)은 이 저장소가 명시적으로 재발 위험군으로 지목해 온 패턴이라 가볍게 넘기기
어렵다.

## 위험도

MEDIUM
