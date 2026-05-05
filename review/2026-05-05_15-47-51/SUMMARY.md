# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — HTTP 헤더 CRLF 인젝션 및 SSRF 미차단이 스키마 레벨에서 방어되지 않으며, `passthrough()` 필드가 실제 HTTP 요청으로 누출될 수 있는 구조적 위험 존재

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **CRLF 헤더 인젝션** — `key`/`value` 필드가 `z.string()`만 사용해 `\r\n` 포함 값이 스키마 단계에서 거부되지 않음. 핸들러가 이 값을 그대로 헤더에 삽입하면 헤더 인젝션 가능 | `http-request.schema.ts` — `keyValueSchema.key`, `.value` | `.refine(v => !/[\r\n]/.test(v))` 를 스키마에 추가하거나, 핸들러에서 CRLF strip 처리 필수 |
| 2 | Security | **SSRF** — `url` 필드가 프로토콜(`file://`, `gopher://`)·사설 IP 대역(`127.x`, `10.x`, `169.254.x`) 차단 없이 `z.string().optional()` 으로 선언됨 | `http-request.schema.ts` — `httpRequestNodeConfigSchema.url` | 허용 프로토콜을 `http`/`https`로 제한하고 사설 IP 대역 차단 로직을 핸들러 실행 직전에 적용 |
| 3 | API Contract / Dependency | **`passthrough()` 필드 HTTP 누출 위험** — `keyValueSchema`에 `.passthrough()` 추가로 `description`, `enabled` 등 메타 필드가 파싱 결과에 보존됨. 핸들러가 entry 객체를 axios 등 라이브러리에 그대로 전달하면 의도치 않은 HTTP 헤더/쿼리 전송 가능 | `http-request.schema.ts` — `keyValueSchema` | 핸들러에서 `{ key, value }` 구조 분해로 필요한 필드만 추출하는지 확인; 없다면 `pick(['key', 'value'])` 방어 코드 추가 |
| 4 | Side Effect / Requirement | **`optionSchema.value` 의미론적 변경** — `optional()` → `default('')` 전환으로 `value` 미설정 시 `undefined` 대신 `''` 반환. 핸들러·프론트 코드에서 `option.value === undefined` 로 "값 미설정"을 판별하는 분기가 있다면 조용히 오동작 | `form.schema.ts` — `optionSchema.value` | form 핸들러 및 프론트엔드 dirty-check 로직에서 `value === undefined` 조건 grep 확인; 저장된 기존 데이터 마이그레이션 필요 여부도 점검 |
| 5 | Documentation / Requirement | **JSDoc의 `cookies` 필드 불일치** — 주석 및 테스트 describe 제목에 `cookies`가 명시되어 있으나 `httpRequestNodeConfigSchema`에 `cookies` 필드가 존재하지 않음 | `http-request.schema.ts` JSDoc, `http-request.schema.spec.ts` describe 제목 | `cookies` 필드를 실제로 추가하거나, 주석·describe 제목을 `headers / queryParams`로 수정 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **`keyValueSchema` 필수 필드 누락 케이스 미검증** — 현재 happy-path와 passthrough만 검증; `key` 또는 `value` 누락 시 파싱 오류 케이스 없음 | `http-request.schema.spec.ts` | `expect(() => keyValueSchema.parse({ key: 'X' })).toThrow()` 형태의 부정 케이스 추가 |
| 2 | Testing | **`optionSchema.value: undefined` 케이스 명시적 검증 부재** — `undefined` → `''` 강제 적용 동작이 테스트로 문서화되지 않음 | `form.schema.spec.ts` | `optionSchema.parse({ label: 'Yes' })` 케이스에서 `value === ''` 확인하는 테스트 추가 |
| 3 | Documentation | **JSDoc의 `carousel` 참조 검증 필요** — "form, carousel과 동일하게 passthrough 적용"이라 명시되어 있으나 carousel 스키마가 실제로 passthrough를 사용하는지 불확인 | `http-request.schema.ts` JSDoc | carousel 스키마 코드 확인 후 불일치 시 해당 노드 이름 제거 |
| 4 | Documentation | **`as Record<string, unknown>` 캐스트 이유 주석 부재** — passthrough 테스트에서 두 파일 모두 동일 패턴 반복; Zod 타입 시스템 한계로 인한 불가피한 캐스트임을 나타내는 주석 없음 | `http-request.schema.spec.ts:23`, `form.schema.spec.ts:48` | `// Zod passthrough()는 런타임에 추가 필드를 보존하지만 타입에는 미반영` 한 줄 주석 추가 (선택) |
| 5 | Maintainability / Architecture | **`keyValueSchema` / `optionSchema` export로 공개 API 표면 확장** — 테스트 목적 export이나 다른 모듈이 직접 import하면 노드 경계가 흐려질 수 있음 | `http-request.schema.ts:13`, `form.schema.ts:13` | 현재는 허용 범위; 동일 패턴이 3개 노드 초과 시 공유 스키마(`src/nodes/core/schemas/`)로 승격 검토 |
| 6 | Architecture | **key-value 패턴 노드별 분산 정의** — http-request·form·carousel 등 동일 패턴이 복수 노드에 독립 정의되어 drift 위험 | 각 노드 schema 파일 | 단기 현 구조 유지; 3개 초과 시 `core/schemas/key-value.schema.ts`로 추출 |
| 7 | Architecture | **`.passthrough()` 전면 적용으로 타입 안전성 희생** — 여러 스키마에 passthrough 중첩 적용 시 IDE 지원·컴파일 타임 검증 약화 | 전 파일 공통 | 알려진 메타 필드(`description`, `enabled`)는 스키마에 선언적으로 추가하는 방향 장기 검토 |
| 8 | Requirement | **`keyValueSchema.key` 빈 문자열 허용** — `z.string()`이 `''`를 통과시켜 빈 헤더명·쿼리파라미터명이 HTTP 요청에 전달될 수 있음 | `http-request.schema.ts` — `keyValueSchema.key` | `z.string().min(1)` 적용 또는 핸들러에서 빈 key entry skip 처리 (UI 임시 행 패턴 확인 후 결정) |
| 9 | Security | **`verifySsl: false` 감사 로그 없음** — 기본값은 `true`이나 `false` 설정 시 MITM 위험에 노출되고 경고 없이 허용됨 | `http-request.schema.ts` — `httpRequestNodeConfigSchema.verifySsl` | 핸들러 실행 로그에 `verifySsl: false` 사용 시 명시적 경고 기록 추가 |
| 10 | Security | **`optionSchema.value`의 `z.unknown()` — 다운스트림 인젝션 벡터** — object, array 등 임의 구조가 입력될 수 있으며 핸들러에서 타입 가드 없이 SQL·HTML에 삽입되면 인젝션 위험 | `form.schema.ts` — `optionSchema.value` | 핸들러·렌더러에서 `value` 사용 시 `typeof` 가드 또는 명시적 직렬화 적용 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | CRLF 헤더 인젝션, SSRF URL 미차단, verifySsl 감사 로그 부재 |
| API Contract | **LOW** | passthrough 필드 HTTP 누출 위험, optionSchema 기본값 변경의 dirty-check 영향 |
| Dependency | **LOW** | keyValueSchema passthrough 다운스트림 동작 변경, export 공개 API 확장 |
| Side Effect | **LOW** | optionSchema.value undefined → '' 판별 분기 오동작 가능성 |
| Scope | **LOW** | passthrough·default 변경의 다운스트림 영향 범위 확인 필요 |
| Documentation | **LOW** | cookies JSDoc 불일치, carousel 참조 미검증 |
| Requirement | **LOW** | cookies 필드 구현 누락 가능성, optionSchema 하위 호환 영향 |
| Testing | **LOW** | keyValueSchema 필수 필드 누락 케이스 미검증 |
| Maintainability | **LOW** | export 공개 API 표면 확장, passthrough 캐스트 패턴 반복 |
| Architecture | **LOW** | key-value 패턴 분산 정의, passthrough 전면 적용으로 타입 안전성 약화 |
| Performance | **NONE** | 스키마 싱글턴 재사용 적절, 실질적 성능 문제 없음 |
| Database | **NONE** | 해당 없음 |
| Concurrency | **NONE** | 해당 없음 |

