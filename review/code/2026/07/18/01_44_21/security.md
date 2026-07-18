# 보안(Security) 리뷰 — webchat-boot-single-flight (01_44_21)

## 범위·방법

`prompt_file` 페이로드는 3파일(`review/consistency/2026/07/17/19_46_54/plan_coherence.md`·
`rationale_continuity.md` — 이전 라운드 consistency-checker 산출물, `spec/7-channel-web-chat/2-sdk.md`
frontmatter `code:` 4줄 추가)만 담고 있어, 오케스트레이터가 지정한 "이번 라운드 핵심" 커밋
`cffee0d28`(코드 본체)가 payload 에서 잘려 있었다(직전 `plan_coherence.md` 리뷰가 스스로 기록한
"진행 중 plan 문서 모음 크기 제한 truncation"과 동일 패턴). payload 를 신뢰하지 않고 worktree 를
SoT 로 직접 조사했다:

- `git log --oneline -15` 로 라운드 경계 확정: `cffee0d28`(코드 재설계) → `206d27cee`(CHANGELOG·plan
  정합, docs-only) → `2b4f198c1`(00_51_53 SUMMARY+RESOLUTION, review 산출물뿐) = 현재 `HEAD`.
- `git show --stat cffee0d28` + `git show cffee0d28 -- use-widget.ts` 로 재설계 diff 전문 대조(2파일:
  `use-widget.ts` +107/-62, `use-widget-eager-start.test.ts` 테스트만).
- `codebase/channel-web-chat/src/widget/use-widget.ts`(1087행) 전문 Read, `widget-state.ts`(227행)
  전문 Read — A-6 되돌림 상태(`RESTORED`/`BOOTED` 무가드, `WAITING` 만 가드) 현재 코드에서 재확인.
- `git diff $(git merge-base origin/main HEAD)..HEAD --stat` 로 이번 PR 전체 변경 파일 53개 확정 —
  `sendCommand`·`session-store.ts`·`use-token-refresh.ts`·`eia-client.ts`·`host-bridge.ts` 는 **어느
  커밋에서도 변경분이 없음**(파일명 자체가 diff stat 에 없음)을 직접 확인.
- 직전 두 라운드의 security.md(`23_58_23`·`00_51_53`)를 대조해 "A-6 되돌림 stale 토큰 4겹 경계"·
  "`apiBase` 축 이월" 결론의 근거 파일을 확인하고, 그 파일들이 이번 델타에도 없음을 재검증.
- 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성)는 merge-base..HEAD 전체 diff에
  대해 재실행(패턴 grep, 0건).

---

## 발견사항

