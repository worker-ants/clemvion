# 보안(Security) 코드 리뷰 — 웹훅 경로 영구 예약 (V133)

## 리뷰 범위

`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`,
`codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts`,
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`codebase/backend/src/modules/triggers/triggers.controller.ts`,
`codebase/backend/src/app.module.spec.ts`, `codebase/backend/src/database/root-entities.ts`,
테스트(`triggers.service.spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`,
`webhook-endpoint-reservation.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts`), `CHANGELOG.md`.
프롬프트에서 diff 가 생략된 두 e2e 파일과 `triggers.service.ts` 전체(1700행)를 `Read`/`grep` 으로
직접 열어 대조했다.

이 기능은 "지우거나 바꾼 웹훅 경로를 다른 워크스페이스가 재등록해 옛 URL 로 오는 트래픽을
가로챌 수 있었다"는 실질적인 broken-access-control(OWASP A01, tombstone 부재) 결함을 DB 트리거
기반 영구 예약으로 막는 방어적 변경이다.

## 검증 뮤테이션 여부

저장소 파일을 고쳐서 재현하지 않았다 — 정적 분석·`Read`/`grep` 대조·기존 테스트 내용 확인만으로
결론에 도달했다. 저장소에 아무것도 쓰지 않았다(뮤테이션 없음, `git status --short` 로 되돌릴 대상 자체가 없음).

## 발견사항

- **[INFO]** DB 트리거가 raise 하는 합성 "제약 이름"(`webhook_endpoint_reservation_owner`)이 실재
  UNIQUE/CHECK 제약이 아니라 `RAISE EXCEPTION … USING CONSTRAINT` 가 붙이는 논리적 라벨이다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:51-55`
    (`RAISE EXCEPTION` 블록) / `codebase/backend/src/modules/triggers/triggers.service.ts:222-226`
    (`isEndpointPathUniqueViolation` JSDoc)
  - 상세: 보안 결함은 아니다 — 이 값은 애플리케이션이 아니라 Postgres 서버가 실제로 채우는
    `constraint_name` 필드를 드라이버가 그대로 노출한 것이라 공격자가 조작 가능한 입력 경로가 없다
    (`pgErrorConstraint()` 는 서버 응답을 그대로 읽을 뿐, 사용자 입력을 파싱하지 않는다). 코드·JSDoc·
    마이그레이션 헤더 세 곳 모두 이미 "실재 제약이 아니다"를 명시해 오독 여지도 낮다.
  - 제안: 별도 조치 불요(문서화 이미 충분).

- **[INFO]** 정보 노출 방지(경로 사용 이력 은닉)가 응답·테스트 양쪽에서 견고하게 구현됨 — 긍정 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`
    (약 1663-1680행), `codebase/backend/src/modules/triggers/triggers.controller.ts:51`
    (Swagger 설명), 테스트 `triggers.service.spec.ts:3095-3109`(두 이름의 409 응답 동일성 +
    `not.toMatch(/쓰고 있/)` )
  - 상세: "그 경로가 한때 쓰였다"는 사실이 상태 코드(둘 다 409 `RESOURCE_CONFLICT`)·`details`
    (`field`/`code` 동일)·메시지("쓸 수 없어요" — 현재 사용 여부와 무관하게 참) 어느 축으로도
    새어 나가지 않도록 설계됐고, BEFORE 트리거가 UNIQUE 인덱스보다 항상 먼저 걸리므로 "다른
    워크스페이스의 살아있는 경로"와 "예약만 남은 경로"가 같은 코드 경로·같은 타이밍으로 거부된다.
    단위 테스트가 두 제약 이름(`idx_trigger_endpoint_path`, `webhook_endpoint_reservation_owner`)에
    대해 응답 객체 완전 동일성과 메시지 부정 단언을 모두 실측 검증한다. 발견사항이라기보다
    검토 근거로 기록.

