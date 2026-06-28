# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target: `spec/7-channel-web-chat/`
기준 plan: `plan/in-progress/webchat-polish-batch.md`
참조 plan: `plan/in-progress/webchat-widget-refactor.md`

---

## 발견사항

해당 plan 문서(`webchat-polish-batch.md`)가 명시한 변경 4건을 target spec diff 와 대조한 결과, 모든 변경이 plan 의 `## 변경 (spec)` 항목과 1:1 정합한다. 개별 항목별 확인:

1. **`2-sdk §1` `resetSession` 추가** — diff 확인: `open`/`close`/`sendMessage`/`updateProfile` 열거에 `resetSession` 삽입. `§3` 테이블 및 `§5 ChatInstance` 타입에는 이미 포함되어 있었으므로 §1 에만 누락이었던 drift 해소. plan 체크박스 `[x]`와 정합.

2. **`1-widget-app §2` 입력창 행 텍스트 표면 명시** — diff 확인: `ai_conversation` 표면만 명시하던 조건을 `ai_conversation 또는 pending=null(과도 상태)` + `판정 SoT widget-state.isTextInputSurface` 로 정밀화. SPEC-DRIFT 해소. plan 체크박스 `[x]`와 정합.

3. **`5-admin-console` `## Overview (제품 정의)` → `## Overview`** — diff 확인. plan 체크박스 `[x]`와 정합.

4. **`5-admin-console §2` + `§R1` `[0-architecture R5]` → `[0-architecture §R2]`** — diff 확인: §2 본문(63행)과 §R1(244행) 양쪽 모두 `R5` → `§R2` 수정. `§R5 carve-out` 참조(170·285행)는 유지. plan 항목 "63·244행 수정, §R5 carve-out 170·285행 유지"와 정확히 일치.

### 미해결 결정과의 충돌 (관점 1)

plan `## impl-prep 검토 결과` 절이 W-1·W-2·W-3 을 pre-existing 으로 분류하고 "별도 followup, 본 batch 미포함"으로 명기한다. 이 3건은 target spec 에서 변경되지 않았으며, target 이 해당 미결 사항을 임의로 결정한 흔적이 없다. 충돌 없음.

`0-overview §6.2→§6.1` webchat 이동 역시 plan 이 "revert(보류)"로 명기하고 NAV-WC-06 과의 정합 선행 조건을 이유로 미포함 처리했다. target 에 해당 이동이 없다. 충돌 없음.

### 선행 plan 미해소 (관점 2)

`webchat-widget-refactor.md` (PR #744 등)는 이미 `[x]` 완료로 표시되어 있으며, 본 batch 가 가정하는 `isTextInputSurface` 헬퍼(`widget-state.ts`)는 해당 plan 의 B2/B5 항목에서 구현됐다. target spec 변경(`§2 판정 SoT widget-state.isTextInputSurface`)이 그 헬퍼의 존재를 전제하는데, refactor plan 이 완료 상태이므로 선행조건은 충족되어 있다. 미해소 없음.

### 후속 항목 누락 (관점 3)

`resetSession` 이 §1 Overview 열거에 추가됐고 §3 테이블·§5 ChatInstance 에는 이미 존재했으므로, 이 변경으로 새로운 후속 plan 항목이 필요하지 않다. `isTextInputSurface` SoT 명시도 기존 코드의 spec 반영이라 구현 변경 없음. `§R2` 링크 수정은 단순 참조 번호 교정이다. 어떤 변경도 다른 plan 의 후속 항목을 무효화하거나 신규 파생을 생성하지 않는다.

---

## 요약

`webchat-polish-batch.md` 가 명시한 spec 변경 4건(`resetSession` §1 추가, 입력창 텍스트 표면 SoT 정밀화, Overview 헤더 표준화, §R2 참조 번호 수정)이 target diff 와 완전히 정합한다. 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 누락이 모두 없다. 코드 변경(`EmbedConfigDto` JSDoc, `safeApiBaseFromQuery`)은 spec 영역 대상이 아니라 별도 체크이며 plan 에 명시된 범위 내에 있다.

---

## 위험도

NONE
