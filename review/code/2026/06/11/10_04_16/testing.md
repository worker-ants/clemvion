# Testing Review — prod-fail-closed-guards

## 발견사항

### **[INFO]** 테스트 커버리지 양호 — 핵심 분기 전체 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/production-guards.spec.ts`
- 상세: `assertProductionConfig` 는 순수 함수로 설계되어 env 맵 주입 방식으로 전 분기를 검증한다. NODE_ENV !== production(early-return), OAUTH_STUB_MODE, LLM_STUB_MODE, JWT_SECRET(미설정/sentinel/예시값), ENCRYPTION_KEY(미설정/알려진 예시키 2종), MCP_ALLOW_INSECURE_URL(true/'1'), ALLOW_PRIVATE_HOST_TARGETS(warn-only)를 모두 커버한다.
- 제안: 현재 수준 유지.

### **[WARNING]** `MCP_ALLOW_INSECURE_URL` — `isFlagOn` 의 negative 케이스가 '0', '2', 'TRUE' 등을 테스트하지 않음
- 위치: `production-guards.spec.ts` L87–96, `production-guards.ts` L34–36
- 상세: `isFlagOn` 은 `'true' | '1'` 만 참으로 인정한다. 테스트는 false 케이스를 `'false'` + unset(undefined)으로만 검증한다. `'0'`, `'TRUE'`, `'yes'`, 또는 공백 문자열 같은 경계값이 `isFlagOn` 에 실제로 통과하지 않음을 확인하는 케이스가 없다. 보안 가드의 특성상 "의도하지 않은 값이 활성화되지 않는다"는 네거티브 테스트가 필요하다.
- 제안: `it.each(['0', 'TRUE', 'yes', ''])('does NOT throw when MCP_ALLOW_INSECURE_URL=%s', ...)` 케이스를 `MCP_ALLOW_INSECURE_URL` 블록에 추가한다. 같은 논리가 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 에도 적용된다.

### **[WARNING]** `ENCRYPTION_KEY` 빈 문자열(`''`) 케이스가 테스트되지 않음
- 위치: `production-guards.spec.ts` ENCRYPTION_KEY describe 블록 (L71–83)
- 상세: `JWT_SECRET` 의 경우에는 `undefined` 케이스가 있으나 `ENCRYPTION_KEY` 는 `undefined`(L72) 와 known-example-key(L77) 두 가지만 테스트한다. `ENCRYPTION_KEY=''` 는 `!encryptionKey` 조건에서 falsy 로 처리되어 throw 되어야 하지만, 이를 명시적으로 검증하는 테스트가 없다. 비어있는 키가 dev 모드에서 암호화를 끄는 escape hatch(.env.example 코멘트 참조)이므로 production에서 반드시 거부됨을 명시해야 한다.
- 제안: ENCRYPTION_KEY 블록에 `it('throws when empty string', () => ...)` 케이스 추가.

### **[INFO]** `JWT_SECRET` 빈 문자열 케이스 누락
- 위치: `production-guards.spec.ts` JWT_SECRET describe 블록 (L56–68)
- 상세: `undefined` 케이스는 있으나 `''` (빈 문자열) 케이스가 없다. `!jwtSecret` 에서 falsy 로 잡히므로 동작은 올바르나 ENCRYPTION_KEY 와 동일한 이유로 명시적 테스트 추가가 권장된다.
- 제안: `it('throws when empty string', () => ...)` 추가.

### **[INFO]** 복수 위반 동시 발생 시 첫 번째 guard에서만 throw — 순서 의존성 명시 필요
- 위치: `production-guards.ts` 전체, `production-guards.spec.ts`
- 상세: `assertProductionConfig` 는 guard를 순차 실행하며 첫 위반에서 throw 한다. `OAUTH_STUB_MODE=true` + `JWT_SECRET=dev-jwt-secret` 을 동시에 설정할 경우 OAUTH_STUB_MODE 위반 메시지만 노출된다. 현재 테스트에서 "복수 위반 시 나머지 위반이 report 되지 않음"을 명시적으로 검증하지 않으며, 운영자가 여러 문제를 순차적으로 하나씩 발견하게 되는 UX 문제가 있다. 이는 기능 결함이 아니나, 테스트가 이 단락 동작을 명시하지 않아 의도인지 누락인지 불분명하다.
- 제안: 주석 또는 테스트 케이스로 "fail-fast (첫 위반에서 throw)" 동작이 의도적임을 명시한다.

### **[INFO]** `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 경로에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/main.ts` L911–918
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 의 warn-only 분기는 `main.ts` 에 인라인으로 남아있다. `production-guards.spec.ts` 에는 "assertProductionConfig 는 이 플래그에 throw 하지 않는다"는 네거티브 검증만 있다. `main.ts` 의 Logger.warn 경로 자체를 단위 테스트가 커버하지 않는다. `main.ts` 는 통합 부팅 함수이므로 단위 테스트하기 어렵지만, 이 warn 로직을 `production-guards.ts` 로 이관해 별도 함수로 분리하면 테스트 가능해진다.
- 제안: 현재는 ACCEPTABLE(main.ts 부팅 함수 특성상). 향후 가드가 추가될 때는 `warnProductionConfig` 류의 별도 함수로 분리해 단위 테스트하는 것을 고려한다.

### **[INFO]** `isFlagOn` 함수 자체의 단위 테스트 없음
- 위치: `production-guards.ts` L34–36
- 상세: `isFlagOn` 은 private 함수이므로 외부에서 직접 테스트할 수 없다. 현재는 `MCP_ALLOW_INSECURE_URL` `it.each(['true','1'])` 테스트가 간접 커버한다. 충분하지만, `isFlagOn` 의 spec이 바뀌면 (예: 'YES' 추가) 이 테스트가 자동 실패하지 않는다.
- 제안: `isFlagOn` 을 export하고 별도 describe로 직접 테스트하거나, 현재의 간접 커버로 수용한다.

---

## 요약

`production-guards.ts` 는 순수 함수 구조로 분리되어 테스트 용이성이 우수하다. 테스트는 모든 주요 가드 분기(OAUTH_STUB_MODE, LLM_STUB_MODE, JWT_SECRET, ENCRYPTION_KEY, MCP_ALLOW_INSECURE_URL, ALLOW_PRIVATE_HOST_TARGETS warn-only 정책)를 커버하며 격리·독립 실행 가능하다. 주요 미비는 두 가지다: (1) `isFlagOn` 의 false 케이스 경계값 검증 누락 — `'TRUE'`, `'yes'`, `'0'` 등 비표준 truthy 값이 실제로 가드를 통과하지 않음을 명시하지 않는다; (2) `ENCRYPTION_KEY=''` 명시 검증 누락 — 빈 문자열이 production에서 거부됨을 테스트가 직접 서술하지 않는다. 이 두 케이스는 실제 동작은 올바르나 테스트가 의도를 문서화하지 않아 향후 리팩터링 시 회귀 위험이 있다.

## 위험도

LOW
