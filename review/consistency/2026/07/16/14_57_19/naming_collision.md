# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 (--impl-done final pass)

orchestrator 지시에 따라 이번 회차는 아래 두 신규 산출물에 한정해 식별자 충돌을 검토했다 (diff-base `origin/main`, HEAD = 본 워크트리):

1. 신규 plan 문서 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`
2. 신규 shared 모듈 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` 가 export 하는 식별자 (`OperationFieldSpec`, `OperationSchemaSource`, `buildOperationJsonSchema`, `makeEnabledToolsFilter`)

`git diff origin/main...HEAD` 로 실제 변경분(9 files, +379/-165)을 1차 근거로 삼았고, 각 식별자는 `git grep`(dist 제외, 워크트리 절대경로 기준)으로 저장소 전체 재검색해 기존 사용처와 대조했다.

## 발견사항

### [INFO] `buildOperationJsonSchema` 와 사전 존재 `buildJsonSchema`(Information Extractor) 의 이름 유사성

- target 신규 식별자: `buildOperationJsonSchema` (`codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts:57`)
- 기존 사용처: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1513` 의 private 메서드 `buildJsonSchema(outputSchema, multiTurn)` — Information Extractor 의 `outputSchema` → LLM tool parameters 변환용으로, 이번 diff 와 무관한 기존 코드
- 상세: 두 함수 모두 "LLM 도구 parameters JSON Schema 를 만든다"는 동일한 개념적 역할을 서로 다른 AI 노드(AI Agent tool-providers vs Information Extractor)에서 수행한다. 이름이 정확히 일치하지는 않으나(`buildOperationJsonSchema` vs `buildJsonSchema`), `grep buildJsonSchema` 로 두 항목이 함께 걸려 리뷰어·향후 개발자가 "같은 함수의 두 버전"으로 오인할 여지가 있다. 실질적 충돌(동일 이름·다른 의미)은 아니며, 새 이름이 오히려 `Operation` 접두사로 스코프를 명확히 구분한 상태다.
- 제안: 현재 이름 유지로 충분(진짜 충돌 아님). 필요 시 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2 또는 `0-common.md` 주석에 "두 노드가 독립적인 동명 계열 헬퍼를 갖는다"는 한 줄 각주만 추가하면 향후 혼동을 예방할 수 있다.

### [INFO] 제거된 구 식별자(`buildCafe24JsonSchema`/`applyCafe24Allowlist`/`applyMakeshopAllowlist`/`buildMakeshopJsonSchema`) 잔존 참조 없음 — 충돌 없음 확인

- target 신규 식별자: `buildOperationJsonSchema`, `makeEnabledToolsFilter` 가 위 4개 구 식별자를 대체
- 기존 사용처: 없음 (검증 결과)
- 상세: `git grep -n "buildCafe24JsonSchema\|applyCafe24Allowlist\|buildMakeshopJsonSchema\|applyMakeshopAllowlist"` 전체 저장소(dist 제외) 결과 0건 — 구 export 함수/이름이 완전히 제거됐고 어디에도 stale import 가 남아있지 않다. 이름 충돌·유령 참조 리스크 없음.
- 제안: 조치 불필요. (참고용 확인 항목 — 리팩터 품질 양호)

### [INFO] 테스트 describe 타이틀이 이미 제거된 클래스 메서드명을 그대로 인용

- target 관련 식별자: `operation-tool-schema.ts` 로 추출되며 `Cafe24McpToolProvider.buildJsonSchema` 인스턴스 메서드가 사라짐
- 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts:1154` — `describe('Cafe24McpToolProvider.buildJsonSchema (oneOf + empty requiredFields)', ...)`
- 상세: 실제 `Cafe24McpToolProvider` 클래스에는 더 이상 `buildJsonSchema` 메서드가 없다(모듈 레벨 `buildOperationJsonSchema` 로 승격·공유됨, cafe24-mcp-tool-provider.ts diff 로 확인). describe 블록 문자열이 존재하지 않는 심벌을 가리켜, 테스트 리포트나 코드 검색에서 "그 메서드가 아직 클래스에 있다"는 오인을 유발할 수 있다. 엄밀한 "신규 식별자 충돌"은 아니고(신규 식별자가 기존과 부딪힌 게 아니라 옛 식별자 표기가 갱신 안 된 잔존물), 낮은 우선순위의 문서 정합성 이슈다.
- 제안: describe 문자열을 `'buildOperationJsonSchema (cafe24 integration — oneOf + empty requiredFields)'` 등으로 갱신 권장 (기능 영향 없음, 선택적 정리).

