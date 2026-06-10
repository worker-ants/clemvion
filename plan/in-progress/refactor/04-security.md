# Refactor 백로그 — 보안 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 7 / Minor 4 — **spec 대조(2026-06-10) 후 전 항목 유효** (철회 0).
> **spec 대조 판정 분포**: A 6 (C-2, M-2, M-3, m-2, m-3, m-4) / B 2 / C 2 (M-6, M-7 — spec 자체 갭/enforcement 비대칭) / D 4.
> **⚠️ A(의도된 트레이드오프)인데 여전히 위험**: C-2, M-2, M-3 (결정 대기), m-4 (✅ 2026-06-10 사용자 승인 — pub/sub 전파 진행 확정). spec 이 위험을 인지·기록했으나 방어가 실질 불충분한 항목들로, 제거하지 않고 유지한다.
> 전반 평가: SSRF 이중 레이어, AES-256-GCM(AAD), WS 소유권 검증, DOMPurify, OAuth state 등 핵심 패턴 양호. fail-closed 부팅 가드의 **비대칭**(EIA·STUB 류는 있고 C-1·M-4·M-7 은 없음)이 공통 패턴.

## Critical

- [ ] **C-1 JWT secret 기본값 fallback** — `backend/src/common/config/jwt.config.ts:4`
  - **spec 대조**: D — auth spec 은 secret 부팅 정책 무언급이나, **동형 secret 의 fail-closed 가 spec 에 명문화돼 있음**: `14-external-interaction-api.md:651` "`INTERACTION_JWT_SECRET` … production 에서는 생성자가 throw 해 부팅 차단 (fail-closed — OAUTH_STUB/LLM_STUB 가드와 동형)". 코어 `JWT_SECRET` 에만 그 표준 패턴이 누락된 갭 — 의도된 트레이드오프 아님.
  - **추적**: 기존 plan [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) (미착수, P0). 본 백로그는 우선순위 상향만 표시.
  - **개선 방안**: 1. `|| 'dev-jwt-secret'` 제거 + `main.ts` 부팅 가드에 `production && !JWT_SECRET → throw` (EIA/STUB 가드와 동일 위치·패턴 — M-4·M-7 과 단일 "production secret/insecure-flag 가드" 블록으로 응집 권장). 2. `ENCRYPTION_KEY`/`INTERACTION_JWT_SECRET` 동반 점검(M-4 합류). 3. dev/test/e2e 의 JWT_SECRET 주입 경로 선점검 — e2e 가 기본값에 암묵 의존 시 부팅 실패.
  - 검증: production+미설정 부팅 거부 unit / dev 정상+warn. / 회귀 위험: e2e 기본값 의존 — 주입 경로 선점검 필수. / spec 갱신: `1-auth.md §2` 에 fail-closed 1줄 + Rationale (planner).

- [ ] **C-2 code 노드 `vm.Script` 는 sandbox 가 아님 — host 탈출 가능** ⚠️ **(A — spec 이 위험을 명시 기록한 트레이드오프, 그러나 여전히 위험)** — `nodes/data/code/code.handler.ts:212-233`
  - **spec 대조**: **A** — `2-code.md §7.1` Rationale: "`node:vm` 은 … **완벽한 sandbox escape 방어는 불가**하므로 추후 `isolated-vm` 등으로 재검토한다" + 로드맵 행 "필요해지면 isolated-vm(V8 Isolate) 또는 Docker 격리로 전환". 즉 escape 위험은 spec 이 인지한 의도적 트레이드오프. **그러나** Editor 권한만으로 `this.constructor.constructor('return process')()` 류 prototype-chain 탈출 → 호스트 장악이 성립하고, spec 은 위협 모델 경계(다중 워크스페이스 SaaS vs self-host)를 명시하지 않음 — 위험 수용 주체가 불명확. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) `isolated-vm` 전환 — spec 로드맵이 이미 지정 (네이티브 빌드 의존성 트레이드오프 수반). 2. (대안) 권한 박탈 `worker_threads` 또는 컨테이너/gVisor runner — self-host 배포 단순성 우선이면 컨테이너가 적합. 3. (단기 완화) 노출 생성자의 `.constructor` 접근 차단(frozen prototype 셰도 객체) — 단 근본 해결 아님(우회 다수). **Promise 제거 단기완화는 M-2 참조 — spec 모순이라 단독 불가.**
  - 검증: vm escape PoC 회귀 테스트 — 현재 통과(취약)함을 빨간불로 만들고 전환 후 차단 확인. / 회귀 위험: isolated-vm 은 `$helpers` 전달 방식이 달라 기존 사용자 코드 호환성 검증 필요(dayjs·crypto 직렬화) + node-gyp 빌드 추가. / spec 갱신: §7.1 에 위협 모델(code 노드 작성 권한 = Editor+)과 운영 경계 Rationale 명시, 전환 시 "현재 구현" 행 교체 (planner).

