# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `schemasOf` 앞에 JSDoc 블록 3개가 중첩되고, `schemaOf` 는 JSDoc 이 전무하다 — 문서가 엉뚱한 함수에 붙어 있다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:58-75` (게이트 숫자는 `전체 파일 컨텍스트` 블록 기준, `Read` 로 재확인 완료)
  - 상세: `export function schemasOf(...)` 바로 위에 `/** ... */` 블록이 **세 개 연속**으로 쌓여 있다.
    - 블록 1(58-62줄)과 블록 3(71-75줄)은 `schemasOf` 를 설명하며 내용이 사실상 중복이다 (둘 다 "components.schemas 레코드 전체 … 단건이면 schemaOf 가 낫다").
    - 블록 2(63-70줄) `생성 문서에서 DTO 스키마 하나를 꺼낸다 … 왜 던지나: 원래 네 스펙은 …` 는 명백히 **`schemaOf`(단수) 함수의 설명**인데 `schemasOf`(복수) 위에 잘못 붙어 있다.
    - 실제 `schemaOf` 함수(95줄, `export function schemaOf(doc, dtoName)`)는 JSDoc 이 **하나도 없다** — 이 파일의 다른 모든 export(`SwaggerSchemaObject` 타입, `buildSwaggerDocument`, `schemasOf`, `propertyOf`)는 상세한 JSDoc 을 갖고 있어 이 누락이 도드라진다.
    - TS/TypeDoc 은 선언 바로 위 **마지막 블록 하나만** 해당 심볼의 문서로 인식하므로, 에디터에서 `schemasOf` 를 hover 하면 (중복된) 올바른 설명이 뜨지만, 블록 2는 어디에도 연결되지 않는 죽은 텍스트가 되고 `schemaOf` 는 문서 없이 남는다.
    - 이 파일 자체의 존재 이유가 "에러 경로(오타 시 어떤 DTO/프로퍼티가 없는지 이름으로 알려준다)"를 문서화하는 것인데(파일 상단 module 주석), 정작 그 에러 메시지를 던지는 `schemaOf` 의 "왜 던지는가" 설명이 엉뚱한 함수 위에 유실돼 있다는 점에서 이 파일의 목적과 직결된 결함이다.
  - 제안: 블록 2(63-70줄)를 `schemaOf` 선언(95줄) 바로 위로 옮기고, `schemasOf` 위에는 중복 없이 블록 1 또는 블록 3 중 하나만 남긴다.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 모범적이다 — 새로 추출한 `swagger-probe.ts`/`node-output-allowlist.ts`(`nodes/core` 이동)는 "왜 존재하는가", "왜 이 형태인가", 소비처, 실측 근거를 갖춘 상세 JSDoc/모듈 주석을 갖췄고, `interaction.guard.ts` 의 낡은 `EIA-AU-09` 참조 제거는 spec §3.3.1 이 실제로 별도 요구사항 ID 를 갖지 않는다는 사실과 일치하는 정확한 정정이며(저장소 전체 재검색으로 잔존 0건 확인), `tsconfig.build.json`·`spec/**` 의 `code:` frontmatter·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 파일 재배치·함수 리네임에 맞춰 빠짐없이 동기화됐다(재검색으로 stale 참조 0건 확인). 유일하게 발견된 결함은 신설 `swagger-probe.ts` 에서 JSDoc 블록이 편집 중 잘못 배치되어 `schemaOf` 함수가 무설명 상태로 남고 `schemasOf` 위에 중복/이가(異家) 블록이 쌓인 것으로, 기능에는 영향이 없으나 이 파일이 스스로 표방하는 "명확한 에러 메시지로 디버깅 비용을 낮춘다"는 목적과 어긋나는 문서 결함이다. README/CHANGELOG 갱신은 이번 변경이 순수 내부 리팩터·위생 작업(동작 변경 없음)이라 불필요해 보이며 실제로도 누락되지 않았다.

## 위험도

LOW
