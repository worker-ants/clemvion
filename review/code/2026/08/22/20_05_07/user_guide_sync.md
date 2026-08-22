# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 19개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127-197행)을 Read 했다.

## 변경 파일 요약
실제 코드 변경은 4개 backend TS 파일뿐이며, 세 라운드에 걸친 다른 리뷰어(`documentation`/`security`/`side_effect`/`testing`/`maintainability`/`scope`)가 이미 `git diff --stat` 로 교차 검증한 대로 **실행 가능한 코드 라인 변경은 0줄**이다(JSDoc·인라인 주석·Swagger `description` 문자열만 추가/치환):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL` 4항목 중 미문서화 3개에 JSDoc 추가 (`missing_required`/`coerce_failed`/`invalid_schema`, 게이트 40-71). **코드(신규 code 값) 자체는 변경 없음** — 이미 존재하던 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 세 값에 주석만 붙었다. → 신규 warningCode/errorCode 아님.
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` 함수 JSDoc 블록에 wrapper 역참조 단락 추가(게이트 108-124). 시그니처·로직 무변경.
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride` 의 `@ApiPropertyOptional({ description })` 문자열 확장(게이트 19-24). 검증 데코레이터(`@IsOptional`/`@IsObject`)·타입 무변경.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` catch 블록 인라인 주석 영→한 치환(게이트 320-322), 근거("`errors` 가 아니라 `details`") 보존. 로직 무변경.
- 나머지(`plan/**`, `review/**`)는 문서/추적 산출물.

## trigger 매칭 판정

