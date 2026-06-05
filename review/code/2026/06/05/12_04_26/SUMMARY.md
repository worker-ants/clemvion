# Code Review 통합 보고서

리뷰 대상 커밋: `b6dda4d9` — feat(execution-engine): PR-A2b — information_extractor 멀티턴 checkpoint 재개 확장

---

## 전체 위험도

**MEDIUM** — 기능 구현 자체는 안전하고 요구사항을 충족하나, 테스트 커버리지에 구조적 갭이 있다. 변경된 가드 3곳 중 2곳(`emitAiWaitingForInput`, `handleAiMessageTurn`)에 직접 검증이 없고, 통합 테스트의 assertion 이 약하며, monkey-patch 패턴이 테스트 격리를 위협한다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `node.type === 'ai_agent' \|\| node.type === 'information_extractor'` 패턴이 3곳에 문자열 리터럴로 중복. 세 번째 resumable 타입 추가 시 한 곳이라도 누락되면 조용한 회귀 발생 | `execution-engine.service.ts` L1825, L5056, L5313 | 파일 상단에 `CHECKPOINT_ELIGIBLE_NODE_TYPES = new Set(...)` 상수 또는 `isCheckpointEligible(type)` 타입 가드 함수로 단일화 |
| 2 | 유지보수성 | `maxCollectionRetries` 기본값 `3`이 하드코딩. `CHECKPOINT_SCHEMA_VERSION = 1` 상수 선언 패턴과 불일치하며 IE 핸들러 기본값과의 동기화 수단 없음 | `execution-engine.service.ts` L4239 | `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 상수 선언 후 참조 |
| 3 | 테스트 | 통합 테스트에서 `loadAndBuildGraph` / `waitForAiConversation` 을 monkey-patch 후 `finally` 복원. 비동기 예외 또는 강제 중단 시 전역 서비스 인스턴스 오염 가능 | `execution-engine.service.spec.ts` L202–L249 | `jest.spyOn` + `mockImplementation` 패턴으로 전환, `afterEach(() => jest.restoreAllMocks())` 등록 |
| 4 | 테스트 | `cpSubject()` 팩토리의 인스턴스 독립성 불확실. 두 `buildRetryReentryState` 테스트가 동일 workflowId / nodeId 를 공유하므로 싱글턴 반환 시 컨텍스트 격리 파괴 가능 | `execution-engine.service.spec.ts` L88–L150 | `cpSubject()` 구현 확인 후 각 `it` 블록에 독립 인스턴스 보장. 필요 시 `beforeEach` 초기화 |
| 5 | 테스트 | 변경된 가드 3곳 중 `driveResumeDetached` 만 통합 테스트로 커버. `emitAiWaitingForInput` (IE 노드 checkpoint 저장)과 `handleAiMessageTurn` (IE 재진입) 경로에 직접 검증 부재 | `execution-engine.service.ts` L5056, L5308 | 각 가드 경로에 대한 단위/통합 테스트 추가 — IE 노드에서 `_resumeCheckpoint` 저장 여부, AI 메시지 턴 처리 실행 여부 검증 |
| 6 | 테스트 | 통합 테스트가 `waitForAiConversation` 호출 횟수와 `RESUME_INCOMPATIBLE_STATE` 미발생만 검증. `buildRetryReentryState` 가 checkpoint 에서 `partialResult`, `collectionRetryCount` 를 실제로 복원했는지 assertion 없음 | `execution-engine.service.spec.ts` L224–L250 | `waitForAiConversation` 호출 인자(`resumeState`)를 캡처해 `expect(resumeState).toMatchObject({ partialResult: ..., collectionRetryCount: ... })` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `partialResult` 가 크기 제한 없이 JSONB 에 저장. 외부 공격면은 낮으나(LLM 출력 기반) 방어 심도 개선 여지 있음 | `execution-engine.service.ts` `buildResumeCheckpoint` | `partialResult` 직렬화 바이트 상한(예: 64 KB) 가드 추가 권장 |
| 2 | 보안 | `as number \| undefined`, `as unknown[] \| undefined` 등 TypeScript 캐스팅만으로 런타임 타입 미검증. 공격면 낮음(워크플로 설계자 내부 데이터) | `execution-engine.service.ts` 신규 블록 | zod 등으로 IE node config 런타임 파싱 헬퍼 도입 검토 |
| 3 | 보안 | 통합 테스트에서 private 메서드를 `as unknown as {...}` 로 직접 모킹. 향후 rehydration 경로에 인가 가드 추가 시 테스트가 가드를 우회할 수 있음 | `execution-engine.service.spec.ts` L202–L250 | 전체 경로 통과 테스트 또는 node 타입·권한 가드 별도 단위 테스트 추가 |
| 4 | 유지보수성 | `buildResumeCheckpoint` allow-list 와 `buildRetryReentryState` 기본값 로직이 서로 대칭을 유지해야 하는 계약이 주석으로만 표현됨 | `execution-engine.service.ts` L4302–L4339, L4228–L4246 | checkpoint 필드 목록을 단일 타입/인터페이스로 선언해 두 함수가 공유하도록 구조화, 또는 `// SYNC:` 주석 강화 |
| 5 | 유지보수성 | 통합 테스트의 `try/finally` 수동 복원 패턴에서 `mockNodeRepo.findOneBy` 는 복원하지 않는 비대칭 | `execution-engine.service.spec.ts` L187 | `finally` 에 `mockNodeRepo.findOneBy = origFindOneBy` 추가 검토 |
| 6 | 유지보수성 | 통합 테스트에서 `cpSubject()` 를 동일 테스트 내 두 번 호출. 참조 불일치 가능성 | `execution-engine.service.spec.ts` L89–L94 | `const cp = cpSubject()` 로 한 번만 호출하고 재사용 |
| 7 | 테스트 | `buildResumeCheckpoint` 기본값 테스트에서 ai_agent 노드에 IE 필드(`partialResult: {}`, `collectionRetryCount: 0`)가 inert 로 저장돼도 ai_agent 핸들러가 이를 무시함을 검증하는 회귀 케이스 없음 | `execution-engine.service.spec.ts` L79–L86 | ai_agent 타입 노드 + IE 필드 기본값 포함 시나리오의 회귀 테스트 추가 |
| 8 | 테스트 | `collectionRetryCount` 의 `typeof === 'number'` 방어 가드에 대응하는 엣지 케이스 테스트 없음 (`"2"`, `null`, `NaN` 입력 시 0 수렴 미검증) | `execution-engine.service.ts` L4324–L4326 | `collectionRetryCount: "2"` / `null` 단위 테스트 추가 |
| 9 | 테스트 | IE 노드 + `schemaVersion: 999` → `RESUME_INCOMPATIBLE_STATE` graceful reset 케이스 미확인 | `execution-engine.service.spec.ts` | 기존 future-version 테스트 패턴을 IE 노드에도 동일하게 추가 |
| 10 | 문서화 | `buildResumeCheckpoint` JSDoc 이 ai_agent 동기화만 언급하며 IE 확장(`partialResult`/`collectionRetryCount` allow-list 추가) 미반영 | `execution-engine.service.ts` L4280–L4301 | NOTE 블록에 IE 고유 필드 및 IE 핸들러 state shape 변경 시 함께 갱신 내용 추가 |
| 11 | 문서화 | `buildRetryReentryState` JSDoc 에 IE config 재유도 분기 및 IE runtime state 기본값 보강 내용 누락 | `execution-engine.service.ts` L4145–L4157 | `@returns` 또는 `@remarks` 에 IE 노드 동작 설명 추가 |
| 12 | [SPEC-DRIFT] | consistency-check INFO I1 (A2b "분리·후속" 표기)은 이 PR 의 plan.md 완료 갱신으로 해소됨. spec 3곳도 이미 갱신 완료 | `plan/in-progress/exec-park-durable-resume.md`, `spec/4-execution-engine §1.3` 외 2곳 | 별도 조치 불필요 (이미 해소) |
| 13 | 부작용 | `buildRetryReentryState` 반환 객체에 IE 전용 필드 6개 추가 → ai_agent 재개 경로에 inert 전파. 기본값(빈 객체/0)이 ai_agent checkpoint row 에 미세하게 추가 저장됨 | `execution-engine.service.ts` L4231–L4246 | ai_agent checkpoint 에 빈 IE 필드 포함 여부를 문서화하거나, 설계 계약으로 명시적 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `partialResult` 크기 미제한, 타입 단언 런타임 미검증 — 외부 공격면 낮음 |
| requirement | NONE | 요구사항 완전 충족. spec §1.3 L111~118 3대 핵심 사항 모두 구현 |
| scope | NONE | 변경 범위 정상. 의무 산출물·plan 갱신·주석 모두 A2b 범위에 귀속 |
| side_effect | LOW | ai_agent 재개 경로에 IE 필드 inert 전파, DB checkpoint 기본값 추가. 하위 호환 유지 |
| maintainability | LOW | 노드 타입 가드 3중 중복 (WARNING), `maxCollectionRetries` 매직 넘버 (WARNING) |
| testing | MEDIUM | 가드 2곳 직접 검증 부재(WARNING), 약한 통합 assertion(WARNING), monkey-patch 격리 위험(WARNING) |
| documentation | LOW | JSDoc 2곳에 IE 확장 내용 미반영(INFO). 인라인 주석과 plan 문서는 양호 |

