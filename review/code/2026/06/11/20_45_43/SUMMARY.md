# Code Review 통합 보고서

## 전체 위험도
**LOW** — PR #541 회귀 2건(kind 파라미터 whitelist 400, limit 9999 초과 400)을 최소 범위로 정확히 수정. Critical 발견 없음. 테스트 커버리지 일부 갭(WARNING 3건) 존재하나 런타임 위험은 없음.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `pipe`·`metadata` 변수가 `describe` 블록 스코프 `const`로 선언 — 테스트 간 공유 상태 잠재 위험. 현재는 stateless라 실문제 없으나 향후 파이프 상태 추가 시 격리 깨질 수 있음 | `model-config.controller.spec.ts` L168–172 | `beforeEach` 또는 각 `it` 블록 내에서 새 인스턴스 생성으로 완전 격리 보장 |
| 2 | Testing | `pipe.transform` 결과 검증이 부분적 — `page` 기본값, `sort`/`order` 기본값, `kind: 123`(숫자) 거부, `kind: ''` 거부 케이스 미커버 | `model-config.controller.spec.ts` L174–181 | `page` 없이 전달 시 기본값 1 검증, `kind: 123` validation 실패 검증, `kind: ''` parseKind BadRequestException 검증 케이스 추가 |
| 3 | Testing | `kind=''`(빈 문자열) 엣지 케이스 미테스트 — `@IsString` 통과 후 `parseKind` 내 `!kind` falsy 분기로 BadRequestException을 던지는 경로가 명시적으로 검증되지 않음 | `model-config.controller.spec.ts` `findAll / parseKind` describe 블록 | `it('throws BadRequestException when kind is empty string', ...)` 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `ListModelConfigsQueryDto`의 `kind` 필드에 `@ApiPropertyOptional` 누락 — 의도적 설계(컨트롤러 `@ApiQuery` 단일 소스)이며 JSDoc으로 명시됨. 코드베이스 내 다른 Query DTO와 스타일 불일치 | `dto/list-model-configs-query.dto.ts` L51–53 | 현행 유지 가능. 관례 통일 시 `@ApiPropertyOptional` 추가 후 컨트롤러 `@ApiQuery` 제거 |
| 2 | Maintainability | `limit: 100` 하드코딩 — 백엔드 `@Max(100)` 상한과 암묵적 결합. 주석으로 근거 명시돼 있어 수용 가능한 수준 | `frontend/src/lib/api/model-configs.ts` L809 | 파일 수준 상수 `PAGINATION_MAX_LIMIT = 100` 추출 권장(선택) |
| 3 | Testing | 프론트엔드 `modelConfigsApi.list()` — `limit: 100` 직접 단위 테스트 없음. 컴포넌트 테스트는 모두 vi.mock으로 API를 대체해 실제 파라미터 값 검증 불가 | `frontend/src/lib/api/model-configs.ts` L809 | `apiClient.get`을 spy하여 `params.limit === 100` 확인하는 단위 테스트 추가 권장 |
| 4 | Testing | 백엔드 e2e 테스트 부재 — 전역 파이프 바인딩 상태의 HTTP 레벨 테스트가 없어 동일 유형 회귀가 반복될 수 있는 구조적 약점 | `codebase/backend/test/` | `test/model-configs.e2e-spec.ts` 신규 생성: `GET /model-configs?kind=chat` 200, `GET /model-configs` 400 최소 검증 |
| 5 | Requirement | `ListModelConfigsQueryDto` 전용 DTO 클래스·`forbidNonWhitelisted` 처리 방법은 spec 미명시 — spec 위반 아님, 구현 세부 사항 | `dto/list-model-configs-query.dto.ts` | 코드 유지. 향후 `spec/5-system/2-api-convention.md`에 전역 ValidationPipe DTO 패턴 일반 지침 추가 가능(필수 아님) |
| 6 | Requirement | `[SPEC-DRIFT]` 프론트엔드 `limit: 100` — `spec/5-system/2-api-convention.md §4.1` limit 최대 100 계약을 올바르게 준수하는 수정. spec drift 아닌 spec 준수 | `frontend/src/lib/api/model-configs.ts` L724 | 추가 조치 불필요 |
| 7 | API Contract | `kind` 검증 이중 레이어(DTO: `@IsString`, 컨트롤러: `parseKind` 의미 검증) — `MODEL_CONFIG_INVALID` 에러 코드 보존을 위한 의도적 설계. 명세 계약 유지 | `list-model-configs-query.dto.ts` L54–56, `model-config.controller.ts` L517–524 | 현행 유지 |
| 8 | Side Effect | `modelConfigService.findAll` 세 번째 인자 타입이 `PaginationQueryDto` → `ListModelConfigsQueryDto`(하위 타입)로 실질 확장 — 리스코프 치환 원칙 만족, 호환성 유지 | `model-config.controller.ts` L88, `model-config.service.ts` L40 | 이슈 없음 |
| 9 | Scope | 변경 4개 파일 모두 버그 수정 직접 범위 내. 관련 없는 리팩토링·기능 확장 없음 | 전체 diff | 현행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (출력 파일 없음) | — |
| requirement | NONE | spec 계약 완전 부합, spec drift 없음 |
| scope | NONE | 변경 범위 의도된 버그 수정 내 완전 부합 |
| side_effect | NONE | 공유 상태·전역 변경 없음, 타입 호환성 유지 |
| maintainability | NONE | INFO 4건(Swagger 스타일, 하드코딩 상수, parseKind 캡슐화) |
| testing | LOW | WARNING 3건(공유 상태 격리, 커버리지 갭, e2e 부재) |
| api_contract | NONE | 외부 HTTP 계약 breaking change 없음, 에러 코드 계약 유지 |

## 발견 없는 에이전트

security 에이전트는 출력 파일 미생성으로 결과 없음.

## 권장 조치사항

1. **(선택적 — WARNING 해소)** `model-config.controller.spec.ts` L168–172의 `pipe`·`metadata` 선언을 `beforeEach` 또는 각 `it` 블록으로 이동해 테스트 격리 완전 보장.
2. **(선택적 — WARNING 해소)** `kind=''` (빈 문자열) 엣지 케이스 테스트 추가 — `parseKind` falsy 분기 명시 검증.
3. **(선택적 — WARNING 해소)** `pipe.transform` 검증 케이스 보강 — `page` 기본값, `kind: 123` 타입 거부 케이스 추가.
4. **(중장기 — 구조 개선)** `test/model-configs.e2e-spec.ts` 신규 생성으로 전역 파이프 바인딩 상태 HTTP 레벨 회귀 방지.
5. **(중장기 — 유지보수)** `modelConfigsApi.list()` `limit` 값을 파일 수준 상수로 추출하거나, 단위 테스트로 값 고정.

## 라우터 결정

라우터가 선별 실행 (`routing=done`).

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `api_contract` (7명, 전체 router_safety forced)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단 생략 |
| architecture | 라우터 판단 생략 |
| documentation | 라우터 판단 생략 |
| dependency | 라우터 판단 생략 |
| database | 라우터 판단 생략 |
| concurrency | 라우터 판단 생략 |
| user_guide_sync | 라우터 판단 생략 |

- **강제 포함 (router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (6명)

---
_생성: 2026-06-11 20:45:43 · 실행 reviewer 7명 (security 출력 파일 미생성) · WARNING 3건 · CRITICAL 0건_
