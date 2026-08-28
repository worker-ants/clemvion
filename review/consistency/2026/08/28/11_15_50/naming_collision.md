# 신규 식별자 충돌 검토 — `spec/5-system/`

## 사전 확인: target 은 origin/main 대비 diff 가 없다

`git diff origin/main -- spec/5-system/` 가 **빈 결과**다. 즉 번들에 포함된 `1-auth.md` /
`2-api-convention.md` / `3-error-handling.md` (본문 전체 로드됨, 나머지 15개 파일은 컨텍스트
예산 초과로 절단됨)는 이번 브랜치(`eslint10-upgrade`)에서 **한 글자도 바뀌지 않았다** — 이
브랜치는 lint 툴체인/의존성 업그레이드이고 `spec/**` 변경이 없다. 따라서 본 리뷰는 "새로 도입된
식별자" 를 찾는 것이 아니라, 이미 정착된 spec 영역이 다른 영역과 충돌 없이 안정 상태인지를
재확인하는 성격이 됐다. 이 전제 위에서 아래 6개 관점을 능동적으로 grep 대조했다.

## 발견사항

### 요구사항 ID / 에러 코드 네임스페이스 — 충돌 없음 확인
- 대상: `WH-*`(webhook), `CCH-*`(chat-channel), `EIA-*`/`R\d+`(external-interaction-api),
  `R-CC-*`(chat-channel rationale) prefix.
- `spec/2-navigation/6-config.md`, `spec/2-navigation/2-trigger-list.md`,
  `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/5-system/15-chat-channel.md` 등에서
  `WH-NF-02`/`WH-SC-04`/`WH-EP-07` 등을 인용하지만 전부 **12-webhook.md 를 SoT 로 가리키는
  참조**이지 동일 ID 를 다른 의미로 재정의하는 사례가 아니다. `§R17`(EIA) 도
  `spec/conventions/egress-masking.md`·`spec/conventions/node-output.md`·
  `spec/conventions/conversation-thread.md` 등에서 동일하게 "EIA §R17 참조" 형태로만 나타나며,
  다른 문서가 자체 `R17` 을 신설해 겹치는 사례는 없다.
- `RATE_LIMITED` 라는 동일 문자열이 (1) HTTP 전역 429 기본값(§1.1 error-handling), (2) WS
  `WsRateLimitGuard`(§1.5), (3) EIA `/interact` inbound(§1.6), (4) Cafe24/MakeShop 계열은
  `CAFE24_RATE_LIMITED`/`MAKESHOP_RATE_LIMITED` 로 별도 접두 — 네 곳에서 쓰이지만 문서 자체가
  "표면이 다른 별도 발행" 이라고 매번 명시하고 있어 실질적 의미 충돌이 아니라 **문서화된 다층
  재사용**이다. 마찬가지로 `PASSWORD_INVALID`(재인증/2FA 재확인) vs `INVALID_PASSWORD`(비밀번호
  변경)·`PASSWORD_REQUIRED` 근접 명명도 spec 이 "근접 명명 주의" 각주로 이미 자체 경고하고 있다.
  → 신규 충돌 아님, 재확인만 기록.

### 엔티티/타입명 — 충돌 없음 확인
- `Session`(auth family/refresh 세션) 개념이 다른 spec 영역에서 별도 의미(예: 대화 세션)로
  재정의된 사례를 찾지 못했다. `ChatSession` 류 명칭은 `spec/3-workflow-editor/4-ai-assistant.md`
  · `spec/5-system/7-llm-client.md` 에서만 나타나며 auth 의 `family_id` 기반 세션과 이름이
  겹치지 않는다(별도 용어 `ChatSession`).
- `AuditLogDto`/`SessionListDto`/`WebAuthnCredentialListDto`/`PaginatedResponseDto` 등은
  `spec/conventions/swagger.md` 규약과 정합하는 이름이며 타 영역에서 동명 타입이 다른 shape 으로
  재정의된 흔적 없음.

