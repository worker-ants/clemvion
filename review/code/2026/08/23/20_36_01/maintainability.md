# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 캐너리 테스트가 저장소에 이미 확립된 `SchemaObject` 타입 파생 컨벤션을 따르지 않고 `Record<string, unknown>` 캐스팅을 산발적으로 사용한다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:51-55, 59, 66`
  - 상세: 동일한 문제(swagger 가 `SchemaObject` 를 공개 export 하지 않음)를 다루는 자매 스펙 3개가 이미 존재한다 —
    `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:13`, `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts:6-8`,
    그리고 `execution-status-response.dto.spec.ts`. 이들은 모두 `type SchemaObject = ApiResponseSchemaHost['schema'];` 로 공개 타입에서 파생해 쓴다. `workflows-execute-body.spec.ts:10-12` 주석은 명시적으로 "자매 스펙과 같은 방식으로 공개 타입에서 파생한다" 고 컨벤션을 못박아 둔 상태다. 이번 신규 파일(`re-run.dto.spec.ts`)은 이 컨벤션을 참고하지 않고 `(doc.components?.schemas ?? {})['ReRunRequestDto'] as Record<string, unknown>` / `schema.inputOverride as Record<string, unknown>` 형태의 미타입 캐스팅을 반복한다. 타입 안전성이 낮아지고(프로퍼티명 오타를 컴파일러가 못 잡음), 4개 스키마 스펙 파일 간 스타일이 갈라진다.
  - 제안: `ApiResponseSchemaHost['schema']` 기반 `SchemaObject` 타입 별칭을 도입해 자매 스펙과 동일한 패턴으로 통일한다.

- **[WARNING]** `beforeAll` 에서 `SwaggerModule.createDocument` 가 던지면 `app.close()` 가 스킵된다 — 자매 패턴은 `try/finally` 로 이를 방지한다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:43-50`
  - 상세: 현재 코드는 `app.init()` → `createDocument(...)` → `app.close()` 를 순차 실행할 뿐 `try/finally` 로 감싸지 않는다. `createDocument` 호출이 실패하면(예: 향후 DTO 리팩터로 인한 순환 참조·데코레이터 오류) `app.close()` 가 실행되지 않아 Nest 테스트 앱이 정리되지 않은 채 남는다. 같은 문제를 다루는 자매 스펙 두 곳(`workflows-execute-body.spec.ts:131-140`, `interact-ack-response.dto.spec.ts:36-41`)은 정확히 이 이유로 `try { ... } finally { await app.close(); }` 패턴을 쓴다. 이번 파일만 그 방어가 빠졌다.
  - 제안: 동일하게 `try/finally` 로 감싸 실패 경로에서도 앱이 정리되도록 한다.

- **[INFO]** `schema.inputOverride as Record<string, unknown>` 캐스팅이 두 `it` 블록에 동일하게 중복된다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:59, 66`
  - 상세: 두 테스트가 같은 프로퍼티(`inputOverride`)를 대상으로 하면서 캐스팅 표현식을 각자 반복한다. 파일이 작아 실질적 위험은 낮지만, 위 `SchemaObject` 타입 도입과 함께 `beforeAll` 에서 한 번 파생해 두면 중복이 사라진다.
  - 제안: `beforeAll` 에서 `let inputOverride: SchemaObject;` 를 세팅하고 두 테스트가 이를 공유.

- **[INFO]** 테스트 타이틀의 대괄호 태그(`[캐너리]`/`[가드]`/`[대조군]`/`[결정]`) 컨벤션이 두 번째 테스트에서 빠졌다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:65`
  - 상세: 자매 파일 `workflows-execute-body.spec.ts` 는 테스트 성격(캐너리/가드/대조군/결정)을 타이틀 접두 태그로 일관되게 표시한다. 이 파일의 첫 번째 테스트(`59행`)는 `[캐너리]` 태그를 쓰지만, 회귀 방지 목적이 동일한 두 번째 테스트("마커 거부 캐비엇을 description 에 싣는다")는 태그 없이 시작해 스타일이 갈린다.
  - 제안: `[가드]` 또는 `[캐너리]` 태그를 붙여 파일 내·자매 파일 간 일관성을 맞춘다.

## 요약

핵심 변경(`re-run.dto.ts` 의 `type: Object` → `type: 'object', additionalProperties: true` 치환)은 저장소 다수 패턴(40개 파일)과 형제 DTO 를 따르며, 왜 이 형태가 필요한지(축약형이 `additionalProperties` 를 생성하지 않아 생성기가 닫힌 모델로 오판)를 코드 주석과 plan 문서 양쪽에 근거와 함께 상세히 남겨 가독성·추적성이 높다. 신규 캐너리 테스트(`re-run.dto.spec.ts`)도 목적(OpenAPI 노출 회귀 방지)이 명확하고 함수 길이·중첩·복잡도는 문제없으나, 이미 저장소에 확립된 스키마 테스트 컨벤션(`SchemaObject` 타입 파생, `try/finally` 앱 정리, 타이틀 태그 일관성)을 참고하지 않고 독자적인 `Record<string, unknown>` 캐스팅 스타일로 작성돼 자매 파일 3개와 스타일이 갈린다. plan 문서(`rerun-dto-shorthand.md`, `spec-sync-external-interaction-api-gaps.md`) 변경은 체크박스·근거 정리로 코드 유지보수성에 직접 영향 없음.

## 위험도

LOW
