# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리
**리뷰 일시**: 2026-06-24
**커밋**: 1c17795c277075ce62b118a01963428c542d73d2

---

## 발견사항

### **[INFO]** `AssistantFinishGuard` 클래스 수준 JSDoc 이 리팩터링 동기를 충분히 설명함
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` L556–562
- **상세**: 클래스 JSDoc 이 "M-3 2단계", spec 참조(`3-workflow-editor §10`), 설계 결정(호출부 소유 카운터·가드는 판정만)을 모두 기재. 신규 진입자가 왜 분리됐는지 이해하기 충분하다.
- **제안**: 없음. 현 수준 적절.

---

### **[INFO]** `FinishGuardState` 인터페이스의 필드별 JSDoc 이 Phase 이력까지 포함해 상세함
- **위치**: `assistant-finish-guard.service.ts` L481–514
- **상세**: 각 필드(`finishBlockCount`, `editsSinceLastFinishBlock`, `reviewCompleted`, `reviewRoundCount`, `verifyFiredOnce`)에 Phase 변경 이력(Phase 5, Phase 6)이 인라인으로 기재되어 있다. 역사적 맥락이 코드 옆에 위치해 추적이 쉽다.
- **제안**: 없음. 이력 문서화 수준 양호.

---

### **[INFO]** `FinishGuardError` union type 의 `WORKFLOW_VERIFY_REQUIRED` 브랜치에 Phase 넘버 주석 산재
- **위치**: `assistant-finish-guard.service.ts` L459–479
- **상세**: 인라인 주석에 "Phase 2:", "Phase 5:" 가 여러 곳 등장. 코드를 이해하는 데 도움이 되지만 Phase 번호가 외부 문서 어디를 가리키는지 명시되지 않아 신규 기여자가 혼동할 수 있다. spec `3-workflow-editor §10` 참조는 클래스 JSDoc 에만 있고 개별 필드 주석에는 링크가 없다.
- **제안**: `/** Phase 2: ... */` 형태의 주석에 "spec §10.2" 등 정확한 절 번호를 한 번이라도 명기하면 추적성이 높아진다. 필수는 아니나 INFO 수준 개선.

---

### **[INFO]** `collectPendingUserConfig` 공개 함수의 JSDoc 이 적절히 작성됨
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` L892–901
- **상세**: 함수 목적, sync 이유, type-only import 로 런타임 순환을 방지한다는 설계 결정이 명확히 기재됨.
- **제안**: 없음.

---

### **[INFO]** `isPlanPendingApproval` 함수 JSDoc 이 이전 위치(`workflow-assistant-stream.service.ts`)에서 새 위치(`active-plan-context.ts`)로 올바르게 이동됨
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/active-plan-context.ts` L64–72
- **상세**: 이동 전 서비스 파일의 JSDoc("서비스 내 3곳에서 재사용", `approvedAt` 의미 설명)이 그대로 새 위치에 옮겨져 문서가 누락 없이 전이됨. 커밋 메시지에도 "detached 였던 evaluateFinishGuard JSDoc 을 메서드와 재결합"이라고 명시.
- **제안**: 없음.

---

### **[INFO]** `evaluateReviewGuard` 메서드의 발동 조건 비활성 목록이 JSDoc 과 `shouldSkipReview` JSDoc 에 중복 기재됨
- **위치**: `assistant-finish-guard.service.ts` L571–585 (evaluateReviewGuard JSDoc), L703–725 (shouldSkipReview JSDoc)
- **상세**: 두 JSDoc 이 거의 동일한 skip 조건 목록을 각자 열거한다. 정보 이중화로 불일치 위험이 있으나, `shouldSkipReview` 가 `private` 이고 `evaluateReviewGuard` 가 public 진입점이므로 호출자 관점에서 발동 조건을 알아야 한다는 실용적 이유가 있다.
- **제안**: `evaluateReviewGuard` JSDoc 에 "발동 조건 상세는 `shouldSkipReview` 참조"로 단순화하거나, 현 수준을 유지하되 두 목록의 동기를 보장하는 내부 메모를 추가. 현재는 목록이 일치하므로 즉시 문제는 없음. INFO 등급.

---

### **[INFO]** 테스트 파일 상단 블록 주석이 커버리지 범위와 제외 이유를 명확히 설명함
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts` L126–131
- **상세**: blocking/verify 체크리스트 양성 경로를 통합 테스트에 위임한 이유, 이 파일에서 커버하는 두 가지 목표를 명시. 테스트 문서화 관점에서 모범적.
- **제안**: 없음.

