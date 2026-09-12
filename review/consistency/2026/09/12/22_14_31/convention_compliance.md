# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 메모

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/` 델타는 **0개 파일**(정상 — 이 브랜치는 코드 전용 PR). 실제 구현 diff(17개
  파일 / 1,050줄, `codebase/backend/src/modules/{auth,triggers}` · `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe*` ·
  `codebase/frontend/src/content/docs/**` · `codebase/frontend/src/lib/i18n/**` · `CHANGELOG.md` ·
  `plan/in-progress/*.md`)를 프롬프트 번들(예산 절단으로 diff 본문 미탑재)이 아니라 워킹트리
  절대경로(`git -C .../trigger-uuid-and-guide-codes diff/show`, `Read`)로 직접 대조했다.
- 대상 작업: `rotateBotToken`(`triggers.controller.ts`)·`switchWorkspace`(`auth.controller.ts`)의
  `:id` UUID 경로 파라미터에 `ParseUUIDPipe`+`@ApiParam({format:'uuid'})` 두 축을 보강하고,
  이를 저장소 전수로 강제하는 `param-uuid-pipe` 정적 가드를 신설. 유저 가이드(`content/docs/**`)와
  `backend-labels.ts`에 실재하지 않는/오귀속된 에러 코드 표기를 정정.

## 발견사항

- **[WARNING] `15-chat-channel.md §5.4` 에러 카탈로그가 신규 `400 VALIDATION_ERROR` 행을 아직 반영하지 않음**
  - target 위치: 코드 변경 자체는 `spec/5-system/` 밖(`codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken`)이지만, 그 엔드포인트의 오류 카탈로그 SoT 는 `spec/5-system/15-chat-channel.md §5.4`(및 인접 §5.4.1)다.
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3`/`§5.4`(에러 응답·부재 표현 SoT) 및 그 카탈로그를 소유하는 `15-chat-channel.md §5.4` 표.
  - 상세: 이번 PR 로 `:id` 가 UUID 형식이 아니면 `400 VALIDATION_ERROR` 를 내는 **새 관측 가능 동작**이 생겼다(종전 500 마스킹 → 400). `triggers.controller.ts` 의 `@ApiBadRequestResponse` description·`CHANGELOG.md`·유저 가이드(`telegram{,.en}.mdx`, `02-nodes/triggers{,.en}.mdx`) 는 모두 이 행을 반영했으나, `spec/5-system/15-chat-channel.md §5.4` 의 rotate-bot-token 에러 표에는 아직 이 행이 없다 — API 응답 카탈로그의 SoT 문서가 실제 계약보다 좁다.
  - 제안: 코드 수정은 없음(이미 완료). `spec/5-system/15-chat-channel.md §5.4` 에 `400 VALIDATION_ERROR — :id 가 UUID 형식이 아님` 행 추가는 **project-planner** 소관(CLAUDE.md 의 spec 쓰기 권한 경계) — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-12 등재, "`§5.4` 표에 신규 400 행 없음" / "실제 코드는 `RESOURCE_NOT_FOUND`" 항목들, `/ai-review` `20_26_58`·`21_20_01`·`21_41_49`·`22_03_45` SPEC-DRIFT 로 반복 확인)에 planner 항목으로 정확히 등재돼 있다. 신규 지적이 아니라 기존 추적 항목의 재확인.

- **[WARNING] `swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 명시하지 않음**
  - target 위치: `spec/conventions/swagger.md §5-4` 새 엔드포인트 체크리스트 — "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용" 항목.
  - 위반 규약: 자기 자신(해당 조항)이 "문서 축"만 요구하고 "런타임 축"(`ParseUUIDPipe`)을 언급하지 않아, 이번에 발견된 결함(`rotateBotToken` 이 파이프 없이 500 마스킹)류가 이 체크리스트만으로는 재발을 막지 못한다.
  - 상세: 신규 `param-uuid-pipe` 가드가 실제로는 두 축(런타임/문서)을 함께 강제하도록 설계됐는데, 그 근거 규약인 `swagger.md §5-4` 조항 문면은 한 축만 적고 있어 규약과 시행 코드의 요구 범위가 어긋난다. 코드(가드)가 규약보다 엄격한 방향이라 즉각적 위험은 없으나, 사람이 이 체크리스트만 보고 새 엔드포인트를 작성하면 런타임 축을 놓칠 수 있다.
  - 제안: `swagger.md §5-4` 항목을 "`@Param(name, ParseUUIDPipe)` + `@ApiParam({format:'uuid'})` 두 축 모두 적용"으로 확장 — project-planner 소관. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-12 등재, "`swagger.md §5-4` 체크리스트가 UUID 경로 파라미터의 런타임 축을 안 적는다")에 planner 항목으로 등재돼 있다. 신규 지적이 아니라 기존 추적 항목의 재확인.

## 준수 확인 (구체적으로 대조한 항목 — 위반 없음)

- **`@ApiParam({ name, description, format: 'uuid' })` 형태** — `swagger.md §2-3`/`§5-4` 의 예시(`@ApiParam({ name: 'id', description: '워크플로우 UUID', format: 'uuid' })`)와 `triggers.controller.ts`/`auth.controller.ts` 의 신규 선언이 키 순서·값까지 정확히 일치.
- **`repo-guards/__tests__/` 신규 파일 명명** — `param-uuid-pipe-guard.ts` / `param-uuid-pipe.spec.ts` / `fixtures/param-uuid-pipe/sample.controller.ts` 가 기존 저장소 관례(`<kebab-name>-guard.ts` + `<kebab-name>.spec.ts` + `fixtures/<kebab-name>/…`, 예: `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`)와 동형.
- **에러 코드 명명** — 신규/정정된 코드(`VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`)는 `2-api-convention.md` 의 상태코드 기본값 표(`400=VALIDATION_ERROR`, `404=RESOURCE_NOT_FOUND`)에 등재된 canonical 시스템 전역 코드 — `error-codes.md §1` 의 UPPER_SNAKE_CASE 명명도 준수.
- **`TRIGGER_NOT_FOUND` 재귀속 정정** — 정정 후 서술("유일한 발신처는 hooks.service.ts 인입 webhook 경로")이 `spec/data-flow/10-triggers.md:74`(`404 TRIGGER_NOT_FOUND`)와 실제로 일치함을 확인. `triggers.controller.ts` 의 REST 404 는 실제로 `RESOURCE_NOT_FOUND`(`@ApiNotFoundResponse` 문면)만 선언 — 정정이 사실과 부합.
- **리뷰 인용 형식(`review-citations.md §2`)** — 이번 PR 이 신규 추가한 코드 주석의 리뷰 인용은 전부 `review/code/YYYY/MM/DD/hh_mm_ss` 전체 경로 형태(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`, `sample.controller.ts`, `triggers.controller.spec.ts`) — bare `hh_mm_ss` 없음. 저장소에 남아 있는 bare 인용(`swagger-dto-contract-guard.ts` 등)은 이 PR 이 만지지 않은 기존 파일이라 스코프 밖.
- **JSDoc vs `//` 주석 경계(`review-citations.md §3`)** — `triggers.controller.ts`/`auth.controller.ts` 의 신규 설명(리뷰 인용 없음이긴 하나 "왜"를 담은 서술)은 데코레이터 **바로 위 `//` 라인 주석**으로 배치돼 OpenAPI `description` JSDoc 오염을 피함 — `swagger.md §3`/`review-citations.md §3` 의 경계와 일치.
- **CHANGELOG 형식** — 신규 항목이 인접 항목과 동일한 `## Unreleased — **Behavior change**: <제목>` 패턴 준수.
- **i18n/유저가이드 (`i18n-userguide.md`)** — 신규 KO 문장은 해요체(Principle 6) 준수, 글로서리 금지어 미사용. `Principle 6-B`(내부 SoT 노출 금지) 대상인 `spec/` 경로·`plan/` 경로·`CCH-XX`/`R-XX` id·`ERROR_KO` 등 매핑 테이블명이 신규 mdx 본문에 노출되지 않음을 확인(코드 주석에만 `R-CC-23` 등장, 사용자 문서엔 미노출). ko/en sibling 양쪽 동시 수정(Principle 5) 확인.
- **환경변수 오기 정정** — `MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL` 정정이 실제 코드(`mcp.config.spec.ts`, `mcp-tool-provider.ts`, `.env.example`)와 일치.
- **거버넌스 경계** — 이번 PR 이 발견한 두 spec-drift(위 WARNING 2건)는 developer 가 spec 을 직접 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재만 했다 — CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙 준수(자기-반증형 소정정 예외 조건 불충족이므로 예외 미적용도 올바름).

## 요약

이번 PR 의 실제 코드·문서 변경(`ParseUUIDPipe`+`@ApiParam({format:'uuid'})` 두 축 보강, 신규 정적 가드, 유저 가이드·`backend-labels.ts` 의 오귀속 에러 코드 정정, 환경변수 오기 수정)은 명명 규약·에러 코드 카탈로그·API 문서(Swagger) 데코레이터 패턴·리뷰 인용 형식·i18n/유저가이드 규약을 모두 정확히 준수한다. 유일하게 남은 간극은 `spec/5-system/15-chat-channel.md §5.4` 에러 카탈로그와 `spec/conventions/swagger.md §5-4` 체크리스트가 이번에 새로 확정된 동작(비-UUID `:id` → 400)을 아직 반영하지 못한 것인데, 둘 다 developer 권한 밖(spec 쓰기는 project-planner 소관)이라 이미 추적 plan 에 정확히 등재돼 있어 절차상 결함이 아니라 처리 대기 상태다. `spec/5-system/` 델타 0 은 이 PR 의 성격(코드 전용)에 정상이며 그 자체로 결함이 아니다.

## 위험도
LOW
