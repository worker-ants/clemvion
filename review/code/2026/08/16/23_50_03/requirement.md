STATUS=success requirement review complete — CRITICAL 0 · WARNING 0 · INFO 2
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `23_08_19` ai-review 8건 후속 조치 + `background-runs` inputData/outputData 마스킹

이 diff 는 이전 라운드(`review/code/2026/08/16/23_08_19`)가 낸 CRITICAL 0 · WARNING 8 을 그
라운드의 `RESOLUTION.md` 가 "8건 전부 이 PR 안에서 조치(이연 0건)" 라 주장하는 상태를 담고
있다. requirement reviewer 로서 그 주장을 코드/spec/테스트를 직접 열어 독립적으로 재검증했다
(리뷰 산출물 텍스트만 신뢰하지 않음).

## 검증 방법

- `codebase/backend/src/modules/websocket/websocket.service.ts`,
  `.../shared/utils/sanitize-error-message.ts`,
  `.../modules/executions/executions.service.ts`,
  `.../modules/executions/background-runs/background-runs.service.ts` 전체를 `Read` 로 직접 열어
  `RESOLUTION.md` 의 8개 항목이 실제 코드에 반영됐는지 line-level 로 대조.
- `spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md`,
  `12-webhook.md` §5.3 을 grep/Read 로 열어 이전 라운드가 SPEC-DRIFT 로 지적한 두 잔여
  불릿(①·②)이 실제로 flip 됐는지 확인.
- `plan/in-progress/eia-fanout-and-internal-data-masking.md`,
  `spec-sync-external-interaction-api-gaps.md` 의 체크리스트·frontmatter(`spec_impact`) 확인.
- 신규/변경 테스트 5개 파일(`sanitize-error-message.spec.ts`, `redact-stored-error.spec.ts`,
  `websocket.service.spec.ts`, `background-runs.service.spec.ts`, `executions.service.spec.ts`)을
  `npx jest` 로 실제 실행 — **181 tests, 5 suites 전부 PASS**(vacuous 여부 확인을 겸함).

## 발견사항

재검증 결과 이전 라운드의 8개 WARNING 은 **전부 실제로 코드/spec/테스트에 반영돼 있다**:

- SPEC-DRIFT(§R17 잔여 ①·②) → `14-external-interaction-api.md:1523,1526` 이 `~~잔여 ①~~ 해소`,
  `~~잔여 ②~~ 해소` 로 flip 되어 있고, `6-websocket-protocol.md:184,193` 에 wire 마스킹 캐비엇이
  신설돼 있다. `eia-fanout-and-internal-data-masking.md` frontmatter 에 `spec_impact` 3개 문서가
  추가돼 있다(`:10-13`).
- Swagger 문서 갭 → `execution-response.dto.ts`(`ExecutionDto.inputData/outputData`,
  `NodeExecutionSummaryDto.outputData`)와 `background-run-response.dto.ts`
  (`BackgroundRunNodeExecutionDto.inputData/outputData`) 전부 `error` 필드와 동형의 마스킹
  캐비엇 + SoT 링크가 붙었다.
- plan 자기모순(표는 fanout-only, 구현은 wire+fanout) →
  `eia-fanout-and-internal-data-masking.md` 상단 표가 `~~fanout 브랜치에만~~ → wire + fanout
  둘 다` 로 갱신됐다.
- `redactStoredDataForResponse` 전용 유닛테스트 부재 → `redact-stored-error.spec.ts` 에
  `describe('redactStoredDataForResponse', …)` 8건(값 마스킹·중첩 키·null 정규화·비변이·
  copy-on-change·마커 보존 캐너리·잔여 갭 캐너리·무손상 캐너리) 신설, 전부 PASS.
- `findById` 3-컬럼 copy-on-change 참조 동일성 미검증 →
  `executions.service.spec.ts:1272` `⑥-b` 가 `inputData`/`outputData` 만 leaky 한 행을 섞어
  참조 동일성(`toBe`/`not.toBe`)으로 가른다 — `inputData === ne.inputData` 항이 빠지는 뮤턴트를
  포착할 수 있는 형태로 실제로 확인했다(코드 리뷰 시점에 해당 비교 항이 `executions.service.ts:691-693`
  에 살아있음을 직접 대조).
