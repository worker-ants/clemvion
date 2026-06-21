# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 레이어 정렬 리팩터링으로 API 계약·기능 동작은 완전히 보존됨. 주요 잠재 이슈는 `validateServiceAuthType` 의 `private` → `public` 가시성 승격(내부 guard 메서드의 외부 노출) 및 테스트 패턴 불일치이며, 즉각적 기능 위험은 없음.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 부작용 | `validateServiceAuthType` 가 `private` → `public` 으로 승격되어 외부 모듈/컨트롤러가 직접 호출 가능한 인터페이스가 열림. 내부 pre-condition guard 메서드가 서비스 공개 API 표면에 노출되면 미래에 검증 로직 우회·이중 호출 패턴이 생길 수 있음(ISP 경계 문제). 현재 오용 경로 없어 즉각적 위험은 낮음. | `integrations.service.ts:1408` (`validateServiceAuthType`) | (1) 이상적: `private` 유지 + 테스트는 `previewTest`/`create` 경유 간접 검증으로 전환. (2) 현행 유지 허용 시: JSDoc 에 `@internal` 또는 "내부 서비스 공유 목적, 외부 직접 호출 금지" 명시. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `INTEGRATION_INVALID_SERVICE (400)` 에러 코드가 `spec/2-navigation/4-integration.md §9.4` 에러 코드 목록 및 `spec/conventions/error-codes.md` 에 미등재. m-1 신설 아닌 기존 누락. 코드 구현은 정상. | `spec/2-navigation/4-integration.md §9.4`, `spec/conventions/error-codes.md` | 코드 유지 + spec 갱신 (project-planner 위임). plan/in-progress에 체크박스로 추적 중. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/4-integration.md §9.2` preview-test 요청 바디 필드명이 `service` 로 기술되어 있으나 실제 `PreviewTestDto` 는 `serviceType` 사용. m-1 이전부터 존재하던 spec drift. 신규 개발자가 spec 기반으로 잘못된 필드명으로 클라이언트 작성할 위험 있음. | `spec/2-navigation/4-integration.md` line 809, `integration.dto.ts:161` | 코드 유지 + spec 갱신. `service` → `serviceType` 으로 수정 (project-planner 위임). |
| 3 | 유지보수성 | `previewTest` 내 `// m-1:` 인라인 주석과 `validateServiceAuthType` JSDoc 이 동일 이관 의도를 중복 서술. 작업 태그(`m-1:`) 는 시간이 지나면 의미 소실 가능성 있음. | `integrations.service.ts:927-930`, `integrations.controller.ts:239-241` | `previewTest` 내 `// m-1:` 블록 주석 제거 또는 "why" 중심 서술로 교체. 의도는 JSDoc 단일 진실로 충분 (비차단 nit). |
| 4 | 테스팅 | 신규 `validateServiceAuthType` 단위 테스트 2건(L1729, L1744)이 `try/catch` 패턴 사용. 파일 내 기존 테스트는 `.toThrow()` / `.rejects.toThrow()` 패턴을 사용해 코드베이스 패턴과 불일치. `try/catch` 방식은 장황하고 false-positive 위험 있음. | `integrations.service.spec.ts:659-686` | `expect(() => service.validateServiceAuthType(...)).toThrow(BadRequestException)` 형식으로 통일. |
| 5 | 테스팅 | `previewTest validates...` 테스트가 `toThrow(BadRequestException)` 타입 체크만 하고 에러 바디(`code: 'INTEGRATION_INVALID_SERVICE'`, `message`)를 검증하지 않음. 향후 `previewTest` 내부에서 에러 intercept·변환 코드 추가 시 회귀 탐지 불가. | `integrations.service.spec.ts:1758-1766` | `caught?.getResponse()` 또는 `expect.objectContaining({ code: 'INTEGRATION_INVALID_SERVICE' })` assertion 추가 권장. |
| 6 | 테스팅 | `previewTest validates...` 테스트가 동기 `expect(() => ...).toThrow()` 패턴 사용. `previewTest` 는 `async` 메서드라 현재는 동기 throw 로 작동하나, 향후 비동기로 검증 이동 시 false-positive 발생 가능. | `integrations.service.spec.ts:1758-1765` | `expect(async () => service.previewTest(...)).rejects.toThrow(BadRequestException)` 비동기 패턴 병용 권장. |
| 7 | 테스팅 | `create()` 경로에서 `validateServiceAuthType` 호출에 대한 명시적 단위 테스트 없음. 누군가 `create()` 에서 호출을 제거해도 현재 suite 가 탐지하지 못할 수 있음. | `integrations.service.spec.ts` (create describe 블록) | `create describe` 블록에 `create() throws INTEGRATION_INVALID_SERVICE for unknown serviceType` 테스트 1개 추가. |
| 8 | 테스팅 | 컨트롤러 단위 테스트 파일 없음. throttle 데코레이터·HTTP 상태 코드 전파 등 컨트롤러 레이어 고유 동작이 단위 레벨 미검증 상태. RESOLUTION.md(INFO #5)가 의도적 미조치로 분류. | `integrations.controller.ts` (대응 spec 없음) | e2e 수준에서 `POST /integrations/preview-test` 에 미지원 조합 전송 → 400 + `INTEGRATION_INVALID_SERVICE` 반환 시나리오 확인 권장. |
| 9 | 아키텍처 | `oauthBegin` 에서 `cafe24`/`makeshop` 분기를 controller 가 직접 조립(`providerMeta`)하는 구조가 레이어 책임 관점에서 이상적이지 않음(기존 잔존 패턴, 이번 변경 외 범위). | `integrations.controller.ts:264-287` | m-1 범위 외. M-2(`IntegrationOAuthService` 분리) 백로그에서 처리 예정 — 현 단계 무조치. |
| 10 | 문서화 | `validateServiceAuthType` JSDoc 에 `authType` 가능 값 목록 `@see` 링크 없음. 현재 `@param serviceType` 예시(`http`, `mcp`, `cafe24`)는 충분하나 authType 열거는 없음. | `integrations.service.ts` JSDoc | 서비스 카탈로그 spec 에 authType 목록 정리 후 `@see` 링크 추가 (비차단 nit). |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (출력 파일 없음 — 재시도 필요) | — |
| architecture | LOW | `validateServiceAuthType` public 승격으로 ISP 경계 문제 잠재, @internal 주석 권장 |
| requirement | NONE | 기능 완전성 충족; SPEC-DRIFT 2건(에러 코드 미등재, 필드명 불일치)은 기존 spec 미갱신 |
| scope | NONE | 변경 범위 의도와 정확히 일치, 의도 외 수정 없음 |
| side_effect | LOW | public 가시성 확장으로 향후 외부 호출 가능성 열림, API 응답 계약은 보존 |
| maintainability | LOW | 인라인 주석 중복, 테스트 try/catch 패턴 불일치 |
| testing | LOW | create() 경로 명시적 테스트 없음, previewTest 테스트 에러 바디 미검증, 비동기 패턴 미비 |
| documentation | NONE | JSDoc/@param/@throws 충분, RESOLUTION.md 완결적, spec drift는 plan 추적 중 |
| api_contract | NONE | API 응답 계약(에러 코드·HTTP 상태·응답 바디) 변경 전후 동일, breaking change 없음 |

---

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항을 기록함; security 에이전트는 출력 파일 미존재로 결과 불명 — 재시도 필요 1건).

