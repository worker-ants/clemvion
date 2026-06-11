# 테스트(Testing) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** 삭제된 `ai-configs.tsx` 에 대한 전용 unit 테스트가 사전에도 존재하지 않았음 — 삭제로 인한 테스트 손실 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/` (디렉터리 내 ai-configs 테스트 파일 미존재, git log 확인 완료)
  - 상세: `cafe24-config.test.tsx`, `parallel-config.test.tsx`, `trigger-configs.test.tsx`, `integration-selector.test.tsx` 는 존재하나, AI config 용 테스트는 이전 커밋에서도 생성된 적이 없다. 결과적으로 삭제 변경이 기존 passing 테스트를 깨뜨리는 경우는 없다.
  - 제안: 이번 변경 자체는 삭제이므로 새 테스트가 반드시 필요하지 않으나, 히스토리적으로 bespoke 폼에 대한 unit 테스트 부재는 기술 부채로 기록해 둘 필요가 있다.

### 발견사항 2
- **[WARNING]** `OVERRIDE_REGISTRY` 에서 `text_classifier`·`information_extractor` 를 제거한 후 이 두 노드가 auto-form(`SchemaForm`)으로 대체됨을 검증하는 통합 수준 테스트가 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/index.tsx` (NodeConfigRenderer), `override-registry.ts`
  - 상세: `NodeConfigRenderer` 는 `OVERRIDE_REGISTRY[nodeType]` 이 없을 때 `getNodeDefinition(nodeType)` → `SchemaForm` 경로를 따른다. 두 AI 노드가 이 경로로 실제 렌더되는지를 검증하는 테스트가 없다. 현재 `NodeConfigRenderer` 자체의 테스트 파일이 존재하지 않는다(`find` + grep 결과 0건). `auto-form/__tests__/schema-form.test.ts` 는 `groupEntries`·`countGroupValues` 순수 함수만 커버하며, registry 분기 로직을 다루지 않는다.
  - 제안: `NodeConfigRenderer` 에 대해 `text_classifier` 노드 타입으로 호출 시 `SchemaForm` 이 렌더되고 override 컴포넌트가 렌더되지 않음을 확인하는 테스트를 추가한다. `getNodeDefinition` 을 mock 하여 configSchema 를 stub 하면 격리 테스트 가능.

### 발견사항 3
- **[INFO]** `build-node-initial-config.test.ts`·`node-config-summary.test.ts` 는 `text_classifier`·`information_extractor` 를 명시적으로 테스트하고 있으며, 변경 후에도 그대로 유효함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-node-override-fields/codebase/frontend/src/lib/utils/__tests__/build-node-initial-config.test.ts` (lines 18-28), `/Volumes/project/private/clemvion/.claude/worktrees/ai-node-override-fields/codebase/frontend/src/lib/utils/__tests__/node-config-summary.test.ts` (lines 233-297)
  - 상세: 두 노드가 `LLM_PROVIDER_NODES` 에 남아 있고, `LLM_PROVIDER_NODES` 의 정의가 변경되지 않았으므로 관련 테스트는 회귀 없이 모두 통과한다. `getConfigSummary` 의 provider-warning suppression, `buildNodeInitialConfig` 의 llmConfigId pre-fill 모두 auto-form 이행과 무관하게 동작한다.
  - 제안: 없음. 기존 테스트가 적절히 커버하고 있다.

