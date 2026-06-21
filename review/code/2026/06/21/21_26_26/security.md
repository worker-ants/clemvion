# 보안(Security) 리뷰 결과

**리뷰 대상**: `ai-agent.handler.ts` (리팩토링), `ai-memory-manager.ts` (신설), 관련 일관성 검토 문서
**변경 성격**: god-handler 분할 — `AiMemoryManager` 무상태 collaborator 추출 (behavior-preserving refactor)

---

## 발견사항

### [INFO] `config: Record<string, unknown>` 타입 캐스팅 — 런타임 검증 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` — `injectMemoryContext` 내 `args.config.memoryTokenBudget as number`, `args.config.memoryTopK as number`, `args.config.memoryThreshold as number`, `args.config.contextInjectionMode as 'messages' | 'system_text'`, `args.config.embeddingModelConfigId as string | undefined`
- 상세: `config: Record<string, unknown>` 에서 `as number` / `as string` 강제 캐스팅이 반복된다. TypeScript 타입 단언은 런타임 검증이 아니므로, 공격자 또는 잘못된 워크플로 정의가 `memoryTokenBudget: "malicious_string"` 이나 `memoryTopK: null` 을 주입하면 하위 헬퍼(`buildSummaryBufferUpdate`, `agentMemoryService.recall`)에 예상치 못한 타입 값이 전달된다. 현재 코드에서 `(args.config.memoryTokenBudget as number) || DEFAULT_MEMORY_TOKEN_BUDGET` 패턴은 falsy 값에 대한 폴백을 제공하므로 일부 케이스는 방어되지만, `as` 만 사용하는 `embeddingModelConfigId`, `contextInjectionMode`, `memoryKey` 등은 무방비다. 이는 기존 핸들러에서 이동된 코드이므로 신규 도입 취약점은 아니지만, 추출을 기회로 입력 검증 레이어를 보강할 여지가 있다.
- 제안: `config` 파싱 시 `typeof` 또는 Zod/class-validator 등으로 각 필드의 타입을 런타임 검증하고 기본값으로 폴백하는 헬퍼 함수를 추가한다. 특히 숫자 파라미터는 `Number.isFinite()` 확인 후 사용을 권장한다.

### [INFO] 에러 로그에 `scopeKey` / `queryText` 미포함 — 민감 정보 노출 방향 반대
- 위치: `ai-memory-manager.ts` `injectMemoryContext` — `catch` 블록 (`AiMemoryManager.logger.warn(\`Agent memory recall failed (graceful): ${message}\`)`)
- 상세: 에러 메시지만 로깅하며 `scopeKey`, `workspaceId`, `queryText` 등 식별 정보는 포함하지 않는다. 이는 기존 핸들러 코드의 동일 패턴을 그대로 유지한 것으로, **민감 정보 미노출** 관점에서 올바른 방향이다. 단, 운영 환경에서 장애를 추적하기 위해 `workspaceId` 정도는 구조화 로그(structured logging)로 별도 필드에 포함하는 것이 권고된다 — 이 경우에도 쿼리 내용(`queryText`)이나 추출된 메모리 내용은 포함하지 않아야 한다.
- 제안: 장애 추적용으로 `workspaceId` 를 별도 컨텍스트 필드로 로깅하되, `queryText` · 메모리 fact 내용은 로그에서 계속 제외한다.

### [INFO] in-memory thread 직접 mutate — 동시성 환경 잠재 위험
- 위치: `ai-memory-manager.ts` `injectMemoryContext` — `mutable.runningSummary = update.runningSummary; mutable.summarizedUpToSeq = update.summarizedUpToSeq;`
- 상세: TypeScript `as { runningSummary?: string; summarizedUpToSeq?: number }` 캐스팅으로 읽기전용 객체를 강제 mutate 한다. 이 패턴은 기존 핸들러에서도 동일하게 사용되던 것으로 동작 보존 리팩토링이며, Redis 직렬화로 영속화된다는 설계 문서가 있다. 그러나 동일 thread 에 대해 동시 요청이 발생하는 경우(멀티턴 재개 + 신규 진입 경쟁 등) TOCTOU 상태 오염 가능성이 있다. 현재 리팩토링 범위 내 신규 문제는 아니지만 보안 관점 리스크로 기록한다.
- 제안: thread mutation 의 원자성이 상위 레이어(Redis 직렬화 타이밍, NestJS 이벤트 루프 단일성 보장 등)에서 이미 보장되는지 확인하고, 보장 근거를 주석으로 명시한다.

### [INFO] `_retry_state.json` 에 절대 경로 포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/review/consistency/2026/06/21/21_00_17/_retry_state.json`
- 상세: 파일 내에 `/Volumes/project/private/clemvion/.claude/worktrees/...` 형태의 로컬 절대 경로가 포함되어 있다. 이 파일은 `review/` 경로에 커밋되므로 저장소 이력에 개발 환경의 로컬 파일 시스템 구조가 노출된다. 공격 표면으로 직결되지는 않지만, 향후 공격자가 저장소 이력을 통해 내부 디렉토리 구조·사용자명 등을 파악할 수 있다.
- 제안: `_retry_state.json` 을 `.gitignore` 에 추가하거나 커밋 전 절대 경로를 상대 경로로 변환한다. 또는 이 상태 파일을 `review/` 커밋 대상에서 제외하는 정책을 수립한다.

---

## 요약

이번 변경은 `AiMemoryManager` 무상태 collaborator 추출이라는 순수 구조 리팩토링으로, 신규 외부 입력 경로·인증 경계·암호화 계층·하드코딩 시크릿이 추가되지 않는다. 기존 핸들러에 존재하던 `config: Record<string, unknown>` 타입 캐스팅 패턴이 새 클래스로 이동하며 보안 표면이 유지되나, 추출 기회를 활용해 입력 검증 레이어를 보강하는 것이 권장된다. 에러 처리는 민감 정보 미포함 방향으로 적절하다. `_retry_state.json` 의 로컬 절대 경로 커밋은 경미한 정보 노출이며, gitignore 처리를 권고한다. OWASP Top 10 관점에서 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화 등의 취약점은 발견되지 않는다.

---

## 위험도

LOW
