# 변경 범위(Scope) 리뷰 결과

검토 대상: workflow-resumable-execution Phase 2 cont (worktree `workflow-resumable-execution-phase2-cont-64f537`)
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] 파일 2 (`continuation-bus.service.ts`) — 포맷팅 전용 변경

- 위치: `continuation-bus.service.ts` diff, `on()` 메서드 시그니처 (line 540–544)
- 상세: `on(_type, _handler)` 시그니처를 3줄로 줄바꿈한 것 외에 로직 변경이 없다. 이 변경 단독으로는 포맷팅(Prettier 스타일) 조정에 해당한다. Phase 2 cont 의 BullMQ 전환 목적과 직접 관계는 없으나, 동일 파일 내 다른 실질 변경 없이 포맷팅 라인만 포함됐다. 실질 범위 밖이지만 의미 변경이 없어 해가 없다.
- 제안: 단독 포맷팅 커밋 또는 실질 변경과 분리해 관리하면 diff noise 를 줄일 수 있다. 차단 불필요.

---

### [INFO] 파일 3 (`continuation-execution.processor.ts`) — `applyCancellation` await 제거 + 포맷팅

- 위치: `continuation-execution.processor.ts` diff, `case 'cancel':` 분기 (line 587–589)
- 상세: `await this.engine.applyCancellation(executionId)` 를 `this.engine.applyCancellation(executionId)` (await 없음) 으로 변경하면서 인라인 주석 `// applyCancellation 은 sync (rejectPending 만 호출) — await 불필요.` 을 추가했다. 이는 Phase 2 cont 의 메인 목표(BullMQ 기반 큐 전환 / 테스트 회귀 수정 / rehydration 구현 / WS ack 확장)와 직접 명시된 작업은 아니나, BullMQ Worker 경로에서 `cancel` dispatch 정확성에 영향을 미치는 동작 변경이다. `applyCancellation` 이 실제로 sync 인지 여부가 잘못 판단됐다면 silent fire-and-forget 이 될 수 있다. `plan/in-progress/workflow-resumable-execution.md` 에는 이 변경이 별도 체크박스 항목으로 명시되어 있지 않다.
- 제안: `applyCancellation` 의 반환 타입과 내부 구현을 확인해 실제로 반환값이 없는 void sync 메서드인지 검증 필요. await 제거는 범위 내라고 볼 수 있으나, plan 에 명시되지 않은 동작 변경이므로 코멘트가 필요하다. 동일 파일의 함수 인자 줄바꿈(포맷팅)은 별도 부수적 변경이다.

---

### [INFO] 파일 4 (`execution-engine.service.spec.ts`) — `getPendings` 헬퍼 위치 이동

- 위치: `execution-engine.service.spec.ts` diff, line 629–642 (신규 `const getPendings`) vs 구 line 844–856 (삭제된 `const getPendings`)
- 상세: 기존 코드에서 `getPendings` 헬퍼와 `findHandler` 헬퍼가 describe 블록 **안쪽**에 정의되어 있던 것을 신규 코드에서는 `describe` 블록 앞(바깥)으로 이동했다. `findHandler` 는 bus.on 기반 테스트와 함께 완전 삭제된 것이 맞다. `getPendings` 의 위치 변경은 Phase 2 BullMQ 전환 후 여러 it 블록에서 공유되도록 리팩토링된 것으로, W8 (SUMMARY) 코멘트가 이를 의도적으로 설명하고 있다. 의도된 리팩토링이지만 plan 의 명시적 항목은 "테스트 회귀 14건 fix" 로 포괄된다.
- 제안: 의도된 정리로 판단. 차단 불필요.

---

### [INFO] 파일 4 (`execution-engine.service.spec.ts`) — Phase 2.7 통합 시나리오 단위 테스트 선행 추가

- 위치: `execution-engine.service.spec.ts` diff, line 960–1093 (Phase 2.7 rehydration 통합 시나리오)
- 상세: plan 에서 2.7 은 "testcontainers 통합 e2e — 진행 중" 으로 남아 있으나, 본 diff 에는 단위 테스트 수준의 rehydration 통합 시나리오가 `execution-engine.service.spec.ts` (unit spec) 에 추가됐다. 이는 엄밀히 e2e 가 아니라 mock 기반 unit 시나리오이며, 파일 성격상 unit test 파일에 통합 시나리오가 섞이는 것이 의도한 범위인지 불명확하다. 그러나 plan 의 2.7 설명("in-memory resolver 강제 제거 후 BullMQ worker pick up → rehydration → workflow 정상 완료")을 unit 레벨에서 검증하는 것으로 해석할 수 있다.
- 제안: plan 의 2.7 표기가 "testcontainers e2e" 를 의미한다면 이 단위 테스트는 사전 보조 검증이며, 별도 e2e 가 여전히 필요하다는 점을 plan 에 명확히 표시할 것을 권장. 차단 불필요.

