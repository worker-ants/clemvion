# 신규 식별자 충돌 검토 — exec-park-durable-resume (spec/5-system 변경)

검토 모드: `--impl-done`, scope=`spec/5-system` + `spec/1-data-model.md`, diff-base=`origin/main`

---

## 발견사항

### 1. **[WARNING]** `D6` 레이블 충돌 — 동일 단문자가 두 맥락에서 다른 의미로 사용

- **target 신규 식별자**: `exec-park D6` — `4-execution-engine.md` §7.5 / §Rationale 에서 "중첩 sub-workflow 호출 체인 durable 영속 (call stack 영속화)" 를 가리키는 결정 레이블
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md:751` (`D6 결정`) — "waiting/resumed 의 `messages`/`message`/`turnCount` 가 종결 시점 `output.result.*` 와 단일 경로로 통일" 을 가리키는 결정 레이블. 동일 레이블이 `spec/4-nodes/3-ai/2-text-classifier.md:340`, `spec/4-nodes/3-ai/3-information-extractor.md:334` 에서도 참조된다.
- **상세**: target 은 두 `D6` 가 "무관"임을 `4-execution-engine.md §7.5` 의 callout box (`> **레이블 주의**: 본 절의 exec-park D6 는 … AI 노드 spec 의 동명 D6 와 무관하다`) 와 §Rationale 인라인 주석 `*(레이블: exec-park-durable-resume plan 결정 D6 — AI 노드 spec 의 동명 D6 와 무관)*` 로 self-disclaimer 한다. 그러나 spec 독자(특히 `4-nodes/3-ai/` 측)가 실행 엔진 변경을 읽을 때 동일 단문자 `D6` 를 만나면 충돌이 즉각 인지되지 않는다. 단순 검색(`grep -n "D6"`)이나 cross-reference 추적 시 혼동이 발생할 수 있다.
- **제안**: 실행 엔진 레이블을 `exec-D6` 또는 `EE-D6` 와 같이 prefix 로 namespace 를 분리하거나, 해당 레이블을 plan 문서에서만 쓰고 spec 본문에는 기능 명칭("call-stack durable")으로만 참조하는 방식을 검토한다. 현재 self-disclaimer 는 존재하나 검색/인덱스 레벨의 혼동 차단은 불가능하다.

---

### 2. **[INFO]** `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 동형 패턴 상수 병존

- **target 신규 식별자**: `CALL_STACK_SCHEMA_VERSION` — `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts:48` 에 `export const CALL_STACK_SCHEMA_VERSION = 1` 로 도입. `spec/5-system/4-execution-engine.md` §6.2, §7.5 에서 참조
- **기존 사용처**: `CHECKPOINT_SCHEMA_VERSION` — `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts:284` 에 `const CHECKPOINT_SCHEMA_VERSION = 1` 로 존재. 동일 파일 내 `_resumeCheckpoint` 버전 가드에 사용
- **상세**: 두 상수는 의미적으로 독립이며(spec 이 "checkpoint 와 독립" 을 명시), 이름도 다르고, 값도 우연히 동일(1)하다. 충돌은 없다. 단, 두 상수가 모두 값 `1` 이고 유사한 역할(롤링 배포 버전 가드)을 하면서 이름만 다른 패턴은 향후 둘을 혼동해 잘못 참조하는 실수 위험을 내포한다.
- **제안**: `resume-call-stack.types.ts` 의 JSDoc 에 이미 "CHECKPOINT_SCHEMA_VERSION 과 독립" 주석이 있으므로 현재 수준으로 충분. 추가 조치 불요.

---

### 3. **[INFO]** `resume_call_stack` 컬럼명 — 기존 컬럼 패턴과 일관성 확인

- **target 신규 식별자**: `Execution.resume_call_stack` JSONB? 컬럼 (V087, `spec/1-data-model.md:467`)
- **기존 사용처**: 동일 `Execution` 엔티티의 기존 컬럼들 — `conversation_thread` (V084), `user_variables` (V085). 모두 `snake_case` JSONB 컬럼으로 일관된 패턴
- **상세**: 이름 패턴이 기존 durable resume 컬럼 `conversation_thread`, `user_variables` 와 동형이며 충돌 없음. 다른 엔티티에 동일 이름의 컬럼 없음.
- **제안**: 충돌·혼동 없음. 추가 조치 불요.

---

### 4. **[INFO]** `PR-B2a` / `PR-B2b` 레이블 — plan 내부 단계 레이블로 spec 본문 등장

- **target 신규 식별자**: `PR-B2a`(top-level 멀티턴 AI), `PR-B2b`(중첩 D6 + full B3) — `4-execution-engine.md` §4.x banner, §Rationale 에 등장
- **기존 사용처**: `PR-B1`, `PR-B2` 는 `plan/in-progress/exec-park-durable-resume.md` 에서 정의된 plan 단계 레이블이며, origin/main 의 `4-execution-engine.md` 에도 이미 `PR-B1`, `PR-B2` 로 등장했다
- **상세**: `PR-B2a`/`PR-B2b` 는 `PR-B2` 의 재분할이므로 기존 `PR-B2` 사용처(`spec/4-nodes/6-presentation/0-common.md:415` 등)와의 의미 차이가 생긴다. 기존 문서에서 `PR-B2` 를 단수로 언급한 곳이 있으면 재분할 사실이 반영되지 않아 stale 가능. 단, `PR-B*` 레이블은 구현 진행 상태 메모용 단기 식별자로 product spec 식별자(요구사항 ID)가 아니므로 CRITICAL 충돌은 아니다.
- **제안**: 재분할 주석이 `plan/in-progress/exec-park-durable-resume.md` 에만 있고, `spec/4-nodes/6-presentation/0-common.md:415` 의 "PR-B2" 단수 언급은 분할 이전 표기로 stale 될 수 있다. 해당 위치를 점검해 `PR-B2a/B2b` 로 갱신하거나 "PR-B2(분할됨)" 주석을 추가하는 것을 권장.

---

## 요약

target 이 도입하는 핵심 식별자(`resume_call_stack`, `CALL_STACK_SCHEMA_VERSION`, `ResumeCallStack`, `CALL_STACK_SCHEMA_VERSION`)는 기존 식별자와 실제 충돌 없이 도입된다. 단, `D6` 레이블이 `spec/4-nodes/3-ai/` 영역에서 이미 "AI 노드 output 경로 단일화" 결정으로 사용 중인데, target 의 `exec-park D6` 가 동일 단문자를 다른 의미로 재사용한다는 점이 WARNING 수준의 혼동 위험을 내포한다. 이를 self-disclaimer callout 으로 인지는 시켜 두었으나 검색·인덱스 레벨에서 namespace 분리가 완전하지 않다. 나머지 식별자는 INFO 수준의 일관성 사항이며 blocking 이슈 없다.

## 위험도

LOW
