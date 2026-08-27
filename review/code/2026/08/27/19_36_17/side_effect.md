# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** plan 문서의 미완료(collapsed `<details>`) 항목이 이번 PR 이 옮긴 구 경로를 여전히 안내한다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "wire-only 키가 §R17 표에서 REST 만 닫혔다" 항목의 `<details>` 블록 내 "재사용할 헬퍼는 이미 있다" 문구 (이번 diff 가 건드리지 않은 기존 텍스트)
  - 상세: 이 문구는 `shared/utils/node-output-allowlist.ts` 를 가리키는데, 본 PR 이 그 파일을 `nodes/core/node-output-allowlist.ts` 로 이동했다(파일 11 삭제/파일 10 신설). 이 특정 문단은 이번 diff 범위 밖(아직 손대지 않은 미완료 항목)이라 동반 갱신되지 않았다. 실행에는 영향 없음 — 이 항목에 나중에 착수할 때 `import` 경로가 컴파일 에러로 즉시 드러나므로 silent breakage 위험은 낮지만, "다시 찾지 말 것" 이라 적힌 가이드 문구가 잘못된 경로를 준다.
  - 제안: 착수 시점에 정정하거나, 지금 한 줄만 `nodes/core/node-output-allowlist.ts` 로 고쳐 둔다.

## 확인한 항목 (부작용 없음으로 판정)

- **함수 rename (`redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`, `codebase/backend/src/shared/utils/redact-stored-error.ts`)**: 시그니처·동작 불변, 순수 이름 변경. 저장소 전체에서 구 이름 잔존 0건, 신규 이름 참조 3곳(정의·spec·유일 호출부 `executions.service.ts`) 모두 갱신 확인(grep 실측).
- **모듈 재배치 (`node-output-allowlist.ts`: `shared/utils/` → `nodes/core/`, 파일 10·11·14·15)**: `NODE_OUTPUT_ALLOWED_KEYS`(`Object.freeze` 상수)·`allowlistNodeOutputKeys`(순수 함수, copy-on-change, 원본 비변이 — 스스로의 `.spec.ts` 가 이를 캐너리로 고정)의 내용은 무변경, import 경로만 이동. 구 경로(`shared/utils/node-output-allowlist`) 잔존 참조 0건, 신규 경로 사용처(`websocket.service.ts`, `interaction.service.ts`) 정상 갱신, `spec/5-system/14-external-interaction-api.md` `code:` frontmatter·`spec/conventions/node-output.md` 본문도 동반 갱신됨. `shared/utils/` 가 `nodes/`·`modules/` 를 import 하는 사례는 이 이동으로 0건이 됨(디렉토리 계층 위반 해소, 신규 위반 없음).
- **`tsconfig.build.json` 빌드 exclude 확장 (`src/shared/testing/**`)**: 신설된 `swagger-probe.ts` 가 devDependency `@nestjs/testing` 을 import 하므로 `dist` 유출 방지 목적. 해당 디렉토리엔 `swagger-probe.ts` 와 그 `.spec.ts` 두 파일만 존재하며(실측), `swagger-probe.ts` 의 소비처는 전부 `*.spec.ts` 5개 파일뿐(실측) — 프로덕션 코드 경로에서 참조되지 않으므로 이 exclude 로 인해 빌드 결과물에서 빠지는 필요 파일이 없다.
- **신설 `buildSwaggerDocument` 헬퍼 (`swagger-probe.ts`)**: `Test.createTestingModule(...).compile()` → `app.init()` → `SwaggerModule.createDocument(...)` → `finally { app.close() }` 패턴은 4개 소비 스펙이 각자 갖고 있던 기존 로직을 그대로 추출한 것으로, 새 네트워크 호출·새 리소스 누수 경로가 생기지 않는다(닫기가 `finally` 로 보장됨, 기존과 동일).
- **`websocket.service.spec.ts` 테스트 재배치**: 2개 테스트 케이스를 `describe('llmCalls strip …')` 블록에서 신설 `describe('nodeOutput allowlist · fanout 파이프라인 불변식')` 블록으로 이동. 코드 내용은 그대로 옮겨졌고 프로덕션 `websocket.service.ts` 의 fanout/이벤트 배선은 이 diff 에서 불변 — 이벤트/콜백 발생 순서·조건에 영향 없음.
- **`interaction.guard.ts`**: JSDoc 주석 한 줄(`EIA-AU-09` 오기 정정)만 변경, 실행 코드 무변경.
- **spec/plan 문서 갱신(`14-external-interaction-api.md`, `egress-masking.md`, `node-output.md`, `spec-sync-external-interaction-api-gaps.md`)**: 전부 코드 이동/rename 을 뒤따르는 문서 미러 갱신이며, 자체적으로 새로운 부작용을 도입하지 않음.

## 요약

이번 변경은 rename·모듈 재배치·테스트 헬퍼 추출·빌드 exclude 확장 위주의 위생(hygiene) 리팩터로, 전역 상태·환경 변수·네트워크 호출·이벤트 배선에 실질적인 변경이 없다. 시그니처/인터페이스 변경(함수 rename, 모듈 경로 이동)은 두 건 있으나 grep 실측으로 저장소 전체에서 구 경로/구 이름의 잔존 참조가 0건임을 확인했고, 신규 참조처도 모두 일관되게 갱신됐다. 유일한 잔여 흠은 이번 diff 범위 밖의 plan 문서 한 문단이 이동 전 경로를 여전히 안내하는 것으로, 기능적 위험은 없는 문서 staleness 수준이다.

## 위험도

LOW
