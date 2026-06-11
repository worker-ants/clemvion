# Code Review 통합 보고서

## 전체 위험도
**LOW** — 전체 변경은 `kind` 쿼리 파라미터 HTTP 400 회귀 버그 수정과 그에 따른 테스트 보완으로 범위가 명확하다. Critical 발견사항 없음. WARNING 1건(previewModels @Roles 메타데이터 테스트 누락)과 다수의 INFO 수준 개선 제안이 있으나 운영 리스크는 낮다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `previewModels` 핸들러의 `@Roles('editor')` 메타데이터 검증이 `@Roles decorator presence` describe 블록에서 누락. `create`/`update`/`remove`는 검증하나 `previewModels`(controller.ts L163)와 `setDefault`는 포함되지 않아 향후 데코레이터 삭제 시 회귀 탐지 불가 | `model-config.controller.spec.ts` — `@Roles decorator presence` describe | `@Roles decorator presence` 블록에 `previewModels` 및 `setDefault` 메타데이터 확인 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `defaultParams` 필드에 JSON 깊이/크기 제한 없음. `@IsObject()` 만 있고 중첩 깊이·키 수·총 크기 제한이 없어 OWASP API06 (Unrestricted Resource Consumption) 잠재 위험 | `create-model-config.dto.ts` L92–99, `update-model-config.dto.ts` L59–64 | 커스텀 데코레이터 또는 인터셉터로 JSON 직렬화 후 바이트 크기(예: 64KB 이하) 제한 적용 |
| 2 | Security | `baseUrl` 에 `@IsUrl()` 검증 없음 — `@IsString()` + `@MaxLength(500)` 만 있고 URL 형식 강제 없음. `ssrf.util.ts`의 `isPrivateHost`는 파싱 실패 시 `false` 반환하므로 비정상 URL이 서비스까지 통과 가능 | `create-model-config.dto.ts` L71–79, `update-model-config.dto.ts` L42–48 | `@IsUrl({ protocols: ['http', 'https'], require_tld: true })` 를 DTO에 추가해 최우선 방어선 확보 |
| 3 | Security | DNS rebinding 한계 — `assertBaseUrlNotSsrf`는 저장 시점 1회 검사만 수행, TTL 경과 후 A 레코드 변경에 의한 SSRF 가능성 존재. 코드 주석에 이미 명시됨 | `ssrf.util.ts` L72–78 | 운영 환경 egress 방화벽/네트워크 정책 보완 여부 인프라 측 확인 |
| 4 | Security | `maskApiKey` 복호화 실패 시 silent catch — 에러 로그 없이 `****` 반환. 암호화 키 로테이션·DB 손상 등 이상 탐지 불가 | `model-config.service.ts` L354–359 | `catch` 블록에 `logger.warn` 추가 |
| 5 | Security | `encryptionKey` 빈 문자열 허용 — 키 없을 경우 빈 문자열로 초기화되어 크립토 레이어 오류 지연 발생 가능. PR #539 fail-closed 가드와 중복 여부 확인 필요 | `model-config.service.ts` L33–34 | 생성자에서 `if (!this.encryptionKey) { throw new Error(...) }` early validation 추가 (PR #539 가드와 중복 여부 선확인) |
| 6 | Security | `previewModels` 엔드포인트에서 `workspaceId` 감사 로그 없음. throttle(10 req/min) 적용으로 완화되나 editor가 타 워크스페이스 키를 검증용으로 사용하는 것을 막을 수단 없음 | `model-config.controller.ts` L162–179 | `LlmPreviewService` 내부에서 요청 메타데이터(workspaceId, userId)를 감사 로그로 기록 고려 |
| 7 | Testing | `update` 핸들러에 service 실패 시 `clearClientCache` 미호출 방어 케이스 없음. `remove`에는 동일 케이스 존재(spec.ts L244–248) | `model-config.controller.spec.ts` `describe('update')` | `mockModelConfigService.update.mockRejectedValue(...)` → `clearClientCache` 미호출 케이스 추가 |
| 8 | Testing | `ListModelConfigsQueryDto` 파이프 테스트에서 `limit` 기본값(20) 미검증. `page` 기본값(1)은 검증함 | `spec.ts` L162–168 | 기존 'defaults page to 1' 픽스처에 `expect(result.limit).toBe(20)` 추가 |
| 9 | Testing | `PaginationQueryDto.sort`의 `@Matches` SQL 인젝션 방어 패턴 경계값 테스트 없음 | `ListModelConfigsQueryDto whitelist` describe | `{ sort: 'created_at; drop' }` → 거부, `{ sort: 'created_at' }` → 통과 케이스 추가 |
| 10 | Testing | `findOne` / `setDefault` / `testConnection` / `listModels` 핸들러 테스트 부재. 이번 변경 범위와 직접 관련 없으나 커버리지 공백 | `model-config.controller.spec.ts` 전반 | 최소한 `setDefault`의 `@Roles('editor')` 메타데이터, `listModels`의 `type` 쿼리 전달 확인 테스트 추가 고려 |
| 11 | Testing | `testConnection` — `llmService.testConnection(id, workspaceId)` 인자 검증 테스트 없음 | `controller.ts` L193–197 | `testConnection` describe 추가, workspaceId 포함 호출 인자 검증 |
| 12 | Side Effect | `modelConfigsApi.list` limit 9999 → 100 변경. 워크스페이스당 100개 초과 시 silent truncation 발생 가능 (현 규모에서는 실질 영향 없음) | `codebase/frontend/src/lib/api/model-configs.ts` L78 | 장기적으로 cursor/전체 페이지 순회 방식 전환 또는 서버 측 kind별 설정 수 제한 규칙 명시 |
| 13 | Maintainability | `WARNING#1 fix` / `WARNING#2 fix` / `WARNING#3 fix` 리뷰 내부 레퍼런스 주석이 영구 코드 주석으로 남아 컨텍스트 없이 떠있는 참조가 됨 | `model-config.controller.spec.ts` L133, L161, L171, L180, L187 | 이슈 참조 대신 의도 서술 주석으로 교체. 예: `// page omitted → defaults to 1 (PaginationQueryDto default)` |
| 14 | Maintainability | 파일 상단 주석 "expose the module-private parseKind function"이 실제 동작(findAll 경유 간접 접근)과 불일치 | `model-config.controller.spec.ts` L35–37 | `// parseKind is tested indirectly via controller.findAll — it is a module-scope function not exported directly.`로 교정 |
| 15 | Maintainability | 픽스처 ID(`'ws-1'`, `'cfg-1'`, `'cfg-2'`, `'id-x'`) 매직 스트링이 여러 `it()` 블록에 분산 반복 | `model-config.controller.spec.ts` L82, L97, L107, L117, L213, L226, L235 | `describe` 블록 상단 `const WS_ID = 'ws-1'` 등 상수로 추출 |
| 16 | Requirement | `setDefault`, `previewModels`에 대한 `@Roles` 메타데이터 테스트 부재. 이번 변경 scope 외이나 갭으로 기록 | `model-config.controller.spec.ts` | 후속 task에서 두 메서드의 Roles 메타데이터 테스트 추가 고려 |
| 17 | Requirement | `listModels` endpoint (`GET /api/model-configs/:id/models?type=chat|embedding`) 단위 테스트 부재 | `model-config.controller.spec.ts` | INFO 수준으로 후속 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | INFO 6건 — SSRF DTO 레이어 강화, defaultParams 크기 제한, maskApiKey 로그 누락 등. Critical/Warning 없음 |
| requirement | NONE | 변경 의도와 구현 일치. spec 불일치 없음. INFO 2건(미테스트 핸들러 갭) |
| scope | NONE | 변경 범위 적절. 무관한 파일/리팩토링 없음 |
| side_effect | LOW | INFO 5건 — limit 9999→100 silent truncation 잠재 위험이 유일한 미래 위험. 계약 파손 없음 |
| maintainability | LOW | INFO 5건 — WARNING#N 주석, 매직 스트링, 상단 주석 오해 소지. 구조는 양호 |
| testing | LOW | WARNING 1건(previewModels @Roles 누락) + INFO 6건(핸들러 미테스트, limit 기본값, sort 경계값 등) |

