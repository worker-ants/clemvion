# 테스트(Testing) 리뷰 결과

리뷰 대상: `prod-fail-closed-guards` 브랜치 — production fail-closed 가드 응집 (refactor 04 C-1·M-4·M-7)

---

## 발견사항

### **[INFO]** `assertProductionConfig` 단위 테스트 — fail-fast 순서 계약은 있으나 ENCRYPTION_KEY 의 "충분히 긴 값 통과" 대칭 케이스 누락

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts`
- **상세**: `JWT_SECRET` 섹션에는 "passes for a sufficiently long random secret" 테스트가 있어 최소 길이 이상의 올바른 값이 통과함을 검증한다. `ENCRYPTION_KEY` 섹션에는 동일한 "passes for a valid ENCRYPTION_KEY value" 긍정 케이스가 없다. `VALID_ENC` 상수가 `prodEnv()` 기본값으로 쓰여 간접 검증은 되지만, `ENCRYPTION_KEY` 독립 describe 블록 내에 "유효한 64-char hex는 통과한다" 명시 케이스가 없으면 블록 내 커버리지 의도가 불명확하다.
- **제안**: `describe('ENCRYPTION_KEY (04 M-4)')` 안에 `it('passes for a valid non-example key', ...)` 케이스를 추가한다.

---

### **[INFO]** `isFlagOn` 함수에 대한 독립 단위 테스트 부재

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts`
- **상세**: `isFlagOn`은 `export`된 순수 함수이고, 설계 결정("정확히 `'true'`·`'1'` 만 ON, `'TRUE'`·`'yes'`·`'on'` 등은 OFF")이 코드 주석에 명시되어 있으며 `main.ts`의 warn 분기도 동일 규칙을 사용한다고 명시한다. `MCP_ALLOW_INSECURE_URL` 케이스에서 간접 검증은 되나 `isFlagOn` 자체에 대한 `describe('isFlagOn')` 블록이 없어, 향후 다른 플래그가 이 함수를 재사용할 때 계약 검증이 분산된다.
- **제안**: `describe('isFlagOn', ...)` 독립 블록에서 `undefined`, `''`, `'true'`, `'1'`, `'TRUE'`, `'yes'`, `'false'`, `'0'` 입력값을 표 기반(`it.each`)으로 검증하면 계약이 단일 장소에 고정된다.

---

### **[INFO]** `INSECURE_JWT_SECRETS`·`KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set의 "동기화 의무" — 테스트 미커버

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.ts` 라인 28–48
- **상세**: 파일 주석에 "동기화 의무: `jwt.config.ts`의 dev fallback이나 `.env.example`의 placeholder를 바꾸면 이 Set에 추가해야 한다"고 명시한다. 그러나 이 의무가 자동으로 검증되지 않는다 — `jwt.config.ts`가 반환하는 dev fallback 값이 `INSECURE_JWT_SECRETS`에 포함돼 있는지 확인하는 테스트가 없고, `.env.example`의 실제 `ENCRYPTION_KEY` 값이 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`에 포함돼 있는지 자동으로 검증하는 테스트가 없다. 미래에 어느 한 쪽이 변경될 때 동기화 누락이 CI에서 잡히지 않는다.
- **제안**: `production-guards.spec.ts`에 `it('INSECURE_JWT_SECRETS includes jwt.config.ts dev fallback', ...)` 형태로 `jwt.config.ts`에서 dev fallback 값을 import해 Set 포함 여부를 단언하고, 가능하다면 `.env.example`의 `ENCRYPTION_KEY` 행을 파싱해 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 포함 여부를 단언하는 케이스를 추가한다. 이 테스트는 "의무 문서"를 코드로 선언하는 회귀 방어선 역할을 한다.

---

