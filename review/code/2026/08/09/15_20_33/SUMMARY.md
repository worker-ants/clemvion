# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(비기능적 테스트 패턴 자기모순). 강제(forced) reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/Maintainability | 신규 `roles.guard.spec.ts`의 `expectValidationError` 헬퍼가 **같은 커밋(`d40f75fbd`)**이 다른 두 파일(`workspace-context.util.spec.ts`, `workspace.decorator.spec.ts`)에서 "첫 단언 실패 시 두 번째가 조용히 건너뛰어진다"는 근거로 명시적으로 기각·정정("캡처-재던지기" 단일 호출로 통일)한 "이중 호출 assert" 패턴을 그대로 재도입함 — `canActivate(ctx)`를 서로 다른 `buildGuard('owner')` 인스턴스로 두 번 호출(1회는 `toThrow` 용, 1회는 `getResponse()` 캡처용). `canActivate`가 순수 동기 판정이라 실제 flake/정확성 위험은 낮음(74/74 PASS 확인)이나, 같은 PR이 방금 세운 표준을 세 번째 파일에서 근거 없이 어겨 "이 저장소의 표준이 무엇인가"를 다음 리더가 혼동하게 만든다. requirement·maintainability reviewer는 이를 WARNING으로, testing·documentation reviewer는 INFO로 각각 판정 — 더 높은 심각도로 통합. | `codebase/backend/src/common/guards/roles.guard.spec.ts:358-371` (`expectValidationError`) | `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts`와 동일한 캡처-재던지기 단일 호출 패턴(`try { await guard.canActivate(ctx) } catch (err) { caught = err; throw err; }`)으로 통일. guard 인스턴스 1개·호출 1회로 축소 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/Side Effect | 부팅 fail-closed 계약이 Node `unhandledRejection` 기본 동작(≥15, 처리 안 된 rejection 시 프로세스 종료)에 암묵 의존 — `main.ts`에 `.catch()`/`unhandledRejection` 핸들러 없음(`grep` 0건). 향후 관측성 목적으로 `void bootstrap()`을 `bootstrap().catch(logger.error)` 형태로 바꾸면 `process.exit(1)` 없이 로그만 남고 fail-closed 보장이 조용히 무력화될 수 있음 | `codebase/backend/src/main.ts:239`(`void bootstrap();`), `:168`(`assertWorkspaceIdReflectionWorks` 호출부) | `bootstrap().catch((err) => { logger.error(err); process.exit(1); });` 형태로 명시적 종료 강제하거나, 위임 관계를 캐너리 주석에 한 줄 추가 |
| 2 | Architecture/Side Effect | `resolveRequestWorkspaceContext`가 "순수 계산"에서 "계산 + HTTP 프로토콜 검증(`BadRequestException` throw)"으로 책임 확장 — `common/utils/` 계층 헬퍼가 NestJS 예외 타입을 직접 앎. JSDoc이 "소비처 2곳의 drift 방지"라는 근거를 명시했고 `extractWorkspaceId`도 동일 패턴이라 저장소 관례와 일관 | `codebase/backend/src/common/utils/workspace-context.util.ts:69-79` | 검증 규칙이 늘어나면 "컨텍스트 리졸버"와 "요청 검증기" 책임 분리 재고. 여유 있으면 JSDoc에 `@throws {BadRequestException}` 추가 |
| 3 | Architecture | 부팅 시 구조 불변식 검사 모듈(`workspace-reflection-canary.ts`)이 `common/decorators/` 아래 위치 — `common/config/production-guards.ts`와 개념적으로 같은 층위인데 물리적으로 다른 디렉터리. `handlerConsumesWorkspaceId` 재사용 위한 인접 배치라 근거는 있음 | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (파일 전체) | `common/config/` 또는 신설 `common/bootstrap/`으로 이동, `decorators/`에는 re-export만 고려 |
| 4 | Architecture | `countWorkspaceIdConsumingRoutes`가 판별 술어 `handlerConsumesWorkspaceId`를 하드 import — 두 번째 유사 소비처가 생기면 파일 전체 복제 필요(OCP) | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:66-84` | 현재는 YAGNI로 수용 가능. 두 번째 소비처 생기면 `predicate` 주입 형태로 일반화 |
| 5 | Architecture | 캐너리는 reflection 메커니즘의 구조적 취약성(비공개 `ROUTE_ARGS_METADATA` + 함수-identity 비교)을 제거하지 않고 감시(circuit-breaker)만 추가 — 근본 원인은 그대로. 대안(`SetMetadata`+`Reflector`)은 저장소가 이미 2회 실패한 패턴이라는 근거로 명시적으로 기각됨(의도된 트레이드오프) | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:8-42` (모듈 상단 JSDoc) | 조치 불요 — 이미 문서화된 의도. `@nestjs/*` 업그레이드 시 최우선 조사 대상으로 CHANGELOG에 기록됨 |
| 6 | Security | 부분 reflection 파손(일부 라우트만 인식 실패)은 캐너리가 탐지 못함 — "인식 라우트 수 == 0"인 전면 파손만 fail-closed로 잡음. 저자가 코드 주석·plan 체크리스트에 이미 명시한 알려진 한계 | `workspace-reflection-canary.ts` 내 주석, `plan/in-progress/auth-guard-reflection-hardening.md` | 조치 불요(기존 문서화된 트레이드오프) |
| 7 | Security | `WorkspaceIdReflectionBrokenError` 메시지가 비공개 API 이름·파일 경로 등 내부 구현 세부를 담음 — 현재는 `app.listen()` 이전에만 throw되어 HTTP 응답 경로 도달 불가(확인 완료), 향후 런타임 경로(예: health-check)에서 재사용 시 재검토 필요 | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (`WorkspaceIdReflectionBrokenError` 생성자) | 재사용 시 메시지 상세도 재검토 |
| 8 | API Contract/Side Effect | malformed `X-Workspace-Id` 헤더에 대해 마스킹된 500(SQLSTATE 22P02) → 정확한 400 `VALIDATION_ERROR`로 전환 — 클라이언트 관측 가능한 응답 계약 변경이지만 정상 클라이언트에는 영향 없고 CHANGELOG·spec에 이미 등재된 표준 코드 | `codebase/backend/src/common/utils/workspace-context.util.ts:74-79` | 조치 불요 — 이미 문서화·리뷰됨 |
| 9 | API Contract | 헤더가 없고 토큰 클레임(JWT)만 malformed인 극단 케이스는 검증 안 함 — 동일 500-마스킹 결함이 비대칭적으로 잔존. "서버가 서명한 값이므로 클라이언트 오류로 보고하면 부정확"이라는 근거로 의도적 설계 | `codebase/backend/src/common/utils/workspace-context.util.ts:62-64` | 조치 불요. 운영 로그에서 실제 관측되면 별도 후속 |
| 10 | API Contract | 신규 가드-레벨 400 응답이 Swagger(`@ApiBadRequestResponse`) 문서에 미반영 — cross-cutting 가드 동작이라 per-endpoint 데코레이터로 원래도 안 잡히던 영역, 이번 PR이 새로 만든 갭 아님 | `common/guards/roles.guard.ts`(전역 `APP_GUARD`), `spec/conventions/swagger.md` §2-4 | 향후 Swagger 정리 라운드에서 cross-cutting 관행으로 명문화 검토 |
| 11 | API Contract | 부팅 캐너리 fail-closed가 오탐(false positive)이면 전체 API 표면이 배포 시점에 통째로 불가용 — 개별 API 계약 위반이 아니라 가용성/배포 리스크, 이미 문서화·수용된 트레이드오프 | `codebase/backend/src/main.ts:168`, `workspace-reflection-canary.ts:91-116` | 조치 불요(참고용) |
| 12 | Maintainability | 워크스페이스 UUID 픽스처 상수가 3개 spec 파일에 사실상 동일 값으로 중복 선언 — 이전 라운드에서 "다음 관련 PR에서 공용 fixture로 승격"하기로 이미 후속 계획에 등재됨 | `workspace.decorator.spec.ts:28-30`, `roles.guard.spec.ts:13-18`, `workspace-context.util.spec.ts:12-14` | 조치 불요(이미 backlog 등재). 공용화 시 함께 정리 |
| 13 | Maintainability | `roles.guard.spec.ts` 픽스처 네이밍 일관성 결여(`WS1`만 숫자 접미사, 나머지는 `_WS` 접미사) | `codebase/backend/src/common/guards/roles.guard.spec.ts:13-18` | 위 fixture 공용화 시 함께 정리(강제 아님) |
| 14 | Testing | `assertWorkspaceIdReflectionWorks`를 부팅 시퀀스의 올바른 지점(app 생성 직후, body-parser 등록 이전)에서 호출하는지 직접 검증하는 단위/통합 테스트 없음 — e2e 전체 통과에 간접 의존. 이전 라운드에서 이미 인지·plan에 기록된 한계 | `codebase/backend/src/main.ts` (`bootstrap`, export 안 됨) | 조치 필수 아님. 여유 있으면 `bootstrap` export 또는 배선 부분 별도 함수 추출해 화이트박스 테스트 추가 |
| 15 | Testing | `assertWorkspaceIdReflectionWorks`의 기본 파라미터 로거(`new Logger(...)`)로 성공 경로를 실제로 거치는 테스트 없음 — 성공 케이스는 항상 커스텀 로거 주입, 실패(throw) 경로만 기본 로거 인스턴스화만 검증 | `workspace-reflection-canary.spec.ts` | 조치 불요에 가까움. 필요시 기본 파라미터로 성공 케이스 1건 추가 |
| 16 | Documentation | 부팅 캐너리가 배포 문서(`README.md` "배포 주의" 섹션)에 아직 반영 안 됨 — 단, RESOLUTION.md·plan `## 후속(이 PR 밖)` 체크리스트에 근거와 함께 명시적으로 추적됨(회귀 아님) | `codebase/backend/README.md:37-42`, `plan/in-progress/auth-guard-reflection-hardening.md` | 조치 불요(이미 추적됨). 집행 시 "환경 무관 구조 불변식"이라는 이질적 성격 표기 방식 결정 필요 |
| 17 | Documentation/Requirement | `spec/5-system/3-error-handling.md §1.3` 에러 카탈로그에 신규 400 분기 미등재, `1-auth.md §2.1` 가시성 정합에 대한 명시적 결정이 plan에 한 줄로 안 남음 — 두 항목 모두 이전 두 consistency-check 라운드(`--impl-prep`, `--impl-done`, 둘 다 BLOCK:NO)가 이미 WARNING으로 등재하고 planner-턴 대기로 기록됨 | `spec/5-system/3-error-handling.md §1.3`, `spec/5-system/1-auth.md §2.1` | 재차 지적 불요. planner 턴에서 처리 예정 |
| 18 | Scope | 타 worktree(`auth-workspace-membership-guard-2b94db`) 소유 plan 파일(`spec-draft-workspace-header-membership-invariant.md`)의 `complete/` 이동이 이번 PR에 포함 — 1차 리뷰가 WARNING으로 지적한 것을 이번 라운드에서 `git worktree list` + `#1103` 머지 확인 근거와 함께 오버라이드 사유를 명문화함. 단 이동된 파일의 frontmatter `status:`가 여전히 `in-progress`로 남아 있어 정리가 다소 서두른 흔적 | `plan/in-progress/auth-guard-reflection-hardening.md:149-165`, `plan/complete/spec-draft-workspace-header-membership-invariant.md:6` | 조치 불요(근거 기록 완료). `status:` 필드를 `complete`로 맞추는 사소한 개선 여지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이전 라운드가 지적한 2대 보안 리스크(reflection fail-open, 500 마스킹)가 부트타임 fail-closed 캐너리·UUID 형식 검증으로 정확히 닫힘 확인. 신규 CRITICAL/WARNING 없음, INFO 3건(boot 암묵 의존·에러 메시지 상세도·부분 파손 미탐지) |
| architecture | LOW | 순환 의존 없음, 프레임워크 결합 최소화(주입형 `methodNamesOf`) 확인. INFO 4건(util 책임 확장·모듈 배치·OCP·감시 vs 근본해결 성격 규정) |
| requirement | LOW | plan W1/W3/W4 요구사항과 코드·테스트 line-level 일치, 74/74 PASS 재실행 확인. WARNING 1건(이중 호출 assert 자기모순), INFO 2건(이미 추적 중인 재확인) |
| scope | LOW | 1차 리뷰 WARNING 6건이 정확히 그 범위 안에서만 수정됨, 신규 무관 변경 없음. INFO 2건(타 worktree plan 이동 근거 보강·신규 파일 추적성) |
| side_effect | LOW | 전역 상태·env·네트워크·파일시스템 부작용 없음. INFO 5건(부팅 정지점·DiscoveryModule 등록·계약 확장·응답코드 전환·CLI 우회 경로, 전부 이전 라운드 재확인) |
| maintainability | LOW | 이전 WARNING 6건 중 W1-W3/W5/W6 정상 반영 확인. WARNING 1건(이중 호출 assert 재도입), INFO 2건(픽스처 중복·네이밍, 이미 backlog 등재) |
| testing | LOW | 5 suites/74 tests 전부 GREEN, 직전 라운드 W5/W6(가드 레벨 테스트·vacuous 테스트) 실제 반영 확인. INFO 3건(이중 호출 헬퍼·main.ts 배선 테스트 부재·로거 성공경로 미검증) |
| documentation | LOW | 직전 WARNING(CHANGELOG stale 링크) 정확히 수정 확인, 신규 주석 정확성 검증 완료. INFO 3건(이중 호출 패턴 문서 불일치·README 미반영(추적됨)·spec §2.1 결정 미명문화) |
| api_contract | LOW | 유일한 표면 변경(500→400)이 기존 에러 봉투·표준 코드와 완전 정합, breaking 아님. 가드 레벨 400 전파 테스트 신규 확인(긍정). INFO 5건(응답코드 전환·토큰클레임 비대칭·Swagger 미반영·캐너리 가용성 리스크 등) |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 1건 이상 보고).