- [ ] **C-3 `authentication=none` HTTP Request 노드 SSRF 가드 미적용 — spec 내부 모순 발견** — `nodes/integration/http-request/http-request.handler.ts:316-356`
  - **spec 대조**: D — **현 동작은 spec 에 충실**: `1-http-request.md §4 step 8` "SSRF 가드 (`authentication='integration'` **일 때만**)". **그러나 같은 문서 §104 노트("기본은 차단 — secure-by-default … self-host 가 정당 접근 시에만 `ALLOW_PRIVATE_HOST_TARGETS` 켠다")와 상호 모순**이고, 코드 주석의 정당화("may legitimately target internal services")는 **어느 spec 에도 근거 없음**(키워드 검색 0건). 그 용도는 이미 `ALLOW_PRIVATE_HOST_TARGETS` opt-out 으로 충족 — none 무가드를 둘 이유 없음. DB/Email/MCP 의 일관된 secure-by-default posture·`NF-SC-05`(OWASP) 와도 배치.
  - **개선 방안**: 1. (근본) 가드를 인증 방식 **무관하게 전체 outbound** 에 적용 — 내부 접근은 `ALLOW_PRIVATE_HOST_TARGETS=true` 로만 (타 노드와 동일 플래그·posture). 2. (보강) redirect manual follow 의 매 홉 재검증도 none/custom 으로 확장. 3. (인프라) IMDSv2 강제 + egress 방화벽 병행.
  - 검증: none 인증으로 `169.254.169.254`/`10.0.0.1`/DNS rebinding 차단 e2e + 플래그 on 시 통과. / 회귀 위험: **none 으로 사내 API 호출하던 기존 self-host 워크플로가 깨짐** — 릴리스 노트 + 부팅 warn 필요. / **spec 갱신: 필요** — §4 step 8 을 "전 인증 방식 적용" 으로 수정 + §104 와 정합화 + Rationale 기록 (planner — spec 모순 해소가 선행).

## Major

- [ ] **M-1 Swagger UI 프로덕션 무인증 노출** — `main.ts:147`
  - **spec 대조**: B — `swagger.md`(DTO 패턴만)·`2-api-convention.md` 모두 UI 노출 게이팅 무언급. 의도 근거 없음.
  - **개선 방안**: 1. `NODE_ENV !== 'production'` 분기 (OAUTH/LLM stub 가드와 동일 패턴). 2. (대안) prod 노출 필요 시 `ENABLE_SWAGGER_IN_PROD` opt-in + Basic Auth/IP allowlist 전치.
  - 검증: prod 빌드 `/docs` 404, dev 200. / 회귀 위험: prod 디버깅 습관 — opt-in env 로 escape hatch. / spec 갱신: swagger.md 또는 api-convention 에 "non-production 전용" 규약 (planner).

