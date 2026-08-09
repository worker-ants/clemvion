# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없다. 핵심 안전장치(부팅 캐너리, UUID 형식 400 검증)는 소스 대조·실제 테스트 실행(70/70 PASS)·타입체크·spec 대조로 정확히 구현됨을 확인했지만, 이번 PR 이 새로 연 400 throw 경로를 프로덕션에서 **가장 먼저** 통과하는 지점(`RolesGuard`, 전역 `APP_GUARD`)에 대응 테스트가 하나도 없고, 그 근처 기존 테스트 하나는 vacuous(early-return 과 검증-통과를 구분 못함)하다는 testing 리뷰의 지적이 이 등급을 끌어올렸다. 강제 화이트리스트(forced) 7개 reviewer 전원 결과 확보됨 — 라우터 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Documentation | `CHANGELOG.md` 의 plan 추적 링크가 이미 `plan/complete/` 로 이동된 경로(`plan/in-progress/auth-workspace-membership-guard.md`)를 그대로 가리킴. 이번 PR 이 같은 줄을 편집(두 번째 경로 추가)하면서도 옆의 stale 경로는 고치지 않고 전파. `spec-link-integrity` 가드는 `spec/**.md` 만 스캔해 CI 로도 안 잡힘 | `CHANGELOG.md:47` | `plan/in-progress/auth-workspace-membership-guard.md` → `plan/complete/auth-workspace-membership-guard.md` 로 정정 |
| 2 | Requirement | plan frontmatter `worktree` 필드가 `(unstarted)` placeholder 로 남아 있음. 본문 체크리스트는 전부 완료(`[x]`) 상태이고 실제로 `auth-guard-reflection-hardening-9c31f2` 워크트리에서 구현이 끝난 채 리뷰 중인데도 미착수로 표기 | `plan/in-progress/auth-guard-reflection-hardening.md:3` | `worktree: auth-guard-reflection-hardening-9c31f2` 로 갱신 |
| 3 | Scope | 이 작업(W1/W3/W4 guard reflection 경화)과 무관한 **다른 task 소유** plan 문서(`spec-draft-workspace-header-membership-invariant.md`, 소유 worktree `auth-workspace-membership-guard-2b94db`)를 `plan/complete/` 로 이동. 같은 PR 에 포함된 자체 `plan_coherence` consistency-check 가 "본 worktree 권한 밖이라 이동 수행하지 않음" 이라고 명시적으로 판정한 것과 반대로 실행됨. 자매 문서(`spec-fix-swagger-forbidden-response.md`)는 다른 사유로 이동 안 함 — 선택 근거 불일치. 오버라이드 사유 미기재 | `plan/in-progress/auth-guard-reflection-hardening.md:128-135`; 대조: `review/consistency/2026/08/09/14_01_15/plan_coherence.md:54-56` | 이 plan 이동을 별도 커밋/PR 로 분리하거나, plan 문서에 "checker 의 '권한 밖' 권고를 실측 근거(#1103 전량 반영)로 오버라이드했다"는 사유 명시. 소유 worktree 와 충돌 여부 확인 |
| 4 | Maintainability | 같은 PR 이 `workspace.decorator.spec.ts` 에서 "이중 호출 assert 패턴은 위험하다"고 명시적으로 문서화하며 캡처-재던지기 방식으로 회피했음에도, 같은 PR 이 신설한 `workspace-context.util.spec.ts` 의 `it.each` 블록은 정확히 그 기각된 이중 호출 패턴(`toThrow` 용 1회 + `getResponse()` 확인용 1회, 동일 인자)을 재사용 | `codebase/backend/src/common/utils/workspace-context.util.spec.ts:109-120` (대조: `workspace.decorator.spec.ts:43-61`) | 캡처-재던지기 패턴으로 통일하거나 표준을 명시적으로 선언 |
| 5 | Testing | 이번 PR 이 새로 연 400 throw 경로(`resolveRequestWorkspaceContext`)를 실제 요청 파이프라인에서 **가장 먼저** 통과하는 지점인 `RolesGuard`(전역 `APP_GUARD`)에 대해, malformed `X-Workspace-Id` → 400 전파를 검증하는 테스트가 전무. `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 는 각각 추가했으나 가드 레벨은 이번 diff 에서 픽스처만 UUID 로 치환되고 신규 테스트가 없음 | `codebase/backend/src/common/guards/roles.guard.spec.ts` (파일 전체); 구현: `codebase/backend/src/common/guards/roles.guard.ts:121-127` | `guard.canActivate(ctx)` 가 malformed 헤더에서 `BadRequestException(VALIDATION_ERROR)` 를 reject 하는지 확인하는 테스트 추가(`@Roles()` 라우트·`@WorkspaceId()`-only 라우트 각 1건 권장) |
| 6 | Testing | "`@Roles()`/`@WorkspaceId()` 둘 다 안 쓰는 전역 라우트는 헤더와 무관하게 통과" 테스트가 nil UUID(`00000000-...`, `isUuidShaped` 통과값)를 사용해 vacuous — "early-return 이 검증을 건너뛰었다"와 "검증이 실행됐지만 통과했다"를 구분 못함. early-return 순서가 바뀌는 리팩터가 있어도 이 스위트는 회귀를 못 잡음 | `codebase/backend/src/common/guards/roles.guard.spec.ts` — 해당 `describe`/`it` 블록; 구현: `roles.guard.ts:114-127` | 같은 `describe` 에 genuinely malformed 값(`'not-a-uuid'`)으로 여전히 `canActivate` 가 throw 하지 않음을 확인하는 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Side Effect | 부팅 fail-closed 계약이 Node 의 암묵적 `unhandledRejection` 기본 동작(throw→종료)에 의존. `void bootstrap()` 을 향후 `bootstrap().catch(log)` 로 흔한 리팩터를 하면 `process.exit(1)` 없이 조용히 살아남을 수 있음. 현재는 의도대로 동작(엔진 `>=24` 확인, e2e 검증됨) | `codebase/backend/src/main.ts:239`; `common/decorators/workspace-reflection-canary.ts:91-116` | 필요시 `bootstrap().catch((err)=>{logger.error(err);process.exit(1);})` 로 명시적 종료 강제, 또는 주석에 이 위임 관계 명문화 |
| 2 | Security | `WorkspaceIdReflectionBrokenError` 메시지가 내부 구현 세부(비공개 API 이름·경로)를 담지만, 부트 단계(HTTP 응답 경로 도달 불가)에서만 던져져 현재 노출 위험 없음 확인 | `common/decorators/workspace-reflection-canary.ts:44-57` | 향후 런타임 경로(예: health check)에서 재사용 시 재검토 |
| 3 | Security | 부분 reflection 파손(일부 라우트만 인식 실패)은 캐너리가 탐지 못함 — 저자가 이미 주석·plan 에 명시한 알려진 한계 | `common/decorators/workspace-reflection-canary.ts:29-30` | 조치 불요(재확인 기록) |
| 4 | Architecture | `workspace-reflection-canary.ts` 가 실제 데코레이터가 아니라 "부팅 시 구조 불변식 검증"인데 `common/decorators/` 에 위치, `production-guards.ts` 와 개념적으로 같은 층위이나 물리적으로 분리 | `common/decorators/workspace-reflection-canary.ts` (파일 전체) | `common/config/` 또는 신설 `common/bootstrap/` 이동 고려(blocking 아님) |
| 5 | Architecture / Side Effect | `resolveRequestWorkspaceContext` 가 순수 계산에서 "계산+프로토콜 검증(`BadRequestException` throw)"으로 책임 확장 — util 계층이 HTTP 예외 타입을 알게 됨. 소비처 2곳 drift 방지라는 의도적 트레이드오프로 확인 | `common/utils/workspace-context.util.ts:74-79` | 검증 규칙이 더 늘면 "컨텍스트 리졸버 vs 요청 검증기" 경계 재고 |
| 6 | Architecture | `uuid.ts` 에 목적이 다른 두 정규식(`UUID_PATTERN`/`UUID_SHAPE_PATTERN`)이 병존 — JSDoc·테스트로 경계는 명확 | `common/utils/uuid.ts:9-10, 35-36` | 세 번째 변형 추가 시 공통 shape 베이스 + 별도 버전 체크 리팩터 검토 |
| 7 | Architecture | 캐너리가 `handlerConsumesWorkspaceId` 를 import 로 고정 참조해 `@WorkspaceId()` 전용 — 향후 유사 데코레이터 재사용 시 파일 복제 필요 | `common/decorators/workspace-reflection-canary.ts:66-84, 91-116` | 두 번째 소비처 생기면 predicate 주입형으로 일반화 검토(현재는 YAGNI) |
| 8 | Requirement | `assertWorkspaceIdReflectionWorks` 의 `@returns` JSDoc("호출부가 로그·관측에 쓴다")이 실제로는 반환값을 버리는 `main.ts` 호출부와 어긋남 — 로깅은 함수 내부에서 자체 수행 | `common/decorators/workspace-reflection-canary.ts:89` vs `main.ts:168` | 주석을 "테스트·향후 확장을 위해 반환(현재 부트 호출부 미소비)" 로 정정 |
| 9 | Requirement | eslint 경고 1건 — 이미 좁혀진 타입에 불필요한 `as object` 캐스팅 | `common/decorators/workspace-reflection-canary.ts:80` | `@typescript-eslint/no-unnecessary-type-assertion` 정리 |
| 10 | Side Effect | `app.module.ts` 전역 `imports` 에 `DiscoveryModule` 추가 — 부팅 시 1회 소비, 런타임 요청 경로(가드/인터셉터) 미관여 확인 | `app.module.ts:4-10, 79-82` | 조치 불요 |
| 11 | Side Effect / API Contract | malformed `X-Workspace-Id` 응답이 500(마스킹)→400(`VALIDATION_ERROR`) 으로 변경 — 클라이언트 관측 가능한 계약 변경이나 breaking 아님, CHANGELOG 반영됨, 응답 봉투 형식 유지 확인 | `common/utils/workspace-context.util.ts:74-79`; `CHANGELOG.md:39-44` | 외부 API 소비자 있으면 릴리스 노트 노출 재확인 |
| 12 | Side Effect | CLI 스크립트(`generate-golden-set.ts`, `eval-retrieval.ts`)는 `EvalCliModule` 로 부팅해 캐너리를 우회하지만 HTTP 라우트를 노출하지 않아 보안 커버리지 공백 없음 | `codebase/backend/src/scripts/generate-golden-set.ts:184`; `eval-retrieval.ts:144` | 조치 불요 |
| 13 | Maintainability | 워크스페이스 UUID 픽스처 상수가 3개 spec 파일에 거의 동일 값으로 다른 이름(`HEADER_WS`/`WS1` 등)으로 중복 선언 | `workspace.decorator.spec.ts:28-30`; `roles.guard.spec.ts:13-18`; `workspace-context.util.spec.ts:12-14` | 필요 시 공용 fixture 모듈로 승격 검토(강제 아님) |
| 14 | Maintainability | `roles.guard.spec.ts` 내 `WS1` 만 나머지(`OWN_WS` 등 `_WS` 접미사)와 네이밍 패턴 불일치 | `common/guards/roles.guard.spec.ts:13-18` | `WS1` → `GENERIC_WS` 등으로 통일 |
| 15 | Maintainability | 부팅 실패 에러 메시지가 6줄 `+` 문자열 연결로 조립 — 기능 문제 없음, 스타일만 | `common/decorators/workspace-reflection-canary.ts:47-53` | 템플릿 리터럴로 교체(선택) |
| 16 | Testing | `main.ts` 의 캐너리 호출 배선(위치: `assertProductionConfig` 이후·body parser 이전) 자체를 검증하는 단위 테스트가 없음 — `bootstrap()` 미export, 검증은 e2e 261건 통과에 대한 간접 추론에만 의존(근거는 타당, plan 에 이미 인지된 한계로 기록) | `main.ts:161-168, 239` | 필요시 `bootstrap` export 또는 배선 부분 분리해 화이트박스 단위 테스트 고려 |
| 17 | Testing | `assertWorkspaceIdReflectionWorks` 성공 케이스가 항상 커스텀 logger 를 주입 — 기본 `Logger` 로 성공 경로(`logger.log` 실호출)를 타는 테스트 없음. 위험 매우 낮음 | `common/decorators/workspace-reflection-canary.spec.ts:69-76` | 우선순위 낮음, 필요시 기본 파라미터 케이스 추가 |
| 18 | Documentation | 신설 부팅 캐너리가 무조건(환경 무관) 부팅을 멈출 수 있다는 사실이 배포 담당자가 먼저 볼 `README.md` "배포 주의" 섹션에 반영되지 않음(CHANGELOG·코드 JSDoc·plan 에는 있음) | `codebase/backend/README.md:37-42`; 관련: `main.ts:168`, `common/decorators/workspace-reflection-canary.ts` | README 에 캐너리 존재·실패 시 조사 지침 한 줄 추가 검토 |
| 19 | Documentation | 부팅 캐너리를 `spec/5-system/1-auth.md §2.1`(기존 env 기반 5개 fail-closed 항목)과 별도 축으로 두기로 한 결정이 코드 JSDoc 에는 있으나 plan 체크리스트에 "결정 완료"로 명문화되지 않음(`spec_impact: none` 자체는 정합) | `common/decorators/workspace-reflection-canary.ts` JSDoc; `plan/in-progress/auth-guard-reflection-hardening.md` | plan 에 "env 기반 5개 항목과 다른 카테고리라 spec 미추가" 한 줄 명시(선택) |
| 20 | API Contract | 헤더가 없고 토큰 클레임(`request.user.workspaceId`)만 malformed 인 극단 케이스는 여전히 500 마스킹 경로를 탈 수 있음 — 의도적 설계(서버 서명값이라 400 오분류 방지), 정상 운영에서 도달 거의 불가 | `common/utils/workspace-context.util.ts` (`resolveRequestWorkspaceContext`) | 조치 불요, 운영 로그에서 실제 관측되면 후속으로 다룰 것 |
| 21 | API Contract | 가드 레벨 400(`VALIDATION_ERROR`, malformed `X-Workspace-Id`)이 `@ApiBadRequestResponse` 등 per-endpoint Swagger 데코레이터로 문서화되지 않음 — 이번 PR 이 새로 만든 갭이 아니라 기존 가드의 특성, `#1103` 스코프로 이미 분리됨 | `common/guards/roles.guard.ts` (전역 `APP_GUARD`); `spec/conventions/swagger.md` §2-4 | 이번 PR 범위 밖, 향후 Swagger 정리 라운드에서 cross-cutting 관행 명문화 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 코드에 새 취약점 없음. INFO 3건(암묵적 unhandledRejection 의존, 메시지 상세도, 부분 파손 미탐지 — 전부 견고성 제안/기존 문서화된 한계) |
| architecture | LOW | 순환/레이어 위반 없음. INFO 4건(모듈 배치, 책임 경계 확장, 정규식 병존, 하드코딩 재사용성) |
| requirement | LOW | 핵심 로직 정확 구현(테스트 70/70 PASS, 타입체크·spec 대조 확인). WARNING 2건(CHANGELOG stale 링크, plan worktree placeholder) |
| scope | LOW | 핵심 변경은 plan 범위와 일치. WARNING 1건(다른 task 소유 plan 이동을 자체 checker 권고 반대로 실행) |
| side_effect | LOW | 부팅 정지 지점·전역 모듈 추가·계약 확장 모두 소비처 한정·의도 문서화 확인. INFO 다수(전부 조치 불요 수준) |
| maintainability | LOW | 구조·복잡도 문제 없음. WARNING 1건(자체 기각한 이중 호출 assert 패턴 재사용), INFO 3건(픽스처 중복, 네이밍, 스타일) |
| testing | MEDIUM | 신규 400 경로의 최초 통과 지점(`RolesGuard`)에 테스트 전무 + 기존 인접 테스트 1건 vacuous. WARNING 2건 |
| documentation | LOW | 근거·결정 배경 정합성 높음. WARNING 1건(CHANGELOG stale 링크, requirement 와 중복), INFO 2건(README 미노출, spec 정합 결정 미명문화) |
| api_contract | LOW | 유일한 계약 변경(500→400)이 기존 규약과 완전 정합. INFO 2건(토큰 클레임 비대칭, Swagger 미반영 — 기존 갭) |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상을 보고했다.

