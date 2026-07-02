# Cross-Spec 일관성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상: `spec/5-system/4-execution-engine.md`
작성 시각: 2026-07-01

---

## 발견사항

### 발견사항 없음 (CRITICAL / WARNING 없음)

### [INFO] NodeHandlerOutput.status 는 `string` 으로 선언되나 §1.3 에 구체 값이 명세됨

- target 위치: `spec/5-system/4-execution-engine.md §5.1` — `status?: string`
- 충돌 대상: 동일 문서 §1.3 블로킹/재개 컨트랙트 표 (`waiting_for_input` / `resumed` / `ended` / `requires_integration` / `requires_playwright`), `spec/conventions/node-output.md` Principle 4
- 상세: §5.1 의 TypeScript 인터페이스는 `status?: string` (자유 문자열)으로 정의되어 있으나, §1.3 은 취할 수 있는 값을 5개 리터럴로 열거한다. 두 선언이 모순(런타임 동작 불일치)은 아니지만, M-7 이 dispatch boundary 에 explicit 타입 가드/인터페이스를 도입할 때 `status` 필드를 `string` 그대로 유지하면 §1.3 의 계약이 코드 레벨에서 검증되지 않는다. node-output conventions Principle 4 도 동일 값 집합을 정의한다.
- 제안: M-7 구현 시 `NodeHandlerOutput.status` 를 `'waiting_for_input' | 'resumed' | 'ended' | 'requires_integration' | 'requires_playwright' | undefined` 유니온으로 좁히는 것이 §1.3 및 node-output conventions 와 자연 정렬된다. 이는 spec 변경 없이 코드 레벨 강화로 충분하며, M-7 plan 의 "spec 갱신: 불요" 원칙과 일치한다.

---

### [INFO] `information_extractor` 체크포인트 추가 필드(`partialResult`/`collectionRetryCount`)가 information extractor spec 에 명시적 교차 참조 없음

- target 위치: `spec/5-system/4-execution-engine.md §1.3` — "ai_agent · information_extractor 멀티턴 노드" checkpoint allow-list
- 충돌 대상: `spec/4-nodes/3-ai/` 의 `information-extractor` 관련 문서 (allow-list 에 `partialResult`/`collectionRetryCount` 필드 정의 출처)
- 상세: 실행 엔진 §1.3 은 `_resumeCheckpoint` allow-list 로 `information_extractor` 가 `partialResult` · `collectionRetryCount` 를 추가한다고 명시하나, 이 필드들이 information extractor 노드 spec 에서 역방향으로 cross-link 되는지 확인되지 않았다. 직접 모순은 아니나, M-7 이 `_resumeCheckpoint` 를 explicit TypeScript 인터페이스로 모델링할 때 두 필드의 타입/의미를 information extractor spec 에서 별도 확인 후 인터페이스에 반영해야 한다.
- 제안: M-7 구현 착수 시 `spec/4-nodes/3-ai/` 의 information extractor 문서에서 `partialResult` / `collectionRetryCount` 의 타입 정의를 확인하여 실행 엔진 §1.3 의 allow-list 와 정합을 확인한다. spec 변경은 불요 — 코드 레벨 타입 선언 작성 시 참조 문서로만 활용.

---

### [INFO] plan 레벨 `D6` 레이블 동명 충돌 — 이미 spec 내 경고 명시

- target 위치: `spec/5-system/4-execution-engine.md §7.5` — "레이블 주의: 본 절의 `exec-park D6` 는 ... AI 노드 spec의 동명 `D6`(AI 노드 output 경로 단일화)와 **무관**하다."
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `D6` (AI 노드 output 경로 단일화 결정)
- 상세: 동명 `D6` 레이블이 두 도메인(exec-park durable resume 결정 vs AI 노드 output 단일화 결정)에 사용되고 있다. 이미 실행 엔진 spec §7.5 에서 경고가 명시되어 있어 모순은 없다. 추가 조치 불요.
- 제안: 현행 유지.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 `spec/conventions/node-output.md`(Principle 0/4/7), `spec/1-data-model.md`(Execution·NodeExecution·엔티티 필드), `spec/4-nodes/3-ai/1-ai-agent.md`(\_resumeState/\_resumeCheckpoint/\_retryState 형상) 등 관련 영역과 구조적으로 정합하다. CRITICAL 또는 WARNING 수준의 직접 모순은 발견되지 않았다. M-7(타입 단언 → 타입 가드 전환)은 spec 변경 없이 구현 가능하며("spec 갱신: 불요"), 도입할 explicit 인터페이스는 §1.3/§5.1/node-output conventions 에 이미 기술된 형상을 코드 레벨에서 구체화하는 것이므로 cross-spec 충돌이 없다. 위 INFO 3건은 M-7 구현 시 타입 선언 범위를 정밀하게 결정할 때 참고할 동기화 권장 사항이다.

## 위험도

NONE
