# Code Review 통합 보고서

## 전체 위험도
**LOW** — `serviceType/authType` 검증 로직을 controller에서 service 레이어로 이관하는 순수 레이어 정렬 리팩터링이다. 외부 API 계약(에러 코드·HTTP 상태·응답 형식)은 완전히 불변이며 보안 경계도 유지된다. Critical 발견 없음. WARNING 2건은 코드 중복(DRY 위반)으로 후속 정리를 권장한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `validateServiceAuthType`(public)과 `validateServiceAndAuth`(private)가 동일한 `findVariant` 체크와 동일한 에러 코드·메시지를 중복 구현 — 향후 에러 코드·메시지 변경 시 Shotgun Surgery 위험 | `integrations.service.ts` L3120 (`validateServiceAuthType`) vs L3598 (`validateServiceAndAuth`) | `validateServiceAndAuth`가 `validateServiceAuthType`을 내부 위임하도록 통합하거나, `private validateServiceAndAuth`를 제거하고 해당 호출부를 `validateServiceAuthType`으로 교체 |
| 2 | 테스팅 | 테스트 블록 내 동일 메서드 이중 호출 패턴 — `toThrow()` 이후 `try/catch`로 다시 호출해 바디 검증. 불필요한 중복이며 혼란 가능 | `integrations.service.spec.ts` L1728-1742 | 단일 `try/catch` 패턴 또는 `expect().toThrow(expect.objectContaining({…}))` 단일 assertion으로 통합 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `INTEGRATION_INVALID_SERVICE (400)` 에러 코드가 spec §9.4 에러 코드 목록에 미등재 — 코드는 정상, spec이 낡음 | `spec/2-navigation/4-integration.md §9.4` | spec 갱신(project-planner 위임): §9.4 에러 코드 표에 `INTEGRATION_INVALID_SERVICE (400) — 미지원 serviceType/authType 조합` 항목 추가 |
| 2 | 아키텍처 | `validateServiceAuthType`의 `public` 접근자 — 테스트 편의를 위해 internal 구현을 API surface로 노출 | `integrations.service.ts` L3120 | `@internal` JSDoc 마킹 추가 또는 `private`으로 격하 후 테스트에서 캐스팅 사용 검토 |
| 3 | 아키텍처 | `oauthBegin` 메서드 내 `providerMeta` 조립 분기(cafe24/makeshop 하드코딩)가 controller에 잔존 — 이번 변경과 레이어 정렬 원칙 측면에서 불일치 | `integrations.controller.ts` L264-287 (`oauthBegin`) | 이번 PR 범위 외 기술 부채. `IntegrationOAuthService.begin`으로 이관하는 후속 태스크 추적 권장 |
| 4 | 테스팅 | 유효한 serviceType + 지원하지 않는 authType 조합 테스트 미작성 (`nonexistent_service/api_key` 케이스만 존재) | `integrations.service.spec.ts` — 신규 `validateServiceAuthType` 테스트 | `service.validateServiceAuthType('http', 'oauth2')` 등 경계값 케이스 추가 |
| 5 | 테스팅 | Controller 단위 테스트 파일 부재 — HTTP 400 응답 전파, throttle 데코레이터 동작을 단위 레벨에서 미검증 | `integrations.controller.ts` (대응 spec 파일 없음) | 컨트롤러 단위 테스트 추가 또는 e2e에서 `POST /integrations/preview-test` 400 시나리오 확인 |
| 6 | 문서화 | `validateServiceAuthType` JSDoc에 `@param`/`@throws` 표준 태그 누락 — 이관 배경 내러티브 중심, 계약 기술 부족 | `integrations.service.ts` L924 근방 JSDoc | `@param serviceType`, `@param authType`, `@throws {BadRequestException} INTEGRATION_INVALID_SERVICE` 태그 추가 |
| 7 | 문서화 | `previewTest` 서비스 메서드에 JSDoc 없음 (변경 전부터 없었음) | `integrations.service.ts` `previewTest` 메서드 | 한 줄 JSDoc 추가: `/** 미지원 serviceType/authType 조합은 {@link validateServiceAuthType}에서 400을 throw. */` |
| 8 | 보안 | 오류 메시지에 사용자 입력값(`serviceType`/`authType`) 반영 — 레지스트리 검증 후이므로 실질 위험 낮음 | `integrations.service.ts` `validateServiceAuthType` throw 메시지 | 허용 가능 수준. 문자셋 제한(`[a-zA-Z0-9_-]`) 또는 길이 제한 방어적 추가 고려 |
| 9 | API 계약 | API 외부 계약(에러 응답 구조·HTTP 상태·엔드포인트 URL·요청 스키마) 완전 불변 확인 — 긍정적 평가 | `integrations.controller.ts`, `integrations.service.ts` | 변경 없음. Breaking change 없음 |
| 10 | 보안 | SSRF 가드(`isSmtpHostBlocked`) 및 자격증명 마스킹(`maskCredentials`) 일관 적용 확인 — 긍정적 평가 | `integrations.service.ts` testEmailTransport, `toPublic` | 변경 없음. 양호한 방어 설계 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 경계 불변, 오류 메시지 사용자 입력 반영(INFO), SSRF 가드·자격증명 마스킹 양호 |
| architecture | LOW | `validateServiceAuthType`/`validateServiceAndAuth` 중복 로직 통합 필요, `oauthBegin` 기술 부채 |
| requirement | LOW | SPEC-DRIFT: `INTEGRATION_INVALID_SERVICE` spec §9.4 미등재(코드 정상, spec 갱신 필요) |
| scope | NONE | 변경 범위 적절, 불필요한 리팩터링·무관 파일 수정 없음 |
| side_effect | — | 재시도 필요 (output_file 부재) |
| maintainability | LOW | WARNING: 두 검증 메서드 DRY 위반, 테스트 이중 호출 패턴, JSDoc 개선 필요 |
| testing | LOW | WARNING: 이중 호출 패턴, 경계값 케이스 미비, 컨트롤러 단위 테스트 부재 |
| documentation | NONE | 전반적으로 양호, @param/@throws 태그 추가 권장 |
| api_contract | NONE | 외부 계약 완전 불변, Breaking change 없음 |

