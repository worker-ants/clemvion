### 발견사항

- **[INFO]** `topK` validator 변경(`@IsNumber()` → `@IsInt()`)에 대한 DTO 단위 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts`
  - 상세: `@IsInt()` 로 교체 후 float 값(예: `topK: 2.5`)이 실제로 거부되는지 검증하는 테스트가 없다. DTO 디렉토리에 `.spec.ts` 파일 자체가 부재하고, 서비스 레이어 테스트(`rag-search.service.spec.ts`)는 `topK`를 정수로만 전달하므로 유효성 검증 경로를 우회한다. class-validator 파이프가 실제 입력을 처리하는 e2e/통합 테스트나 DTO 단위 테스트가 있어야 `@IsInt`가 실제로 차단하는지 증명할 수 있다.
  - 제안: `validate(plainToInstance(RagSearchDto, { query: 'q', knowledgeBaseIds: [...], topK: 2.5 }))` 형태의 DTO 단위 테스트 추가. float 거부, 정수 허용, 범위(0·51) 경계 케이스를 커버한다.

- **[INFO]** `startHeadlessChat` 시그니처 변경(`firstMessage` 제거, `profile?` 추가)에 대한 전용 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`
  - 상세: `examples/` 디렉토리에 테스트 파일이 없고, `src/*.spec.ts` 3개(index·bridge·loader)는 `startHeadlessChat`을 커버하지 않는다. 핵심 동작 변경 — `profile` 없을 때 `{}` 빈 객체 전달, `profile` 있을 때 `{ profile }` 래핑 — 이 테스트로 고정되지 않아 이후 리팩터에서 조용히 깨질 수 있다.
  - 제안: `examples/byo-ui-headless.spec.ts` 생성. `ClemvionClient`를 mock 후 (1) `profile` 미전달 시 `triggerWebhook(path, {})` 호출 확인, (2) `profile` 전달 시 `triggerWebhook(path, { profile })` 호출 확인, (3) 토큰 미발급 시 `throw` 확인 — 최소 3케이스.

- **[INFO]** DTO validator 테스트 커버리지 갭 — `create-knowledge-base.dto.ts` / `update-knowledge-base.dto.ts` 의 rerank 필드
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/`
  - 상세: `rerankMode`에 `@IsIn(['off', 'cross_encoder', 'cross_encoder_llm'])` 제약이 있고, `rerankScoreThreshold`에 `@IsNumber()`, `rerankLlmConfigId`에 `@IsUUID()` 제약이 있으나 이를 검증하는 DTO 레이어 테스트가 없다. 이번 변경에서 문자열이 갱신됐으나 해당 필드의 실제 유효성 검증 동작은 테스트로 고정되어 있지 않다.
  - 제안: 신규 `create-knowledge-base.dto.spec.ts` 생성은 본 PR 범위를 벗어나지만, 백로그로 등록 권장. 특히 `rerankMode`의 invalid value 거부와 `rerankLlmConfigId`의 uuid 형식 검증이 우선순위.

- **[INFO]** 기존 서비스 테스트는 변경의 유효성 검증 역할을 간접적으로 수행 — 회귀 위험 낮음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts`, `rerank.service.spec.ts`
  - 상세: 이번 변경은 doc-string/Swagger 메타데이터 및 validator 데코레이터 변경(`@IsNumber`→`@IsInt`)에 국한된다. 서비스 레이어 테스트에서 `topK` 는 이미 정수값으로만 사용되고 있어 기존 테스트가 새 validator와 충돌하지 않는다. 회귀 위험은 낮다.
  - 제안: 없음. 기존 테스트 유효성 유지 확인됨.

### 요약

이번 변경은 전적으로 doc-string 정정(Swagger description·JSDoc 갱신)과 예제 시그니처 리팩터에 국한되므로, 기존 서비스 레이어 테스트 회귀 위험은 낮다. 그러나 두 가지 검증 갭이 남는다: (1) `topK` 의 `@IsInt()` 교체는 DTO 단위 테스트가 없어 float 거부 동작이 증명되지 않은 상태이고, (2) `startHeadlessChat` 의 `profile` 분기 로직(`profile ? { profile } : {}`)은 전용 테스트 없이 examples 파일에 남아 있다. 두 케이스 모두 즉각 차단 수준은 아니나(예제는 published 표면 밖, DTO validator 는 기존에도 미테스트), 향후 리팩터 시 조용한 회귀 위험이 있어 백로그 등록을 권장한다. DTO 디렉토리 전반에 class-validator 기반 단위 테스트가 부재한 것은 본 PR 이전부터의 구조적 갭이다.

### 위험도

LOW

STATUS: SUCCESS
