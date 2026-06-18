# Testing Review — ai-turn-orchestrator.service.spec.ts

## 발견사항

### **[INFO]** 기존 테스트에 누락된 `code` 어서션 사후 보강
- 위치: 파일 L416 — `'details 필드를 포함한 오류를 처리한다'` 케이스 상단에 `expect(result.code).toBe('LLM_API_ERROR')` 추가
- 상세: 기존 케이스가 `details` shape 만 검증하고 `code` 자체를 assert 하지 않았다. 변경 diff 가 이 누락을 사후 보강했다. 보강 자체는 올바른 행동이나 보강 이유가 별도 commit 이 아닌 같은 diff 에 묶인 점은 리뷰어 입장에서 변경 범위를 읽기 어렵게 만든다.
- 제안: 기능/어서션 추가가 동일 commit 에 혼재하면 bisect 시 원인 추적이 어려우므로, 향후에는 누락 어서션 보강과 신규 케이스 추가를 분리하는 것을 권장한다. 현재 코드는 로직상 문제 없음.

### **[INFO]** `LLM_API_ERROR` 가 명시적 등록 코드가 아닌 점 — 테스트 설명 정확성
- 위치: L408 (`code: 'LLM_API_ERROR'`), L418 주석 ("RETRYABLE_CODES 에 없어")
- 상세: 구현 소스(`ai-turn-orchestrator.service.ts`)에 `LLM_API_ERROR` 라는 상수·열거 항목이 존재하지 않는다. 테스트가 "미등록 explicit code passthrough" 를 검증한다는 주석과 일치하지만, 테스트 이름(`'details 필드를 포함한 오류를 처리한다'`)은 passthrough 의미를 드러내지 않아 의도 파악이 어렵다. 반면 신규 추가된 케이스(`'미등록 explicit code 는 정규화 시 그대로 passthrough …'`)는 이름이 의도를 잘 표현한다.
- 제안: 기존 케이스 이름을 `'LLM_API_ERROR — 미등록 explicit code 는 passthrough + retryable=false'` 수준으로 rename 하면 두 케이스가 같은 동작 분기를 검증함이 명확해진다. 현재 기능 오류 없음.

### **[INFO]** `details.status=429` 가 `extractHttpStatus` 에 의해 읽히지 않는다는 주석의 정확성 확인
- 위치: L479–481 주석
- 상세: `extractHttpStatus` 는 `err.status`, `err.statusCode`, `err.response.status` 를 읽는다. `err.details.status` 는 읽지 않으므로 주석("details.status=429 는 extractHttpStatus 가 읽지 않으므로 LLM_RATE_LIMIT 으로 승격되지 않는다")은 구현과 일치한다. 주석 자체는 정확하다.
- 제안: 없음.

### **[INFO]** `LLM_PROVIDER_QUOTA` 신규 케이스 — 메시지 내용 검증 누락
- 위치: L492–502 (신규 추가 케이스)
- 상세: 신규 케이스는 `result.code` 와 `result.details.retryable` 만 검증한다. `result.message` 어서션이 없다. `'vendor quota exhausted'` 메시지가 `sanitizeLastErrorMessage` 를 거친 후 원형 그대로 전달되는지 확인하는 어서션이 있으면 sanitize 경로 회귀도 동시에 방어한다.
- 제안: `expect(result.message).toContain('vendor quota exhausted')` 추가 권장. 필수는 아니나 커버리지를 보완한다.

### **[INFO]** `LLM_PROVIDER_QUOTA` 케이스 — `details` 전체 shape 비확인
- 위치: L435 `expect((result.details as Record<string, unknown>).retryable).toBe(false)`
- 상세: 기존 `LLM_API_ERROR` 케이스(`L485–489`)는 `expect(result.details).toEqual({retryAfter: 60, status: 429, retryable: false})` 로 전체 shape 을 검증한다. 신규 케이스는 `retryable` 필드만 검증하고, `details` 내 불필요한 키가 추가되더라도 감지하지 못한다. 단, 이 케이스의 `err` 에는 `details` 프로퍼티가 없으므로 `mergedDetails` 는 `{ retryable: false }` 만 가질 것이며 실제 위험은 낮다.
- 제안: `expect(result.details).toEqual({ retryable: false })` 로 전체 shape 을 검증하면 구현 변경 시 의도치 않은 필드 추가를 잡아낼 수 있다.

### **[INFO]** `classifyLlmError` 의 `is429` 분기 — `lowerMsg.includes('rate limit')` 과의 우선순위
- 위치: 구현 L1055–1057, 테스트 전반
- 상세: `LLM_PROVIDER_QUOTA` 같은 임의 코드를 가진 에러의 메시지(`'vendor quota exhausted'`)가 `is429` 패턴(`'429'`, `'rate limit'`)에 걸리지 않는지는 신규 테스트가 암묵적으로 검증한다. 그러나 `'quota'` 키워드가 `is429` 분기로 오분류될 수 있는지에 대한 명시적 테스트가 없다. 현재 구현은 `quota` 키워드를 처리하지 않으므로 문제없지만, 추후 패턴 변경 시 회귀 위험.
- 제안: 필요 시 `'vendor quota'` 메시지가 `LLM_RATE_LIMIT` 이 아닌 passthrough 로 처리됨을 이름에 명시적으로 드러내는 테스트로 보강 가능. 현재 우선순위는 낮음.

---

## 요약

이번 diff 의 변경 범위는 좁다 — 기존 테스트 케이스에 누락된 `expect(result.code).toBe('LLM_API_ERROR')` 어서션을 추가하고, 미등록 explicit code(`LLM_PROVIDER_QUOTA`)가 `classifyLlmError` 의 passthrough 분기로 그대로 보존됨을 검증하는 신규 케이스를 추가하는 것이다. 신규 케이스는 테스트 격리·설명 명확성·spec 참조 모두 양호하며 `beforeEach/afterEach` 구조가 사이드이펙트 누출을 방지한다. 발견된 사항은 모두 INFO 수준이며 — 신규 케이스의 `message` 및 `details` 전체 shape 검증 누락이 커버리지를 소폭 넓힐 여지가 있고, 기존 케이스 이름이 의도를 충분히 표현하지 않는 가독성 이슈가 있다 — 기능 오류나 회귀 위험은 없다. `classifyLlmError` 의 핵심 분기(429, auth, 5xx, network, passthrough, fallback)는 기존+신규 테스트의 조합으로 충분히 커버된다.

## 위험도

LOW
