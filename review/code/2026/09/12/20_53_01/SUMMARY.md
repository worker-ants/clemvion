# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. `rotateBotToken` 의 `:id` UUID 검증 누락(500 마스킹→400 정정)은 견고하게 처리됐고 회귀 가드(AST 전수 스캔, baseline 0)도 확보됨. 다만 (1) 이번 PR 이 함께 고친 두 결함 클래스 중 하나(가이드 MDX/i18n 라벨의 잘못된 식별자)는 자동 회귀 가드를 못 얻었고, (2) `rotateBotToken` 이 새로 노출하는 `400 VALIDATION_ERROR` 케이스가 user-guide MDX 4곳에 반영되지 않았으며, (3) 신규 가드 함수의 AST 순회 중첩이 다소 깊다 — 3건 모두 WARNING. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | user_guide_sync | `rotateBotToken` 이 새로 노출하는 `400 VALIDATION_ERROR`(malformed `:id`)가 user-guide MDX 에 반영되지 않음 — 이번 diff 가 바로 그 줄을 다른 이유(404 코드 오귀속 정정)로 편집했음에도 400 케이스 추가를 놓침 | `codebase/frontend/src/content/docs/02-nodes/triggers.{mdx,en.mdx}` (Callout), `.../06-integrations-and-config/telegram.{mdx,en.mdx}` §6 "에러/Errors" 목록 | 각 파일에 "`:id` 가 UUID 형식이 아니면 400 `VALIDATION_ERROR`" 문장/항목 추가. `content/docs/**` 는 `codebase/frontend/**` 하위라 developer 권한 안 — 이번 PR 내에서 바로 닫을 수 있음 |
| 2 | testing | 같은 PR 이 고친 두 결함 클래스(선언/문서와 실제가 조용히 어긋남) 중 하나(`ParseUUIDPipe` 누락)만 AST 전수 회귀 가드를 얻었고, 다른 하나(가이드 MDX·`backend-labels.ts` 의 잘못된 에러코드/env var 식별자)는 정규식 스윕으로 수동 정정만 됨 — 이 결함 클래스 자체가 "4개월간 아무도 몰랐다" 방식으로 존재해 왔다는 게 재발 위험의 근거 | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §C, MDX 6곳 + `backend-labels.ts` | `content/docs/**` 의 에러코드/env var 토큰이 backend 소스에 실재하는지 검증하는 경량 가드(순수 판정 함수 + 정적 스캔 + vacuity floor)를 후속 항목으로 명시하거나 plan §C 처분에 못박기 |
| 3 | maintainability | 신규 가드 판정 함수(`scanUuidParams`/`visit`)의 AST 순회가 "메서드→파라미터→데코레이터" 세 층위를 한 함수 안에서 순차로 뚫어 중첩 5단계에 달함 | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:146-182` | `visit` 내부 메서드-단위 처리 블록을 `collectMethodViolations(method, sf, rel)` 같은 별도 함수로 추출해 순회/판정 분리 (기능 결함 아님, 로직은 뮤테이션 6/6 검증됨) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표에 신규 `400 VALIDATION_ERROR`(`:id` 형식 오류) 행이 없음 — 코드는 정확(`ParseUUIDPipe`→`HttpException`400→`VALIDATION_ERROR` 재현 확인)하고 spec 표만 뒤처짐 | `spec/5-system/15-chat-channel.md:369-379` | 코드 유지 + spec 반영. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재(자기-반증형 소정정 조건 1 미충족으로 developer 직접 수정 불가) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않음 — 신규 가드는 이 축까지 baseline 0 으로 강제해 가드(코드)가 규약(spec)보다 넓은 상태 | `spec/conventions/swagger.md:482-493` | 코드 유지 + spec 반영. 동일 plan 에 planner 항목 등재됨 |
| 3 | 아키텍처 | 방어선이 "파이프 + 정적가드" 단일 계층에만 의존 — `GlobalExceptionFilter` 에 `QueryFailedError`(22P02)→400 매핑 안전망이 없어, 가드의 이름 휴리스틱(`isIdShaped`) 밖(컬럼은 uuid 인데 파라미터명이 `id`/`*Id` 형태가 아닌 경우 등)에서는 같은 500 마스킹이 재발할 여지가 남음 | `codebase/backend/src/common/filters/http-exception.filter.ts` | 즉시 조치 불요(가드가 baseline 0·전수 커버). 후속으로 `QueryFailedError`(22P02) → 400 매핑 분기를 필터에 추가하면 fail-closed 안전망까지 완성 |
| 4 | 아키텍처 | `ParseUUIDPipe` 탐지가 텍스트 부분일치라 향후 "UUID + 추가 검증"을 겸하는 합성 파이프가 생기면 오탐(false positive) 가능 | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:171` | 지금(별칭 0건 실측)은 안전. 합성 파이프 도입 시점에 가드 갱신 |
| 5 | 리뷰 인프라 | 리뷰 중 두 reviewer(requirement, api_contract)가 독립적으로 `triggers.controller.ts`/신규 가드·스펙에서 일시적 테스트 실패(파이프 제거된 것처럼 관측)를 목격했으나, 재확인 결과 파일은 clean 하고 코드에 결함 없음 — 동시 실행 중인 다른 세션의 뮤테이션 검증(plan M1/M9)과 시점이 겹친 것으로 추정 | `codebase/backend/src/modules/triggers/triggers.controller.ts`, `param-uuid-pipe.spec.ts`, `triggers.controller.spec.ts` | 조치 불요(코드 정상, 자체 원복 확인됨). 병렬 리뷰 인프라 차원에서 뮤테이션 검증 시 워크트리 격리/상호 배제가 필요하다는 기존 교훈 재확인 |
| 6 | 스코프 | `auth.controller.ts`(다른 모듈), MCP 환경변수 오탈자 수정(무관 문서 영역), 단일 결함 대비 상대적으로 큰 재발방지 인프라(가드 3파일 ~400줄) — 3가지 모두 plan 에 사전 근거가 문서화되어 있어 은닉 변경은 아님 | `auth.controller.ts:433-440`, `mcp-servers{,.en}.mdx`, `repo-guards/__tests__/param-uuid-pipe*` | 조치 불요(근거 문서화 충분). PR 설명에 "가드 baseline 0 확보를 위해 auth.controller.ts 1곳도 함께 수정" 한 줄 언급 권장 |
| 7 | 유지보수성 | `missing` 배열 타입을 인덱스드 액세스(`UuidParamViolation['missing'][number][]`)로 표현해 저장소의 다른 가드와 다른 패턴 | `param-uuid-pipe-guard.ts:164` | `type UuidParamAxis = 'ParseUUIDPipe' | "@ApiParam format:'uuid'"` 로 이름 붙여 정의/사용 지점 대칭화 |
| 8 | 유지보수성 | 22P02 마스킹 인과 사슬이 CHANGELOG·컨트롤러 주석·가드 2파일·plan 등 최소 5곳에 거의 동일하게 반복 서술 — 계층적 문서화 관례로 결함은 아니나 향후 필터 조건 변경 시 동기화 비용 | `CHANGELOG.md`, `triggers.controller.ts`, `param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`, `plan/in-progress/trigger-uuid-and-guide-error-codes.md` | 조치 불요. 반복이 더 늘면 정본 서술 한 곳(예: `common/utils/uuid.ts`)으로 수렴 고려 |
| 9 | 테스트 | plan 체크리스트의 `.claude/tools/run-test-all.sh` 전체 회귀 실행 항목이 아직 미체크 — 이 리뷰가 검증한 변경 스펙(20/20, 43/43 등)은 전부 GREEN 이나 backend/frontend/e2e 전체 스위트는 이 PR 기준 미확정 | `plan/in-progress/trigger-uuid-and-guide-error-codes.md:204` | 머지 전 `run-test-all.sh` 전체 실행 결과를 체크리스트에 반영 |
| 10 | 문서화 | `param-uuid-pipe.spec.ts` 헤더 docstring 의 "위반 3건을 전부 고쳐서 0으로 만들었다" 표현이 세 번째 위반(`@ApiExcludeEndpoint()` 구조적 면제)의 실제 처리 방식과 살짝 어긋남(코드 수정이 아니라 구조 판정으로 면제) | `param-uuid-pipe.spec.ts:42` | "전부 처리해(고치거나 구조적으로 면제해) 0으로 만들었다"로 표현 정밀화 |
| 11 | 보안 | 신규 fixture 의 `backdoor` 라우트 명명(`_test/backdoor`, `_test/backdoor-pipeless`) — 프로덕션 미배선(어떤 module 에도 import 안 됨, 스캔 루트 `src/modules` 밖) 확인. 정적 스캐너의 오탐 방지 차원 기록 | `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` | 조치 불요. 향후 이 fixture 가 `src/modules` 아래로 이동/import 되면 재검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `ParseUUIDPipe` 추가는 방어적 입력검증 개선(500 마스킹 해소). 문서 식별자 정정도 보안 중립~긍정적. 신규 취약점 없음 |
| performance | NONE | 파이프 추가는 실패 경로 DB 왕복 제거(개선). 신규 가드는 테스트 전용 1회성 비용, 런타임 경로 무관 |
| architecture | LOW | 방어선이 단일 계층(파이프+가드)이라 필터 레벨 안전망 부재(INFO), 가드가 spec 보다 넓음(이미 등재), 텍스트 매칭 오탐 여지 |
| requirement | LOW | SPEC-DRIFT 2건(§5.4 표, swagger.md §5-4) — 이미 planner 항목 등재됨, Critical 없음. 핵심 인과사슬·실측 수치 전부 재현 검증 |
| scope | LOW | auth.controller.ts·MCP 문서·가드 인프라 규모가 표제 스코프를 넘어섰으나 전부 plan 근거 문서화됨 |
| side_effect | LOW | 500→400 은 관측 가능한 behavior change 지만 CHANGELOG 명시 + 유일 소비자 영향 없음 확인. 나머지 무해 |
| maintainability | LOW | 가드 함수 중첩 깊이(WARNING), 인덱스드 액세스 타입, 반복 서술 |
| testing | LOW | 회귀 가드 비대칭(WARNING), run-test-all.sh 체크리스트 미완료(INFO). 검증한 범위는 뮤테이션 포함 전부 GREEN/RED 예측 일치 |
| documentation | NONE | CHANGELOG·주석·JSDoc 정확도 이례적으로 높음. 사소한 표현 정밀도(INFO) 1건 |
| dependency | NONE | 신규 의존성/lockfile 변경 없음. 신규 import 전부 기존 의존성 재사용 |
| database | NONE | 마이그레이션·쿼리·트랜잭션 관련 변경 없음. 500→400 은 에러 마스킹 수정일 뿐 정합성 문제 아님 |
| concurrency | NONE | 공유 자원·락·병행 실행 관련 코드 없음 |
| api_contract | LOW | behavior change 문서화 모범 사례. SPEC-DRIFT 2건 중복 확인, 병렬 리뷰 시점 충돌로 인한 일시적 오탐 관측(코드 정상) |
| user_guide_sync | LOW | 신규 400 케이스가 user-guide MDX 4곳에 미반영(WARNING). auth.controller.ts 는 문서뿐이라 세션-흐름 갱신 대상 아님(오탐 방지 기록) |

