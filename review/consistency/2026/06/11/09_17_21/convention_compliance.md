# 정식 규약 준수 검토 결과

검토 대상: V-02 AI 노드 override UI 누락 해소 — IE/TC auto-form 이행
검토 범위: `diff-base=origin/main`, 구현 완료 후 (`--impl-done`)
검토 일시: 2026-06-11

---

## 발견사항

변경 내용은 두 파일로 구성된다.

1. `codebase/frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` — 전체 삭제 (262줄)
2. `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts` — AI 절 import 제거 + `text_classifier` / `information_extractor` 키 제거

### 발견사항

- **[INFO]** 삭제 후 주석 단독 잔류 블록
  - target 위치: `override-registry.ts` 변경 후 65~68행 — `// AI — ai_agent · text_classifier · information_extractor migrated to …` 주석 블록이 코드 엔트리 없이 `// Integration` 섹션 바로 앞에 위치
  - 위반 규약: 직접적인 규약 위반은 없음. `spec/conventions/swagger.md` / `spec/conventions/node-output.md` 는 코드 스타일을 규정하지 않음
  - 상세: 다른 "migrated to auto-form" 섹션(Logic: `split, map, foreach, merge`, Presentation: `carousel`)은 기존 코드 섹션의 인라인 주석으로 처리되어 있는 반면, AI 절은 registry 키가 하나도 없는 독립 주석 블록으로 남아 있어 일관성 격차가 있음
  - 제안: AI 주석을 `// Flow` 섹션 아래 인라인 형태로 이동(`// AI — ai_agent · text_classifier · information_extractor migrated to auto-form (V-02)` 한 줄로 압축)하거나, `workflow: WorkflowConfig` 엔트리 아래에 인라인 주석으로 덧붙이면 전체 패턴과 정합함. 단, 현재 형태도 기능 및 빌드에 문제가 없으므로 선택 사항

**CRITICAL / WARNING 발견 없음.**

---

## 규약별 점검 결과

### 1. 명명 규약

- 삭제된 `ai-configs.tsx` 파일명: `kebab-case` — 기존 `logic-configs.tsx`, `flow-configs.tsx` 등과 동일 패턴. 준수.
- 삭제된 컴포넌트 `TextClassifierConfig`, `InformationExtractorConfig`: PascalCase — 파일 내 다른 컴포넌트와 일치. 준수.
- registry 키 `text_classifier`, `information_extractor`: snake_case — `spec/conventions/node-output.md` 및 기존 registry 전체의 노드 타입 식별자 패턴과 일치. 준수.

### 2. 출력 포맷 규약

- 변경은 순수 프론트엔드 UI 레이어(React 설정 패널 컴포넌트)이며 backend 노드 핸들러 출력 포맷을 건드리지 않음.
- `spec/conventions/node-output.md` §3.3 이 명시한 `text_classifier` / `information_extractor` 의 error 포트·`retryable` 의무는 backend handler 레이어에 해당하며 본 diff 의 영향 범위 밖. 위반 없음.
- `spec/conventions/node-output.md` §8.2 의 `output.result.*` LLM 계열 래핑 규약도 backend 출력 계약이므로 본 diff 미영향. 위반 없음.

### 3. 문서 구조 규약

- 변경 파일은 spec 문서가 아니라 codebase 코드 파일이므로 Overview / 본문 / Rationale 3섹션 의무, `_product-overview.md`, `0-` prefix 규약 적용 대상 아님. 해당 없음.

### 4. API 문서 규약

- Swagger / OpenAPI 데코레이터 변경 없음. DTO 변경 없음. 해당 없음.

### 5. 금지 항목

- `spec/conventions/` 에서 명시적으로 금지한 패턴 — `spread rawConfig echo`, `output.view.type` 판별자, `port` 오용 등 — 본 diff 와 무관. 위반 없음.

---

## 요약

본 변경(`ai-configs.tsx` 삭제 + `override-registry.ts` 정리)은 프론트엔드 UI 레이어의 중복 코드 제거에 해당하며, `spec/conventions/` 의 어떤 정식 규약도 직접 위반하지 않는다. 명명 패턴(파일명 kebab-case, 컴포넌트 PascalCase, registry 키 snake_case)은 기존 관행과 완전히 일치하고, backend 출력 계약(`node-output.md`)은 영향받지 않는다. 단일 INFO 항목은 삭제 후 코드 없이 잔류하는 주석 블록의 미세한 형식 일관성 문제이며 차단 사유가 아니다.

---

## 위험도

NONE
