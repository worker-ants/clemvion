# 요구사항(Requirement) Review — `runApplyConfig` ERROR 전이 판정

대상 커밋: `f924815f1` "fix(webchat): 내 fix 가 부팅 실패를 조용히 삼키고 있었다 + Gate C 빌드 실패"
핵심 변경: `codebase/channel-web-chat/src/widget/use-widget.ts` `runApplyConfig` 의 `catch` 가
`console.warn` 단독 → `dispatch({ type: "ERROR", message: errMessage(e) })` 로 전이.

호출자가 요청한 3개 판정(a/b/c)을 중심으로 기재하고, 같은 payload 의 나머지 변경(파일 2~24)은
후반부에 경량 패스로 덧붙인다.

## 발견사항

- **[INFO]** (a) `ERROR`→`{phase:"ended", error: message}` 전이는 `1-widget-app.md §3.1` ·
  `4-security.md` 의 에러 정책 행과 line-level 로 일치한다
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:190-191` (reducer `case "ERROR"`),
    `codebase/channel-web-chat/src/widget/use-widget.ts:1272` (신규 dispatch)
  - 상세: `spec/7-channel-web-chat/1-widget-app.md` §3.1 표의 "토큰 만료/서버 타임아웃" 행이
    정의하는 위젯 상태는 정확히 `[ended] + "대화 종료, 새로 시작" 안내`다. `spec/7-channel-web-chat/4-security.md`
    §1 표의 "에러 메시지 노출" 행도 "에러 → [ended] + '새 대화 시작' 동작(1-widget-app §3.1)은
    유지하고 표시 문구만 일반화한다" 고 명시한다. 코드는 정확히 이 둘을 만족한다:
    `errMessage(e)` 가 진단 원문을 `console.warn` 으로만 남기고 `GENERIC_ERROR_MESSAGE`
    (`WIDGET_STRINGS.ko["error.generic"]`)를 반환 → `ERROR` action 의 `message` 가 됨 →
    reducer 가 `phase:"ended"` + `error: message` 로 커밋 → `panel.tsx:63` 의 `isEnded` 가 참이 되어
    read-only transcript + "새 대화 시작" CTA(`panel.tsx:176-179`)를 렌더한다. `start()`(기존,
    `use-widget.ts:890`)·`sendCommand()`(기존, `:934`)와 완전히 같은 패턴이라 세 진입점이 이제
    일관되게 이 정책을 구현한다.
  - 제안: 없음 — 유지 권장. 단 §5 인용 오류는 아래 별도 항목 참조.

- **[WARNING]** `4-security.md §5` 인용이 실제로는 §1 표 행을 가리켜야 한다 — 인용 번호 오류
  (콘텐츠 자체는 옳음)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1264-1266` (이번 diff 가 추가한 주석
    "`4-security.md §5` 가 그 함수를 '에러 문구 정책의 코드 SoT' 로 지목한다"). 같은 파일의
    기존(이 diff 밖) 주석 `use-widget.ts:1348` 도 동일하게 "(4-security §5)" 를 인용한다.
  - 상세: `spec/7-channel-web-chat/4-security.md` 의 실제 절 번호는 `## 1. 보안 정책 요약`(표,
    "에러 메시지 노출" 행이 여기 있음, 파일 line 38) · `## 2. CORS` · `## 3. 임베드 allowlist` ·
    `## 4. 공개 webhook 남용 방어` · `## 5. 프라이버시 / 데이터 처리` · `## 6. 접근성` 순이다.
    §5 는 "프라이버시/데이터 처리"(동의 고지·보존기간)로, 에러 메시지 정책과 무관한 절이다.
    `git log -S"4-security §5"` 로 추적하면 이 인용은 `b9acf02c7`(2026-07 초, 그룹 A PR)까지
    거슬러 올라가는 **선행 결함**이며 이번 diff 가 새로 만든 것은 아니지만, 이번 diff 가 그
    잘못된 인용을 한 곳 더 복제했다. 내용 자체(정책의 실체)는 정확해 기능적 영향은 없으나,
    향후 `consistency-check`/사람이 §5 를 열어 이 정책을 찾으려 하면 실패한다.
  - 제안: 코드 유지 + 인용만 `4-security.md §1`(또는 "§1 표 '에러 메시지 노출' 행")로 정정.
    `use-widget.ts:1348` 의 기존 인용도 같은 턴에 함께 고치는 것이 일관적(같은 결함의 두 사본).
    spec 자체는 옳으므로 SPEC-DRIFT 아님 — 코드 주석의 단순 오탈自.

