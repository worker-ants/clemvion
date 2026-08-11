# 보안(Security) Review

대상: 직전 라운드(`16_26_09`) 대비 델타 — (a) `recoverFromExpiredToken` 의 refresh 실패 종료 조건을
`401`/`410`(EiaError)로 좁힘, (b) 401 복구 로직을 `seedWaitingFromStatus` 인라인에서
`recoverFromExpiredToken` 헬퍼로 분리, (c) JSDoc·리뷰 인원수 숫자 정정.

이 영역(§R4 401 낙관적 refresh)은 이미 3라운드(`16_09_40` HIGH→fix, `16_26_09` LOW)에 걸쳐 security
reviewer 가 소스 직독·테스트 실행으로 반복 검증했고 원래 CRITICAL(성공 후 stale 토큰으로 SSE 재오픈)은
닫힌 상태다. 이번 라운드는 그 위에 얹힌 좁은 델타만 신선한 시각으로 재검증했다 — 액면가로 받지 않고
실제 소스(`use-widget.ts`)를 직접 읽고, 신규 회귀 테스트를 실제로 실행해 확인했다.

## 확인 절차

- `codebase/channel-web-chat/src/widget/use-widget.ts` 의 `recoverFromExpiredToken`(452-521행)과
  `seedWaitingFromStatus`(523-602행)를 직접 `Read` 로 열어 현재 코드를 확인했다(프롬프트의 diff 는 두
  파일 모두 크기 제한으로 생략돼 있었음).
- 신규 회귀 `"§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다"`
  (`use-widget-eager-start.test.ts:418-446`)를 `npx vitest run … -t "네트워크 오류"` 로 직접 실행 —
  **1 passed** 확인.
- `codebase/channel-web-chat/src/lib/eia-client.ts` 의 `refreshToken`/`EiaError` 정의를 대조해
  `console.warn` 로그에 실릴 수 있는 값(에러 메시지)에 토큰·응답 바디가 섞여 나가는지 확인.

## 발견사항

- **[INFO]** (a) 종료 조건 좁힘(`401`/`410`)은 보안 경계를 정확히 spec 문언에 맞췄고, 실패 시 로그에
  민감정보 노출이 없다 — 신규 결함 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:493-508`(`recoverFromExpiredToken` 의
    `catch (refreshErr)` 블록), 테스트 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:418-446`.
  - 상세: `client.refreshToken()` 이 던지는 예외는 `EiaError`(HTTP 상태 보유, `eia-client.ts:104-113`)
    또는 순수 네트워크 `TypeError`(상태 없음) 둘 다일 수 있다. 개정 전에는 원인 구분 없이 전부
    `finalizeEnded("execution.token_revoked")` 로 세션을 영구 종료했는데, 이는 spec(`3-auth-session.md`
    §3.1-2·§R4, "재차 실패(`401`/`410`)면 종료")보다 넓은 종료 조건이었다 — 일시적 네트워크 hiccup 만으로
    정당한 세션이 영구 종료될 수 있었다(이 저장소가 `webchat-boot-single-flight` 에서 실제로 겪은 사고와
    같은 형태). 이번 델타는 `refreshErr instanceof EiaError && (status===401 || status===410)` 로만
    좁혀 그 외(네트워크 오류 등)는 `console.warn` 후 `"continue"`(soft-fail)로 폴백한다 — **보안 경계를
    좁히는 것이 아니라 spec 이 정한 정확한 경계에 맞춘 것**이라 새로운 취약점을 만들지 않는다.
  - 로그 노출 확인: `console.warn("[widget] token refresh failed (non-terminal):", refreshErr.message)`
    가 찍는 `message` 는 `EiaError` 의 경우 `"토큰 갱신 실패(${res.status})"`(상태 코드만, 응답 바디·토큰
    미포함, `eia-client.ts:113`), 네트워크 오류의 경우 브라우저 기본 메시지(`"network down"` 류)뿐이다 —
    토큰·서버 원문이 콘솔에 노출되지 않는다.
  - 판정: 이 조건 좁힘은 CRITICAL/WARNING 이 아니라 오히려 두 라운드 전 requirement reviewer 가 지적한
    "과도한 종료" 리스크를 해소하는 방향이다. 신규 회귀 테스트도 직접 실행해 통과를 확인했다.