- **[INFO] (핵심 확인 1) `cffee0d28` 은 신규 인증/토큰/네트워크 표면을 만들지 않는다 — 순수 클라이언트 동시성 가드 교체**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:323`(`sessionEstablished = () =>
    streamRef.current !== null`), `:528-589`(`seedWaitingFromStatus`, 3번째 인자
    `attempt?: {boot}` → `opts?: {allowWhileStreaming}`), `:559`(WAITING 게이트),
    `:621-671`(`start()`, `bootAtStart` 캡처 제거), `:990-999`(`applyConfig` 복원 분기).
  - 상세: 변경은 (a) WAITING 표면 dispatch 게이트를 `bootGenRef` 정수 비교에서
    `streamRef.current !== null` boolean 판정으로 교체, (b) `seedWaitingFromStatus` 세 호출부 중
    `start()`/`applyConfig` 복원은 인자 없이(기본값=스트림 열렸으면 스킵), `replay_unavailable`
    폴백만 `{ allowWhileStreaming: true }` 로 호출하는 것뿐이다. `streamRef`는
    `EventSourceLike | null` in-memory ref(useRef)이고 `opts`는 `{ allowWhileStreaming?: boolean }`
    로 좁게 타입돼 있어 세션 객체·토큰·엔드포인트를 실어 나를 여지가 없다. 실제 네트워크 호출은
    변경 전후 동일하게 `client.getStatus(session.endpoints, session.token)`
    (`use-widget.ts:536`, 이번 diff 로 시그니처·호출 인자 불변) 하나뿐 — 새 엔드포인트·새 헤더·
    새 쿼리 파라미터 없음. `git show cffee0d28`로 diff 전문을 직접 대조해 `sendCommand`·
    `endConversation`·`newChat`(모두 인증/명령 발신 경로)이 **한 글자도 변경되지 않았음**을
    확인했다.
  - 제안: 없음(확인 목적).

- **[INFO] (핵심 확인 1 연장) 종료 확정(`finalizeEnded`→`teardownSession`) 분기는 이번 재설계로 축이 바뀌지 않았다**
  - 위치: `use-widget.ts:546-554`(terminal 분기 — `sessionEstablished()`/`opts` 를 전혀 참조하지
    않고 world 축(`isStale(gen)`)만 봄), JSDoc 표(`:502-505`) "종료 확정 | world 만".
  - 상세: 재설계 전후 모두 `finalizeEnded`(→ storage 삭제·SSE 닫기·타이머 정리)는 세션 스트림이
    열려 있는지와 무관하게 world 축 하나로만 게이팅된다 — 재설계가 건드린 것은 오직 "표면을
    다시 그릴지"(WAITING dispatch) 판정이지 "토큰/세션을 정리할지" 판정이 아니다. 정리 타이밍에
    부작용 없음.
  - 제안: 없음.

- **[INFO] (핵심 확인 2) 직전 라운드의 "A-6 되돌림 stale 토큰 4겹 경계 안전" 결론은 이번 재설계로 바뀌지 않는다**
  - 위치: `use-widget.ts:673-718`(`sendCommand`, A-6 되돌림이 위치한 비-410 catch 분기 — `git diff
    23_58_23 검증 시점..HEAD -- use-widget.ts` 로 대조 시 이 함수 자체는 `cffee0d28` diff 범위
    밖), `codebase/channel-web-chat/src/lib/widget-state.ts:125-146`(`RESTORED`/`BOOTED` — 현재
    코드에서도 `ended` 무가드 재확인).
  - 상세: `23_58_23/security.md`가 확립한 4겹 경계(① per_execution 토큰 scope — execution 하나로
    범위 고정, ② `loadSession`의 `expiresAt` 자동 TTL 폐기, ③ sessionStorage 탭종료 자동소거,
    ④ 서버측 `WebChatIdleReaperService` idle 회수)는 전부 `sendCommand`의 catch 분기와
    `widget-state.ts`의 가드 부재 구조에 근거한다. `cffee0d28`은 `use-widget.ts` 안에서도
    `seedWaitingFromStatus`/`start()`/`applyConfig`(복원 분기)만 건드리고 `sendCommand`는
    호출부 시그니처(`seedWaitingFromStatus(client, session)` 형태) 조차 참조하지 않는 완전히
    분리된 함수다 — 직접 Read 로 `sendCommand`(673-718행)의 로직이 이전 라운드가 검증한 코드와
    동일함을 재확인했다. `widget-state.ts`는 이번 재설계 커밋(`cffee0d28`)의 diff stat 에 파일명
    자체가 없다(테스트 1파일 + `use-widget.ts` 뿐). 따라서 4겹 경계 결론은 그대로 유효하다.
  - 제안: 없음(재확인만).

- **[INFO] (핵심 확인 2 연장) `apiBase` 축 이월(선행 결함) 결론도 이번 재설계로 악화되지 않는다**
  - 위치: `use-widget.ts:923-939`(`establishConfig` — `apiBase`로 `clientRef` 재구성, `cffee0d28`
    diff 범위 밖), `session-store.ts`(`PersistedSession` shape, apiBase 미기록) ·
    `use-token-refresh.ts`(타이머 재조합) — 둘 다 이번 PR 전체(`merge-base..HEAD`) diff stat 에
    파일명이 없음(53개 변경 파일 목록에 부재, 위 "범위·방법" 참조).
  - 상세: 재전송 시 옛 세션 토큰이 새 `apiBase` 로 전송될 수 있는 구조적 갭은 `establishConfig`의
    client 재구성 로직에 있고, 이 함수는 `cffee0d28`이 건드리지 않았다(재설계는
    `establishConfig` **호출 결과인** `saved`/`seedWaitingFromStatus` 호출부만 수정). 이 갭은
    consistency-checker 산출물(`plan_coherence.md`·payload 내 review/consistency 파일)도 동일하게
    "별도 트랙, 활성 충돌 아님"으로 재확인했다 — 보안 관점에서도 이번 재설계와 직교하는 축임을
    교차 확인했다.
  - 제안: 없음(별도 트랙, 본 재설계와 무관).

- **[INFO] (핵심 확인 3) `execution.replay_unavailable` 의 `{ allowWhileStreaming: true }` opt-in 은 세션/토큰 노출면을 넓히지 않는다 — 이미 열린 자기 스트림의 재동기화**
  - 위치: `use-widget.ts:424-437`(`handleEiaEvent` 의 `replay_unavailable` 분기 — `session =
    sessionRef.current` 캡처 후 `seedWaitingFromStatusRef.current?.(client, session, {
    allowWhileStreaming: true })` 호출), `:518-522`(JSDoc — "`replay_unavailable` 폴백만 넘긴다").
  - 상세: 이 분기는 (1) **서버 발신 SSE 이벤트**(호스트/iframe postMessage 경로가 아니라 이미
    `origin` 검증을 통과해 확립된 EIA 백엔드 SSE 연결에서만 옴 — `host-bridge.ts` 는 이번 PR
    전체 diff 에서 미변경, origin pin 로직 그대로), (2) 그 이벤트를 받는 조건 자체가 "이 세션의
    스트림이 이미 열려 있다"이므로, opt-in 이 참조하는 `session`/`client` 는 **바로 그 열려있는
    스트림과 동일한 세션 객체**(`sessionRef.current`)다 — 다른 세션·다른 토큰이 아니다.
    `seedWaitingFromStatus` 내부에서 실제로 나가는 요청도 `client.getStatus(session.endpoints,
    session.token)` 뿐이라 opt-in 유무와 무관하게 호출되는 엔드포인트·토큰이 동일하다(opt-in 은
    **응답을 화면에 반영할지**만 바꾸는 로컬 판정이지 네트워크 호출 자체를 새로 만들지 않는다).
    또한 `execution.replay_unavailable` 은 host 가 postMessage 로 트리거할 수 있는 이벤트가
    아니므로(서버 버퍼 만료 로직에만 종속), 호스트 페이지·제3자가 이 opt-in 경로를 임의로
    반복 유발해 다른 세션 데이터를 끌어오는 시나리오도 성립하지 않는다. `seedWaitingFromStatus`
    앞단의 `isStale(gen)`(world 축) 체크가 opt-in 여부와 무관하게 항상 먼저 실행되므로, 세계가
    바뀐(새 대화·종료·언마운트) 경우엔 opt-in 을 줘도 여전히 `"stale"` 로 조기 반환돼 옛 세션
    데이터가 새 세계에 반영되는 경로는 없다.
  - 제안: 없음(자기 스트림 재동기화, 새 표면 아님을 확인).

- **[INFO] `sessionEstablished()` 의 문서화된 불변식 의존 — 신규 결함 아님, 기존 `apiBase` 이월과 동일 축**
  - 위치: `use-widget.ts:307-321`(`sessionEstablished` JSDoc "⚠ 불변식 의존 주의" — 재전송
    호출부가 마운트 유지한 채 `triggerEndpointPath`/`apiBase` 를 바꾸지 않는다는 전제).
  - 상세: 재설계 코드 자신이 이미 "이 전제가 깨지면 새 endpoint 의 정당한 세션 복원이 조용히
    스킵된다"를 JSDoc 으로 명시하고, `pendingResetRef`의 동일 전제("불변식 의존 주의")와 나란히
    묶어 두었다. 이 전제는 위 "핵심 확인 2 연장"의 `apiBase` 축 이월 WARNING 과 **같은 근본
    가정**(재전송이 endpoint 를 바꾸지 않는다)에 기대므로 별개의 신규 위험이 아니라 이미
    추적 중인 이월 항목의 한 표현이다. 이 코드 자체가 새로 만든 exposure 는 아니며(잘못 갔을
    때의 실패 모드가 "복원 스킵"=가용성 저하이지 "잘못된 세션에 토큰 노출"이 아님), 별도
    security 항목으로 승격할 필요는 없다.
  - 제안: 없음(향후 `apiBase` 이월 항목 정리 시 이 JSDoc 도 같은 트랙에서 함께 재검토).

- **[INFO] 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) — 이번 라운드 diff 전체에서 이상 없음**
  - 위치: `git diff $(git merge-base origin/main HEAD)..HEAD` (53파일 전체, codebase/ 15파일 +
    plan/spec/review 38파일).
  - 상세: (1) 인젝션 — `dangerouslySetInnerHTML`/`innerHTML`/`eval(`/`new Function(`/
    `child_process`/`exec(` 패턴 grep 결과 codebase/ 추가분 0건. (2) 하드코딩 시크릿 —
    `password|secret|api[_-]?key|authorization|bearer|private[_-]?key|BEGIN (RSA|PRIVATE)`
    패턴을 codebase/ 및 전체 diff(plan/spec/review 포함)에 대해 grep — codebase/ 0건, 전체에서
    유일한 매치는 `plan/in-progress/webchat-usewidget-extraction.md`의 "`secret-store.md`: …
    `secret://` scheme 대상이 **아니라** 클라이언트 sessionStorage 저장 대상"이라는 규약-비대상
    설명 산문 1건뿐(실제 자격증명 리터럴 아님, 문맥 확인). (3) 암호화 — 해시/암호화 로직 변경
    없음. (4) 에러 처리 — `errMessage()`(`use-widget.ts:1083-1087`, 이번 diff 미변경)는
    원본 에러를 `console.warn` 에만 남기고 UI 에는 `GENERIC_ERROR_MESSAGE` 만 반환하는 기존 계약
    유지, `seedWaitingFromStatus` catch 블록의 `console.warn(err.message)` 도 이번 diff 로
    형태 불변. (5) 의존성 — `package.json`/lockfile 변경 없음(`--stat` 결과 공백).
  - 제안: 없음.

---

## 요약

이번 라운드 핵심 커밋 `cffee0d28`(되감기 방어를 boot 세대 비교 → `sessionEstablished()`(=
`streamRef.current !== null`)로 교체)은 오케스트레이터 지시대로 **순수 클라이언트 동시성 가드
교체**임을 코드 전문 대조로 확인했다 — 바뀐 것은 "지연 도착한 `getStatus` 응답을 화면에 반영할지"
판정 축뿐이고, 실제 네트워크 호출(`client.getStatus(session.endpoints, session.token)`)의
엔드포인트·토큰·호출 인자는 변경 전후 완전히 동일하다. `sendCommand`(A-6 되돌림이 위치한 명령
실패 처리 경로)와 `widget-state.ts`(RESTORED/BOOTED 무가드)는 이 재설계가 전혀 건드리지 않아,
직전 라운드가 확립한 "A-6 되돌림 stale 토큰 4겹 경계(scope/TTL/탭종료/idle-reaper) 안전" 결론이
그대로 유효하다. `apiBase` 축 이월(재전송 시 옛 토큰이 새 `apiBase` 로 전송될 수 있는 구조적
갭)의 근거 파일(`establishConfig`·`session-store.ts`·`use-token-refresh.ts`) 도 이번 PR 전체
53개 변경 파일 목록에 없어 악화되지 않았다. `execution.replay_unavailable` 의
`{ allowWhileStreaming: true }` opt-in 은 서버 발신 SSE 이벤트에만 반응하고 호스트가 postMessage
로 트리거할 수 없으며, 참조하는 `session`/`client` 가 이미 확립된 자기 스트림과 동일 객체이므로
"새 세션·새 토큰 노출면"이 아니라 자기 스트림의 재동기화다 — world 축 staleness 가드가 opt-in
과 무관하게 선행되므로 세계가 바뀐 뒤의 옛 세션 데이터 반영 경로도 없다. `sessionEstablished()`
JSDoc 이 스스로 인정한 "재전송이 endpoint 를 바꾸지 않는다"는 불변식 의존은 기존 `apiBase`
이월 항목과 같은 축이라 별도 신규 위험으로 보지 않았다. 표준 OWASP 체크리스트(인젝션·시크릿·
암호화·에러 노출·의존성)도 이번 라운드 전체 diff 에서 이상 없음을 확인했다. 신규 CRITICAL·
WARNING 없음.

## 위험도

LOW
