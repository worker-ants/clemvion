# Rationale 연속성 검토 결과

## 검토 범위에 대한 전제 정정

프롬프트가 지정한 target(`spec/5-system/`, 실제 번들된 문서는 `1-auth.md`·`10-graph-rag.md`)은 이번 diff(`refactor-06-c2-followups`, commit `762a56078`)와 무관하다. 실제 변경 파일은:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- `plan/in-progress/refactor-06-c2-followups.md`

이 코드의 SoT spec 은 `spec/5-system/4-execution-engine.md`(§7.5 재개 진입 원자 claim, §8 active-running 세그먼트)이며, 번들에 포함되지 않았다. 아래 분석은 이 실제 SoT 문서의 `## Rationale` 을 직접 대조해 수행했다(경로: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md`). plan 파일도 `spec_impact: none` 을 명시하고 있어(순수 리팩터·테스트 보강) spec 변경 자체는 없다.

## 대조한 변경 내용

1. **W6** — `claimResumeEntry` 내부 짝-불일치 abort 판별을 매직스트링(`'__resume_claim_exec_terminal__'`) + 클로저 플래그(`execMismatch`)에서 `ResumeClaimExecTerminalError` 클래스 + `instanceof` 판별로 전환.
2. **W5** — `segmentStartMs.set(executionId, Date.now())` 로직을 `recordRunningSegmentStart()` 헬퍼로 추출해 `claimResumeEntry` 와 `updateExecutionStatus` RUNNING 진입 경로가 공유.
3. **W2** — `driveResumeAwaited` 의 RUNNING skip-guard에 대한 unit 테스트 추가(신규 동작 아님, 커버리지만 보강).
4. **W3** — 동시 재개(2건 병렬 `/continue`) e2e 테스트 추가.

## 발견사항

### INFO — 매직스트링→커스텀 에러클래스 전환은 Rationale 재작성 불필요, 기존 결정과 정합
- target 위치: `execution-engine.service.ts` L276-289 (`ResumeClaimExecTerminalError` 클래스), L887-919 (`claimResumeEntry` catch 판별)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "재개 race 보장을 DB 원자 claim 으로" (§7.5, 2026-07-02) — "claim 은 **단일 조건부 UPDATE**... claim 후 rehydration 프로세스 실패는 `RESUME_*` terminal 원자 마감... Execution 짝 UPDATE 가 terminal(동시 cancel 등)로 affected=0 이면 node claim 도 tx 롤백해 discard"
- 상세: 이 항은 "affected=0 → 트랜잭션 롤백 → discard(false)" 라는 **동작**만 규정하고, 그 롤백을 어떤 예외 타입으로 트리거하는지는 규정하지 않는다. 매직스트링 문자열 비교를 `instanceof` 판별로 바꾼 것은 동일 동작의 내부 구현 디테일 변경이며, §7.5 의 "단일 조건부 UPDATE + affected 판정 + tx 롤백 discard" 계약을 그대로 보존한다. 새 클래스의 JSDoc(L279-283)도 원 계약을 정확히 재서술하고 있어 문서와 코드가 어긋나지 않는다.
- 제안: 조치 불필요. 다만 코드 내 JSDoc 이 사실상 §7.5 Rationale 의 요약 역할을 하므로, 향후 §7.5 원문이 개정되면 이 JSDoc 도 함께 갱신 대상임을 유념(현재는 정합).

### INFO — `recordRunningSegmentStart` 추출은 §8/PR2a 문서화된 "공유 로직" 의도를 코드 차원에서 실현
- target 위치: `execution-engine.service.ts` L6894-6897 (`recordRunningSegmentStart` 정의), L928 (`claimResumeEntry` 호출부), L6922 (`updateExecutionStatus` 호출부)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)" (L1372-1374) 및 §4.2 "active-running 직렬화 불변식 (PR2a)" (L412)
- 상세: 기존 코드는 `claimResumeEntry` 와 `updateExecutionStatus` 양쪽에 `this.segmentStartMs.set(executionId, Date.now())` 를 중복 인라인했다(이미 PR #791 시점부터 두 경로가 §8 세그먼트 tracking 을 "공유"해야 한다는 것이 Rationale 전제였음). 이번 변경은 그 중복을 헬퍼로 묶어 "두 경로가 독립적으로 drift 하지 않도록" 만든 것으로, §8 의 기존 설계·불변식을 변경하지 않고 오히려 문서화된 의도(두 경로가 같은 세그먼트 tracking 규칙을 따라야 함)를 코드로 강제하는 방향이다. 새 JSDoc(L6890-6893)도 "claimResumeEntry(§7.5 원자 claim, choke point 우회)가 공유"한다고 정확히 명시해 §7.5/§8 교차 참조가 유지된다.
- 제안: 조치 불필요.

### INFO — W3 e2e 테스트의 "concurrency=1" 서술은 과거 기각된 대안을 재도입하지 않음
- target 위치: `execution-park-resume.e2e-spec.ts` 신규 테스트 "06 C-2 — 동시 재개(2 continue 병렬)..." 상단 주석
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "재개 race 보장을 DB 원자 claim 으로" — "기존 패턴의 일반화" 단락: "concurrency=1 전제 유지(대안)는... §7.4 가 예고한 상향 시점에 결국 본 변경이 필요해 비용이 이연될 뿐이라 기각"
- 상세: Rationale 은 "concurrency=1 이므로 race 가 없다"는 논리를 **기각된 대안**으로 명시한다. 신규 e2e 테스트 주석은 "단일 인스턴스·concurrency=1 이라 실 DB row-level 레이스는 조건부 UPDATE+affected 설계 보장"이라고 적어, 안전성의 귀속을 concurrency=1 이 아니라 "조건부 UPDATE+affected 설계"(즉 원자 claim)에 정확히 돌리고 있다. concurrency=1 언급은 "이 e2e 하네스가 실제 DB-level 동시 write race 를 재현하진 못한다"는 테스트 한계 고지일 뿐, 안전성 근거로 오용하지 않는다. 따라서 기각된 대안의 재도입이 아니다.
- 제안: 조치 불필요. (검토자 관점에서 이 구분이 미묘하므로 향후 유사 테스트 주석 작성 시에도 "concurrency=1 때문에 안전하다"가 아니라 "설계(원자 UPDATE) 때문에 안전하고, e2e 는 진입점 커버리지만 제공한다"는 프레이밍을 유지할 것을 권고.)

### 대조 결과: CRITICAL/WARNING 없음
- 기각된 대안 재도입: 없음 (위 INFO 참조 — 오히려 기각 논리를 정확히 피해감)
- 합의된 원칙 위반: 없음. §1.1 cross-entity 원자성(단일 트랜잭션 짝 전이), §7.5 claim 계약(affected 판정→discard), §8 세그먼트 공유 tracking 원칙 모두 그대로 보존.
- 결정의 무근거 번복: 없음. 두 변경(W6, W5) 모두 기존 결정의 **동작**을 바꾸지 않는 내부 리팩터이며 plan 자체도 `spec_impact: none` 로 스코프를 명시.
- 암묵적 가정 충돌: 없음. §4.2 "active-running 직렬화 불변식(PR2a)"이 전제하는 "동일 Execution 의 active 세그먼트는 항상 1개"라는 불변식을 건드리는 변경이 아니다(단순 헬퍼 추출).

## 요약
이번 diff(refactor-06-c2-followups, W2/W3/W5/W6)는 `spec/5-system/4-execution-engine.md` §7.5(재개 진입 원자 claim)·§8(active-running 세그먼트)에 기록된 기존 Rationale 의 **동작 계약을 변경하지 않는 순수 내부 리팩터 + 테스트 커버리지 보강**이다. 매직스트링→커스텀 에러클래스 전환, `segmentStartMs` 공유 헬퍼 추출, 그리고 신규 unit/e2e 테스트 모두 §7.5/§8 Rationale 이 이미 명시한 계약(단일 조건부 UPDATE, affected 판정 기반 discard, 두 경로의 세그먼트 tracking 공유, "concurrency=1 을 안전성 근거로 삼지 않는다")을 정확히 따르고 있으며, 오히려 W5는 문서화된 "두 경로 공유" 의도를 코드 차원에서 강제하는 방향으로 정합성을 강화한다. 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 다만 이번 검토 payload 의 target 범위(`spec/5-system/` 중 `1-auth.md`·`10-graph-rag.md`)가 실제 diff 와 무관해, 향후 동일 orchestrator 호출 시 diff 대상 코드의 SoT spec 파일(`4-execution-engine.md`)이 번들에 포함되도록 scope 매핑을 점검할 필요가 있다.

## 위험도
NONE
