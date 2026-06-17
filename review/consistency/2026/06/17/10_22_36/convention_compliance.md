# 정식 규약 준수 검토 결과

**대상**: `spec/5-system/4-execution-engine.md` 범위 구현 diff  
**diff-base**: `claude/engine-split-s2-aiturn`  
**검토 모드**: `--impl-done`  
**검토 일시**: 2026-06-17

---

## 발견사항

### **[WARNING]** `button_continue` interaction.data 에 미명세 `selectedItem?` 필드 포함

- **target 위치**: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts`, `processButtonResumeTurn` 내 `structuredInteraction` 빌드 블록 (`button_continue` 분기, diff +800~+815)
- **위반 규약**: `spec/conventions/node-output.md` §4.5 `interaction.data` payload 규격
  ```
  | `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 (presentation 노드) |
  ```
- **상세**: 규약 §4.5 는 `button_continue` 의 `data` shape 을 `{ buttonId, buttonLabel, url }` 로 고정한다. 구현 코드는 `selectedItem?` 필드를 추가로 포함한다(`url` 도 조건부(`clickedButton.url ? ...`)). `selectedItem` 이 `button_continue` 경로에서 실제로 의미 있는 값인지(item-level 링크 버튼 시나리오)는 사용 근거가 될 수 있으나, 현재 규약에는 등재되지 않아 규약과 구현이 불일치한다.
- **제안**: 두 가지 중 하나. (A) item-level 링크 버튼에서 `selectedItem` 이 실제로 필요하다면 `spec/conventions/node-output.md` §4.5 의 `button_continue` data shape 을 `{ buttonId, buttonLabel, url, selectedItem? }` 으로 갱신한다. (B) 기능이 불필요하다면 해당 코드 분기에서 `selectedItem` spread 를 제거한다.

---

### **[WARNING]** `previousOutput` 필드를 신규 structured output 에 추가 (규약이 명시 폐기 예정)

- **target 위치**: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts`, `processButtonResumeTurn` 내 `structuredOutputPayload` 구성 (diff +878~+882)
  ```ts
  const structuredOutputPayload = {
    ...(prevOutput as Record<string, unknown>),
    interaction: structuredInteraction,
    previousOutput: prevOutput,   // ← 이 줄
  };
  ```
- **위반 규약**: `spec/conventions/node-output.md` §4.2 "폐기할 필드 / 구조"
  ```
  현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).
  ```
- **상세**: 규약 §4.2 는 `output.previousOutput` 을 명시적 폐기 대상으로 열거한다. 본 diff 는 button resume 경로에서 `previousOutput` 을 새로 추가한다. 코드 자체도 JSDoc 에 "legacy transitional field (CONVENTIONS §4.2 explicitly marks it for retirement)" 라고 명시하며 Phase 3 제거를 트래킹하고 있어 의도를 인지하고 있으나, 신규 추가는 규약의 방향과 역행한다.
- **제안**: 신규 코드에서는 `previousOutput` 추가를 피하거나, 이 필드를 Phase 3 제거 전 필수 보존 근거가 있다면 `spec/conventions/node-output.md` §4.2 에 "ButtonInteractionService 를 포함한 presentation resume 경로는 Phase 3 까지 `previousOutput` 보존 예외" 라는 명시적 예외 항목을 추가한다.

---

### **[INFO]** `interaction-type-registry.md` `code:` 항목이 새로운 단일 진실 위치를 반영하지 않음

- **target 위치**: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 및 §1.1 표
- **위반 규약**: `spec/conventions/interaction-type-registry.md` §1.1 "단일 진실 위치"
  ```
  | Backend | codebase/backend/src/modules/execution-engine/execution-engine.service.ts | type WaitingInteractionType = ... |
  ```
- **상세**: 본 diff 는 buttons/form blocking-interaction 처리를 `ButtonInteractionService` / `FormInteractionService` 로 분리했다. `interaction-type-registry.md` 의 `code:` frontmatter 와 §1.1 표에는 `execution-engine.service.ts` 만 등재돼 있으며 새 두 서비스 파일은 없다. `WaitingInteractionType` 자체는 여전히 `execution-engine.service.ts` 에 있을 가능성이 높아 §1.1 의 "단일 진실" 위치가 깨지지는 않는다. 그러나 buttons waiting emit(`'buttons'`) 이 이제 `ButtonInteractionService.waitForButtonInteraction` 에서 발행되므로, §1.2 매트릭스의 "Backend emit 위치" 열 설명이 사실상 달라졌다.
- **제안**: `spec/conventions/interaction-type-registry.md` §1.2 `buttons` 행의 "Backend emit 위치" 설명을 `ButtonInteractionService.waitForButtonInteraction` (via `execution-engine.service.ts` 위임) 으로 갱신하고, `code:` frontmatter 에 두 새 서비스 파일을 추가한다. 단 `WaitingInteractionType` 자체가 이동하지 않았다면 §1.1 본문은 그대로 유지 가능.

---

### **[INFO]** 명명 규약 — 새 서비스 파일 이름은 규약과 일치

- **target 위치**: `button-interaction.service.ts`, `form-interaction.service.ts`
- **위반 규약**: 없음 (관찰 사항)
- **상세**: `<noun>-interaction.service.ts` 명명은 NestJS 서비스 kebab-case 관행과 일치하고, 동일 모듈의 `ai-turn-orchestrator.service.ts` 선례와도 일관된다. CLAUDE.md의 파일 명명 규약(언급 없음) 및 swagger.md / error-codes.md 의 명명 규약과도 충돌하지 않는다.
- **제안**: 없음.

---

## 요약

본 diff 는 `ExecutionEngineService` 의 버튼/폼 blocking-interaction 처리를 `ButtonInteractionService` / `FormInteractionService` 로 추출하는 strangler-fig 리팩터링이다. 파일 명명·DI 구조·테스트 패턴은 기존 `AiTurnOrchestrator` 선례를 충실히 따른다. 정식 규약 관점에서 두 가지 규약 불일치가 식별됐다: (1) `spec/conventions/node-output.md` §4.5 에 명세되지 않은 `selectedItem` 필드가 `button_continue` interaction.data 에 포함되어 있고, (2) 규약 §4.2 에서 명시 폐기 예정으로 열거된 `previousOutput` 필드가 신규 resume output 에 추가됐다. 두 항목 모두 즉각적 동작 파손보다는 규약 drift 에 해당하므로 WARNING 등급으로 분류한다. interaction-type-registry 의 `code:` / emit 위치 미갱신은 INFO 수준이다.

## 위험도

**LOW**