- **[INFO]** (b) "부팅 전 실패가 아직 열지 않은 위젯을 `ended` 로 만드는가" — 이론상 우려는
  타당하나, 현재 코드 구조에서는 **재현 불가능**함을 실측 근거로 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1171-1247`(`applyConfig` 본문 —
    `runApplyConfig` 의 `catch` 대상), `codebase/channel-web-chat/src/lib/widget-state.ts:106-116`
    (`case "OPEN"`), `codebase/channel-web-chat/src/widget/widget-app.tsx:63-76`(open 시에만
    `Panel` 렌더)
  - 상세: `runApplyConfig` 의 `catch` 가 실제로 발동하려면 `applyConfig(cfg)` promise 가
    reject 해야 하는데, 그 안에서 던질 수 있는 지점을 전수 추적하면:
    1. `isEmbedAllowed()`(`:1179`) → 내부 `fetchEmbedConfig`(`:34-48`)가 `fetch`/`json()` 을
       자체 `try/catch` 로 감싸 항상 `null` 로 fail-open, `detectHostOrigin`(`host-bridge.ts:93-108`)도
       `ancestorOrigins`/`referrer` 접근을 각각 `try/catch` 로 감싸 **절대 throw 하지 않는다**.
    2. `establishConfig(cfg)`(`:1188`, sync) → `new EiaClient({apiBase})`(생성자가 검증/throw
       없음, `eia-client.ts:45-50`) + `setConfig`. `pendingResetRef.current` 가 참인 드문
       경로에서만 `apiRef.current.newChat()` 을 부르는데, 그 안의 `dispatch({type:"NEW_CHAT"})`
       (phase→`"panel"`, `open:true`)이 **throw 지점보다 먼저** 실행되므로 이 경로가 실패해도
       "한 번도 안 열린 위젯" 이 아니라 "방금 새 대화를 요청해 열린 위젯" 이 `ended` 로 간다 —
       §3.1 정책과 부합.
    3. `loadSession`/`sessionEstablished()`(`:1200-1202`, sync) → `session-store.ts:60-98` 이
       모든 파싱/스토리지 예외를 내부 `try/catch` 로 흡수해 `null` 반환.
    4. 남은 유일한 실제 throw 지점은 `if (saved)` 복원 분기 안의 `seedWaitingFromStatus`/
       `openStream`(`:1218`, `:1242`) 뿐인데, `seedWaitingFromStatus` 자신도 내부 `try/catch`
       로 모든 실패를 outcome enum(`"stale"|"ended"|"continue"|"refresh_deferred"`)으로 흡수해
       **재던지지 않는다**(`:678-757`). `openStream` 이 동기 throw 하는 유일한 알려진 경로
       (손상된 URL, 코드 주석 `:787` 이 스스로 명시)는 이 블록에서 **`dispatch({type:"RESTORED",...})`
       (`:1206`, phase→`"streaming"`)가 이미 먼저 실행된 뒤에만** 도달한다.
    → 결론: `applyConfig` 의 promise 가 reject 하는 유일하게 실증 가능한 경로는 "이미 저장된
    (즉 과거에 실제로 존재했던) 세션을 복원하다가 실패" 하는 경우이며, 이 경우 `RESTORED` 가
    선행돼 phase 는 이미 `"collapsed"` 를 벗어나 있다. "한 번도 시작 안 한 위젯이 조용히
    `ended` 로 강등" 되는 시나리오는 현재 코드에서 실제 트리거를 못 찾았다 — fail-open
    설계(`isEmbedAllowed`)와 자기완결 스토리지 함수(`loadSession`)가 우연이 아니라 의도적으로
    그 표면을 이미 닫아 놨다. 이 판단은 `widget-state.test.ts:168-172` 의 기존(이 diff 밖)
    reducer 단위테스트 `"ERROR → ended + error 메시지"` 가 `initialState`(phase `"collapsed"`)에서
    직접 `ERROR` 를 dispatch 해 `ended` 로 가는 것을 **이미 의도된 불변식으로 고정**하고 있다는
    사실과도 정합적이다 — reducer 레벨에서 이 전이가 "부팅 전이어도 안전" 하도록 이미
    설계·검증돼 있다(`open` 필드는 `ERROR` case 가 건드리지 않으므로, 패널이 닫힌 채 이 전이가
    나도 `widget-app.tsx` 는 여전히 `Launcher` 를 그대로 렌더한다 — 사용자 가시 변화 없음.
    다음 `OPEN` 시에야 `phase !== "collapsed"` 라 `"panel"` 로 승격되지 않고 `"ended"` 유지 →
    "새 대화 시작" CTA 로 이어진다).
  - 이번 diff 가 추가한 회귀(`use-widget-eager-start.test.ts:768-800` 신규 `it`)도 정확히
    "저장 세션 복원 중 `openStream` 실패" 시나리오만 겨냥한다 — 위 결론과 일치하며, "한 번도
    안 연 위젯" 시나리오는 애초에 테스트 대상이 아니다(재현 불가라 테스트할 게 없음).
  - 제안: 새 결함 아님 — 조치 불필요. 다만 이 안전성은 **암묵적**이다(향후 누군가
    `establishConfig`/`isEmbedAllowed` 이전에 throw 가능한 호출을 추가하면 이 여백이 다시
    열린다). 방어를 명시화하려면 `runApplyConfig` 의 `catch` 안에 "여기 도달하는 시점엔 이미
    `RESTORED`/`NEW_CHAT` 로 phase 가 `collapsed` 를 벗어나 있어야 한다" 는 불변식을 주석으로
    남기거나(코드 변경 없이 문서화만), 정말 방어하고 싶다면 `state.phase === "collapsed" && !state.open`
    일 때는 `ERROR` 대신 조용한 로그로 낮추는 명시적 가드를 고려할 수 있다 — 다만 이는 현재
    실증된 결함이 없는 상태에서의 **선택적 강화**이지 필수 fix 는 아니다.

- **[INFO]** (c) `spec/7-channel-web-chat/3-auth-session.md` frontmatter `status: implemented` 는
  이 fix 이후 오히려 더 정당해졌다
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:1-13`(frontmatter, `code:` 배열에
    `use-widget.ts` 포함), `plan/complete/webchat-reload-rest-error-branches.md`
  - 상세: 이 fix 자체는 `3-auth-session.md` 를 건드리지 않지만(diff stat 확인:
    CHANGELOG.md·use-widget-eager-start.test.ts·use-widget.ts·plan/complete/webchat-reload-rest-error-branches.md
    4개뿐), fix 가 다루는 파일(`use-widget.ts`)은 그 frontmatter 의 `code:` SoT 목록에 있다.
    `spec-impl-evidence.md §3` 의 `implemented` 정의("모든 약속 구현 완료")를 놓고 보면, fix
    **이전**에는 `applyConfig` 진입점만 "에러 → [ended]" 일반 정책(4-security §1 행)을 어기고
    있었다(로그만 남기고 상태 고착) — 세 진입점 중 하나가 spec 이 명시한 공통 정책과 어긋나
    있었던 셈이라 엄밀히는 그 구간에서 `implemented` 주장이 흔들릴 수 있었다. fix 는 그 갭을
    닫아 세 진입점(`start`/`sendCommand`/`applyConfig`) 모두가 §3.1·§1 정책을 동형으로
    만족하게 했으므로, **fix 후 시점의 `status: implemented` 는 이전보다 더 견고한 근거를
    갖는다.**
  - 제안: 없음 — 현재 `status: implemented` 유지가 타당하다.