- [ ] **M-2 vm sandbox 에 `Promise` 생성자 직접 노출** ⚠️ **(A — spec 이 명시 약속한 기능: 단독 제거 불가)** — `code.handler.ts:129`
  - **spec 대조**: **A** — `2-code.md §4.1` "비동기 코드 지원: async/await / Promise 모두 사용 가능", §7.3 허용 표에 Promise 명시. **원안의 "Promise: undefined 단기완화" 는 spec 과 정면 모순** — async 지원이 code 노드의 기능 약속이라 단독 적용 시 모든 async 사용자 코드 파손. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) C-2 의 isolated-vm/컨테이너 전환에 **흡수** — Promise 를 안전하게 유지하며 격리. 본 항목 단독 처리 금지. 2. (단기를 굳이 택한다면) §4.1/§7.3 의 spec 개정 동반 필수 (async 철회 또는 안전 래퍼) — planner 합의 없이 코드만 변경 금지.
  - 검증: §4.1 top-level await 예시 회귀. / 회귀 위험: Promise 제거 = async 전면 파손. / spec 갱신: 단기안 채택 시 §4.1/§7.3 개정 필수.

- [ ] **M-3 ReDoS — regex 길이 제한만 있고 위험 패턴 검출 없음** ⚠️ **(A — 단 spec 의 방어 효과 주장이 부정확)** — `condition-evaluator.util.ts:202-213`, `filter.handler.ts:102`, `transform.handler.ts:38`
  - **spec 대조**: **A** — 길이 200 제한이 spec 의 명시 정책: `1-transform.md:66` "ReDoS 방지를 위해 regex 패턴 길이는 200자 이내", filter/if-else/switch 동일. **그러나 길이 제한은 ReDoS 를 막지 못함** — 200자 이내 `(a+)+$` 지수 패턴이 worker 무기한 점유 가능. spec 이 "방지" 라 단언한 효과 주장이 부정확 — NF-SC-05 목표 미달성. **사용자 보고 대상.**
  - **개선 방안**: 1. (근본) `re2`(선형 시간 보장)로 사용자 regex 평가 교체. 2. (대안) `safe-regex`/`recheck` 컴파일 시 사전 검출 → silent false + `meta.invalidRegexPatterns` 기존 채널로 가시화. 3. (단기) regex 실행 timeout/AbortController 상한.
  - 검증: `(a+)+$` + 긴 비매칭 입력 평가 시간 상한 회귀(현재 hang 재현 → 수정 후 빠른 false). / 회귀 위험: re2 는 backreference/lookahead 미지원 — 기존 사용자 패턴 호환성 audit 필수. / **spec 갱신: 필요** — 4개 spec 의 "길이 200 = ReDoS 방지" 서술 정정 + ReDoS 정책을 1곳(0-common 또는 expression-language)에 단일 정의 (planner).

- [ ] **M-4 `.env.example` 의 ENCRYPTION_KEY 가 실사용 가능한 구체값** — `.env.example:139-140`
  - **spec 대조**: D — `secret-store.md:151` 은 "정확 64-char hex (.env.example 의 표준)" 으로 **형식**만 표준화 — 복붙 가능한 구체값이어야 한다는 의도는 없음. 같은 파일의 `INTEGRATION_ENCRYPTION_KEY=change-me-...` placeholder 와 비대칭.
  - **개선 방안**: 1. 형식 유지하되 명백한 placeholder 로(`0000…0000` + 주석 "MUST regenerate: openssl rand -hex 32"). 2. 부팅 시 알려진 예시값과 일치하면 prod 거부/dev 경고 — C-1·M-7 가드 블록과 합류.
  - 검증: 예시값 부팅 prod 거부/dev warn unit. / 회귀 위험: 기존 dev/e2e 가 이 구체 hex 에 의존 — 64-hex 경로와 SHA-256 derive 경로(§152-153) 모두 통과하도록 test env 점검. / spec 갱신: secret-store.md 에 "예시는 placeholder, 실값은 운영자 생성" + 거부 가드 기술 (planner).

