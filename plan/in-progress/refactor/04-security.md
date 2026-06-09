# Refactor 백로그 — 보안 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 4 (C-1 은 기존 plan 참조로 본문 1건 외부 추적).
> 전반 평가: SSRF 이중 레이어(IP literal + DNS resolve), AES-256-GCM(AAD), WS 채널 소유권 검증, DOMPurify, OAuth state 토큰 등 핵심 패턴은 갖춰져 있음. 아래는 잔여 갭.

## Critical

- [ ] **C-1 JWT secret 기본값 fallback** — `backend/src/common/config/jwt.config.ts:4` (`process.env.JWT_SECRET || 'dev-jwt-secret'`)
  → **기존 plan [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) (2026-06-02, 미착수) 에서 추적** — 본 백로그에서는 착수 우선순위 상향(P0)만 표시. 해당 plan 의 "동일 패턴 다른 secret 동반 점검" 항목에 `ENCRYPTION_KEY`/`INTERACTION_JWT_SECRET` 포함할 것.

- [ ] **C-2 code 노드 `vm.Script` 는 sandbox 가 아님 — host 탈출 가능** — `backend/src/nodes/data/code/code.handler.ts:212-233`
  Node.js `vm` 은 공식적으로 신뢰 불가 코드 격리 수단이 아님. sandbox 에 `Promise`/`Array`/`Object`/`Error` 생성자가 노출되어 `this.constructor.constructor('return process')()` 류 prototype-chain 탈출로 서버 프로세스 장악 가능. 워크플로 작성 권한만으로 공격 성립.
  → `isolated-vm`(V8 Isolate), 권한 없는 `worker_threads`, 또는 컨테이너/gVisor 기반 sandboxed runner 로 교체. 교체 전 단기 완화는 M-2 (Promise 미노출) 적용.

- [ ] **C-3 `authentication=none` HTTP Request 노드 SSRF 가드 미적용** — `backend/src/nodes/integration/http-request/http-request.handler.ts:320-356`
  가드(`assertSafeOutboundUrl` + DNS resolve 검증)가 `authentication === 'integration'` 분기에서만 실행 — 미인증 노드로 `http://169.254.169.254/...`, 내부 관리 API 등 내부망 자유 접근 가능.
  → 가드를 인증 방식과 무관하게 전체 outbound fetch 에 적용. 내부 인프라 접근이 정말 필요한 배포는 `ALLOWED_INTERNAL_HOSTS` allowlist 로 명시 허용. 인프라 레벨 IMDSv2 강제 + egress 방화벽 병행.

## Major

- [ ] **M-1 Swagger UI 프로덕션 무인증 노출** — `backend/src/main.ts:147`
  → `NODE_ENV !== 'production'` 분기 또는 IP allowlist/Basic Auth 전치.

- [ ] **M-2 vm sandbox 에 `Promise` 생성자 직접 노출** — `code.handler.ts:128`
  executor 동기 실행 특성으로 host `Function` 도달 경로. → C-2 해결 전 단기 완화로 `Promise: undefined` 강화.

- [ ] **M-3 ReDoS — regex 길이 제한만 있고 위험 패턴 검출 없음** — `nodes/core/condition-evaluator.util.ts:202-213`, `filter.handler.ts:102`, `transform.handler.ts:38` (MAX_REGEX_LENGTH=200)
  200자 이내 지수 역추적 패턴(`(a+)+$` 류) 허용 — worker 스레드 무기한 점유 가능.
  → `re2`(선형 시간 보장) 교체 또는 `safe-regex`/`recheck` 사전 검출. 단기: regex 실행에 timeout AbortController 결합.

- [ ] **M-4 `.env.example` 의 ENCRYPTION_KEY 가 실사용 가능한 구체값** — `backend/.env.example:109-113` (S3 minioadmin 류와 달리 hex 64자 구체값)
  → `change-me-*` placeholder 로 교체 + 부팅 시 기본 예시값과 일치하면 경고/거부.

- [ ] **M-5 refresh token 쿠키 `SameSite=None`** — `backend/src/modules/auth/utils/refresh-cookie.ts:19`
  cross-site 배포용 의도적 선택으로 보이나 CSRF 전제 성립.
  → 동일 상위 도메인이면 `Lax`/`Strict` 강화, `/auth/refresh` 에 CSRF 토큰(double-submit/custom header) 추가, cookie path 를 auth 경로로 축소.

- [ ] **M-6 WS `workflow:`·`notifications:` 채널 authorizer 부재** — `backend/src/modules/websocket/websocket.gateway.ts:30-150`
  `execution:`/`kb:`/`background:run:` 은 소유권 검증 authorizer 가 있으나 `workflow:` 채널은 없음 — 인증된 사용자가 타 workspace workflow 이벤트 수신 가능성.
  → `workflow:` 채널에 workspace 소유 검증 authorizer 추가, `notifications:<userId>` 는 JWT userId 일치 검증.

- [ ] **M-7 `MCP_ALLOW_INSECURE_URL=true` 프로덕션 fail-fast 가드 없음** — `backend/src/modules/mcp/mcp-client.service.ts:24-27`
  `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 와 달리 프로덕션에서 SSRF 보호를 조용히 무력화 가능.
  → `main.ts` 부팅 가드에 동일 패턴 추가 (`ALLOW_PRIVATE_HOST_TARGETS` 포함).

## Minor

- [ ] **m-1 web-chat HTML sanitize — `ALLOWED_TAGS` 화이트리스트 미적용** — `channel-web-chat/src/lib/safe-html.ts:64-70`
  현재 FORBID 블랙리스트 방식. → 필요 태그만 명시하는 ALLOWED_TAGS 화이트리스트 전환 (코드 주석에 이미 하드닝 옵션으로 기재).

- [ ] **m-2 비프로덕션 `NODE_ENV` 에서 error.stack 응답 노출** — `code.handler.ts:309-321`
  staging 을 development 로 운영 시 내부 경로 노출. → 스택 노출을 별도 `DEBUG_MODE` 로 분리 또는 staging=production 운영 가이드 명시.

- [ ] **m-3 `trust proxy 1` — Cloudflare 직접 접근 차단 전제의 정기 검증 부재** — `backend/src/main.ts:77`
  → Authenticated Origin Pulls / WAF 강제 여부 정기 점검 절차 수립 (인프라 문서화).

- [ ] **m-4 database-query 노드 Pool 캐시 — credential rotation 전파 지연** — `nodes/integration/database-query/database-query.handler.ts:345-376`
  멀티 인스턴스에서 캐시 무효화 미조율 (침해 대응 시간에 영향).
  → integration 업데이트 이벤트 pub/sub 전파로 해당 Pool 즉시 무효화.
