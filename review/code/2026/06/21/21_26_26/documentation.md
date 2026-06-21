# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: M-1 2단계 — AiMemoryManager 추출 (god-handler 분할)
**리뷰 일시**: 2026-06-21

---

## 발견사항

### [INFO] ai-memory-manager.ts — 클래스 레벨 JSDoc 품질 우수, 추가 개선 불필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m1-memory-manager/codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` lines 659–681 (클래스 doc-comment)
- 상세: `AiMemoryManager` 클래스 JSDoc 은 ⓐ 책임 범위 (resolveMemoryStrategy / injectMemoryContext / scheduleMemoryExtraction), ⓑ 레이어 구분 ("node 레이어 전용 오케스트레이터" vs `AgentMemoryService`), ⓒ 무상태 설계 근거, ⓓ `manual` 전략 미경유 불변식, ⓔ spec 참조(§12.9~12.14)를 모두 포함한다. Consistency Check INFO #8 에서 요구한 "node-layer 전용, persistent I/O 는 `AgentMemoryService`" 구분도 **즉시 반영됨**으로 확인된다.
- 제안: 없음.

### [INFO] injectMemoryContext — 메서드 시그니처 인라인 파라미터 JSDoc 충실
- 위치: `ai-memory-manager.ts` lines 715–776 (injectMemoryContext 파라미터 블록)
- 상세: `summaryModelConfigId`, `tailMode`, `keepUserExchanges` 반환 필드 등 비자명 파라미터·반환값에 대한 인라인 JSDoc 이 핸들러 원본과 동일하게 이관됐다. `tailMode: 'prepend' | 'system-only'` 구분의 의미(single-turn vs multi-turn 누적 경로)가 명확히 설명되어 있다.
- 제안: 없음.

### [INFO] scheduleMemoryExtraction — lastExtractionTurnSeq JSDoc 보존 확인
- 위치: `ai-memory-manager.ts` lines 984–1011 (scheduleMemoryExtraction 파라미터)
- 상세: `lastExtractionTurnSeq` 의 증분 추출 watermark 동작(AGM-08 seq 초과 turn 만 snapshot) 설명이 원본에서 그대로 이관됐다. selfNodeId 가 본 경로에서 실제로는 읽히지 않는다는 내부 주석도 유지된다.
- 제안: 없음.

### [INFO] ai-agent.handler.ts — memoryManager 필드 JSDoc 충분
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` lines 121–127 (private readonly memoryManager 선언)
- 상세: `memoryManager` 필드 doc-comment 가 전략 해석·동기 주입·비동기 enqueue 의 세 책임과 "무상태 collaborator (refactor §M-1 2단계)" 배경을 간결하게 담고 있다. `manual` 전략은 본 매니저를 거치지 않는다는 호출 경계도 명시됐다.
- 제안: 없음.

### [INFO] 생성자 파라미터 JSDoc — conversationThreadService / agentMemoryService Optional 의미 기술
- 위치: `ai-memory-manager.ts` lines 686–701 (constructor 파라미터 doc-comment)
- 상세: 두 Optional 파라미터의 graceful degrade 동작(미주입 시 빈 결과·no-op)이 개별 doc-comment 로 설명된다. 인라인 `import()` 타입 패턴의 레이어 격리 목적도 설명되어 있어 후속 개발자가 맥락을 파악할 수 있다.
- 제안: 없음.

### [INFO] 복잡한 keepUserExchanges 도출 로직 — 인라인 주석 적절
- 위치: `ai-memory-manager.ts` lines 894–915 (keepUserExchanges 계산 블록)
- 상세: self 노드 제외 turns 를 사용하는 summarization 경로와 전체 thread 를 사용하는 물리 압축 경계 도출 간의 비대칭을 상세한 블록 주석으로 설명한다. 이 로직은 spec §12.14 불변식과 직결되므로 주석의 존재가 중요하다. 주석 내용이 코드와 일치한다.
- 제안: 없음.

### [WARNING] spec frontmatter code: 에 ai-memory-manager.ts 미등재 — planner 후속 필요
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` (신설 파일 미반영)
- 상세: Consistency Check SUMMARY INFO #3 에 이미 포착된 사항으로, M-1 2단계 완료 후 `1-ai-agent.md` frontmatter `code:` 에 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 가 등재되지 않은 상태다. `ai-condition-evaluator.ts` (M-1 1단계, INFO #1) 도 동일하게 미등재다. spec-impl 연결 문서화가 불완전한 상태이며, 이후 spec-coverage audit 에서 갭으로 검출될 수 있다.
- 제안: M-1 전체 완료 후 planner 가 `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 를 일괄 등재한다(SUMMARY 권장 조치사항 #5 연동). 본 PR 범위에서 developer 가 단독 처리 불가(spec 쓰기 권한).

### [INFO] §6.1 구현 참조 갱신 미완 — planner 후속
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 1.3/1.5/2.7 구현 참조
- 상세: Consistency Check INFO #2 에서 `§6.1 step 3a` 구현 참조가 여전히 `ai-agent.handler.ts classifyToolCalls` 를 가리킨다고 지적됐다. 본 2단계 완료로 §6.1 1.3/1.5/2.7 의 구현 위치도 `ai-agent.handler.ts` 에서 `ai-memory-manager.ts AiMemoryManager.injectMemoryContext` / `scheduleMemoryExtraction` 으로 이동했다. spec 구현 참조가 stale 상태다.
- 제안: planner 가 M-1 전체 완료 후 §6.1 step 1.3/1.5/2.7 구현 참조를 `AiMemoryManager` 메서드로 갱신한다.

### [INFO] CHANGELOG 업데이트 필요성 — 해당 없음
- 상세: 이 변경은 behavior-preserving refactor 로 외부 API·엔드포인트·설정 옵션·환경변수에 변화가 없다. 사용자 대면 변경이 없으므로 CHANGELOG 업데이트 의무가 발생하지 않는다.
- 제안: 없음.

### [INFO] README 업데이트 필요성 — 해당 없음
- 상세: `AiMemoryManager` 는 내부 리팩토링 산물로 외부에서 직접 참조하거나 설정하는 개념이 아니다. 새 환경변수·설정 옵션이 추가되지 않았으므로 README 업데이트 의무가 없다.
- 제안: 없음.

---

## 요약

`ai-memory-manager.ts` 신설 클래스는 클래스 레벨 JSDoc 부터 개별 메서드 파라미터·반환값 문서, 복잡한 인라인 로직 주석에 이르기까지 문서화 품질이 전반적으로 높다. 핸들러 원본의 주석이 verbatim 이관되면서 spec 참조(§6.1/§11.4/§12.14)·graceful degrade 조건·무상태 설계 근거·레이어 구분(`AgentMemoryService` 와의 책임 분리)이 모두 보존됐다. `AiAgentHandler` 의 `memoryManager` 필드 JSDoc 도 위임 목적을 명확히 설명한다. 문서화 관점에서의 미결 사항은 spec frontmatter `code:` 미등재(ai-memory-manager.ts, ai-condition-evaluator.ts)와 §6.1 구현 참조 stale 두 가지이나, 둘 다 spec 쓰기 권한이 있는 planner 가 M-1 전체 완료 후 일괄 처리해야 하는 사항으로 본 PR 자체의 코드 문서화 결함이 아니다.

---

## 위험도

LOW