---

## 권장 조치사항

1. **[WARNING 해소]** `validateServiceAuthType` 가시성 결정: (a) `private` 으로 복귀 + 테스트를 `previewTest`/`create` 경유 간접 검증으로 전환하거나, (b) 현행 `public` 유지 시 JSDoc 에 `@internal` 또는 "외부 직접 호출 금지" 명시 — 선택지 중 하나를 결정해 코드에 반영.
2. **[INFO 4 — 테스트 패턴]** `validateServiceAuthType` 직접 호출 테스트 2건의 `try/catch` → `.toThrow()` 패턴 통일.
3. **[INFO 6 — 비동기 패턴]** `previewTest validates...` 테스트를 `rejects.toThrow()` 비동기 패턴으로 교체.
4. **[INFO 5 — 에러 바디]** `previewTest validates...` 테스트에 에러 바디(`code: 'INTEGRATION_INVALID_SERVICE'`) assertion 추가.
5. **[INFO 7 — create() 테스트]** `create describe` 블록에 `validateServiceAuthType` 통과 검증 테스트 1건 추가.
6. **[SPEC-DRIFT — planner 위임]** `INTEGRATION_INVALID_SERVICE (400)` 를 `spec/2-navigation/4-integration.md §9.4` 및 `spec/conventions/error-codes.md` 에 등재 (project-planner).
7. **[SPEC-DRIFT — planner 위임]** `spec/2-navigation/4-integration.md §9.2` 필드명 `service` → `serviceType` 수정 (project-planner).
8. **[INFO 3 — nit]** `previewTest` 및 controller 내 `// m-1:` 인라인 주석 제거 또는 "why" 중심 서술로 압축.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `user_guide_sync` (5명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단 — 해당 변경(레이어 정렬 리팩터링)에서 성능 영향 없음 |
| dependency | 라우터 판단 — 새 외부 의존성 도입 없음 |
| database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
| concurrency | 라우터 판단 — 동시성 관련 변경 없음 |
| user_guide_sync | 라우터 판단 — 사용자 가이드 문서 변경 불필요 |

> 참고: `security` reviewer 는 router_safety 강제 포함으로 실행 목록에 있었으나 출력 파일(`security.md`)이 존재하지 않아 결과 확인 불가. 재시도 필요 1건.