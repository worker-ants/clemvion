# Code Review 통합 보고서

## 전체 위험도
**LOW** — AuthConfig CRUD audit 기록 추가 작업. 보안·기능·문서화 모두 양호하며 Critical 발견 없음. 주요 WARNING 은 Swagger 설명 오류 2건 및 테스트 엣지 케이스 누락 1건.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API Contract | `remove`/`create`/`update` 핸들러의 `@ApiForbiddenResponse` 설명이 `'Editor 미만 권한'`으로 기술되어 있으나 `@Roles('admin')` 보호 — 실제 경계는 "Admin 미만"이어야 함 | `auth-configs.controller.ts` 라인 224 및 remove 핸들러 | `@ApiForbiddenResponse` description 을 `'Admin 미만 권한'`으로 통일 |
| 2 | Testing | `ipAddress=undefined` 케이스(신뢰 프록시 미설정 시 `req.ip → undefined`)에 대한 audit 기록 동작 테스트 없음 — DB NULL 허용 여부에 대한 암묵적 가정 미검증 | `auth-configs.service.spec.ts` — CRUD audit 기록 describe 블록 | `create` 등 최소 1개 CRUD 케이스에 `ipAddress=undefined` 로 `record()` 호출 검증 케이스 추가 |
| 3 | Documentation | `update`/`regenerate`/`remove` 메서드 JSDoc 에 `@param userId`, `@param ipAddress` 태그 미기재 — `create` 와 달리 파라미터 설명 없어 TypeDoc 자동 문서화 시 누락 | `auth-configs.service.ts` 라인 1688, 1710, 1742 | `@param userId - {@link create} 참조` 형식으로 추가하거나 현행 `{@link create}` 단행 유지 결정 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `req.ip` 직접 사용 — spec §2.3 IP 추출 정책(CF-Connecting-IP → X-Forwarded-For → req.ip)과 불일치. 포렌식 정확도 저하 가능 | `auth-configs.controller.ts` — create/update/regenerate/remove 핸들러 | spec §2.3 IP 추출 정책을 공통 헬퍼로 추출해 audit ipAddress 기록에 일관 적용 |
| 2 | Security | `ipAddress` optional(`?`) — 내부 호출 시 audit IP 누락 가능 | `auth-configs.service.ts` — 메서드 시그니처 전체 | 내부 호출 경로 없으면 낮은 위험. 운영 경로 항상 IP 제공하도록 주석/문서 보완 |
| 3 | Security | `basic_auth` password 평문 DB 저장 — 설계 의도이나 spec/문서에 at-rest 암호화 적용 여부 미명시 | `auth-configs.service.ts` create, `verifyBasicAuth` | spec §2.17 또는 파일 주석에 "수신 검증용, ENCRYPTION_KEY at-rest 암호화 적용" 명시 |
| 4 | Security | `constantTimeEquals` 길이 불일치 시 즉시 `false` 반환 — 길이 자체 timing leak 가능(고정 길이 토큰이므로 실용 위협 낮음) | `auth-configs.service.ts` `constantTimeEquals` (라인 1977–1980) | 위협도 낮음. 현재 고정 길이 토큰 맥락에서 수용 가능 |
| 5 | Security | `Object.assign(config, data)` — DTO 검증 우회 시 민감 필드 덮어쓰기 가능성 | `auth-configs.service.ts` `update` (라인 1696–1697) | DTO 가 충분히 제한적이면 낮은 위험. destructuring/pick 기반 화이트리스트 방식이 더 안전 |
| 6 | Security | `reveal` 엔드포인트 rate limiting 미적용 (기존 인지 항목, plan §4 추적 중) | `auth-configs.controller.ts` (라인 343–376) | `@Throttle` 데코레이터 또는 전역 Throttler 적용 (plan §4 에서 추적 중) |
| 7 | Testing | `regenerate` audit 테스트에 `workspaceId` 검증 누락 (`create`/`update`/`remove` 는 포함) | `auth-configs.service.spec.ts` `'regenerate → auth_config.regenerate 기록'` | `expect.objectContaining` 에 `workspaceId: WS` 추가 |
| 8 | Testing | 컨트롤러 스펙에 `userId`/`req.ip` 서비스 전파 검증 없음 | `auth-configs.controller.spec.ts` | 서비스 mock 주입 후 create/update/regenerate/remove 각 핸들러가 서비스에 userId/ipAddress 를 올바른 위치 인자로 전달하는지 검증 추가 |
| 9 | Testing | `reveal` 성공 케이스에서 `ipAddress` 필드 미검증 (CRUD 4개는 검증) | `auth-configs.service.spec.ts` 라인 1366–1374 | `expect.objectContaining` 에 `ipAddress: '1.2.3.4'` 추가 |
| 10 | Testing | `reveal` 실패 케이스(`passwordHash 없음`)에 `audit.record.mockClear()` 및 음성 단언 누락 | `auth-configs.service.spec.ts` 라인 1398–1410 | `mockClear()` 후 `expect(audit.record).not.toHaveBeenCalled()` 검증 추가 |
| 11 | Requirement | `basic_auth` 타입 대상 `regenerate` 시 실제 자격증명 교체 없이 audit 로그만 기록됨 — spec 에 동작 미정의 | `auth-configs.service.ts` `regenerate` (라인 1721–1728) | `basic_auth` 에 `BadRequestException` 추가 또는 spec 에 허용 여부 명시 |
| 12 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/1-audit.md §1.1` "4개 모듈 9개 call site" 표현이 구식 — 본 PR 로 auth_config.* 5종 추가되어 13개로 증가 | `spec/data-flow/1-audit.md §1.1` | 코드는 옳음. spec 수치 갱신 필요 (project-planner 영역) |
| 13 | Maintainability | `audit-action.const.ts` 동사 시제 혼재 — `INTEGRATION_*` 과거분사, `AUTH_CONFIG_*` 현재형, `WORKSPACE_TRANSFER_OWNERSHIP` 복합명사. 신규 도메인 추가 시 판단 근거 불충분 | `audit-action.const.ts` 전체 | 주석에 도메인별 시제 기준 나열 또는 `WORKSPACE_TRANSFER_OWNERSHIP` 패턴 근거 보충 |
| 14 | Maintainability | `'auth_config'` 문자열 리터럴이 4개 메서드에 하드코딩 — 향후 변경 시 4곳 수정 필요 | `auth-configs.service.ts` create/update/regenerate/remove 각 `record()` 호출 | `const RESOURCE_TYPE = 'auth_config' as const` 선언 후 참조하거나 private 헬퍼 메서드 추출 |
| 15 | Maintainability | `crypto` namespace import + named import 이중 사용 | `auth-configs.service.ts` 라인 8–9 | 하나로 통일 (`crypto.randomBytes` 또는 `import { randomBytes }`) |
| 16 | Maintainability | 테스트 파일에 `USER = 'user-1'`(최상단) 와 `userId = 'user-1'`(`reveal` 스코프) 중복 선언 | `auth-configs.service.spec.ts` 라인 809, 705 | `reveal` 블록 내 `userId` 제거 후 상위 스코프 `USER` 참조로 통일 |
| 17 | Maintainability | `getUsage` 내 매직 넘버 `20` 하드코딩 | `auth-configs.service.ts` 라인 498 | `const RECENT_CALLS_LIMIT = 20` 상수 선언 또는 Swagger 설명과의 연계 주석 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `req.ip` spec §2.3 불일치(포렌식), `ipAddress` optional, `Object.assign` 필드 제한, rate limit 미적용(기존 인지) — 전부 INFO |
| requirement | LOW | Swagger `@ApiForbiddenResponse` Admin/Editor 불일치(WARNING), `regenerate` `workspaceId` 테스트 누락(INFO), `basic_auth` regenerate 무동작-but-audit(INFO), SPEC-DRIFT: call site 수 미갱신 |
| scope | NONE | 변경 파일 모두 단일 목적(CRUD audit 추가) 집중, 이탈 없음 |
| side_effect | LOW | 시그니처 변경 호출자 범위 내 완결, best-effort audit 설계 의도 일치, `remove` 후 audit 순서 INFO |
| maintainability | LOW | 리터럴 4중 반복, `crypto` 이중 임포트, 테스트 `USER`/`userId` 중복, 매직 넘버 `20` — 전부 INFO |
| testing | LOW | `ipAddress=undefined` 케이스 미검증(WARNING), 컨트롤러 전파 검증 없음(INFO), `regenerate` `workspaceId` 누락(WARNING-중복), `reveal` `ipAddress`/`mockClear` 누락 |
| documentation | LOW | Swagger `@ApiForbiddenResponse` 오류(WARNING), `update`/`regenerate`/`remove` JSDoc `@param` 미기재(WARNING), 나머지 문서화 전반 양호 |

## 발견 없는 에이전트

- **scope**: 변경 범위 이탈 없음 (NONE 위험도)

## 권장 조치사항

1. **(WARNING 즉시 수정)** `remove`/`create`/`update` 핸들러의 `@ApiForbiddenResponse` description 을 `'Admin 미만 권한'`으로 수정 — Swagger 문서 오해 방지
2. **(WARNING 즉시 수정)** `ipAddress=undefined` 케이스 서비스 테스트 1건 추가 — DB NULL 허용 여부 명시적 검증
3. **(INFO 권장)** `regenerate` audit 테스트에 `workspaceId: WS` 추가 — 다른 CRUD 케이스와 일관성
4. **(INFO 권장)** `reveal` 성공 케이스 `ipAddress` 검증 및 `passwordHash 없음` 케이스 `mockClear`/음성 단언 추가
5. **(INFO 권장)** `crypto` 이중 임포트 정리, `USER`/`userId` 중복 상수 통합, `'auth_config'` 리터럴 상수화
6. **(SPEC-DRIFT 후속)** `spec/data-flow/1-audit.md §1.1` call site 수치 갱신 — project-planner 위임
7. **(INFO 검토)** `basic_auth` 타입 대상 `regenerate` 동작 spec 명시 또는 `BadRequestException` 추가

## 라우터 결정

라우터가 reviewer 를 선별하여 실행했습니다.

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 router_safety 강제 포함)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단에 의해 생략 |
| architecture | 라우터 판단에 의해 생략 |
| dependency | 라우터 판단에 의해 생략 |
| database | 라우터 판단에 의해 생략 |
| concurrency | 라우터 판단에 의해 생략 |
| api_contract | 라우터 판단에 의해 생략 |
| user_guide_sync | 라우터 판단에 의해 생략 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원)