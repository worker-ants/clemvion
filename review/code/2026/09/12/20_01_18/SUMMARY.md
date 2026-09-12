# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 4건은 전부 "기능 결함"이 아니라 (1) spec 문서가 이미 baseline 화된 구현 관례를 따라가지 못하는 SPEC-DRIFT 1건, (2) 신규 가드 내부 유지보수성 이슈 1건, (3) 신규 가드의 대조군 fixture 한 방향 누락 1건, (4) 관측 가능한 상태 코드 변경(500→400)에 대한 CHANGELOG 누락 1건이다. forced 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보되어 있고 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/swagger.md §5-4`는 UUID 경로 파라미터에 대해 `@ApiParam({format:'uuid'})` 문서 축 하나만 요구하는데(체크리스트 1줄, `ParseUUIDPipe` 단어 자체가 문서 전체에 0건), 신규 가드·테스트·컨트롤러 주석 4곳이 "같은 조항이 `ParseUUIDPipe` 런타임 축까지 포함해 두 가지를 요구한다"고 서술한다. 오히려 같은 문서 §2-3 예시 코드는 파이프 없이 작성돼 있어 이번에 baseline 0 으로 고정한 신규 가드 요구와 정면으로 어긋난다. (requirement·documentation 리뷰어 공통 지적) | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:90`, `param-uuid-pipe.spec.ts:27-37`, `codebase/backend/src/modules/triggers/triggers.controller.ts:287-289`, `codebase/backend/src/modules/auth/auth.controller.ts:433-435` | 코드는 되돌릴 필요 없음(구현·가드 모두 타당). `project-planner` 경유로 `spec/conventions/swagger.md §5-4` 체크리스트에 `@Param('id', ParseUUIDPipe)` 런타임 축 항목을 추가하고 §2-3 예시에도 파이프를 반영. 최소한 4곳 주석 표현을 "spec 이 요구한다"에서 "저장소 실측 관례(135/136)를 가드로 승격 — swagger.md §5-4는 아직 문서 축만 명시"로 정정. |
| 2 | maintainability | 신규 가드의 두 export 함수(`findUuidParamViolations`, `countIdShapedParams`)가 "id-형 `@Param` 판정" AST 순회 로직을 각각 독립적으로 재구현. `countIdShapedParams`는 vacuity-floor 용인데, 판정 조건이 한쪽에서만 바뀌면 두 함수가 서로 다른 대상을 세게 되고 그 드리프트를 잡을 테스트가 없다. 같은 디렉터리의 다른 가드들은 vacuity floor 를 별도 순회가 아니라 결과 집합의 `.length`로 재는 관례를 쓴다. | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:106-161`, `:164-195` | `countIdShapedParams` 를 없애고 `findUuidParamViolations` 가 `{ violations, scannedCount }` 형태로 스캔 총수도 함께 반환하게 하거나, id-형 파라미터·데코레이터 순회 블록을 공유 제너레이터로 추출해 두 함수가 재사용. |
| 3 | testing | `@ApiExcludeEndpoint()` 면제가 "문서 축만 면제하고 런타임 축(파이프)은 그대로 요구한다"고 주장하지만, 이를 독립적으로 증명하는 fixture 가 없다. 현재 `excluded` fixture 는 파이프가 **있는** 상태로만 존재해 "면제 시 파이프 체크까지 함께 스킵되는" 방향의 회귀를 이 스위트가 잡아내지 못한다(구현 자체는 올바름 — 회귀 감지 커버리지 갭). | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:142`, `fixtures/param-uuid-pipe/sample.controller.ts:57-65`, `param-uuid-pipe.spec.ts:93-96` | `@ApiExcludeEndpoint()` + 파이프 **없음** 조합의 fixture(`excludedPipeless`)를 추가하고 "파이프 누락은 면제와 무관하게 위반으로 잡힌다"를 단언하는 케이스 추가. |
| 4 | documentation | `rotateBotToken`의 `:id`에 `ParseUUIDPipe`를 추가해 비-UUID 입력의 응답이 500(`INTERNAL_ERROR`, 마스킹)→400(`VALIDATION_ERROR`)으로 바뀐다 — API 소비자가 관측하는 상태 코드 변경. 이 저장소 `CHANGELOG.md`는 동일 엔드포인트의 과거 상태 코드 재분류를 `## Unreleased` 항목으로 기록해 온 확립된 관례가 있는데, 이번 diff(15파일)에는 `CHANGELOG.md`가 포함되지 않았다. | `CHANGELOG.md` (미변경) / `codebase/backend/src/modules/triggers/triggers.controller.ts:291` | 기존 항목 형식(변경 전/후 + 배포 확인 문구)을 따라 `CHANGELOG.md`에 한 항목 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract/security | `rotateBotToken`의 `:id`에 `ParseUUIDPipe` 추가로 비-UUID 입력이 500(마스킹)→400(`VALIDATION_ERROR`)으로 정정. `GlobalExceptionFilter.getCodeFromStatus(400)` 코드를 직접 대조해 실제 매핑과 `@ApiBadRequestResponse` 문서 문구 일치를 확인. 의도된 버그 수정이며 형제 엔드포인트(`switchWorkspace`)와 형태 일치. (security·requirement·side_effect·testing·api_contract 5개 리뷰어 공통 확인) | `codebase/backend/src/modules/triggers/triggers.controller.ts:291`, `codebase/backend/src/common/filters/http-exception.filter.ts` | 조치 완료. |
| 2 | testing/side_effect | 위 400 전환은 AST 선언(가드) 검증뿐이고, 실제 HTTP 왕복으로 400을 확인하는 e2e/컨트롤러 테스트는 0건(`triggers.controller.spec.ts`는 직접 인스턴스화라 Nest 파이프 미실행). plan 이 이 갭을 사전 인지·스코프 아웃함. | `codebase/backend/src/modules/triggers/triggers.controller.ts:291`, `param-uuid-pipe.spec.ts` | `rotate-bot-token` e2e 추가 시 malformed UUID→400 케이스 포함 (낮은 우선순위 후속). |
| 3 | api_contract/requirement | 신규 repo-guard(`param-uuid-pipe-guard.ts`/`.spec.ts`/fixture)가 "id-형 경로 파라미터 = `ParseUUIDPipe` + `@ApiParam({format:'uuid'})`" 계약을 AST 기반 baseline 0으로 전수 강제. 실측(`modules/` 전수 grep)으로 위반 0건 확인, 뮤테이션 6종(M1~M6) 예측/실측 병기, `@ApiExcludeEndpoint` 면제 설계도 적절. | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `.spec.ts`, `fixtures/param-uuid-pipe/sample.controller.ts` | 조치 불필요. |
| 4 | maintainability | `ParseUUIDPipe` 존재 판정이 심볼 해석이 아니라 텍스트 부분일치(`pipes.includes('ParseUUIDPipe')`) — 별칭 import(`as UuidPipe`) 시 오탐, `LegacyParseUUIDPipeAdapter` 류 부분일치 심볼 시 미탐 가능. 실측상 현재 별칭 0건으로 안전. | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:135-141` | 이 파일의 기존 문서화 관례에 맞춰 "텍스트 부분일치 — 별칭 import 시 오탐 가능(실측 0건)" 한 줄 주석 추가. |
| 5 | maintainability | `findUuidParamViolations` 내부에 파일 순회→로컬 `visit` 클로저→메서드 판별→파라미터 루프→데코레이터 루프→조건문까지 5~6단 중첩. | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:106-161` | 메서드 단위 위반 추출을 별도 이름 있는 함수로 분리해 중첩 2~3단으로 축소. |
| 6 | maintainability | `plan/in-progress/spec-draft-nullable-notation-followups.md`가 3,100줄·55KB를 넘어 계속 누적 — 이번 변경 자체는 관례를 정확히 따름. | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 프로젝트 컨벤션 범위 밖. 완료 섹션을 주기적으로 `plan/complete/`로 이관하는 정리 주기 고려. |
| 7 | side_effect | 신규 fixture 헤더 주석("프로덕션 스캔 루트는 `src/modules`라 이 파일은 안 걸린다")이 같은 디렉터리의 `src/` 전체를 재귀 스캔하는 형제 가드(`swagger-dto-contract.spec.ts`, `nullable-type-lie-cast.spec.ts`)에는 적용되지 않는다. 현재는 그 가드들이 찾는 패턴이 이 fixture에 없어 오탐이 없을 뿐, "스캔 밖"이라는 근거 자체는 부정확. | `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts:2-4` | 주석을 "modules/ 를 스캔 루트로 쓰는 가드에서만 제외되고, src/ 전체를 스캔하는 형제 가드는 여전히 순회하되 패턴이 없어 통과한다"로 범위 정정. |
| 8 | documentation/security/api_contract | 유저가이드(MDX) 4곳의 `TRIGGER_NOT_FOUND`(코드베이스에 없는 chat-channel 오귀속 코드)→`RESOURCE_NOT_FOUND` 정정, MCP 환경변수 오기(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`) 2곳 정정, `backend-labels.ts`/`.test.ts`의 귀속 주석 정정 — 모두 실제 코드(`hooks.service.ts`, `triggers.service.ts`, `.env.example`)와 line-level 대조해 정확함을 확인. | `codebase/frontend/src/content/docs/02-nodes/{triggers,triggers.en}.mdx`, `06-integrations-and-config/{telegram,telegram.en,mcp-servers,mcp-servers.en}.mdx`, `codebase/frontend/src/lib/i18n/backend-labels.ts`, `__tests__/backend-labels.test.ts` | 조치 완료. |
| 9 | scope | MCP 환경변수 오기 정정 2파일이 이번 배치의 표제 작업(트리거 UUID + chat-channel 에러코드)과는 별개 기능 영역이나, plan에 근거(`.env.example` 등 대조)와 함께 명시적으로 등재된 판단이라 은폐된 스코프 확장이 아님. | `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx` | 후속에는 "가이드 오기 스윕"과 "엔드포인트 계약 수정"을 별도 PR/커밋으로 분리 권장(선택). |
| 10 | user_guide_sync | `telegram.mdx` 등 에러 목록이 "etc."로 끝나 신규 `VALIDATION_ERROR`(malformed `:id`) 케이스를 산문에 명시적으로 나열하지 않음 — API 직접 호출자용 엣지케이스라 실사용자 영향 낮음, 1차 대상(swagger jsdoc)은 이미 정확히 갱신됨. | `codebase/frontend/src/content/docs/06-integrations-and-config/telegram{,.en}.mdx` | 선택 사항: 후속 편집 시 "etc."를 구체 코드 나열로 교체. |
| 11 | testing | `param-uuid-pipe` 스위트는 `src/modules/**` 전체를 스캔하는 의도된 "베이스라인 0, 비격리" ratchet 설계 — 향후 실패는 이 PR 회귀가 아니라 타 PR의 신규 위반일 수 있음(설계 자체는 정상). | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:49-53` | 조치 불필요, 인지용 기록. |
| 12 | api_contract | `switchWorkspace`(`auth.controller.ts`) `@ApiParam`에 `format:'uuid'` 문서 축 보강 — 런타임은 이미 `ParseUUIDPipe` 보유, 순수 Swagger 문서 강화. | `codebase/backend/src/modules/auth/auth.controller.ts:433-440` | 조치 완료. |
| 13 | api_contract | `rotateBotToken` 반환 타입을 `Awaited<ReturnType<...>>` 대신 명시적 DTO(`ChatChannelRotateBotTokenDto`)로 선언 — 서비스 반환 형태 변경 시 `tsc`가 이 지점에서 즉시 감지, 계약-구현 drift 방지. | `codebase/backend/src/modules/triggers/triggers.controller.ts:298` | 조치 완료(긍정적 변경). |
| 14 | user_guide_sync | `auth-session-flow-change` trigger가 glob(`modules/auth/**`)상 매칭되지만, diff는 OpenAPI 스키마 정밀화 한 줄뿐(행위 변경 없음, `ParseUUIDPipe` 기 보유)이라 semantic 판단상 07-workspace-and-team 문서·e2e 갱신 의무 없음. | `codebase/backend/src/modules/auth/auth.controller.ts` | 결함 아님 — 판정 근거 기록용. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `ParseUUIDPipe` 추가는 입력 검증 누락을 닫는 보안 개선. 하드코딩 시크릿·인젝션·평문 전송·정보 노출 없음. |
| requirement | LOW | SPEC-DRIFT 1건(swagger.md §5-4 귀속 과장) 외 전 항목이 실제 코드·spec과 실측 일치(가드 6/6 통과, MDX 정정 정확). |
| scope | LOW | MCP env var 정정·신규 가드 인프라 도입 둘 다 plan에 근거와 함께 명시된 판단, 은닉된 확장 없음. |
| side_effect | LOW | 500→400 응답 변경 1건(의도됨, e2e 갭 존재) + fixture 스캔 격리 주장 부정확(현재 무해). |
| maintainability | LOW | 가드 내부 함수 중복 로직(WARNING), 텍스트 부분일치 판정·중첩 구조·tracker 문서 비대화(INFO). |
| testing | LOW | `@ApiExcludeEndpoint` 방향 뮤턴트 미검증(WARNING), e2e/MDX 정합 자동가드 갭(INFO, 스코프 아웃 문서화됨). |
| documentation | LOW | swagger.md §5-4 인용 과장 + CHANGELOG 누락(WARNING 2건). 나머지 문서 정정은 정확. |
| api_contract | LOW | 500→400 breaking(의도적 버그 수정), 반환 타입 DTO화·가드 도입 모두 긍정적. |
| user_guide_sync | LOW | 매칭된 실질 trigger(`backend-api-change`)의 동반 갱신(swagger jsdoc + MDX ko/en) 전부 이행 확인. "etc." 그레이존만 잔존. |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 INFO 이상의 발견을 보고했다(그중 security는 CRITICAL/WARNING 없이 INFO만 보고).

## 권장 조치사항

1. `spec/conventions/swagger.md §5-4`에 `@Param('id', ParseUUIDPipe)` 런타임 축 항목을 추가(또는 §2-3 예시 정정) — `project-planner` 턴 필요(SPEC-DRIFT).
2. `CHANGELOG.md`에 `rotateBotToken` malformed `:id` 응답 500→400 변경 항목 추가.
3. `param-uuid-pipe-guard.ts`의 `findUuidParamViolations`/`countIdShapedParams` 중복 AST 순회 로직을 공유 헬퍼로 통합.
4. `@ApiExcludeEndpoint()` + 파이프 없음 조합의 fixture(`excludedPipeless`)를 추가해 런타임 축 미면제를 독립적으로 검증.
5. (낮은 우선순위) `rotate-bot-token` e2e에 malformed UUID→400 `VALIDATION_ERROR` 케이스 추가.
6. (선택) `ParseUUIDPipe` 텍스트 부분일치 판정에 한계 명시 주석 추가, fixture 헤더 주석의 스캔 격리 범위 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **전원 결과 확보됨(누락 없음)**.
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff에 성능 민감 경로(핫패스 루프·쿼리 변경) 없음 — router 판단 |
  | architecture | 모듈 경계·의존성 구조 변경 없음(데코레이터 추가·문서 정정 수준) — router 판단 |
  | dependency | 신규/버전 변경된 외부 패키지 없음 — router 판단 |
  | database | 스키마·쿼리·마이그레이션 변경 없음 — router 판단 |
  | concurrency | 동시성 관련 로직(락·트랜잭션·비동기 경합) 변경 없음 — router 판단 |