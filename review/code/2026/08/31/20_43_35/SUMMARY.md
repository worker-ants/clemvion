# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(가드 완결성 주장이 실제 스캔 범위보다 넓음). 나머지는 전부 INFO 이며 전 라운드(`20_27_29`) 지적사항의 반영 확인이 중심. forced whitelist 7개(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

> **참고**: documentation reviewer 가 검증 도중 워킹트리에서 `engine-error-code-anchor-guard.ts` 의 미커밋 diff(`collectBoundCodes(repoRoot, relDir)` → `collectBoundCodes(repoRoot, undefined)`)를 관측했다. 본인 변경이 아니며 병렬 reviewer 의 진행 중 뮤테이션 검증으로 추정, 원복하지 않고 그대로 보고함. 이 SUMMARY 작성 시점 기준 실제 코드 결함으로 집계하지 않았다 — 후속 작업자는 `git status --short` 로 잔존 여부를 재확인할 것.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | 신규 AST 가드의 "엔진 모듈에 새 맨 문자열 코드가 생기면 RED" 완결성 주장이 실제 스캔 형태보다 넓다 — `collectBoundCodes` 는 `code:`/`errorCode:` 식별자 바인딩 4형태(property assignment, variable/property declaration, binary assignment)만 방문하고 **생성자 positional 인자**는 방문하지 않는다. `RehydrationError.code` 생성자 파라미터(리터럴 유니온)로 전달되는 `RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE` 가 이 경계에 걸리는 실사례다 — 오늘은 `tsc` 리터럴 유니온이 타입 앵커 역할을 해 안전하지만, 향후 이 타입이 느슨해지거나 유사 패턴의 새 엔진 에러 클래스가 추가되면 가드가 조용히 놓친다. | `codebase/backend/src/nodes/core/error-codes.ts:137-138`(JSDoc); `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`(`collectBoundCodes`); `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:38-49`(`RehydrationError` 생성자); `execution-engine.service.ts` 다수 `new RehydrationError('RESUME_CHECKPOINT_MISSING', …)` 호출부 | (a) `EngineErrorCode` JSDoc/`ANCHORED_ELSEWHERE` 에 `RehydrationError.code` 를 "이미 타입 앵커 있음"으로 명시 등재하거나, (b) 가드 스캔 대상을 알려진 타입-앵커 에러 클래스의 생성자 호출까지 확장. 최소한 "새 맨 문자열 코드가 생기면 RED" 문구를 "4가지 식별자 바인딩 형태에 한해"로 스코프 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 신설 AST 가드 3파일(약 360줄)이 "9지점 리다이렉트"라는 최소 요청보다 넓은 산출물이나, `CHANGELOG.md`/`plan/complete/exec-intake-followups.md` 에 명시 계획되고 기존 형제 패턴(`redis-fail-open-catalog-guard.ts`)을 그대로 따름 | `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard,fixture,.spec}.ts` | 조치 불요. 향후 유사 가드 증가 시 별도 plan 항목 분리 고려 |
| 2 | Scope | `ai-turn-orchestrator.service.ts` 의 `LLM_*` 4지점은 이미 `ErrorCode` enum 에 값이 있었고 참조 방식만 변경 — "맨 문자열이라 앵커 없음"이라는 원 문제와 결이 다르나 CHANGELOG 에 명시 사유 있고 가드 스캔 범위(`ENGINE_DIR`) 안 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1298,1301,1304,1311` | 조치 불요 |
| 3 | Maintainability | AST `as const` 언래핑 로직(`ts.isAsExpression(...) ? ... : ...`)이 `readDeclaredCodes` 와 `collectBoundCodes` 두 곳에 동일하게 중복 | `engine-error-code-anchor-guard.ts:79-81, 160-162` | 공용 헬퍼(`unwrapAsExpression`)로 통합. 우선순위 낮음 |
| 4 | Maintainability | 픽스처 디렉터리 경로 문자열이 spec 내 두 곳에 리터럴로 하드코딩 반복 — 다른 상수(`ENGINE_DIR`/`CODES_SOURCE`)는 추출됐는데 이것만 미추출 | `engine-error-code-anchor.spec.ts:72,101` | 파일 상단에 `FIXTURE_DIR` 상수 추출 후 재사용. 우선순위 낮음 |
| 5 | Testing | 리팩터 대상 3서비스의 기존 회귀 테스트(`ai-turn-orchestrator.service.spec.ts`, `execution-engine.service.spec.ts`)는 여전히 맨 문자열로 `code` 값을 단언 — 전 라운드에 이미 검토되어 "값이 동일해 안전하고, 상수 참조로 바꾸면 리네임 회귀를 오히려 못 잡는다"는 타당한 근거로 의도적 미조치 | `ai-turn-orchestrator.service.spec.ts:983`; `execution-engine.service.spec.ts:9392` | 재상정하지 않음(기록 유지) |
| 6 | Documentation | 검증 도중 워킹트리에서 병렬 reviewer 로 추정되는 미커밋 뮤테이션(`collectBoundCodes(repoRoot, undefined)`) 관측 — 본 세션 산출물 아님, 원복 안 함 | `engine-error-code-anchor-guard.ts` (`findUnanchored` 호출부) | 후속 작업자는 `git status --short` 로 잔존 여부 재확인. 결함 아님(다른 reviewer 의 진행 중 검증으로 추정) |
| 7 | Side Effect / Documentation | 대체된 9지점 전부 원본 리터럴과 값이 정확히 일치(재검증 완료), 신규 `EngineErrorCode`/`EngineErrorCodeValue` export 는 barrel 재수출 없어 표면 국소적, plan 문서 이동은 git rename 으로 정상 인식됨, 전 라운드 WARNING(CHANGELOG 미갱신) 해소 확인 | `error-codes.ts`; `nodes/core/index.ts`; `plan/complete/exec-intake-followups.md` | 조치 불요(확인 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음 — 값 100% 보존된 순수 리팩터, 인젝션/시크릿/인증 표면 변화 없음 |
| requirement | LOW | WARNING 1건 — 가드 완결성 주장이 생성자 positional 인자(`RehydrationError.code`)를 못 덮음 |
| scope | NONE | INFO 3건 — 가드 신설·LLM_* 번들링 전부 문서화된 근거로 조치 불요, 이전 리뷰 산출물 커밋도 정상 관례 |
| side_effect | NONE | INFO 6건(대부분 확인성) — 9지점 값 드리프트 없음 재검증, export 표면 국소적, rename 정상 인식 |
| maintainability | NONE | INFO 2건 — AST unwrap 로직 2줄 중복, 픽스처 경로 문자열 반복. 전 라운드 매직넘버 지적은 실제 반영 확인 |
| testing | NONE | 뮤테이션(`relDir` 무력화)으로 positive-path 테스트 실효성 직접 확인(RED 재현), 12/12 GREEN, eslint 0 경고. INFO 1건은 의도적 미조치 재확인 |
| documentation | NONE | 전 라운드 WARNING(CHANGELOG 미갱신) 해소 확인 + INFO 2건 조치 반영 확인. 병렬 reviewer 미커밋 뮤테이션 관측(비결함) |

## 발견 없는 에이전트

- security — 검토 관점 8개(인젝션/시크릿/인증/입력검증/OWASP/암호화/에러처리/의존성) 전부 해당 없음 또는 안전, 발견사항 없음.

## 권장 조치사항

1. (WARNING #1) `EngineErrorCode` JSDoc/`ANCHORED_ELSEWHERE` 에 `RehydrationError.code` 생성자 파라미터를 "이미 타입 앵커 있음"으로 명시 등재하거나, 가드의 완결성 문구를 실제 스캔 범위(4가지 식별자 바인딩 형태)로 좁혀 서술. 급하지 않으나 다음 유사 리팩터 전에 반영 권장.
2. (INFO #6) `engine-error-code-anchor-guard.ts` 의 잔존 미커밋 diff(`relDir` → `undefined`) 여부를 병합 전에 `git status --short` 로 재확인 — 다른 reviewer 의 검증 산물이 실수로 남아있지 않도록.
3. (INFO #3, #4) AST unwrap 헬퍼 통합 및 픽스처 경로 상수 추출은 우선순위 낮음 — 후속 정리 작업 시 함께 처리.
4. 그 외 항목은 전부 문서화된 근거로 조치 불요 확인됨 — 추가 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 문자열 리터럴→상수 참조 치환(런타임 성능 영향 없음)이라 해당 없음 |
  | architecture | router 판단 — 기존 파일 내 const 신설이며 아키텍처 구조 변경 없음 |
  | dependency | router 판단 — 신규 의존성 추가 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 로직 변경 없음 |
  | api_contract | router 판단 — 에러 코드 값 자체가 불변이라 API 계약 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 대면 문서/가이드 영향 없는 내부 리팩터 |
