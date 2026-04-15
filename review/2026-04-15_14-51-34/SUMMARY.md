# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `bodyType: 'form'` breaking change로 인한 기존 워크플로우 silent regression, 헤더 인젝션 및 자격증명 덮어쓰기 보안 취약점 존재

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하위 호환성 | `bodyType: 'form'` → `'x-www-form-urlencoded'` 리네이밍으로 기존 저장된 워크플로우가 런타임 오류 없이 JSON body로 silent fallthrough 발생 | `http-request.handler.ts` — body 처리 분기 | `else if (bodyType === 'x-www-form-urlencoded' \|\| bodyType === 'form')` 으로 레거시 alias 처리 또는 DB 마이그레이션 계획 수립 |
| 2 | 보안 | 헤더 키/값에 CRLF 문자(`\r`, `\n`) 검증 없음 — HTTP 헤더 인젝션 가능 | `http-request.handler.ts` — `toKeyValueEntries()`, `toKeyValueRecord()` | `key.trim().replace(/[\r\n]/g, '')` 및 value에도 동일 처리 적용 |
| 3 | 보안 | `mergedHeaders` 병합 순서상 사용자 헤더가 integration 자격증명 헤더를 덮어씀 (`Authorization` 등 탈취 가능) | `http-request.handler.ts` — `mergedHeaders` 병합 로직 | credential 헤더를 마지막에 적용: `{ ...defaultHeaders, ...userHeaders, ...credentials.headers }` |
| 4 | 보안 | `authentication=none` 케이스에 SSRF 방어(`assertSafeOutboundUrl`) 미적용 — 내부 메타데이터 서버 접근 가능 | `http-request.handler.ts` — SSRF guard 블록 | `authentication=none`에도 SSRF 검사 적용하거나 운영 환경 정책 문서화 및 audit log 적용 |
| 5 | 테스트 누락 | `queryParams` 빈 키 필터링 테스트 없음 (headers는 존재하나 queryParams 누락, 대칭성 부재) | `http-request.handler.spec.ts` | `should drop query param rows with empty keys` 테스트 케이스 추가 |
| 6 | 테스트 누락 | 인증 헤더 충돌 우선순위 정책(user vs credential `Authorization`) 검증 테스트 없음 | `http-request.handler.spec.ts` | 헤더 병합 우선순위 정책을 테스트로 명시 |
| 7 | 테스트 누락 | `toKeyValueRecord`의 legacy `Record<string, string>` 형식 호환성 테스트 없음 | `http-request.handler.spec.ts` | `queryParams: { page: '1', limit: '10' }` (객체 형식) 전달 시 정상 동작 검증 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 상태 누수 | `authentication`을 `'integration'`에서 다른 값으로 변경해도 `config.integrationId`가 config에 잔류하여 백엔드로 전달될 수 있음 | `integration-configs.tsx` — `SelectField onChange` | `onChange({ ...config, authentication: v, integrationId: v === 'integration' ? config.integrationId : undefined })` |
| 2 | 보안 | 리다이렉트 체인에서 원본과 다른 도메인으로 리다이렉트 시 `Authorization` 헤더 포함 `fetchOptions` 재사용 — 자격증명 제3자 유출 가능 | `http-request.handler.ts` — 리다이렉트 while loop | 리다이렉트 도메인이 다를 경우 민감 헤더 제거 또는 same-origin 리다이렉트만 허용 |
| 3 | 보안 | 백엔드 `validate()`에서 `timeout` 상한값 미검증 (프론트엔드는 `max=300000` 강제하나 API 직접 호출 시 우회 가능) | `http-request.handler.ts` — `validate()` | `timeout > 300000` 조건 추가: `timeout must be between 1 and 300000` |
| 4 | 테스트 품질 | `should send form-data body` 테스트에서 `FormData` 인스턴스 여부만 확인하고 실제 필드값 검증 없음 | `http-request.handler.spec.ts` | `expect((args.body as FormData).get('field')).toBe('value')` 검증 추가 |
| 5 | 테스트 품질 | `Object.keys(headers).toHaveLength(1)` 단언이 취약 — 내부 헤더 추가 시 깨질 수 있음 | `http-request.handler.spec.ts` — `should drop header rows with empty keys` | `expect(Object.keys(headers)).toEqual(['X-Keep'])` 형태로 정확한 목록 검증으로 변경 |
| 6 | 문서화 | `toKeyValueEntries`, `stringifyScalar` 함수에 JSDoc 누락 (비자명한 타입 강제 변환 로직 포함) | `http-request.handler.ts` | 배열/객체 양쪽 지원 이유, `JSON.stringify` 폴백 이유 주석 추가 |
| 7 | 문서화 | `form-data` 분기의 `delete mergedHeaders['Content-Type']` 주석이 코드 *다음*에 위치 | `http-request.handler.ts` | 주석을 `delete` 라인 위로 이동 |
| 8 | 문서화 | `'form'` → `'x-www-form-urlencoded'` breaking change에 대한 코드 내 설명 부재 | `http-request.handler.ts` | 함수 상단 또는 분기문에 변경 이유/레거시 처리 정책 주석 추가 |
| 9 | 성능 | 리다이렉트 루프에서 body가 있는 요청의 `fetchOptions` 재사용 — POST + 리다이렉트 시 body 스트림 소진 잠재 버그 | `http-request.handler.ts` — redirect while loop | 리다이렉트 시 method를 GET으로 전환하거나 body를 제거한 새 옵션 객체 생성 |
| 10 | 아키텍처 | `toKeyValueRecord` / `toKeyValueEntries` / `stringifyScalar` 유틸 함수가 핸들러 내부에만 위치 — 타 핸들러 재사용 시 중복 구현 위험 | `http-request.handler.ts:289-348` | 두 번째 사용처 발생 시 `handlers/utils/key-value.ts`로 분리 |
| 11 | 유지보수성 | `execute()` 함수가 약 210줄로 URL 파싱, 인증, body 직렬화, SSRF, fetch, 응답처리를 모두 담당 | `http-request.handler.ts` — `execute()` | `buildRequestBody()`, `buildFetchOptions()` 등 private 헬퍼로 분리 고려 |
| 12 | 유지보수성 | 테스트 간 `mockResponse` 보일러플레이트 중복 | `http-request.handler.spec.ts` | `mockFetchOk(body = {})` 헬퍼 함수 추출 |
| 13 | 유지보수성 | `toKeyValueEntries`의 `typeof value === 'object'` 체크가 `null`을 포함하는 구조 (상위 null 가드가 있어 버그는 아니나 의도 불명확) | `http-request.handler.ts` — `toKeyValueEntries` | `typeof value === 'object' && value !== null` 형태로 명시 |
| 14 | 의존성 | `FormData`는 Node.js 18+ 내장 — 하위 버전 지원 시 별도 패키지 필요 | `http-request.handler.ts` — form-data 블록 | `package.json`의 `engines.node >= 18` 명시 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | CRLF 헤더 인젝션, 자격증명 헤더 덮어쓰기, authentication=none SSRF 무방비, 리다이렉트 Authorization 누출 |
| testing | MEDIUM | queryParams 빈키 필터링 테스트 누락, 헤더 우선순위 정책 테스트 누락, legacy Record 형식 호환성 테스트 누락 |
| api_contract | MEDIUM | `bodyType: 'form'` breaking change — 기존 워크플로우 silent regression |
| side_effect | MEDIUM | `bodyType: 'form'` breaking change, integrationId 상태 누수 |
| scope | MEDIUM | `bodyType: 'form'` breaking change, JSON body 묵시적 동작 변경 |
| performance | LOW | URLSearchParams 이중 생성, 리다이렉트 body 재사용 잠재 버그 |
| documentation | LOW | JSDoc 누락, breaking change 설명 부재, 주석 위치 |
| requirement | LOW | Record 경로 빈 키 필터링 누락, integrationId 잔류, form-data 값 검증 미흡 |
| architecture | LOW | 유틸 함수 공유 모듈 미분리, 레거시 포맷 제거 계획 부재 |
| maintainability | LOW | execute() 함수 과다, 테스트 보일러플레이트 중복, 취약한 헤더 수 검증 |
| dependency | NONE | 새 외부 의존성 없음, Node.js 18+ FormData 요구사항 확인 권장 |
| concurrency | NONE | 동시성 문제 없음 |
| database | NONE | DB 관련 변경 없음 |

