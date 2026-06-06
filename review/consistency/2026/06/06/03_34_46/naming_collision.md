# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done, scope=spec/5-system, diff-base=origin/main  
검토 일시: 2026-06-06

## 분석 대상 변경사항

이번 PR(`exec-park-durable-resume`)이 새로 도입하거나 갱신하는 식별자:

- **DB 컬럼**: `Execution.resume_call_stack` (V087)
- **TypeScript 인터페이스**: `ResumeCallStack`, `ResumeCallStackFrame`
- **TypeScript 상수**: `CALL_STACK_SCHEMA_VERSION`
- **설계 결정 레이블**: `D6` — 실행 엔진 spec에서 "중첩 sub-workflow blocking durable 영속 / call stack 영속화"를 지칭
- **파일 경로**: `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` (신규 디렉토리)
- **마이그레이션**: `V087__execution_resume_call_stack.sql`

---

## 발견사항

### [CRITICAL] 설계 결정 레이블 D6 의미 충돌

- **target 신규 식별자**: `D6` — `spec/5-system/4-execution-engine.md` Rationale 섹션에서 "중첩 sub-workflow blocking durable 영속 (call stack 영속화 정공법)"을 지칭. 해당 문서 내 다수 위치에 등장: §6.2 park commit (e), §7.5 재귀 재진입 섹션 표제, Rationale "D6 — 중첩 sub-workflow blocking durable 영속" 항목.

- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/1-ai-agent.md` 라인 749: `> **D6 결정**: waiting/resumed 의 messages / message / turnCount 가 종결 시점(output.result.*)과 단일 경로로 통일` — AI Agent 노드 output path unification 결정
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/2-text-classifier.md` 라인 340, 350: `D6 통일 — originalInput 단일 경로`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/4-nodes/3-ai/3-information-extractor.md` 라인 332, 368, 384, 428: `ai_agent 와 단일 경로 통일 — D6`, `D6 결정: waiting의 대화 상태가 종결 시점과 단일 경로로 통일`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/spec/conventions/conversation-thread.md` 라인 118, 215, 317, 415: `D6 단일 경로` 참조

- **상세**: D-레이블 번호(D3, D4, D6 등)는 설계 결정 식별자로 spec 간 cross-reference로 사용된다(`spec/4-nodes/3-ai/3-information-extractor.md`가 `spec/4-nodes/3-ai/1-ai-agent.md`의 D6를 참조하고, `spec/conventions/conversation-thread.md`가 동일 D6를 인용). 기존 D6는 "AI 노드 output 경로 단일화(waiting/resumed 시점의 messages를 output.result.* 단일 경로로)" 를 의미한다. 신규 D6는 "중첩 sub-workflow 호출 체인(resume_call_stack) 영속화"라는 완전히 다른 의미다. 동일 레이블이 두 개의 독립된 설계 결정을 가리키게 되어, spec을 읽는 사람이 "D6" 참조가 어느 결정을 뜻하는지 혼동한다.

- **제안**: 실행 엔진 spec의 신규 설계 결정에 기존 D1~D5 (D3, D4 기존 사용)를 피하고 D5 또는 D7 이상 번호를 부여한다. 현재 실행 엔진 spec에는 D3·D4만 존재하고 D5·D6는 부재했으므로, D5 또는 D7이 안전하다. 대안으로 실행 엔진 spec 전용 레이블 체계(예: `EE-D6`)를 사용하거나, AI 노드 D6를 리네임(하위 호환 이슈 없음 — spec 내부 레이블이므로)한다. 어느 방향이든 두 의미의 D6가 공존하는 상태를 해소해야 한다.

---

### [INFO] CALL_STACK_SCHEMA_VERSION과 CHECKPOINT_SCHEMA_VERSION 병존 — 혼동 가능성

- **target 신규 식별자**: `CALL_STACK_SCHEMA_VERSION` (`codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` 라인 48, 값 `1`)

- **기존 사용처**: `CHECKPOINT_SCHEMA_VERSION` (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 284, 값 `1`) — `_resumeCheckpoint` 스키마 버전 상수

- **상세**: 두 상수는 이름이 유사하고 현재 값이 동일하게 `1`이다. 코드 주석과 spec에서 "독립 상수"임을 명시하고 있고, 실제 역할도 서로 다르다(`_resumeCheckpoint` 스키마 vs `resume_call_stack` 스키마). 이름의 유사성이 PR-B2 구현 시 실수로 혼용될 수 있다. 특히 `execution-engine.service.ts`에서 두 상수를 같은 파일에 두려는 코멘트도 존재하는 상황에서, 가독성 강화 가치가 있다.

- **제안**: 현 네이밍은 기능적으로 충분히 구분되며(CALL_STACK vs CHECKPOINT) 코드 네임스페이스도 다른 파일에 위치한다. 혼동 방지를 위해 상수 선언부에 "checkpoint 스키마와 독립" 주석이 이미 있어 INFO 수준으로 충분하다. PR-B2 구현 시 두 상수를 한 파일로 통합하지 않도록 주의 권고.

---

### [INFO] spec/5-system 검토 범위 vs 실제 신규 식별자 위치

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md` 내 `resume_call_stack` 컬럼 언급 (§6.2, §7.5), `spec/1-data-model.md`의 `resume_call_stack` 필드 추가

- **기존 사용처**: `spec/1-data-model.md`는 `spec/5-system` 범위 밖이지만 이번 변경에 포함됨. `resume_call_stack` 식별자는 `spec/1-data-model.md` §2.13 Execution 테이블에도 신규 추가됨.

- **상세**: 해당 필드명(`resume_call_stack`, `resumeCallStack`)은 기존 spec 및 codebase에 선재하지 않음. DB 컬럼명, TypeScript property명, JSON 필드명 모두 일관되게 새로 도입되어 기존 사용처와 충돌 없음.

- **제안**: 식별자 자체는 충돌 없음. 단 spec 검토 범위가 `spec/5-system` 으로 제한됐으나 `spec/1-data-model.md` 변경도 포함됨 — 범위 선언과 실제 변경 파일 간 불일치이나 identifier collision 관점에서는 영향 없음.

---

## 요약

이번 변경이 도입하는 식별자 중 **DB 컬럼(`resume_call_stack`), TypeScript 타입(`ResumeCallStack`, `ResumeCallStackFrame`), 상수(`CALL_STACK_SCHEMA_VERSION`), 마이그레이션 번호(V087)** 는 기존 codebase·spec에 선재하지 않아 충돌 없다. 그러나 **설계 결정 레이블 `D6`** 는 이미 `spec/4-nodes/3-ai/1-ai-agent.md` 등 AI 노드 및 `spec/conventions/conversation-thread.md` 에서 "AI 노드 output 경로 단일화" 결정으로 확립·cross-reference 되어 있는데, 이번 target이 `spec/5-system/4-execution-engine.md` 에 동일 레이블 D6를 "중첩 sub-workflow call stack 영속화"라는 전혀 다른 의미로 새로 부여해 레이블 충돌이 발생했다. spec 독자가 실행 엔진 관련 문서에서 D6 참조를 만났을 때 의미를 잘못 해석할 직접적 혼선 위험이 있으므로 CRITICAL로 분류한다.

## 위험도

HIGH
