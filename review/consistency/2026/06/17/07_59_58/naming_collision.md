# 신규 식별자 충돌 검토

검토 범위: `spec/7-channel-web-chat` (spec) + 관련 구현 diff (diff-base=origin/main)
검토 모드: 구현 완료 후 검토 (--impl-done)

---

## 발견사항

이 diff 는 spec 영역 자체(spec/7-channel-web-chat)가 아니라 **의존성 업그레이드(otplib v12→v13, @types/node v22→v24 등) + 관련 코드 수정**이 주된 변경이다. 아래 식별자 관점에서 충돌 여부를 검토한다.

### [INFO] 기존 spec ID 중복 (`id: common`) — diff 도입이 아닌 기존 상태
- target 신규 식별자: 해당 없음 (본 diff 가 도입한 것이 아님)
- 기존 사용처: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/5-data/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 모두 `id: common` 로 동일 값
- 상세: `id: common` 이 6개 파일에서 중복 사용됨. 단, 이는 본 diff 이전부터 존재하던 기존 상태이며 이번 변경이 새로 도입하거나 악화시키지 않는다.
- 제안: 추후 spec ID 유일성 강제가 필요한 경우 `logic-common`, `flow-common`, `ai-common` 등 카테고리 prefix 부여 권고. 본 diff 차단 사유 아님.

### [INFO] `EPOCH_TOLERANCE_SECONDS` — 신규 상수, 충돌 없음
- target 신규 식별자: `EPOCH_TOLERANCE_SECONDS = 30` (`codebase/backend/src/modules/auth/totp.service.ts` 상단)
- 기존 사용처: 해당 상수명을 사용하는 다른 파일 없음 (전체 `codebase/backend/src` 탐색 결과)
- 상세: otplib v12 의 `authenticator.options = { window: 1 }` 을 v13 의 `epochTolerance` 옵션으로 교체하면서 상수로 추출. 동일 이름의 상수가 기존 코드베이스 어디에도 없음.
- 제안: 충돌 없음.

### [INFO] `verifyCode` 신규 private 메서드 — 충돌 없음
- target 신규 식별자: `private verifyCode(token: string, secret: string): boolean` (TotpService 내)
- 기존 사용처: 해당 메서드명을 사용하는 다른 auth 모듈 파일 없음. `verifyCode` 는 `totp.service.ts` 에만 존재.
- 상세: 기존에는 `authenticator.check()` 직접 호출이었으나, v13 API 변경(functional style)과 에러 방어 로직을 캡슐화하기 위해 private helper 로 추출. 동명 메서드가 다른 서비스에 없음.
- 제안: 충돌 없음.

### [INFO] 신규 otplib v13 함수 import (`generateSecret`, `generateURI`, `verifySync`, `generateSync`) — 충돌 없음
- target 신규 식별자: `generateSecret`, `generateURI`, `verifySync` (totp.service.ts), `generateSync` (totp.service.spec.ts)
- 기존 사용처: `codebase/backend/src` 내 다른 파일에서 해당 이름을 import 하거나 선언한 곳 없음.
- 상세: otplib v12 의 `authenticator` 단일 객체 API 에서 v13 functional API 로 교체된 것. 동일 이름의 함수를 다른 모듈이 별도 선언하거나 export 하지 않음. `spec/5-system/1-auth.md` 가 `verifySync`/`generateSync` 를 이미 v13 API 이름으로 언급하고 있어 spec 과 정합.
- 제안: 충돌 없음.

### [INFO] 신규 npm 패키지 이름 (`@otplib/hotp`, `@otplib/totp`, `@otplib/uri`, `@otplib/plugin-base32-scure`, `@otplib/plugin-crypto-noble`, `@scure/base`) — 충돌 없음
- target 신규 식별자: 위 패키지명들이 `package-lock.json` 에 새로 추가됨
- 기존 사용처: 이들은 otplib v12 의 `@otplib/plugin-crypto`, `@otplib/plugin-thirty-two`, `@otplib/preset-default`, `@otplib/preset-v11`, `thirty-two` 를 대체하는 것. 삭제된 v12 패키지들은 소스 코드(src/*.ts)에서 직접 import 되지 않았고 `otplib` 메인 패키지만 import.
- 상세: 패키지명 자체는 npm 스코프(`@otplib/*`, `@scure/*`, `@noble/*`)가 완전히 다르므로 기존 이름과 충돌 없음.
- 제안: 충돌 없음.

### [INFO] spec/7-channel-web-chat 영역 식별자 — 신규 충돌 없음
- target 신규 식별자: `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security` (spec frontmatter id)
- 기존 사용처: 전체 spec/ 에서 해당 이름을 사용하는 다른 문서 없음. 모두 `spec/7-channel-web-chat/` 내부에만 존재하며 다른 영역과 중복 없음.
- 상세: `spec/5-system/15-chat-channel.md` 의 `id: chat-channel` 과는 이름이 다르고 의미도 다름(server-side adapter vs client-side widget). 혼동 가능성 낮음.
- 제안: 충돌 없음.

### [INFO] 환경변수 `WEB_CHAT_WIDGET_ORIGINS` — 기존 정의와 일치
- target 신규 식별자: 이번 diff 에서 처음 도입한 것이 아님 — 이미 `spec/7-channel-web-chat/4-security.md §2.1` 과 `codebase/backend/.env.example:44` 에 정의되어 있음.
- 기존 사용처: `codebase/backend/src/common/cors/web-chat-cors.ts`, `codebase/backend/src/main.ts` — 동일 의미로 사용.
- 상세: 본 diff 가 신설한 키가 아니므로 신규 충돌 없음. 기존 사용처와 완전히 일치.
- 제안: 해당 없음.

---

## 요약

본 diff 는 spec/7-channel-web-chat 자체의 신규 식별자 도입이 아니라 의존성 버전 업그레이드(otplib v12→v13, @types/node v22→v24 등)와 그에 따른 내부 구현 수정이 주 내용이다. 새로 도입된 코드 식별자(`EPOCH_TOLERANCE_SECONDS`, `verifyCode`, otplib v13 functional imports)는 기존 코드베이스·spec 어디와도 이름·의미가 충돌하지 않는다. 이미 존재하던 `id: common` 중복(spec/4-nodes/ 하위 6개 파일)은 이번 diff 와 무관한 기존 상태다. 신규 식별자 충돌 관점에서 차단 사유는 존재하지 않는다.

---

## 위험도

NONE
