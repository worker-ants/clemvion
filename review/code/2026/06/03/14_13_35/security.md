# Security Review

## 발견사항

### **[WARNING]** `X-Workspace-Id` 헤더가 JWT 클레임보다 우선 적용됨 — IDOR 위험
- **위치**: `spec/data-flow/12-workspace.md` Rationale 섹션 ("X-Workspace-Id 헤더 우선 정책")
- **상세**: `WorkspaceId` 데코레이터가 `X-Workspace-Id` 헤더를 JWT `workspaceId` 클레임보다 우선 수용한다 (`workspace.decorator.ts: "Priority: X-Workspace-Id header > JWT workspaceId"`). 클라이언트가 자신이 멤버가 아닌 워크스페이스 ID를 헤더에 실어 보내면, 해당 요청의 서비스 레이어에서 workspace_id 검증이 누락된 핸들러가 하나라도 있을 경우 다른 워크스페이스의 리소스에 접근할 수 있는 IDOR(Insecure Direct Object Reference) 경로가 열린다. spec 자체도 "헤더 우선 수용은 해당 워크스페이스 멤버십 RBAC가 각 핸들러/서비스에서 검증된다는 전제에 의존한다"고 명시하며, 이 전제가 모든 엔드포인트에서 완전히 충족되는지는 추가 검증이 필요하다.
- **제안**: 토큰 재발급 기반 워크스페이스 전환(§1.5)을 조기에 구현해 헤더 우선 정책을 제거하거나, 최소한 헤더로 지정된 workspace_id가 JWT 서브젝트(userId)의 멤버십 테이블에 존재하는지를 `WorkspaceId` 데코레이터 레벨에서 일괄 검증하는 미들웨어/가드를 추가해야 한다. 현재 구조는 모든 서비스가 개별적으로 RBAC를 올바르게 수행한다는 가정에 의존하며 방어 깊이(defense-in-depth)가 부족하다.

### **[WARNING]** `alert_<rule.type>` 동적 알림 타입이 DB CHECK 제약 밖에 존재
- **위치**: `spec/data-flow/8-notifications.md` §1.1 Type 별 source · 트리거
- **상세**: `AlertsEvaluatorService.dispatchBreach`가 삽입하는 알림의 `type` 값이 `alert_<type>` 형태의 동적 문자열로, V052 마이그레이션의 CHECK 제약 목록 밖이라고 spec이 명시하고 있다. `notification.type` 컬럼에 CHECK 제약이 있음에도 이 경로가 정상 동작한다는 것은 CHECK가 실제로 해당 값을 검증하지 않거나, 적용이 일관적이지 않다는 의미다. 이는 인젝션/오염 가능성보다는 데이터 무결성 문제지만, `type` 값이 외부 입력에서 파생되는 경우 예상치 못한 값이 저장될 수 있다.
- **제안**: `alert_<type>` 패턴을 CHECK 제약으로 정규화하거나(예: `type LIKE 'alert_%'` 조건 추가), 알림 발사 전 허용된 타입 집합에 대한 화이트리스트 검증을 application 레이어에서 수행해야 한다.

### **[WARNING]** 워크스페이스 초대 수락 엔드포인트 URL 변경 — 클라이언트 불일치 잠재적 보안 우회
- **위치**: `spec/data-flow/12-workspace.md` §1.3 초대 수락 시퀀스
- **상세**: 초대 수락 엔드포인트가 `POST /api/workspace-invitations/accept`에서 `POST /api/workspaces/invitations/accept`로 변경되었다. 이메일로 발송된 초대 링크나 이전 클라이언트가 구 URL을 사용할 경우 404 응답을 받게 된다. 보안상 더 중요한 점은 이메일 불일치 시 응답 코드가 `403 INVITATION_EMAIL_MISMATCH`에서 `400 code=invitation_email_mismatch`로 변경되었는데, HTTP 403(Forbidden)이 정확한 의미론적 응답이며 400(Bad Request)으로의 변경이 일부 보안 스캐너/WAF 규칙을 우회할 수 있다.
- **제안**: 구 엔드포인트에 명시적인 `410 Gone` 또는 리다이렉트를 추가하여 혼란을 방지. 이메일 불일치는 접근 제어 실패이므로 403 유지를 권장.

### **[WARNING]** `(owner_id, type) UNIQUE` 제약이 DB 레벨에서 미강제
- **위치**: `spec/data-flow/12-workspace.md` Rationale "(owner_id, type) UNIQUE"
- **상세**: 한 사용자가 personal 워크스페이스를 2개 이상 가질 수 없도록 의도한 제약이 TypeORM `@Unique` 엔티티 데코레이터로만 표현되어 있고, 어떤 마이그레이션에도 대응하는 DB UNIQUE 제약이 없다. `synchronize`가 비활성화된 상태이므로 DB 레벨에서는 이 제약이 실제로 강제되지 않는다. 병렬 요청, 데이터 마이그레이션 스크립트, 또는 TypeORM 우회 경로가 존재할 경우 중복 personal 워크스페이스가 생성될 수 있으며, 이는 권한 분리 로직의 예상치 못한 동작을 유발할 수 있다.
- **제안**: 해당 UNIQUE 제약을 마이그레이션 SQL에 명시적으로 추가해야 한다. TypeORM 데코레이터 단독 의존은 마이그레이션 기반 schema 관리와 불일치한다.

