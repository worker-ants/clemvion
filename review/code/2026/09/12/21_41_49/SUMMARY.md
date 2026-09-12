# Code Review 통합 보고서

## 전체 위험도
**LOW** — `rotateBotToken` `:id` 에 누락됐던 `ParseUUIDPipe`(+문서 축) 를 형제 엔드포인트와 맞추고 이를 AST 전수 가드·HTTP 왕복 테스트로 고정한 변경. 14개 reviewer 전원이 실행되었고(router 미사용, forced 7명 전원 결과 확보 — 강제 화이트리스트 미이행 없음), CRITICAL 은 0건이다. WARNING 은 모두 (a) 이미 plan 에 SPEC-DRIFT 로 등재된 spec 문서 갱신 지연, (b) CHANGELOG 로 이미 disclose 된 의도된 breaking change(500→400), (c) 가드 주석의 실측 수치 오프바이원 1건, (d) 배치 범위 밖 곁가지 수정 1건으로, 즉시 차단할 결함은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| (없음) | — | — | — | — |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `rotateBotToken` 의 신규 `400 VALIDATION_ERROR`(`:id` 비-UUID) 분기가 §5.4 실패 응답 표에 없음 — 코드(`ParseUUIDPipe`)와 `@ApiBadRequestResponse`·CHANGELOG 는 반영됐으나 canonical 표만 낡음 | `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 | `\| 400 \| VALIDATION_ERROR \| :id 가 UUID 형식이 아님 \|` 행 추가. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에 planner 소관 항목으로 등재됨(자기-반증형 소정정 조건1 미충족 — developer 가 직접 고치지 않은 것이 올바른 판단). 중복 등재 불요 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `swagger.md §5-4` 새 엔드포인트 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않음 — 신규 가드는 런타임+문서 두 축을 베이스라인 0 으로 강제하는데 규약 문서는 문서 축만 요구 | `spec/conventions/swagger.md:493` §5-4 체크리스트 | `@Param('<id>', ParseUUIDPipe)` 항목 추가 + §2-3 예시 반영. 동일 사유로 이미 두 plan 문서에 planner 소관 등재됨 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / side_effect | `rotateBotToken` 비-UUID `:id` 응답이 `500`→`400` 으로 바뀌는 **공개 API 계약 변경**(breaking change). 저장소 내 유일한 소비자(프런트엔드 토스트)는 status 를 분기하지 않아 무영향임을 실측했으나, 저장소 밖 자동화/모니터링이 5xx 를 재시도 트리거로 쓴다면 신호가 사라질 수 있음 | `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`rotateBotToken`) | 이미 `CHANGELOG.md`(Unreleased — Behavior change)에 disclose 되어 있어 추가 조치 불요. 배포 노트에 이 status 변경을 눈에 띄게 유지할 것 |
| 2 | documentation | 신규 가드 주석의 실측 수치가 오프바이원 — "135건이 107:28 로 갈린다" 라 적었으나 재측정 결과 실제는 **136건, 108:28**(같은 파일 다른 곳의 "id-형 136건" 서술과도 불일치). 바로 위 docstring 이 "측정 시점·범위를 함께 적으라"는 자기 교훈을 남긴 직후 두 줄 아래에서 재발 | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:148` | `135건이 107:28` → `136건이 108:28` 로 정정. 동작 영향은 없으나 "베이스라인 0" 가드의 근거 수치라 다음 사람이 그대로 인용할 위험이 있음 |
| 3 | scope | MCP 서버 통합 문서의 환경변수 오타 수정(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`)이 "트리거 UUID + chat-channel 가이드 코드" 배치 범위와 무관한 서브시스템을 건드림. 정정 자체는 정확(실측 확인)하나 "가이드 UPPER_SNAKE 토큰 전수 스윕" 중 곁가지로 발견해 같은 커밋에 섞임 | `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers{,.en}.mdx` | 되돌릴 필요는 없음(정확·사소). 향후 유사 케이스는 커밋 메시지에 "부수적으로 무관 서브시스템 오타 1건 수정" 명시 권장 |
| 4 | architecture (참고) | SQLSTATE 22P02 분류가 `GlobalExceptionFilter` 라는 공유 seam 이 아니라 개별 진입점(`@Param` 파이프)에 반복 배치되는 구조로 남음 — `@Query()`/body 필드로 유입되는 파싱 불가 UUID 는 여전히 500 마스킹에 노출 | `codebase/backend/src/common/filters/http-exception.filter.ts` | 이번 PR 이 만든 결함이 아니라 기존 갭이며 `plan/in-progress/spec-draft-nullable-notation-followups.md:3168` 에 이미 후속 항목(전 엔드포인트 영향 전수 선행 필요)으로 등재됨. 신규 조치 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | 신규 가드 spec 의 두 `it` 블록이 동일한 전수 AST 스캔(`scanUuidParams(files, SRC_ROOT)`)을 캐싱 없이 두 번 호출 (대조군 블록은 이미 1회 캐싱 패턴을 씀) | `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:57-77` | `describe` 상단에서 1회 계산 후 재사용하도록 통합 (35파일 규모라 영향 미미) |
| 2 | architecture / testing | 가드의 `ParseUUIDPipe` 존재 판정이 심볼 해석이 아닌 텍스트 부분일치(`pipes.includes('ParseUUIDPipe')`) — 별칭 import 나 비-리터럴 `format` 표현식은 fixture 로 검증되지 않음 | `param-uuid-pipe-guard.ts:93-97,149` | 실측(전수 리터럴/별칭 0건)이 뒷받침하는 동안은 안전. fixture 에 비-리터럴 케이스 한 자리 추가하면 향후 경계 완화를 캐너리로 잡을 수 있음 |
| 3 | maintainability | vacuity floor 매직 넘버(30, 100) 이름 없음 / `missing` 필드 "정렬" 주석이 실제로는 고정 push 순서 / `apiParamUuidFlags` 함수명이 반환 의미(파라미터명→uuid-format 여부)를 다 담지 못함 | `param-uuid-pipe.spec.ts:60,66`, `param-uuid-pipe-guard.ts:26,79` | 상수명 부여, 주석을 "고정 순서"로 정정, 함수명 구체화(`apiParamUuidFormatByName` 등) — 모두 낮은 우선순위 |
| 4 | security | 신규 가드 fixture 의 `_test/backdoor`, `_test/backdoor-pipeless` 명칭이 시크릿 스캐너 오탐 유발 가능(실제로는 프로덕션 미등록, 스캔 루트 밖의 반대방향 캐너리) | `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` | 기능상 조치 불필요, 파일 상단 설명 주석으로 충분 |
| 5 | scope | 신규 리포지토리 전역 가드의 베이스라인-0 정책이 무관한 `auth.controller.ts`(`switchWorkspace` `@ApiParam`)까지 같은 커밋에서 수정하게 만듦 (허용목록 회피가 근거, 3줄 최소 변경) | `codebase/backend/src/modules/auth/auth.controller.ts:433-440` | 근거 문서화 충분. "신규 전역 가드 도입 → 기존 위반 전수 수정" 패턴은 리뷰 시 별도 언급 가치 있음 |
| 6 | scope | `triggers.mdx`/`.en.mdx` 콜아웃에 식별자 교정을 넘어 "이 코드들은 API 직접 호출 시에만 보이고 UI 는 고정 실패 메시지" 라는 신규 설명 문단 추가 (인접 문장의 실측 오류를 함께 정정) | `.../triggers.mdx:463-465`, `.en.mdx:450-452` | 문제 수준 아님. PR 설명에 "식별자 정정과 별개로 발견된 문서-구현 불일치 정정"임을 한 줄 명시 권장 |
| 7 | documentation | CHANGELOG 가 500→400 동작 변경만 다루고, 가이드 오류 코드 정정(6곳)·`MCP_ALLOW_INSECURE_URL` 오기 정정(문서-only, 비-동작 변경)은 언급 없음 | `CHANGELOG.md:3` | 선택적 개선. 완결성을 위해 "가이드 문서 오기 정정(비-동작 변경)" 한 줄 추가 가능 |
| 8 | testing / user_guide_sync | 가이드 문서가 서술하는 식별자(에러 코드·환경변수)의 실재 여부를 자동으로 세는 가드가 아직 없음 — 이번 배치는 1회성 수작업 스윕으로만 정정 | `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B | developer 자신이 이미 plan 에 후속 항목으로 등재함. 이번 라운드 추가 조치 불요 |
| 9 | dependency / database / concurrency | 신규 외부 의존성 없음(기존 devDependency·유틸 재사용), 원시 SQL/스키마 변경 없음(오히려 불필요한 DB 왕복 감소), 공유 가변 상태·락·비동기 경합 없음 — 세 관점 모두 위험 없음 확인 | 전체 diff | 조치 불필요 |
| 10 | user_guide_sync | doc-sync-matrix 21행 중 `backend-api-change` 1건이 매칭되었고 대상 mdx 4파일 모두 실제로 동반 갱신됨을 diff 대조로 확인. 신설된 `VALIDATION_ERROR`/`RESOURCE_NOT_FOUND` 는 UI 가 코드를 렌더하지 않아(고정 문자열) 영문 노출 위험 없음 | `codebase/frontend/src/content/docs/**` | 조치 불필요 — 누락 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `ParseUUIDPipe` 추가는 순수 보안 개선. 신규 가드는 재발 차단. 하드코딩 시크릿·인젝션 없음 |
| performance | NONE | 프로덕션 로직 영향 없음. 가드 테스트 중복 스캔(INFO)만 존재 |
| architecture | LOW | 레이어 책임 정상화(긍정). 22P02 공유 seam 부재는 기존 갭(WARNING, 이미 등재) |
| requirement | LOW | 핵심 변경·테스트 전부 실행 검증 완료. spec 표/체크리스트 2건 SPEC-DRIFT(이미 planner 백로그) |
| scope | LOW | 핵심 diff 는 plan 범위와 일치. MCP 문서·auth.controller·mdx 신규 문단 3건이 범위 한 칸 넓음(근거 문서화됨) |
| side_effect | LOW | 유일한 실질 부작용은 500→400 breaking change(disclose 됨). 나머지는 test-scoped/문서 |
| maintainability | NONE | 설계 양호(중첩·카운터 드리프트 이전 라운드에 이미 해소). 매직넘버·네이밍 INFO 수준 |
| testing | LOW | 이중 방어(AST 가드 + HTTP 왕복) 실행 검증 완료. 비-리터럴 fixture 갭은 INFO |
| documentation | LOW | 전반적으로 완성도 높음. 가드 주석 오프바이원 수치 오류 1건(WARNING) |
| dependency | NONE | 신규 외부 의존성 0, 기존 패턴 재사용만 |
| database | NONE | 스키마/쿼리 변경 없음, DB 왕복 오히려 감소 |
| concurrency | NONE | 선언적 변경 + 순수 동기 가드 + 순차 테스트, 해당 없음 |
| api_contract | LOW | breaking change 실측 검증(영향 없음 확인), 문서·에러코드 정합 개선 |
| user_guide_sync | NONE | 매트릭스 매칭 1건 전부 동반 갱신 확인, 누락 없음 |

## 발견 없는 에이전트

- concurrency (해당 없음 명시)
- user_guide_sync (발견사항 없음 명시)

## 권장 조치사항

1. `param-uuid-pipe-guard.ts:148` 주석의 실측 수치를 `135건 107:28` → `136건 108:28` 로 정정한다 (documentation WARNING #2, 소규모·즉시 가능).
2. `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표와 `spec/conventions/swagger.md §5-4` 체크리스트 갱신은 이미 planner 소관 plan 항목으로 등재되어 있으므로, 다음 project-planner 턴에서 처리한다 (SPEC-DRIFT #1, #2 — developer 가 직접 고치지 않는 것이 규약상 올바름).
3. `rotateBotToken` 의 500→400 breaking change 는 이미 CHANGELOG 에 disclose 되어 있으니 추가 코드 조치는 불필요하되, 릴리스 공지에도 동일 경고를 전파할 것을 권장한다.
4. `GlobalExceptionFilter` 의 SQLSTATE 22P02 미분류(공유 seam 부재)는 기존에 등재된 후속 과제이므로 전수 영향 분석을 선행한 뒤 별도 PR 로 처리한다.
5. 나머지 INFO 항목(매직넘버 네이밍, 가드 fixture 명칭, 중복 스캔, CHANGELOG 완결성 등)은 낮은 우선순위로 다음 유지보수 라운드에서 선택적으로 반영한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 확인(forced 미이행 없음)