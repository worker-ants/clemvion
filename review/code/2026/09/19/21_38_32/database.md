# 데이터베이스(Database) 리뷰

## 발견사항

해당 없음.

이번 변경은 통합 노드(HTTP Request · Database Query · Send Email)가 공유하는 SSRF 방어 유틸리티
(`codebase/backend/src/nodes/integration/http-request/http-safety.ts`)의 IPv6 정규화 로직을 고치고,
SMTP 전용 가드(`smtp-host-guard.ts`)를 `common/utils`에서 `nodes/integration/send-email/`로 옮겨
동일 구현(`assertSafeOutboundHostResolved`)을 쓰도록 통합한 것이다. 관련 테스트(unit·e2e)와 plan/consistency
산출물이 함께 포함되어 있다.

DB 관점 점검 항목(인덱스·N+1·트랜잭션·마이그레이션·스키마 설계·커넥션 관리·SQL 인젝션·대량 데이터 페이지네이션) 중
어느 것도 이번 diff 에서 건드리지 않았다:

- SQL 쿼리 작성·실행 코드 변경 없음 (`Repository`/`Brackets` 등 TypeORM 코드는 diff에 없음 — `integrations.service.ts`
  변경분은 import 경로 교체와 주석 정정뿐).
- 스키마·엔티티·마이그레이션 파일 변경 없음.
- `codebase/backend/src/modules/integrations/database-connection-tester.ts`(Database 노드 연결 테스트가
  `assertSafeOutboundHostResolved`를 호출하는 실제 지점)는 이번 diff에 포함되지 않은 파일이라 커넥션 관리
  코드 자체는 변경되지 않았다. 참고로 이 파일은 노드 실행용 커넥션 풀과 분리된 일회성 `Client`/`Connection`을
  열고 `finally`에서 항상 닫으며(`closeWithin`, 타임아웃 시 소켓 강제 파괴), 연결·쿼리 타임아웃(`DB_TEST_TIMEOUT_MS`)도
  걸려 있어 기존 커넥션 관리 방식 자체에는 문제가 없다 — 이번 변경이 그 부분을 건드리지 않았다는 사실 확인 차원의
  참고 사항이며 지적 사항은 아니다.

굳이 DB와의 접점을 짚자면, `isBlockedHostname`(`http-safety.ts`)의 IPv4-mapped IPv6 판정 보강은
Database Query 노드의 `host` 필드(연결 테스트·실제 실행 양쪽)에도 적용되어, `::ffff:127.0.0.1` 같은 표기로
사설 DB 호스트/루프백에 접근하는 경로를 추가로 막는다 — 이는 SSRF(네트워크 계층) 개선이지 DB 스키마·쿼리·트랜잭션
계층의 변경이 아니므로 본 관점의 발견사항에는 해당하지 않는다.

## 요약

변경 파일 전부가 SSRF 가드 유틸리티·SMTP 가드 이전·관련 테스트·plan/consistency 산출물이며, 데이터베이스
쿼리·트랜잭션·스키마·마이그레이션·커넥션 풀·인덱스·페이지네이션 어느 것도 수정하지 않았다. Database Query 노드의
SSRF 가드 보강(IPv4-mapped IPv6 우회 차단)이 간접적으로 DB 연결 안전성에 긍정적 영향을 주지만, 이는 데이터베이스
리뷰 관점의 점검 대상이 아니라 별도 보안(SSRF) 리뷰의 영역이다.

## 위험도

NONE