- **[INFO]** (b) `recoverFromExpiredToken` 추출은 순수 이동이며 세대(worldGen) 재검사·`configRef` 부재
  가드가 그대로 보존됐다 — 새로운 TOCTOU/경합 표면 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:471-521`(신규 함수),
    `:591-592`(`seedWaitingFromStatus` catch 안 호출부 `if (err instanceof EiaError && err.status === 401) return recoverFromExpiredToken(client, session, gen);`).
  - 상세: 추출 전/후 모두 `refreshToken()` 성공 직후 `isStale(gen)`(482행) → `configRef.current` 존재
    확인(483-484행) → `applyRefreshedToken()`(485-489행) 순서가 그대로 유지된다. `await` 이후 재검사
    없이 바로 `sessionRef.current` 를 쓰는 지점이 없어(동기 문장 연쇄), 이전 라운드가 검증한 "TOCTOU
    창 없음" 결론이 이번 구조 변경으로도 깨지지 않는다. `useCallback` 의존성 배열
    (`:520 [finalizeEnded, isStale]`)이 `sessionRef`/`configRef`/`worldGenRef` 를 포함하지 않는 것은
    이 파일의 기존 관용구(ref 는 stable 이라 deps 불필요)와 일치한다.
  - 판정: 코드 재배치일 뿐 인가/세션 상태 전이 로직 자체는 바뀌지 않았다 — 신규 보안 결함 없음.

- **[INFO]** (c) JSDoc·CHANGELOG 숫자 정정은 보안 관련 서술의 정확성을 개선했으나, CHANGELOG 항목 하나가
  이번 델타(a)의 조건 확장(`401`→`401`/`410`)을 아직 반영하지 않은 채 남아 있다
  - 위치: `CHANGELOG.md:171`("2. **`401` → 낙관적 refresh 1회**: … 재차 `401` 이면 종료로 확정한다 …").
  - 상세: 이 줄은 "재차 `401`" 만 언급하고 `410` 을 언급하지 않는다. 실제 코드(`use-widget.ts:499-501`)와
    spec Rationale(`3-auth-session.md` §R4, "재차 실패(`401`/`410`)면 종료로 확정")은 `410` 도 포함한다.
    이 줄은 이번 델타(c)가 손댄 세 곳(리뷰 인원수 "3명"→"4명" 2곳, JSDoc 4곳)에는 포함되지 않았고, 원래
    `54a181f0a` 커밋(전전 라운드)에서 작성된 그대로다 — 즉 이번 델타가 새로 만든 결함은 아니지만, 종료
    조건이 이번 델타로 `401`/`410` 로 확장된 지금 시점 기준으로는 stale 하다. 보안적으로 위험한 정보
    노출은 아니며(오히려 실제 코드가 문서보다 더 보수적으로 정확함), 향후 이 CHANGELOG 항목만 보고
    "재로드 401-복구 실패 시 종료 조건"을 감사하려는 사람이 `410` 분기를 놓칠 수 있다는 정도의 문서
    정확성 이슈다.
  - 제안: `CHANGELOG.md:171` 을 "재차 `401`/`410` 이면 종료로 확정한다" 로 정정 권장(documentation
    영역과 겹치나, 보안 결정의 audit trail 정확성에 직접 영향을 주므로 함께 기록).

- **[INFO]** (참고, 신규 아님) 401 refresh 실패가 soft-fail 로 폴백하는 경로에서 SSE 가 여전히 "이미
  `401` 을 유발한" 옛 토큰으로 재오픈될 수 있다는 잔여 가능성은 이번 델타로 새로 생긴 것이 아니라 이
  soft-fail 폴백 설계 자체에 내재한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:502-507`(non-terminal 분기, `sessionRef`
    미변경), 호출부 `start()`/`applyConfig()` 의 `openStream(sessionRef.current ?? saved, "0")` 류.
  - 상세: refresh 자체가 네트워크 오류로 실패하면 `sessionRef.current` 는 갱신되지 않으므로, 호출부는
    여전히 `getStatus` 에서 이미 `401` 을 받은 바로 그 토큰으로 SSE 를 연다. 이번 델타 이전에는 이
    경우도 무조건 `finalizeEnded` 였으므로 SSE 자체가 안 열렸는데, 이번 델타로 "재시도 가능한 세션을
    죽이지 않는다" 는 이익과 맞바꿔 "무효 토큰으로 SSE 를 다시 열 수 있다" 는 이전 라운드의 원 CRITICAL
    과 표면적으로 비슷한 형태가 **의도적으로** 재도입됐다. 다만 이는 (1) spec 이 명시한 soft-fail 원칙과
    일치하는 의도된 트레이드오프이고(CHANGELOG:172, `3-auth-session.md` §3.1-2 "그 외 status·오류는
    catch soft-fail"), (2) 인가 우회나 정보 노출이 아니라 "일시적으로 스트림이 다시 실패할 수 있다"는
    가용성 문제이며, (3) 주기 갱신 타이머(`use-token-refresh.ts`)가 별도로 다음 만료 lead 시점에 다시
    refresh 를 시도하므로 무기한 방치되지 않는다. 새 CRITICAL/WARNING 으로 등록하지 않는다 — 이미
    두 라운드의 requirement reviewer 가 이 트레이드오프를 검토해 이번 조치를 명시적으로 권고했고, 코드
    주석(`:494-498`)도 그 근거를 남기고 있다.
  - 제안: 조치 불요. 다만 "주기 갱신 × opportunistic refresh 동시 발화 경합" 항목(side_effect,
    `16_09_40`/`16_26_09` 두 라운드 연속 WARNING)이 이 잔여 가능성과 상호작용할 수 있음을
    `plan/in-progress/webchat-auth-session-status-reconcile.md` 가 이미 별도로 추적 중이다 — 이번
    security 라운드에서 새로 열 필요는 없다.

## 요약

이번 라운드의 델타 3가지 — refresh 실패 종료 조건을 `401`/`410` 로 좁힌 것, 401 복구 로직을
`recoverFromExpiredToken` 헬퍼로 순수 추출한 것, JSDoc·리뷰 인원수 숫자 정정 — 모두 새로운 보안 취약점을
만들지 않는다. (a)는 오히려 이전 라운드가 지적한 "과도한 세션 종료" 리스크(spec 문언보다 넓은 종료 조건)
를 해소하는 보안·가용성 개선이고, 실패 로그에도 토큰·서버 원문이 섞이지 않는다. (b)는 순수 코드 이동으로
세대 재검사·TOCTOU 방지 구조를 그대로 보존했다. (c)는 문서 정확성 개선이나 `CHANGELOG.md:171` 한 줄이
아직 `410` 을 반영하지 못해 stale 하게 남았다(위험 아님, INFO). 소스를 직접 읽고 신규 회귀 테스트를
실제로 실행해(1 passed) 이 판단을 확인했다. 새로운 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화
표면은 발견되지 않았다.

## 위험도

NONE
