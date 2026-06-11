# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `includeConfidence` 기본값 변경 — 신규 노드 생성 시 UI 표시값 차이
- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (삭제됨) vs `codebase/backend/src/nodes/ai/text-classifier/text-classifier.schema.ts` L74-79
- **상세**: 삭제된 bespoke 폼은 `(config.includeConfidence as boolean) ?? true` 로 UI 초기값을 `true` 로 표시했다. 반면 backend zod 스키마는 `.default(false)` 로 정의돼 있고, handler (`text-classifier.handler.ts` L105) 도 `?? false` 로 평가한다. 이번 변경으로 auto-form 은 스키마 기반 `false` 를 기본값으로 표시하게 된다. CHANGELOG 에 이 동작 교정 사실이 명시되어 있으므로 의도된 변경이며, 기존 저장된 설정값에는 영향 없다. 다만 사용자가 구 폼에서 "기본값 그대로 저장"한 경우 `config.includeConfidence = true` 가 DB 에 기록됐을 가능성이 있는데, auto-form 은 DB 에 저장된 값을 그대로 읽어 표시하므로 기존 노드의 런타임 동작은 변경되지 않는다.
- **제안**: 별도 조치 불필요. CHANGELOG 의 설명이 충분하고 backend 의 `?? false` 평가가 이미 스키마 일관성을 보장한다.

### [INFO] `OVERRIDE_REGISTRY` 에서 두 항목 제거 — 렌더 경로 전환의 부작용 범위
- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts`
- **상세**: `text_classifier` 와 `information_extractor` 가 registry 에서 제거되어 `NodeConfigRenderer` (`index.tsx` L27)가 이 두 노드에 대해 `SchemaForm` 경로를 선택하게 된다. 이는 순수 렌더 경로 전환이며 전역 상태·파일시스템·네트워크 호출·이벤트 발생에 영향을 주지 않는다. registry 자체는 모듈 수준 상수 객체로, 두 키가 제거된 것 외에 다른 항목의 값이나 구조에 변화가 없다. 나머지 호출자들(`run-results/result-detail.tsx`, `canvas/custom-node.tsx` 등 override registry 를 참조하지 않는 파일들)도 영향 없다.
- **제안**: 이상 없음.

### [INFO] `ai-configs.tsx` 삭제 — 잔존 참조 없음 확인
- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (전체 삭제)
- **상세**: `grep` 검색 결과 삭제 후 `TextClassifierConfig` 또는 `InformationExtractorConfig` 를 import 하는 파일이 코드베이스 내에 남아 있지 않다. 유일한 import 였던 `override-registry.ts` 에서도 해당 import 블록이 제거되었다. 파일 삭제로 인한 dangling import 는 없다.
- **제안**: 이상 없음.

### [INFO] i18n 키 잔존 — 미사용 번역 키
- **위치**: `codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts`, `codebase/frontend/src/lib/i18n/dict/en/nodeConfigs.ts`
- **상세**: `includeConfidence`, `includeConfidenceHint` 등 삭제된 bespoke 폼에서만 사용하던 i18n 키가 번역 사전에 잔존할 가능성이 있다. 이는 런타임 오류나 부작용을 유발하지 않으며, 미사용 번역 키는 번들 사이즈에 미미한 영향만 줄 수 있다. auto-form 은 backend schema 의 `ui.label` 을 직접 사용하므로 이 키들은 실제로는 더 이상 호출되지 않는다.
- **제안**: 별도 cleanup ticket 으로 처리 가능하나 블로킹 이슈는 아님.

---

## 요약

이번 변경은 `text_classifier` 와 `information_extractor` 두 노드를 bespoke override 폼에서 schema-driven auto-form 으로 전환하는 순수 렌더 경로 변경이다. 전역 상태, 환경 변수, 네트워크 호출, 이벤트/콜백에 대한 부작용은 없다. 유일하게 주목할 부분은 신규 노드 생성 시 `includeConfidence` 의 UI 기본값이 `true`(구 폼) 에서 `false`(스키마 정의)로 교정되는 것인데, 이는 spec 과 backend 스키마 기준으로 올바른 동작이며 기존 저장된 설정에는 영향이 없다. `ai-configs.tsx` 삭제 후 dangling import 는 없으며, 레지스트리에서 두 키 제거 외 다른 구조적 변화는 없다.

## 위험도

LOW