## 발견 없는 에이전트

- dependency — 신규/변경 의존성 없음
- database — 리뷰 대상 코드 없음(마이그레이션·쿼리·트랜잭션 미포함)
- concurrency — 리뷰 대상 코드 없음(공유 자원·락 미포함)

## 권장 조치사항

1. `codebase/frontend/src/content/docs/02-nodes/triggers.{mdx,en.mdx}` Callout 과 `.../06-integrations-and-config/telegram.{mdx,en.mdx}` §6 "에러/Errors" 목록에 신규 `400 VALIDATION_ERROR`(`:id` 형식 오류) 케이스 추가 — developer 권한 안, 이번 PR 내에서 바로 닫을 수 있음 (WARNING #1)
2. 다음 planner 턴에서 `spec/5-system/15-chat-channel.md §5.4` 표에 400 행 추가 + `spec/conventions/swagger.md §5-4` 체크리스트에 `ParseUUIDPipe` 런타임 축 항목 추가 (SPEC-DRIFT #1, #2 — 이미 plan 등재, 우선 처리 재확인)
3. 가이드/i18n 라벨의 잘못된 식별자(에러코드·env var명) 재발을 막는 경량 정적 가드를 후속 항목으로 plan §C 에 명시 (WARNING #2)
4. 머지 전 `.claude/tools/run-test-all.sh` 전체 실행 후 plan 체크리스트 닫기 (INFO #9)
5. (선택, 저위험) `scanUuidParams`/`visit` 를 메서드-단위 처리 함수로 추출해 AST 순회 중첩 완화 (WARNING #3)
6. (후속 고려) `GlobalExceptionFilter` 에 `QueryFailedError`(22P02) → 400 매핑 분기를 추가해 가드의 이름 휴리스틱 밖에서도 fail-closed 안전망 확보 (INFO #3)

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(14명) 실행됨.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음).