# 보안(Security) 리뷰 — SSRF 가드 소비자 넷의 catch 를 `instanceof SsrfBlockedError` 로 (3라운드/최종)

## 검토 범위

`http-safety.ts` 의 SSRF 가드가 던지는 **차단 판정**(`SsrfBlockedError`)과 **가드 자신의 고장**(그 밖의 오류)을 네
소비자(`http-request.handler.ts`, `http-redirect.ts`, `database-query.handler.ts`,
`database-connection-tester.ts`, 동반 `http-connection-tester.ts`)가 갈라 처리하도록 하는 변경 + 관련 plan/
tracker 문서. 코드(`codebase/**`)는 1·2라운드 리뷰의 조치 커밋(`e8d810405`, `fff0d14bf`) 이후 변경이 없다 —
이번 라운드의 새 커밋(`3e63e599f`)은 문서(RESOLUTION·트래커 등재)뿐이며, 실제 소스를 직접 열어 그 코드가
지금 이 상태 그대로임을 확인했다.

## 발견사항

- **[INFO]** 판정 아닌 가드 오류의 메시지 마스킹은 자격증명 패턴(`sanitizeMessage`)만 가리고 host/IP 는 가리지
  않아, "판정"(`SsrfBlockedError`) 분기가 명시적으로 지키는 정찰 면 축소(CWE-209)와 비대칭이다 — 1·2라운드에서
  이미 WARNING 으로 지적됐고, 이번 diff 의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가
  그 갭을 두 해법 후보와 함께 백로그(미해결, planner 결정 필요 — 전 노드 오류 문구에 영향)로 등재했다.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` `!(err instanceof SsrfBlockedError)` 분기(`logError.message` → `IntegrationError('INTEGRATION_CALL_FAILED', …)`) · `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` 같은 분기(`sanitizeMessage(detail)`) · `codebase/backend/src/modules/integrations/database-connection-tester.ts` 같은 분기(`clampMessage(sanitizeMessage(detail))`)
  - 상세: `sanitizeMessage`(`codebase/backend/src/nodes/integration/_base/integration-handler-base.ts` `SECRET_PATTERNS`)는 `password=`/`Bearer …`/32자+ base64·hex 블롭만 치환하고 hostname·IP 문자열은 손대지 않는다. 직접 확인한 결과 오늘 가드(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`, `http-safety.ts`)가 던질 수 있는 유일한 비-`SsrfBlockedError` 는 `isBlockedHostname` 의 `hostname.toLowerCase is not a function`(TypeError) 뿐이고, 이 메시지 자체에는 실제 hostname/IP 값이 들어가지 않는다(V8 이 표현식 텍스트만 인용) — 플랜의 "실측했다"는 서술과 일치한다. 그 경로(`validateCredentials` 의 `typeof value !== 'string'` 거절)로 인해 API 로도 닿지 않는다. 즉 **현재는 악용 가능한 유출이 없다** — 다만 가드 구현이 바뀌어(예: fail-open 정책 변경·하위 라이브러리 오류를 그대로 감쌈) host/IP 를 담은 plain `Error` 를 던지게 되면 이 세 경로가 그것을 client output.error / Activity API(`GET /integrations/:id/activity`) 로 그대로 흘려보낸다.
  - 제안: 조치 불요(이미 백로그 등재·근거 기록됨). 백로그 항목을 닫을 때 세 곳을 고정 문구로 바꾸거나 `sanitizeMessage` 에 host/IP 패턴을 추가하는 결정을 내리면 된다.