---

### **[INFO]** `workflow-assistant.module.ts` 에 `AssistantFinishGuard` 추가 시 인라인 주석 없음
- **위치**: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.module.ts` L1676
- **상세**: `providers` 배열에 `AssistantFinishGuard` 가 추가됐으나 이유를 설명하는 주석이 없다. 다른 provider(예: `IntegrationsModule`, `ExecutionEngineModule`)는 한 줄 주석으로 이유를 기재한다.
- **제안**: `// M-3 2단계: finish/review 가드 — StreamService 에 생성자 주입` 형태의 한 줄 주석을 추가하면 다른 provider 패턴과 일관성이 생긴다. 필수는 아니나 INFO 수준.

---

### **[INFO]** `MAX_REVIEW_ROUNDS`, `MIN_NONTRIGGER_NODES_FOR_VERIFY` 상수의 JSDoc 이 변경 이력을 포함하나 새 위치에서 완결됨
- **위치**: `assistant-finish-guard.service.ts` L529–542
- **상세**: 두 상수 모두 Phase 별 변경 이력이 JSDoc 으로 기재되어 있다. 이전 위치(`workflow-assistant-stream.service.ts`)에서는 동일한 JSDoc 이 삭제됨. 히스토리가 새 파일에 온전히 보존됐다.
- **제안**: 없음.

---

### **[INFO]** README / CHANGELOG 업데이트 필요성 — 이 변경은 내부 리팩터링이므로 공개 API 변동 없음
- **위치**: 해당 없음 (외부 API 미변경)
- **상세**: `AssistantFinishGuard` 는 NestJS 모듈 내부 provider 이며, HTTP 컨트롤러·WebSocket 이벤트·공개 DTO 는 변경되지 않았다. 사용자 대면 설정 옵션 및 환경변수 추가도 없다. README / CHANGELOG 업데이트는 불필요하다.
- **제안**: 없음.

---

### **[INFO]** `evaluateFinishGuard` 의 `@param` 태그 중 `state` 파라미터 설명이 상세하나 `pendingUserRequest` 는 단순함
- **위치**: `assistant-finish-guard.service.ts` L763–769
- **상세**: `@param state` 는 세 필드를 괄호로 예시하나, `pendingUserRequest` 는 "사용자 메시지 원문 — active plan derivation 에 사용"으로 간단히 끝난다. 이 파라미터가 LLM prompt injection 표면임을 암시하는 보안 관련 메모가 없다. (해당 설명은 상수 주석 `REVIEW_ORIGINAL_REQUEST_MAX_LEN` 에 있지만, 메서드 시그니처 수준에서는 누락.)
- **제안**: 선택적. `@param pendingUserRequest` 에 "프롬프트 인젝션 표면 — 호출부에서 XML fence 처리 완료 전제" 한 줄 추가 시 가독성 향상.

---

## 요약

이번 리팩터링(M-3 2단계)은 `WorkflowAssistantStreamService` 에서 finish/review 가드 로직을 `AssistantFinishGuard` 로 분리하는 작업으로, 문서화 수준은 전반적으로 우수하다. 신규 파일(`assistant-finish-guard.service.ts`, `collect-pending-user-config.ts`)은 클래스·타입·함수·상수 전 계층에 JSDoc 이 충실히 작성되어 있으며, Phase 별 변경 이력이 인라인 주석으로 잘 보존됐다. 삭제된 코드의 JSDoc 역시 새 위치로 누락 없이 이동됐다. 공개 API·HTTP 엔드포인트 변경이 없으므로 README/CHANGELOG/API 문서 업데이트는 불필요하다. 발견된 이슈는 모두 INFO 등급으로, Phase 번호의 spec 절 링크 미비, 모듈 파일의 한 줄 주석 일관성, `shouldSkipReview`–`evaluateReviewGuard` 간 조건 목록 이중화 세 가지이며, CRITICAL·WARNING 은 0건이다.

## 위험도

NONE