- [ ] **M-5 refresh token 쿠키 `SameSite=None`** — `auth/utils/refresh-cookie.ts:19`
  - **spec 대조**: B — `1-auth.md §2.1` 은 "HttpOnly Cookie, 7일" 만 정의. 전체 spec 에 `SameSite` 0건 — cross-site 의도·CSRF 보완책이 spec 에 미기록 (정책 공백).
  - **개선 방안**: 1. cross-site 가 불필요한 배포(동일 상위 도메인)면 `Lax`/`Strict` — env 분기(`COOKIE_SAMESITE`). 2. cross-site 필요 시 `/auth/refresh` 에 CSRF 보호(double-submit 또는 custom header). 3. cookie `path` 를 `/api/auth` 로 축소.
  - 검증: 모드별 정상 refresh + cross-site CSRF 거부 e2e. / 회귀 위험: **web-chat 위젯 등 cross-site 임베드가 None 에 의존하면 세션 끊김** — 임베드 시나리오 확인 필수. / **spec 갱신: 필요** — `1-auth.md §2.1/2.3` 에 SameSite 정책·CSRF 보완책 명시 (현재 완전 공백, planner).

- [ ] **M-6 WS `workflow:`·`notifications:` 채널 authorizer 부재 — spec 자체가 갭** — `websocket.gateway.ts:100-150`
  - **spec 대조**: **C** — 코드는 spec 정합: `6-websocket-protocol.md §3.3:141` 이 "`execution:`/`kb:`/`background:run:` 3채널만 소유 검증" 으로 명시 — **spec 자체가 IDOR 갭을 담은 케이스**. `workflow:` 는 emit 경로가 실존(에디터 실행 알림)해 타 workspace workflowId 추측 시 이벤트 수신 가능. `notifications:` 는 emit 미구현(§725 Planned)이라 현재 실피해 0 — 단 emit 도입 시 사용자간 알림 누출 즉시 현실화.
  - **개선 방안**: 1. `channelAuthorizers` 에 `workflow:` authorizer 추가 — workflowId→workspace 소유 검증(`execution:` 동형). 2. `notifications:<userId>` authorizer — JWT sub 일치 검증(user 단위) — **emit 구현 전 선제 차단**. 3. OCP 구조라 배열 항목 추가만으로 격리적.
  - 검증: 타 workspace workflowId / 타 userId 구독 거부 e2e (기존 IDOR 테스트 패턴 재사용). / 회귀 위험: 정상 경로 무영향, 비-UUID workflowId 처리 확인. / **spec 갱신: 필요** — §3.3 검증 채널 목록에 2채널 추가 + notifications 는 user 단위 명시 (planner).

- [ ] **M-7 `MCP_ALLOW_INSECURE_URL=true` 프로덕션 fail-fast 가드 없음 — enforcement 비대칭** — `mcp-client.service.ts:16-27`
  - **spec 대조**: **C** — `11-mcp-client.md:132-137` 이 "운영 환경에서 **절대 활성화해서는 안 된다**" 를 명문화했으나 부팅 강제는 미기술 — spec 의도(절대 금지) ↔ 코드(silent 허용) 괴리. OAUTH/LLM stub·EIA 토큰은 fail-closed throw 가 있는 것과 비대칭.
  - **개선 방안**: 1. `main.ts` 가드에 `production && MCP_ALLOW_INSECURE_URL=true → throw` 추가 — C-1·M-4 와 단일 가드 블록. 2. **`ALLOW_PRIVATE_HOST_TARGETS` 는 분리 처리**: self-host 정당 용도(spec §104)가 있어 throw 가 아닌 **warn** 이 적절 — 정책 구분.
  - 검증: prod+플래그 부팅 거부 unit, dev 통과. / 회귀 위험: prod 에서 (잘못) 켜둔 기존 배포 부팅 실패 — 릴리스 노트 경고. / spec 갱신: §132 에 "production fail-closed (stub 동형)" + ALLOW_PRIVATE_HOST_TARGETS 는 warn 정책 구분 기술 (planner).

## Minor