### **[INFO]** Chat Channel Webhook 분기 시 일반 `AuthConfig` 인증 우회
- **위치**: `spec/data-flow/10-triggers.md` §1.5 Webhook → Chat Channel inbound 분기
- **상세**: `trigger.config.chatChannel`이 존재하면 일반 webhook 흐름(AuthConfig 인증, trigger parameter schema 검증)을 우회하여 provider별 자체 서명 검증을 사용한다. 이는 의도된 설계이며 Telegram/Slack/Discord의 서명 검증(각 provider 전용 헤더 사용)으로 보안을 유지한다. 다만 `chatChannelInboundAuthenticator.verify` 구현이 모든 provider에 대해 서명 검증을 빠짐없이 수행하는지, 그리고 미지원 provider에 대해 적절히 거부(400)하는지 확인이 필요하다.
- **제안**: `chatChannelInboundAuthenticator.verify`의 unit test가 각 provider의 서명 검증 실패 케이스를 커버하는지 확인. HMAC/Ed25519 검증에서 timing-safe 비교(`crypto.timingSafeEqual`)를 사용하는지 별도 코드 리뷰 필요.

### **[INFO]** OAuth 콜백이 access token을 URL에 포함하지 않음 — 보안 개선 확인
- **위치**: `spec/data-flow/2-auth.md` §1.3 OAuth 소셜 로그인
- **상세**: OAuth 콜백이 refresh token을 httpOnly 쿠키로만 설정하고 `{frontendUrl}/callback?success=true`로 리다이렉트하여, 프론트엔드가 `POST /api/auth/refresh`로 access token을 별도 발급받는 2단계 구조다. 이는 URL history/Referer/프록시 로그를 통한 토큰 노출을 방지하는 올바른 설계다.
- **제안**: 실패 시 리다이렉트 경로 `{frontendUrl}/callback?error={code}`에서 `error` 파라미터로 과도한 내부 정보(예: stack trace, DB 에러 메시지)가 노출되지 않는지 확인 필요.

### **[INFO]** 초대 토큰 강도 개선 확인
- **위치**: `spec/data-flow/12-workspace.md` §1.2 초대 발급 시퀀스
- **상세**: 초대 토큰 생성이 `randomBytes(32).toHex()`에서 `randomBytes(48).toString('base64url')`로 변경되었다. 64자 base64url(48바이트 = 384비트 엔트로피)은 충분한 강도를 가지며, `base64url`은 URL-safe 인코딩으로 올바른 선택이다. 보안 측면에서 개선된 변경이다.
- **제안**: 추가 조치 불필요.

### **[INFO]** S3 워크스페이스 격리가 DB 권한 검증에만 의존
- **위치**: `spec/data-flow/4-file-storage.md` Rationale
- **상세**: S3 key 패턴(`kb/<kbId>/<docId>/<sanitizedFilename>`)에 workspace prefix가 없으므로 S3 IAM 정책 레벨의 키 prefix 격리가 불가능하며, 워크스페이스 격리는 DB 권한 검증에만 의존한다. 현재 코드에 presigned URL 발급이 없어 클라이언트가 S3에 직접 접근하지 않으므로 현재는 허용 가능한 설계다. 단, 향후 presigned URL 도입 시 워크스페이스 경계 없이 kbId만 알면 타 워크스페이스 파일에 접근 가능한 URL이 발급될 위험이 있다.
- **제안**: presigned URL 도입 시 반드시 kbId → workspaceId 검증을 포함하는 서버사이드 게이트웨이를 통하도록 설계해야 한다.

### **[INFO]** `audit_log.action`이 자유 문자열 — typo 가능성
- **위치**: `spec/data-flow/1-audit.md` Rationale
- **상세**: `audit_log.action`은 DB CHECK 없이 자유 문자열(`VARCHAR(100)`)이다. application 레이어의 TypeScript 타입 정의가 일부 보호하지만, typo로 인한 오염 가능성은 여전히 존재한다. 보안 컴플라이언스 감사 목적으로 audit_log를 사용할 때 action 값의 무결성이 중요하다.
- **제안**: 감사 액션 타입에 대한 TypeScript enum 또는 const object를 정의하여 compile-time에 타입 안전성을 보장하고, `audit_log.action`에도 DB CHECK 제약 추가를 장기적으로 검토.

---

## 요약

이번 변경은 대부분 spec 문서의 구현 현황 동기화(sync)로, 새로운 코드 취약점을 직접 도입하지는 않는다. 그러나 spec이 현재 구현의 설계 결정을 명문화함으로써 기존에 잠재하던 두 가지 주요 보안 리스크가 드러났다: (1) `X-Workspace-Id` 헤더가 JWT 클레임보다 우선 적용되는 정책으로 인한 IDOR 가능성 — 모든 서비스 레이어의 RBAC 검증이 완전해야만 안전하다는 전제에 의존하므로 defense-in-depth가 부족하다; (2) `(owner_id, type) UNIQUE` DB 제약 미강제로 인한 personal workspace 중복 생성 가능성. OAuth 콜백의 token-in-URL 제거, 초대 토큰 강도 개선, 파일명 traversal 방지 sanitize 등은 긍정적인 보안 개선 사항이다. Chat Channel webhook 분기에서 provider별 서명 검증 구현의 정확성은 코드 레벨 추가 검토가 권장된다.

## 위험도

MEDIUM
