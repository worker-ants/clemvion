### 발견사항

- **[INFO]** `SchemaCacheEntry` 인터페이스 소유권 이전 — spec 문서 포인터 미갱신
  - target 신규 식별자: `SchemaCacheEntry` (exported interface, `/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L21)
  - 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` Rationale §schemaCache 정책 L928 — `"workflow-assistant-stream.service.ts 의 턴 스코프 schemaCache: Map<string, { result, hits }>"` 라고 명시. 리팩터 전에는 stream service 가 해당 타입을 인라인으로 소유했으나, 리팩터 후에는 `SchemaCacheEntry`(named interface)로 승격되어 `assistant-tool-router.service.ts` 에서 export 되고 stream service 가 이를 import 해 사용한다(`workflow-assistant-stream.service.ts` L12, L488).
  - 상세: 기능적 충돌은 없다. `schemaCache` 가 여전히 `streamMessage` 턴 스코프 변수로 stream service 에서 생성(`L488`)되고 router 에 pass-through 되는 소유 구조는 변하지 않았다. 그러나 spec Rationale 의 `"workflow-assistant-stream.service.ts 의 턴 스코프"` 포인터는 타입 정의 위치로서는 정확하지 않게 되었다. `SchemaCacheEntry` 인터페이스는 이제 `tools/assistant-tool-router.service.ts` 소유다. 유지보수 체크리스트(`L990: "SCHEMA_LOOKUP_HARD_STOP 변경 시 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정"`)가 참조하는 `"서비스 L137–142 주석 + L459–462 inline 주석"` 번호도 리팩터 후 변경됐을 가능성이 있다.
  - 제안: spec Rationale의 `schemaCache 정책` 단락(`L928`)의 `"workflow-assistant-stream.service.ts"` 참조를 `"assistant-tool-router.service.ts"` 로 갱신하고, 유지보수 체크리스트의 행 번호 주석을 현행 파일 기준으로 재확인한다. 이 갱신은 planner 소관의 비차단(non-blocking) 후속 작업이다.

- **[INFO]** `coerce.ts` 파일명 — 다른 모듈과 이름 충돌 없음, 단 범용명 주의
  - target 신규 식별자: 파일 `/codebase/backend/src/modules/workflow-assistant/tools/coerce.ts`, 함수 `asString`
  - 기존 사용처: `codebase` 전체에서 `coerce.ts` 라는 파일명은 이 파일 1개 뿐이다. `asString` 함수도 `tools/coerce.ts` 에서만 export 되며, 다른 모듈에는 동명 export 가 없다. `workflow-assistant-stream.service.ts`(L14)와 `assistant-tool-router.service.ts`(L6) 두 소비자가 `'./tools/coerce'` 로 import 한다.
  - 상세: 모듈 경계 내에서만 사용되며 충돌 없음. 파일명 `coerce` 는 변환 유틸 의미로 일반적이지만, 같은 경로에 동명 파일이 없으므로 실질 충돌은 없다.
  - 제안: 없음 — 현 상태 유지가 적절하다.

- **[INFO]** `AssistantToolRouter` 클래스명 — spec 내 미등재
  - target 신규 식별자: `AssistantToolRouter` 클래스 (`tools/assistant-tool-router.service.ts`), `ExploreDispatchContext` 인터페이스, `ExploreDispatchResult` 인터페이스
  - 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` 의 `code:` frontmatter는 `codebase/backend/src/modules/workflow-assistant/**/*.ts` glob 으로 선언되어 있어 신규 파일을 자동 커버한다. 다른 spec 문서나 codebase에서 `AssistantToolRouter`, `ExploreDispatchContext`, `ExploreDispatchResult` 라는 이름을 사용하는 곳은 없다.
  - 상세: 이름 충돌은 없다. spec §Rationale M-3(`plan/in-progress/refactor/02-architecture.md` L190)는 `AssistantToolRouter` 신설을 분명히 기록하고 있으며, 해당 클래스는 NestJS 모듈(`workflow-assistant.module.ts` L51)에 정상 등록되어 있다.
  - 제안: spec `4-ai-assistant.md` frontmatter의 `code:` 항목은 glob이므로 별도 등재가 불필요하다. 단, plan의 M-3 `planner 후속`으로 spec Rationale에 `AssistantToolRouter` 도입 근거를 한 줄 추가하면 미래 독자에게 유용하다. 비차단 사안.

- **[INFO]** `REDUNDANT_SCHEMA_LOOKUP`·`UNKNOWN_EXPLORE_TOOL` 에러 코드 — spec과 정합 확인
  - target 신규 식별자: 에러 코드 문자열 `REDUNDANT_SCHEMA_LOOKUP`, `UNKNOWN_EXPLORE_TOOL`
  - 기존 사용처: `REDUNDANT_SCHEMA_LOOKUP` 은 `spec/3-workflow-editor/4-ai-assistant.md` L932–933 에 이미 spec으로 명시되어 있다. `UNKNOWN_EXPLORE_TOOL` 은 spec 문서에 명시되지 않지만, `handleExploreCall` 의 `default` 브랜치 내부 방어 코드이며 LLM에게 노출되는 공개 계약 에러가 아니다.
  - 상세: `REDUNDANT_SCHEMA_LOOKUP` 은 spec Rationale에 정의된 기존 식별자이므로 충돌 없이 정합이다. `UNKNOWN_EXPLORE_TOOL` 은 신규 도입이지만 내부 방어 경로 전용으로 spec 충돌 없음.
  - 제안: `UNKNOWN_EXPLORE_TOOL` 을 spec의 에러 코드 목록에 추가할지는 내부 방어 코드이므로 planner 재량이다. 현재 상태는 충돌 없음.

### 요약

이번 M-3 1단계 리팩터(`AssistantToolRouter` 추출)가 도입하는 신규 식별자 — `AssistantToolRouter`, `SchemaCacheEntry`, `ExploreDispatchContext`, `ExploreDispatchResult`, `asString`(coerce), `REDUNDANT_SCHEMA_LOOKUP`, `UNKNOWN_EXPLORE_TOOL`, `SCHEMA_LOOKUP_HARD_STOP` — 는 코드베이스 내 다른 영역에서 동일·유사 식별자로 충돌하지 않는다. 유일한 후속 과제는 spec Rationale의 `schemaCache 정책` 포인터가 여전히 `workflow-assistant-stream.service.ts` 를 소유처로 지목하고 있는데, 리팩터 후 실제 타입 정의는 `assistant-tool-router.service.ts` 로 이전됐다는 문서 미갱신 사안이다. 이는 동작·계약 충돌이 아닌 텍스트 포인터 drift 이므로 비차단이다.

### 위험도

LOW
