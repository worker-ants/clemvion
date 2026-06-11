# Documentation Review

## 발견사항

### [INFO] create-knowledge-base.dto.ts — rerankMode ApiPropertyOptional 설명 개선 (V-16)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` line 211
- 상세: `cross_encoder_llm 은 추가 LLM grading(후속 구현)` 문구를 `cross-encoder 후 조건부(conditional escalate) listwise LLM grading` 으로 정확하게 갱신했다. stale 문구 제거로 Swagger UI 에 노출되는 API 문서가 현재 구현과 일치하게 됐다.
- 제안: 추가 조치 불필요. 변경이 의도에 부합한다.

### [INFO] create-knowledge-base.dto.ts — rerankLlmConfigId 독스트링 (V-16)
- 위치: 동 파일 line 253
- 상세: `/** cross_encoder_llm grading LLMConfig (후속) */` → `/** cross_encoder_llm grading LLMConfig */` 로 스텁 표시 제거. `ApiPropertyOptional.description` 도 `후속 구현` 괄호 삭제 및 `조건부 listwise` 표현 추가로 갱신됐다.
- 제안: 추가 조치 불필요.

### [INFO] update-knowledge-base.dto.ts — rerankLlmConfigId ApiPropertyOptional 설명 (V-16)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts` line 562
- 상세: `cross_encoder_llm grading LLMConfig (후속 구현)` → `cross_encoder_llm 모드의 조건부 listwise grading LLMConfig` 로 정정. create DTO 와 update DTO 가 이제 동일 표현으로 일관된다.
- 제안: 추가 조치 불필요.

### [INFO] rag-search.dto.ts — topK ApiPropertyOptional 설명 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` line 332
- 상세: `반환할 최대 유사 청크 개수` → `inject-cap 상한` 의미를 추가하고 `default: 5` 제거 후 `token-budget + inject-cap 동적 점수 컷(§3.4)` 참조를 명시했다. 동시에 `/** 반환할 최대 유사 청크 개수 (inject-cap 상한) */` 독스트링도 갱신되어 JSDoc 과 Swagger 설명이 일치한다.
- 제안: 추가 조치 불필요. `default: 5` 제거는 실제 동적 결정 동작을 올바르게 반영한다.

### [INFO] web-chat-sdk/README.md — BYO-UI 예제 코드 갱신 (V-17)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/packages/web-chat-sdk/README.md` line 670-686
- 상세: `triggerWebhook` 호출 예제에서 `firstMessage` 인자를 `profile` 로 교체하고, `firstMessage` 폐기 이유(multi_turn webhook 소비 불가, §R6)를 인라인 주석으로 설명했다. `submit_message` 사용 안내 주석도 추가됐다. 예제가 현행 API와 일치하게 됐다.
- 제안: 추가 조치 불필요.

### [INFO] byo-ui-headless.ts — startHeadlessChat 시그니처·JSDoc 갱신 (V-17)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` line 771-797
- 상세: `firstMessage: string` 파라미터를 제거하고 `profile?: Record<string, unknown>` 을 말미로 이동. JSDoc 에 첫 사용자 텍스트를 `send()` 로 보내야 함을 명시했다. 인라인 주석이 §R6 근거를 구체적으로 설명해 향후 유지보수자가 이유를 알 수 있다.
- 제안: 추가 조치 불필요.

### [WARNING] plan/in-progress/spec-code-cross-audit-2026-06-10.md — 브랜치 레퍼런스 "본 PR"
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/plan/in-progress/spec-code-cross-audit-2026-06-10.md` line 856
- 상세: `rag-webchat-doc-strings` 브랜치 항목에 `(본 PR)` 이라는 자기참조 표현이 사용됐다. PR 번호가 확정되면 `(PR #NNN)` 형태로 바꿔야 future reference 시 추적 가능성이 유지된다. `makeshop-catalog-labels` 항목은 이미 `(PR #530)` 으로 명시돼 있어 일관성 문제가 발생한다.
- 제안: PR 머지 후 해당 항목을 `(PR #NNN)` 으로 갱신 또는 머지 전에 번호를 미리 기재.

### [INFO] update-knowledge-base.dto.ts — rerankMode 필드에 독스트링(/** */) 없음
- 위치: 동 파일 line 526 (rerankMode 필드 상단)
- 상세: create-knowledge-base.dto.ts 는 `/** 리랭킹 모드 */` 독스트링이 있지만 update DTO 의 동일 필드는 JSDoc 독스트링 없이 `@ApiPropertyOptional` 만 존재한다. 현재 변경 범위 밖이지만 일관성 미흡이다.
- 제안: 이번 PR 범위 외이므로 차단 사항 아님. 추후 패치 권장.

## 요약

이번 변경은 DTO Swagger 문서 문자열의 stale `후속 구현` 표현(V-16)과 BYO-UI 예제의 폐기된 `firstMessage` API 패턴(V-17)을 정정하는 순수 문서화 수정이다. create/update DTO 간 표현 일치, README 예제와 실제 함수 시그니처 동기화, 인라인 주석을 통한 이유 설명이 모두 잘 수행됐다. 계획 파일(`spec-code-cross-audit-2026-06-10.md`)의 `(본 PR)` 자기참조는 PR 번호 확정 후 갱신이 필요하나 차단 사항은 아니다. 전반적으로 문서화 품질이 명확히 향상됐다.

## 위험도

LOW