- **새 노드 추가 / 노드 schema 변경** — 변경 파일이 `codebase/backend/src/nodes/**` 밖(→ `execution-engine/`, `executions/`, `workflows/` 모듈). 매칭 없음.
- **신규 UI 문자열(TSX)** — 이번 diff 에 `.tsx` 변경 0건. 매칭 없음.
- **통합/제공자 변경, 신규 섹션 디렉토리, 인증·세션 흐름, 표현식 언어 변경** — 해당 경로(`06-integrations-and-config`, `docs/<NN>-*/`, `auth/**`, `packages/expression-engine/**`) 무관. 매칭 없음.
- **실행·디버깅 흐름 변경** — 변경 파일이 `execution-engine/` 아래 있어 glob 상 근접해 보이지만, 위 4개 리뷰어가 실측한 대로 **조건 분기·반환값·throw 대상 변경 0줄**이라 "흐름 변경"의 실체가 없다. `05-run-and-debug/` 동반 갱신을 요구할 근거(동작 변화) 자체가 diff 안에 없음. 매칭 없음(회색지대 아님 — 명시적으로 grey를 판단할 소지가 없을 만큼 diff 가 순수 comment).
- **신규 warningCode/errorCode 발행** — `REASON_TO_DETAIL` 의 3개 code 값은 이번 diff 이전부터 존재(주석만 추가). `backend-labels.ts` `WARNING_KO`/`ERROR_KO` 매핑 갱신 대상 아님.
- **백엔드 API 추가·변경** (`doc-sync-matrix.json` id=`backend-api-change`, trigger glob: `*.controller.ts`, `dto/**`) — `workflows.controller.ts`(controller)와 `re-run.dto.ts`(dto/**) 양쪽이 glob 에 걸린다. Target (a) "controller·DTO 의 swagger jsdoc" 은 이번 diff 의 본래 목적 그 자체(재실행 시 마스킹 마커 재제출 거부 규칙을 `re-run.dto.ts` description 에 명시)로 **이미 같은 changeset 안에서 충족**됐다.

## 발견사항

- **[INFO]** `backend-api-change` 행의 target (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" 관점에서 잔여 비대칭 1건 확인 — 단, 이미 이번 리뷰 사이클 내에서 식별·처리 완료됨(신규 미처리 아님)
  - 변경 파일: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (Swagger 상세화됨) vs `codebase/backend/src/modules/workflows/workflows.controller.ts` `execute()` 의 인라인 `{ input?; parameterValues?; }` body (Swagger 무보강)
  - 매트릭스 항목: `backend-api-change` — "controller·DTO 의 swagger jsdoc" + PROJECT.md "자주 누락" 절 "API 추가 vs swagger jsdoc 누락 — controller·DTO 의 swagger jsdoc 동반 필수. 빌드 단위 테스트가 일부만 잡음"
  - 누락된 동반 갱신(형식상): `execute()` 의 `@Body()` — 인라인 타입이라 `@ApiBody`/DTO 가 없어 `re-run.dto.ts` 와 동일한 마스킹 마커 예약어 설명을 붙일 자리가 없음
  - 상세: `execute()` 와 `re-run` 은 동일한 `resolveTriggerParametersRejectingMasked` 거부 규칙을 공유하는데, 이번 diff 로 `re-run` 쪽만 Swagger 가 상세해져 API 문서 비대칭이 이번 changeset 으로 **더 두드러졌다**. 다만 이는 동일 리뷰 세션의 `documentation` 리뷰어가 이미 WARNING 으로 지적했고(`review/code/2026/08/22/19_25_39/documentation.md`), `RESOLUTION.md` W2 에서 "DTO 승격은 코스메틱이 아니라 컨트롤러 시그니처 변경이라 이 PR 스코프 밖" 으로 판단해 **의도적으로 미반영**하고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 항목으로 등재(고칠 때 `re-run.dto.ts` 의 설명을 이식하라는 지시까지 포함, diff 파일 6 게이트 836-843)했다. PROJECT.md 가 이 클래스 누락을 "자주 누락" 으로 명시 경고하는 것과 정확히 부합하는 패턴이지만, 이번 건은 **트래커 등재 + 명시적 유예 사유**까지 갖춰 프로세스가 요구하는 대로 처리됐다.
  - 제안: 추가 조치 불요. 이미 `spec-sync-external-interaction-api-gaps.md` 에 "지금 고치지 않는 이유"와 "고칠 때 이식할 내용" 이 함께 기록돼 있어 재등재 불필요.

- **[INFO]** `re-run.dto.ts` Swagger description 이 마스킹 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 SoT(`@workflow/masked-markers` 공유 패키지) 링크 없이 산문으로 재기술
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 매트릭스 항목: 직접 대응 행 없음(회색지대) — i18n dict 나 docs MDX 가 아니라 Swagger 문자열 자체가 SoT 를 재복사하는 패턴이라 매트릭스가 명시적으로 다루는 "동반 갱신" 범주 밖.
  - 상세: 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별도 항목(2026-08-22 등재, requirement W1)으로 기록돼 있고 `maintainability.md`/`testing.md` 리뷰어도 동일하게 INFO 로 확인했다. 신규 결함 아님.
  - 제안: 조치 불요 — 이미 트래킹됨.

## 요약
매트릭스 19개 행 중 glob 매칭 후보는 `backend-api-change` 1개(controller.ts + dto/** 경유)뿐이며, 그 target(swagger jsdoc)은 이번 diff 자체가 채운 것이다. 이번 changeset 은 4개 backend 파일 전부 JSDoc/Swagger description/인라인 주석만 바꾸고 실행 코드는 0줄 변경돼(다른 6개 리뷰어가 독립적으로 실측 확인), 노드 추가·schema 변경·신규 UI 문자열·통합/제공자 변경·신규 섹션 디렉토리·인증 흐름·표현식 언어·신규 warning/error code 어느 trigger 에도 해당하지 않는다. 유일한 잔여 gap(`execute()` 엔드포인트의 Swagger 마커 설명 부재)은 이번 diff 로 비대칭이 더 두드러졌으나, 같은 리뷰 세션에서 이미 WARNING 으로 지적→RESOLUTION 처리→트래커 등재까지 완료된 상태라 이 리뷰 관점에서 새로 열 CRITICAL/WARNING 은 없다.

## 위험도
NONE
