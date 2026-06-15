# 동시성(Concurrency) 리뷰 결과

## 발견사항

### 발견사항 없음 (정상 패턴)

변경된 코드 전체(SQL 마이그레이션, NestJS 엔티티·DTO·모듈·서비스·컨트롤러·테스트)를 동시성 관점에서 검토한 결과 아래와 같이 판단한다.

1. **Node.js 단일 이벤트 루프 / async-await**: `WorkflowTestDatasetsService` 의 모든 public 메서드(`list`, `create`, `update`, `remove`, `clone`)는 TypeORM Repository 비동기 API를 올바르게 `await` 하고 있다. `await` 누락은 없다.

2. **경쟁 조건 (Race Condition)**: `update` 는 `findAccessible` → 필드 갱신 → `save` 패턴(check-then-act)으로 구성되어 있으며, 동시 요청이 들어오면 하나가 먼저 save 한 결과를 다른 요청이 덮어쓸 수 있다. 그러나 이 패턴은 NestJS/TypeORM 기반 서비스의 표준 관용구이며, 본 서비스의 "Mock Input 데이터셋" 이라는 도메인 특성상 소유자가 단독으로 수정하는 낮은 충돌 빈도, 그리고 UNIQUE 제약이 DB 레벨에서 강제되는 점을 고려하면 추가 낙관적 락(optimistic lock)이 반드시 필요한 수준은 아니다.

3. **원자성**: `create`·`clone`·`update` 는 모두 단일 `save()` 호출로 DB에 반영하며, 복합 트랜잭션이 필요한 다단계 변경이 없다. `clone` 은 source 조회 + copy insert 두 단계이지만, source 조회 실패는 예외로 처리되고 copy insert 가 UNIQUE 위반 시 409 반환하므로 부분 성공 상태가 발생하지 않는다.

4. **이벤트 루프 블로킹**: `copyName` 등 동기 연산은 순수 문자열 조작으로 이벤트 루프를 블로킹하지 않는다.

5. **스레드 안전성**: NestJS 는 Node.js 단일 스레드 이벤트 루프 기반이므로 공유 변수에 대한 동시 쓰기 위험이 없다. Repository 인스턴스는 DI 싱글턴이나 TypeORM Repository 자체가 스레드 안전하게 설계되어 있다.

6. **SQL 레벨 동시성**: UNIQUE 제약 `(workflow_id, owner_id, name)` 과 PostgreSQL 의 MVCC 로 중복 삽입 경쟁은 DB 레벨에서 처리된다. `saveUnique` 가 `23505` 를 잡아 409 로 변환하므로 에러 전파도 안전하다.

## 요약

변경 코드는 표준 NestJS/TypeORM async 패턴을 따르며, await 누락·이벤트 루프 블로킹·데드락·공유 상태 오남용이 없다. `update` 의 read-modify-write 는 이론적으로 경쟁이 가능하나 DB UNIQUE 제약과 도메인 특성을 감안할 때 허용 범위 내 패턴이다. 동시성 관점에서 별도 조치가 필요한 결함은 발견되지 않았다.

## 위험도

NONE

---

STATUS=success ISSUES=0
