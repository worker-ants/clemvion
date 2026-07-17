# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (00_51_53, fix 검증 라운드)

> 지시받은 핵심 검증 대상: 커밋 `7cfbf2557`(`start()` 가 읽기전용 boot 스냅샷을 `seedWaitingFromStatus`
> 에 넘기는 fix) 가 (1) spec `2-sdk.md §3(재전송)` "마지막 `wc:boot` 적용" 계약과 정합하는지, (2)
> `3-auth-session.md`/`1-widget-app.md` 와 어긋나지 않는지, (3) **새 회귀를 만들지 않는지**.
> 격리 mutation(공유 워크트리에서 diff on/off, A/B 대조 후 원복 — `git diff` 로 무결성 확인)으로
> 실측했다.

## 발견사항

- **[CRITICAL] `7cfbf2557` 가 새 회귀를 만든다 — 아무것도 복원하지 못하는(no-op) `wc:boot` 재전송이 `start()`의 webhook in-flight 구간에 도착하면 위젯이 `streaming`(스피너)에 영구 고착되고 SSE 가 끝내 열리지 않는다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612-666`(`start()`, 특히 `:628`
    `const bootAtStart = bootGenRef.current;` · `:651`
    `const outcome = await seedWaitingFromStatus(client, session, { boot: bootAtStart });`) ·
    `:520-581`(`seedWaitingFromStatus`, WAITING 분기 게이트 `:550`
    `if (attempt && cannotApplyConfig(attempt)) return "stale";`) · `:290-292`(`cannotApplyConfig`)
    · `:945-995`(`applyConfig`, 특히 `:951` `beginBootAttempt()` — **모든** `wc:boot` 진입 시 무조건
    실행 — 와 `:971` `const saved = sessionEstablished() ? null : loadSession(...)`).
  - 상세(실제 `useWidget()` 훅으로 재현, mutation 아님 — 임시 테스트 작성→실행→확인→삭제, 사용한
    `use-widget.ts` mutation 은 A/B 대조 후 `git checkout --` 로 원복해 `git diff` 무변경 확인):
    1. `wc:boot` #1 도착 → config 확립(저장 세션 없음, 신규 방문).
    2. 패널 open → `start()` 진입. **동기 구간에서 `bootAtStart = bootGenRef.current`(현재값, 예: 1)를
       캡처**한 뒤 `dispatch({type:"START"})` → `await client.startConversation(...)`(webhook POST)가
       in-flight 상태로 들어간다. 이 시점 **`sessionRef`/storage 는 아직 비어 있다** — `persist()`
       는 webhook 이 resolve 한 **뒤**에만 실행된다(`:637-639`).
    3. **webhook POST 미해결 중** `wc:boot` #2(관리자 라이브 미리보기의 무디바운스 재전송 등, 이
       diff 의 CHANGELOG 자신이 명시하는 그 경로)가 도착. 그 `applyConfig` 는 `beginBootAttempt()`
       를 **무조건** 호출해 `bootGenRef` 를 2로 올린 뒤(`:951`, `!cfg.apiBase` 조기 return 이 아닌 한
       예외 없음), `isEmbedAllowed()` 통과 후 `saved = sessionEstablished() ? null :
       loadSession(...)`(`:971`)를 검사한다 — **storage 가 아직 비어 있으므로 `saved === null`**,
       복원 분기 전체를 건너뛰고 config 재적용만 하고 조용히 끝난다(`getStatus` 호출 없음, `RESTORED`
       dispatch 없음, `openStream` 없음 — 아무 세션도 넘겨받지 않았다).
    4. 이제서야 `start()`의 webhook 이 resolve → `dispatch({type:"BOOTED",...})`(phase→`streaming`)
       → `persist()`가 세션을 storage 에 쓴다 → `seedWaitingFromStatus(client, session, { boot:
       bootAtStart(=1) })` 호출, 자기 `getStatus` 발사.
    5. `getStatus` 가 정상적으로 `waiting_for_input(n1)` 로 응답한다 — **아무도 이 세션을 가로채지
       않았다.** 그런데 WAITING 분기의 게이트(`:550`)가 `cannotApplyConfig({boot:1})` =
       `bootGenRef.current(2) !== 1` = **true** 로 평가해 `"stale"` 을 반환한다. `start()` 는
       `outcome !== "continue"` 로 **`openStream` 을 호출하지 못한 채 조기 return**한다(`:652`).
    6. **최종 상태**: `phase="streaming"`(로딩 스피너 화면), `pending=null`, `streamRef.current===null`
       (EventSource **0개**). 세션은 `sessionStorage` 에 정상 저장돼 있지만 이 마운트에서는 아무도
       그 세션의 `getStatus`/`openStream` 을 다시 시도하지 않는다 — **후속 `wc:boot` 이 다시 오기
       전까지 영구 고착**(에러 메시지도, 재시도 타이머도 없다). 새로고침하면 `applyConfig` 복원
       분기가 이번엔 `sessionEstablished()===false` 그대로에 `saved` 를 찾아 정상 복구되지만, **같은
       마운트 안에서는 회복 수단이 없다.**
  - **A/B 로 "이번 라운드가 만든 신규 회귀"임을 확정**: `:651` 을
    `seedWaitingFromStatus(client, session)`(fix 이전 형태, 3번째 인자 없음)로 되돌리면 동일 시나리오가
    **정상 통과**(phase=`awaiting_user_message`, `pending.nodeId="n1"`, `esCount=1`)한다 — 즉 이 실패는
    `7cfbf2557` 이전에는 존재하지 않았고, **정확히 이 fix 가 도입**했다. `git checkout --` 로 원복 후
    `git diff` 로 워크트리 무변경 확인.
  - 왜 CRITICAL 인가 — 커밋 `7cfbf2557` 자신이 원 결함을 "단순 flicker 가 아니라 고착" 이라 부른 것과
    같은 급의 사용자 영향이다(오히려 더 나쁘다 — 원 결함은 최소한 화면에 뭔가(옛 노드)라도 그렸지만,
    이 새 결함은 **아무것도 그리지 않고 스피너만 무기한** 남긴다). 도달 조건도 원 결함보다 **더 넓다**
    — 원 결함은 재전송이 "이 세션을 성공적으로 복원" 해야 성립했지만, 이 결함은 재전송이 **아무것도
    못 찾아도**(가장 흔한, 무해해 보이는 경우) 성립한다. 이 PR 이 스스로 근거로 드는 도달 조건(관리자
    라이브 미리보기의 무디바운스 재전송 + eager 즉시시작, `open()` 클릭 직후의 webhook 왕복 창)만으로
    충분하다 — 오히려 "persist 전" 창은 "persist 후" 창(원 결함의 창)보다 **먼저** 열려 더 넓다.
  - **동시 병렬 세션의 교차 관측(참고, 근거로 삼지 않음)**: 이 검증 도중 공유 워크트리에서 다른 병렬
    리뷰 세션이 이름까지 유사한 취지의 probe 테스트(`use-widget-eager-start.test.ts` 에 임시 추가된
    `"[PROBE] webhook in-flight 중 재전송이 아무것도 복원 못 하면 start() 도 boot 축으로 스킵돼
    스트림 미오픈 상태로 고착되는가"`)를 작성 중인 것을 관측했다(`git status`) — 같은 클래스의 결함을
    독립적으로 의심하고 있는 정황으로 보이나, 그 세션의 결론은 확인하지 않았고 내 결론은 **내가
    직접 A/B 대조로 확정한 재현**에만 의존한다. 5개 완료된 병렬 리포트(`concurrency.md`·
    `documentation.md`·`maintainability.md`·`scope.md`·`security.md`) 를 교차 확인한 결과, `concurrency.md`
    가 "BLOCKED 재전송"·"무효(`!apiBase`) 재전송" 두 파생 시나리오는 실측했으나(둘 다 정상 — BLOCKED
    는 오히려 방어적으로 유리, `!apiBase` 는 세대를 소모하지 않아 무해) **"허용되고 config 도 정상
    재적용되지만 복원할 게 없는" 세 번째 조합은 시험하지 않았다** — 정확히 이 조합이 문제다. 나머지
    4개 리포트에도 이 시나리오에 대한 언급이 없다(grep 확인). 즉 이 CRITICAL 은 이번 라운드의 다른
    forced reviewer 들이 놓친 것으로 보인다.
  - 제안: 병합 전 반드시 처리. 근본 원인은 `cannotApplyConfig`/`bootGenRef` 가 "**boot 카운터가
    움직였다**"와 "**실제로 이 세션을 경쟁자가 넘겨받았다**"를 구분하지 못하는 데 있다 — 후자가
    성립하지 않는데도(경쟁자가 `saved===null` 로 아무것도 안 했는데도) 전자만으로 `start()` 의 정당한
    seed 를 폐기한다. 단순히 `seedWaitingFromStatus` 의 WAITING 게이트에 `sessionEstablished()`
    를 AND 로 추가(`attempt && cannotApplyConfig(attempt) && sessionEstablished()`)하는 방향을
    검토했으나, 이것만으로는 부족함을 직접 확인했다 — §3(재전송) 의 resolve-순서-역전 시나리오
    (두 `applyConfig` 복원이 경합할 때 **대체된 쪽이 먼저** resolve 하고 **대체한 쪽은 아직 스트림을
    열기 전**인 순간)에서는 `sessionEstablished()` 가 그 순간 아직 `false` 라 대체된 쪽의 옛 스냅샷이
    일시적으로 화면에 그려지는 flicker 를 재도입할 수 있다(대체한 쪽이 뒤이어 자기 스트림을 열며
    최종적으로는 덮어쓰지만, 그 사이 잘못된 내용이 한 틱 노출된다). 즉 "boot 카운터 이동" 과 "스트림
    개설 여부" 만으로는 안전한 단일 predicate 를 못 만든다 — "이 seed 가 응답할 때쯤 **다른 경쟁자가
    실제로 이 세션에 대해 진행 중이거나 이미 이겼는가**"를 판별할 더 정밀한 신호(예: 경쟁자가
    `sessionRef.current` 를 자신의 세션으로 이미 교체했는지 등)가 필요해 보인다 — 설계는 developer
    트랙. 무엇을 하든 **이 시나리오(webhook in-flight 중 아무것도 복원 못 하는 재전송)를 포착하는
    회귀 테스트를 반드시 추가**할 것 — 현재 `3223`행 테스트는 재전송이 persist **이후**에 도착해
    복원에 **성공하는** 경우만 다뤄 이 창을 커버하지 않는다.

