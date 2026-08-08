# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

- **[INFO]** `codebase/backend/src/nodes/**` glob 은 매트릭스 `new-node`/`node-schema-change` 행과 구조적으로 매치하지만, 실제 diff 는 순수 lint/포맷 정리로 확인되어 동반 갱신 불필요
  - 변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`, `ai-memory-manager.ts`, `ai-turn-executor.ts`, `tool-providers/{cafe24,makeshop,mcp,render}-*.ts`, `ai/information-extractor/information-extractor.handler.ts`, `ai/shared/{agent-memory-injection,conversation-context-injection}.ts`, `core/node-component.registry.ts`, `data/{code,transform}/*.handler.ts`, `integration/cafe24/{cafe24-api.client,cafe24.handler,metadata/public-meta,metadata/types}.ts`, `integration/makeshop/{makeshop-api.client,makeshop.handler,metadata/types}.ts`, `integration/database-query/database-query.handler.ts`, `presentation/{chart,table}/*.handler.ts` — 총 20여개 파일
  - 매트릭스 항목: `new-node`("새 노드 추가", trigger `{globs:["codebase/backend/src/nodes/**"], match:"glob"}`) + `node-schema-change`("노드 schema 변경 (필드 추가·라벨 변경)", 동일 glob) — 두 행 모두 target 은 `02-nodes/<cat>.mdx` FieldTable, `dict/{ko,en}/<section>.ts`, `backend-labels.ts`
  - 누락된 동반 갱신: 없음 (실질적 스키마/라벨/에러코드 변경이 없어 대상 자체가 없음)
  - 상세: `git diff origin/main...HEAD` 로 위 파일 전체를 직접 대조한 결과, 모든 변경이 **prettier 3.9 union 타입 줄바꿈 규칙**(`| 'a' | 'b'` → 한 줄로 병합) 또는 **`@typescript-eslint/no-unnecessary-type-assertion`** 제거(`(x as T)` → `x`, 불필요 import 제거)였다. 예: `ai-agent.schema.ts` 는 `mode: 'single_turn' | 'multi_turn'` 유니온의 줄바꿈만 바뀌었고 필드·타입·값 자체는 불변. `cafe24/metadata/types.ts`, `makeshop/metadata/types.ts` 도 `Cafe24FieldType`/`MakeshopFieldType`/`MakeshopResource` 유니온 리터럴이 그대로 유지된 채 줄바꿈만 제거됨. 이 변경 집합은 신규 노드도, 필드 추가도, 라벨 변경도, 신규 에러코드도 아니므로 `02-nodes/*.mdx`·`dict/*.ts`·`backend-labels.ts` 동반 갱신 대상이 없다.
  - 제안: 조치 불필요. 리뷰어가 신규 필드/라벨/에러코드 변경을 오탐하지 않도록 본 항목을 INFO 로만 기록.

- **[INFO]** 통합 provider 파일(`cafe24-api.client.ts`, `makeshop-api.client.ts`, `cafe24.handler.ts`, `makeshop.handler.ts`) 변경도 동일하게 형식적 매치이나 semantic 변경 없음
  - 변경 파일: 위 4개
  - 매트릭스 항목: `integration-provider-change`("통합 신규/제공자 변경", semantic match) — target `06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`
  - 누락된 동반 갱신: 없음
  - 상세: `Cafe24Method`/`MakeshopMethod` 미사용 import 제거(`operation.method as Cafe24Method` → `operation.method`, 타입 단언만 제거) 및 `(integration.credentials ?? {}) as Cafe24Credentials` → `integration.credentials ?? {}` 캐스트 제거뿐. resource/operation/필드/pagination 등 사용자 노출 계약은 불변.
  - 제안: 조치 불필요.

관련 없는 나머지 파일(`websocket.service.ts`, `resolve-dynamic-ports.ts`, `review-workflow.ts`, `shadow-workflow.ts`, `*.spec.ts`/`*.e2e-spec.ts`, `generate-golden-set.ts`, `conversation-thread.types.ts`, `node-component.registry.ts` 등)도 동일한 lint-gate PR 의 일부로, `plan/in-progress/backend-lint-gate-broken-on-main.md` 자체가 이 PR 을 "prettier 122건 + `no-unnecessary-type-assertion` 54건(회귀 7건 되돌림) + 고아 import 6건" 으로 명시 범위 한정하고 있다. 새 warningCode/errorCode 발행, 신규 UI 문자열, 신규 섹션 디렉토리, auth/세션 흐름 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경 등 나머지 매트릭스 trigger 어느 것에도 해당하지 않는다.

## 요약

매트릭스 21개 행 중 glob 상 형식적으로 매치되는 행은 `new-node`/`node-schema-change`(파일 경로 `codebase/backend/src/nodes/**`)와 `integration-provider-change` 뿐이었으나, `git diff origin/main...HEAD` 로 전 파일을 직접 대조한 결과 이번 changeset 은 prettier 3.9 포맷 규칙 적용 + `no-unnecessary-type-assertion` 억제 정리 + 고아 import 제거로만 구성된 **순수 lint-gate 복구 PR**(`plan/in-progress/backend-lint-gate-broken-on-main.md` 명시)이며, 필드·라벨·에러코드·UI 문자열·통합 계약 등 사용자 가시 변경이 전혀 없어 동반 갱신 누락 0건. Critical/Warning 없음, INFO 2건(형식적 glob 매치이나 무관 확인).

## 위험도

NONE
