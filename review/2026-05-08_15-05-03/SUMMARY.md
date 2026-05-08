# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Integration API Key가 query parameter 방식일 때 에러 출력(NodeExecution DB, WebSocket)에 평문 노출되며, `requestBodyType`이 평가된 값 대신 raw 템플릿을 반환하는 계약 위반이 복수 에이전트에서 확인됨

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **Security** | `sanitizeUrlCredentials`가 `user:password@` 형식만 처리 → `?api_key=SECRET` 형태 query string 자격증명이 에러 포트 `output.error.details.url`을 통해 NodeExecution 행·WebSocket 이벤트에 평문 노출 | `http-request.handler.ts` — 비-2xx·transport 에러 분기 | query string 내 민감 파라미터도 `[REDACTED]` 처리, 또는 origin+pathname만 echo |
| 2 | **Security** | 평가된 request body가 민감 데이터 필터링 없이 `output.requestBody`로 저장 — response header에는 `sanitizeResponseHeaders`가 있으나 request body에는 대응 sanitizer 없음 | `http-request.handler.ts` — `requestBodyOutput()` | spec에 저장 동작 명시 + 민감 키(`password`, `secret`, `token`) heuristic redact 정책 검토 |
| 3 | **Security** | `authentication=none/custom`일 때 SSRF 검사 완전 생략 | `http-request.handler.ts` — `assertSafeOutboundUrl` 조건부 호출 | 환경변수 제어 optional SSRF guard 추가 |
| 4 | **Security** | `redirect='manual'` 시 3xx 응답의 `Location` 헤더가 `output.responseHeaders.location`에 노출 | `http-request.handler.ts` | `EXACT_BLACKLIST`에 `location` 추가 |
| 5 | **API Contract / Requirement** | `output.requestBodyType`이 평가된 `bodyType` 대신 `rawConfig.bodyType` 사용 — 표현식이면 미평가 템플릿 노출, 미설정 시 기본값 `'json'` 누락 | `http-request.handler.ts` — `requestBodyOutput()` | `rawConfig.bodyType` → 평가된 지역변수 `bodyType`으로 교체 |
| 6 | **Architecture** | `buildConfigEcho`가 schema 필드를 수동 열거 — 신규 필드 추가 시 누락 위험 | `http-request.handler.ts` — `buildConfigEcho` | `{ ...rawConfig, url: rawUrl }` spread로 단순화 |
| 7 | **Maintainability** | transport 에러 catch 블록이 `requestBodyOutput()` 헬퍼를 재사용하지 않고 동일 spread 로직 수동 반복 (DRY 위반) | `http-request.handler.ts` | `buildBodyOutputFields(responseHeaders?)` 헬퍼로 통합 |
| 8 | **Maintainability** | `execute()` 메서드에 rawConfig 추출·클로저·직렬화 로직 추가로 복잡도 증가 | `http-request.handler.ts` | 클로저를 모듈 레벨 순수 함수로 추출 |
| 9 | **Maintainability** | `sanitizeResponseHeaders` JSDoc에 테스트 구현 세부사항("mock-like inputs") 노출 | `sanitize-response-headers.util.ts` | JSDoc을 프로덕션 의미로 한정 |
| 10 | **Testing** | `sanitize-response-headers.util.ts` 신규 코드 경로(null/undefined, Symbol.iterator 미보유 fallback)의 전용 unit spec 부재 | `sanitize-response-headers.util.ts` | `sanitize-response-headers.util.spec.ts` 신규 작성 |
| 11 | **Testing** | 기존 `{ get: jest.fn() }` mock이 이제 `responseHeaders: {}`를 무성으로 생성하는 동작 변화가 기존 assertion에 미반영 | `http-request.handler.spec.ts` | `expect(result.output.responseHeaders).toEqual({})` 단언 추가 또는 `new Headers()`로 교체 |
| 12 | **Testing** | `x-www-form-urlencoded` bodyType의 echo vs wire 전송값 불일치가 테스트로 미문서화 | `http-request.handler.spec.ts` — ENG-RC-* | 해당 bodyType 케이스 추가 |
| 13 | **Testing** | `body: null` 케이스 미테스트 — output 포함 여부 비대칭이 미명시 | `http-request.handler.spec.ts` — ENG-RC-* | `body: null` 케이스 또는 정책 결정 후 명시 |
| 14 | **Documentation** | §1.3 공통 출력 구조가 구 포맷으로 잔존 | `spec/4-nodes/4-integration-nodes.md` §1.3 | `{ config, output, meta, port }` 현행 골격으로 교체 |
| 15 | **Documentation** | §6.3 Send Email 반환 shape가 구 평탄 구조 — §4.3은 업데이트됐으나 §6.3 누락 | `spec/4-nodes/4-integration-nodes.md` §6.3 | §4.3 성공 예시와 동기화 |
| 16 | **Documentation / Requirement** | §6.3이 "매 호출마다 transport 생성 후 close" 기술 — 실제는 `integrationId + credentials hash` 캐시 재사용 | `spec/4-nodes/4-integration-nodes.md` §6.3 | 캐시 재사용 방식으로 갱신 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | 조건부 빈 객체 스프레드 패턴이 임시 객체를 반복 생성 | `requestBodyOutput()` | 직접 할당 패턴으로 교체 |
| 2 | Performance | `truncateBodyForOutput`가 SSRF 검사 이전 실행 — 차단 시 낭비 | `execute()` 진입부 | `assertSafeOutboundUrl` 이후로 이동 |
| 3 | Performance | `typeof Headers !== 'undefined'` 가드가 호출마다 재평가 | `iterateHeaders()` | 모듈 레벨 상수로 추출 |
| 4 | Performance | `String(value)` 래핑이 이미 string인 헤더 값에 불필요하게 적용 | sanitize 루프 | `value as string`으로 교체 |
| 5 | Architecture | `sanitizeResponseHeaders` null 허용이 테스트 편의 목적이나 프로덕션 API 계약으로 노출 | `sanitize-response-headers.util.ts` | 테스트 mock을 실제 타입으로 교체가 근본 해결 |
| 6 | Architecture | `rawConfig ?? config` 폴백이 Phase 1 완료 전 임시 기술 부채 | `http-request.handler.ts:113`, `send-email.handler.ts:89` | Phase 1 완료 후 폴백 제거, `rawConfig` 필수 필드로 승격 |
| 7 | Architecture | 출력 schema와 핸들러 반환값이 수동 동기화 — `.passthrough()`로 불일치 미감지 | `http-request.schema.ts` ↔ handler | 공통 베이스 스키마 추출 고려 |
| 8 | Concurrency | SMTP `transports` 캐시에서 credential 교체 시 진행 중인 `sendMail`과 경합 가능 (pre-existing) | `send-email.handler.ts` — `resolveTransport()` | 레퍼런스 카운팅 또는 retire 큐 도입 |
| 9 | API Contract | `responseHeaders: {}` 빈 객체가 schema `optional()` 선언에도 항상 포함 | `requestBodyOutput()` | 빈 경우 생략 또는 schema `optional()` 제거로 통일 |
| 10 | API Contract | `config.body` raw 값 에코 시작 — 하드코딩 시크릿이 NodeExecution 행에 기록 가능 | `buildConfigEcho()` | spec에 trade-off 명시 또는 credential-shape 키 REDACTED 정책 |
| 11 | Testing | `makeContext` 팩토리와 기존 `const context` 상수 공존 — 패턴 불일치 | `http-request.handler.spec.ts` | 단일 패턴으로 통일 |
| 12 | Documentation | `meta.duration`(HTTP) vs `meta.durationMs`(Email) 필드명 차이 미명시 | §2.3, §4.3 | 노드별 편차 명시 또는 다음 리팩터 시 통일 |
| 13 | Documentation | §2.3 예시에서 `config.url`은 평가된 URL, `config.body`는 raw 템플릿 혼재 | §2.3 | 일관된 형태로 수정 또는 Note 추가 |
| 14 | Documentation | 출력 스키마 `config.headers` 타입이 느슨하나 이유 미기재 | `http-request.schema.ts:48` | `// raw echo — validation is one-way` 주석 추가 |
| 15 | Scope | 포맷팅 변경이 기능 변경과 혼재 | `truncate-body.util.spec.ts` 등 | 포맷팅 커밋 항상 별도 분리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **HIGH** | Integration API Key query param 누출, request body 무필터 저장, 조건부 SSRF 생략 |
| Maintainability | **MEDIUM** | `requestBodyOutput` DRY 위반, `execute()` 복잡도 증가 |
| Testing | **MEDIUM** | `sanitize-response-headers.util.spec.ts` 부재, 기존 mock 동작 변화 미반영 |
| Requirement | **MEDIUM** | `requestBodyType`이 raw 값 사용으로 CONVENTIONS Principle 7 위반 |
| API Contract | **MEDIUM** | config echo 의미론적 파괴적 변경, `requestBodyType` evaluated vs raw 혼용 |
| Documentation | **LOW** | §1.3·§6.3 스펙 예시 구 포맷 잔존, `meta` 필드명 불일치 미명시 |
| Architecture | **LOW** | `buildConfigEcho` 수동 필드 열거, `rawConfig ?? config` 기술 부채 |
| Performance | **LOW** | 임시 객체 반복 생성, SSRF 이전 조기 직렬화 |
| Concurrency | **LOW** | SMTP transport 캐시 credential 교체 시 경합 (pre-existing) |
| Side Effect | **LOW** | `requestBodyType` raw 템플릿 노출 (Requirement와 동일 근본 원인) |
| Scope | **NONE** | 모든 변경이 Phase 2 마이그레이션 범위 내 |
| Dependency | **NONE** | 외부 패키지 의존성 변화 없음 |
| Database | **NONE** | DB 계층과 직접 접점 없음 |

