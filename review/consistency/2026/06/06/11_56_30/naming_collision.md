# 신규 식별자 충돌 Check — exec-park-durable-resume (PR-B2a)

검토 범위: `spec/5-system` (diff base: origin/main), 구현 완료 후 검토 (--impl-done)

## 발견사항

### [WARNING] `exec-park D6` 레이블이 AI 노드 spec 의 기존 `D6` 레이블과 동일
- target 신규 식별자: `exec-park D6` — `spec/5-system/4-execution-engine.md` 에서 "중첩 sub-workflow blocking durable 영속(call-stack 영속화)" 결정을 가리키는 레이블로 신규 도입
- 기존 사용처:
  - `spec/4-nodes/3-ai/1-ai-agent.md` — `D6 결정`: waiting/resumed 의 messages/turnCount 가 종결 시점 output.result.* 와 단일 경로로 통일 (AI 노드 output 경로 단일화)
  - `spec/4-nodes/3-ai/3-information-extractor.md` — `D6 결정`: IE 의 output.result.* 단일 경로 통일
  - `spec/4-nodes/3-ai/2-text-classifier.md` — `D6 결정`: originalInput 의 정상/에러 경로 통일
  - `spec/conventions/conversation-thread.md` — `D6 단일 경로` 언급
- 상세: AI 노드 spec 에서 D6 는 "output 경로 단일화" 결정이고, 실행 엔진 spec 에서 exec-park D6 는 "중첩 executeInline call stack 영속" 결정이다. 두 D6 는 동일 영역(AI 노드 실행 흐름)에서 교차 참조될 가능성이 있다. 예를 들어 execution-engine 의 AI 멀티턴 절차를 읽는 개발자가 "D6" 를 AI 노드 output 경로 단일화로 오해하거나, 반대로 AI 노드 spec 의 D6 가 call stack 영속과 혼동될 수 있다.
- 완화 조치(이미 적용): `4-execution-engine.md` 신규 절에 "레이블 주의: 본 절의 `exec-park D6` 는 `exec-park-durable-resume` plan 의 결정 D6(중첩 call stack 영속)이며, AI 노드 spec(`1-ai-agent.md` 등)의 동명 `D6`(AI 노드 output 경로 단일화)와 무관하다" 주석이 삽입됨.
- 제안: 향후 exec-park plan 의 `D6` 레이블을 spec 본문에서 참조할 때는 반드시 "exec-park D6" 전체 형태를 쓰고 단독 `D6` 로 축약하지 않는다. 기존 AI 노드 spec 의 단독 `D6` 표기는 변경 불요(이미 그 영역 안에서 명확).

---

### [INFO] `CALL_STACK_SCHEMA_VERSION` 상수 — `CHECKPOINT_SCHEMA_VERSION` 과의 이름 유사성
- target 신규 식별자: `CALL_STACK_SCHEMA_VERSION` (`codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`)
- 기존 사용처: `CHECKPOINT_SCHEMA_VERSION` — execution-engine.service.ts 및 spec/5-system/4-execution-engine.md §1.3 에서 AI 멀티턴 `_resumeCheckpoint` 의 버전 관리 상수로 사용 중
- 상세: 두 상수는 의도적으로 분리된 독립 버전 카운터이며(spec 에 명시), 이름 구조(`*_SCHEMA_VERSION`)는 동일하나 의미는 다르다. 혼동 가능성은 낮지만 코드 수색(grep/IDE) 시 두 상수가 함께 나타난다.
- 제안: 현행 명명 유지. spec 이 이미 "checkpoint 와 독립 상수" 로 명시하므로 충분.

---

### [INFO] `LLM_STUB_MODE` 환경 변수 — `.env.example` 미등재
- target 신규 식별자: `LLM_STUB_MODE` 환경 변수 (신규 도입 — `codebase/backend/src/modules/llm/llm.service.ts`, `codebase/backend/src/main.ts`)
- 기존 사용처: `OAUTH_STUB_MODE` — 동일 `main.ts` 부트스트랩에서 동일 fail-closed 패턴으로 사용 중. 기존 `.env.example` 에 `OAUTH_STUB_MODE` 등재 여부에 따라 일관성 차이 발생 가능
- 상세: `LLM_STUB_MODE` 는 dockerized e2e 인프라 전용(테스트 전용)이라 운영 config 에 포함할 이유는 없으나, `OAUTH_STUB_MODE` 가 `.env.example` 에 경고 주석과 함께 등재돼 있다면 `LLM_STUB_MODE` 도 동일 패턴이 일관성 측면에서 낫다.
- 제안: `OAUTH_STUB_MODE` 가 `.env.example` 에 있으면 `LLM_STUB_MODE` 도 "# 테스트 전용, 운영 사용 금지" 주석과 함께 추가한다. 확인 후 동일 처리.

---

### [INFO] `ResumeCallStack` / `ResumeCallStackFrame` TypeScript 타입 — 신규 경로 `src/shared/execution-resume/`
- target 신규 식별자: `ResumeCallStack`, `ResumeCallStackFrame`, `CALL_STACK_SCHEMA_VERSION` (`codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`, 신규 파일)
- 기존 사용처: `src/shared/` 최상위 디렉터리는 이미 `conversation-thread/`, `utils/` 로 사용 중. `execution-resume/` 서브디렉터리는 신규
- 상세: 디렉터리 명 `execution-resume` 은 기존 패턴(`conversation-thread`, `utils`)과 일관. 파일명 `resume-call-stack.types.ts` 는 프로젝트의 `*.types.ts` 관례와 일치. 충돌 없음.
- 제안: 없음.

---

### [INFO] `processAiResumeTurn` 메서드 — 기존 `runAiConversationLoop` 와의 책임 분리
- target 신규 식별자: `processAiResumeTurn` (private 메서드, `execution-engine.service.ts`)
- 기존 사용처: `runAiConversationLoop` 가 동일 파일에서 AI 멀티턴을 처리. `processAiResumeTurn` 은 PR-B2a 에서 §7.5 rehydration 경로의 단발 turn 처리기로 추가됨
- 상세: 두 이름 모두 AI 멀티턴 실행에 관여하나 역할이 다르다(`runAiConversationLoop` = 장수 in-memory 루프, `processAiResumeTurn` = rehydration 후 단발 turn 처리). 동일 파일 내 private 메서드라 외부 충돌 없음. 명칭 구분도 명확.
- 제안: 없음.

---

## 요약

이번 변경이 도입하는 신규 식별자(`resume_call_stack` DB 컬럼, `ResumeCallStack`/`ResumeCallStackFrame` 타입, `CALL_STACK_SCHEMA_VERSION` 상수, `processAiResumeTurn` 메서드, `LLM_STUB_MODE` 환경 변수)는 기존 코드베이스·spec 어디에도 동일 이름으로 다른 의미로 사용된 사례가 없다. 유일한 주의 사항은 **`exec-park D6` 레이블이 AI 노드 spec 의 기존 `D6` 레이블과 같은 단문자를 공유**하는 점이나, spec 내에 "레이블 주의" 경고 주석이 이미 삽입되어 있어 독자 혼동 위험은 낮다. 나머지 신규 식별자는 모두 고유하며 기존 네이밍 컨벤션과 일관된다.

## 위험도

LOW
