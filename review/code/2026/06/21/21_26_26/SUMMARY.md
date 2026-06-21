# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩토링으로 신규 기능 결함·보안 취약점은 없음. `AiMemoryManager` 전용 단위 테스트 부재와 인터페이스/DI 미적용이 주요 기술 부채.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 인터페이스 부재 — `AiMemoryManager` 를 구체 타입 직접 참조. `IAiMemoryManager` 인터페이스 없으면 테스트 mock 교체·OCP 확장이 불가. `AiConditionEvaluator` 에도 동일 문제이므로 두 번의 선례로 패턴이 굳어지는 중 | `ai-agent.handler.ts` 라인 139-143 (`private readonly memoryManager: AiMemoryManager`) | `IAiMemoryManager` 인터페이스 추출 후 핸들러 선언 타입을 인터페이스로 교체. M-1 완료 후 별도 후속 이슈로 분리 가능 |
| 2 | Architecture | 핸들러 생성자에서 `new AiMemoryManager(...)` 직접 생성 — NestJS DI 컨테이너 외부, AoP 적용 불가, 테스트 격리 어려움 | `ai-agent.handler.ts` 생성자 (`this.memoryManager = new AiMemoryManager(...)`) | collaborator 를 NestJS provider 로 등록하거나 최소한 선택적 파라미터로 외부 주입 경로를 열어 테스트 격리 가능하게 함 |
| 3 | Testing | `AiMemoryManager` 전용 단위 테스트 파일(`ai-memory-manager.spec.ts`) 없음 — M-1 1단계 `AiConditionEvaluator` 에는 `ai-condition-evaluator.spec.ts` 가 신설됐으나 동형 패턴에서 선례 불일치 | `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` | `ai-memory-manager.spec.ts` 신설. `resolveMemoryStrategy`·`injectMemoryContext`·`scheduleMemoryExtraction` 을 인스턴스 직접 호출로 테스트. `AiConditionEvaluator` 선례 구조 사용 |
| 4 | Maintainability | `injectMemoryContext` 함수가 약 205줄에 달하며 5단계(recall → 요약 → stable prefix → volatile tail → messages 조립) 파이프라인을 단일 함수에서 처리. 공유 변수가 많아 단독 추출이 어려운 구조 | `ai-memory-manager.ts:99-350` | 후속 리팩토링에서 `#recallPersistentMemory`, `#updateSummaryBuffer`, `#assemblePrefixAndTail` 등 private 헬퍼로 단계별 분리 고려. 현 섹션 주석이 최소 안전선 역할 |
| 5 | Maintainability | `injectMemoryContext` 내 `conversationThreadService.getThreadExcludingNode`(요약용) + `getThread`(물리 압축 경계)를 두 번 호출 — 서비스 호출이 중복처럼 보여 유지보수 시 혼동 여지 | `ai-memory-manager.ts:150-156`, `271-277` | `fullTurns` 도출 섹션 앞에 `// ── [keepUserExchanges 도출] ──` 형태의 섹션 구분 주석 추가로 스캔성 향상 |
| 6 | Documentation | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 미등재. `ai-condition-evaluator.ts` (M-1 1단계)도 동일하게 미등재 — spec-coverage audit 갭 검출 예상 | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | M-1 전체 완료 후 planner 가 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 일괄 등재 (spec 쓰기 권한 제약) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `config: Record<string, unknown>` 에서 `as number`/`as string` 강제 캐스팅 — 런타임 검증 부재. 기존 핸들러에서 이동된 코드로 신규 취약점은 아니나, 추출 기회에 입력 검증 레이어 보강 가능 | `ai-memory-manager.ts` `injectMemoryContext` 내 다수 `as` 캐스팅 | `typeof`/`Number.isFinite()` 또는 Zod로 각 필드 런타임 검증 후 기본값 폴백하는 헬퍼 추가 |
| 2 | Security | 에러 로그에 `scopeKey`/`queryText` 미포함 — 민감 정보 미노출 방향으로 올바름. 단, 운영 장애 추적을 위해 `workspaceId` 는 구조화 로그 별도 필드로 포함 권고 | `ai-memory-manager.ts` `injectMemoryContext` catch 블록 | `workspaceId` 를 별도 컨텍스트 필드로 로깅 (queryText·메모리 fact 는 계속 제외) |
| 3 | Security | in-memory thread 직접 mutate (`as { runningSummary?:... }` 강제 캐스팅) — 동시 요청 TOCTOU 잠재 위험. 기존 패턴 이동이므로 신규 위험은 아님 | `ai-memory-manager.ts` `injectMemoryContext` 라인 240-247 | 상위 레이어(Redis 직렬화·NestJS 이벤트 루프 단일성)에서 원자성 보장 근거를 주석으로 명시 |
| 4 | Security | `_retry_state.json` 에 로컬 절대 경로 포함 — 저장소 이력에 개발 환경 파일 시스템 구조 노출 | `review/consistency/2026/06/21/21_00_17/_retry_state.json` | `_retry_state.json` 을 `.gitignore` 에 추가하거나 커밋 전 절대 경로를 상대 경로로 변환 |
| 5 | Architecture | `injectMemoryContext` 내 thread 직접 mutation 패턴 — "무상태 collaborator" 선언과 부분 상충. multi-turn 상태 관리 복잡도 증가 시 버그 표면 가능성 | `ai-memory-manager.ts` 라인 240-247 | 반환값에 `updatedSummaryState?` 를 포함시켜 실제 mutation 을 핸들러에서 수행하도록 위임 분리. 중장기 개선 |
| 6 | Architecture | `scheduleMemoryExtraction` 가 `sharedScheduleMemoryExtraction` 공유 헬퍼로 단순 위임(pass-through). `selfNodeId` 파라미터를 받으나 실제 미사용 | `ai-memory-manager.ts` 라인 380-382 | `selfNodeId` 파라미터 제거 또는 deprecation 주석 정리. 중기적으로 공유 헬퍼를 내부로 흡수하여 위임 계층 제거 고려 |
| 7 | Requirement | `resolveMemoryStrategy` 가 `private` → 암묵적 `public` 으로 가시성 변경. spec 침묵 영역. 동작 무영향 | `ai-memory-manager.ts` line 75 | 외부 노출 불필요하면 `private` 명시. spec 변경 불필요 |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] 신규 파일 `ai-memory-manager.ts` 가 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 미등재. 코드 버그 아닌 spec 갱신 누락 | `spec/4-nodes/3-ai/1-ai-agent.md` | [SPEC-DRIFT] 코드 유지 + spec 갱신. planner 위임하여 frontmatter `code:` 에 `ai-memory-manager.ts` 추가 |
| 9 | Requirement | §6.1 step 1.3/1.5/2.7 구현 참조가 `ai-agent.handler.ts` 를 가리키는 stale 상태. 2단계 완료로 `AiMemoryManager` 로 이동됨 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 | planner 가 M-1 전체 완료 후 §6.1 구현 참조를 `AiMemoryManager` 메서드로 갱신 |
| 10 | Scope | `review/` 산출물 파일 3개(SUMMARY.md, _retry_state.json, convention_compliance.md)가 코드 커밋과 동일 커밋에 포함 | `review/consistency/2026/06/21/21_00_17/` | 향후 review 커밋과 코드 커밋 분리 검토 가능. 현재는 규약상 허용 범위 |
| 11 | Testing | `resolveMemoryStrategy` 미지 문자열 → `manual` 폴백 경로 미테스트 | `ai-memory-manager.ts` `resolveMemoryStrategy` | 신설 `ai-memory-manager.spec.ts` 에 `resolveMemoryStrategy('unknown_value')` → `'manual'` 케이스 추가 |
| 12 | Testing | `injectMemoryContext` system 메시지 없는 messages 배열 경로 미검증 (`systemIdx = -1` → `insertAt = 0`) | `ai-memory-manager.ts` `injectMemoryContext` (messages 모드 분기) | 신설 단위 테스트에서 `messages: []` 또는 system role 없는 messages 케이스 추가 |
| 13 | Documentation | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 구현 참조 stale — spec 쓰기 권한 제약으로 planner 후속 처리 필요 | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 | planner 위임 (INFO #9 와 동일) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `config` 강제 캐스팅 런타임 검증 부재(이동된 패턴), `_retry_state.json` 절대 경로 커밋, thread mutate TOCTOU 잠재 위험 |
| architecture | LOW | `IAiMemoryManager` 인터페이스 부재(WARNING), 핸들러 생성자 직접 `new`(WARNING), thread 직접 mutation 중장기 부채 |
| requirement | NONE | spec fidelity 완전 일치. SPEC-DRIFT: `ai-memory-manager.ts` frontmatter `code:` 미등재 (planner 처리) |
| scope | NONE | 변경 범위 적절. review/ 산출물 동일 커밋 포함은 규약상 허용 |
| side_effect | NONE | 신규 부작용 없음. conversationThread mutate·외부 서비스 호출은 기존 의도된 부작용 verbatim 이동 |
| maintainability | LOW | `injectMemoryContext` 205줄 단일 함수(WARNING), 이중 서비스 호출 혼동 여지(WARNING). 문서화 품질은 전반 우수 |
| testing | LOW | `ai-memory-manager.spec.ts` 전용 단위 테스트 없음(WARNING). 간접 커버리지(ai-agent.memory.spec.ts 1628줄)는 충분 |
| documentation | LOW | 코드 내 JSDoc 품질 우수. spec frontmatter `code:` 미등재·§6.1 구현 참조 stale 은 planner 처리 사항 |

## 발견 없는 에이전트

없음 (모든 에이전트가 발견사항을 기록했으나 Critical 은 없음)

## 권장 조치사항

1. **[즉시 권장] `ai-memory-manager.spec.ts` 신설** (WARNING #3): `AiConditionEvaluator` 선례와 동형 구조로 `resolveMemoryStrategy`·`injectMemoryContext`·`scheduleMemoryExtraction` 직접 단위 테스트 작성. 미지 문자열 폴백·system 메시지 없는 messages 배열 경로 포함.
2. **[M-1 완료 후 후속] `IAiMemoryManager` 인터페이스 추출** (WARNING #1): 핸들러 선언을 인터페이스 타입으로 교체. `IAiConditionEvaluator` 도 동시 추출하여 패턴 통일.
3. **[M-1 완료 후 후속] NestJS DI 주입 전환** (WARNING #2): `AiMemoryManager`·`AiConditionEvaluator` 를 NestJS provider 로 등록하거나 최소한 선택적 파라미터 주입 경로 개방.
4. **[후속] `injectMemoryContext` 단계별 private 헬퍼 분리** (WARNING #4): `#recallPersistentMemory`·`#updateSummaryBuffer`·`#assemblePrefixAndTail` 등으로 분리. 현재 섹션 주석이 최소 안전선.
5. **[planner 위임] spec frontmatter `code:` 갱신** (WARNING #6, INFO #8·#9): M-1 전체 완료 후 `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 일괄 등재 + §6.1 구현 참조를 `AiMemoryManager` 메서드로 갱신.
6. **[경미] `_retry_state.json` gitignore 처리** (INFO #4): `review/` 하위 상태 파일에 로컬 절대 경로 노출 방지.
7. **[경미] `workspaceId` 구조화 로그 추가** (INFO #2): `injectMemoryContext` catch 블록에 `workspaceId` 를 별도 필드로 로깅 (queryText·메모리 내용 제외 유지).

## 라우터 결정

라우터가 선별 실행:
- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 router_safety 강제 포함)
- **제외**: 6명 (아래 표)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |