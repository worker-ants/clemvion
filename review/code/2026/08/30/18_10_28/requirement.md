STATUS=success requirement review complete — 0 CRITICAL / 0 WARNING / 2 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰

## 검증 방법

diff 로 주어진 4개 실질 변경 파일(`CHANGELOG.md`, `execution-engine.service.ts`,
`execution-engine.service.spec.ts`, 두 `plan/in-progress/*.md`)과 2개 spec 파일
(`spec/5-system/4-execution-engine.md`, `spec/data-flow/3-execution.md`)을 `Read`/`grep` 으로
전문 대조했다. 추가로:

- `updateExecutionStatus` 호출부 11곳 전수를 스크립트로 재확인 — 각 호출 지점 앞 50줄 내
  `dataSource.transaction` 오픈이 없음을 확인해 JSDoc "현재 호출부 11곳은 전부 top-level" 주장을
  검증했다.
- `npx jest execution-engine.service.spec.ts` 전체 456/456 통과 확인.
- 뮤테이션 검증: else 분기 `dataSource.transaction` 콜백을 `try/catch` 로 감싸 throw 를 삼키는
  변형을 스크래치 사본(`cp`, 저장소 밖)으로 준비한 원본과 대조하며 **저장소 파일에 직접** 적용 →
  타겟 스코프(`-t "updateExecutionStatus"`)로 2건 RED(`배열이 아니면 던진다`, `else 분기: query()
  reject 시 오류가 상위로 전파된다`), 신규 "롤백 전제조건" 테스트 단독 실행으로 추가 1건 RED —
  plan/RESOLUTION 이 주장한 "콜백 안에서 throw 삼킴 → RED 2" 이상으로 실제 감지력이 확인됨.
  원복은 `cp` 로 즉시 수행했고 `git status --short` 로 clean 확인 완료(잔여물 없음).

## 발견사항

- **[INFO]** else 분기에서 `execution.status = newStatus` 대입이 `dataSource.transaction` 오픈보다
  **먼저** 실행된다 — 트랜잭션이 shape 위반으로 롤백돼도 호출자가 넘긴 `execution` 객체의
  in-memory `status` 필드는 이미 오염된 채 예외가 올라간다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `execution.status = newStatus;` (else 분기, `elseStatusesSql` 계산 직전, `await this.dataSource.transaction(...)` 호출보다 앞)
  - 상세: 이번 diff 가 만든 문제가 아니라 diff 이전부터 있던 대입 순서다(트랜잭션 wrap 은 그 아래 UPDATE 실행부만 감쌌고, 대입 위치는 옮기지 않았다). DB 상태는 트랜잭션 롤백으로 정확히 보존되므로 정합성 결함은 아니지만, catch 한 호출자가 실패 후 이 `execution` 객체의 `status` 를 재사용하면 stale/오염된 값을 볼 수 있다. 이전 라운드(`17_36_15` testing INFO 6)에서 이미 같은 지점이 "기존 코드, 이번 회귀 아님 / shape 위반은 드라이버 버그급이라 실제 발생 가능성 낮음" 으로 조치 불요 처분됐고, 이번 diff 도 그 처분을 뒤집지 않았다 — 처분 자체는 합리적이나 근본 원인은 여전히 남아 있다는 사실만 기록해 둔다.
  - 제안: 조치 불요(기존 처분 유지)로 충분. 다음에 이 함수를 다시 손볼 기회가 있으면 `execution.status` 대입을 트랜잭션 성공 이후로 옮기는 것을 고려.

