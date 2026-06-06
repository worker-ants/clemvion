# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` / scope: `spec/5-system/4-execution-engine.md` / diff-base: `origin/main`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `driveResumeAwaited` — spec/data-flow 에서 여전히 `driveResumeDetached` 로 참조 중 (이름 불일치)
  - target 신규 식별자: `driveResumeAwaited` (코드에서 `driveResumeDetached` 를 완전 rename)
  - 기존 사용처:
    - `spec/5-system/4-execution-engine.md` L128: `` `driveResumeDetached`/`driveResumeFrame` 가 도착 continuation payload 를 ... ``
    - `spec/5-system/4-execution-engine.md` L903: `` `driveResumeDetached`(top-level, awaited)/`driveCallStackResume`(중첩)가 ``
    - `spec/5-system/4-execution-engine.md` L1306: ``caller(`runExecution` / `driveResumeDetached`) 가 세그먼트 종료 여부를 판단한다.``
    - `spec/5-system/4-execution-engine.md` L1311: `` 종전 `driveResumeDetached` 는 executeInline 스택을 재진입하지 않아 ... ``
    - `spec/data-flow/3-execution.md` L111: ``driveResumeDetached/driveCallStackResume, await``
    - `spec/data-flow/3-execution.md` L113: ``rehydrateAndResume → driveResumeDetached (await) → ...``
    - `plan/in-progress/exec-park-durable-resume.md` 다수 줄
  - 상세: 코드에서는 `driveResumeDetached` 가 `driveResumeAwaited` 로 완전 rename 됐다 (`execution-engine.service.ts` L1834 def + 모든 call-site + 주석). spec 과 data-flow 다이어그램은 아직 구 이름을 사용하고 있다. 이는 충돌(상반된 의미)이 아닌 **spec-code 명칭 불일치** 이지만, spec 을 읽는 사람이 현재 코드와 다른 메서드명을 보게 되어 혼동이 발생한다. plan(`exec-park-polish.md` §A1)은 "service+spec 22+2곳" rename 을 명시했으나, 이번 diff 에서 spec 파일의 해당 2곳은 갱신되지 않았다.
  - 제안: `spec/5-system/4-execution-engine.md` 의 `driveResumeDetached` 언급(L128, L903, L1306, L1311)과 `spec/data-flow/3-execution.md` L111·L113 을 `driveResumeAwaited` 로 교체. plan §A1 의 "spec 2곳" 갱신을 이번 polish PR 범위 내에서 완료.

---

### 발견사항 2

- **[INFO]** `ProcessTurnResult` — 기존 영역에서 충돌하는 정의 없음, 신규 module-scope type alias 로 안전
  - target 신규 식별자: `type ProcessTurnResult = void | ParkSignal` (`execution-engine.service.ts` L285)
  - 기존 사용처: 없음. 코드베이스 전체(`codebase/**/*.ts`)에 동명 타입 정의가 다른 파일에 없다. 동일 파일 내에서만 `waitForFormSubmission`, `waitForButtonInteraction`, `processAiResumeTurn`, `waitForAiConversation`, `waitForButtonInteraction` 등의 반환 타입으로 사용된다.
  - 상세: `void | ParkSignal` 인라인 union 을 named alias 로 통일한 리팩터링. 이름이 충분히 지역적이고 module-private 이며, 유사한 이름(`TurnResult`, `ProcessResult` 등)도 프로젝트 내 다른 곳에 존재하지 않아 충돌 위험 없음.
  - 제안: 없음.

---

### 발견사항 3

- **[INFO]** `LLM_STUB_MODE` — `.env.example` 에 신규 등재, 기존 코드에서 이미 사용 중이던 ENV var 와 일치
  - target 신규 식별자: `LLM_STUB_MODE` (`.env.example` L207-211 신규 추가, `LLM_STUB_MODE=false` 기본값 포함)
  - 기존 사용처:
    - `codebase/backend/src/main.ts` L56: `process.env.LLM_STUB_MODE === 'true'` (부팅 가드)
    - `codebase/backend/src/modules/llm/llm.service.ts` L78: `process.env.LLM_STUB_MODE === 'true'`
    - `spec/5-system/7-llm-client.md` §7.1: `LLM_STUB_MODE` 정의 및 동작 명세
  - 상세: `.env.example` 에 기존에 없던 `LLM_STUB_MODE` 항목을 이번 diff 에서 추가했다. 코드(`main.ts`, `llm.service.ts`)와 spec(`7-llm-client.md §7.1`) 에서 이미 동일 의미로 사용 중이며, 이번 `.env.example` 추가는 문서화 정합성 보완이다. 충돌 없음.
  - 제안: 없음.

---

### 발견사항 4

- **[INFO]** `INTERACTION_JWT_SECRET` — 기존 서비스 코드 및 spec 에서 동일 의미로 이미 사용 중
  - target 신규 식별자: `INTERACTION_JWT_SECRET` (`.env.example` L42 신규 추가; `interaction-token.service.ts` 에 prod fail-closed 가드 추가)
  - 기존 사용처:
    - `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L67/L89 (origin/main 에 이미 존재)
    - `spec/5-system/14-external-interaction-api.md` L651: `INTERACTION_JWT_SECRET` 정의 및 fallback 규칙 명세
  - 상세: 이번 diff 는 `.env.example` 에 해당 env var 를 문서화하고, 기존 warn-only 동작에 prod fail-closed guard 를 추가했다. 환경변수명 자체는 이미 spec·코드 양쪽에서 동일 의미로 사용 중이어서 충돌 없음.
  - 제안: 없음.

---

## 요약

이번 diff 에서 실질적인 식별자 충돌은 발견되지 않았다. 가장 주목해야 할 사항은 코드에서 완전히 rename 된 `driveResumeAwaited` 가 `spec/5-system/4-execution-engine.md` 4곳과 `spec/data-flow/3-execution.md` 2곳에서 구 이름 `driveResumeDetached` 로 남아 있다는 spec-code 명칭 불일치다. 이는 기존 의미와 충돌하는 식별자 오용이 아니라 spec 갱신 미완료에 해당하며, plan(`exec-park-polish.md §A1`)이 해당 2개 spec 위치를 rename 범위로 명시했으므로 이번 PR 내 수정을 권장한다. `ProcessTurnResult`, `LLM_STUB_MODE`, `INTERACTION_JWT_SECRET` 는 모두 신규 충돌 없이 기존 사용처와 정합적으로 도입됐다.

## 위험도

LOW
