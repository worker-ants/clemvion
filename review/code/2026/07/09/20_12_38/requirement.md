# 요구사항(Requirement) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원 changeset — 6번째(누적) 리뷰 라운드. 이번 payload(34개 파일)도 앞선 패턴대로 review 산출물
> (`19_26_15`/`19_40_53`/`20_01_04` 라운드 12+10+8 파일) + `consistency-check --spec`(`18_27_06`) 산출물 5개 +
> spec 본문 diff 4개(`14-external-interaction-api.md`/`1-widget-app.md`/`2-sdk.md`/`3-auth-session.md`)로만
> 구성되고, **애플리케이션 코드(`codebase/**`) 자체의 diff 는 이번 payload 에도 포함돼 있지 않다**("리뷰
> changeset 이 직전 검토 코드 제외" 패턴, 6라운드 연속). 이에 따라 payload 인용을 신뢰하지 않고
> `git log`/`git show`/`git diff origin/main...HEAD`/실제 소스 열람/테스트 실행(vitest·jest)으로 현재
> HEAD(`672f4b6bb`)의 실제 코드·spec 상태를 직접 재검증했다.

## 발견사항

- **[INFO]** 이번 payload 도 실질 코드 diff 없이 6라운드째 review 산출물·spec 문서만 누적 — 프로세스 관찰(코드
  결함 아님, 5라운드째 requirement 리뷰어가 이미 지적한 것과 동일 근본 원인)
  - 위치: `review/code/2026/07/09/20_12_38/meta.json`(files 34건 전부 `review/**` 또는 `spec/**`)
  - 상세: `git log` 확인 결과 HEAD 는 `672f4b6bb`("docs(web-chat): ai-review R5 반영 — CHANGELOG booting 서술
    정정 + spec_impact·주석 정리")이며, 이 커밋은 코드 파일을 건드리지 않는 순수 문서 정리 커밋이다(`git show
    --stat 672f4b6bb` = `CHANGELOG.md`, `execution.entity.ts` 주석, `plan/complete/...md` frontmatter,
    `use-widget.ts` 주석만). 실질 코드(`interaction.service.ts`/`use-widget.ts` 로직/`panel.tsx`)는 4라운드
    fix 커밋(`008d71cfa`)에서 최종 반영되어 그 이후로는 변경이 없다 — 이번 라운드가 신규로 검토할 코드 diff
    자체가 실제로 존재하지 않는 상태다. 라우팅 문제가 아니라 changeset 이 실제로 "문서 정리만" 이라는 뜻.
  - 제안: 조치 불필요. 참고로만 기록.

## 독립 재검증 (코드 직접 열람 + 테스트 실행, 문제 없음 확인)

- **round4 WARNING #1 (`start()` catch gen 검사)**: `codebase/channel-web-chat/src/widget/use-widget.ts:303-306`
  확인 — `catch (e) { if (startGenRef.current !== gen) return; startedRef.current = false; dispatch({type:"ERROR"...}); }`.
  `try` 블록의 두 기존 검사(`:284`, `:295`)와 대칭 완성. 회귀 테스트
  `use-widget-eager-start.test.ts:728`("booting 중 종료 후 옛 webhook 이 뒤늦게 실패(reject)해도 stale start
  catch 가 상태를 덮지 않음") 존재·통과 확인.
- **round4 WARNING #2 (`"gone"` reason host 미통지)**: `use-widget.ts:319-327`(`sendCommand` 410 catch) 확인 —
  `dispatch({type:"ENDED", reason:"gone"})` 직후 `bridgeRef.current?.sendEvent("conversationEnded", {reason:"gone"})`
  가 실제로 존재. 회귀 테스트 `use-widget-eager-start.test.ts:771`("submit_message 명령이 410(Gone) → phase
  ended") 존재·통과 확인. 단, 이 테스트는 `phase` 전이와 세션스토리지 정리만 단언하고 `sendEvent`/`bridgeRef`
  자체를 spy 로 확인하지 않는다 — round5 documentation.md INFO#4 가 이미 정확히 지적·"저우선 defer"로 마킹한
  기존 갭이며 이번 라운드에 새로 발견된 결함이 아니다.
- **테스트 스위트 직접 실행**: `codebase/channel-web-chat` → `npx vitest run` = **279/279 passed**(19 files).
  `codebase/backend` → `npx jest --testPathPatterns="external-interaction/interaction.service.spec"` =
  **32/32 passed**. 두 수치 모두 round5 RESOLUTION/requirement.md 가 보고한 값과 정확히 일치.
- **`getStatus()` durable thread 동봉**(`interaction.service.ts:238-306`): `execution.status ===
  WAITING_FOR_INPUT` 한정, `conversationThread = execution.conversationThread ?? undefined` →
  `...(conversationThread ? { conversationThread } : {})` 로 null 이면 **키 자체 생략** —
  `spec/5-system/14-external-interaction-api.md:441`("배포 이전 row·park 이력 없음에는 ... **키를 생략**한다")과
  line-level 일치. 대기 `NodeExecution` 없음/`node` relation 미로드 시 `context` 전체가 `null` 로 떨어져
  `conversationThread` 가 조용히 드롭되는 극단 케이스도 코드로 재확인(4라운드 연속 지적·backlog, 신규 아님).
- **`endConversation` graceful/cancel 라우팅**(`use-widget.ts:423-449`): `graceful = phase ===
  "awaiting_user_message" && pending?.type === "ai_conversation" && !!pending?.nodeId` —
  `spec/7-channel-web-chat/1-widget-app.md:86` "대화 종료" 행 서술과 정확히 일치. 종료 순서(`resetSessionRefs()`
  선차단 → `dispatch(ENDED)` → `sendEvent` → best-effort `interact`)와 최상단 `if (state.phase === "ended")
  return` 재진입 가드 모두 코드에서 직접 확인.
- **`isActiveConversationPhase`**(`widget-state.ts:43-45`): `streaming`/`awaiting_user_message` 만 true —
  `panel.tsx:65` `showSessionControls = isActiveConversationPhase(phase)` 가 이를 그대로 소비, `1-widget-app.md:42`
  헤더 행 문구와 일치.
- **`roleOf` 매핑**(`conversation.ts:34-40`): `USER_TURN_SOURCES = {presentation_user, ai_user}` 외 전부
  assistant, 명시 `role` 우선 — spec 문구와 line-level 일치.
- **§3 다이어그램 "대화 종료" 대칭 edge 추가 확인**(round4 documentation INFO#3 반영): `1-widget-app.md:78`
  에 `**"대화 종료" 도 대칭 edge**(\`[streaming]\`/\`[awaiting_user_message]\` → \`[ended]\`)로, ASCII
  다이어그램에는 미도시이며 §3.1 표가 SoT 다` 문구가 실제로 추가돼 있음을 확인.
- **CHANGELOG booting 서술 정정 확인**(round5 WARNING#1 반영): `CHANGELOG.md:7` 이 "대화가 확립된(`streaming`/
  `awaiting_user_message`) 뒤에만 ... 노출하고(... `booting`(webhook in-flight, 세션 미확립) ... 는 미노출)"로
  정확히 정정돼 있음을 확인 — round2 의 실제 booting 제외 동작과 이제 일치.
- **plan frontmatter**: `plan/complete/webchat-session-controls-history-restore.md` — `status: complete`,
  `spec_impact` 리스트에 4개 spec 파일(`14-external-interaction-api.md`/`1-widget-app.md`/`2-sdk.md`/
  `3-auth-session.md`) 전부 등재 확인(round5 INFO#2 반영 확인).
- **`execution.entity.ts` JSDoc 교차참조**: `:159-160` 에 "단 EIA `getStatus`(...) 는 waiting_for_input 시 이
  스냅샷을 **read-only** 로 노출한다" 문구가 실제로 존재 — round1 INFO(엔티티 주석 문면 긴장)가 해소돼 있음을
  재확인.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main...HEAD -- codebase/` 전체에 해당 마커 없음(grep 재확인).

## 요약

이번 6라운드(20_12_38) payload 도 이전 라운드들과 동일하게 실질 애플리케이션 코드 diff 를 포함하지 않았으나,
`git show`(HEAD `672f4b6bb`)·소스 직접 열람·테스트 직접 실행(vitest 279/279, jest interaction.service.spec
32/32)으로 독립 재검증한 결과, 4~5라운드가 발견·반영을 기록한 모든 WARNING(`start()` catch gen 검사 대칭화,
`"gone"` reason host 통지, CHANGELOG booting 서술 stale)이 현재 HEAD 에 실제로 반영돼 있고 회귀 테스트로
고정돼 있음을 확인했다. 핵심 요구사항(durable thread 동봉 조건·키 생략 규칙, `endConversation` graceful/cancel
라우팅, `isActiveConversationPhase` 게이팅, `roleOf` 매핑)은 spec 본문과 함수 시그니처·필드명·기본값·상태 전이
레벨까지 line-level 로 일치한다. 새로운 CRITICAL/WARNING 급 요구사항 미충족·엣지케이스 누락·에러 시나리오
미정의는 발견되지 않았다. 잔여 항목은 모두 기존 라운드가 이미 저우선/backlog 로 명시적으로 defer 확정한
것들(context null-drop 극단 케이스, 410 테스트의 sendEvent spy 부재, conversationThread 키생략 vs null 형제
필드 비대칭)뿐이며 이번 라운드에서 새로 악화되거나 재발한 사항은 없다.

## 위험도
NONE