- **[INFO]** 소유권 강제를 앱 레벨이 아닌 DB 트리거로 옮긴 설계가 TOCTOU 를 원천 차단
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:33-60`
    (`reserve_webhook_endpoint_path()` 함수 + `BEFORE INSERT OR UPDATE` 트리거)
  - 상세: 새 경로를 동시에 잡으려는 두 트랜잭션은 `INSERT … ON CONFLICT (endpoint_path) DO NOTHING`
    의 PK 제약이 승자를 결정하고, 패자는 커밋된 소유자를 `SELECT` 로 확인해 거부된다 — 서비스
    계층의 "먼저 SELECT 로 확인 후 INSERT" 같은 순진한 패턴이었다면 생겼을 경합 창이 없다.
    함수에 `SECURITY DEFINER` 가 없어 권한 상승도 없다(호출자 권한으로 실행).
  - 조치 불요 — 긍정 확인.

- **[INFO]** `endpointPath` 소유권 판정·백필 어디에도 사용자 입력을 문자열로 결합하는 동적 SQL 이 없음
  - 위치: 마이그레이션 전체(정적 DDL/DML), `triggers.service.ts`(TypeORM repository/query builder
    가 전부 파라미터 바인딩), e2e 의 raw SQL(`db.query('… WHERE endpoint_path = $1', [path])` 형태)
  - 상세: `db.query(V133_SQL)`(e2e)은 디스크의 고정 마이그레이션 파일을 그대로 실행하는 것으로
    사용자 입력 경로가 아니다. SQL 인젝션 벡터 없음.

## 항목별 점검

1. **인젝션**: 없음 — 위 발견사항 참고. 경로 탐색·커맨드 인젝션·LDAP 인젝션 해당 코드 경로 없음.
2. **하드코딩된 시크릿**: 없음. (테스트 fixture UUID/이메일은 시크릿이 아니며, e2e DB 접속 정보
   `codebase/backend/test/helpers/db.ts` 는 이번 diff 밖의 기존 로컬 docker-compose 전용 개발 자격 증명.)
3. **인증/인가**: 이 변경의 핵심이 인가 결함(다른 워크스페이스가 지운/바꾼 경로를 재등록해 가로채기)
   수정이며, 강제 지점을 DB 트리거로 옮겨 앱 레벨 우회 가능성을 없앴다. `create`/`update` 양쪽 다
   `rethrowEndpointPathConflict` catch 를 거치는지 확인됨(저장소 전체에서 두 호출부만 존재, 두
   method 모두 신규 unit 테스트로 커버).
4. **입력 검증**: `endpointPath` 자체의 형식 검증은 이번 diff 범위 밖(선재 로직 유지, 미변경).
   신규 코드(예약 조회·매칭)는 사용자 입력을 직접 파싱하지 않고 DB 트리거·`$1` 바인딩으로만 다룬다.
5. **OWASP Top 10**: A01(Broken Access Control) 유형 결함을 닫는 수정. 새로 도입된 결함 없음.
6. **암호화**: 해당 없음 — 해시/암호화 알고리즘, 평문 전송 관련 변경 없음.
7. **에러 처리**: 개선됨 — 메시지를 "이미 쓰고 있다"(참/거짓 정보 노출)에서 "쓸 수 없다"(양쪽에 참)로
   일반화했고, 두 원인(현재 충돌 vs 예약만 남음)을 상태 코드·details·메시지 어디서도 구분하지
   않도록 테스트로 고정했다. 민감 정보(과거 사용 이력) 노출 없음.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 변경은 웹훅 엔드포인트 경로를 지우거나 바꾼 뒤 다른 워크스페이스가 재등록해 옛 URL 로 오는
요청을 가로챌 수 있었던 실질적인 접근 통제 결함(OWASP A01)을, DB 트리거 기반의 영구 예약
(`webhook_endpoint_reservation` 테이블 + `BEFORE INSERT OR UPDATE` 트리거)으로 막는 방어적
보안 개선이다. 강제 지점을 애플리케이션이 아닌 DB 트랜잭션/트리거에 두어 동시성 우회(TOCTOU)를
원천 차단했고, "다른 워크스페이스의 살아있는 경로"와 "지웠거나 바꾼 예약된 경로"를 응답 코드·
메시지·처리 경로 모두에서 구분 불가능하게 만들어 정보 노출(경로 사용 이력)도 함께 막았다. 이
설계는 SQL 레벨 e2e(임시 스키마 실행)·API 레벨 e2e(B7~B9)·서비스 unit 테스트(이름 축 매트릭스 +
응답 동일성 단언)로 다층 검증된다. 코드·마이그레이션·테스트 전반에서 SQL 인젝션, 하드코딩된
시크릿, 인증 우회, 안전하지 않은 암호화, 민감 정보 노출, 신규 의존성 취약점 중 어느 것도
발견되지 않았다. 유일한 지적 사항(합성 제약 이름이 실재 DB 오브젝트가 아니라는 점)은 순수
문서 명료성 문제로 이미 코드 3곳에 충분히 주석돼 있어 위험도에 영향을 주지 않는다.

## 위험도

NONE
