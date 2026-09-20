# Security Review — trigger-dup-delete (동시 DELETE 이중 감사 수정)

## 발견사항

없음 (Critical/Warning 대상 없음).

### 검토 세부

- **인증/인가**: `remove()` 는 기존과 동일하게 `findById(id, workspaceId)` 로 트리거를 워크스페이스
  범위로 조회하고, 신규 추가된 락 안 재조회(`m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })`)
  도 동일하게 `workspaceId` 로 스코프를 유지한다(`codebase/backend/src/modules/triggers/triggers.service.ts` `remove()`,
  전체 파일 컨텍스트 기준 1090-1093행). 다른 워크스페이스의 트리거 id 를 넣어도 크로스-테넌트로 조회/삭제되지 않는다 —
  권한 검증 우회 없음.
- **인젝션**: 신규 쿼리는 TypeORM `findOne({ where: {...} })` 객체 스타일로 파라미터 바인딩되어 SQL 인젝션
  경로 없음. 신규 e2e 파일(`codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`)의 raw SQL 도
  `pg_advisory_xact_lock(hashtext($1))` 및 `WHERE resource_id = $1` 형태로 파라미터 바인딩(`$1`)을 사용해
  인젝션 없음.
- **에러 처리 / 정보 노출**: 락 뒤 행 부재 시 `throwTriggerNotFound()` 로 일반 메시지(`'Trigger not found'`,
  `code: 'RESOURCE_NOT_FOUND'`)만 클라이언트에 반환되고 내부 사유는 노출되지 않는다. `catch` 블록의
  `this.logger.error(...)` 는 `err.message` 를 포함하지만 이는 서버 사이드 로그로만 남고 HTTP 응답에는
  실리지 않는다 — 기존 워크플로/워크스페이스 삭제 경합 수정과 동일한 패턴(`4a9828afe`, 유사 커밋)이라
  신규 노출 표면이 아니다. 오히려 이번 diff 는 `if (err instanceof NotFoundException) throw err;` 를 추가해
  "정상적인 경합 패배(404)" 를 "반쯤 삭제된 상태" 오류 로그로 잘못 승격시키던 거짓 경보를 없앤 것으로, 로그
  신뢰성 관점에서 개선.
- **하드코딩된 시크릿**: 신규 코드·테스트에 하드코딩된 API 키/비밀번호/토큰 없음. e2e 스펙은
  `registerAndLogin` 을 통해 런타임에 발급된 JWT 를 사용하고, endpoint path 는 `crypto.randomUUID()` 로
  생성한다. (참고: `createDbClient()` 헬퍼의 기본값 `'clemvion-e2e'` 는 로컬 docker-compose e2e 전용 기존
  헬퍼로, 이번 diff 가 건드린 파일이 아니며 다른 형제 e2e 스펙들도 동일하게 재사용 중인 pre-existing 패턴.)
- **동시성 수정의 보안적 함의**: 이 변경은 advisory lock 만으로는 막지 못하던 "락 획득 ≠ 행 존재" 간극을
  닫아, 동시 DELETE 시 승자만 외부 자원(secret store `deleteByPrefix`, provider teardown)을 정리하고
  패자는 아무 부수효과도 남기지 않도록 한다(신규 unit 테스트가 `repo.remove`/`audit.record`/
  `deleteByPrefix` 모두 미호출을 단언). 이는 이중 감사 로그로 인한 감사 추적 신뢰성 저하를 막는 수정이며,
  새로운 인가 우회나 자원 누수 경로를 만들지 않는다.
- **의존성**: 신규 의존성 추가 없음 (`@jest/globals`, `pg`, `supertest`, `node:crypto` 모두 기존 사용 패턴).

## 요약

이번 변경은 트리거 삭제 시 advisory lock 획득과 행 존재 확인 사이의 TOCTOU 간극을 닫아 동시 DELETE
경합에서 패자가 이중으로 감사 로그·외부 자원 정리를 수행하지 않도록 하는 동시성 버그 수정이다.
워크스페이스 스코프 검증이 신규 쿼리에도 그대로 유지되고, 모든 쿼리가 파라미터 바인딩되어 있으며,
에러 응답은 일반화된 메시지만 노출하고 상세 사유는 서버 로그에만 남는다. 하드코딩된 시크릿이나 새로운
인증/인가 우회, 인젝션 벡터는 발견되지 않았다.

## 위험도

NONE