---

## 발견 없는 에이전트
- **Database** — 변경 파일 전체가 DB 계층과 무관
- **Dependency** — 외부 패키지 추가 없음

---

## 권장 조치사항

1. **[즉시] `sanitizeUrlCredentials` 확장** — query string 민감 파라미터 `[REDACTED]` 처리 (Security W-1)
2. **[즉시] `requestBodyType` 소스 교정** — `rawConfig.bodyType` → 평가된 `bodyType`으로 교체, 기본값 `'json'`도 echo (Requirement W-5)
3. **[단기] `sanitize-response-headers.util.spec.ts` 신규 작성** — null, undefined, iterator 미보유 mock, iterable tuple 케이스 (Testing W-10)
4. **[단기] 스펙 §1.3·§6.3 동기화** — 현행 구현 기준 출력 구조 및 transport 캐싱 설명 반영 (Documentation W-14·15·16)
5. **[단기] catch 블록 DRY 정리** — `buildBodyOutputFields(responseHeaders?)` 헬퍼로 중복 제거 (Maintainability W-7)
6. **[단기] 기존 테스트 mock 보강** — `responseHeaders` 단언 추가, `x-www-form-urlencoded`·`body: null` 케이스 추가 (Testing W-11·12·13)
7. **[중기] `buildConfigEcho` spread 전환** — `{ ...rawConfig, url: rawUrl }` (Architecture W-6)
8. **[중기] `sanitizeResponseHeaders` null 허용 재검토** — 테스트 mock을 실제 타입으로 교체 (Architecture I-5)
9. **[Phase 1 완료 후] `rawConfig ?? config` 폴백 제거** — `rawConfig` 필수 필드 승격 (Architecture I-6)
10. **[운영 정책 검토] SSRF guard 범위 확대** — `authentication=none/custom`에도 optional SSRF 적용 (Security W-3)