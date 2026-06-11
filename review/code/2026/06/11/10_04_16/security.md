# Security Review

## 발견사항

### **[INFO]** ENCRYPTION_KEY placeholder 교체 — 개선됨
- 위치: `codebase/backend/.env.example` line 40
- 상세: 기존 `0123456789abcdef...` 예시 키를 `000...0` (all-zero) 으로 교체하고 regenerate 지침을 명문화했다. 더 중요한 것은 `production-guards.ts` 의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에 두 값을 모두 등록해 production 에서 부팅을 거부하게 된 점이다. 기존 예시 키(`0123456789...`) 를 그대로 쓰고 있는 운영 배포도 차단된다.
- 제안: 조치 완료. 추가 개선 불필요.

### **[INFO]** `assertProductionConfig` — production fail-closed 가드 신규 도입
- 위치: `codebase/backend/src/common/config/production-guards.ts`
- 상세: `NODE_ENV=production` 에서 (1) `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 활성, (2) `JWT_SECRET` 미설정/sentinel, (3) `ENCRYPTION_KEY` 미설정/예시값, (4) `MCP_ALLOW_INSECURE_URL` 활성을 한 곳에서 일괄 차단한다. 순수 함수로 분리되어 단위 테스트로 전 분기가 검증된다.
- 제안: 설계 양호.

### **[WARNING]** `jwt.config.ts` 에 dev fallback 이 남아 있음 — 완화되었으나 완전 제거 미수행
- 위치: `plan/complete/security-jwt-secret-fallback.md` + production-guards.ts 주석
- 상세: `src/common/config/jwt.config.ts` 에서 `process.env.JWT_SECRET || 'dev-jwt-secret'` 형태의 dev fallback 이 여전히 남아 있다. production-guards 가 sentinel `'dev-jwt-secret'` 을 차단하므로 production 노출은 막혔다. 그러나 `dev/test` 환경에서 `JWT_SECRET` 미설정 시 공개된 기본값으로 토큰이 서명되는 구조는 유지된다. 내부 개발 환경 compromise 또는 `NODE_ENV` 설정 오류가 있을 경우 예측 가능한 서명 키가 그대로 쓰인다.
- 제안: plan/complete 문서에서 "정제 결정으로 fallback 제거하지 않았다" 고 기록되어 있으나, 장기적으로는 `jwt.config.ts` 의 fallback 을 제거하고 dev/test 에서도 `JWT_SECRET` 을 명시적으로 주입하는 것이 더 안전하다. 현재 상태에서는 production 가드가 실질 방어선이 되므로 즉각 차단 수준은 아니다.

### **[WARNING]** `ALLOW_PRIVATE_HOST_TARGETS=true` — warn-only, throw 아님
- 위치: `codebase/backend/src/main.ts` lines 911-918
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 는 HTTP Request 노드가 RFC 1918 / loopback / cloud metadata 등 사설 호스트에 outbound 요청을 보낼 수 있게 하는 SSRF 표면 확장 플래그다. `MCP_ALLOW_INSECURE_URL` 과 달리 production 에서 throw 하지 않고 경고 로그만 남긴다. 정당한 self-host 용도(VPC 내부 DB/SMTP)를 이유로 warn 정책을 유지한다는 설계 결정은 spec 에 명시되어 있다. 다만, cloud metadata endpoint(`169.254.169.254` 등)에 대한 워크스페이스 admin 의 임의 접근은 외부 이그레스 방화벽이 없으면 여전히 가능하다. 이 사실이 `.env.example` 주석에 명확히 기재되어 있어 인식은 되고 있다.
- 제안: 현재 정책 자체는 의도적 설계이나, cloud metadata IP 대역만큼은 `ALLOW_PRIVATE_HOST_TARGETS=true` 상태에서도 별도로 차단하는 추가 레이어를 고려할 수 있다. cloud metadata 접근 허용 이득(self-host VPC)이 거의 없기 때문이다.

### **[INFO]** `MCP_ALLOW_INSECURE_URL` — production throw 적용됨
- 위치: `production-guards.ts` + `spec/5-system/11-mcp-client.md`
- 상세: "절대 금지" 플래그를 실제 부팅 거부로 enforcement 한다. spec 에 정책 근거도 명시되어 있다.
- 제안: 조치 완료.

### **[INFO]** `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 가드 — 기존 main.ts 인라인 → assertProductionConfig 통합
- 위치: `codebase/backend/src/main.ts` diff
- 상세: 기존 개별 throw 블록을 `assertProductionConfig` 로 응집했다. 동작은 동등하며 테스트 커버리지가 추가되었다.
- 제안: 조치 완료.

### **[INFO]** `INSECURE_JWT_SECRETS` set 범위 — 현재 2개 sentinel
- 위치: `production-guards.ts` lines 630-632
- 상세: `'dev-jwt-secret'` 과 `'change-me-to-a-long-random-jwt-secret'` 두 값만 차단한다. 향후 .env.example 의 JWT_SECRET placeholder 가 추가·변경될 경우 이 set 을 동기화해야 한다. 현재 값의 커버리지는 충분하다.
- 제안: .env.example 의 JWT_SECRET placeholder 변경 시 set 동기화를 PR checklist 에 포함하면 좋다.

### **[INFO]** 에러 메시지 내 민감 정보 노출 없음
- 위치: `production-guards.ts` fail 메시지 전체
- 상세: 에러 메시지는 환경변수 이름과 지침만 포함하며 실제 비밀값을 로그에 포함하지 않는다.
- 제안: 이상 없음.

### **[INFO]** 테스트 파일 내 VALID_ENC 값
- 위치: `production-guards.spec.ts` line 503
- 상세: `VALID_ENC = 'fedcba9876543210...'` 는 테스트 전용 값이며 실제 배포에 쓰이지 않는다. 테스트 파일에 예시 키가 존재하는 것은 문제 없다.
- 제안: 이상 없음.

---

## 요약

이번 변경은 기존에 분산되어 있던 production 부팅 가드를 `production-guards.ts` 단일 모듈로 응집하고, JWT_SECRET 기본값 사용과 ENCRYPTION_KEY 공개 예시값 사용, MCP SSRF 방어 우회를 production 에서 명시적으로 차단하는 보안 강화 PR이다. 핵심 위협(공개된 예시 키로 운영, dev sentinel 로 JWT 서명)을 부팅 단계에서 fail-closed 로 막는 방어 계층이 올바르게 구현되었고 단위 테스트로 전 분기가 검증된다. 지적할 잔존 위험은 (1) `jwt.config.ts` 의 dev fallback 이 완전 제거되지 않아 dev/test 에서 여전히 예측 가능한 기본 키가 사용된다는 점, (2) `ALLOW_PRIVATE_HOST_TARGETS=true` 가 production 에서 throw 없이 warn 만 남겨 cloud metadata endpoint 접근 차단이 외부 방화벽에 의존한다는 점이나, 두 가지 모두 spec 및 plan 문서에 근거 있는 의도적 설계 결정이며 즉각적 취약점 수준은 아니다.

---

## 위험도

LOW
