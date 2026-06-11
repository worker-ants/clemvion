# 보안(Security) 리뷰

리뷰 대상: `spec/conventions/secret-store.md` 변경 + 연관 구현체
(`codebase/backend/src/common/config/production-guards.ts`,
`codebase/backend/src/main.ts`,
`codebase/backend/src/modules/secret-store/secret-crypto.ts`,
`codebase/backend/src/modules/secret-store/secret-resolver.service.ts`,
`codebase/backend/.env.example`)

---

## 발견사항

### 인젝션 취약점

- **[INFO]** `deleteByPrefix` LIKE 쿼리 — SQL 인젝션 위험 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 라인 152
  - 상세: `.where('ref LIKE :prefix', { prefix: ... })` TypeORM 파라미터 바인딩 사용 — SQL 인젝션 불가. 단 LIKE 메타문자(`%`, `_`)를 포함한 prefix 를 그대로 전달하면 의도치 않은 패턴 매칭이 가능. 현재 prefix 는 내부 서비스가 `secret://triggers/<uuid>/` 형식으로 합성하므로 외부 입력 직접 노출은 없다.
  - 제안: 방어적 조치로 prefix 내 LIKE 메타문자(`%`, `_`, `\`)를 이스케이프하거나, prefix 값이 정형화된 URI 경로 형식인지 정규식으로 추가 검증.

### 하드코딩된 시크릿

- **[INFO]** `KNOWN_EXAMPLE_ENCRYPTION_KEYS` — 의도적 블랙리스트 등재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 42–47
  - 상세: 코드에 예시 키 두 개(`000…`, `0123…abcdef`)가 상수로 포함되어 있으나, 이는 "해당 값을 production 에서 거부"하기 위한 블랙리스트 목적이며 실 키가 아니다. 의도적이고 올바른 설계.
  - 제안: 향후 예시 placeholder 를 교체할 때 옛 값을 제거하지 말고 새 값을 추가하는 동기화 의무가 코드 주석에 명기되어 있으나, CI 자동화 없이 수동 의존한다. `.env.example` 의 `ENCRYPTION_KEY` 값이 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에 포함됐는지 검증하는 단위 테스트 1건 추가를 고려.

- **[INFO]** `INSECURE_JWT_SECRETS` — 동일한 블랙리스트 패턴
  - 위치: 라인 31–34
  - 상세: `dev-jwt-secret` / `change-me-to-a-long-random-jwt-secret` 두 값이 상수 포함. 블랙리스트 목적으로 허용 범위 내.
  - 제안: 없음.

### 인증/인가

- **[INFO]** JWT_SECRET 미설정·예시값·짧은 값 차단 — 인증 우회 방어 강화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 87–99
  - 상세: production 에서 `JWT_SECRET` 미설정, 블랙리스트 값, 32바이트 미만이면 부팅 거부. CWE-521 대응. 적절함.
  - 제안: 없음.

- **[WARNING]** `INTERACTION_JWT_SECRET` 는 본 가드 블록 외 처리 — 보호 범위 공백
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 22–23 (주석)
  - 상세: `INTERACTION_JWT_SECRET` 의 fail-closed 는 `InteractionTokenService` 생성자에서 별도 처리. 그러나 `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET` fallback 으로 EIA 토큰이 서명되면, JWT_SECRET 이 외부 유출되거나 복붙 사고가 발생했을 때 EIA 토큰도 위조 가능. 현 spec(EIA §8.3)에서 fallback 을 허용하나, production 에서 분리 설정을 강제하지 않는 점이 잠재적 범위 확대 위험.
  - 제안: `assertProductionConfig` 에서 `INTERACTION_JWT_SECRET` 미설정 시 WARNING 로그 출력 또는 `JWT_SECRET` 과 동일 값일 경우 warn 을 추가. 차단이 아닌 경고 수준으로도 운영자 인지 유도 효과 있음.

### 입력 검증

- **[INFO]** `assertRefFormat` — 형식 위반 시 ref 전체 미노출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 라인 56–66
  - 상세: 에러 메시지에 `length` 와 앞 8자(prefix) 만 포함하고 실제 값을 노출하지 않음. SS-SE-05 준수.
  - 제안: 없음.

### OWASP Top 10

- **[INFO]** A05 보안 구성 오류 — production fail-closed 가드 설계 양호
  - 상세: `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` 모두 production 에서 체계적으로 차단됨. OWASP A05(Security Misconfiguration) 의 주요 패턴인 "기본값/예시값 그대로 운영 배포"를 코드 레벨에서 차단하는 적절한 설계.

- **[WARNING]** `ENCRYPTION_KEY` 형식/길이 검증 미비 — production 가드 범위 공백
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 104–110
  - 상세: `assertProductionConfig` 는 ENCRYPTION_KEY 가 블랙리스트에 없고 비어 있지 않으면 통과시킨다. 64-char hex 가 아닌 경우 `parseMasterKey` 에서 SHA-256 derive 로 32바이트 키를 생성하므로 암호학적 출력 강도는 유지되나, production 에서 `abc` 같은 저엔트로피 단문자열이 통과될 수 있다. JWT_SECRET 은 최소 길이(32) 검증이 있는 반면 ENCRYPTION_KEY 는 동일한 검증이 없어 일관성이 부족하다.
  - 제안: production 에서 ENCRYPTION_KEY 가 정확히 64-char hex 형식(`/^[0-9a-fA-F]{64}$/`)이 아닌 경우 fail 또는 최소 32자 이상 검증을 `assertProductionConfig` 에 추가. JWT_SECRET 검증과 대칭적으로 맞추는 것을 권장.

### 암호화

- **[INFO]** AES-256-GCM + 매 호출 random IV + AAD — 설계 적합
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/secret-store/secret-crypto.ts`
  - 상세: AEAD 알고리즘 선택, 12바이트 random nonce, ref 를 AAD 로 사용한 cross-row 공격 차단, authTag 16바이트 — SS-SE-02/03 준수하며 현대 암호화 표준 부합.
  - 제안: 없음.

- **[INFO]** SHA-256 key derivation fallback — dev/e2e 전용이나 미래 오용 가능성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/secret-store/secret-crypto.ts` 라인 46
  - 상세: 64-char hex 형식이 아닌 임의 문자열 입력 시 SHA-256 단일 해시로 키를 derive. SHA-256 은 PBKDF2/Argon2 같은 KDF 가 아니므로 저엔트로피 입력에 대한 brute-force 저항이 없다. 현재 dev/e2e 목적으로 명시적 허용이나, production 가드에서 형식 강제가 없으면 이 경로가 운영에서도 활성화될 수 있다.
  - 제안: 위 ENCRYPTION_KEY 형식 검증(WARNING 항목)과 연계해 production 가드에서 64-char hex 강제 적용.

### 에러 처리

- **[INFO]** 복호화 실패 시 원인 추상화 — crypto 에러 상세 미노출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/secret-store/secret-resolver.service.ts` 라인 77–85
  - 상세: 원본 crypto 예외를 흡수하고 `'Secret decryption failed'` 로 교체해 내부 상태 미노출. SS-SE-05 준수.
  - 제안: 없음.

- **[INFO]** `NotFoundException` 메시지에 ref 경로 포함
  - 위치: 라인 73
  - 상세: `throw new NotFoundException(\`Secret not found: ${ref}\`)` — ref 에는 UUID 가 포함된 내부 경로(`secret://triggers/<uuid>/bot-token`)가 들어가므로, 상위 exception-filter 에서 message 를 클라이언트에 그대로 전달하면 내부 경로 구조가 노출된다. plaintext 는 아니나 정보 유출(information disclosure) 측면에서 불필요.
  - 제안: controller/exception-filter 레이어에서 `NotFoundException` message 를 클라이언트에 그대로 전달하지 않는지 확인. ref 는 서버 로그에만 기록하고 클라이언트 응답은 제네릭 메시지(`Secret not found`)로 교체를 권장.

### 의존성 보안

- **[INFO]** Node.js 내장 `crypto` 모듈 사용 — 외부 의존성 없음
  - 상세: 외부 암호화 라이브러리 의존 없이 Node.js 내장 crypto 사용. 알려진 취약점이 있는 라이브러리 리스크 없음.

---

## 요약

이번 변경은 `ENCRYPTION_KEY` 의 공개 예시 키 복붙으로 인한 "사실상 평문" 운영 사고를 차단하는 `assertProductionConfig` production fail-closed 가드를 도입하고, spec `secret-store.md` 에 R5 Rationale 로 설계 근거를 문서화한 작업이다. AES-256-GCM + random IV + AAD 기반 암호화 구현, plaintext/crypto 상세 미노출 에러 처리, JWT_SECRET·OAUTH_STUB_MODE 등 다중 보안 플래그를 단일 블록으로 응집한 구조는 보안적으로 올바른 설계이며 OWASP A05 패턴을 코드 레벨에서 효과적으로 차단한다. 두 가지 WARNING 개선 여지가 있다: (1) `assertProductionConfig` 에서 ENCRYPTION_KEY 의 형식/길이 검증 미비 — JWT_SECRET 과의 일관성 부족 및 SHA-256 fallback 경로를 통한 저엔트로피 키 production 적용 가능, (2) `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET` fallback 에 대한 가시화 경고 부재.

---

## 위험도

LOW
