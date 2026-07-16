# 정식 규약 준수 검토 — operation-tool-schema.ts 추출 + cafe24-api-metadata.md pointer 갱신

## 검토 범위

`git diff origin/main...HEAD` 기준 아래 파일에 한정 (--impl-done, W4 provider dedup 후속):

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.spec.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` / `.spec.ts` (수정 — shared 위임)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts` (수정 — shared 위임)
- `spec/conventions/cafe24-api-metadata.md` (수정 — §2/§7 pointer 정정)

target 문서(작업 대상)와 대조한 정식 규약: `spec/conventions/spec-impl-evidence.md`(frontmatter `code:` evidence), `spec/conventions/cafe24-api-metadata.md` 자체(§2 "MCP/JSON Schema 매핑" — 이번 diff 가 그 SoT pointer 를 갱신), `spec/conventions/makeshop-api-metadata.md`(cafe24 동형 참조).

## 발견사항

- **[WARNING]** `cafe24-api-metadata.md` frontmatter `code:` 가 방금 본문이 지목한 신규 SoT 파일을 누락
  - target 위치: `spec/conventions/cafe24-api-metadata.md` frontmatter (L1-11) — `code:` 리스트
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의("본 spec 이 약속한 surface 의 구현 경로") + §3 `status: implemented` 요건
  - 상세: 본 diff 는 §2:153·§7:391·§7:398 세 곳의 본문 pointer 를 `cafe24-mcp-tool-provider.ts`(구 `buildJsonSchema()`) 에서 `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()`(cafe24/makeshop 공유)로 정정했다(ai-review PR#955 후속 W1 조치, `review/code/2026/07/16/14_32_05/RESOLUTION.md` 확인). 그런데 같은 문서 frontmatter 의 `code:` 리스트(L4-10)는 여전히 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` 만 등재하고, 본문이 새로 지목한 `operation-tool-schema.ts` 는 추가되지 않았다. `spec-code-paths.test.ts` 빌드 가드는 글로브 ≥1 매치만 요구하므로 기존 엔트리로 여전히 통과하지만(CRITICAL 아님), 본 컨벤션의 핵심 취지 — "spec 이 약속한 surface(§2 JSON Schema 매핑)의 구현 경로를 frontmatter 로 증거화" — 가 본문 pointer 수정 직후에도 어긋난 채로 남는다. 대조: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter 는 이미 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/*.ts` glob 을 쓰고 있어 신규 파일이 자동 커버되지만, `cafe24-api-metadata.md` 는 glob 없이 파일 단위로 나열해 이런 drift 에 노출된다.
  - 제안: `cafe24-api-metadata.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` 한 줄 추가(파일 단위 나열 스타일 유지) 또는 `tool-providers/*.ts` glob 으로 교체해 향후 동일 drift 를 구조적으로 방지. 부수 확인: `makeshop-api-metadata.md` 는 애초에 `makeshop-mcp-tool-provider.ts` 자체도 `code:` 에 없어 (이번 diff 이전부터 존재하는 별개 gap, 본 diff 가 새로 만든 문제 아님) 동일 논리로 `operation-tool-schema.ts` 를 추가할 필요는 없음 — 그 문서 §2/§7 은애초에 함수명을 인용하지 않으므로(확인됨) 본 diff 로 인한 pointer drift 는 없다.

## 검증됨 (위반 없음 — 근거 포함)

- **명명 규약**: `operation-tool-schema.ts`(kebab-case 파일명), `buildOperationJsonSchema`/`makeEnabledToolsFilter`(동사+명사 camelCase), `OperationSchemaSource`/`OperationFieldSpec`(PascalCase interface, no `I` prefix) 모두 동일 폴더의 기존 파일(`cafe24-mcp-tool-provider.ts`, `mcp-tool-provider.ts`, `mcp-diagnostics.ts`)·타입(`Cafe24FieldSpec`, `Cafe24OperationMetadata`) 명명 패턴과 일치. `Operation*`(provider-neutral) 로 provider prefix 를 뗀 네이밍은 `spec/4-nodes/3-ai/0-common.md §6`(`LlmCallRecord`/`TurnDebugEntry` canonical shared supertype) 과 동일한 프로젝트 관행(shared 타입은 provider-specific prefix 제거)과 정합.
- **파일 배치**: `nodes/ai/ai-agent/tool-providers/` 폴더 안에 신설 — 이미 이 폴더에 `mcp-tool-provider.ts`/`mcp-diagnostics.ts`/`agent-tool-provider.interface.ts` 같은 provider-공유 helper 가 공존하는 기존 패턴과 일치(`nodes/ai/shared/` 로 승격하지 않은 것은 이 유틸이 AI 3노드 전체가 아니라 tool-providers 서브도메인 한정 공유이기 때문 — 적절).
- **import 스타일**: production 코드(`cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts`)의 `from './operation-tool-schema.js'`(확장자 포함, NodeNext 스타일)과 spec 파일의 `from './operation-tool-schema'`(확장자 생략)이 각각 기존 production/spec 파일들의 import 관례와 일치.
- **cafe24-api-metadata.md §2 매핑 표와 코드 동치성**: `buildOperationJsonSchema()` 의 `enum`→`{type:'string',enum}` / `array`→`{type:'array',items:{type:'string'}}` / `object`→`{type:'object',additionalProperties:true}` / `oneOf`→`anyOf` 결합(+`requiredFields` 존재 시 `allOf` 래핑) 로직이 §2 "MCP/JSON Schema 매핑" 표(L153-164)·예시 JSON Schema(L194-208)와 정확히 일치. `allOrNone`/`implies`/`impliesValue` 는 JSON Schema 변환 없음(§2 명시)과도 일치 — 코드가 `kind === 'oneOf'` 만 필터링.
- **dangling reference 없음**: 제거된 구 심볼(`buildCafe24JsonSchema`, `applyCafe24Allowlist`, `buildMakeshopJsonSchema`, `applyMakeshopAllowlist`, `Cafe24McpToolProvider.buildJsonSchema`, `MakeshopMcpToolProvider.buildJsonSchema`)에 대한 참조가 `spec/**` 전체에 0건(grep 확인) — 본문 pointer 정정이 누락 없이 이뤄짐.
- **문서 구조**: `cafe24-api-metadata.md` 의 섹션 구조(§2/§7 등)·frontmatter 위치는 변경 없이 유지, 3섹션(Overview/본문/Rationale) 골격을 깨지 않음. 두 hunk 모두 기존 산문 한 줄 치환 수준.

## 참고 (조치 불요, 정보성)

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts:1154` 의 `describe('Cafe24McpToolProvider.buildJsonSchema (oneOf + empty requiredFields)', ...)` 타이틀이 여전히 옛 이름(`Cafe24McpToolProvider.buildJsonSchema`)을 가리킴 — 실제 호출은 shared `buildOperationJsonSchema`(L1173 diff 확인). 이 staleness 는 이번 diff 이전(구 module-level 함수 승격 시점)부터 있었고, 이번 diff 는 import 문·호출부만 고치고 describe 타이틀은 손대지 않았다. `spec/conventions/**` 가 직접 규율하는 대상은 아니라(test 명명 규약 문서 부재) 등급 부여 대상에서 제외하되, 다음 손댈 때 `buildOperationJsonSchema (oneOf + empty requiredFields)` 로 정정 권장.

## 요약

이번 변경은 cafe24/makeshop MCP tool provider 의 JSON-Schema 빌드 로직·allowlist 필터를 `operation-tool-schema.ts` 로 추출한 순수 내부 dedup 리팩터이며, `spec/conventions/cafe24-api-metadata.md` 의 §2/§7 pointer 를 새 구현 위치로 정확히 갱신했다(ai-review W1 후속 조치, 코드-스펙 매핑 표까지 1:1 검증됨). 명명·배치·import 스타일 모두 기존 코드베이스 관행과 일치하고 dangling 심볼 참조는 0건이다. 유일한 gap 은 그 정정된 본문 pointer 가 같은 문서의 frontmatter `code:` evidence 리스트에는 반영되지 않은 것 — 빌드 가드를 깨는 CRITICAL 은 아니지만 spec-impl-evidence 컨벤션의 취지(약속된 surface ↔ 구현 경로의 frontmatter 증거화)에는 어긋나는 WARNING 급 누락이다.

## 위험도

LOW
