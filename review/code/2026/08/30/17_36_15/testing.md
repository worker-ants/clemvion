# 테스트(Testing) 리뷰 — `raw-update-guard-scope-0e154c`

## 범위 및 검증 방법

대상은 `updateExecutionStatus` else 분기(non-`linkedNodeExec`)의 guarded UPDATE 를
`dataSource.transaction` 으로 감싼 변경(`execution-engine.service.ts`)과 그에 대한
회귀 테스트 2건 신설(`execution-engine.service.spec.ts`), 그리고 두 plan 문서의
체크박스/서술 갱신이다.

코드 리뷰 외에 직접 뮤테이션 검증을 수행했다(저장소 밖 scratch 에 원본을 `cp` 로 백업 →
저장소 파일을 임시로 고쳐 RED 확인 → `cp` 로 원복 → `git status --short` 로 클린 확인,
`git checkout`/`restore` 미사용):

1. **뮤턴트 1 — 트랜잭션 제거**(else 분기를 트랜잭션 밖 단발 `this.executionRepository.query`
   호출로 되돌림). `tsc --noEmit` 통과(유효한 뮤턴트). 결과: 신규 두 테스트만 **RED 2**
   (`shape 위반 throw 가 트랜잭션 밖으로 나간다 — UPDATE 가 롤백된다`,
   `정상 경로도 트랜잭션 manager 를 경유한다 — 위 롤백 테스트가 공허하지 않다`), 기존 스위트는 GREEN 유지.
   → plan(`backend-lint-gate-broken-on-main.md`)이 기록한 "RED 2(신규 둘만)" 실측과 일치.
2. **뮤턴트 2 — 트랜잭션 콜백 안에서 throw 를 삼킴**(`try/catch` 로 `persisted=false` 대체).
   `tsc --noEmit` 통과. 결과: `shape 위반 throw…` 테스트가 RED(`.rejects.toThrow()` 가
   resolved 로 판정), throw-전파 축이 실제로 물린다.
3. 두 뮤턴트 모두 원복 후 전체 스펙 재실행 — **456 passed / 456**(원본 상태, 회귀 없음).
   `git status --short` 로 워킹트리 클린 확인(리뷰 산출물 디렉터리 외 잔여물 없음).

두 신규 테스트는 **등가 뮤턴트가 아니라 실제로 판별력이 있다** — vacuous 테스트가 아님을 실측으로 확인했다.

## 발견사항