- **[WARNING] plan 문서에 `23_58_23` 라운드 전체(신규 CRITICAL 1건 + fix)를 기록하는 "진행 기록/후속" 섹션이 없다 — 독립적으로 documentation.md 와 수렴**
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:91,141`(대조 대상: 이미 정정된
    `codebase/channel-web-chat/src/widget/use-widget.ts:271-275`·`:507-514` JSDoc) · 파일 끝
    `:306-360`(가장 최근 섹션이 여전히 `## 후속 (18_39_11 처리 — 2026-07-17)`).
  - 상세: 이전 라운드(`23_58_23`) concurrency·requirement·side_effect 세 리뷰어가 공통으로
    "`beginBootAttempt`/`seedWaitingFromStatus` JSDoc **과** `plan` 문서(:91,141 지목) 의 `start()`/
    `sendCommand`/`seedWaitingFromStatus` 는 world 축만 필요' 서술을 함께 정정할 것"을 명시 제안했다
    (`review/code/2026/07/17/23_58_23/{concurrency,side_effect}.md`). 코드 JSDoc(`:271-275`,
    `:507-514`)은 `start()` 가 이제 boot 축도 필요하다고 정확히 갱신됐으나(직접 대조 확인), **plan
    문서의 `:91`·`:141` 두 줄은 여전히 옛 주장("world 축만 필요하므로 기존 `isStale(gen)` 유지")을
    그대로 갖고 있다** — 이 두 줄은 착수 시점("설계 방향" 절)의 계획 서술이라는 성격을 감안해도, 이
    plan 파일은 매 라운드(A 완료·B 완료·A-6 완료·flicker fix·7번째 거울상·`18_39_11` 처리 등)마다
    `## 진행 기록` 또는 `## 후속 (... 처리)` 섹션으로 무엇이 갱신됐는지 예외 없이 기록해 온
    **확립된 자기 컨벤션**을 갖는데(`grep '^## '` 로 확인), `23_58_23` 라운드만 그 컨벤션에서
    빠져 있다(`:303` 의 `useEiaSession` 분리 근거로 "23_58_23 기준" 을 인용하는 한 줄 곁가지가
    전부). 이 plan 은 `webchat-usewidget-extraction.md` 가 "곧 `complete/` 이동" 이라 명시할 만큼
    완료가 임박해 있어, 지금 채우지 않으면 **이 plan 자신이 §후속(신규) 에서 이미 경고한 바로 그
    이월 유실 패턴**(`--impl-done 19_46_54 plan_coherence` WARNING 인용)이 반복된다. 독립적으로
    `documentation.md`(같은 라운드)도 동일 갭을 발견해 WARNING 으로 지목했다 — 두 관점(requirement·
    documentation)이 수렴한다는 것은 이 갭이 우연한 개인 판단이 아님을 시사한다.
  - 제안: `complete/` 이동 전에 `## 후속 (23_58_23 처리 — 2026-07-17)` 섹션을 추가해 9번째 거울상
    (`start()` 무방비 되감기, CRITICAL) 과 그 fix(`7cfbf2557`), WARNING 5건 처리(`a2cd6ebb7`)를 기존
    라운드들과 같은 형식으로 요약하고, `:91`·`:141` 옛 주장에는 `~~취소선~~` + "정정: ..." 식(이미
    `:300` 이 쓰는 패턴)으로 정정 표시를 남길 것. **위 CRITICAL 이 이번 라운드에서 확정되면 그 후속
    라운드 기록도 이 절에 함께 누적**돼야 이월 유실을 막는다.

- **[INFO] `7cfbf2557` 자체 — 지시된 검증 대상(23_58_23 CRITICAL) 은 정확히 닫혔고 spec §3(재전송) 계약과 정합한다**
  - 위치: `use-widget.ts:612-666`(`start()`) · `:520-581`(`seedWaitingFromStatus`) ·
    `use-widget-eager-start.test.ts:3223`(신규 회귀 테스트) · spec
    `spec/7-channel-web-chat/2-sdk.md:110-115`(§3 "`wc:boot` 재전송" 조항, "위젯은 **마지막** `wc:boot`
    의 config 를 적용").
  - 상세: 격리 mutation 으로 직접 재현·원복했다 — `:651` 의 `{ boot: bootAtStart }` 인자를 제거하면
    (fix 이전 상태로 되돌리면) `npx vitest run`(channel-web-chat 전체, 22파일) 결과 **391건 중 정확히
    1건**(신규 회귀 테스트 `3223`)만 실패하고, 실패 메시지도 커밋 메시지의 주장(`expected 'n1' to be
    'n2'`) 그대로였다. 인자를 복원하면 391건 전원 통과, `npx tsc --noEmit` 클린. 즉 커밋 메시지의
    "mutation: boot 스냅샷 인자 제거 → 정확히 이 테스트만 실패(n1)" 주장은 과장 없이 정확하다.
    설계도 견고하다 — `start()` 는 `beginBootAttempt()` 를 호출하지 않고(부팅 시도로 등록되지 않음)
    `bootGenRef.current` 를 읽기전용으로만 캡처해 `applyConfig` 쪽 supersede 카운팅을 오염시키지
    않으며, `outcome !== "continue"` 조기 return(`:652`)이 화면 되감기와 두 번째 `openStream` 호출을
    **한 게이트**로 함께 막는다. 이 접근은 직전 라운드에서 concurrency·side_effect 두 리뷰어가
    **각자 독립적으로 제안한 정확한 형태**(읽기전용 스냅샷, `beginBootAttempt()` 미사용)와 정확히
    일치한다(`review/code/2026/07/17/23_58_23/{concurrency,side_effect}.md` §제안 대조 확인) — 리뷰
    제안이 그대로 채택·구현된 드문 사례로, 설계 근거가 코드 밖에도 이중으로 남아 있다. 종료 확정
    분기(`:543-546`)는 `attempt` 를 참조하지 않아 world 축만 보는 기존 정책을 그대로 상속하므로,
    대체된 `start()` seed 가 발견한 진짜 종료도 놓치지 않는다(코드 경로가 `applyConfig` 복원 분기와
    완전히 동일한 공유 함수라 구조적으로 보장됨 — 별도 테스트 없이도 자명).
  - 제안: 없음 — 이 좁은 검증 대상 자체는 신뢰 가능하다(단, 위 CRITICAL 이 보여주듯 "인접 조합"까지
    안전하다는 뜻은 아니다).

- **[INFO] A-6 관련 변경(`widget-state.ts`/`widget-state.test.ts`) — spec `3-auth-session.md` §3.1-2/§3.1-3 과 line-level 재확인, 이번 라운드 diff 무변경**
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:125-146`(`RESTORED`/`BOOTED` 무가드) ·
    `widget-state.test.ts:67-79`(신규 `it.each` 회귀) · spec `spec/7-channel-web-chat/3-auth-session.md:62`
    (§3.1 "v1 구현 현황"), `:78-79`(§3.1-3 storage 정리 조건 닫힌 열거).
  - 상세: 이번 diff 범위(merge-base..HEAD)에 포함돼 있으나 `7cfbf2557` 이 만든 변경이 아니라 이전
    라운드(`18_39_11`) 의 A-6 되돌림이 그대로 실려 있는 것이다. spec §3.1-3 이 storage 정리 조건을
    "SSE terminal · 복원 시 200+terminal·404·복구불가 401 · 명령 410" 으로 닫힌 열거하고 "그 외 명령
    실패"를 포함하지 않는 것, §3.1-2 가 "200+running/waiting_for_input → 복원"을 명시하는 것을
    직접 재확인했다 — `RESTORED`/`BOOTED` 에 `ended` 가드를 두지 않는 현재 구현과 정확히 일치한다.
    `WAITING` 케이스에만 남은 `ended` 가드(`:165`)는 다른 축(world 변경 후 도착한 옛 세계의 stale
    seed)을 막는 것이라 spec 과 상충하지 않는다.
  - 제안: 없음.

## 요약

지시받은 핵심 대상인 `7cfbf2557`(`start()` 의 지연 seed 를 읽기전용 boot 스냅샷으로 보호)은 **직전
라운드가 지목한 CRITICAL(화면 되감기 + 이중 스트림)을 정확히, 과장 없이 닫았고**, 그 설계는
`spec/7-channel-web-chat/2-sdk.md §3(재전송)` 의 "마지막 `wc:boot` 적용" 계약 및 이번 diff 에 함께 실린
A-6 변경(`3-auth-session.md` §3.1 정합)과 어긋나지 않는다 — mutation A/B 대조로 직접 재확인했다. 그러나
**같은 fix 가 새 CRITICAL 을 도입한다**: `start()`의 webhook POST 가 아직 in-flight 인(세션이 storage
에 쓰이기 **전**) 구간에 **아무것도 복원할 게 없는**(따라서 완전히 무해해 보이는) `wc:boot` 재전송이
도착하기만 해도, 공유 `bootGenRef` 가 올라가면서 `start()` 자신의 뒤이은 정당한 seed 가 "대체된 시도"로
오판돼 `WAITING` dispatch 와 `openStream` 이 모두 스킵되고 **위젯이 `streaming`(로딩 스피너)에 영구
고착**된다 — 에러도, 재시도도, 같은 마운트 안의 회복 경로도 없다. 이 창(webhook in-flight, persist 전)은
직전 CRITICAL 이 막은 창(seed getStatus in-flight, persist 후)보다 더 이르고 더 넓으며, 도달 조건은
동일하게 이 PR 이 스스로 근거로 드는 "무디바운스 재전송 + eager 즉시시작" 뿐이다. A/B 로 fix 이전
코드에서는 이 시나리오가 정상 통과함을 확인해 **`7cfbf2557` 이 새로 만든 회귀임을 확정**했다. 완료된
5개 병렬 리포트를 교차 확인한 결과 이 정확한 조합("허용되지만 복원할 게 없는 재전송")을 다룬 리포트는
없었다(`concurrency.md` 는 인접한 BLOCKED/무효-config 두 조합만 검증). 부수적으로, plan 문서가 이번
라운드(23_58_23) 전체를 기록하는 관례적 "후속" 섹션을 아직 갖지 못한 문서화 갭도 확인했다(
`documentation.md` 와 독립 수렴).

## 위험도

CRITICAL — 지시받은 검증 대상(`7cfbf2557`) 자체는 견고하지만, 같은 커밋이 실사용 가능한 조건에서
위젯을 영구 고착시키는 새 CRITICAL 을 도입했음을 직접 재현(격리 mutation A/B, 원복 완료)으로 확인했다.
병합 전 반드시 처리 — 최소한 이 시나리오를 포착하는 회귀 테스트를 추가하고, 근본 수정 방향(경쟁자가
"boot 세대만 움직였는지" 가 아니라 "실제로 이 세션을 넘겨받았는지")을 재설계할 것을 권한다.

STATUS=success requirement PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/00_51_53/requirement.md risk=CRITICAL