- **[INFO]** `http-connection-tester.ts` 의 `describeFailure` → `clampMessage` 경로는 시크릿 패턴 마스킹조차
  거치지 않는다(길이만 자름) — 이 PR 로 SSRF 가드의 "고장"도 이 경로에 새로 합류하지만(동반 1건: preflight 를
  `try` 안으로), 위와 같은 이유로 지금은 host/IP·시크릿 어느 것도 실을 수 없어 실질 유출은 없다. 트래커에
  "이 PR 이 만든 자리가 아니라 그대로 뒀다"고 명시적으로 defer 됨.
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` `testHttpConnection` 의 `catch (err)` 블록 (`message: clampMessage(describeFailure(err))`)
  - 제안: 조치 불요 — 위 INFO 항목을 고칠 때 이 경로도 같은 갭에 노출된다는 점을 함께 반영.

- **[INFO]** 판정 분기(`SsrfBlockedError`)는 네 소비자 전부 fail-closed 를 유지한다 — 가드가 어느 쪽으로 오류를
  던지든(판정이든 고장이든) 실제 네트워크 호출/DB 연결/`fetch` 이전에 즉시 반환하거나 재throw 하며, "일단 통과"로
  새는 경로는 없다. `SsrfBlockedError.message`(차단 host/IP 원문 포함)는 어느 클라이언트 응답에도 직접 실리지
  않고 — `http-request.handler.ts`/`database-query.handler.ts`/`database-connection-tester.ts` 는 고정 일반화
  문구(`SSRF_BLOCKED_CLIENT_MESSAGE`/`DB_HOST_BLOCKED_MESSAGE`)로 치환, `http-redirect.ts`/`http-connection-tester.ts`
  의 `reason` 은 `logger.warn` 서버 로그 전용이고 클라이언트에는 같은 고정 문구가 나간다 — CWE-209 정찰 면 축소가
  이번 diff 로 보존된다. 새 인젝션(SQL/커맨드/경로 탐색)·인증 우회·하드코딩 시크릿·안전하지 않은 암호화는
  발견되지 않았다. `err.stack` 등 예외 객체 원본이 그대로 노출되는 자리도 없다.

## 관측된 이상 상태 (이번 리뷰의 결함 아님 — 병렬 작업 흔적)

리뷰 도중 저장소 상태를 확인하는 명령이 일시적으로
`codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` 와
`codebase/backend/src/nodes/integration/http-request/http-redirect.ts` 를 수정됨으로 표시했다. 그 시점의 diff 는
정확히 이 PR 의 판정/고장 분기를 되돌리는 형태였다 — 전자는 `if (!(err instanceof SsrfBlockedError))` 가
`if (true)` 로, 후자는 `outboundBlockReason` 의 `if (err instanceof SsrfBlockedError) return err.message; throw err;`
가 `return err instanceof Error ? err.message : String(err);`(판정 아닌 오류도 삼켜 차단 사유로 돌리는 옛 동작)로
바뀌어 있었다 — plan(`plan/in-progress/ssrf-catch-instanceof.md`)이 서술한 뮤턴트 검증과 정확히 같은 모양이라,
같은 워크트리를 쓰는 다른 세션의 뮤테이션 테스트 잔여물로 보인다. 본 리뷰는 이 파일들을 직접 고치거나
소스 관리 명령으로 되돌리지 않았고, 잠시 후 다시 확인했을 때는 두 파일 모두 원상태로 자체 복원돼 있었다 —
위 발견사항·"검토 범위" 절은 그 복원된(=클린) 상태를 대상으로 한 것이다. 다음 사람이 같은 잔여물을 다시
보더라도 이 라운드의 결함이 아니라 병렬 세션의 흔적임을 참고하라.

## 요약

이번(3라운드) diff 는 1·2라운드에서 이미 지적·조치된 상태에서 **코드 변경 없이** 문서(RESOLUTION·트래커 백로그
등재)만 추가한 라운드다. 직접 소스를 열어 확인한 결과 SSRF 판정/고장 분기는 네 소비자 모두 fail-closed 를
유지하고, 차단 판정의 host/IP 는 여전히 서버 로그 전용으로만 남으며 클라이언트에는 고정 일반화 문구만 나간다.
유일한 잔여 우려는 "가드 고장" 메시지의 host/IP 비마스킹(CWE-209 비대칭)인데, 이는 이미 두 라운드에 걸쳐
WARNING 으로 지적됐고 이번 diff 가 그것을 근거·해법 후보와 함께 plan 백로그에 정식 등재했으며, 오늘 가드가
낼 수 있는 유일한 비판정 오류(`TypeError`)에는 host/IP 가 없어 실측상 즉시 악용 가능성이 없다 — 그래서 이번
라운드에서는 INFO 로 하향해 수렴시킨다. 리뷰 도중 관측된 두 파일의 일시적 뮤테이션(위 절)은 병렬 세션의 흔적일
뿐 이번 diff 의 결함이 아니며, 재확인 시점에 스스로 복원돼 있었다. 새로 열린 인젝션·인증 우회·시크릿 노출·
암호화 약화는 없다.

## 위험도

LOW
