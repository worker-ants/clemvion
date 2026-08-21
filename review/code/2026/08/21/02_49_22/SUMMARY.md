# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(신규 CI 가드의 import 탐지 정규식이 namespace import/`require()` 우회를 못 잡는 완결성 갭 — 현재 실호출부는 모두 정상 형태라 즉시 악용 가능한 취약점은 아님). forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 신규 CI 가드(`masked-reject-callers-guard.ts`)의 import 탐지가 정규식 `import\s*\{[\s\S]*?\}\s*from` (named-import) 형태만 인식한다. namespace import(`import * as core from '...'`)나 `require()` 형태로 base 함수(`resolveTriggerParameters`)를 직접 import 하면 마스킹-거부 wrapper 우회가 이 가드에 조용히 잡히지 않는다. 가드 자체의 fixture 캐너리도 named-import 형태만 검증해 이 갭이 캐너리로 고정돼 있지 않다 (security 리뷰가 WARNING 으로 신규 지적; requirement 리뷰는 동일 지점을 기존부터 인지된 INFO 로 재확인) | `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수 `importsBaseFn` (73~84행) | namespace-import 패턴(`import\s+\*\s+as\s+\w+\s+from`) 및 `require(...)` 스캔까지 탐지 정규식 확장, 또는 AST(`ts.createSourceFile`) 전환 검토. 최소한 namespace-import 우회 형태를 부정 캐너리(RED 확인)로 추가해 갭을 문서화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/유지보수성 | `workflows.controller.ts` execute 의 `try/catch` 블록에서 신규 한국어 인라인 주석 바로 아래 기존 영어 주석이 그대로 남아 언어가 섞임(내용 자체는 정확) | `codebase/backend/src/modules/workflows/workflows.controller.ts` execute 메서드 | 다음에 이 블록을 편집할 기회에 한국어로 통일 검토 |
| 2 | 테스트 | `rawSource` 가 배열인 케이스 전용 단언 없음 (`isRecord` 가 배열도 false 판정해 null/문자열과 동일 경로를 타므로 실위험 낮음) | `reject-masked-resubmission.spec.ts:313-316`, 판정 로직 `reject-masked-resubmission.ts:121` | 다음 편집 시 `rejectedFields(schema, [1,2,3])` 케이스 1줄 추가 고려 |
| 3 | 테스트 | raw-검사→resolve-후-검사 2단계 순서 보장이 구조(순차 실행)에만 의존, 향후 try/catch 통합 리팩터 시 이 트레이드오프가 조용히 사라질 수 있는데 전용 회귀 테스트 없음 | `reject-masked-resubmission.ts:62-72` (`resolveTriggerParametersRejectingMasked`) | 그런 리팩터가 실제 제안되면 "raw hit 없음 + 무관 필드 coerce_failed + JSON 문자열 내 마커" 조합 캐너리 추가 |
| 4 | 테스트 | 기능 전용 e2e/supertest HTTP 왕복 스모크 부재 (unit 스펙은 예외/응답 바디까지 검증하나 `GlobalExceptionFilter` 통과 왕복은 미검증) | `executions-rerun.service.spec.ts`, `workflows.controller.spec.ts` | 선택 사항, 필수 아님(이전 라운드 이미 동일 판정) |
| 5 | 문서화 | `ReRunRequestDto.inputOverride` Swagger `description` 이 마스킹 마커 3문자열 예약어 거부 사실을 반영하지 않음. `execute` 의 `parameterValues` 는 인라인 타입이라 애초에 `@ApiProperty` 없음 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` 필드) | 다음에 DTO/body 타입을 정식 승격할 기회에 예약어 제약 문구 추가 |
| 6 | 문서화 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 두 항목이 `[x]` 종결됐으나 파일 자체·frontmatter 는 여전히 `in-progress` — 이 두 항목이 파일의 마지막 open 항목이면 `plan/complete/` 이동 누락 가능 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | 다른 미체크 항목 존재 여부 확인 후, 없다면 plan-lifecycle 규약대로 `plan/complete/` 이동 + `status: complete` 갱신 |
| 7 | 범위 | 동일 diff 가 7라운드째 재검토 중 — fix→review 재귀 루프로 신규 repo-guard(2파일 213줄)가 누적 diff 비중을 키움. 스코프 이탈은 아니며 CLAUDE.md 표준 fix loop 범위 안 | `review/code/2026/08/21/{00_03_57..02_29_01}/RESOLUTION.md` (6건) | 조치 불요, 참고 등재만 |
| 8 | 범위 | `review/**` 산출물 87개 파일이 커밋 히스토리에 실림(저장소 컨벤션상 정상, gitignore 대상 아님) | `review/code/2026/08/21/**`, `review/consistency/2026/08/2{0,1}/**` | 조치 불요 |
| 9 | 범위 | 공유 트래커의 별도 항목(W5, `Execution.inputData` 응답 의미 반전)이 이번 PR 라인에서 함께 종결 — 이전 라운드(`01_15_47`)가 이미 조치 불요로 판정, 이번 라운드 diff 상 변화 없음 재확인 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (W5 `[x]`) | 조치 불요(기존 판정 유지) |
| 10 | 부작용 | 두 엔드포인트(`execute`/`re-run`)의 요청 유효값 집합이 마스킹 마커 3문자열만큼 좁아지는 breaking 인터페이스 변경 — 의도된 보안 하드닝, 외부 소비자 부재 확인·spec 문서화 완료 | `reject-masked-resubmission.ts:56-75`, 호출부 `executions.service.ts:499`, `workflows.controller.ts:317` | 조치 불요(이미 확인·문서화 완료) |
| 11 | 부작용 | `re-run` 400 응답 봉투에 `details[]` 가 처음 채워짐(선존 `errors`→`details` 버그 교정) — 필드 추가 방향이라 하위호환 | `executions.service.ts:512`, `http-exception.filter.ts:73` | 조치 불요, 봉투 형태 변경 사실만 기록 |
| 12 | 부작용 | 신규 repo-guard 테스트가 `os.tmpdir()` 에 임시 디렉터리 생성 — `finally` 로 정리 확인, 저장소 트리 밖이라 문제 없음 | `masked-reject-callers.spec.ts:61-84` | 조치 불요 |
| 13 | 유지보수성 | `throwIfAny` 헬퍼 이름이 무엇을 던지는지 시그니처만으로 안 드러남 (파일 내부 전용, 호출부 주석으로 문맥 보완돼 위험 낮음) | `reject-masked-resubmission.ts:91` | 필수 아님. 다음 편집 시 `throwIfMaskedResubmissionErrors` 류로 구체화 고려 |
| 14 | 유지보수성 | 신규 정적 가드의 주석/문자열 제거(`stripCommentsAndStrings`)가 정규식 기반이라 임의 코드 형태에 완전하지 않음을 스스로 문서화 — 의도된 트레이드오프(문법 표면이 좁음) | `masked-reject-callers-guard.ts` 함수 `stripCommentsAndStrings` (93행) | 조치 불요 |
| 15 | 요구사항 | re-run(`INVALID_INPUT`) vs execute(`INVALID_TRIGGER_PARAMETERS`) 최상위 `error.code` 가 여전히 다름 — `details[].code` 는 이 PR 이 `MASKED_VALUE_RESUBMITTED` 로 완전 수렴시켰고, 최상위 drift 는 이 PR 이전부터 있던 것이며 spec 이 명시적으로 정당화(rename-stability) | `executions.service.ts:506`, `workflows.controller.ts` (`INVALID_TRIGGER_PARAMETERS` throw 지점) | 이 PR 스코프 밖. 향후 두 봉투 통일 기회 시 처리 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CI 가드 import 탐지 정규식이 namespace import/`require()` 우회를 못 잡음(WARNING). 그 외 인젝션·인가·정보노출·시크릿 관점 문제 없음 |
| requirement | NONE | raw-우선/resolve-후 2단계 검사, Manual-only 스코프, 에러 매핑, spec 5곳 정합 모두 line-level 재검증 통과. INFO 2건은 기존 처분 항목 재확인 |
| scope | NONE | 실질 코드 변경 12파일 전부 단일 의도(마커 재제출 서버측 거부)에 부합. 불필요한 리팩터·무관 파일 변경 없음. INFO 3건은 반복 리뷰 루프·산출물 커밋 등 참고성 |
| side_effect | LOW | 순수 함수·drop-in 치환으로 예상 밖 부작용 없음. INFO 3건(유효값 도메인 축소, 응답 봉투 확장, tmpdir 사용)은 모두 문서화·확인된 의도된 변경 |
| maintainability | NONE | 이전 6라운드 지적 사항(호출부 중복, `isPlainRecord` 재구현, freeze 플라시보, 봉투 유실) 전량 해소 실코드 재확인. 남은 INFO 2건은 저비용 네이밍/트레이드오프 |
| testing | NONE | 관련 7개 스펙 스위트 직접 실행 168/168 통과. 경계값·타입 우회 회귀·왕복 통합·가드 자기탐지력까지 다층 커버. INFO 3건은 이미 저위험 판정된 이월 항목 |
| documentation | NONE | JSDoc/CHANGELOG/spec 7곳 정합 확인, 이전 라운드 지적 stale 서술 3곳 정정 확인. INFO 3건(Swagger 설명, 언어 혼재, plan 이동 확인)은 저비용 이월 항목 |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 INFO 또는 WARNING 을 등재함 (CRITICAL 은 전원 0건).

## 권장 조치사항
1. (WARNING) `masked-reject-callers-guard.ts` 의 import 탐지 정규식을 namespace import(`import * as X from ...`)·`require()` 형태까지 확장하거나 AST 파서로 전환. 최소한 namespace-import 우회를 부정 캐너리로 추가해 현재 갭을 문서화.
2. (INFO, 선택) 다음에 관련 파일을 편집할 기회가 있을 때 함께 처리: `workflows.controller.ts` 잔존 영어 주석 통일, `ReRunRequestDto` Swagger 설명에 예약어 제약 명시, `throwIfAny` 네이밍 구체화, 배열 `rawSource` 케이스 테스트 추가.
3. (INFO) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 다른 미체크 `[ ]` 항목이 남아 있는지 확인하고, 없다면 plan-lifecycle 규약대로 `plan/complete/` 로 이동 + `status: complete` 갱신.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 forced — 실질적으로 router 선택 = forced whitelist 와 동일. 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (순수 함수·소규모 검증 로직, 성능 영향 표면 없음) |
  | architecture | router 판단상 이번 diff 와 무관 (기존 모듈 경계 내 함수 추가/치환, 아키텍처 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관 (신규 외부 의존성 추가 없음) |
  | database | router 판단상 이번 diff 와 무관 (DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 (동시성 관련 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 와 무관 (엔드포인트 계약 자체는 유지, 값 도메인 축소만 — side_effect/requirement 가 커버) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 가이드 문서 대상 변경 없음) |