## 발견 없는 에이전트

- **scope**: 변경 범위 내 모든 파일이 의도된 수정만 포함. 무관한 변경 없음.
- **requirement**: spec 불일치 없음 (INFO 수준 미테스트 갭만 기록).

## 권장 조치사항

1. **(WARNING 해소)** `@Roles decorator presence` describe 블록에 `previewModels`와 `setDefault` 메타데이터 검증 케이스 추가 — 향후 데코레이터 삭제 회귀 탐지 보장.
2. `update` describe에 service 실패 시 `clearClientCache` 미호출 케이스 추가 (`remove`와 대칭).
3. `baseUrl` DTO에 `@IsUrl({ protocols: ['http', 'https'], require_tld: true })` 추가 — SSRF 방어 최우선 레이어 강화.
4. `maskApiKey` catch 블록에 `logger.warn` 추가 — 복호화 실패 운영 모니터링.
5. `WARNING#N fix` 내부 레퍼런스 주석을 의도 서술 주석으로 교체.
6. 픽스처 ID 상수 추출 (`WS_ID`, `CFG_ID` 등).
7. (장기) `modelConfigsApi.list`의 limit 100 한계를 cursor 기반 페이지네이션으로 전환 또는 서버 측 설정 수 제한 명시.
8. (장기) `defaultParams` 크기 제한 커스텀 데코레이터 구현.

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행(강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명, 전원 router_safety 강제 포함)
- **제외**: 8명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 테스트-only 변경 + DTO 조합으로 성능 리스크 낮음 |
| architecture | 신규 아키텍처 패턴 도입 없음 |
| documentation | 문서 변경 없음 |
| dependency | 새 외부 의존성 없음 |
| database | DB 스키마/마이그레이션 변경 없음 |
| concurrency | 동시성 패턴 변경 없음 |
| api_contract | API 계약 파괴적 변경 없음 |
| user_guide_sync | 사용자 가이드 관련 변경 없음 |

- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 목록과 동일)