# Security Review — webchat-boot-single-flight

## 검증 방법 (요약)

- prompt_file 의 diff(2493줄, 일부 생략 포함)를 전량 확보 후, 웹챗 관련 실제 파일을 디스크에서 전문 Read:
  `use-widget.ts`(968줄 전체), `widget-state.ts`(223줄 전체), `widget-state.test.ts`(관련 hunk),
  `use-widget-eager-start.test.ts`(2693줄 중 boot/supersede/ERROR 관련 시나리오 전수),
  `host-bridge.ts`(origin 핀 로직), `session-store.ts`(토큰 만료·폐기 로직).
- `plan/in-progress/webchat-boot-single-flight.md` 전문 대조(설계 의도·회귀 이력·mutation 검증표).
- `git log`/`git diff`(2-dot vs 3-dot)로 prompt_file 에 포함된 대규모 `.claude/_shared/**` 등
  harness 관련 "삭제"의 실제 출처를 git 히스토리로 직접 검증(아래 발견사항 #5).

## 발견사항

- **[INFO]** supersede(`bootGenRef`)는 임베드 origin 검증(`isEmbedAllowed`)을 우회시키지 않는다 — 확인됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:840-857`(`applyConfig`),
    `:261-270`(`beginBootAttempt`/`isAttemptStale`), `:49-64`(`isEmbedAllowed`)
  - 상세: `applyConfig(cfg)` 호출마다 `beginBootAttempt()`로 새 시도 토큰 `{world, boot}`을 캡처하고,
    그 **동일 클로저의 `cfg`**로 `await isEmbedAllowed(cfg.apiBase, cfg.triggerEndpointPath)`를 수행한다.
    `isAttemptStale(attempt)`는 그 결과가 **적용될지 여부**만 게이팅할 뿐 — 어떤 시도도 "다른 시도가
    수행한 origin 검증 결과"를 대신 사용하거나, 검증을 건너뛰고 `establishConfig(cfg)`에 도달하는
    경로가 없다. 즉 "차단돼야 할 config 가 적용"되는 경로도, "허용된 config 가 (검증 누락으로) 차단"되는
    경로도 코드 구조상 존재하지 않는다 — 매 시도가 **자기 자신의 cfg에 대해서만** 독립적으로 판정한다.
    resolve 순서가 뒤섞인 케이스(먼저 진입한 시도가 나중에 resolve)까지 포함해
    `use-widget-eager-start.test.ts:2449`(§106 resolve 역전) · `:2103`(차단된 부팅 중 리셋)
    · `:2275`/`:2359`(혼합 순서 양방향)가 실측으로 고정한다. `isEmbedAllowed` 자체가 fail-open
    (4-security §3-①, `use-widget.ts:50-52`)인 것과 supersede 게이팅은 **독립된 축**이며, 이번 diff가
    fail-open 판정을 우회 가능하게 넓히는 지점은 없었다.
  - 제안: 조치 불필요 — 설계·구현·테스트가 정합함을 확인했다.

- **[INFO]** 대체된(superseded) 시도가 `BLOCKED`를 디스패치하지 않는 것은 "차단이 조용히 넘어가는" 결함이 아니라, 살아있는 시도의 독립 판정을 은폐하지 않기 위한 의도된 설계다 — 확인됨
  - 위치: `use-widget.ts:849-853`(`if (isAttemptStale(attempt)) return;` 이 `BLOCKED` 디스패치보다 먼저 옴)
  - 상세: `isAttemptStale` 게이트가 `!allowed` 체크보다 **앞**에 있어, 대체된 시도는 자신의 origin 판정
    결과(허용이든 차단이든)와 무관하게 조기 `return`하고 어떤 dispatch도 하지 않는다. 이게 "차단돼야
    할 상황의 은폐"가 되려면 **최종적으로 화면을 결정하는 살아있는 시도**가 자신의 origin 검증 없이
    통과해야 하는데, 그런 경로는 없다(위 항목 참조) — 살아있는 시도는 항상 자기 cfg 로 `isEmbedAllowed`를
    다시 수행한다. `use-widget-eager-start.test.ts:2275`("겹친 부팅의 결과가 갈릴 때, 차단된 쪽이
    살아있는 쪽의 리셋을 지우지 않는다")과 `:2359`("나중 진입이 차단으로 먼저 끝나도 먼저 진입한 쪽이
    리셋을 이행한다")가 정확히 이 비대칭 순서 조합을 각각 고정하며, 두 테스트 모두 "대체된 시도가
    `phase`를 어느 방향으로도 덮지 않는다"를 명시적으로 단언한다. 유일한 부수 효과는 UX 관점의
    관측성 저하(대체된 시도가 차단됐었다는 사실이 host에 노출되지 않음)이며 보안 우회는 아니다.
  - 제안: 조치 불필요.

- **[WARNING]** `RESTORED`/`BOOTED`의 `ended` 리듀서 가드는 **화면(phase) 전이만** 막을 뿐, `applyConfig` 복원 분기의 네트워크 부작용(구 토큰으로 `getStatus`/SSE 재오픈/토큰 갱신 예약)까지 구조적으로 막지는 못한다 — 오늘은 안전하지만 그 안전성이 "구조"가 아니라 "여러 곳에 흩어진 불변식"에 의존한다
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:126-143`(RESTORED/BOOTED 가드) ·
    `use-widget.ts:838-883`(`applyConfig` 복원 분기 — `RESTORED` dispatch가 `seedWaitingFromStatus`/
    `openStream`/`scheduleRefresh`보다 **먼저** 옴) · `use-widget.ts:569-576`(`start()` catch, ERROR
    디스패치 전에 `teardownSession()` **미호출**) vs `:598-611`(`sendCommand` catch 의 non-410 분기는
    `teardownSession()`을 **호출**, PR #964 에서 이미 fix됨) · `session-store.ts:56-60`(`loadSession`은
    만료 토큰만 자가 폐기)
  - 상세: 이번 diff가 추가한 `if (state.phase === "ended") return state;` 가드는 리듀서 레벨(순수
    함수)이라 **상태값(phase)만** 보호한다. 그런데 `applyConfig`의 복원 분기는 `RESTORED` dispatch →
    (리듀서가 no-op으로 흡수) → 그 **다음 줄부터도 계속 실행**되어 `sessionRef.current = saved`(구
    토큰으로 in-memory 세션 갱신), `seedWaitingFromStatus(client, saved)`(구 토큰으로 실제 `getStatus`
    REST 호출), 그리고 `outcome === "continue"`면 `openStream(saved, "0")` + `scheduleRefresh()`(구
    토큰으로 실제 SSE 연결 오픈 + 토큰 갱신 타이머 예약)까지 전부 수행한다 — 즉 화면은 `ended`로 남아도
    **백그라운드에서 구 토큰 세션이 실제로 되살아날 수 있는 코드 경로**가 존재한다. 이 부작용/화면
    분리는 `use-widget.ts:604`의 기존 주석("리듀서의 `ended` 가드는 화면만 막을 뿐 이 부작용은 못
    막는다")에서 개발자 스스로도 명시하고 있다.
    오늘 이 경로가 안전한 이유는 순전히 **`sessionStorage`가 이미 비어 있어 `loadSession`이 애초에
    `null`을 반환**하기 때문이다(`if (saved) {...}` 분기 자체에 진입하지 않음) — `sessionRef.current`가
    `null`이 되는 유일한 지점(`resetSessionRefs()` :682)이 항상 `teardownSession()`의 `clearSession()`
    호출(같은 동기 호출 체인)과 짝을 이루고, `start()`의 유일한 무방비 ERROR 경로(:569-576)는
    `if (startedRef.current || sessionRef.current) return;`(:534) 가드로 인해 **storage가 이미 비어
    있음이 구조적으로 보장되는 상태에서만** 도달 가능하기 때문이다(직접 코드 추적으로 확인).
    문제는 이 안전성이 **"어디서도 검증되지 않는 다중 지점 불변식"**(sessionRef null ⟺ storage clear,
    start()의 가드 조건 불변)에 의존한다는 점이다 — 정확히 이 파일이 plan 문서(`webchat-boot-single-flight.md`
    §"⚠ 착수 전 필독")가 스스로 인정하듯 "비대칭 가드 누락으로 3번 CRITICAL을 냈고, 폐기 로직으로 네 번
    시도해 네 번 다 반대편 구멍이 났던" 실패 계열과 같은 모양이다. 실제로 같은 plan 문서 §A-6은 "ERROR는
    ... teardownSession을 거치지 않는 **유일한** 종료 경로"라고 서술하는데, 코드상 ERROR dispatch는
    두 곳(`start()`의 :575, `sendCommand`의 :610)이고 **하나는 이미 정리하며 하나는 여전히 안 한다** —
    이 서술 자체가 두 경로를 하나로 뭉뚱그린 것으로 보이며, 향후 유지보수자가 "ERROR는 이제 다
    정리된다"고 오독할 여지를 만든다. `start()`의 가드 조건이나 `persist()` 호출 순서가 향후 바뀌면
    (예: `persist()`를 `startConversation` 호출 전으로 당기거나, 세 번째 ERROR 호출부가 추가되는 등)
    이 latent 경로가 실제로 열릴 수 있다.
  - 제안: (a) `start()`의 catch 블록에도 `teardownSession()`을 호출해(현재는 중복이라도) 대칭을 맞출 것.
    (b) 더 근본적으로는 이 파일이 이미 채택한 철학("가드는 규율이 아니라 구조")을 여기에도 적용해,
    `finalizeEnded`처럼 **모든 `ERROR` dispatch를 감싸는 단일 헬퍼**(예: `failWithError(message)` →
    내부에서 항상 `teardownSession()` 후 `dispatch(ERROR)`)로 구조화할 것. 이러면 향후 세 번째 ERROR
    호출부가 추가되더라도 정리를 빠뜨리는 것이 코드 리뷰 없이도 불가능해진다. (c) plan 문서 §A-6의
    "ERROR는 유일한 종료 경로다" 서술을 "sendCommand의 ERROR 경로는 이미 정리한다 / start()의 ERROR
    경로는 아직 안 한다(단, 구조적으로 도달 시점에 storage가 항상 비어 있어 오늘은 안전)"로 정정해
    향후 오독을 막을 것.

- **[INFO]** `wc:boot` 재전송의 host origin 핀은 supersede(`bootGenRef`)와 완전히 독립된 상위 계층에서 강제되어 약화되지 않는다 — 확인됨
  - 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts:45-58`(`onMessage` 핸들러의 origin 핀)
  - 상세: `hostOrigin`은 **첫** `wc:boot`의 `MessageEvent.origin`(브라우저가 부여하는, 페이로드로 위조
    불가능한 값)으로 핀되고, 이후의 모든 `wc:boot`(및 `wc:command`)은 `e.origin !== hostOrigin`이면
    `bootCb`/`commandCb` 호출 자체 없이 `return`된다(`:53-54`, `:58`). 이 필터는 `applyConfig`/
    `bootGenRef`가 정의된 `use-widget.ts`보다 **완전히 앞단**(postMessage 수신 즉시)에서 동작하므로,
    `bootGenRef`는 애초에 **origin 핀을 통과한 메시지에 대해서만** 세대를 배정한다 — supersede 로직이
    아무리 바뀌어도 다른 origin의 `wc:boot`이 `applyConfig`에 도달할 방법 자체가 없다. `e.source !==
    parent` 체크(:47, 이 diff 밖의 기존 코드)도 동일하게 브라우저가 보증하는 값이라 스크립트로 위조
    불가능하다.
  - 제안: 조치 불필요. (참고로 `e.source`가 falsy일 때 그 소스 체크를 건너뛰는 기존 로직은 이번 diff의
    변경 대상이 아니라 리뷰 범위 밖으로 판단해 별도 지적하지 않음.)

- **[WARNING]** 리뷰 payload(prompt_file)에 이 브랜치와 무관한 대규모 harness 변경이 "삭제"로 포함되어 있음 — `origin/main` 대비 stale base 로 인한 diff 생성 아티팩트로 판단됨. 그대로 rebase 없이 push/병합하면 이미 수정된 보안 관련 게이트 결함이 되살아날 위험이 있어 별도 보고
  - 위치: prompt_file 의 파일 1~12·20~21·23~36(`.claude/_shared/report_paths.py` 삭제,
    `review_guard.py`/두 orchestrator 의 report-path 판정을 shared 모듈 이전 상태로 되돌림,
    `.github/workflows/harness-checks.yml`의 `.claude/_shared/**` CI 트리거 삭제, 관련 테스트·리뷰
    세션 산출물 삭제 등)
  - 상세: 이 브랜치(`webchat-boot-single-flight-8c92b4`)의 merge-base는 `14bc86a53`(#965)인데,
    `origin/main` HEAD는 이미 `67871ffbd`(**#966 "report-path 규칙을 공유 모듈로 — 이미 발생한
    게이트↔CLI 드리프트 해소"**, `.claude/_shared/report_paths.py` 신설 PR)까지 진행돼 있다
    (`git merge-base --is-ancestor` 로 확인). `git diff origin/main...HEAD`(3-dot, 실제 PR이 보게 될
    diff)로 검증한 결과 이 브랜치가 **실제로 변경하는 파일은 6개뿐**(`widget-state.ts`/`.test.ts`,
    `use-widget.ts`, `use-widget-eager-start.test.ts`, `plan/in-progress/webchat-boot-single-flight.md`,
    `spec/7-channel-web-chat/2-sdk.md`)이며 harness(`.claude/**`) 파일은 전혀 건드리지 않는다 —
    즉 prompt_file 의 harness 관련 "삭제"들은 이 브랜치 자신의 커밋이 되돌린 것이 아니라, 리뷰 payload를
    만든 diff 계산이 **2-dot(`origin/main HEAD` 대비)** 방식이라 "이 브랜치엔 아직 없는, main에만 있는
    최근 커밋들"이 삭제로 잡힌 것으로 판단된다. 다만 이것이 review 도구의 표시 문제로 끝난다는 보장은
    없다 — 만약 실제 push/PR/병합 시점까지 이 로컬 브랜치가 `origin/main`으로 rebase되지 않는다면,
    사용된 병합 전략에 따라 PR #966이 고친 **바로 그 보안 관련 결함**(gate와 `--verify-coverage` CLI가
    "빈 리포트"를 다르게 판정하던 드리프트, `has_report()`가 `isfile()` 없이 디렉터리를 리포트로
    오판하던 결함)이 실제로 되돌아갈 수 있다. 이는 `CLAUDE.md`/사용자 메모리에도 기록된 기존 위험
    패턴("ensure-worktree stale base — 그대로 PR 하면 머지 PR 을 silent revert")과 정확히 일치한다.
    본 리뷰의 나머지 모든 CRITICAL/WARNING/INFO 판정은 위에서 확인한 **3-dot 기준 실제 6개 파일**만을
    대상으로 했으며, harness 관련 "삭제"는 웹챗 보안 리뷰의 본 대상이 아니라고 판단해 별도 항목으로만
    보고한다.
  - 제안: push/PR 전에 `git fetch origin main && git rebase origin/main`(또는
    `.claude/tools/ensure-worktree.sh` 재실행)으로 최신 base를 반영하고, `git diff origin/main...HEAD
    --stat`로 실제 변경 파일이 웹챗 6개뿐임을(harness 파일이 다시 나타나지 않음을) 재확인할 것.
    아울러 이 세션의 다른 리뷰어(scope·architecture 등) 출력도 같은 아티팩트로 인해 범위를 오판했을 수
    있으니 SUMMARY 통합 시 교차 확인 권장.

- **[INFO]** 일반 보안 점검 결과 — 이상 없음
  - 위치: 실제 3-dot diff 6개 파일 전체
  - 상세: 하드코딩된 시크릿(API 키/토큰/비밀번호) 없음. SQL/커맨드/LDAP 인젝션 대상 자체가 없음(DB·셸
    호출이 없는 순수 프론트엔드 상태기계/훅 변경). 신규 렌더링 경로가 없어 XSS 표면 추가 없음(변경분은
    ref/reducer 전이·비동기 재검증 로직). 토큰 전송 방식(sessionStorage 저장, `EiaClient` 경유 HTTPS
    호출)은 이번 diff가 바꾸지 않음 — 안전하지 않은 평문 전송·약한 해시 신규 도입 없음. 에러 메시지는
    기존 `errMessage()`/`GENERIC_ERROR_MESSAGE` 패턴을 그대로 사용해 서버/예외 원문을 UI에 노출하지
    않으며(`use-widget-eager-start.test.ts:655` "W1" 테스트가 이를 고정), 이번 diff가 그 경로를 우회하지
    않는다. 신규/변경된 의존성 없음.
  - 제안: 없음.

## 요약

핵심 검토 대상인 웹챗 부팅 single-flight 변경(`bootGenRef`/`beginBootAttempt`/`isAttemptStale`,
`establishConfig` 추출, `widget-state.ts`의 `RESTORED`/`BOOTED` `ended` 가드 확대)은 요청받은 4개 관점
모두에서 실질적 보안 결함을 만들지 않는다: supersede는 매 시도가 자기 자신의 config로 독립적으로
`isEmbedAllowed`를 재수행하도록 설계되어 있어 origin 검증을 우회하지 않고(허용/차단 어느 방향으로도
오판 경로가 없음, 코드·테스트로 확인), 대체된 시도의 `BLOCKED` 미디스패치는 살아있는 시도의 독립 판정을
가리지 않으며(전용 회귀 테스트 2건이 순서를 뒤집어가며 고정), `wc:boot` origin 핀은 `host-bridge.ts`의
postMessage 계층에서 supersede 로직보다 구조적으로 앞서 강제되어 전혀 약화되지 않는다. 유일하게
방어심층(defense-in-depth) 관점에서 짚을 지점은 `RESTORED`/`BOOTED`의 `ended` 가드가 **화면 전이만**
막고 `applyConfig` 복원 분기의 네트워크 부작용(구 토큰 `getStatus`/SSE 재오픈/토큰 갱신)은 구조적으로
막지 못한다는 점이다 — 오늘은 `sessionRef`-storage 동기화 불변식 덕에 안전하지만, 이 파일이 스스로
기록한 "비대칭 가드 누락 반복" 이력을 감안하면 `start()`의 ERROR 경로에도 `teardownSession()`을
명시적으로 대칭 적용하거나 ERROR 디스패치를 구조적으로 통합하는 편이 안전하다(WARNING). 별도로, 이번
리뷰의 diff payload 자체에 이 브랜치와 무관한 harness 보안 게이트 관련 대규모 변경이 "삭제"로 섞여
있었는데, git 히스토리로 직접 검증한 결과 이는 이 브랜치가 `origin/main`의 최근 병합 PR(#966, 게이트↔CLI
드리프트 보안 수정)을 아직 반영하지 못한 stale base 아티팩트였다 — 실제 코드 결함은 아니지만 rebase 없이
그대로 push하면 이미 고쳐진 보안 관련 게이트 결함이 되살아날 수 있어 병합 전 조치가 필요하다(WARNING).

## 위험도

LOW
