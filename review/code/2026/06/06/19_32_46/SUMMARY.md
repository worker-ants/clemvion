# Code Review 통합 보고서

## 전체 위험도
**LOW** — 내부 리팩터링(form/buttons/AI resume 분기 → `dispatchResumeTurn` registry 일원화)으로 신규 보안·기능 위험 없음. WARNING 4건(테스트 커버리지 갭·아키텍처 캡슐화·문서 주석)이 존재하나 런타임 안전성에 즉각 영향 없음. SPEC-DRIFT 1건(spec 갱신 필요).

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `driveResumeFrame`(중첩 frame) 에서의 `dispatchResumeTurn` 연결 경로가 단위 테스트에 없음. 새로 추가된 `dispatchResumeTurn` describe 는 메서드 자체를 spy 대체해 라우팅만 검증하므로, 중첩 재개(`driveResumeFrame → dispatchResumeTurn → processButtonResumeTurn` 등) end-to-end 연결 확인 불가. | `execution-engine.service.ts` diff `driveResumeFrame` `opts.isInnermost` 분기 / `execution-engine.service.spec.ts` | 기존 중첩 재개 통합 테스트(`armSlowPathResume` 패턴)에서 button/form/AI 각각이 `dispatchResumeTurn` 통해 정상 동작함을 검증하는 케이스 보강. 기존 케이스가 커버하면 주석 명시. |
| 2 | Testing | `handleAiResumeTurn` 정상 경로 테스트에서 `processAiResumeTurn` 호출 횟수만 검증하고 실제 전달 인자(`resumeState`, `nodeExec`, `payload` 등)를 검증하지 않음. ctx 연결 정확성 확인 불가. | `execution-engine.service.spec.ts` L249~282 | `aiSpy.mock.calls[0]` 또는 `toHaveBeenCalledWith(...)` 로 `resumeState`, `nodeExec`, `payload` 인자 추가 검증. |
| 3 | Architecture | `_resumeTurnRegistry` 지연 초기화 캐시를 테스트 `afterEach` 에서 private 멤버 직접 조작으로 리셋해야 하는 구조 — 테스트-구현 캡슐화 결합. 필드명 변경 시 테스트도 수정 필요. | `execution-engine.service.ts` L977-979 / `execution-engine.service.spec.ts` afterEach | registry 를 `onModuleInit` 훅에서 한 번 빌드해 `private readonly resumeTurnRegistry` 에 할당하면 `afterEach` 리셋 불필요. 현재 규모에서는 수용 가능. |
| 4 | Documentation | `afterEach` 의 `_resumeTurnRegistry = undefined` 리셋이 해당 `describe` 스코프에만 적용되나 주석에 "다른 describe 블록이 getter 를 간접 사용 시 동일 리셋 필요" 안내 미기재. 신규 개발자 누락 위험. | `execution-engine.service.spec.ts` L76-81 | 주석에 "이 `afterEach`는 본 describe 스코프에만 적용됨. 다른 describe 블록이 `resumeTurnRegistry` getter 를 간접 사용할 경우 동일 리셋 추가 필요" 한 줄 보완. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `dispatchResumeTurn` 레지스트리 패턴이 spec §7.5 에 미반영. spec §7.5 시퀀스 다이어그램은 form/buttons/AI 를 직접 호출하는 것으로 기술하나, 코드는 `resumeTurnRegistry` + `dispatchResumeTurn` 단일 진입점으로 추출됨. 코드가 옳고 spec 이 낡음. | `spec/5-system/4-execution-engine.md §7.5` L903~L906 | spec §7.5 시퀀스 다이어그램에 "form/button/ai 분기는 `dispatchResumeTurn`(ordered registry, `resume-turn-dispatch.ts`)을 통해 라우팅됨" 단락 반영. 코드 수정 불필요. |
| 2 | Security | `RehydrationError` 상세 메시지(노드 타입·interaction 타입)가 API 응답으로 클라이언트에 노출될 수 있는 경로 — 상위 catch 경계가 이 diff 범위에서 확인 불가. | `execution-engine.service.ts` `dispatchResumeTurn`(L1048~1054), `handleAiResumeTurn`(L1079~1084) | 최상위 핸들러에서 구체 메시지는 로그에만 기록하고 클라이언트에는 `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE` 코드만 노출하는지 별도 확인. |
| 3 | Security | `resumeCheckpoint as Record<string, unknown>` 캐스팅 — 런타임 구조 검증 없이 타입 캐스팅. `buildRetryReentryState` try/catch 로 방어됐으나 checkpoint 데이터 소스(DB) 신뢰성 별도 확인 권장. | `execution-engine.service.ts` `handleAiResumeTurn` L1075 | `resumeCheckpoint` 칼럼 DB-level 접근 제어 및 `buildRetryReentryState` 내 손상 데이터 처리 부작용 검토. |
| 4 | Architecture | `resumeTurnRegistry` 항목이 `this.*` 메서드를 closure 로 캡처 — service-bound 결합. 향후 registry 외부 확장 시 결합 부채로 전환 가능. 현재 규모에서 수용. | `execution-engine.service.ts` `resumeTurnRegistry` getter | 외부 확장 필요 시 `selects` 판정에 필요한 서비스를 팩토리 함수 주입으로 전환 고려. |
| 5 | Testing | `ai_form_render` interactionType AI 라우팅 케이스 부재. JSDoc 에 `isAiConversation` 이 `ai_conversation / ai_form_render` 모두 포함한다고 명시됐으나 테스트는 `ai_conversation` 만 커버. | `execution-engine.service.spec.ts` AI 라우팅 케이스 (L128~167) | `ai_form_render` + `isAiConversation: true` 조합 케이스를 `it.each` 또는 파라미터화로 추가. |
| 6 | Testing | `isCheckpointEligibleNodeType` 가 false 인 미적격 node type(예: `webhook`)에서 AI selector 가 매칭하지 않고 `RESUME_CHECKPOINT_MISSING` 으로 떨어지는 케이스 부재. | `execution-engine.service.ts` L1013~1016 / `execution-engine.service.spec.ts` | `isAiConversation: true`, `resumeCheckpoint: { schemaVersion: 1 }`, `node.type: 'webhook'` 조합 케이스 추가. |
| 7 | Testing | `resumeTurnRegistry` 항목 수·순서·`kind` 필드를 직접 단언하는 케이스 없음. 향후 항목 추가/삭제 시 회귀 방어 부재. | `execution-engine.service.ts` L979~1019 | `length === 3`, `kind` 순서 `['form','buttons','ai_conversation']` 확인 케이스 1개 추가 (선택적). |
| 8 | Testing | `process-turn-result.ts` smoke 테스트 없음. import 경로 변경 시 캐치 포인트 부재. | `codebase/backend/src/shared/execution-resume/process-turn-result.ts` | 기존 spec 파일 상단에 `expect(PARK_RELEASED).toEqual(expect.any(Symbol))` 1줄 추가. |
| 9 | Maintainability | `DispatchSubject` 타입이 describe 블록 내부에 선언돼 `CheckpointSubject` 의 파일-상단 패턴과 불일치. 향후 describe 분리 시 중복 선언 위험. | `execution-engine.service.spec.ts` L51~60 | `DispatchSubject` 를 `CheckpointSubject` 와 같은 레벨(describe 바깥 상위 스코프)로 승격. |
| 10 | Maintainability | `makeCtx` 헬퍼가 describe 내부로 제한돼 `armSlowPathResume` 의 바깥-선언 패턴과 불일치. 향후 describe 분리 시 참조 깨짐 위험. | `execution-engine.service.spec.ts` L62~74 | `makeCtx` 를 describe 바깥 또는 `armSlowPathResume` 과 같은 수준으로 이동, 또는 "이 블록 전용" 주석 명시. |
| 11 | Security/Plan | `plan/complete` 파일에 e2e 환경 `ENCRYPTION_KEY: 0123456789abcdef...` 언급. 해당 값이 프로덕션에서 재사용되지 않는지 확인 권장. | `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md` | `docker-compose.e2e.yml` 의 키가 64-hex 더미 값으로 교정됐음을 확인. 프로덕션 값과 동일하지 않도록 관리. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 에러 메시지 내 내부 아키텍처 정보 클라이언트 노출 경로 미확인, resumeCheckpoint 구조 검증 부재(방어됨) |
| architecture | LOW | registry service-bound closure 결합(현재 수용), 지연 초기화 캐시 테스트 리셋 의존(캡슐화 약화) |
| requirement | NONE | spec §7.5 SPEC-DRIFT 1건(코드 옳음, spec 갱신 필요), 기능 완전성 충족 |
| scope | NONE | 변경 범위 내 모든 항목, 의도 이상 변경 없음 |
| side_effect | NONE | Symbol 정체성 보존 확인, 기존 부작용(setNodeOutput) 동작 보존 |
| maintainability | LOW | DispatchSubject/makeCtx 스코프 불일치(기능 문제 없음), 주석 충실도 양호 |
| testing | LOW | driveResumeFrame 중첩 경로 미검증(WARNING), processAiResumeTurn 인자 검증 부분적(WARNING) |
| documentation | LOW | afterEach 리셋 범위 주석 미비(WARNING), 신규 파일 JSDoc 우수 |
| concurrency | NONE | Node.js 단일 스레드 환경에서 경쟁 조건 없음, 외부 executionId 락 보존 |

