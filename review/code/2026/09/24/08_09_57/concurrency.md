# 동시성(Concurrency) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정

## 발견사항

- **[WARNING]** `affected === 0` 이후 재조회가 "존재+owner" / "부재" 두 갈래만 가르고, "존재+owner 아님"(제3 상태) 은 처리하지 않는다 — 이 갈래로 떨어지면 실제로는 멤버가 남아 있는데도 404(`MEMBER_NOT_FOUND`) 를 반환한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:859-868` (`if (affected === 0) { const still = ...; if (still?.role === 'owner') this.throwCannotRemoveOwner(); this.throwMemberNotFound(); }`)
  - 상세: DELETE 가 0-행으로 끝나는 이유는 코드가 명시한 두 가지(행이 사라졌다 / owner 로 승격됐다) 외에, 이론상 **세 번째 경우**가 있다 — DELETE 가 "owner 였다" 는 이유로 실패한 *그 순간 이후*, 대상이 다시 owner 에서 벗어나는 후속 `transferOwnership`(대상 본인이 새 owner 가 되자마자 제3자에게 재이양)이 재조회 전에 커밋되면, `still` 은 `role !== 'owner'` 인 **존재하는** 행을 반환한다. 이때 코드는 `still?.role === 'owner'` 가 거짓이므로 그대로 `throwMemberNotFound()` 로 떨어져, 실제로는 존재하는(단지 삭제되지 않은) 멤버를 "없다" 고 잘못 보고한다. 데이터 정합성(owner 오삭제 방지)은 깨지지 않지만 — 애초에 DELETE 가 그 시점 판정으로 이미 스킵됐으므로 — 호출자에게 돌아가는 에러 코드가 사실과 다르다. 재현 창이 "owner 로 막 승격된 멤버가 그 직후 즉시 또 다른 대상에게 재이양" 이라는 이중 레이스라 극히 좁지만, 이 PR 이 스스로 도입한 재조회 판별 로직의 분기 커버리지 공백이다. 실제로 새/기존 단위테스트(`workspaces.service.spec.ts`)는 "재조회=owner"(403) 와 "재조회=null"(404) 두 갈래만 고정하고, "재조회=존재+non-owner" 갈래는 검증하지 않는다.
  - 제안: 이 경로가 실무적으로 무시 가능한 확률이라면 그 판단을 주석으로 명시하거나(현재 주석은 "어느 답이든 정당한 결과" 라고만 적어 이 제3 분기를 언급하지 않는다), 아니면 `still` 이 존재하고 owner 도 아닌 경우를 별도로 처리(예: 409/재시도 유도, 혹은 그 값으로 DELETE 를 한 번 더 재시도)해 "존재하는데 없다고 답하는" 응답을 없앤다. 최소한 이 갈래를 명시적으로 다루는 단위 테스트 한 줄이라도 추가해 "0이면 무조건 owner 아니면 404" 로 단순화하는 미래의 리팩터가 조용히 통과하지 못하게 고정하는 것을 권장.

- **[INFO]** `transferOwnership()` 의 기존(이번 diff 로 손대지 않은) 독스트링이 실제 구현과 다르다 — 이 PR 의 원자성 근거가 그 잠금 동작을 전제로 하므로 언급.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:716-717` (주석: "두 멤버를 단일 `IN` 쿼리로 동시에 락") vs 실제 구현 `:745-748`(`requesterMembership` 을 `findOne(..., lock: pessimistic_write)` 로 개별 조회/잠금), `:764-767`(`targetMembership` 을 별도 `findOne(..., lock: pessimistic_write)` 로 순차 잠금).
  - 상세: 주석은 두 멤버를 "단일 IN 쿼리로 동시에" 잠근다고 말하지만 실제 코드는 requester → target 순서로 **두 번의 개별 `findOne` 호출**로 순차 잠근다. 이번 diff 는 이 함수를 건드리지 않았고, `removeMember` 의 새 원자성 주장("`transferOwnership` 이 대상 행에 `pessimistic_write` 를 쥐므로 DELETE 가 커밋을 기다렸다가 WHERE 를 재평가한다")은 "대상 행이 잠기고 커밋까지 유지된다" 는 사실 자체에만 의존하므로 이 mismatch 로 인해 `removeMember` 의 새 로직이 깨지지는 않는다. 다만 순차 잠금이 유지되는 한 A→B/B→A 데드락이 실제로 발생하지 않는 이유는 "같은 시점에 동시 잠금" 이 아니라 "요청 시점에 owner 인 사람만 requester 잠금을 통과한다" 는 선행조건 때문이므로, 독스트링이 구현과 어긋나 있다는 점만 별도로 정정 대상.