---

## 발견 없는 에이전트

scope, requirement — 발견사항 없음 (NONE 위험도).

---

## 권장 조치사항

1. **(WARNING — 테스트 커버리지)** `emitAiWaitingForInput` 과 `handleAiMessageTurn` 가드 경로에 대한 직접 테스트 추가 — IE 노드 `_resumeCheckpoint` 저장 검증, IE 타입 AI 메시지 턴 처리 검증.
2. **(WARNING — 통합 테스트 assertion 강화)** `waitForAiConversation` 호출 인자(`resumeState`)를 캡처해 `partialResult`, `collectionRetryCount`, `outputSchema` 복원 여부를 `toMatchObject` 로 검증.
3. **(WARNING — 테스트 격리)** `jest.spyOn` + `afterEach(() => jest.restoreAllMocks())` 로 monkey-patch 패턴 대체.
4. **(WARNING — 유지보수성)** `CHECKPOINT_ELIGIBLE_NODE_TYPES` 상수 또는 `isCheckpointEligible()` 헬퍼로 노드 타입 가드 3중 중복 제거.
5. **(WARNING — 유지보수성)** `DEFAULT_IE_MAX_COLLECTION_RETRIES = 3` 상수 선언으로 매직 넘버 제거.
6. **(INFO — 문서화)** `buildResumeCheckpoint` / `buildRetryReentryState` JSDoc 에 IE 확장 내용 한 줄 추가.
7. **(INFO — 보안 심도)** `buildResumeCheckpoint` 에 `partialResult` 직렬화 크기 상한 가드 추가 검토.
8. **(INFO — 테스트)** `cpSubject()` 중복 호출 정리, `collectionRetryCount` 비숫자 입력 엣지 케이스 테스트, IE 노드 `schemaVersion: 999` 회귀 케이스 추가.

---

## 라우터 결정

라우터가 reviewer 를 선별 실행함 (`routing_status=done`).

- **실행 (강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` — 7명 (전원 router_safety 강제 포함)
- **제외**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router 판단 — 이번 변경 범위 해당 없음 |
| architecture | router 판단 — 이번 변경 범위 해당 없음 |
| dependency | router 판단 — 이번 변경 범위 해당 없음 |
| database | router 판단 — 이번 변경 범위 해당 없음 |
| concurrency | router 판단 — 이번 변경 범위 해당 없음 |
| api_contract | router 판단 — 이번 변경 범위 해당 없음 |
| user_guide_sync | router 판단 — 이번 변경 범위 해당 없음 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 목록과 동일)