# 요구사항(Requirement) 리뷰 결과

리뷰 대상: PR-A3 — user-defined variables durable park 영속 + rehydration 복원
커밋: `18fc07f7b2ec5afea3d0635f396e0b088b3c47e7`

---

## 발견사항

### [INFO] 기능 완전성 — 3개 park 지점 모두 갱신 완료
- 위치: `execution-engine.service.ts` L3505, L5115, L6092
- 상세: `stageConversationThreadSnapshot` 호출 3곳이 모두 `stageDurableResumeSnapshot` 으로 교체됨. `grep` 으로 구 메서드 잔존 참조 없음 확인. park 지점 누락 없음.
- 제안: 없음.

### [INFO] 기능 완전성 — rehydrateContext fast-path 분기 점검
- 위치: `execution-engine.service.ts` L1236-1237
- 상세: `rehydrateContext` 진입 시 `this.contextService.getContext(execution.id)` 가 존재하면 즉시 반환(fast-path). 이 경로는 user variables 를 추가로 머지하지 않는다. fast-path 는 동일 인스턴스의 in-memory context 가 살아있는 경우이므로, 이미 park 이전 변수가 메모리에 존재해 문제없다. 설계 의도와 일치.
- 제안: 없음.

### [INFO] 엣지 케이스 — `rehydrateUserVariables` 방어적 정규화 충분
- 위치: `execution-engine.service.ts` L8625-8630
- 상세: `null`/비객체 → `{}` 반환, 방어적 `__*` 키 제거 — 두 경로 모두 단위 테스트에서 커버됨 (spec 파일 L253-259). Array 입력(`[]`)에 대해서는 `typeof [] === 'object'` 가 true 이므로 `Object.entries([])` 를 순회하면 인덱스 키(`'0'`, `'1'` 등)가 유출될 수 있다. 그러나 JSONB 칼럼 저장 시 배열 형태의 user_variables 는 이론적으로 발생하기 어렵고(`stageDurableResumeSnapshot` 은 항상 `Record<string, unknown>` 으로 저장), 실 운영 회귀를 유발하지 않는다.
- 제안: `Array.isArray(raw)` 체크를 추가해 배열 입력을 명시적으로 `{}` 로 분기하면 방어 층이 더 견고해진다. 현재 운영상 위험은 낮아 INFO 수준.

### [INFO] 의도와 구현 — `stageDurableResumeSnapshot` 의 `variables` 얕은 복사
- 위치: `execution-engine.service.ts` L8612-8615
- 상세: `for...of Object.entries(context.variables)` 로 얕은 필터 복사를 수행한다. `cloneThread` 와 달리 깊은 복사를 하지 않는다. JSDoc 주석(L8610)에 "stage→save 가 동기 연속이라 얕은 필터로 충분(중간 mutation 없음)"이라고 명시되어 설계 의도가 문서화됨. spec §6.2 에도 별도 deep-copy 요건 없음. 일치.
- 제안: 없음.

### [INFO] spec fidelity — `spec/5-system/4-execution-engine.md §6.1` variables 행 일치
- 위치: `spec/5-system/4-execution-engine.md` L670
- 상세: spec §6.1 표: "park 시 시스템 `__*` 제외 사용자분이 `Execution.user_variables`(V085)에 durable commit 되고 rehydration(§7.5)이 복원" — 구현(`stageDurableResumeSnapshot` 의 `__*` 제외 필터 + `rehydrateContext` 의 spread 순서)과 line-level 일치.
- 제안: 없음.

### [INFO] spec fidelity — `spec/5-system/4-execution-engine.md §6.2` park commit 항목 (d) 일치
- 위치: `spec/5-system/4-execution-engine.md` L729 (d) 항목
- 상세: spec §6.2: "`context.variables` 중 시스템 `__*` 제외 사용자 정의분을 `Execution.user_variables jsonb`(V085)에 durable commit" — `stageDurableResumeSnapshot` 구현과 일치.
- 제안: 없음.

### [INFO] spec fidelity — `spec/5-system/4-execution-engine.md §7.5` rehydration 시퀀스 일치
- 위치: `spec/5-system/4-execution-engine.md` L887-888
- 상세: spec §7.5 rehydration 시퀀스: "Execution.user_variables 컬럼에서 사용자 정의 variables 복원 (시스템 `__*` 제외분 — §6.2 park commit, §6.1)" — `rehydrateContext` 의 `...this.rehydrateUserVariables(execution.userVariables)` spread (user vars 먼저, 이후 `__*` 재주입) 와 일치.
- 제안: 없음.

### [INFO] spec fidelity — `spec/1-data-model.md §2.13` Execution 컬럼 행 일치
- 위치: `spec/1-data-model.md` L466
- 상세: spec §2.13: `user_variables | JSONB? | NULL 허용 (V085). waiting_for_input park 진입 시 ExecutionContext.variables 중 시스템 __* 제외 사용자 정의분을 commit...` — migration V085 `ADD COLUMN user_variables JSONB NULL` 및 entity `@Column({ name: 'user_variables', type: 'jsonb', nullable: true })` 와 field명·타입·nullable 모두 일치.
- 제안: 없음.

### [INFO] spec fidelity — `__*` override 충돌 방어 순서 spec 침묵 영역
- 위치: `execution-engine.service.ts` L1261-1269 (initialVariables spread 순서)
- 상세: user vars 를 먼저 spread 하고 이후 `__workspaceId` 등 시스템 `__*` 를 덮어쓰는 순서. spec §7.5 시퀀스 본문은 이 spread 순서를 명시하지 않으며, §6.1/§6.2 도 마찬가지. 구현 주석(L1259: "user vars 를 먼저 펼쳐 충돌 시 `__*` 가 이긴다")이 의도를 명확히 설명. spec 이 침묵하는 구현 세부사항이므로 INFO.
- 제안: 없음.

### [INFO] 테스트 커버리지 — `rehydrateContext` fast-path(context 캐시 히트) 미커버
- 위치: `execution-engine.service.spec.ts` 추가 테스트 블록
- 상세: 추가된 테스트 4개는 slow-path(`contextService.deleteContext` 호출 후) 를 전제로 한다. fast-path(getContext 히트)에서 user variables 가 별도 적용되지 않는 동작은 테스트되지 않는다. 설계 상 fast-path 는 기존 context 를 그대로 반환하므로 park 이전 값이 이미 메모리에 있어 정확하다. 테스트 누락이 버그를 숨기지는 않는다.
- 제안: 없음. fast-path 가 기존 context 를 그대로 반환하는 것이 의도임을 명시하는 주석이 있으면 충분.

---

## 요약

PR-A3 는 spec `4-execution-engine §6.1/§6.2/§7.5` 와 `1-data-model §2.13` 에서 정의한 user_variables durable park 요구사항을 완전히 구현했다. migration(V085 JSONB NULL), 엔티티 컬럼, 3개 park 지점의 원자적 스냅샷 commit(`stageDurableResumeSnapshot`), rehydration 복원(`rehydrateUserVariables` + `rehydrateContext` spread 순서), 테스트 4종 모두 spec 본문과 line-level 로 일치한다. 엣지 케이스(NULL, 비객체, `__*` 충돌) 처리가 명시적으로 구현·검증되어 있으며 TODO/FIXME/HACK 주석도 없다. Array 입력에 대한 방어 및 fast-path 테스트 부재가 INFO 수준으로 관찰되나, 운영 회귀를 유발하지 않는다. spec 불일치(코드가 틀림) 또는 SPEC-DRIFT(코드가 맞고 spec 갱신 필요) 항목은 없다.

---

## 위험도

NONE
