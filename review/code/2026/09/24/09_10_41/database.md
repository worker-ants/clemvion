# 데이터베이스(Database) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정 (3라운드, `09_10_41`)

## 배경 확인

이번 라운드의 실질 diff 는 이전 두 라운드(`review/code/2026/09/24/08_09_57`,
`review/code/2026/09/24/08_46_47`)가 이미 DB 관점에서 상세 검토(둘 다 위험도 LOW, 전부
INFO)한 `workspaces.service.ts`/`workspaces.service.spec.ts` 변경에 더해, 커밋
`24f7a1ddf`(`test(workspaces): 1라운드 fix 가 만든 중복 단위 테스트를 지운다`) 하나가
추가됐다. 이 커밋은 `workspaces.service.ts` 를 건드리지 않고 `workspaces.service.spec.ts`
의 중복 unit 테스트 블록(진 쪽 404 를 검증하는 두 블록이 재조회 mock 을 `null` 로 통일하며
서로 동일해진 것) 하나만 제거했다 — DB 쿼리 형태·트랜잭션 경계·인덱스·파라미터화에는 영향이
없다. 나머지 파일(CHANGELOG, plan 문서, 이전 라운드 review 산출물)은 문서/메타 변경이라 DB
관점 대상이 아니다.

`git show --stat 24f7a1ddf` 로 이 커밋이 `workspaces.service.spec.ts` 단일 파일만
건드렸음을 확인했고, 현재 `workspaces.service.ts` 의 `removeMember()`/`transferOwnership()`
본문을 직접 `Read` 해 앞선 두 라운드가 검토한 diff 최종 상태와 동일함을 대조 확인했다.

## 발견사항

없음 — Critical·Warning 없음. (이전 두 라운드가 이미 소진한 INFO 항목은 아래 "확인 사항"
으로 재확인만 하고 중복 나열하지 않는다.)

## 확인 사항 (문제 아님 — 근거 실측)

- **핵심 메커니즘 불변**: `removeMember()` 는 `DELETE ... WHERE id=$1 AND workspace_id=$2
  AND role <> 'owner'` 조건부 원자 문장 하나로 동시 `transferOwnership()` 에 의한 owner
  오삭제를 막는다(`workspaces.service.ts:854-858`). `transferOwnership` 이 대상 행에
  `pessimistic_write` 를 쥔 채 커밋하면(`:764-767`, `:779`), 대기 중이던 이 DELETE 는
  Postgres READ COMMITTED 의 EvalPlanQual 재평가로 갱신된 최신 행 버전에 대해 조건을 다시
  판정한다 — 새 락을 들이지 않고도 원자적이다. 이 설계·근거는 이전 두 라운드와 동일하며
  이번 diff 로 변경되지 않았다.
- **`affected === 0` 재조회는 비잠금·읽기 전용**(`:862-871`): 에러 코드 선택(403 vs 404)
  에만 쓰이고 아무 것도 쓰지 않으므로, 재조회 사이 상태가 다시 바뀌어도 "그 시점의 유효한
  직렬화 결과" 중 하나를 반환하는 것이라 데이터 정합성 훼손은 없다. `if (still)` 분기가
  존재 여부만 보고 `role` 을 다시 보지 않는 것도 확인했다 — role 을 다시 물으면 강등된 실재
  멤버를 404 로 오분류하는 회귀를 만든다(직전 라운드에서 이미 고친 사안).
- **단위 테스트 중복 제거는 커버리지를 줄이지 않았다**: 커밋 메시지가 제시한 뮤턴트
  (`if (still) → if (true)`, 예측 1 / 실측 1, "진 쪽은 404" 블록이 죽음)를 근거로 확인 —
  지운 블록이 유일하게 담당하던 관측(재조회가 `null` → 404)을 남은 블록이 동일하게 낸다.
  `Not('owner')` 파라미터화 자체는 `workspaces.service.spec.ts:1509-1515` 의 `FindOperator`
  언박싱 단언(`criteria.role.type === 'not'`, `criteria.role.value === 'owner'`)과
  `member-remove-concurrency.e2e-spec.ts` 의 실 DB 재진입 e2e 가 이중으로 고정한다.
