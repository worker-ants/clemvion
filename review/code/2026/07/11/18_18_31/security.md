# 보안(Security) 리뷰 결과

## 검토 범위
- `codebase/channel-web-chat/src/lib/widget-state.ts` — 주석(문서화)만 변경, 로직 무변경
- `codebase/channel-web-chat/src/widget/use-widget.ts` — `newChat()`: booting 중 single-flight coalesce + 확립 세션발 이전 execution best-effort `cancel` 로직 추가
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 위 로직에 대한 신규 테스트(R9-A/R9-B-1) 3건
- `plan/in-progress/spec-draft-webchat-execution-residuals.md`, `review/consistency/2026/07/11/17_54_21/*`, `spec/7-channel-web-chat/1-widget-app.md` — 문서/계획/리뷰 산출물(코드 아님)

### 발견사항

- **[INFO]** best-effort `cancel` 실패 원문이 브라우저 콘솔에 노출
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L1099-1106 (`newChat` 내 `.catch((e) => console.warn(...))`)
  - 상세: `client.interact(prevSession.endpoints, prevSession.token, { command: "cancel", ... })` 실패 시 `e.message` 원문을 `console.warn` 으로 그대로 출력한다. 이 위젯은 임베드된 공개 페이지에서 동작하므로 브라우저 devtools 를 연 사용자 본인에게는 노출되지만, 이는 파일 하단에 이미 문서화된 기존 설계(`errMessage()` — "진단 원문은 console 에만, UI 비노출")와 동일한 패턴이며 `endConversation`/`sendCommand` 에도 이미 존재한다. UI(`GENERIC_ERROR_MESSAGE`)에는 노출되지 않으므로 타 사용자·서버 로그로의 정보 유출 경로는 아니다.
  - 제안: 현행 유지 가능. 다만 서버가 이 콘솔 출력에 세션 토큰이나 내부 스택트레이스 같은 민감정보를 담은 에러 메시지를 반환하지 않도록 EIA 쪽 에러 바디 정책(이미 4-security §5 로 규정)을 유지할 것.

- **[INFO]** 토큰을 사용한 best-effort cancel 요청은 캡처된 이전 세션 자격만 사용
  - 위치: `use-widget.ts` L1093-1094 (`const prevSession = sessionRef.current; const client = clientRef.current;`)
  - 상세: `resetSessionRefs()` 호출 이전에 이전 세션(`token`, `endpoints`)을 캡처해 이후 `cancel` 명령에 사용한다. 이는 위젯 자신이 발급받은 `per_execution` 토큰을 자신의 execution 을 취소하는 데만 쓰는 것으로, 새로운 권한 상승이나 타 세션 접근 경로를 만들지 않는다. 인가는 서버(EIA `InteractionGuard`)가 토큰 기반으로 계속 강제하며 이 diff 로 변경되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트의 토큰 값은 픽스처용 더미
  - 위치: `use-widget-eager-start.test.ts` (`token: "iext_x"` 등, 기존 테스트 패턴과 동일)
  - 상세: 하드코딩된 실제 시크릿이 아니라 테스트 픽스처 상수. grep 결과 diff 전체에서 실제 API 키/비밀번호/인증서 패턴 없음.
  - 제안: 조치 불요.

### 요약
이번 변경분은 웹채팅 위젯의 "새 대화(newChat)" 클라이언트 로직에 (A) booting 중 in-flight start 로의 single-flight coalesce, (B) 확립 세션에 대한 best-effort `cancel` 명령 발행을 추가한 것으로, 순수 클라이언트 상태-머신/네트워크 호출 순서 조정이다. 신규 사용자 입력 처리 경로나 신규 서버 엔드포인트가 없고, 인증/인가는 기존 per_execution 토큰 체계를 그대로 재사용하며 서버 측 검증 로직에는 변경이 없다. 인젝션·하드코딩 시크릿·안전하지 않은 암호화·신규 의존성 등 위험 패턴은 발견되지 않았다. 유일하게 주목할 점은 실패한 cancel 명령의 원문 에러가 `console.warn` 으로 출력되는 것인데, 이는 기존에 문서화·일관 적용된 "UI 는 일반화 문구, console 은 진단 원문" 설계를 그대로 따른 것이라 새로운 위험을 추가하지 않는다. 나머지 변경분(테스트 파일, plan/spec/review 문서)은 코드 실행 경로에 영향이 없다.

### 위험도
NONE