---

## 발견 없는 에이전트

- **scope**: 의도 이상 변경 없음, 변경 범위 명확히 충족
- **side_effect**: 새로운 의도치 않은 부작용 없음
- **concurrency**: 동시성 관점 실질 위험 없음
- **requirement**: 기능 완전성 충족 (SPEC-DRIFT 제외 — 코드 수정 대상 아님)

---

## 권장 조치사항

1. **(WARNING — Testing)** 기존 중첩 재개 통합 테스트 확인/보강: `driveResumeFrame` → `dispatchResumeTurn` 경로가 button/form/AI 각각에서 정상 동작함을 기존 `armSlowPathResume` 패턴 활용해 검증. 기존 케이스가 커버하면 주석으로 명시.
2. **(WARNING — Testing)** `handleAiResumeTurn` 정상 경로 테스트에 `processAiResumeTurn` 인자 검증 추가 (`resumeState`, `nodeExec`, `payload` — `toHaveBeenCalledWith` 또는 `mock.calls[0]` 방식).
3. **(WARNING — Architecture)** `_resumeTurnRegistry` 지연 초기화를 `onModuleInit` 훅으로 전환해 private 멤버 직접 조작 없이 테스트 격리 달성. 단기적으로 현 `afterEach` 리셋 방식 수용 가능.
4. **(WARNING — Documentation)** `afterEach` 주석에 "이 리셋은 본 describe 스코프에만 적용됨. 다른 describe 블록이 `resumeTurnRegistry` getter 간접 사용 시 동일 리셋 추가 필요" 한 줄 보완.
5. **(SPEC-DRIFT — Requirement)** `spec/5-system/4-execution-engine.md §7.5` 시퀀스 다이어그램(L903~L906)에 `dispatchResumeTurn` registry 패턴 반영. 코드 수정 불필요, spec 갱신만 필요.
6. **(INFO — Security)** `RehydrationError` 상위 핸들러에서 상세 메시지가 클라이언트 응답에 노출되지 않는지 별도 확인.
7. **(INFO — Testing)** `ai_form_render` interactionType AI 라우팅 케이스 추가 (`it.each` 파라미터화).
8. **(INFO — Testing)** `isCheckpointEligibleNodeType` false 케이스 (예: `node.type: 'webhook'`) 테스트 추가.
9. **(INFO — Maintainability)** `DispatchSubject` 타입을 describe 바깥 상위 스코프로 승격, `makeCtx` 헬퍼 위치 기존 패턴과 통일.

---

## 라우터 결정

라우터가 reviewer 를 선별하여 실행했습니다.

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (9명)
- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외** (5명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단으로 제외 |
  | dependency | 라우터 판단으로 제외 |
  | database | 라우터 판단으로 제외 |
  | api_contract | 라우터 판단으로 제외 |
  | user_guide_sync | 라우터 판단으로 제외 |