## 확인 사항 (문제 아님 — 근거 실측)

- `removeMember` 의 핵심 수정(`role: Not('owner')` 를 원자적 `DELETE` 조건에 포함) 은 Postgres READ COMMITTED 의 EvalPlanQual 재평가 의미론에 정확히 부합한다. `transferOwnership` 이 대상 행에 `pessimistic_write` 를 쥔 채 `role='owner'` 로 갱신·커밋하면, 블록돼 있던 `DELETE ... WHERE ... AND role <> 'owner'` 는 커밋된 최신 행 버전에 대해 조건을 재평가해 그 행을 제외한다 — 단일 문장이라 별도 락을 새로 들이지 않고도 진짜 원자적이다. 저장소에 격리 수준을 SERIALIZABLE/REPEATABLE READ 로 올리는 설정이 없음을 확인했으므로(`grep` 결과 无), 이 가정이 배신당해 직렬화 실패(`40001`) 로 500 이 새는 경로도 없다.
- `removeMember` 는 자체적으로 트랜잭션을 열지 않는(단발 autocommit) 문장들의 나열이라, `transferOwnership`/`leaveWorkspace` 가 갖는 (workspace → 멤버) 잠금 순서와 교차해 데드락을 일으킬 여지가 없다 — DELETE 가 다른 락을 쥔 채 대기하는 상태가 없다.
- e2e (`member-remove-concurrency.e2e-spec.ts`) 의 새 테스트는 레이스 대신 **재진입**(테스트가 `SELECT ... FOR UPDATE` 로 행을 직접 쥐고, 요청이 삭제 문장에서 대기 중임을 `Promise.race` 로 공허성 검증한 뒤 승격 UPDATE 후 COMMIT)으로 정확한 인터리빙 지점을 강제한다 — 편한 지점에서 끊는 약한 재현이 아니다. 마지막 단언이 실제 DB 행 상태(`role` 이 여전히 `'owner'`)를 직접 확인해, 목(mock) 만으로는 검증 불가능한 "실제 SQL 이 옳게 렌더된다" 는 부분까지 오라클로 고정한다.
- 해당 e2e 테스트는 raw `UPDATE ... SET role='owner'` 로 승격을 흉내내 워크스페이스에 owner 가 두 명 남는 상태를 의도적으로 만든다(주석에 명시). 파일 마지막 `it` 로 배치해 다른 테스트를 오염시키지 않도록 격리했고, 이 워크스페이스는 이후 재사용되지 않는다 — 의도된 트레이드오프로 보이며 별도 결함은 아니다.
- 단위 테스트의 `wireFindOne` 카운터(`targetReads`)는 함수 스코프 지역 변수라 매 `it` 호출마다 새로 생성되며, `id` 기준 조회만 카운트해 `assertAdmin` 경로(별도 `userId` 조회)와 섞이지 않는다 — 결정론적 2단계 재조회 시뮬레이션으로 타당하다.
- 워크트리 오염 없음: 이번 리뷰 과정에서 저장소 파일을 수정/뮤테이션하지 않았다(전량 `Read`/`grep` 로만 확인). `git status --short` 재확인 불필요.

## 요약

이번 변경은 `removeMember()` 의 owner 보호 가드가 동시 `transferOwnership()` 에 뚫리는 실측된 TOCTOU 를 닫는 수정이다. 핵심 메커니즘 — 원자적 `DELETE` 문에 `role: Not('owner')` 술어를 넣고 Postgres READ COMMITTED 의 EvalPlanQual 재평가에 기대는 설계 — 는 새 락을 들이지 않고도 올바르게 원자적이며, 데드락이나 이벤트 루프 블로킹을 새로 유발하지 않는다. e2e 테스트는 재진입 방식으로 정확한 인터리빙 지점을 강제하고 실제 DB 상태까지 확인해 신뢰도가 높다. 유일한 잔여 결함은 `affected === 0` 이후의 비잠금 재조회가 "존재/owner" 와 "부재" 두 갈래만 다루고 "존재/owner 아님" 이라는 이론상 제3 분기(이중 연쇄 이양이라는 매우 좁은 창)를 다루지 않아, 그 경우 실재하는 멤버를 404 로 잘못 보고할 수 있다는 점이다 — 데이터 정합성 훼손은 아니고 에러 코드 정확도 문제이며 발생 확률이 극히 낮다.

## 위험도

LOW
