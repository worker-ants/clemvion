# Testing Review — spec-inprogress-groom

## 발견사항

### **[WARNING]** `$thread` ROOT_VARIABLES 추가에 대한 프론트엔드 단위 테스트 부재
- 위치: `codebase/frontend/src/components/editor/expression/expression-constants.ts`
- 상세: `$thread` 항목이 `ROOT_VARIABLES`에 추가됐고 `BUILT_IN_PICKER_VARIABLES` 파생 배열에도 자동 포함된다. 그러나 expression 관련 기존 테스트 파일들(`expression-autocomplete.test.tsx`, `use-expression-suggestions.test.ts`, `variable-picker.test.tsx`)을 전수 확인한 결과, `$thread`를 직접 참조하거나 `ROOT_VARIABLES`의 내용 변화를 단언하는 케이스가 없다. `BUILT_IN_PICKER_VARIABLES`가 `$thread`를 포함하는지(filter 조건 `!["$input","$node","$var"].includes(v.label)` 통과 여부), `filterRootVariablesByScope`와의 상호작용 역시 무테스트 상태다.
- 제안: `expression-constants.ts`에 대한 전용 단위 테스트 파일 또는 `use-expression-suggestions.test.ts`에 `$thread`가 루트 변수 목록에 등장하는지 확인하는 테스트 케이스 추가. 예: `ROOT_VARIABLES.find(v => v.label === '$thread')` 단언 + `BUILT_IN_PICKER_VARIABLES`에서 `$thread`가 존재하는지 확인.

### **[WARNING]** `EmbedOriginsCard`/`EmbedOriginsEditor` UI 컴포넌트 테스트 부재
- 위치: `plan/complete/spec-draft-workspace-settings-api.md` 구현 항목(frontend UI)
- 상세: plan 문서에 `EmbedOriginsCard`, `EmbedOriginsEditor` 컴포넌트가 구현됐음을 명시하고 있으나, 프론트엔드 전체 소스에서 해당 컴포넌트를 참조하는 테스트 파일이 존재하지 않는다. `updateSettings`/`getSettings` API 클라이언트, `useHasRole("admin")` 게이트, 클라이언트 측 origin 형식 검증·중복 제거·저장 실패 toast 등 주요 상호작용 경로가 테스트되지 않는다.
- 제안: 최소한 (1) owner/admin이 origin을 추가·삭제·저장하는 성공 경로, (2) viewer가 편집 불가(read-only), (3) 잘못된 형식 입력 시 클라이언트 검증 오류 표시 케이스에 대한 단위/컴포넌트 테스트 추가.

### **[WARNING]** Triggers/Schedules 빈 상태 CTA 테스트 부재
- 위치: `spec/2-navigation/11-error-empty-states.md`, `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`, `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`
- 상세: spec 변경으로 Triggers·Schedule 목록의 "트리거 추가"/"스케줄 추가" CTA가 구현 완료 처리됐으나, `triggers-page.test.tsx`에는 빈 상태 EmptyState 컴포넌트 렌더 및 CTA 버튼 존재에 대한 테스트 케이스가 없다. `schedules-page.test.tsx`에는 "add schedule" 버튼 테스트가 존재하나 빈 상태 진입 시 `EmptyState` 컴포넌트가 CTA를 포함해 올바르게 렌더되는지 검증하는 케이스가 없다. 또한 검색/필터 결과 없음 상태(§2.3)에서 "필터 초기화" CTA 동작을 검증하는 테스트도 없다.
- 제안: Triggers/Schedules 목록 빈 상태 시나리오(데이터 없음)에서 `EmptyState`와 CTA 버튼이 렌더되는지 단언하는 테스트 추가. Workflows 필터 reset 케이스도 마찬가지.

### **[INFO]** `llmCalls` strip — notification webhook processor 테스트 부재
- 위치: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.spec.ts`
- 상세: `spec-draft-eia-strip-llmcalls.md` 결정에 따라 llmCalls는 외부 수신자 fanout 경로 전체에서 strip된다. `websocket.service.spec.ts`가 fanout seam의 strip을 명확히 커버하고, `sse-adapter.service.spec.ts`는 upstream seam 의존을 주석으로 명시했다. 그러나 `notification-webhook.processor.spec.ts`에는 llmCalls strip에 대한 단언이 없다. notification webhook processor가 받는 ai_message 이벤트에 llmCalls가 포함되더라도 webhook payload에 포함되지 않는다는 회귀 보호 테스트가 없다.
- 제안: `notification-webhook.processor.spec.ts`에 llmCalls를 포함한 ai_message 이벤트 처리 시 webhook payload에 llmCalls가 누락된다는 단언 추가. (단, 현재 fanout seam이 upstream에서 이미 strip하므로 이중 방어 성격이지만 `chat-channel.dispatcher.spec.ts`의 "이중 방어" 패턴과 일치하는 것이 바람직.)

### **[INFO]** `impl-anchor-existence.test.ts` — api-endpoint 가드의 실제 MDX 앵커 부재 언급
- 위치: `codebase/frontend/src/lib/docs/__tests__/impl-anchor-existence.test.ts`
- 상세: 파일 내 주석에 "현재 유저 가이드에 `kind="api-endpoint"` 앵커가 없어서 in-loop 단언이 실행되지 않는다"고 명시돼 있다. spec 갱신(user-guide-evidence `implemented` 마킹)과 달리 이 가드는 사실상 dead-letter 상태. api-endpoint 앵커가 처음 추가될 때 비로소 검증이 활성화된다.
- 제안: 의도적 미작동임을 확인했다면 현재 상태는 INFO 수준. 향후 api-endpoint 앵커 MDX 추가 시 해당 가드가 실제로 실행·통과되는지 반드시 검증할 것.

### **[INFO]** `spec-draft-node-execution-cancelled.md` 언급 통합 테스트 존재 여부 미확인
- 위치: `plan/complete/spec-draft-node-execution-cancelled.md` "구현 영향" 항목
- 상세: plan에 "통합 테스트 (cancel-others-on-fail → cancelled status)"가 명시됐으나, 본 변경 세트는 spec/plan 문서만 포함하고 있어 해당 통합 테스트의 실제 구현 여부를 이 PR에서 직접 확인할 수 없다. 이 plan은 구현이 별도 브랜치/커밋에서 이뤄진다고 명시했으므로 현재 리뷰 범위는 spec 문서.
- 제안: 해당 구현 PR에서 통합 테스트가 실제 존재하는지 확인 필요.

## 요약

이번 변경의 핵심 코드 변경은 `expression-constants.ts`의 `$thread` 추가 한 건이고, 나머지는 spec/plan 문서 정비다. `$thread` 추가 자체는 단순한 배열 항목 추가이나 `BUILT_IN_PICKER_VARIABLES` 파생 배열에 자동 반영되는 구조라 UI 영향이 있음에도 전용 단위 테스트가 없다. 워크스페이스 settings UI(`EmbedOriginsCard`/`EmbedOriginsEditor`)는 plan에서 구현 완료로 명시됐으나 프론트엔드 컴포넌트 테스트가 전무하다. llmCalls strip은 `websocket.service.spec.ts`의 fanout seam 테스트가 주된 보호막 역할을 잘 하고 있으며, 인증(resend-verification, SHA-256 토큰, checkEmail onBlur) 관련 구현들은 service/controller/frontend 테스트가 모두 갖춰져 있다. text-classifier·information-extractor의 `retryable`/`retryAfterSec` 테스트도 충분히 커버된다. 전체적으로 복잡도가 높은 백엔드 변경들은 잘 테스트됐으나, 프론트엔드 UI 신규 컴포넌트 영역(EmbedOrigins, EmptyState CTA)에 테스트 갭이 존재한다.

## 위험도

MEDIUM