## 나머지 변경분 경량 패스 (파일 2~24)

- **[INFO]** `isTerminalAuthError`/`redactToken`(`eia-client.ts:167-201`, 테스트
  `eia-client.test.ts:266-300`) — 함수 시그니처·판정(`401`/`410` 만 참, `instanceof EiaError` 가드)이
  JSDoc·테스트와 일치. 정규식 `/([?&]token=)[^&\s"']+/gi` 는 `token` 만 치환하고 인접 파라미터
  보존을 테스트가 직접 단언(`eia-client.test.ts:290-295`) — 기능·엣지케이스 문제 없음.
- **[INFO]** `applyRefreshedToken`(`session-store.ts:110-133`) — spread 병합 후 `saveSession` 호출,
  반환값이 갱신된 세션. "세대 검사는 호출부 책임" 이라는 JSDoc 계약이 실제 호출부(RESOLUTION.md
  §5 언급)와 일치. TODO/FIXME 없음.
- **[INFO]** `plan/`·`review/` 문서류(파일 1, 9~24) — 대부분 링크 경로 정정(`in-progress/` →
  `complete/`, plan 이동에 따른 상대경로 갱신)과 과거 리뷰 라운드(`16_09_40`) 산출물 기록.
  기능 코드가 아니므로 요구사항 충족 관점에서 특이사항 없음. `plan/complete/web-chat-quality-backlog.md`
  의 2026-08-10 재정정 문단(파일 9)은 frontmatter `status: implemented` 복귀를 서술하며, 위 (c)
  판정과 정합.

## 요약

핵심 fix(`runApplyConfig` 의 `dispatch({type:"ERROR", message: errMessage(e)})`)는 (a) 코드
SoT 문구 우회 없이 `errMessage()` 를 경유하고 reducer 의 기존·검증된 `ERROR` 케이스로 상태
전이까지 완결해, `spec/7-channel-web-chat/1-widget-app.md §3.1` 과 `4-security.md` 의 에러 정책
행이 정의하는 "에러 → [ended] + 새 대화 시작" 을 line-level 로 만족한다. 유일한 결함은 그
정책을 가리키는 주석의 절 번호(`§5`)가 실제로는 `§1` 이어야 하는 선행(pre-existing) 인용
오류로, 이번 diff 가 한 곳 더 복제했다 — 기능 영향은 없으나 정정을 권한다. (b) "부팅 전(아직
안 연 위젯)에도 이 dispatch 가 발동해 `ended` 로 만드는가" 우려는 코드 전체 흐름(fail-open
`isEmbedAllowed`, 자기완결 `loadSession`, `seedWaitingFromStatus` 의 outcome-enum 화)을
전수 추적한 결과 현재 구현에서는 재현 가능한 트리거를 찾지 못했다 — `applyConfig` 의 promise
가 reject 하는 유일한 실증 경로는 이미 `RESTORED` 가 선행된 복원 실패뿐이라 새 결함이 아니다.
(c) `status: implemented` 는 이 fix 로 세 진입점의 정책 구현이 동형화돼 오히려 더 정당해졌다.
전반적으로 이 fix 는 정확하고 spec 과 정합하며, 회귀 테스트도 정확히 해당 시나리오(복원 경로
`openStream` 실패)를 겨냥한다.

## 위험도

LOW