## 권장 조치사항

1. `RolesGuard`(전역 가드) 레벨에서 malformed `X-Workspace-Id` → 400 전파를 직접 검증하는 테스트를 추가하고, 기존 "전역 라우트는 헤더 위조에도 통과" 테스트를 genuinely malformed 값으로 교체해 vacuous 를 해소한다 (WARNING #5, #6).
2. `CHANGELOG.md:47` 의 stale plan 경로(`plan/in-progress/auth-workspace-membership-guard.md` → `plan/complete/...`)를 정정한다 (WARNING #1).
3. `plan/in-progress/auth-guard-reflection-hardening.md` frontmatter 의 `worktree` 필드를 실제 슬러그로 갱신한다 (WARNING #2).
4. 다른 task 소유 plan 이동(`spec-draft-workspace-header-membership-invariant.md`)을 이번 PR 에서 분리하거나, 자체 checker 의 "권한 밖" 권고를 오버라이드한 근거를 plan 문서에 명시한다 — 소유 worktree(`auth-workspace-membership-guard-2b94db`)와의 충돌 여부도 확인한다 (WARNING #3).
5. `workspace-context.util.spec.ts` 의 이중 호출 assert 패턴을 `workspace.decorator.spec.ts` 가 이미 채택한 캡처-재던지기 패턴으로 통일한다 (WARNING #4).
6. (선택, 낮은 우선순위) README "배포 주의" 섹션에 신규 부팅 캐너리 실패 모드를 한 줄 추가하고, `bootstrap()` 의 fail-closed 계약을 코드에 명시적으로 강제하는 방안을 검토한다 (INFO #1, #18).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이번 diff 범위에서 관련성 낮음으로 스킵 — 상세 사유는 `_routing_decision.json` 미제공) |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | user_guide_sync | 상동 |