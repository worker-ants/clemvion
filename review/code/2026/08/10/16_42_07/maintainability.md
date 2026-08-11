# 유지보수성(Maintainability) Review

## 재판정 요청 응답: `recoverFromExpiredToken` 분리가 실제로 중첩·책임을 줄였는가

**결론: 그렇다 — 겨냥한 문제(중첩 3단계·이중 책임)는 실제로 해소됐고, `applyRefreshedToken`
류의 리터럴 중복도 재발하지 않았다. 다만 그 분리 자체가 이 파일의 문서 배치 컨벤션을
어기는 새 결함을 하나 만들었다(아래 [WARNING] 1번).**

- `seedWaitingFromStatus` 의 `catch` 블록은 이제 `err.status === 401` 분기가
  `codebase/channel-web-chat/src/widget/use-widget.ts:591-592` 한 줄
  (`if (err instanceof EiaError && err.status === 401) return recoverFromExpiredToken(client, session, gen);`)
  로 줄었다 — `16_09_40` WARNING 이 지적한 "catch→if→try/catch" 3단계 중첩이 실제로 사라졌다.
  `seedWaitingFromStatus` 자신의 catch 안에는 이제 `isStale`/`404`/`401`(위임)/그 외 soft-fail
  네 갈래만 평평하게 남는다(`:576-598`).
- `recoverFromExpiredToken`(`:471-521`, `useCallback` 의존성 `[finalizeEnded, isStale]`,
  `:520`)은 세 인자(`client, session, gen`)만 받는다 — `16_09_40` 원안(의존 넷을 파라미터
  객체로 주입)이 아니라 형제 `use-token-refresh.ts` 의 `scheduleRefresh`/`clearRefreshTimer`
  패턴(같은 훅 스코프 내 sibling `useCallback` 이 `configRef`/`sessionRef` 를 클로저로 직접
  캡처)을 그대로 따른 결과다. `configRef`/`sessionRef` 는 `useRef` 라 의존성 배열에서 빠지는
  것이 이 파일의 다른 모든 콜백(`teardownSession`, `finalizeEnded` 등)과 일관된 관용구다.
