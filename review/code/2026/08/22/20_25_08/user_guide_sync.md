# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 19개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(127-197행)을 Read 했다.

## 변경 범위 확인
`git diff --stat origin/main...HEAD` 로 이번 changeset 전체를 실측했다. 실제 코드 변경은 여전히 4개
backend TS 파일뿐이며, 여러 라운드에 걸쳐 다른 reviewer(`documentation`/`security`/`side_effect`/
`testing`/`maintainability`/`scope`)와 이전 `user_guide_sync` 라운드(`review/code/2026/08/22/20_05_07/
user_guide_sync.md`)가 이미 교차 검증한 대로 **실행 가능한 코드 라인 변경은 0줄**이다(JSDoc·인라인
주석·Swagger `description` 문자열만 추가/치환):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL`
  기존 3개 항목(`missing_required`/`coerce_failed`/`invalid_schema`)에 JSDoc 추가. code 값 자체는 무변경.
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` —
  `resolveTriggerParameters` 함수 JSDoc 블록에 wrapper 역참조 단락 추가. 시그니처·로직 무변경.
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride` 의
  `@ApiPropertyOptional({ description })` 문자열만 변경. 이번 리뷰 시점 최신 상태(HEAD `a578366c7`)는
  `swagger.md §3` 길이 가이드(150자) 안으로 129자로 재단됐고 `SoT: EIA §R17` 링크를 유지한다.
  검증 데코레이터(`@IsOptional`/`@IsObject`)·타입 무변경.
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` catch 블록 인라인 주석
  영→한 치환, 근거("`errors` 가 아니라 `details`") 보존. 로직 무변경.
- 나머지(`plan/**`, `review/**`, spec frontmatter `code:` 목록 1줄)는 문서/추적 산출물.

`origin/main...HEAD` 델타 중 이전 `20_05_07` user_guide_sync 라운드 **이후** 추가된 커밋(`4a1c8bc48`,
`a578366c7`)도 직접 확인했다 — 둘 다 동일 `re-run.dto.ts` description 문자열을 규약(`swagger.md §3`)
형식에 맞게 더 다듬은 것뿐이고(304→236→129자), 새 파일·새 코드 경로·새 사용자 가시 동작은 없다.

## trigger 매칭 판정

- **새 노드 추가 / 노드 schema 변경** — 변경 파일이 `codebase/backend/src/nodes/**` 밖. 매칭 없음.
- **신규 UI 문자열(TSX)** — `.tsx` 변경 0건. 매칭 없음.
- **통합/제공자 변경, 신규 섹션 디렉토리, 인증·세션 흐름, 표현식 언어 변경** — 해당 경로
  (`06-integrations-and-config`, `docs/<NN>-*/`, `auth/**`, `packages/expression-engine/**`) 무관.
  매칭 없음.
- **실행·디버깅 흐름 변경** — `execution-engine/` 경로상 근접하나, 조건 분기·반환값·throw 대상 변경이
  0줄이라 "흐름 변경"의 실체가 없다(순수 comment). `05-run-and-debug/` 동반 갱신 요구 근거 없음.
  참고로 기존 `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:134,159` 는 이미
  Re-run 의 마스킹 프리필 방지 UI 동작을 설명하고 있어(이번 diff 이전부터 존재), 이번 백엔드 문서화만으로
  갱신할 신규 사용자 가시 사실이 없다.
- **신규 warningCode/errorCode 발행** — `REASON_TO_DETAIL` 의 3개 code 값(`MISSING_REQUIRED_FIELD`/
  `TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)은 이번 diff 이전부터 존재(주석만 추가). `backend-labels.ts`
  `WARNING_KO`/`ERROR_KO` 매핑 갱신 대상 아님.
- **백엔드 API 추가·변경**(`doc-sync-matrix.json` id=`backend-api-change`, trigger glob:
  `*.controller.ts`, `dto/**`) — `workflows.controller.ts`·`re-run.dto.ts` 양쪽이 glob 에 걸린다.
  Target (a) "controller·DTO 의 swagger jsdoc" 은 이번 diff 자체가 채웠다(재제출 거부 규칙을
  description 에 명시). Target (b) "user-guide 페이지" 관점의 유일한 잔여 비대칭(`execute()` 엔드포인트가
  같은 마커 거부 규칙인데 인라인 body 라 Swagger 보강 자리가 없음)은 신규 발견이 아니라 이전 라운드
  (`19_25_39` documentation WARNING → RESOLUTION W2)에서 스코프 밖으로 판정되고
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:846-852`(체크박스 `[ ]`, 미해결로 명시
  트래킹, "고칠 때 `re-run.dto.ts` 의 설명을 이식" 지시까지 기재)에 등재된 상태다. 재등재 불요.

## 발견사항

없음 — CRITICAL·WARNING 대상 없음. 위 "잔여 비대칭"은 이미 트래커(`spec-sync-external-interaction-api-
gaps.md`)에 근거와 함께 등재돼 있어 이 리뷰 관점에서 새로 열 항목이 아니다(INFO 조차 재기재하지 않음 —
직전 라운드가 이미 INFO 로 남겼고 상태 변화 없음).

## 요약
매트릭스 19개 행 중 glob/semantic 매칭 후보는 `backend-api-change` 1개(controller.ts + dto/** 경유)뿐이며,
그 target(swagger jsdoc)은 이번 diff 자체가 채운 것이다. 4개 backend 파일 전부 JSDoc/Swagger
description/인라인 주석만 바꾸고 실행 코드는 0줄 변경돼(여러 reviewer 독립 실측 + 이전
`user_guide_sync`(`20_05_07`) 라운드와 이번 라운드가 동일 결론), 노드 추가·schema 변경·신규 UI 문자열·
통합/제공자 변경·신규 섹션 디렉토리·인증 흐름·표현식 언어·신규 warning/error code 어느 trigger 에도
해당하지 않는다. 유일한 잔여 gap(`execute()` 엔드포인트의 Swagger 마커 설명 부재)은 이미 별도 트래커
항목으로 등재·유예 사유까지 기록된 상태라 이 리뷰 관점에서 새로 열 CRITICAL/WARNING 은 없다. 해당 없음.

## 위험도
NONE