---

## 발견 없는 에이전트

- **security**: Critical/WARNING 발견 없음 (모든 항목 INFO)
- **scope**: 발견 없음 (NONE)
- **documentation**: 발견 없음 (NONE)
- **api_contract**: 발견 없음 (NONE)

---

## 권장 조치사항

1. **[WARNING-1] 중복 검증 메서드 통합** (유지보수성 핵심 리스크): `private validateServiceAndAuth`를 제거하고 `validateServiceAuthType`에 위임하거나, `create()` 호출부를 `validateServiceAuthType`으로 교체해 단일 구현으로 수렴. Shotgun Surgery 위험 제거.
2. **[WARNING-2] 테스트 이중 호출 패턴 수정**: `validateServiceAuthType` 테스트 블록을 단일 `try/catch` 또는 `expect().toThrow(expect.objectContaining({…}))` 패턴으로 리팩터링.
3. **[SPEC-DRIFT] spec §9.4 에러 코드 갱신**: `INTEGRATION_INVALID_SERVICE (400)` 항목을 `spec/2-navigation/4-integration.md §9.4` 에러 코드 표에 추가 (project-planner 위임).
4. **[INFO] 경계값 테스트 추가**: 유효한 serviceType에 지원하지 않는 authType을 조합하는 케이스(`http/oauth2` 등) 단위 테스트 추가.
5. **[INFO] JSDoc 개선**: `validateServiceAuthType`에 `@param`/`@throws` 태그 추가, `previewTest` 서비스 메서드에 한 줄 JSDoc 추가.
6. **[INFO] 후속 태스크**: `oauthBegin` `providerMeta` 조립 로직 service 이관을 별도 태스크로 등록.

---

## 라우터 결정

라우터가 reviewer를 선별했습니다 (`routing_status=done`).

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명 — 이 중 maintainability, requirement, scope, security, side_effect, testing 6명은 router_safety 강제 포함)
- **제외**: 아래 표 (5명)
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 순수 레이어 정렬 리팩터링으로 성능 경로 변경 없음 |
| dependency | 신규 외부 의존성 추가 없음 |
| database | DB 쿼리·스키마 변경 없음 |
| concurrency | 동시성 모델 변경 없음 |
| user_guide_sync | 외부 API 계약 불변, 사용자 문서 업데이트 불필요 |