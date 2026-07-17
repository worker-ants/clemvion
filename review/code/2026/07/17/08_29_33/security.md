# 보안(Security) Review

리뷰 대상: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(신규 회귀 테스트),
`codebase/channel-web-chat/src/widget/use-widget.ts`(`startGenRef`/`sessionRef` 동일성/`cancelled` 플래그
3종 staleness 가드를 `worldGenRef` 단일 세대 카운터로 통합), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(계획 문서 갱신, 코드 아님).

## 발견사항

- **[INFO]** `applyConfig()` 세션 복원 경로에 `start()` 와 대칭적인 명시적 gen 재검증이 하나 빠져 있음(구조적 비대칭, 현재는 이론상 무해)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — 마운트 `useEffect` 내부 `applyConfig()`, `seedWaitingFromStatus(clientRef.current, saved)` 호출 직후 → `openStream(saved, "0")` 호출 이전 (diff 상 `@@ -649,11 +678,14 @@` 블록).
  - 상세: `start()` 는 `seedWaitingFromStatus` 의 `outcome !== "continue"` 게이팅 **더해** `if (worldGenRef.current !== gen) return;` 를 한 번 더 두어 "결과=무엇이 일어났나" 와 "세대=세계가 바뀌었나" 두 축을 모두 재확인한다(코드 주석이 이 비중복성을 명시). 반면 `applyConfig()` 의 동일 위치(세션 복원 후 seed → `openStream`/`scheduleRefresh`)에는 `outcome` 게이팅만 있고 별도의 `worldGenRef` 재확인이 없다. `seedWaitingFromStatus` 내부에서 `"stale"`/`"ended"` 판정이 `outcome !== "continue"` 로 이미 걸러지므로, JS 의 await-후-동기 실행 및 마이크로태스크/매크로태스크 스케줄링 특성상(두 함수 사이엔 매크로태스크 경계 — 즉 SSE 이벤트·postMessage 핸들러 개입 — 가 끼어들 수 없음) 실제로 이 경로가 악용 가능하다는 근거는 찾지 못했다. 다만 이 diff 의 핵심 계약이 "**모든 await 뒤 재검증**"이라고 JSDoc 에 명문화된 만큼, 세 호출부(`start`/`seedWaitingFromStatus`/`applyConfig`) 중 하나만 방어가 얇은 것은 향후 이 함수를 수정할 사람에게 오해를 줄 수 있는 비대칭이다.
  - 제안: `applyConfig()` 의 `openStream(saved, "0")` 직전에도 `if (worldGenRef.current !== gen) return;` 를 대칭적으로 추가해 세 호출부의 가드 형태를 일치시키는 것을 권장(방어적 프로그래밍 관점의 필수는 아니나, "가드 단일화" 라는 이번 리팩터 취지와 일관성을 높임). 급한 조치는 아님 — 다음 회귀 라운드에서 함께 처리해도 무방.

## 카테고리별 확인 결과 (문제 없음)

- **인젝션**: 신규/변경 코드에 DOM 삽입(`dangerouslySetInnerHTML` 등)·SQL·쉘 명령·경로 조합이 없음. 커맨드 바디(`{command:"cancel", reason:"user_new_chat"}` 등)는 정적 문자열이거나 서버가 이전에 내려준 `nodeId` 를 그대로 왕복시키는 형태로 신규 인젝션 표면 없음.
- **하드코딩된 시크릿**: 테스트 파일의 `"iext_x"`/`"iext_prev"`/`"iext_x2"` 등은 파일 전역에서 기존부터 쓰이던 목업 토큰 포맷이며 실제 시크릿이 아님.
- **인증/인가·세션 관리**: 이번 diff 의 본질은 세션 관리 보안 개선이다. `teardownSession()`(종료·새 대화·대화 종료 공통 choke point) 과 언마운트만 `worldGenRef` 를 증가시키고, `start()`/`seedWaitingFromStatus()`/`sendCommand()`/`applyConfig()` 네 비동기 경로가 각자 캡처한 세대를 await 이후 재검증하도록 통일했다. 종전에는 `teardownSession()` 이 `sessionRef` 를 null 하지 않아 `sessionRef` 동일성 가드가 SSE terminal 종료를 감지하지 못했고, 그 결과 (a) 이미 종료된 위젯이 지연 도착한 seed 응답으로 `awaiting_user_message` 로 부활하거나 (b) 새 대화의 라이브 SSE 스트림이 `openStream()` 재호출로 옛(무효화된) 토큰에 의해 닫히고 대체되는 두 가지 실질적 세션 무결성 결함이 가능했다(JSDoc·plan 문서에 재현 확인 기술). 이번 변경은 이 두 결함을 근본적으로 닫는다. 새로 추가된 회귀 테스트("유령 표면 회귀")는 정확히 이 시나리오(만료 seed in-flight 중 SSE terminal 도착 → stale seed 가 늦게 resolve)를 고정해, 되살아나지 않고 `ended` 를 유지함을 검증한다 — 코드 트레이스 결과 테스트 기대값과 구현 로직이 일치함을 확인했다.
- **입력 검증**: `safeApiBaseFromQuery()`(http(s) 스킴 화이트리스트) 등 기존 입력 검증 로직은 이번 diff 로 변경되지 않았고 그대로 유지됨.
- **암호화/평문 전송**: 토큰 저장·전송 방식(session-store, `EiaClient`)은 이번 diff 의 변경 범위 밖.
- **에러 처리**: 이번 diff 에서 신규/변경된 `console.warn` 호출은 없다(주석만 갱신). 기존 패턴대로 토큰·세션 원문이 아니라 `err.message` 만 로깅하며, 사용자 노출 문구는 `errMessage()` 의 generic 문자열로 고정되는 기존 정책이 그대로 유지된다.
- **의존성 보안**: 이번 diff 에 패키지/의존성 변경 없음.
- **plan 문서(파일 3)**: 코드가 아닌 서술 갱신이며 시크릿·민감정보 포함 없음.

## 요약

이번 변경은 새로운 취약점을 도입하는 기능 추가가 아니라, `channel-web-chat` 위젯의 비동기 세션 staleness 가드 3종(세대 카운터·`sessionRef` 동일성·`cancelled` 지역 플래그)을 `worldGenRef` 단일 세대 카운터로 통합해 실제로 재현된 세션 무결성 결함(종료된 대화의 유령 부활, 새 대화 SSE 스트림이 옛 토큰으로 탈취될 수 있는 경로)을 근본적으로 닫는 방어적 리팩터다. 인젝션·시크릿·인가 우회·암호화·에러 노출·의존성 항목에서 새로 도입된 문제는 발견되지 않았고, 신규 회귀 테스트는 수정 로직과 논리적으로 일치한다. 유일한 관찰 사항은 `applyConfig()` 세션 복원 경로가 `start()` 만큼 이중 재검증을 하지 않는 구조적 비대칭이며, JS 스케줄링 특성상 현재는 악용 근거를 찾지 못했으나 코드 일관성 차원에서 대칭화를 권장한다(급하지 않음).

## 위험도

LOW
