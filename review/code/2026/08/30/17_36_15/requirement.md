# 요구사항(Requirement) 리뷰 — `updateExecutionStatus` else 분기 트랜잭션화

대상 커밋: `1a12088f2` (`fix(engine): 가드가 throw 해도 UPDATE 가 커밋된 채 남던 것 — 트랜잭션으로 롤백을 실제로 보장한다`)

## 발견사항

- **[SPEC-DRIFT] WARNING** spec 의 원자성 보장 문단이 이번에 추가된 else 분기 트랜잭션 래핑을 반영하지 않음
  - 위치: `spec/5-system/4-execution-engine.md:98` (`> **원자성 보장**: ...` 문단), 그리고 `spec/5-system/4-execution-engine.md:51-58` (2026-08-30 소급 각주)
  - 상세: §1.1 의 "원자성 보장" 인용 블록은 `linkedNodeExec`(짝 전이) 분기와 §7.5 재개 claim 의 트랜잭션 보장만 명시하고, else 분기(`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED` 직접 마감)의 guarded UPDATE 가 `dataSource.transaction` 안에서 도는지는 spec 에 전혀 언급이 없다. 또한 바로 위 "소급 각주 (2026-08-30)" 는 `8332d9a20`(2026-08-13)의 throw-기반 가드 수정만 서술하고 "DB 는 안 깨졌다" 로 마무리하는데, 실제로는 그 throw 가 **롤백을 부르지 못해**(트랜잭션 밖 단발 UPDATE) 이번 커밋 전까지 "가드가 발동한 순간 DB 는 terminal 인데 종결 이벤트는 안 나가고 stuck recovery 에도 안 잡히는" 새로운 무기한 대기 창이 있었다(`18_19_33` concurrency INFO 9, 코드 주석·커밋 메시지에 명시). 이 사실과 그 폐쇄(오늘 커밋)가 spec 각주에 반영돼 있지 않다.
  - 코드 구현 자체는 명백히 옳다 — 짝 전이 분기와 동일한 패턴(`dataSource.transaction` + `manager.query`)으로 맞췄고, 회귀 테스트 2건(롤백 축 + 공허 방지 축)과 뮤테이션 실측(RED 2/456 두 축 각각)까지 커밋 메시지에 기록돼 있다. 되돌릴 대상이 아니라 **spec 이 따라가야 할** 변경이다.
  - 제안: 코드는 그대로 유지. `project-planner` 경로로 `spec/5-system/4-execution-engine.md` 의 (1) §1.1 원자성 보장 인용문에 "else 분기 guarded UPDATE 도 트랜잭션 안에서 실행되어 shape 위반 throw 시 UPDATE 자체가 롤백된다"는 문장을 추가하고, (2) 2026-08-30 소급 각주에 "이 throw-기반 수정이 그 자체로는 롤백을 보장하지 못해(트랜잭션 밖 단발) 8332d9a20~1a12088f2 사이 무기한 대기 창이 있었고, `1a12088f2` 가 트랜잭션 래핑으로 닫았다" 는 후속 각주를 덧붙이는 것을 권고.