## 권장 조치사항

1. `roles.guard.spec.ts`의 `expectValidationError` 헬퍼를 `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts`와 동일한 캡처-재던지기 단일 호출 패턴으로 통일한다 (WARNING #1) — 같은 PR·같은 커밋 내 테스트 컨벤션 자기모순 해소.
2. (선택, 저비용) `main.ts`의 `void bootstrap();`를 `bootstrap().catch((err) => { logger.error(err); process.exit(1); });` 형태로 바꿔 fail-closed 보장을 Node 기본 동작이 아닌 코드로 명시한다 (INFO #1).
3. 나머지 INFO 항목은 대부분 이전 라운드에서 이미 검토·수용되었거나 plan/backlog에 명시적으로 추적 중인 저위험 사항으로, 이번 PR 범위에서 즉시 조치가 필수는 아니다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보 확인됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(부팅 캐너리·헤더 검증)과 무관한 영역으로 제외 |
  | dependency | 신규 의존성 추가 없음(NestJS 내장 `DiscoveryModule`만 사용) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 변경 없음(부팅 시 1회 실행 로직) |
  | user_guide_sync | 사용자 대상 가이드 문서 변경 없음 |

(참고: 위 SUMMARY.md 는 basename 차단 정책으로 디스크 Write 가 차단됨 — 호출자가 이 전문을 `/Volumes/project/private/clemvion/.claude/worktrees/auth-guard-reflection-hardening-9c31f2/review/code/2026/08/09/15_20_33/SUMMARY.md` 에 멱등 기록해야 함. 개별 reviewer 결과 파일 9개는 모두 이미 디스크에 존재함을 확인했으므로 별도 영속화 조치 불요.)