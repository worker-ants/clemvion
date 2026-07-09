# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 본 라운드(20_01_04)의 직접 payload 는 이전 4라운드(18_44_10/19_06_55/19_26_15/19_40_53)의 리뷰
> 산출물(md/json) + 4개 spec 문서 diff 뿐이며, round 4(`19_40_53` RESOLUTION.md)가 반영을 주장한 실제
> `codebase/**` 커밋(`008d71cfa` "ai-review R4 반영")은 이번 payload 목록에 없다(문서 전용 파일만 라우팅되는
> 기존 패턴). RESOLUTION.md 의 "반영 완료" 주장을 문서-코드 정합성 관점에서 신뢰하지 않고, `git diff
> origin/main...HEAD -- codebase/ CHANGELOG.md` 및 현재 파일 상태를 직접 열람해 독립 검증했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 항목이 "booting 중에도 세션 컨트롤 노출" 이라는 **폐기된 초기 동작**을 여전히 서술 — round 2 수정(behavior 변경)이 CHANGELOG 에 역전파되지 않은 stale 서술
  - 위치: `CHANGELOG.md:7` (`## Unreleased — 웹채팅 위젯 세션 컨트롤...` 항목, "**① 세션 컨트롤**: 진행 중
    (booting/streaming/awaiting_user_message) 대화에서만 패널 헤더에 두 컨트롤을 노출하고...")
  - 상세: 이 CHANGELOG 항목은 round 1 커밋(`792eedb28`)에서 작성됐고, 그 시점의 `isActiveConversationPhase`
    구현은 실제로 `booting || streaming || awaiting_user_message` 를 true 로 반환했다(당시엔 정확한 서술).
    그러나 round 2 커밋(`160840462`, "ai-review R2 반영 — booting 세션컨트롤 제외")이 이 함수를
    `streaming || awaiting_user_message` 로 **좁혀** booting 을 명시적으로 제외했다(중복 webhook·미발사
    cancel 회귀 수정, `git show 160840462` 확인). 이 수정은 코드(`widget-state.ts:43-44`)·docstring·
    `panel.tsx`(`showSessionControls = isActiveConversationPhase(phase)`)·spec
    (`spec/7-channel-web-chat/1-widget-app.md` §2: "**세션 컨트롤은 대화가 확립된(`streaming`/
    `awaiting_user_message`) 뒤에만 노출**한다 — `booting`... 에서는 미노출")까지 전부 동기화됐지만,
    **CHANGELOG 의 해당 문장만 갱신되지 않고 원래 "booting/streaming/awaiting_user_message" 문구가 그대로
    남았다** — 현재 코드·spec 과 정면으로 모순된다. 이 drift 는 3라운드 문서화 리뷰(`19_06_55`/`19_26_15`/
    `19_40_53` `documentation.md`) 모두를 통과했는데, 세 라운드 전부 "CHANGELOG 항목이 **존재**하는지"만
    재확인했을 뿐(`19_06_55`: "이전 라운드에서 지적된 누락이 해소됐다", `19_26_15`: "다른 최근 항목과 동일한
    상세도로 존재", `19_40_53`: "CHANGELOG 갱신은 이전 라운드에서 이미 별도 커밋으로 처리된 것으로 확인됨")
    **내용 정확성을 코드 재대조로 검증하지 않았기 때문**이다. (같은 문장 뒷부분 "booting/초기 streaming 중
    종료·새 대화가 in-flight `start()` 를 무효화하도록 세대 토큰(gen guard)을 도입" 은 여전히 정확 — gen guard
    는 SSE terminal 이벤트·host `resetSession` 명령 등으로 booting 중에도 트리거될 수 있어 컨트롤 미노출과
    무관하게 유효하다. 문제는 앞 절의 "컨트롤이 booting 에서도 노출된다"는 진술뿐이다.)
  - 제안: `CHANGELOG.md:7` 의 "진행 중(booting/streaming/awaiting_user_message) 대화에서만" 을 "진행 중
    (streaming/awaiting_user_message) 대화에서만(booting 중에는 미노출 — 세션 미확립)" 로 정정. gen guard
    관련 문구는 그대로 유지.

- **[INFO]** 신규 인라인 주석의 하드코딩된 라인 번호 참조(`:289·:299`) — 유지보수 시 조용히 stale 화될 수 있는 취약한 문서화 패턴
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`start()` 의 `catch` 블록, round 4 신규 추가:
    "이 start 가 teardown(새 대화/종료)으로 대체됐으면 옛 실패로 최신 상태를 덮지 않는다 — try 의 두 gen
    검사(:289·:299)와 대칭...")
  - 상세: 현재는 두 줄 번호(289/299)가 실제로 `try` 블록의 두 gen 검사 위치와 일치한다(직접 확인). 그러나
    같은 함수·파일 상단에 향후 줄이 추가/삭제되면 이 참조는 자동으로 stale 화되고, 이를 검증하는 lint/CI
    장치가 없어 리뷰 시점이 아니면 발견되기 어렵다(이번 CHANGELOG 사례와 동일한 종류의 리스크).
  - 제안: 필수 아님(차단 사유 아님). 라인 번호 대신 "`try` 블록의 두 gen 검사" 처럼 구조적 서술로 대체하면
    향후 리팩터에도 안전하다.

- **[INFO]** 신규 회귀 테스트 제목이 실제 단언 범위보다 넓게 읽힘 — "host conversationEnded 통지 경로" 검증을
  타이틀에 명시하지만 실제로는 `sendEvent`/`postMessage` 호출 자체를 spy 하지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
    (`"submit_message 명령이 410(Gone) → phase ended (대화 종료됨, host conversationEnded 통지 경로)"`)
  - 상세: 테스트는 `phase === "ended"` 와 `sessionStorage` 정리만 단언하고, round 4 에서 추가된
    `bridgeRef.current?.sendEvent("conversationEnded", { reason: "gone" })` 호출 자체(host 통지)는 spy 로
    검증하지 않는다. 다만 이는 이번 PR 만의 결함이 아니라 이 코드베이스 전반(`host-bridge.test.ts` 포함)이
    `sendEvent`/`postMessage` 를 spy 하지 않는 기존 관례이며, 이미 앞선 `testing.md`(round `19_26_15`)에서
    동일한 시스템적 갭으로 지적·defer 됐다. 테스트 제목의 괄호 문구("host conversationEnded 통지 경로")만
    보면 실제보다 더 강한 커버리지를 주장하는 것으로 오독될 수 있다는 점만 문서 정확성 관점에서 참고 기록.
  - 제안: 우선순위 낮음. 여력이 되면 제목에서 "통지 경로" 문구를 빼거나, `bridgeRef` 대상 `postMessage` spy
    로 실제 통지 발사까지 단언하는 편이 제목과 커버리지를 일치시킨다.

## 검증한 항목 (문제 없음 확인)

- **`2-sdk.md` `"gone"` reason spec-code 불일치(round 4 WARNING #2)**: `spec/7-channel-web-chat/2-sdk.md` 의
  `conversationEnded.data.reason` 예시값 `"gone"` 이 실제 코드에서 발화하는지 `use-widget.ts` 를 직접 열람해
  재확인 — `sendCommand` 의 410 catch 블록에 `bridgeRef.current?.sendEvent("conversationEnded", { reason:
  "gone" })` 가 실제로 추가되어 있다(커밋 `008d71cfa`). spec 서술이 이제 코드와 일치한다.
- **`start()` catch gen 검사 비대칭(round 4 WARNING #1)**: `catch` 블록 최상단에 `if (startGenRef.current !==
  gen) return;` 이 실제로 추가되어 `try` 블록의 두 검사와 대칭을 이룬다(커밋 `008d71cfa` 직접 확인).
- **`execution.entity.ts` 기존 JSDoc 긴장(여러 라운드 INFO)**: `conversation_thread` 컬럼 주석에 "단 EIA
  `getStatus`(...)는 waiting_for_input 시 이 스냅샷을 **read-only** 로 노출한다" 교차 참조가 실제로 추가되어
  있음을 확인(`execution.entity.ts:161-162`) — RESOLUTION.md 의 "round3 에서 이미 해소" 주장과 일치.
- **plan frontmatter `status` 필드(여러 라운드 INFO)**: `plan/complete/webchat-session-controls-history-restore.md`
  frontmatter 가 현재 `status: complete` 로 정정되어 있음을 확인 — 더 이상 이슈 아님.
- **`1-widget-app.md` §3 다이어그램 "대화 종료" edge 비대칭(round 4 INFO #3)**: 헤더 bullet 에 "**'대화 종료' 도
  대칭 edge**(`[streaming]`/`[awaiting_user_message]` → `[ended]`)로, ASCII 다이어그램에는 미도시이며 §3.1 표가
  SoT 다" 문장이 실제로 추가돼 있음을 확인.
- **`README.md`(channel-web-chat) "상태" 섹션**: 헤더 세션 컨트롤·durable `conversationThread` 복원이 정확히
  반영돼 있고, booting 관련 과장 서술은 없다(이번 CHANGELOG 이슈와 달리 README 는 정확).
- 신규 프로덕션 코드에 리뷰 라운드 번호("WARNING #4" 등)를 참조하는 임시 주석이 잔존하지 않음(grep 결과 0건 —
  round 2 에서 이미 제거된 것으로 확인됐고 이후 라운드에서도 재유입 없음).

## 요약

4라운드에 걸친 반복 리뷰·수정 사이클을 거치며 spec(EIA §R17·1-widget-app §2/§3.1·2-sdk.md)·JSDoc·엔티티
주석·plan frontmatter·README 는 실제 코드 최종 상태와 line-level 로 정합하다는 것을 이번 라운드에서 코드를
직접 대조해 재확인했다. 특히 round 4 RESOLUTION.md 가 주장한 두 코드 수정(catch 블록 gen 대칭화, "gone" reason
host 통지)도 실제 커밋(`008d71cfa`)에 정확히 반영되어 있음을 검증했다. 다만 이번 라운드에서 처음으로 발견한
`CHANGELOG.md` 의 stale 서술(WARNING) 은 3라운드의 문서화 리뷰가 모두 "항목 존재 여부"만 재확인하고 round 2
의 동작 변경(booting 세션 컨트롤 제외)을 CHANGELOG 내용까지 역추적하지 않아 놓친 실질적 갭이다 — 리뷰
payload 가 라운드마다 이미 리뷰된 코드를 제외하는 구조이다 보니, 문서 정확성 검증이 "문서가 최신 spec/코드와
일치하는가"보다 "문서가 존재하는가"로 얕아지기 쉽다는 프로세스적 교훈을 남긴다. 그 외 발견 2건(하드코딩 라인
번호 참조, 테스트 제목의 커버리지 과장)은 모두 INFO 수준으로 차단 사유가 아니다.

## 위험도
LOW
