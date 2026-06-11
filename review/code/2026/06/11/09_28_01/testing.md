# Testing Review — AI 노드 override 필드 (V-02)

## 발견사항

### [INFO] override-registry.test.ts — 회귀 방지 테스트 설계가 명확하고 적절
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/override-registry.test.ts`
- 상세: 두 테스트 케이스가 의도를 잘 표현한다. 첫 번째는 삭제된 노드들(`ai_agent`, `text_classifier`, `information_extractor`)의 미등록을 고정하고, 두 번째는 cross-field side effect 때문에 override 잔존이 의도된 노드(`switch`, `table`)의 등록을 검증한다. 코멘트로 spec 절·audit ID 를 명기해 맥락 이해를 돕는다.
- 제안: 없음 (충분).

### [WARNING] `includeConfidence` 기본값 변경(true → false)에 대한 schema 명시 테스트 부재
- 위치: `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts`
- 상세: CHANGELOG 에 "구 bespoke 폼이 `true` 로 표시하던 것은 spec 과 어긋난 동작이었고 본 전환으로 교정됐다"고 명시되어 있다. 이는 UI 의 기본값 표시가 바뀌는 동작 변경이다. 그러나 `text-classifier.schema.spec.ts` 에는 `includeConfidence` 기본값이 `false` 임을 검증하는 테스트가 없다. `includeEvidence` 기본값(`false`) 은 테스트되어 있지만(`it('defaults includeEvidence to false')`), `includeConfidence` 기본값은 누락되어 있다.
- 제안: 아래 케이스를 `textClassifierNodeConfigSchema` describe 블록에 추가:
  ```ts
  it('defaults includeConfidence to false (spec §1, was incorrectly shown as true in legacy bespoke form)', () => {
    const result = textClassifierNodeConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeConfidence).toBe(false);
    }
  });
  ```

### [INFO] NodeConfigRenderer 에 대한 단위 테스트가 없음 — 현재 변경 범위와는 무관
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/index.tsx`
- 상세: `NodeConfigRenderer` 는 분기 로직(`OVERRIDE_REGISTRY` 있으면 bespoke, 없으면 `SchemaForm`)을 담당하는 핵심 라우팅 컴포넌트이나 직접 테스트가 없다. `override-registry.test.ts` 가 registry 상태를 고정하므로 간접적으로는 보호된다. 단, `getNodeDefinition` 이 null 을 반환할 때 `null` 을 렌더하는 경로는 미커버다.
- 제안: 이번 PR 범위 밖이나 장기 개선 항목으로 기록. 현재 auto-form 이행 목적상 `override-registry.test.ts` 의 회귀 방지로 충분.

### [INFO] auto-form 렌더 경로에서 text_classifier / information_extractor 전용 통합 테스트 없음
- 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/__tests__/`
- 상세: `schema-form.test.ts`, `visibility.test.ts` 등은 auto-form 로직 자체를 단위 테스트하지만, 실제 `textClassifierNodeConfigSchema` / `informationExtractorNodeConfigSchema` 를 SchemaForm 에 넘겼을 때 기대 필드가 모두 렌더되는지 검증하는 통합 테스트는 없다. 즉 `field-array`, `llm-config-selector`, `visibleWhen` 기반의 `inputField` 조건 노출 등이 실제로 작동하는지 렌더 레벨에서 확인되지 않는다.
- 제안: 이번 PR 의 핵심 목적이 "폼이 schema 힌트 필드를 모두 노출하는가"이므로, e2e 또는 render 통합 테스트가 없는 것은 테스트 갭이다. 단기적으로 vitest + jsdom 환경에서 SchemaForm 에 두 스키마를 넘겼을 때 렌더된 필드 목록을 스냅샷 또는 getByLabelText 로 검증하는 테스트를 추가하는 것을 권장한다.

### [INFO] 삭제된 ai-configs.tsx 에 대한 테스트 파일이 존재하지 않았고, 삭제 후에도 orphan 없음 — 정상
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (삭제됨)
- 상세: 원본 `ai-configs.tsx` 에는 전용 unit test 가 없었다(bespoke 폼을 render testing 하지 않던 기존 패턴). 삭제로 인해 orphan test 파일이 생기지 않았으며, 관련 테스트 회귀 위험 없음.
- 제안: 없음.

### [INFO] 기존 backend schema spec 테스트는 변경 영향 없이 유효
- 위치: `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.spec.ts`, `information-extractor.schema.spec.ts`
- 상세: 두 파일 모두 schema, warningRules, validateConfig, outputSchema, summaryTemplate 에 대한 충분한 케이스를 보유하고 있다. 이번 PR 은 backend schema 를 0건 변경하므로 기존 테스트는 모두 유효하다. `text-classifier.handler.spec.ts` 도 `includeConfidence: true/false` 케이스를 직접 사용하므로 handler 동작은 커버된다.

## 요약

이번 PR 의 핵심 테스트 산출물인 `override-registry.test.ts` 는 회귀 방지 목적에 충분히 잘 설계되어 있으며, spec 절과 audit ID 참조로 의도가 명확히 표현되어 있다. backend schema 변경이 없으므로 기존 backend spec 파일들도 그대로 유효하다. 단, CHANGELOG 가 명시한 동작 변경(`includeConfidence` 기본값이 구 bespoke 폼에서 `true` 로 잘못 표시되다가 `false` 로 교정됨)에 대한 schema 레벨 테스트가 누락되어 있고, auto-form 이 두 AI 노드의 전 필드를 실제로 렌더하는지를 검증하는 렌더 통합 테스트가 없는 것이 두 가지 갭이다. 전자는 소규모 수정으로 즉시 보완 가능하며, 후자는 이번 변경의 핵심 가치(필드 노출 보장)를 직접 검증한다는 점에서 추가를 권장한다.

## 위험도

LOW