---

## 발견 없는 에이전트

- **Database** — 스키마/테스트 변경만으로 DB 관련 코드 없음
- **Concurrency** — 순수 동기 스키마 선언 및 단위 테스트, 동시성 패턴 없음
- **Performance** — 스키마 싱글턴 구조 올바름, 실질적 성능 문제 없음

---

## 권장 조치사항

1. **[즉시] CRLF 인젝션 차단** — `keyValueSchema.key`와 `.value`에 `z.string().refine(v => !/[\r\n]/.test(v), ...)` 추가 또는 HTTP 핸들러에서 CRLF strip 처리 필수
2. **[즉시] SSRF 방어** — `url` 필드 파싱 또는 핸들러 실행 직전에 허용 프로토콜 화이트리스트(`http`/`https`) 및 사설 IP 대역 차단 로직 적용
3. **[우선] passthrough 필드 HTTP 누출 확인** — `http-request.handler.ts`에서 headers/queryParams 배열을 순회할 때 `{ key, value }` 구조 분해만 사용하는지 확인; 그렇지 않으면 `pick(['key', 'value'])` 방어 코드 추가
4. **[우선] `optionSchema.value` 하위 호환 확인** — form 핸들러 및 프론트엔드 코드에서 `option.value === undefined` 조건 grep; 기존 저장 데이터에 `value: undefined` 레코드가 있다면 마이그레이션 검토
5. **[보통] JSDoc `cookies` 불일치 수정** — `cookies` 필드를 schema에 추가하거나 JSDoc·describe 제목을 `headers / queryParams`로 수정
6. **[보통] `keyValueSchema` 누락 케이스 테스트 추가** — 필수 필드 누락 시 파싱 오류 케이스 및 `value: undefined` → `''` 케이스 테스트 보강
7. **[장기] 공유 스키마 추출 시점 정의** — key-value 패턴 사용 노드가 3개 초과 시 `core/schemas/key-value.schema.ts`로 승격; carousel 스키마 passthrough 적용 여부 확인 후 JSDoc 갱신