- **[INFO]** 프로덕션 노출 창(정보성, spec 정정과 별개)
  - 위치: 커밋 메시지 / `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `18_19_33` INFO 9 항목
  - 상세: `8332d9a20`(2026-08-13, throw 도입)부터 `1a12088f2`(2026-08-30, 트랜잭션 래핑)까지 약 17일간, else 분기 shape 위반 시 "이미 커밋된 UPDATE + 미발행 종결 이벤트 + stuck recovery 미포착"의 창이 이론상 열려 있었다(이 shape 위반 자체가 정상 운영에서 거의 발생하지 않는 방어적 가드라 실제 트리거 여부는 불명). 코드 fix 대상은 아니며, 필요시 그 기간의 운영 로그에서 실제 트리거 여부만 확인 권고.

## 코드 검증 상세 (참고 — 결함 아님)

- `execution-engine.service.ts:8691-8727`(else 분기)이 기존 `this.executionRepository.query(...)` 단발 호출을 `this.dataSource.transaction(async (manager) => { ... manager.query(...) ... })` 로 옮겼다. shape 위반 시 `updateReturningRows` 가 throw → transaction 콜백이 reject → TypeORM 이 ROLLBACK 후 rethrow → `updateExecutionStatus` 자체가 reject. 짝 전이(`linkedNodeExec`) 분기(`execution-engine.service.ts:8625-8652`)와 `lockNonTerminalExecutionRow`(`:8371-8393`)가 이미 쓰던 `manager.query` 패턴과 형태가 일치한다.
- `emitTerminalExecutionMetrics` 호출(`:8732`)은 트랜잭션 완료 이후에 위치해 throw 경로에서는 도달하지 않는다 — 롤백된 쓰기에 대해 메트릭이 발생하지 않는다는 점에서 올바르다.
- `updateExecutionStatus` 의 다른 호출부 11곳(`:652, 2309, 2409, 2485, 2574, 3569, 4307, 4432, 4755, 4893, 5014`)을 확인한 결과 어느 것도 자신이 이미 `dataSource.transaction` 콜백 안에서 호출되고 있지 않아, 이번 변경으로 인한 중첩 트랜잭션 위험은 관측되지 않았다.
- 테스트(`execution-engine.service.spec.ts:274-293`)의 `mockTxManagerQuery` 가 `UPDATE execution` SQL 을 `mockExecutionRepo.query` 로 위임하도록 바뀌어, 프로덕션 배선이 `executionRepository.query` → `manager.query` 로 이동했음에도 기존 수십 개 테스트의 `mockExecutionRepo.query` 단언·`mockResolvedValueOnce` 무장이 그대로 유효하다(예: `:1007` `finalizeFailedExecution` 테스트의 `expect(mockExecutionRepo.query).toHaveBeenCalledWith(...)`).
- 신규 테스트 2건(`execution-engine.service.spec.ts:4806-4858`)이 (a) 트랜잭션이 실제로 열렸는가, (b) UPDATE 가 트랜잭션 manager 를 경유했는가(롤백 축) — 그리고 정상 경로도 동일 배선인가(공허 방지 축)를 각각 독립적으로 고정한다. 두 테스트 모두 vacuous 하지 않음을 확인: shape-violation mock(`undefined`)과 정상 shape mock(`[[{id}],1]`)이 명확히 다른 입력을 사용해 각 분기를 실제로 가른다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/update-returning-tuple-shape.md` 의 체크박스·서술 변경은 실제 커밋 내용과 일치하며(“완료 (2026-08-30)” 표기, 취소선 처리로 원문 보존), 앞서 확인한 CLAUDE.md 의 plan 위생 규약도 위반하지 않는다.
- TODO/FIXME/HACK/XXX 류 미완성 표식은 diff 전체에서 발견되지 않음.

## 요약

`updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction`/`manager.query` 로 감싸, shape 위반 throw 가 실제로 UPDATE 를 롤백하도록 고친 변경이다. 짝 전이 분기와 동일한 기존 패턴을 재사용했고, 롤백 축·공허 방지 축을 각각 겨냥한 회귀 테스트 2건과 뮤테이션 실측(두 축 모두 RED 2/456)까지 커밋에 근거로 남아 있다. 기존 테스트 mock 을 프로덕션 배선 변경에 맞춰 위임 구조로 재설계해 수십 개 기존 단언을 깨지 않으면서 "트랜잭션 경유 여부"를 별도로 검증 가능하게 만든 점도 견고하다. 유일한 발견은 코드 결함이 아니라 spec 갱신 누락(SPEC-DRIFT) — `spec/5-system/4-execution-engine.md` 의 원자성 보장 문단·소급 각주가 이번에 닫힌 트랜잭션 갭을 아직 반영하지 않았다.

## 위험도

LOW