- 마커 리터럴 파편화 → `sanitize-error-message.ts` 가 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER` 를 export 하고, `websocket.service.ts` 가 그 상수를 **import 해서**
  `sanitizeInner` 내부에서 씀(`websocket.service.ts:10-13`, `:109`, `:139`) — 하드코딩 리터럴이
  제거됐다.
- `findById` 3필드 반복 → `maskIfPresent` 헬퍼(`executions.service.ts:72-77`)로 축약, 세 호출부가
  모두 이 헬퍼를 씀(`:682-690`).
- CHANGELOG 누락 → `CHANGELOG.md` 최상단에 `## Unreleased — …` 항목이 신설돼 있고 ⚠️ wire
  변화 캐비엇·성능 실측을 포함한다(기존 관례와 형식 일치).

## 잔존 관찰 (INFO — 이번 diff 가 만든 결함 아님, 조치 불필요)

- **[INFO]** `NodeExecutionSummaryDto`(execution 상세 응답의 `nodeExecutions[]`) Swagger 스키마에는
  여전히 `inputData` 필드 선언 자체가 없다(`outputData`·`error` 만 있음).
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (`NodeExecutionSummaryDto` 클래스, `outputData` 선언은 있으나 `inputData` 없음)
  - 상세: 런타임에는 `executions.service.ts` 의 `reconciledNodeExecutions` map 이 `ne.inputData` 에도
    마스킹을 걸지만(`maskIfPresent` 세 필드 중 하나), 이 DTO 클래스 자체에 그 필드가 선언된 적이
    없어 API 문서(OpenAPI)에는 애초에 등장하지 않는다. 이전 라운드(`23_08_19/documentation.md`)가
    이미 INFO 로 등재했고 선존 갭임을 `git log -p` 로 확인했다 — 이번 diff 가 새로 만든 결함이
    아니다. 조치 불요, 참고용 재확인.
- **[INFO]** `sanitize-error-message.ts` 가 `VALUE_MASK_MARKER`('***') 상수를 export 하지만, 실제
  마스킹 결과를 반환하는 세 지점(`redactSecrets:71`, `deepRedactCore` depth 초과
  분기:`226`, `deepRedactObject` credential-key 분기:`258`)은 여전히 `'***'` 리터럴을 직접
  쓴다 — `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 는 일관되게 상수를 쓰는 것과 대조적인 사소한
  비대칭. 값 자체는 동일하고(`VALUE_MASK_MARKER = '***'`) `MASKED_MARKERS` Set 도 같은 상수를
  참조하므로 마커-보존 계약에는 영향 없음(순수 스타일 일관성 항목).

## 요약

`RESOLUTION.md` 가 주장하는 8건 전부(SPEC-DRIFT flip, Swagger 문서 4곳, plan 자기모순 정정,
신규 유닛테스트 2세트, 마커 상수 공유, `maskIfPresent` 헬퍼, CHANGELOG)를 코드·spec·테스트
파일을 직접 열어 line-level 로 대조했고, 전부 실제로 반영돼 있음을 확인했다. 신규/변경
테스트 5개 파일(181 tests)을 직접 실행해 통과를 확인했으며, 특히 `⑥-b` 참조 동일성 테스트는
`executions.service.ts` 의 실제 3필드 AND 비교 로직과 대조해 뮤테이션 포착력이 형태상
유효함을 확인했다. `background-runs.service.ts` 의 `inputData`/`outputData` 마스킹은
`toNodeExecutionDto` 단일 관문을 통해 여섯 표면 중 마지막 자리를 정확히 닫았고, `12-webhook.md`
§5.3 의 ingestion-time `[REDACTED]` 마커와 egress-time `***` 값-마스킹이 서로 덮지 않는다는
계약도 `isMaskedMarker`/캐너리 테스트로 코드·spec 양쪽에서 정합됨을 확인했다. 이번 라운드
자체가 만든 새로운 요구사항 결함(기능 미완성·엣지케이스 누락·TODO·spec 불일치)은 발견되지
않았다 — 잔존하는 두 관찰은 모두 이번 diff 이전부터 있던 선존 갭이거나 순수 스타일
비일관성으로 조치가 불필요한 수준이다.

## 위험도

NONE