- **[INFO]** spec fidelity — `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 문단 + 2026-08-30
  후속 각주, `spec/data-flow/3-execution.md` §2.1 상태 전이 행이 코드와 **line-level 로 일치**한다.
  - 위치: `spec/5-system/4-execution-engine.md:109-116`(원자성 보장 else 분기 문장), `:68-77`(후속 각주 — 17일 노출 창·미확인 발동 여부), `spec/data-flow/3-execution.md:197`(guarded UPDATE + 트랜잭션 표기)
  - 상세: `17_36_15` 라운드에서 SPEC-DRIFT 로 지적됐던 "spec 의 원자성 보장 문단이 else 분기 트랜잭션화를 반영하지 않음"이 이번 diff 에 포함된 `spec-draft-else-branch-transaction.md` planner 턴 산출물로 이미 해소돼 있다. 코드(`dataSource.transaction` 안에서 `manager.query` 실행, throw 시 UPDATE 롤백)와 spec 서술(else 분기도 트랜잭션 안에서 돈다, 목적이 짝 전이와 다름, 롤백이 없으면 종결 이벤트 유실+stuck recovery 미포착)이 정확히 대응한다. "창이 있었다"(`8332d9a20`~이 수정, 약 17일)와 "실제 발동은 미확인"을 구분한 서술도 코드/커밋 이력과 일치한다. 별도 조치 불요 — SPEC-DRIFT 는 이미 닫혔다.

## 항목별 확인 결과

1. **기능 완전성**: else 분기 guarded UPDATE 가 `dataSource.transaction` 안에서 실행되고, shape 위반 throw 시 UPDATE 가 롤백되어 행이 비-terminal 로 남는다 — 의도(무기한 대기 창 폐쇄)를 완전히 구현.
2. **엣지 케이스**: `opts?.allowRetryReentry` 분기(FAILED 포함 여부)는 트랜잭션 도입과 무관하게 그대로 보존. 동시 cancel 이 이미 terminal 로 선점한 경우(0행 매칭) `persisted=false` → `finishStatusTransition` 이 세그먼트 기록/메트릭 발행을 정확히 skip.
3. **TODO/FIXME**: diff 범위 내 TODO/FIXME/HACK/XXX 없음(grep 확인).
4. **의도와 구현 간 괴리**: `finishStatusTransition` 헬퍼 docstring("두 분기가 공유하는 종결부", WARNING #9 경위)이 실제 두 호출부(`linkedNodeExec` 분기 8654-8659, else 분기 8735-8740)와 정확히 일치. JSDoc "호출 제약 — 자신의 트랜잭션 콜백 안에서 부르지 말 것" + "현재 호출부 11곳은 전부 top-level" 주장을 11개 호출부 전수 스크립트 대조로 실측 검증(위 검증 방법 참조) — 일치.
5. **에러 시나리오**: `updateReturningRows` 가 배열이 아닌 결과에 대해 `detail` 포함 명시적 Error throw, 트랜잭션 콜백 안에서 발생하므로 `dataSource.transaction()` 자체가 reject → UPDATE 롤백. mock 상 `.rejects.toThrow(/배열이 아님/)` 로 고정, 뮤테이션(throw 삼킴)으로 실제 감지력 확인.
6. **데이터 유효성**: 기존 `WHERE status IN (${elseStatusesSql})` 가드 로직 미변경 — 트랜잭션 래핑은 결과 해석/롤백 계층에만 개입.
7. **비즈니스 로직**: "가드가 발동한 순간 무기한 대기가 생긴다"는 문제 진단과 "트랜잭션 롤백으로 비-terminal 재구동 대상화"라는 해법이 코드·spec·plan·CHANGELOG 전체에서 일관.
8. **반환값**: 두 분기 모두 `finishStatusTransition` 을 통해 `boolean` 반환 — 모든 경로(persisted true/false, throw)에서 타입 계약 유지(throw 경로는 반환이 아니라 reject 이며 이는 함수 시그니처 `Promise<boolean>` 과 모순 없음 — reject 는 Promise 계약의 정상 구성요소).
9. **spec fidelity**: 위 INFO 항목 참조 — 코드와 spec 본문(§1.1, data-flow §2.1) line-level 일치, 기존 SPEC-DRIFT 는 동일 diff 세트 내에서 이미 해소.

## 요약

`updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction` 으로 감싸 shape-위반
throw 시 실제 롤백을 보장하도록 한 변경이다. 직접 코드 실측(호출부 11곳 전수 대조), 테스트 실행
(456/456 통과), 뮤테이션 검증(throw 삼킴 → 예상대로 RED)을 통해 구현이 의도(무기한 대기 창 폐쇄)를
정확히 충족함을 확인했다. spec 문서(`4-execution-engine.md` §1.1, `data-flow/3-execution.md` §2.1)도
같은 diff 세트 안에서 코드와 line-level 로 동기화됐고, 이전 라운드(`17_36_15`)가 지적한 WARNING 2건
(CHANGELOG 미갱신·분기 코드 중복)과 SPEC-DRIFT 1건이 이번 변경에 모두 반영돼 있다. 남은 것은 사소한
기존 설계 특성(트랜잭션 오픈 전 `execution.status` in-memory 대입, INFO) 하나뿐이며 이는 이전 라운드가
이미 "조치 불요"로 처분한 항목이라 재조치를 요구하지 않는다. Critical/Warning 신규 발견 없음.

## 위험도
NONE