- **[INFO]** "UPDATE 가 롤백된다" 라는 테스트 이름/의도가 실제로 검증하는 범위보다 넓게 읽힐 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4806` (`it('shape 위반 throw 가 트랜잭션 밖으로 나간다 — UPDATE 가 롤백된다', ...)`)
  - 상세: 이 테스트는 (a) `dataSource.transaction` 호출 여부, (b) UPDATE 가 트랜잭션 manager(`manager.query`)를 경유했는지, (c) throw 가 트랜잭션 콜백 밖으로 전파되는지만 mock 으로 확인한다. 실제 Postgres 가 트랜잭션을 **커밋하지 않고 되돌렸는지**(진짜 ROLLBACK)는 mock 에는 "되돌릴 상태" 자체가 없어 이 unit 테스트로는 원천적으로 증명 불가능하다 — TypeORM 이 throw 시 `queryRunner.rollbackTransaction()` 을 호출한다는 것은 프레임워크 계약을 신뢰하는 부분이다. 다행히 테스트 바로 위 JSDoc(4793~4805줄)이 "축은 두 개다: (a)(b)" 라고 정확히 범위를 명시해 두어 실질적인 오도는 아니다 — 다만 테스트 **이름**만 보면 실제 DB 롤백까지 검증한다고 오해할 여지가 있다.
  - 제안: 테스트 이름을 "…UPDATE 가 트랜잭션 manager 를 경유하고 throw 가 콜백 밖으로 전파된다(롤백 전제조건)" 처럼 범위를 좁혀 이름 자체가 과대주장하지 않게 하거나, 최소한 이름에 "(mock 경계 — 실 롤백은 TypeORM 계약에 위임)" 같은 캐버트를 덧붙이면 다음 사람이 "이미 e2e 급으로 검증됐다" 고 오판할 위험이 줄어든다.

- **[INFO]** 실제 Postgres 로 이 특정 롤백 경로(shape 위반 → UPDATE 되돌림)를 검증하는 e2e/integration 테스트가 없다
  - 위치: `codebase/backend/test/` 전체(관련 후보 `execution-concurrency-cap.e2e-spec.ts`, `node-cancellation-propagation.e2e-spec.ts` 확인 — 둘 다 `updateExecutionStatus` 의 정상/0행 경로는 실 DB 로 덮지만, 트랜잭션 콜백 내부에서 **driver 가 비배열을 반환하는 shape 위반**을 실 DB 로 재현하는 테스트는 없음)
  - 상세: shape 위반은 드라이버/버전 불일치로만 발생하므로 실 DB 로 인위 재현이 어렵다(드라이버 mock 이 필요) — 그래서 unit 레벨 검증에 그친 것은 실용적으로 합리적인 선택이다. 다만 이 경계가 문서화돼 있지 않으면 "회귀 테스트 2건으로 롤백을 확정했다" 는 인식이 다음 사람에게 그대로 전파될 수 있다(이 저장소가 이미 "문서한 보장이 구현보다 넓으면 안 된다" 를 반복 학습한 이력이 있음).
  - 제안: plan 문서(`backend-lint-gate-broken-on-main.md` §해당 항목)에 "실 DB ROLLBACK 자체는 TypeORM 계약에 의존하며 이 PR 은 mock 경계까지만 검증했다" 는 한 줄 caveat 추가를 고려. 코드 변경은 불필요.

- **[INFO]** 신규 두 테스트가 놓인 `describe` 블록 이름이 테스트 내용과 무관하다(가독성)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4491` — `describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)', () => { ... })` 안에 `updateExecutionStatus` 관련 shape/트랜잭션 테스트들(기존 4780번대 포함, 신규 4806·4836)이 함께 들어 있다.
  - 상세: 이 배치는 이번 diff 가 새로 만든 문제가 아니라 기존 패턴(이미 그 describe 안에 `updateExecutionStatus` "배열이 아니면 던진다" 등 여러 테스트가 있었음)을 그대로 이어받은 것이다. 다만 신규 테스트 2건이 추가되며 그 불일치가 한 겹 더 쌓였다 — 새 리더가 "admission/queue-wait-timeout 스펙" 을 찾다가 `updateExecutionStatus` 트랜잭션 테스트를 못 찾을 수 있다.
  - 제안: 급하지 않음(동작에 영향 없음). 다음에 이 영역을 손댈 때 `describe('updateExecutionStatus — guarded UPDATE shape/트랜잭션', ...)` 같은 하위 `describe` 로 분리 권장.