---

### [INFO] 파일 8 (`spec-update-workflow-resumable-execution-phase2-followup.md`) — plan 신규 생성 by developer

- 위치: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` (신규 파일)
- 상세: CLAUDE.md skill 체계상 `spec/` 변경 권한은 `project-planner` 에게 있으며, `developer` 는 구현 중 spec 변경이 필요하면 멈추고 `project-planner` 에 위임해야 한다. 본 파일은 spec 을 직접 수정하지 않고 spec 변경 제안을 plan 파일로 작성해 project-planner 에게 위임하는 형태이므로, `developer` 가 `plan/**` 에 쓰는 것은 권한 내다. spec 자체는 수정하지 않았다. 이 접근 방식은 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규약을 올바르게 따른 것으로 판단된다.
- 제안: 차단 불필요. 다만 `owner: project-planner` 로 정확히 표기되어 있는지 확인 — diff 기준 `owner: project-planner` 로 올바르게 기재됨.

---

### [INFO] 파일 10–17 (consistency review 산출물) — review/ 하위 신규 파일

- 위치: `review/consistency/2026/05/25/07_12_25/` 하위 7개 파일 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: 이 파일들은 CLAUDE.md 가 정의한 "구현 착수 직전 `consistency-check --impl-prep` 의무" 의 산출물이다. developer 는 spec 변경 전 consistency-check 를 수행해야 하며, 그 결과는 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 저장된다. 리뷰 대상 코드 변경의 직접적인 구현 파일은 아니나, 프로세스 요구에 의해 필연적으로 생성되는 파일이다. 변경 범위 밖 파일로 볼 수 있으나 규약상 의무 산출물이므로 정상이다.
- 제안: 차단 불필요.

---

### [WARNING] 파일 3 (`continuation-execution.processor.ts`) — `applyCancellation` 의 await 제거가 동작 변경일 수 있음

- 위치: `continuation-execution.processor.ts` diff line 587–589
- 상세: `case 'cancel':` 분기에서 `await this.engine.applyCancellation(executionId)` 를 `this.engine.applyCancellation(executionId)` 로 변경했다. 주석은 "sync (rejectPending 만 호출)"이라 하지만, `applyCancellation` 이 내부적으로 DB 저장(`save`, `update`) 등 async 작업을 포함하는 경우 Worker 는 job 을 완료로 처리한 후 DB 작업이 이후 처리되거나 누락될 수 있다. 이는 BullMQ job ack 타이밍과 실제 취소 완료 사이의 race condition 을 낳을 수 있다. plan 항목에 명시되지 않은 변경이다.
- 제안: `applyCancellation` 의 시그니처(void vs Promise<void>)와 구현을 즉시 확인해야 한다. async 작업이 포함되어 있다면 `await` 복구가 필요하다. 이 검증 없이 병합하면 취소 처리의 신뢰성 회귀 가능성이 있다.

---

## 요약

전체 변경은 workflow-resumable-execution Phase 2 cont 의 핵심 목표(테스트 회귀 수정, Phase 2.3a rehydration 구현, Phase 2.5 WS ack 확장, Phase 2.7 단위 수준 통합 검증)에 충실하게 집중되어 있다. 범위 외 변경으로 볼 수 있는 항목은 `continuation-bus.service.ts` 의 포맷팅 전용 라인과 `continuation-execution.processor.ts` 의 `applyCancellation` await 제거 두 가지다. 후자는 plan 에 명시되지 않은 동작 변경으로 `applyCancellation` 의 실제 async 여부에 따라 취소 처리 race condition 을 유발할 수 있어 WARNING 으로 분류했다. consistency review 산출물(`review/consistency/` 하위 파일)과 plan 파일 갱신·신규 생성은 모두 프로세스 규약에 따른 정상 산출물이다. 전반적으로 범위 일탈 수준은 낮다.

---

## 위험도

LOW