- [ ] **m-1 web-chat HTML sanitize — `ALLOWED_TAGS` 화이트리스트 미적용** — `channel-web-chat/src/lib/safe-html.ts:64-70`
  - **spec 대조**: D — `7-channel-web-chat/4-security.md:34` 는 "XSS 방지 sanitize + rel=noopener" **결과만** 요구 (방식 미규정) — 현 블랙리스트도 spec 충족, 화이트리스트는 추가 하드닝. rel=noopener 는 hook 으로 이미 충족.
  - **개선 방안**: 1. `ALLOWED_TAGS`/`ALLOWED_ATTR` 화이트리스트 전환(채팅 렌더 필요 태그만). 2. `ALLOWED_URI_REGEXP` 로 href scheme 제한(http(s)/mailto — javascript: 이중 방어).
  - 검증: 화이트리스트 외 태그(svg/math) 제거 + 정상 마크다운 렌더 유지 회귀. / 회귀 위험: 실사용 태그 누락 시 렌더 깨짐 — 사용 태그 audit 후 목록 확정. / spec 갱신: 선택("화이트리스트 권장" 1줄).

- [ ] **m-2 비프로덕션 `NODE_ENV` 에서 error.stack 응답 노출** ⚠️ **(A — spec 명시 정책, 위험 낮음)** — `code.handler.ts:309-321`
  - **spec 대조**: **A** — `2-code.md §5.3` 표가 "`NODE_ENV !== 'production'` 일 때만 노출" 을 명문화 — 코드 정합. 잔여 갭은 spec 의 prod/non-prod 이분법이 staging 을 다루지 않는 운영 가이드 공백.
  - **개선 방안**: 1. (저비용) "staging 은 NODE_ENV=production 으로 운영" 가이드 명시. 2. (근본) `DEBUG_STACK_TRACES` 별도 플래그로 환경명과 디커플.
  - 검증: 플래그 도입 시 prod 기본 생략 + on 시 노출 unit. / 회귀 위험: 낮음. / spec 갱신: §5.3 에 staging 권고 또는 플래그 정책 (planner, error-handling §6 과 정합).

- [ ] **m-3 `trust proxy 1` — Cloudflare 전제의 정기 검증 부재** ⚠️ **(A — 의도·전제 기록됨, 운영 프로세스 갭)** — `main.ts:68-77`
  - **spec 대조**: **A** — CF-Connecting-IP 1순위는 `1-auth.md §2.3`·`1-data-model.md:637` 명시, 코드 주석이 전제(origin 의 CF 외 직접 접근 차단)를 기록. 코드/spec 결함이 아닌 **운영 프로세스 갭**.
  - **개선 방안**: 1. (운영) Cloudflare Authenticated Origin Pulls(mTLS) 또는 origin 방화벽 CF IP allowlist 강제. 2. (절차) 분기별 점검 체크리스트(AOP 인증서·WAF·CF IP 대역 갱신) 인프라 문서화.
  - 검증: CF 우회 직접 요청 거부 침투 점검. / 회귀 위험: 없음(인프라). / spec 갱신: 불요 — 배포 가이드 영역.

- [ ] **m-4 database-query 노드 Pool 캐시 — credential rotation 전파 지연** ✅ **승인(2026-06-10) — 권고안(근본: pub/sub 전파)대로 진행 확정** — `database-query.handler.ts:345-376`
  - **spec 대조**: **A** — `2-database-query.md:77` "credential 회전 시 stale 풀 evict 후 새 풀 생성" — 단일 프로세스 동작은 spec 정합. **멀티 인스턴스 캐시 무효화 조율은 spec 미언급** — 침해 대응(MTTR) 맥락에서 회전된 자격증명의 idle 연결이 타 인스턴스에 잔존.
  - **개선 방안**: 1. (근본) integration 업데이트 이벤트 pub/sub(Redis) 전파 → 전 인스턴스 해당 integrationId 풀 즉시 evict. 2. (단기) `POOL_IDLE_TIMEOUT_MS`(현 30s) 를 대응 SLA 에 맞게 하향 검토(연결 churn 트레이드오프).
  - 검증: 인스턴스 A 회전 → B 풀 N초 내 무효화 통합 테스트. / 회귀 위험: pub/sub 미수신 시 기존 credsHash evict 로 안전 degrade. / spec 갱신: §2 에 멀티 인스턴스 무효화 + Rationale(MTTR 트레이드오프) 추가 (planner).