### **[INFO]** `auth.module.ts` — `?? 'fallback'` 제거 후 회귀 테스트 부재

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/modules/auth/auth.module.ts`
- **상세**: `?? 'fallback'` 죽은 코드를 제거하고 `configService.getOrThrow`로 교체했다. 변경 자체는 올바르나, `jwt.secret`가 ConfigService에 없을 경우 `getOrThrow`가 throw하는 경로를 커버하는 `auth.module.ts` 단위 테스트가 기존에도 없고 이번 변경에도 추가되지 않았다. 이 경로는 `assertProductionConfig`가 먼저 잡아주므로 실제 운영에서는 도달 불가하지만, 모듈 단독 테스트 시 `ConfigService`를 mock할 때 해당 키가 없으면 예상치 못한 throw가 발생할 수 있다.
- **제안**: `auth.module` 테스트(있다면) 또는 통합 테스트에서 `configService`를 mock할 때 `jwt.secret`를 반드시 제공하도록 업데이트 확인이 필요하다. 블로킹 사안은 아니나 기존 테스트 mock이 `getOrThrow` 기반으로 업데이트됐는지 확인 권장.

---

### **[INFO]** `main.ts` — `ALLOW_PRIVATE_HOST_TARGETS` warn 분기에 대한 테스트 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/main.ts`
- **상세**: `assertProductionConfig`와 달리 `main.ts`의 `ALLOW_PRIVATE_HOST_TARGETS` warn 분기는 테스트 대상 외에 있다. `production-guards.spec.ts`에는 "does NOT throw for ALLOW_PRIVATE_HOST_TARGETS=true (warn-only policy, handled in main.ts)" 테스트가 있어 `assertProductionConfig`에서는 throw하지 않음을 검증하나, `main.ts`의 warn 로깅 자체를 검증하는 테스트는 없다. `main.ts` 통합이 어렵다면 적어도 `isFlagOn(process.env.ALLOW_PRIVATE_HOST_TARGETS)` 조건 분기가 별도 함수로 추출되거나, `main.ts` 부트스트랩 로직에 대한 e2e/통합 테스트가 있어야 warn이 발생하는지 확인 가능하다.
- **제안**: warn 로직을 별도 함수로 추출하거나, `production-guards.spec.ts`에 `warn 정책 계약을 문서화하는 주석 테스트`를 추가하는 것이 가독성에 유리하다. 단, warn 자체를 검증하는 e2e 없이는 선택적 개선.

---

### **[INFO]** `database-query.handler.spec.ts` — `void` 추가로 lint 경고 해소 (회귀 영향 없음)

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` 라인 148
- **상세**: `registered?.('int-1')` → `void registered?.('int-1')` 변경은 `@typescript-eslint/no-floating-promises` 또는 유사 lint 규칙 경고 해소를 위한 수정이다. 테스트 의도(등록된 핸들러 호출 시 `invalidateSpy`가 실행되는지)는 유지되며 회귀 위험 없다. `void` 처리 후에도 `expect(invalidateSpy).toHaveBeenCalledWith('int-1')` 단언이 다음 줄에 있어 검증은 유효하다.
- **제안**: 없음. 적절한 수정이다.

---

## 요약

이번 변경의 핵심인 `production-guards.ts` + `production-guards.spec.ts`는 순수 함수 분리 + 환경변수 주입 구조를 채택해 테스트 용이성이 높다. 단위 테스트 커버리지는 대부분의 핵심 경로(비-production no-op, 각 플래그·secret 유효·무효 케이스, fail-fast 순서 계약, 비표준 truthy 값 OFF 처리)를 잘 커버한다. 부족한 부분은 세 가지다: (1) `ENCRYPTION_KEY`의 유효 값 통과 케이스가 독립 describe 블록 내에 없고, (2) `isFlagOn`이 `main.ts`에서도 재사용되나 독립 테스트 블록이 없으며, (3) 코드 주석에 명시된 "동기화 의무"(Set와 `jwt.config.ts`·`.env.example`의 실제 값 동기화)가 테스트로 고정되지 않아 향후 변경 시 CI 회귀 탐지가 불가하다. `auth.module.ts`의 `getOrThrow` 교체와 `main.ts`의 warn 분기도 테스트 커버가 없으나 기존 패턴과 일관성이 있어 INFO 수준이다. 전체적으로 주요 보안 불변량(production 부팅 차단)에 대한 테스트가 잘 작성되어 있으며 위험도는 낮다.

## 위험도

LOW

STATUS: OK
