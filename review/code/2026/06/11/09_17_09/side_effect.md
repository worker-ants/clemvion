# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `ai-configs.tsx` 파일 전체 삭제 — export 소비자 없음 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (삭제)
  - 상세: 삭제된 `TextClassifierConfig` · `InformationExtractorConfig` 에 대해 `grep` 전수 탐색을 수행한 결과 `override-registry.ts` 이외에 이 심볼을 import 하는 파일이 존재하지 않는다. 삭제로 인한 미해결 참조(dangling import)는 없다. `text_classifier` · `information_extractor` 식별자 자체는 canvas, run-results, expression, websocket 등 다수 파일에 문자열 리터럴로 남아 있으나, 이는 노드 타입 식별자이며 삭제된 UI 컴포넌트와 독립적인 사용이다.
  - 제안: 없음.

- **[INFO]** `OVERRIDE_REGISTRY` 에서 두 키 제거 — 런타임 폼 분기 변경
  - 위치: `override-registry.ts` line 62–70 (변경 후)
  - 상세: `NodeConfigRenderer` (`index.tsx:27`)는 `OVERRIDE_REGISTRY[nodeType]` 조회 실패 시 `SchemaForm`으로 자동 폴백한다. `text_classifier` · `information_extractor` 두 키가 제거됨으로써 이 경로로 진입하게 된다. `SchemaForm`은 `getNodeDefinition(nodeType).configSchema`를 사용하며, 두 노드의 zod 스키마는 `widget-registry.ts`에 등록된 모든 위젯(`llm-config-selector`, `expression`, `field-array`, `checkbox`, `select`, `number`, `textarea`)을 선언하고 있고, `visibleWhen` 게이트도 스키마 수준에서 정의되어 있다. 이행 자체는 의도된 동작이며, UI 상태 변경은 의도적이다.
  - 제안: 없음.

- **[INFO]** `includeConfidence` 기본값 불일치 (bespoke form vs. zod schema)
  - 위치: 삭제된 `ai-configs.tsx` line 97 vs. `text-classifier.schema.ts` line 77
  - 상세: 삭제된 bespoke form은 `(config.includeConfidence as boolean) ?? true` (기본 `true`)로 렌더했다. zod 스키마(`textClassifierNodeConfigSchema`)는 `includeConfidence: z.boolean().default(false)`로 선언한다. auto-form 이행 이후 신규 노드 생성 시 이 필드의 UI 기본 표시값이 `true`에서 `false`로 변경된다. 기존에 이미 저장된 노드 설정에는 영향 없다(persisted config가 우선). 단, 과거 bespoke form에서 사용자가 `includeConfidence=true`를 의도하면서 명시적으로 저장한 적 없는 노드는 auto-form에서 `false`로 보일 수 있다. zod 스키마가 정규 SoT이므로 이 불일치는 bespoke form 쪽의 버그였던 것으로 보이나, 행동 변경은 실질적이다.
  - 제안: 의도적 변경임을 PR 설명에 명시하거나, zod 스키마 기본값을 `true`로 수정하는 것이 하위호환적이다.

- **[INFO]** plan 파일 텍스트 변경 — 부작용 없음
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
  - 상세: 체크리스트 항목 업데이트 및 PR 번호 정정(`본 PR` / `#533`)이다. 상태 추적 문서의 순수 텍스트 변경이며 코드 런타임 부작용 없음.
  - 제안: 없음.

## 요약

이번 변경은 두 AI 노드(text_classifier · information_extractor)의 bespoke 폼 컴포넌트(`ai-configs.tsx`)를 삭제하고 `OVERRIDE_REGISTRY`에서 해당 키를 제거해 auto-form(schema-driven) 경로로 이행하는 것이다. 삭제된 export를 참조하는 외부 소비자가 없으며 `NodeConfigRenderer`의 폴백 로직이 이 이행을 설계상 지원한다. 의도치 않은 전역 상태 변경·파일시스템 부작용·시그니처 파괴·환경변수·네트워크 호출·이벤트 변경은 발견되지 않는다. 유일한 주목할 동작 변화는 `includeConfidence` 필드의 UI 기본 표시값이 bespoke form의 `true`에서 zod 스키마 선언 `false`로 바뀌는 것이며, 이는 신규 노드 추가 시에만 관찰되고 기저장 설정에는 무영향이다.

## 위험도

LOW
