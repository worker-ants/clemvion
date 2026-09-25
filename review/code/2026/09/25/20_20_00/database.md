# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 신규 테스트가 검증하는 이중검사 잠금(double-checked locking) 패턴은 실제로 올바르게 구현되어 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:760` (`transferOwnership`), 테스트는 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1149`(게이트 기준)
  - 상세: 이번 diff 는 프로덕션 DB 접근 코드를 변경하지 않는다 — 변경 대상은 (1) `README.md` 문서 정정, (2) `workspaces.service.spec.ts` 에 유닛 테스트 1건 추가뿐이다. 추가된 테스트는 `transferOwnership` 의 동시성 안전장치, 즉 "트랜잭션 밖 무락(無lock) 인가 선행 조회에서는 owner 로 통과했지만, 트랜잭션 안에서 `pessimistic_write` 락을 잡고 재조회했을 때는 그 사이 다른 이양으로 강등되어 owner 가 아닌" 경합 상황을 고정한다. 소스(`workspaces.service.ts:756-762`)를 직접 열어 확인한 결과 `if (!requesterMembership || requesterMembership.role !== 'owner') this.throwOwnerTransferRequired();` 로 재검사 분기가 이미 정확히 구현돼 있고, 워크스페이스/멤버 락 순서도 `deleteWorkspace` 와 동일(워크스페이스 → 멤버십)하게 맞춰 교착(`40P01`)을 피하고 있다. 즉 이 패턴은 TOCTOU(무락 선행 검사와 트랜잭션 커밋 사이의 갱신 유실)를 막는 정석적인 접근이며, 신규 테스트는 회귀 방지용 커버리지 보강이다.
  - 제안: 조치 불필요. 다만 plan 체크리스트에 적힌 대로 뮤턴트(재검사가 role 을 안 보게 하는 변형)로 이 분기를 KILL 했다는 근거가 이미 확보돼 있어(`6aeb57a1a`), DB 관점에서 추가로 요구할 사항은 없다.

- **[INFO]** README 갱신 내용은 스키마/트랜잭션과 무관한 순수 운영 문서 정정
  - 위치: `codebase/backend/README.md:52`, `:57-58`
  - 상세: `@WorkspaceId()`/`@WorkspaceParam()` 두 판별의 부팅 캐너리 합계·부팅 로그 문구를 실제 코드(`#1399` 이후)에 맞춰 정정한 것으로, DB 인덱스·트랜잭션·마이그레이션·커넥션 풀과는 관계가 없다.

## 요약

이번 변경은 `codebase/backend/README.md` 문서 정정과 `workspaces.service.spec.ts` 유닛 테스트 1건 추가로 구성되며, 프로덕션 DB 접근 코드(엔티티, 리포지토리, 마이그레이션, 쿼리)는 전혀 수정되지 않았다. 새로 추가된 테스트가 다루는 `transferOwnership` 트랜잭션 내부 재검사 로직을 실제 서비스 코드에서 직접 확인한 결과, `pessimistic_write` 락 기반 재검사(무락 선행 검사 → 트랜잭션 내 락 재확인)가 이미 올바르게 구현되어 있어 소유권 이전 동시성 경합(강등된 요청자가 두 번째 이양을 완료하는 시나리오)을 안전하게 차단한다. 인덱스·N+1·마이그레이션 안전성·SQL 인젝션·대량 데이터 페이지네이션 등 다른 관점에서도 지적할 변경사항이 없다.

## 위험도

NONE
