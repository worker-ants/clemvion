# 요구사항(Requirement) Review — prod-fail-closed-guards

## 발견사항

### [WARNING] `auth.module.ts` 의 dead `?? 'fallback'` 코드가 이 PR 에서 제거되지 않음

- 위치: `codebase/backend/src/modules/auth/auth.module.ts` line 35
- 상세: `plan/complete/security-jwt-secret-fallback.md` 의 SUPERSEDED 노트는 "JWT_SECRET production 부팅 거부" 를 구현했다고 선언하나, 해당 plan 의 to-do 첫 항목 — `auth.module.ts 의 dead ?? 'fallback' 제거` — 은 이 PR 에서 수행되지 않았다. 현재 `auth.module.ts:35` 에는 `secret: configService.get<string>('jwt.secret') ?? 'fallback'` 이 남아 있다. 기능 보안상 문제는 없다(`jwt.config.ts` 의 `|| 'dev-jwt-secret'` 이 항상 non-null 을 반환하므로 `'fallback'` 은 도달 불가). 그러나 SUPERSEDED 노트가 plan 의 해당 체크리스트 항목 처리를 묵시적으로 포함하는 것처럼 읽힐 수 있어, 코드 리뷰어나 미래 독자가 이미 완료됐다고 오해할 수 있다.
- 제안: SUPERSEDED 노트에 "dead code 제거(`?? 'fallback'`)는 미완료(도달 불가이므로 보안 영향 없음) — 별도 cleanup PR 로 정리 가능"을 명시하거나, 이 PR 에서 dead code 제거까지 처리한다.

---

### [WARNING] `JWT_SECRET` 최소 길이 미검증 — `.env.example` 요구사항(`>= 32 bytes`)과 가드 구현 간 괴리

- 위치: `codebase/backend/src/common/config/production-guards.ts` lines 76–82, `.env.example` line 87
- 상세: `.env.example` 주석은 "Production MUST override this with a long random value (>= 32 bytes)" 를 명시한다. 그러나 `assertProductionConfig` 의 JWT_SECRET 검증은 empty/unset 차단 및 known-insecure blocklist(`INSECURE_JWT_SECRETS` Set) 만 수행하고, 최소 길이(`>= 32 bytes`)를 강제하지 않는다. 예: `JWT_SECRET=abc` 처럼 짧은 값을 설정해도 production 부팅이 통과된다. blocklist 방식은 "알려진 예시 키" 만 막고, 짧은 임의 키(예: 16자)는 통과한다. 이는 CWE-521(Weak Password Requirements) 범주의 약점이다.
- 제안: `jwtSecret.length < 32` 를 추가 검사하거나 (32 bytes = 32 ASCII chars / 64 hex chars 기준으로 문서 정렬), 최소한 `spec/5-system/1-auth.md` 의 production fail-closed 노트에 "길이 검증 미수행 — blocklist 방식만 적용" 을 명시해 의도적 결정임을 기록한다.

---

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` warn 체크가 `isFlagOn` 헬퍼 대신 raw `=== 'true'` 리터럴 비교

- 위치: `codebase/backend/src/main.ts` line 54
- 상세: `assertProductionConfig` 는 boolean 토글 판정에 `isFlagOn(value)` (= `'true' || '1'`) 를 일관 사용하나, `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 검사는 `process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'` 로 직접 비교한다. `http-safety.ts` 의 실제 토글 읽기도 `=== 'true'` 만 사용해 `'1'` 을 인식하지 않는다. 따라서 `ALLOW_PRIVATE_HOST_TARGETS=1` 을 설정한 배포에서 main.ts 경고가 출력되지 않지만, 기능 자체(`http-safety.ts`)도 `'1'` 을 인식하지 않으므로 실제 보안 갭은 없다. 그러나 `isFlagOn` 이 `'1'` 을 ON 으로 보는 것과 비일관적이다.
- 제안: `ALLOW_PRIVATE_HOST_TARGETS` 의 warn 체크와 `http-safety.ts` 의 기능 토글 읽기도 `isFlagOn` 으로 통일하는 것이 향후 정비 시 권장. 단 `http-safety.ts` 변경은 이 PR 범위 밖이므로 INFO 로 분류.

---

### [INFO] `production-guards.ts` 에 `CORS`·`WEBAUTHN_ALLOW_FALLBACK` 등 기타 production 가드가 포함되지 않음 — 모듈 경계 미완성

- 위치: `codebase/backend/src/common/utils/cors-origins.ts` (`assertCorsOriginsConfigured`)
- 상세: production fail-closed 정책을 단일 `assertProductionConfig` 에 응집한다는 설계 의도(module doc 설명)와 달리, `assertCorsOriginsConfigured` (CORS wildcared → throw in production) 는 `cors-origins.ts` 에 별도로 남아 있다. `interaction-token.service.ts` 의 `INTERACTION_JWT_SECRET` 가드 역시 생성자 throw 로 분리돼 있다. 현재 코드 주석이 이 분리를 명시하고 있어 의도적임이 명확하나, 미래 기여자가 "새 fail-closed 가드를 어디 둘지" 판단할 때 혼선이 생길 수 있다.
- 제안: `production-guards.ts` 의 module doc 에 "CORS, WebAuthn, INTERACTION_JWT_SECRET 은 의도적으로 각 모듈에 남겨둠" 과 이유를 명시하는 한 줄을 추가하면 충분.

---

### [INFO] `spec/5-system/1-auth.md` 의 fail-closed 노트가 `ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL` 까지 언급

- 위치: `spec/5-system/1-auth.md` lines 247–254
- 상세: 해당 노트는 `auth.md` 에 위치하지만 `assertProductionConfig` 가 `ENCRYPTION_KEY`(M-4), `MCP_ALLOW_INSECURE_URL`(M-7), OAUTH/LLM stub 를 통합 처리한다는 설명이 포함돼 있다. auth spec 독자 관점에서는 JWT_SECRET 관련 내용만 있어야 자연스럽다. 다른 가드들에 대한 언급은 cross-reference 목적이라면 괜찮으나, 문서가 다소 장황해졌다.
- 제안: 현재 수준으로도 이해 가능하므로 blocking 아님. 향후 정제 시 고려.

---

## 요약

변경의 핵심 기능(production 부팅 시 비보안 stub/미설정 secret/위험 플래그 차단)은 완전히 구현됐다. `assertProductionConfig` 는 순수 함수로 분리돼 단위 테스트로 전 분기를 검증하고, `main.ts` 는 이를 bootstrap 최초 단계에서 호출한다. `.env.example` 의 placeholder 변경(all-zero 키로 교체 + 경고 문구 추가), spec 문서 4건(auth, mcp-client, external-interaction-api, secret-store) 동기화도 적절히 수행됐다. 다만 두 가지 WARNING 이 존재한다: (1) 이 PR 의 기반이 된 plan 의 dead code 제거 체크리스트 항목(`auth.module.ts ?? 'fallback'`)이 SUPERSEDED 로 처리됐으나 실제 코드에 남아 있어 완료 여부가 불명확하고, (2) `.env.example` 이 명시하는 JWT_SECRET 최소 길이(`>= 32 bytes`)가 production 가드에서 검증되지 않아 짧은 임의 키가 통과 가능하다. 두 항목 모두 현재 배포를 즉시 차단할 보안 사고는 아니지만, 방어 깊이를 높이거나 의사결정을 명문화하는 개선이 권장된다.

## 위험도

MEDIUM
