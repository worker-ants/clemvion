# 웹채팅 SDK 샘플

spec/7-channel-web-chat 의 두 사용 모드를 시연한다.

| 파일 | 모드 | 설명 |
|---|---|---|
| [`snippet.html`](./snippet.html) | M1 Hosted (스니펫) | 비개발자용 — `<script>` 로더 + `ClemvionChat('boot', ...)` 한 블록 |
| [`npm-usage.ts`](./npm-usage.ts) | M1 Hosted (npm) | 개발자용 — `@clemvion/web-chat` import, 타입·이벤트·프로그래matic 제어 |
| [`byo-ui-headless.ts`](./byo-ui-headless.ts) | M2 BYO-UI | 개발자가 EIA 클라이언트로 자체 UI 구성·자기 도메인 서빙(개념 예시) |

## 플레이스홀더

- `<widget-cdn-base>` / `<api-base>` 는 **배포 환경 값**(0-architecture §4). 실제 도메인으로 치환.
- `triggerEndpointPath` 는 위젯이 붙는 **공개(auth 없음) 웹훅 트리거의 endpoint path**(3-auth-session §1).

## 주의 (M2)

BYO-UI 는 호출 Origin 이 고객 도메인이므로, 워크스페이스 설정 `interactionAllowedOrigins` 에 그 도메인을
등록해야 `/api/external/*` CORS 가 허용된다(4-security §2).