- 리터럴 중복 재발 여부: `recoverFromExpiredToken` 은 기존 인라인 블록에서 로직을 그대로
  옮긴 것이고, 새로 `saveSession`/세션 반영 관련 코드를 다시 손으로 쓰지 않았다(그 4줄은
  이미 직전 라운드에서 `session-store.ts` 의 `applyRefreshedToken` 으로 뽑혀 있고
  `recoverFromExpiredToken:485-489` 은 그 함수를 그대로 재사용한다) — "자매 함수 미적용" 형태의
  새 중복은 없다. 유일하게 옮겨진 것이 있다면 인라인 주석 하나("refresh 왕복도 await 다 —
  ...")가 삭제되고 그 취지가 새 함수의 `@param gen` JSDoc(`:468-469`)으로 재배치된 정도이며,
  정보 손실이 아니라 함수-레벨 문서로의 정당한 이동이다.
- 함수 하나의 분기 수(순환복잡도)도 실제로 갈렸다: `seedWaitingFromStatus` 본문(`:523-602`,
  약 80줄)은 이제 `stale`/`404`/`401`(위임)/`continue` 네 갈래만 갖고, `recoverFromExpiredToken`
  본문(`:471-521`, 약 51줄)은 자기 갈래(`stale`×2/`continue`/`ended`/비-terminal `continue`)만
  갖는다 — 두 함수 합산 분기 수는 이전과 비슷하더라도 "getStatus 실패 분류" 와 "401 복구
  시퀀스" 라는 두 책임이 함수 경계로 실제로 갈렸다.

## 발견사항

- **[WARNING]** `recoverFromExpiredToken` 삽입이 `seedWaitingFromStatus` 의 JSDoc-선언 인접성을 깼다 — 이 파일의 자체 컨벤션 위반이자 읽기 함정
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:371-451`(`seedWaitingFromStatus` 를 설명하는 JSDoc — `@param client`/`@param session`/`@returns {@link SeedOutcome}` 등을 담은 81줄 블록) 과 실제 선언 `:523`(`const seedWaitingFromStatus = useCallback(`) 사이에, 별개 함수 `recoverFromExpiredToken` 의 JSDoc+본문 전체(`:452-521`, 70줄)가 끼어 있다. 간격은 72줄.
  - 상세: `git show d568aa7f1 -- codebase/channel-web-chat/src/widget/use-widget.ts` 로 확인한 결과, 이 81줄 JSDoc(및 그 직전 함수 `openStream`)은 추출 **이전**부터 `seedWaitingFromStatus` 선언 바로 위에 붙어 있었다. 이번 diff(`recoverFromExpiredToken` 분리, `d568aa7f1`)가 그 JSDoc 과 선언 사이에 새 함수 전체를 삽입하면서 인접성이 깨졌다. 이 파일은 `finalizeEnded`(`:270-284` JSDoc → `:285` 선언), `openStream` 등 다른 모든 헬퍼에서 "JSDoc 이 선언 바로 위" 컨벤션을 예외 없이 지키고 있어, 이번 경우만 어긋난다. 더 나쁜 건 오독 함정이다 — `:376-377` 의 `@param client`/`@param session` 이 우연히 바로 다음에 오는 `recoverFromExpiredToken(client, session, gen)` 의 앞 두 인자와 이름이 겹치고, `:448-450` 의 "의존성 배열: … 실 의존은 `finalizeEnded`·`sessionEstablished` 뿐" 문장도 곧바로 다음에 나오는 `recoverFromExpiredToken` 의 실제 deps(`[finalizeEnded, isStale]`, `:520`)와 혼동을 유발한다 — 처음 읽는 사람은 이 JSDoc 이 바로 아래 함수(`recoverFromExpiredToken`)를 설명한다고 오인하기 쉽다.
  - 제안: `seedWaitingFromStatus` 의 JSDoc(`:371-451`)을 `recoverFromExpiredToken` 의 JSDoc+본문(`:452-521`) 뒤, 즉 `:523` 선언 바로 위로 옮긴다. `recoverFromExpiredToken` 이 `seedWaitingFromStatus` 의 의존성 배열/본문에서 참조되므로 선언 순서(recoverFromExpiredToken 먼저)는 유지해야 하지만, 문서만 이동하면 순서 제약과 무관하게 인접성을 회복할 수 있다.

- **[INFO]** 신규 non-terminal 분기의 오류 포맷팅 관용구가 파일 내 기존 관용구를 한 곳 더 반복한다 — 규모가 작아 즉시 조치 불요
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:504-505`(`refreshErr instanceof Error ? refreshErr.message : String(refreshErr)`, `31b14aa22` 에서 추가) vs 기존 `:595-596`(`err instanceof Error ? err.message : String(err)`)
  - 상세: 두 `console.warn` 은 메시지 접두("token refresh failed (non-terminal)" vs "getStatus seed failed")와 대상(refresh 오류 vs getStatus 오류)이 달라 각자 존재 이유가 있는 별개 로그이지만, 오류 문자열 포맷팅 삼항식은 이제 파일에 2곳 반복이다. 3번째가 생기면 작은 `formatError(err)` 헬퍼로 뽑을 가치가 생기지만, 현재 2곳·1줄 관용구 규모로는 추출 이득이 낮다.
  - 제안: 조치 불요. 세 번째 지점이 생기면 그때 헬퍼화 검토.

## 다른 리뷰 대상 파일에 대한 확인

- `CHANGELOG.md`, `codebase/channel-web-chat/src/lib/session-store.ts`(`applyRefreshedToken`),
  `codebase/channel-web-chat/src/widget/use-token-refresh.ts`, `use-widget-eager-start.test.ts`,
  `plan/in-progress/webchat-auth-session-status-reconcile.md`, `spec/7-channel-web-chat/3-auth-session.md`
  는 이번 라운드(16_42_07)에서 새로 추가/수정된 부분에 한해 검토했으나 코드 구조 관점의 신규
  결함은 없었다 — `applyRefreshedToken` 재사용은 `16_26_09` 라운드가 이미 확인한 대로 두
  호출부 모두 계약(세대 검사는 호출부 책임)을 지킨다. `plan/`·`review/` 문서 3건은 프로세스
  기록이며 코드 유지보수성 관점 지적 대상이 아니다.

## 요약

이번 라운드가 재판정을 요청한 `recoverFromExpiredToken` 분리는 실제로 유효했다 —
`seedWaitingFromStatus` 의 중첩(catch→if→try/catch)이 사라지고 "getStatus 실패 분류"와
"401 복구 시퀀스"라는 두 책임이 함수 경계로 갈렸으며, 형제 파일(`use-token-refresh.ts`)의
sibling-`useCallback`-클로저 패턴을 그대로 따라 파라미터도 3개로 줄었고, `applyRefreshedToken`
재사용으로 리터럴 중복도 재발하지 않았다. 다만 그 삽입 위치가 `seedWaitingFromStatus` 를
설명하는 81줄 JSDoc 과 그 실제 선언 사이(72줄 간격)에 끼어들어, 이 파일이 다른 모든 헬퍼에서
지키는 "JSDoc 은 선언 바로 위" 컨벤션을 이번 한 곳만 깼다 — 더구나 그 JSDoc 의 `@param`
이름과 의존성 설명 문구가 바로 다음에 오는 `recoverFromExpiredToken` 과 우연히 겹쳐 처음
읽는 사람이 잘못 짝지을 소지가 있다. CRITICAL 급 결함은 없고, 이 WARNING 은 JSDoc 블록
이동 한 번으로 해소 가능한 낮은 비용의 수정이다.

## 위험도

LOW