- **SQL 인젝션**: `Not('owner')` 는 TypeORM `FindOperator` 로 파라미터 바인딩되어 렌더링된다
  (문자열 결합 없음). e2e 헬퍼의 raw SQL(`member-remove-concurrency.e2e-spec.ts:225-227`,
  `:262-263`, `:280-282`, `:289-291`)도 전부 `$1`/`$2` 파라미터 바인딩이다.
- **인덱스**: DELETE·재조회 모두 `id`(PK, uuid) 등호 조건 — PK 인덱스로 단일 행 조회다.
  추가된 `role <> 'owner'` 조건은 비인덱스 컬럼이지만 PK 매치 후 필터라 실질 비용이 없다.
  `workspace_member` 는 `@Unique(['workspaceId', 'userId'])` 도 보유하며 엔티티 변경은
  이번 diff 에 없다(`workspace-member.entity.ts` 미변경 확인).
- **트랜잭션**: `removeMember()` 는 여전히 명시적 트랜잭션 없이 단발 원자 `DELETE` 문 +
  Postgres 행 락 대기/재평가로 정합성을 확보한다. 형제 메서드(`deleteWorkspace`/
  `leaveWorkspace`/`transferOwnership`)의 명시적 트랜잭션+`pessimistic_write` 패턴과
  메커니즘이 다르지만, `plan/in-progress/member-owner-toctou.md` §B 가 트랜잭션+비관적 락
  대안을 실측 근거(락 안 재조회 시 `affected === 0` 판별자가 도달 불가가 되어 기존 단위
  테스트가 죽은 코드를 가리킴)로 명시적으로 저울질·기각한 기록이 남아 있다.
- **마이그레이션 안전성 / 스키마 설계**: 이번 diff 에 스키마·마이그레이션 파일 변경 없음.
  해당 없음.
- **커넥션 관리**: e2e 의 `locker`/`db` 커넥션은 `beforeAll`/`afterAll` 로 생명주기
  관리되고, 신규 재진입 테스트는 `try/finally` 로 `ROLLBACK`(`.catch(() => undefined)` 이중
  방어 포함)을 보장해 락을 쥔 채 커넥션이 남지 않는다.
- **대량 데이터 / N+1**: 단일 행 PK 매치 연산이라 페이지네이션·대용량 스캔과 무관하고,
  반복문 내 쿼리 구조도 없다(`affected === 0` 조건부 1회 추가 쿼리일 뿐).
- **참고(이번 diff 대상 아님, 사전 확인된 기존 불일치)**: `transferOwnership()` 의
  독스트링(`:715-716`, "두 멤버를 단일 `IN` 쿼리로 동시에 락")은 실제 구현
  (`:745-748` requester 를 개별 `findOne`+`pessimistic_write` 로 먼저 잠그고, `:764-767`
  target 을 순차로 다시 잠금)과 다르다. 이 함수는 이번 diff 로 변경되지 않았고, 순서 불일치가
  `removeMember` 의 새 원자성 근거(대상 행이 잠기고 커밋까지 유지된다는 사실 자체)를 훼손하지
  않으므로 이번 라운드의 결함으로 새로 등재하지 않는다(직전 라운드 concurrency.md 가 이미
  INFO 로 기록).

## 요약

이번 라운드에서 DB 쿼리·트랜잭션·스키마·인덱스에 영향을 주는 실질 변경은 없다 — 유일한 신규
커밋(`24f7a1ddf`)은 unit 테스트 중복 제거이며 뮤턴트 재측정으로 커버리지 손실이 없음을
확인했다. 핵심 메커니즘(조건부 원자 `DELETE ... WHERE role <> 'owner'` + Postgres
EvalPlanQual 재평가에 의한 락-프리 원자성)은 앞선 두 라운드의 검토 결과와 동일하게 안전하며,
파라미터화된 쿼리·PK 등호 조회·명시적 커넥션 정리 등 기존에 확인된 패턴이 그대로 유지된다.
스키마·마이그레이션 변경도 없다. 데이터베이스 관점에서 병합을 막을 사유는 없다.

## 위험도

LOW