## 확인했으나 충돌 없음 (근거만 기록)

- **타입명**: `OperationFieldSpec`/`OperationSchemaSource` — 저장소 전체에서 유일 정의(`operation-tool-schema.ts`). `Cafe24FieldSpec`(`metadata/types.ts:20`)·`MakeshopFieldSpec`(`metadata/types.ts:27`) 과는 이름이 다르고 관계도 명확(구조적 상위 타입) — 충돌 없음.
- **함수명**: `buildOperationJsonSchema`/`makeEnabledToolsFilter` — 저장소 전체에서 정의는 `operation-tool-schema.ts` 1곳뿐, 사용처(`cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts`/각 `.spec.ts`)는 모두 import 경유. 이름이 겹치는 별도 정의 없음.
- **요구사항 ID**: `spec-drift-ai-agent-outport-countmax.md` 는 신규 ID 를 발급하지 않고 기존 `ND-AG-24`(`_product-overview.md`)를 인용만 한다 — ID 신규 충돌 없음.
- **plan 파일 경로/명명 컨벤션**: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 는 기존 `spec-drift-*.md` 계열(`spec-drift-parallel-count.md`, `spec-drift-ws-button-config.md`, `spec-drift-gates.md`)과 접두사가 일치하고, 동일 파일명이 `in-progress/`·`complete/` 어디에도 사전 존재하지 않는다 — 경로 충돌 없음.
- **frontmatter 참조**: `spec/4-nodes/3-ai/1-ai-agent.md` `pending_plans:` 에 신규 항목 추가는 기존 다중 `pending_plans` 등재 패턴(예: `5-execution-engine.md`, `15-chat-channel.md`)과 일치 — 스키마·명명 충돌 없음.
- **task ID 참조**: `task_3ac39ebd`/`task_07c120ce` 는 세션 스코프 ephemeral ID 참조일 뿐 신규 식별자가 아니며, plan 본문·`review/consistency/**`·`review/code/**` 산출물 전반에서 동일 의미로 일관되게 쓰인다 — 의미 충돌 없음.
- **환경변수**: 이번 diff 는 `AI_AGENT_TOOL_COUNT_MAX` 등 기존 env var 를 신규 도입하지 않는다(값·의미 불변, `cross_spec.md` 14_46_28 회차 확인과 일치) — 검토 대상 아님.
- **spec `code:` 등재**: `spec/conventions/cafe24-api-metadata.md` frontmatter 에 `operation-tool-schema.ts` 신규 등재는 다른 spec 문서의 `code:` 목록과 경로 중복이 없다(`grep -rln operation-tool-schema.ts spec/` → 1개 파일만 매치) — 소유권 충돌 없음. (다만 이 shared 파일은 makeshop 쪽에서도 소비되는데 `makeshop-api-metadata.md` `code:` 에는 대응 항목이 없다 — 이는 "식별자 충돌"이 아니라 spec-code 커버리지 대칭성 이슈라 본 리뷰 렌즈 밖으로 판단, 별도 checker(structure_compliance/spec_code_alignment) 소관으로 남긴다.)

## 요약

`spec-drift-ai-agent-outport-countmax.md`(신규 durable plan 앵커)와 `operation-tool-schema.ts`(신규 shared 모듈, `OperationFieldSpec`/`OperationSchemaSource`/`buildOperationJsonSchema`/`makeEnabledToolsFilter`)가 도입하는 모든 신규 식별자를 저장소 전체 기준으로 재검색한 결과 CRITICAL/WARNING 급 실질 충돌은 없었다. 함수·타입명은 `Operation` 접두사로 기존 `Cafe24FieldSpec`/`MakeshopFieldSpec` 및 provider별 구 헬퍼(`buildCafe24JsonSchema`/`applyCafe24Allowlist`/`buildMakeshopJsonSchema`/`applyMakeshopAllowlist`, 모두 완전 제거되고 stale 참조 0건)와 명확히 구분되며, plan 파일명·frontmatter `pending_plans` 등재도 기존 컨벤션을 그대로 따른다. 유일하게 언급할 만한 것은 신규 `buildOperationJsonSchema` 와 무관한 기존 `Information Extractor` 의 `buildJsonSchema` 사이의 이름 유사성, 그리고 옛 클래스 메서드명을 그대로 인용하는 테스트 describe 타이틀 잔존 — 둘 다 INFO 수준의 가독성/문서 정합 이슈일 뿐 기능·의미 충돌은 아니다.

## 위험도

NONE