---

## 발견 없는 에이전트

- **database** — DB 쿼리/스키마/ORM 관련 변경 없음
- **concurrency** — 공유 상태 없는 순수 함수 구조, 동시성 위험 없음

---

## 권장 조치사항

1. **[즉시 필수] `bodyType: 'form'` 하위 호환성 처리** — 기존 저장된 워크플로우 데이터 silent breakage 방지를 위해 `'form'` alias 분기 추가
2. **[즉시 필수] CRLF 헤더 인젝션 방어** — `toKeyValueEntries`에서 키/값 모두 `replace(/[\r\n]/g, '')` 적용
3. **[즉시 필수] 자격증명 헤더 병합 순서 수정** — credential 헤더가 사용자 헤더보다 우선하도록 병합 순서 변경
4. **[권장] `integrationId` 상태 누수 수정** — authentication 변경 시 `integrationId` 초기화 처리
5. **[권장] 테스트 보강** — queryParams 빈 키 필터링, 헤더 충돌 우선순위 정책, legacy Record 형식 호환성 테스트 추가
6. **[권장] 백엔드 `timeout` 상한값 검증** — `timeout > 300000` API 레벨 방어 추가
7. **[선택] SSRF 정책 문서화** — `authentication=none`의 내부 URL 허용 정책을 명시적으로 문서화하거나 SSRF 검사 적용
8. **[선택] `form-data` 테스트 값 검증 보강** — `FormData.get()` API로 실제 필드값 포함 여부 검증 추가
9. **[선택] 취약한 `toHaveLength(1)` 단언 교체** — 헤더 수 검증 대신 특정 키 존재/부재 검증으로 변경