### 발견사항 4
- **[WARNING]** auto-form 경로에서 `text_classifier`·`information_extractor` 의 zod 스키마가 방출하는 UI 힌트(field-array `categories`·`outputSchema`, `multiLabel`, `includeConfidence`, `includeEvidence`, `maxTurns`, `mode` 등)를 실제로 렌더하는지를 검증하는 테스트가 없음
  - 위치: auto-form 위젯 테스트 (`auto-form/__tests__/`) — 현재 `buildNewItem`, `groupEntries`, `isFieldVisible`, `humanize` 등 순수 함수 단위만 커버
  - 상세: 삭제된 bespoke 폼은 카테고리 add/remove/update, 필드 add/remove/update, `mode` 에 따른 `inputField` 조건부 렌더(InformationExtractor의 `mode !== multi_turn` 분기) 등 복잡한 상호작용을 포함했다. 이 로직이 이제 zod 스키마 + auto-form 에 위임되는데, auto-form 이 해당 UI 힌트를 올바르게 해석하여 동일 필드를 렌더하는지를 검증하는 테스트가 없다. 특히 `visibleWhen: { field: 'mode', notEquals: 'multi_turn' }` 같은 visibility 규칙이 backend 스키마에 올바르게 선언돼 있는지는 frontend 테스트로는 확인 불가능하다.
  - 제안: backend 의 `text_classifier`·`information_extractor` zod 스키마에 대해 JSON Schema 직렬화 결과를 스냅샷 테스트로 고정하거나, frontend 에서 해당 JSON Schema stub 을 이용해 `SchemaForm` 렌더 결과에 `inputField` 필드(mode=single_turn 일 때만 노출)가 존재하는지를 검증하는 통합 테스트를 추가한다.

### 발견사항 5
- **[INFO]** 삭제 전 `ai-configs.tsx` 의 `InformationExtractorConfig` 가 구현하던 `mode !== multi_turn` 조건부 `inputField` 렌더 로직(diff 207-214 라인)이 auto-form 의 `visibleWhen` 메커니즘으로 대체되는 것으로 설명되고 있으나, frontend 테스트에서 이를 직접 확인할 수 없음
  - 위치: 삭제된 `ai-configs.tsx` lines 207-214 (diff 상)
  - 상세: `visibility.test.ts` 는 `notEquals` 규칙을 일반적으로 검증하고 있어 메커니즘 자체는 커버된다. 그러나 `information_extractor` 의 실제 스키마에 `visibleWhen: { field: "mode", notEquals: "multi_turn" }` 가 선언돼 있어야 동작한다. 이 사실은 backend 스키마 정의에 의존하며, 현재 frontend 테스트 스위트에서 단언되지 않는다.
  - 제안: 중요도는 medium. 회귀 방지를 위해 backend schema 단의 snapshot 테스트 또는 e2e 를 통한 필드 노출 검증이 권장된다.

### 발견사항 6
- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 는 문서 파일로 테스트 대상이 아니며, 변경 내용은 V-02 완료 상태 업데이트다. 테스트 관점에서 검토할 사항 없음
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
  - 상세: 해당하는 plan 파일은 코드가 아니므로 테스트 커버리지 판단 대상에서 제외한다.
  - 제안: 없음.

---

## 요약

이번 변경은 bespoke AI node 설정 폼(`TextClassifierConfig`, `InformationExtractorConfig`)을 삭제하고 schema-driven auto-form 으로 이행하는 리팩터링이다. 삭제된 코드에 대한 전용 unit 테스트가 애초에 존재하지 않았으므로 테스트 손실은 없으나, 이것은 동시에 해당 컴포넌트의 복잡한 상호작용(카테고리/필드 CRUD, `mode` 에 따른 조건부 렌더)이 처음부터 테스트 미적용 상태였음을 의미한다. 변경 이후 두 노드가 실제로 auto-form 경로로 렌더되는지를 검증하는 `NodeConfigRenderer` 통합 테스트가 없고, backend zod 스키마가 bespoke 폼과 동일한 UI 힌트(특히 `inputField` 의 `visibleWhen` 조건)를 올바르게 방출하는지를 확인하는 테스트도 없다. 기존 `LLM_PROVIDER_NODES` 기반 테스트(`build-node-initial-config`, `node-config-summary`)는 변경과 무관하게 유효하다. 핵심 위험은 "backend 스키마가 충분한 UI 힌트를 방출하는가" 라는 가정이 현재 자동화 테스트로 검증되지 않는다는 점이다.

## 위험도

MEDIUM
