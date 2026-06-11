# 요구사항(Requirement) Review — ai-node-override-fields

## 발견사항

### **[INFO]** `text_classifier` / `information_extractor` spec §2 설정 UI 다이어그램 — auto-form 이행 후 신규 노출 필드 미반영
- **위치**: `spec/4-nodes/3-ai/2-text-classifier.md §2` 설정 UI 다이어그램 / `spec/4-nodes/3-ai/3-information-extractor.md §2` 설정 UI 다이어그램
- **상세**: 두 spec 문서의 §2 ASCII UI 다이어그램은 bespoke 폼 시절에 작성된 것으로, auto-form 이행으로 새로 노출되는 필드(text_classifier: contextScope 5필드 · includeSystemContext · systemContextSections 2필드 총 7필드; information_extractor: 동일 Conversation Context 5필드 + memoryStrategy 7필드 + System Context 2필드 총 14필드)가 UI 다이어그램에 포함되지 않는다. §1 config 표에는 해당 필드가 모두 정확히 기술되어 있으므로 런타임 동작·설정 계약 자체는 올바르다. 다이어그램은 참고 illust 수준이어서 코드 동작에 영향을 주지 않는다.
- **제안**: spec §2 다이어그램 업데이트는 코드 버그가 아니나, 두 노드 spec 문서의 §2 UI 다이어그램이 현재 렌더되는 실제 설정 폼 레이아웃과 괴리가 생겼다. project-planner 가 다음 spec-sync 시 반영 필요. 코드 변경은 불필요.

---

### **[INFO]** `text_classifier` / `information_extractor` spec frontmatter `code:` 목록에 삭제된 `ai-configs.tsx` 항목 부재 (정상)
- **위치**: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter / `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter
- **상세**: 두 spec 파일 frontmatter의 `code:` 목록에 원래 `ai-configs.tsx`가 없었으므로 (삭제 전부터 미등재), 파일 삭제 후 frontmatter 업데이트가 필요하지 않다. frontend 설정 폼의 SoT는 `spec/3-workflow-editor/1-node-common.md`의 `node-configs/**` 와일드카드에 통합 위임된다. 설계상 올바른 상태.
- **제안**: 조치 불필요.

---

### **[INFO]** `[SPEC-DRIFT]` `text_classifier` spec §2 UI 다이어그램 — Conversation Context · System Context 섹션 미표현
- **위치**: `spec/4-nodes/3-ai/2-text-classifier.md §2` (lines 56–91)
- **상세**: 이 변경이 코드에서 의도적으로 노출을 확장한 것(bespoke 폼 → auto-form 이행)이므로 코드가 옳고 spec §2 UI 다이어그램만 낡았다. §1 config 표에 contextScope 5필드 + system context 2필드가 이미 명시되어 있어 필드 계약은 완전하나, §2 렌더 다이어그램이 새 필드 노출을 반영하지 않는다.
- **제안**: 코드 유지 + spec 반영. 대상: `spec/4-nodes/3-ai/2-text-classifier.md §2` 다이어그램에 Conversation Context 섹션(contextScope / contextScopeN / contextInjectionMode / includeToolTurns / excludeFromConversationThread) · System Context 섹션(includeSystemContext / systemContextSections) 추가. project-planner 위임.

---

### **[INFO]** `[SPEC-DRIFT]` `information_extractor` spec §2 UI 다이어그램 — Memory / Conversation Context / System Context 섹션 미표현
- **위치**: `spec/4-nodes/3-ai/3-information-extractor.md §2` (lines 70–110)
- **상세**: 기존 §2 다이어그램은 outputSchema / examples / mode / maxTurns / maxCollectionRetries 까지만 표현하며, auto-form 신규 노출 memoryStrategy 7필드(memoryKey · memoryTopK · memoryThreshold · memoryTtlDays · embeddingModel · extractionModel + memoryStrategy)와 contextScope 5필드 · system context 2필드가 빠져 있다. §1 config 표에는 이미 전부 기술되어 있으므로 필드 계약은 완전하다.
- **제안**: 코드 유지 + spec 반영. 대상: `spec/4-nodes/3-ai/3-information-extractor.md §2` 다이어그램에 Memory 섹션과 Conversation Context / System Context 섹션 추가. project-planner 위임.

---

## 요구사항 충족 관점의 전체 평가

핵심 기능 요구사항인 cross-audit V-02 — `text_classifier` · `information_extractor` 의 설정 폼 필드 노출 누락 해소 — 은 완전히 충족되었다. `OVERRIDE_REGISTRY`에서 두 노드를 제거함으로써 auto-form 경로(`SchemaForm`)가 zod 스키마의 모든 `.meta({ ui: ... })` 힌트를 그대로 렌더하게 되었고, 기존 bespoke 폼이 렌더하지 못하던 Conversation Context 5필드 · System Context 2필드 · few-shot `examples` · `outputSchema[].enumValues` · `maxCollectionRetries` · (information_extractor) memory 전략 7필드가 설정 패널에 정상 노출된다. `includeConfidence` 기본값이 구 bespoke 폼의 잘못된 `?? true` 에서 spec §1 정의(`false`)로 교정된 점, spec §2.6.3 트랙 배정 현황 갱신, spec Rationale §R-3 신설, plan 항목 V-02 완료 마크, 단위 테스트(`override-registry.test.ts`)로 회귀 방지까지 일관되게 처리되었다. backend schema는 변경 없이 이미 올바른 ui 힌트를 방출 중이었음이 코드로 확인되었다. 발견된 INFO 항목은 모두 spec §2 UI 다이어그램이 auto-form 노출 확장을 반영하지 못한 SPEC-DRIFT이며, 코드 동작·계약에는 영향이 없다.

## 위험도

NONE
