# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 레이어 정렬 리팩터링으로 기능·보안 회귀 없음. Critical 발견사항 없음. INFO 수준 개선 권고 다수, 보안/테스팅/문서화에서 LOW 등급 항목 존재.

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `serviceType`/`authType` 에러 메시지에 입력값 반영 — 길이·문자 집합 제한 없어 로그 포이즈닝(CRLF injection) 잠재 가능 | `integrations.service.ts:1414` | DTO 레벨 `@MaxLength(64)` + `@Matches(/^[a-z0-9_]+$/)` 추가 또는 에러 메시지 생성 시 sanitize |
| 2 | 보안 | `PreviewTestDto.credentials` 크기·깊이 제한 없음 — throttle 외 payload 크기 제한 부재 | `dto/integration.dto.ts:181` | 글로벌 bodyParser limit 설정(`64kb` 류) 확인 및 추가 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `POST /api/integrations/preview-test` spec §9.2 의 `service` 필드명이 실제 DTO `serviceType` 과 불일치 — spec 이 낡음 (pre-existing, plan 추적 중) | `spec/2-navigation/4-integration.md §9.2` | 코드 유지, spec `service` → `serviceType` 수정 (project-planner 위임) |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `INTEGRATION_INVALID_SERVICE (400)` 에러 코드가 spec §9.4 및 `error-codes.md` 미등재 — pre-existing (plan 추적 중) | `spec/2-navigation/4-integration.md §9.4`, `spec/conventions/error-codes.md` | 코드 유지, spec 에러 코드 표 추가 (project-planner 위임) |
| 5 | 아키텍처 | `oauthBegin` providerMeta 조립 분기가 controller 잔존 — M-2 백로그 추적 중, 이번 PR 범위 밖 | `integrations.controller.ts` L264-287 | M-2 완료 시 `IntegrationOAuthService.begin` 내부로 이관 |
| 6 | 테스팅 | `integrations.controller.spec.ts` 미존재 — previewTest 라우팅 경로(서비스 mock 예외 투명 전달) 미커버 | controller 계층 | 선택적으로 `controller.spec.ts` 신설 |
| 7 | 테스팅 | `create()` 와 `previewTest()` 경계 케이스 커버리지 비대칭 — `create()` 에 "valid serviceType + unsupported authType" 케이스 없음 | `integrations.service.spec.ts` `describe('create')` | `create()` 에 두 번째 경계 케이스 추가해 `previewTest` 와 대칭 |
| 8 | 테스팅 | `rotate()` / `reauthorize()` 가 `validateServiceAuthType` 미호출인 의도 미문서화 | `integrations.service.ts` L1007, L1199 | JSDoc 또는 주석에 "기존 엔티티 경유 — 이미 registry 검증됨" 한 줄 추가 |
| 9 | 테스팅 | `create()` assertion 이 `rejects.toThrow(BadRequestException)` 패턴 — 에러 코드 미확인 (`previewTest` 쪽은 `toMatchObject` 로 코드 확인) | `integrations.service.spec.ts` | `create()` assertion 을 `toMatchObject({ response: { code: 'INTEGRATION_INVALID_SERVICE' } })` 로 통일 |
| 10 | 문서화 | `validateServiceAuthType` JSDoc 에 `@param`/`@throws` 표준 태그 누락 — IDE 툴팁·자동 API 문서에서 파라미터 계약 미노출 | `integrations.service.ts` `validateServiceAuthType` JSDoc | `@param serviceType`, `@param authType`, `@throws {BadRequestException}` 태그 추가 |
| 11 | 문서화 | `previewTest` 서비스 메서드 JSDoc 부재 — 이번 변경으로 "저장 전 검증 포함" 계약이 명확해졌으나 코드에 미표현 | `integrations.service.ts` `previewTest` 메서드 | 한 줄 JSDoc 추가 (저장 없이 구조적 유효성 검증 + INTEGRATION_INVALID_SERVICE 400 명시) |
| 12 | 유지보수성 | controller `previewTest` 의 `// m-1:` 인라인 주석 — 내부 작업 태그 참조가 코드베이스 외부에서 의미 불명 | `integrations.controller.ts` L239-240 | 선택적으로 작업 태그 제거 후 의도 중심 문구로 대체 |
| 13 | 유지보수성 | `create()` 와 `previewTest()` 테스트 assertion 스타일 불일치 (`toThrow` vs `toMatchObject`) | `integrations.service.spec.ts` | 동일 guard 공유이므로 assertion 패턴 통일 권고 |
| 14 | 범위/스타일 | `previewTest` 의 불필요한 `async` 추가 — `validateServiceAuthType` 이 동기이므로 필수 아님, 외부 계약은 유지됨 | `integrations.service.ts` diff +1172 | 현행 허용 (버그 없음). 엄격한 일관성 원할 시 `async` 제거 또는 `return await` 패턴 채택 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 에러 메시지 입력값 반영(로그 포이즈닝 잠재), credentials 크기 제한 부재 — throttle 완화, 즉각 위험 없음 |
| architecture | NONE | 레이어 정렬 완료, SOLID 원칙 충족, oauthBegin M-2 백로그 잔존(기존 기술부채) |
| requirement | NONE | 기능 완전성 충족, spec drift 2건 pre-existing + plan 추적 중, 코드 수정 불요 |
| scope | NONE | 4개 파일 모두 m-1 목적에 직결된 변경만, 불필요한 async 추가는 비차단 |
| side_effect | NONE | 의도치 않은 부작용 전무, 검증 시점 이동은 동작 동등성 보존 |
| maintainability | NONE | 네이밍 개선, JSDoc 추가, 중복 제거 — 전반적으로 개선 방향 |
| testing | LOW | 서비스 단위 테스트 충분, controller 단위 테스트 부재 및 create() 경계 케이스 비대칭 |
| documentation | LOW | validateServiceAuthType JSDoc @param/@throws 누락, previewTest 메서드 JSDoc 부재 |

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항을 보고했으나 모두 INFO 수준)

## 권장 조치사항

1. (문서화) `validateServiceAuthType` JSDoc 에 `@param serviceType`, `@param authType`, `@throws {BadRequestException}` 표준 태그 추가 — IDE 계약 가시성 향상 (항목 10)
2. (문서화) `previewTest` 서비스 메서드에 "저장 없이 구조적 유효성 검증 + INTEGRATION_INVALID_SERVICE 400" 한 줄 JSDoc 추가 (항목 11)
3. (테스팅) `create()` 테스트에 "valid serviceType + unsupported authType" 경계 케이스 추가해 `previewTest` 대칭 맞추기 (항목 7)
4. (테스팅) `create()` assertion 을 `toMatchObject({ response: { code: 'INTEGRATION_INVALID_SERVICE' } })` 패턴으로 통일 (항목 9)
5. (보안) DTO 레벨 `@MaxLength(64)` + `@Matches(/^[a-z0-9_]+$/)` 추가 또는 글로벌 bodyParser limit 설정 확인 (항목 1, 2) — 방어 심층화 차원
6. (SPEC-DRIFT) spec §9.2 `service` → `serviceType` 필드명 수정, §9.4 에러 코드 표 추가 — project-planner 위임 (항목 3, 4)
7. (유지보수성) controller `m-1:` 주석 의도 중심으로 리워딩 (선택사항, 항목 12)
8. (아키텍처) M-2 백로그 (`oauthBegin` providerMeta 이관) — 별도 작업으로 진행 (항목 5)

## 라우터 결정

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 모두 router_safety 강제 포함)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |