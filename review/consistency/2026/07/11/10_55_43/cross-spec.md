# Cross-Spec 일관성 검토 — resume-identification-field hydration helper 기각 기록 (task_6da430a3)

- MODE: `--spec`
- base: `origin/main` (`bfa558f59`)
- target: `spec/5-system/4-execution-engine.md` §Rationale 신규 단락 (line 1386, "기각된 대안 — 재개 식별 필드 hydration 전용 헬퍼")
- diff: `git diff origin/main -- spec/5-system/4-execution-engine.md` (단일 단락 추가, 그 외 변경 없음)

## 발견사항

0건. CRITICAL/WARNING/INFO 없음.

검증 근거는 아래와 같다.

### 1. 코드 심볼 실재성 및 서술 정확성

모두 실재하며 target 서술과 일치한다.

- `resumeStateSchema` / `ResumeState` / `CREDENTIAL_CONTEXT_FIELDS` — `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:110,142,150-163`. JSDoc(`:6-30`)이 "credential/context-binding 필드의 단일 SoT"라는 target 의 주장과 동일한 취지로 스스로를 문서화하고 있다.
- `narrowResumeState()` — `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:619-621`, 호출부 5곳(`:2156,2279,2509,2566,3012` 등). "raw cast 를 `ResumeState` 타입 접근으로 좁힌다"는 target 서술과 일치.
- `ai-turn-executor` 메인 chat llmContext — `:2618-2622` (`workflowId`/`executionId`/`nodeExecutionId` 3필드, `LlmCallContext` 명시 타입). target 의 "3필드" 서술과 일치.
- `ai-turn-executor` provider-tool 배치 llmContext 등가 필드 — `executeProviderToolBatch` 호출부 `:2709-2721`(`executionId`/`nodeId`/`nodeExecutionId`/`workflowId`/`workspaceId` = 5필드, `executionId ?? ''`·`nodeId ?? ''` fallback). target 의 "5필드 + `?? ''` fallback + workspaceId" 서술과 일치.
- `information-extractor.handler.ts` resume 경로 llmContext — `:891-896` (`state.executionId ? {executionId, workflowId, nodeExecutionId} : undefined`, 조건부 3필드). target 의 "IE(3필드, 조건부 undefined)" 서술과 일치.
- PR 참조 — `git log` 상 `#877`=`d6ae32da3`, `#879`=`79669505c`(+ follow-up `0c6e53b81`), `#907`=`bfa558f59`(현재 HEAD, "B-track... 필드 타이핑"). target 의 PR 매핑과 일치.
- `pickResumeIdentificationFields()` / `ResumeIdentificationFields` — 코드베이스에 **존재하지 않음**(grep 0건). target 자신이 "채택하지 않은 대안"이라고 명시하므로 이는 기대된 결과다(가상의 이름을 실재 심볼처럼 서술한 것이 아님).

### 2. `spec/data-flow/7-llm-usage.md §1.3` 및 execution-engine 자체 §1.3 과의 정합성

target 단락이 참조하는 "§1.3"은 문맥상 **execution-engine.md 자신의 §1.3**("블로킹/재개 컨트랙트", `4-execution-engine.md:119` 이하의 "불변식 (usage-log attribution)" 블록, `:139`)이며, 이는 이미 동일 PR 계열(#877/#879)로 기술된 재유도 채널·attribution 게이트 서술과 완전히 정합한다. `spec/data-flow/7-llm-usage.md §1.3 Caller 카탈로그`(`7-llm-usage.md:99-121`)의 "resume 턴은 재구성 `state.*`" 서술과도 모순 없이 부합 — target 단락은 새 사실을 주장하지 않고 기존 두 spec 서술("재구성 계층 vs 소비 계층", "ai_agent/IE 필드 shape 차이")을 근거로 대안을 기각하는 순수 rationale 이다.
`resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`/`narrowResumeState` 를 언급하는 spec 파일은 `4-execution-engine.md` 뿐이며(grep), 다른 spec 영역에 상충하는 서술이 없다.

### 3. 신규 요구사항 ID·엔티티·API 도입 여부

없음. 단락은 (a) 기각된 설계(`ResumeIdentificationFields`/`pickResumeIdentificationFields`, 코드에 없는 가상 명칭)를 언급하지만 "채택하지 않는다"로 명시해 신규 계약으로 등재하지 않으며, (b) 언급하는 실재 심볼(`resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`/`narrowResumeState`)은 모두 이미 §1.3·§Rationale 다른 곳에서 다뤄진 기존 개념의 재인용이다. 새 요구사항 ID·엔티티·엔드포인트 없음.

### 4. "필드 목록의 단일 진실은 이미 `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS` 가 보유" 주장의 정확성

정확하다. `resume-state.schema.ts:32-42`("credential-strip 부분집합... spec §1.3 합집합")와 `:144-149`("credential / context-binding 필드 목록... `CREDENTIAL_CONTEXT_FIELDS`")가 스스로 이 두 심볼을 필드 allow-list 의 SoT 로 문서화하고 있고, 코드 내 다른 어떤 위치에도 별도의 병행 필드 목록이 존재하지 않는다(`ResumeIdentificationFields` 부재로 대안 후보조차 없음). target 의 주장과 코드 현실이 일치한다.

## 요약

target 단락은 이미 spec 에 정착된 #877/#879/#907 attribution 불변식·재유도 채널 서술을 근거로 특정 리팩터(공용 hydration 헬퍼)를 기각하는 순수 Rationale 기록이며, 언급하는 모든 코드 심볼(`resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`/`narrowResumeState`)과 필드 개수·shape 서술이 현재 코드베이스와 정확히 일치한다. `spec/data-flow/7-llm-usage.md §1.3`(attribution SoT)이나 execution-engine 자신의 §1.3 불변식과 상충하는 내용이 없고, 신규 요구사항 ID·엔티티·API 도입도 없다. Cross-spec 관점에서 완전히 additive/consistent 하다.

## 위험도

NONE

STATUS: DONE
