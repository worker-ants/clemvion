## 발견사항

---

### [WARNING] `system-prompt.ts` JSDoc 헤더의 few-shot 예시 수 불일치
- **위치:** `system-prompt.ts:8` (함수 상단 JSDoc)
- **상세:** JSDoc 주석이 "Few-shot 예시 3개 (간단 수정 / 현재 캔버스 조회 / 복잡 요청)"라고 명시하고 있으나, 이번 변경으로 "New workflow from scratch"와 "Dynamic-ports branch" 예시가 추가되어 실제로는 5개가 됨. 숫자와 목록이 모두 구식.
- **제안:**
  ```
  *  6) Few-shot 예시 5개 (간단 수정 / 캔버스 조회 / 신규 워크플로우 / 동적 포트 분기 / 복잡 요청)
  ```

---

### [WARNING] `WorkflowAssistantStreamService` 클래스 JSDoc에 `finish` 가드 흐름 누락
- **위치:** `workflow-assistant-stream.service.ts:90~106` (클래스 상단 JSDoc)
- **상세:** 클래스 JSDoc은 `finish: 루프 종료`라고 단순 기술하고 있으나, 이번 변경의 핵심인 `PLAN_NOT_COMPLETE` 블로킹 — "pending step이 남아있으면 tool_result로 에러 반환 후 루프를 한 번 더 순환" — 흐름이 전혀 언급되지 않음. 서비스 유지보수자가 핵심 동작을 오해할 수 있음.
- **제안:** `- finish` 항목에 다음 내용 추가:
  ```
  *       - finish: `evaluateFinishGuard` 로 plan 완결성 점검 →
  *           pending step 있으면 PLAN_NOT_COMPLETE 를 tool_result 로 반환해
  *           루프를 한 번 더 돌림 (finishBlockCount로 2회 이상 반복 방지)
  ```

---

### [WARNING] Spec §13 i18n 테이블에 신규 키 3개 누락
- **위치:** `spec/3-workflow-editor/4-ai-assistant.md:§13`
- **상세:** 실제 i18n 파일(`en.ts`, `ko.ts`)에 `planQuestionsTitle`, `planQuestionsPlaceholder`, `planQuestionsSend` 세 키가 추가됐으나, Spec §13 i18n 매핑 테이블에는 반영되지 않음. Spec이 구현의 단일 진실 원천 역할을 해야 하는 프로젝트에서 테이블 불일치는 신규 번역 추가 시 누락을 야기함.
- **제안:** Spec §13 테이블에 아래 3행 추가:

  | 키 | 한국어 | 영어 |
  |----|--------|------|
  | `assistant.planQuestionsTitle` | 답변이 필요한 항목 | Questions to answer |
  | `assistant.planQuestionsPlaceholder` | 질문에 대한 답변을 입력하세요... | Answer the questions above... |
  | `assistant.planQuestionsSend` | 답변 전송 | Send answer |

---

### [WARNING] Spec과 구현 간 `finish` 2회 연속 블록 시 종료 동작 불일치
- **위치:** `spec/3-workflow-editor/4-ai-assistant.md:§4.3` finish 행, `workflow-assistant-stream.service.ts:evaluateFinishGuard`
- **상세:** Spec은 "반복 실패 시(2회 연속) 안전 탈출해 **error 이벤트**로 종료"라고 명시하지만, 실제 구현은 `finishBlockCount > 0`이면 `evaluateFinishGuard`가 `null`을 반환해 정상 `finish`(→ `finishReason: 'stop'`)로 탈출함. 테스트도 `finishReason: 'stop'`을 검증하고 있어 구현이 의도적임을 확인할 수 있으나, Spec 문구가 이를 반영하지 않음.
- **제안:** Spec의 해당 셀을 다음으로 수정:
  ```
  반복 실패 시(2회 연속) 두 번째 finish는 pending step 유무와 관계없이
  정상 종료(finishReason: stop)로 안전 탈출
  ```

---

### [INFO] `workflow-assistant-stream.service.spec.ts` 파일 헤더 커버리지 목록 미갱신
- **위치:** `workflow-assistant-stream.service.spec.ts:7~16` (파일 상단 주석)
- **상세:** 파일 상단에 테스트가 커버하는 시나리오 목록이 있으나, 이번에 추가된 3가지 `PLAN_NOT_COMPLETE` 시나리오(블로킹, plan-only 턴 허용, 2회 연속 탈출)가 누락됨. 기여자가 어떤 케이스가 이미 테스트되고 있는지 파악하기 어려움.
- **제안:** 목록에 항목 추가:
  ```
  *   - `finish` guard: PLAN_NOT_COMPLETE 블로킹 후 루프 지속, plan-only 턴에서는
  *     허용, 2회 연속 블록 시 안전 탈출
  ```

---

### [INFO] `PlanCardProps`의 `onAnswerQuestions` 선택 prop에 JSDoc 설명 없음
- **위치:** `plan-card.tsx:9`
- **상세:** `onApprove`와 달리 새로 추가된 `onAnswerQuestions`가 어떤 시점에 호출되는지(openQuestions가 있을 때 사용자 답변 전송) 인터페이스 정의만으로는 명확하지 않음. 선택 prop이라 호출자가 언제 이 prop을 넘겨야 하는지 애매할 수 있음.
- **제안:**
  ```tsx
  /** openQuestions가 있는 플랜에서 사용자가 답변을 제출할 때 호출. 미전달 시 답변 입력창이 숨겨짐. */
  onAnswerQuestions?: (answer: string) => void;
  ```

---

## 요약

전반적으로 변경사항에 대한 인라인 주석과 Spec 문서 업데이트가 충실히 이루어졌으며, `evaluateFinishGuard` 메서드의 JSDoc과 시스템 프롬프트 변경에 동반된 한국어 설명 주석은 복잡한 로직을 잘 설명하고 있다. 다만 (1) `system-prompt.ts` JSDoc의 few-shot 개수 불일치, (2) 서비스 클래스 JSDoc에 `PLAN_NOT_COMPLETE` 핵심 흐름 누락, (3) Spec §13 i18n 테이블의 신규 키 3개 누락, (4) Spec과 구현 간 2회 연속 블록 종료 동작 불일치 — 이 네 가지가 스펙과 코드 간 신뢰를 흐릴 수 있어 수정이 권장된다.

## 위험도

**MEDIUM** — 기능 동작에 직접 영향을 주진 않으나, Spec과 구현의 불일치(`finish` 2회 블록 종료 동작)가 후속 기여자에게 잘못된 구현 방향을 안내할 가능성이 있음.