### API endpoint — 충돌 없음 확인
- `/api/auth/*`, `GET /api/health`, `/api/health/live`, `/api/system-status/overview` 를
  grep 했을 때 이 문서군(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`/
  `16-system-status-api.md`/`data-flow/9-observability.md`/`_product-overview.md`) 밖에서
  동일 경로가 다른 메서드·의미로 재정의된 곳은 없다. `/api/health/live` 는 `3-error-handling.md`
  §7 이 "신규 엔드포인트" 라고 소개하지만 실제로는 `data-flow/9-observability.md §1.1` 이 이미 SoT 로
  갖고 있던 것을 인용하는 형태라 충돌이 아니라 정합.
- Webhook 수신 엔드포인트(`POST /api/hooks/{endpoint_path}`)와 위젯 부팅용
  `GET /api/hooks/{endpoint_path}/embed-config` 가 같은 라우터를 공유하는 점은 §11.2 가 명시적으로
  "webhook 수신이 아니라 별도 용도" 라고 구분해 두어 계약 충돌 소지가 없다.

### 이벤트/메시지명 — 충돌 없음 확인
- WS 이벤트 `execution.*`/`node.*`/`document:embedding_*`/`document:graph_*` 네임스페이스와
  감사 로그 액션 `<resource>.<verb>` 네임스페이스가 표기 스타일(dot vs colon)로 이미 분리돼 있어
  혼동 여지가 낮다. `session_revoked`(LoginHistory enum) 와 `member.removed`/`workspace.updated`
  등 audit action 은 서로 다른 테이블(`login_history` vs `audit_log`)에 귀속되며 문서가 그 경계를
  §4.1 말미에 명시한다.

### 환경변수·설정키 — 충돌 없음 확인
- `WEBAUTHN_RP_ID`/`WEBAUTHN_RP_NAME`/`WEBAUTHN_ORIGIN`/`WEBAUTHN_ALLOW_FALLBACK`,
  `TRUST_CF_CONNECTING_IP`, `COOKIE_SAMESITE` 를 코드베이스에서 grep 한 결과 spec 서술과 실제
  `codebase/backend/src/common/config/webauthn.config.ts` ·
  `codebase/backend/src/modules/auth/utils/client-ip.ts` ·
  `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` 구현이 정확히 일치하고, 동명의 env
  var 가 다른 모듈에서 다른 의미로 재사용되는 사례는 없다.
- `PROVIDER_PROBE_THROTTLE`/`SENSITIVE_ACTION_THROTTLE`/`INVITATION_THROTTLE` 도
  `codebase/backend/src/common/constants/throttle.ts` 의 단일 상수(`SENSITIVE_ACTION_THROTTLE`)에
  대한 컨트롤러별 별칭임이 코드·spec 양쪽에서 일관되게 문서화돼 있다.

### 파일 경로 — 충돌 없음 확인
- `spec/5-system/` 하위 번호 체계(1~17, `_product-overview.md`)에 중복 번호나 명명 컨벤션 이탈이
  없다(생략된 15개 파일도 목록상 번호가 겹치지 않음).

## 요약

이번 target 은 실질적으로 `origin/main` 과 동일한 기존 spec 콘텐츠이며(diff 0), eslint10-upgrade
브랜치가 이 영역에 새 식별자를 도입하지 않았다. 능동적으로 요구사항 ID·엔티티명·엔드포인트·
이벤트명·환경변수·파일 경로 6개 관점을 grep 기반으로 재대조한 결과, `spec/5-system/` 안팎에서
새로운 명명 충돌은 발견되지 않았다. 오히려 이 영역은 `RATE_LIMITED`/`PASSWORD_INVALID` 류
근접 명명을 spec 스스로 각주·Rationale 로 선제 문서화해 두는 성숙한 상태다. 결론적으로 이번
리뷰 시점 기준 신규 식별자 충돌 리스크는 없다.

## 위험도

NONE
