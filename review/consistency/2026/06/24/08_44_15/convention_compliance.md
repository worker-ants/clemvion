# 정식 규약 준수 검토 결과

**검토 모드**: `--impl-done`  
**scope**: `spec/3-workflow-editor/4-ai-assistant.md`  
**diff-base**: `origin/main`

---

## 발견사항

### [WARNING] spec §10 `shouldSkipReview` skip 조건 목록과 구현 불일치
- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` §10 Part B "review skip 조건 (`shouldSkipReview`)" (line 952–961)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2-3` — `status: implemented` spec 은 `code:` glob 이 실제 구현을 정확히 반영해야 한다. spec 본문이 "구현과 동기화 유지" 를 명시(`시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지`)한 경우 spec 본문 자체도 동일 의무에 포함된다.
- **상세**: spec line 958 은 `state.finishBlockCount > 0` 를 skip 조건으로 열거한다. 그러나 구현 diff 에서 `AssistantFinishGuard.shouldSkipReview`(`assistant-finish-guard.service.ts`)의 skip 조건 목록에는 `finishBlockCount` 가 **존재하지 않는다** — 이는 spec §10 §5 "Review guard 항상 발동"(line 1072–1088) 에서 해당 조건을 **제거**하기로 결정했음을 선언하면서도, 바로 위 `shouldSkipReview` 절(line 956–961)의 목록 자체를 갱신하지 않은 내부 불일치다. 두 절이 같은 spec 문서 안에서 모순 관계다.
  - spec line 958: `state.finishBlockCount > 0` 를 skip 조건으로 나열 (제거 전 상태)
  - spec line 1078: "`finishBlockCount > 0` 체크 **제거**" 선언 (제거 후 상태)
  - 구현(`AssistantFinishGuard.shouldSkipReview`): `finishBlockCount` 조건 없음 (line 1078 결정 반영)
  - 따라서 spec §10 의 `shouldSkipReview` 목록이 구현보다 뒤처진 상태다.
- **제안**: `spec/3-workflow-editor/4-ai-assistant.md` line 958 의 `- state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면...` 항목을 삭제하고, line 1084–1088 의 "남은 skip 조건" 목록이 authoritative list 임을 명시한다. 또는 line 952–961 블록을 "남은 skip 조건" 목록(line 1084–1088)을 가리키는 xref 로 대체.

---

### [WARNING] spec `code:` frontmatter 가 새로 추출된 서비스 파일을 누락
- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` 항목 (lines 5–12)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: implemented` spec 의 `code:` 는 본 spec 이 약속한 surface 의 구현 경로를 열거하며, `spec-code-paths.test.ts` 가드가 ≥1 파일 매치를 강제한다. 구체적으로 spec 이 직접 명명·약속한 새 파일이 생겼을 때 `code:` 에 반영해야 한다.
- **상세**: 이번 diff 는 `WorkflowAssistantStreamService` 에서 finish/review 가드 로직을 `AssistantFinishGuard` 로 추출해 신규 파일 2개를 만들었다:
  - `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts`
  - `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts`
  
  현재 `code:` 는 `codebase/backend/src/modules/workflow-assistant/**/*.ts` 글로브를 포함하므로 **현재 가드는 통과**한다. 그러나 spec §10 이 `evaluateFinishGuard` / `evaluateReviewGuard` / `shouldSkipReview` / `FinishGuardState` 를 직접 명명해 구현 surface 로 약속했으므로, `AssistantFinishGuard` 클래스를 보유하는 파일이 spec 의 핵심 surface 임이 명확하다. 글로브는 충분하나, 해당 파일이 spec §10 Part B 의 중심 구현체임을 `code:` 에서 별도 항목으로 명시하면 stale glob 탐지(`/spec-coverage`)와 coverage standing audit 의 NLP 매칭이 더 정확해진다.
- **제안**: 필수 수정은 아님 (`codebase/backend/src/modules/workflow-assistant/**/*.ts` 글로브가 이미 커버). 다만 spec 의 명시적 약속 파일로서 별도 행 추가를 고려:
  ```yaml
  - codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts
  - codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts
  ```
  또는 현 글로브 수준 유지를 의식적으로 결정했음을 spec Rationale 에 한 줄 추가.

---

### [INFO] `MIN_EDITS_FOR_VERIFY` vs `MIN_NONTRIGGER_NODES_FOR_VERIFY` — spec 과 구현의 조건 표현 불일치
- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` line 680, line 945
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — spec 본문은 구현이 약속하는 surface 의 단일 진실이다.
- **상세**: spec line 680 과 945 는 `WORKFLOW_VERIFY_REQUIRED` 발동 조건을 "성공 edit 이 `MIN_EDITS_FOR_VERIFY` 이상이고 non-trigger 노드가 **3개 이상**" 으로 기술한다. 그러나 구현(`assistant-finish-guard.service.ts` line 425-426)에서 edit 수 조건(`MIN_EDITS_FOR_VERIFY`)은 존재하지 않으며, 조건은 **non-trigger 노드 수 ≥ `MIN_NONTRIGGER_NODES_FOR_VERIFY`(=3)** 만이다. spec 이 언급하는 `MIN_EDITS_FOR_VERIFY` 상수 자체가 구현에 없다. 구현 주석(line 419–426)은 "edit 호출 수가 아니라 노드 수를 쓰는 이유" 를 명시하며, edit 수 기준을 **의도적으로 채택하지 않았음**을 설명한다.
- **제안**: spec line 680 과 945 에서 "`MIN_EDITS_FOR_VERIFY` 이상이고" 조건을 제거하고, "non-trigger 노드 수 ≥ `MIN_NONTRIGGER_NODES_FOR_VERIFY`(3)" 만을 조건으로 기술하도록 수정한다.

---

## 요약

`spec/3-workflow-editor/4-ai-assistant.md` 는 정식 규약(`spec/conventions/spec-impl-evidence.md`)의 frontmatter 의무(`id`, `status: implemented`, `code:` glob)를 모두 충족하며 빌드 가드를 통과한다. 명명 규약(UPPER_SNAKE_CASE 에러 코드), API/DTO 규약, 문서 3섹션 구조(Overview·본문·Rationale)도 준수한다. 다만 spec 내부의 `shouldSkipReview` skip 조건 목록(§10 Part B)이 같은 문서 아래 §10 §5 에서 결정한 `finishBlockCount` 조건 제거를 반영하지 않아 spec 내 모순이 발생했다(WARNING). 또한 spec 이 `MIN_EDITS_FOR_VERIFY` 상수를 발동 조건으로 기술하나 구현은 해당 상수 없이 노드 수만으로 판정하는 drift 가 있다(INFO). 두 이슈 모두 구현이 올바른 쪽이므로 spec 본문을 구현에 맞게 정정하는 것이 권장된다.

## 위험도

LOW