- **[INFO]** `execution.status = newStatus` 대입이 트랜잭션(가드) 통과 여부와 무관하게 트랜잭션 시작 **전에** 무조건 실행된다 — 신규 테스트가 이 지점을 커버하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8670`(`execution.status = newStatus;`, 트랜잭션 블록 8692~8727 진입 전)
  - 상세: 이번 diff 가 도입한 것이 아니라 기존부터 있던 배치(변경 전 코드에서도 UPDATE 호출 전에 있었음)라 이 diff 의 회귀는 아니다. 다만 트랜잭션/롤백이라는 이번 변경의 주제와 맞물려 재검토해볼 가치가 있다: shape 위반으로 throw 되어 함수 전체가 reject 되면 `execution`(인자로 받은 객체) 은 이미 `status = newStatus` 로 오염된 채로 예외가 올라간다. 호출자가 catch 후 이 stale 객체의 `.status` 를 계속 쓰는 경로가 있는지, 있다면 그 오염이 관측되는지를 검증하는 테스트는 없다(신규 두 테스트는 함수 자체의 reject/트랜잭션 배선만 본다).
  - 제안: 필수는 아님 — 프로덕션에서 shape 위반은 드라이버 버그급 이벤트라 실제 발생 가능성은 낮다. 다만 회귀 가드를 더 좁히고 싶다면, `updateExecutionStatus` 가 reject 한 뒤 인자로 넘긴 `execution` 객체의 `.status` 값이 어떻게 되는지 명시적으로 문서화(또는 테스트)해 두면 향후 호출부 변경 시 오해를 줄일 수 있다.

## 잘 된 점 (참고)

- 신규 두 테스트는 뮤테이션 검증으로 **비어있지 않음(non-vacuous)**을 확인했다 — 트랜잭션 제거 뮤턴트에 정확히 그 2건만 RED, throw-삼킴 뮤턴트에 롤백 테스트가 RED.
- "정상 경로도 트랜잭션 manager 를 경유한다" 테스트는 "throw 경로만 트랜잭션을 타는" 형태의 등가 코드를 배제하기 위해 의도적으로 추가된 대조 테스트로, 목적이 docstring 에 명시돼 있고 실제로 그 역할을 한다.
- `mockTxManagerQuery` 가 `UPDATE execution` SQL 을 기존 `mockExecutionRepo.query` mock 에 **위임**하는 설계는, 위임 시점에 `mockExecutionRepo.query` 프로퍼티를 매 호출마다 다시 읽으므로(클로저에 고정 바인딩하지 않음) 개별 테스트가 `mockExecutionRepo.query = jest.fn(...)` 로 재무장해도 정확히 반영된다 — stale 클로저 함정을 피한 좋은 패턴이다. 이 위임 덕분에 기존 else-분기 테스트 수십 개가 트랜잭션 배선 변경 후에도 전부 GREEN 을 유지한다(직접 실행: 456/456 passed).
- 테스트 격리: 모든 mock 이 `beforeEach` 에서 매번 새로 생성되고 `TestingModule` 도 매 테스트 재컴파일되므로 두 신규 테스트를 포함해 테스트 간 상태 누수가 없다. `txCallsBefore` 상대값 비교, `mockTxManagerQuery.mockClear()` 는 절대값 가정을 피하는 방어적 습관으로 무해하다.
- 테스트 가독성: 각 테스트 앞 JSDoc/주석이 "왜 이 테스트가 필요한가"(4193~4805줄)와 "무엇을 고정하는 축인가"((a)(b))를 명시해 의도가 분명하다.
- plan 문서(파일 3·4)의 서술 갱신은 실제 코드·테스트 상태와 일치한다(직접 대조 확인) — "완료" 표기가 실측을 앞서가는 이 저장소의 반복 결함 패턴이 이번엔 재현되지 않았다.

## 요약

핵심 변경(`updateExecutionStatus` else 분기의 트랜잭션 래핑)에 대한 회귀 테스트 2건은 뮤테이션 검증 결과 실질적 판별력을 가지며(등가/vacuous 아님), 기존 456개 테스트 전체가 트랜잭션 배선 변경 후에도 회귀 없이 GREEN 을 유지하는 것을 직접 실행으로 확인했다. mock 위임 설계도 stale 참조 문제를 피해가는 좋은 패턴이다. 남은 이슈는 전부 INFO 수준으로, (1) "롤백" 이라는 테스트 이름이 실제로 mock 경계 내에서만 검증 가능한 범위(트랜잭션 경유+throw 전파)보다 넓게 읽힐 수 있다는 점, (2) 그 경계 밖(실 DB ROLLBACK)을 닫는 e2e 가 구조적으로 어렵다는 점의 미문서화, (3) 신규 테스트가 내용과 무관한 기존 `describe` 블록에 계속 얹혀 가독성이 누적 저하되는 점이다. 코드 동작에 영향을 주는 결함은 발견되지 않았다.

## 위험도

LOW
