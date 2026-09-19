# 보안(Security) 코드 리뷰 — 웹훅 경로 영구 예약 (V133)

## 리뷰 범위

애플리케이션 코드: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`,
`codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts`,
`codebase/backend/src/modules/triggers/triggers.service.ts`,
`codebase/backend/src/modules/triggers/triggers.controller.ts`,
`codebase/backend/src/app.module.spec.ts`, `codebase/backend/src/database/root-entities.ts`,
테스트(`triggers.service.spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`,
`webhook-endpoint-reservation.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts`), 그리고
`plan/`·`review/consistency/**`·`spec/**` 의 문서 변경.

이 기능은 "지우거나 바꾼 웹훅 경로를 다른 워크스페이스가 재등록해 트래픽을 가로채는" IDOR/hijacking 성격의
취약점(웹훅 경로 tombstone 부재)을 메우는 방어적 변경이다. 아래는 그 방어 로직 자체의 보안 검토다.

## 검증 뮤테이션 여부

코드를 수정하며 재현하지는 않았다 — 정적 분석과 `git log -S`/`git diff` 대조, 관련 테스트(B7~B9,
V133 e2e)의 실제 내용 확인만으로 결론에 도달했다. 저장소에 아무 것도 쓰지 않았다(`git status --short`
확인 불필요 — 파일을 고치지 않았음).

## 발견사항

- **[INFO]** DB 트리거가 raise 하는 합성 "제약 이름"(`webhook_endpoint_reservation_owner`)이 실재 DB
  오브젝트가 아니라 `RAISE EXCEPTION ... USING CONSTRAINT`가 붙이는 논리적 라벨이다.
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql` (게이트 47~51행,
    `RAISE EXCEPTION` 블록) / `codebase/backend/src/modules/triggers/triggers.service.ts` (게이트
    222~226행, `isEndpointPathUniqueViolation` JSDoc)
  - 상세: 보안 결함은 아니지만, `pgErrorConstraint()`가 반환하는 `constraint` 필드를 신뢰해 로직을 분기하는
    지점이 이번에 하나 늘었다. 이 값은 애플리케이션이 아니라 Postgres 드라이버가 실제 서버 응답에서 파싱하므로
    공격자가 조작할 수 있는 입력이 아니다(주입 경로 없음) — 다만 이미 `review/consistency/2026/09/19/18_56_41/convention_compliance.md`
    가 INFO 로 지적했듯, 다음에 이 라벨을 실재 제약과 혼동해 "제약을 실제로 만들어야 하나" 오독할 여지는
    남아 있어 순수 보안 관점에서는 위험도가 낮다.
  - 제안: 별도 조치 불요(이미 consistency 리뷰가 문서화 제안을 등재함).

- **[INFO]** 정보 노출 방지 목적의 응답 통합이 잘 설계·검증돼 있음 (긍정 확인)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict`
    (게이트 1663~1680행), `codebase/backend/test/webhook-trigger.e2e-spec.ts` `expectPathConflict`
  - 상세: "경로가 한때 쓰였다"는 사실이 응답 메시지·상태 코드·타이밍(BEFORE 트리거가 UNIQUE 인덱스보다
    항상 먼저 걸리므로 "다른 워크스페이스의 살아있는 경로"와 "예약만 남은 경로"가 같은 시점·같은 방식으로
    거부된다)으로 새어 나가지 않도록 설계됐고, e2e(B7·B8)에서 `JSON.stringify(res.body)).not.toContain('워크스페이스')`
    로 실측 검증한다. `triggers.service.spec.ts`도 두 제약 이름의 409 응답이 완전히 동일한지, 메시지가
    "쓰고 있다"를 말하지 않는지 단언한다. 발견사항이 아니라 검토 근거로 기록.

- **[INFO]** `workspaceId`는 이번 diff의 `create`/`update` 경로 모두 컨트롤러/인증 컨텍스트에서 주입되고
  DTO 스프레드 뒤에 명시적으로 override 되어, 클라이언트가 body 로 다른 워크스페이스를 사칭할 수 없다
  (`triggers.service.ts` `create()` 게이트 493~496행 `{ ...rest, config: mergedConfig, workspaceId }`).
  IDOR 관련 새 결함 없음.

## 항목별 점검

1. **인젝션**: SQL 마이그레이션은 정적 DDL/PL/pgSQL이며 사용자 입력을 문자열 결합하지 않는다. e2e
   테스트도 전부 파라미터 바인딩(`$1`, `$2`...)을 쓴다. `db.query(V133_SQL)`은 디스크에서 읽은 고정
   마이그레이션 파일을 그대로 실행하는 것으로 사용자 입력 경로가 아니다. 인젝션 취약점 없음.
2. **하드코딩된 시크릿**: 없음.
3. **인증/인가**: `endpointPath` 소유권 검증이 앱 레벨(TOCTOU 취약)이 아니라 DB 트리거로 강제되도록
   설계된 것이 이 변경의 핵심 방어이며 견고하다. `create`/`update` 양쪽 다 새 catch 를 거치는지 확인됨
   (grep 상 두 호출부만 존재, 테스트도 두 method 를 모두 태움).
4. **입력 검증**: `endpointPath` 자체의 형식 검증은 이번 diff 범위 밖(기존 로직 유지). 새로 추가된
   부분(예약 조회·매칭)은 사용자 입력을 직접 소비하지 않는다.
5. **OWASP Top 10**: 이 변경 자체가 A01(Broken Access Control) 유형 결함(다른 워크스페이스가 지운/바꾼
   경로를 가로챌 수 있음)을 닫는 수정이며, 새로 도입하는 결함은 발견되지 않았다.
6. **암호화**: 관련 없음(평문 전송·해시 알고리즘 변경 없음).
7. **에러 처리**: 위 발견사항대로, 민감 정보(과거 사용 이력)를 노출하지 않도록 메시지를 의도적으로
   일반화했고 테스트로 고정했다. 양호.
8. **의존성 보안**: 새 의존성 추가 없음.

## 요약

이번 변경은 웹훅 엔드포인트 경로의 "비운 뒤 다른 워크스페이스가 가로채기"라는 실질적인 접근 통제 결함을
DB 트리거 기반의 영구 예약으로 막는 방어적 보안 개선이다. 강제 지점을 앱이 아닌 DB 트랜잭션/트리거에
두어 동시성 우회(TOCTOU)를 원천 차단했고, 다른 워크스페이스의 "살아 있는 경로"와 "지웠거나 바꾼 예약된
경로"를 응답 코드·메시지·타이밍(BEFORE 트리거 우선순위) 모두에서 구분 불가능하게 만들어 정보 노출도
막았다. 이 설계는 e2e(V133 SQL 직접 실행, API B7~B9)와 단위 테스트로 충분히 뒷받침된다. 새로운 인젝션·
인증 우회·시크릿 노출·안전하지 않은 암호화 사용은 발견되지 않았다. 유일한 지적은 DB 트리거가 raise 하는
합성 제약 이름이 실재 오브젝트가 아니라는 점에 대한 문서 명료성 문제(INFO)이며, 이는 이미 병행된
consistency 체크에서 지적·수용된 사안이다.

## 위험도

NONE
