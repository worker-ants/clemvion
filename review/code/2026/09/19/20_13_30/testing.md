# 테스트(Testing) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 방법

`codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`, 신규 엔티티, `triggers.service.ts`/`triggers.service.spec.ts`,
신규 e2e(`webhook-endpoint-reservation.e2e-spec.ts`), 갱신된 `webhook-trigger.e2e-spec.ts`(B7~B9), `deletion-cascade-indexes.e2e-spec.ts`,
`app.module.spec.ts`/`root-entities.ts`를 직접 `Read`/`Grep`으로 열어 diff 전후 맥락을 대조했다. 순수 유닛 테스트
(`triggers.service.spec.ts`의 `endpoint_path UNIQUE 충돌 계약` describe 블록)를 실제로 실행해 16개 테스트가 통과하는 것을
확인했다(`npx jest --config jest.config.ts src/modules/triggers/triggers.service.spec.ts -t "endpoint_path UNIQUE"` → `16 passed`).
e2e는 로컬에 노출된 Postgres 컨테이너가 이 리포의 `docker-compose.e2e.yml` 대상인지 불확실해(별도 프로젝트로 보이는
`nerv-postgres-1`만 host-포트 매핑) 공유 DB 상태를 오염시킬 위험을 피하고자 실행하지 않았고, 정적 분석으로만 검토했다.
저장소 파일은 전혀 수정하지 않았다(`git status --short` 확인, 리뷰 출력 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 테스트가 production `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`를 import하지 않고 리터럴을 복제 — "이름 추가" 방향의 회귀를 못 잡는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3029-3032` (`const CONFLICT_NAMES = [...]`) vs
    `codebase/backend/src/modules/triggers/triggers.service.ts:233-236` (`const TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES: ReadonlySet<string> = ...`)
  - 상세: `triggers.service.ts`의 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`는 `export` 되어 있지 않다(`triggers.service.spec.ts`가 소스에서
    import하는 것은 `TriggersService`·`isEndpointPathUniqueViolation` 둘뿐 — 1~18행 import 블록으로 확인). 그래서 테스트가 같은 두
    문자열(`idx_trigger_endpoint_path`, `webhook_endpoint_reservation_owner`)을 `CONFLICT_NAMES`라는 독립 배열로 손으로 다시
    적었다. 현재 두 목록이 값 기준으로 정확히 일치하므로 "제거/변경" 방향의 회귀(누가 실수로 이름 하나를 빼거나 바꾸면 술어가
    `false`를 돌려주고 `it.each`가 `ConflictException` 대신 원본 에러를 기대해 실패)는 여전히 잡힌다. 그러나 **반대 방향**은
    구조적으로 못 잡는다 — 나중에 누군가 production Set에 세 번째 이름(예: 다른 DB 트리거 라벨)을 추가하면서 `CONFLICT_NAMES`
    갱신을 잊어도, 기존 8개(2×2×2) `it.each` 케이스와 "두 이름의 409 응답이 같다" 테스트는 그대로 초록이다 — 새 이름에 대한
    커버리지가 조용히 비어 있는 채로 suite 는 계속 통과한다. 이 프로젝트 메모리(`feedback_design_rationale_must_be_mutation_tested`,
    `feedback_mutation_coverage_multiarm_operators`)가 반복 지적한 "추가 방향 뮤턴트가 생존" 패턴과 같은 모양이다. (다만 이 패턴
    자체는 이번 diff가 새로 만든 것이 아니라, 이전 라운드의 단일 리터럴 `'idx_trigger_endpoint_path'` 직접 인용 관행을 2개짜리
    로컬 상수로 그대로 확장한 것 — 기존 패턴의 연장이라는 점은 감안할 필요가 있다.)
  - 제안: `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`를 (테스트 전용으로라도) export 하거나, `isEndpointPathUniqueViolation`이 인식하는
    이름의 개수/집합을 서비스 모듈에서 재노출하는 헬퍼를 두고 테스트가 그 헬퍼로 `CONFLICT_NAMES`를 유도하게 하면, 향후 이름
    추가가 테스트 목록과 자동으로 동기화된다.

- **[INFO]** 신규 동시성 e2e가 만든 예약 행 2개가 정리되지 않고 공유 e2e DB에 영구히 남는다 — 기능 설계상 의도적이지만 테스트
  위생 관점에서 기록
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts:307-315` (두 번째 `it`의 `finally` 블록)
  - 상세: `committed`/`rolledBack` 두 무작위 UUID 경로로 실제 트리거 insert를 발생시켜 `webhook_endpoint_reservation`에 행 2개가
    생긴다. `finally`는 `workspace`·`user`만 지우고(`:311-314`) `webhook_endpoint_reservation` 행 자체는 지우지 않는다 — 이는
    기능의 핵심 불변식("예약은 지우지 않는다")과 정확히 일치하는 의도된 동작이라 결함은 아니다. 다만 무작위 `crypto.randomUUID()`를
    쓰므로 재실행 간 충돌은 없지만(교훈 `feedback_e2e_stale_volume_register_500` — 이 프로젝트 e2e 볼륨이 매 실행마다 초기화되지
    않을 수 있음을 감안하면), 로컬에서 이 e2e 스펙을 반복 실행할 때마다 그 테이블에 orphan 행이 누적된다. B9
    (`webhook-trigger.e2e-spec.ts`)의 불변식 검사("경로 있는 트리거는 전부 자기 워크스페이스 소유의 예약을 가진다")는 `trigger`
    테이블과 LEFT JOIN 이라 orphan 예약 행 자체는 걸리지 않으므로 이 누적이 다른 테스트를 깨뜨리진 않는다.
  - 제안: 결함 아님 — 별도 조치 불요. 다만 장기간 반복 실행되는 CI/로컬 e2e 볼륨에서 이 테이블 크기가 서서히 늘어난다는 점은
    운영 관점(테이블 부풀림)에서 참고할 가치가 있다(database.md 리뷰의 백필 성능 논의와 같은 결의 이슈).

## 확인된 양호한 설계 (참고 — 오탐 방지)

- **표면·이름·메서드 3축 파라미터화**: `triggers.service.spec.ts:3034-3039`의 `it.each` 가 `method × surface × name`
  (2×2×2=8케이스)을 전부 태운다 — 직전 라운드가 "표면 축을 predicate 테스트에만 걸고 통합 경로엔 `driverError` 하나였다"고
  지적한 갭(`review/code/2026/09/06/15_30_59` INFO#11)을 이번에도 유지하면서 새 이름 축까지 정확히 곱해 확장했다.
- **응답 비구분(정보 노출 방지) 전용 테스트**: `triggers.service.spec.ts:3095-3109` "두 이름의 409 응답이 같고, 메시지는
  «지금 쓰고 있다» 를 말하지 않는다" — `toEqual` 로 두 응답 객체 전체가 문자 그대로 같은지, `not.toMatch(/쓰고 있/)` 로 메시지가
  거짓을 말하지 않는지를 각각 독립적으로 단언한다. 요구사항(정보 비노출)을 정확히 코드화한 좋은 예.
- **양방향 회귀 보존**: `idx_trigger_workspace_name`(다른 UNIQUE는 그대로 흘려보냄, :3132-3140), `Error('db down')`(unique 위반이
  아닌 오류도 흘려보냄, :3142-3149), `idx_trigger_workspace_endpoint`(V132가 지운 옛 인덱스 이름은 더 이상 좁히지 않음,
  :3164-3169) 세 개의 "반대 방향 대조군"이 diff 이후에도 그대로 유지돼, 술어가 조용히 넓어지는 회귀를 계속 막는다.
  `jest -t` 실측으로 16개 테스트가 모두 통과함을 직접 확인했다(위 방법 참고).
- **SQL e2e의 인터리빙 검증 방식**: `webhook-endpoint-reservation.e2e-spec.ts:228-316`의 신규 경합 테스트는 `pg_stat_activity`로
  "기다리는 연결이 실제로 lock 대기 중"임을 확인한 뒤에야 먼저 잡은 트랜잭션을 커밋/롤백한다(`:260-270`) — 타이밍에 기대는
  `sleep` 기반 레이스 테스트가 아니라 결정적 재현이다. 커밋 시엔 "PK 위반이 아니라 주인 라벨"(`:292`), 롤백 시엔 "예약이
  남지 않고 승자가 된다"(`:305-306`)는 **가르는 성질**을 정확히 관측해, "하나만 성공"이라는 전역 UNIQUE만으로도 참인 약한
  단언(RESOLUTION W2가 지적했던 원래 문제)에 머무르지 않는다.
  RESOLUTION.md 가 명시한 뮤턴트 검증(`ON CONFLICT` 제거 → PK 위반 RED · 트리거 제거 → 인덱스 위반 RED)도 근거로 함께 남아있다.
- **API vs SQL 계층 분리가 명확**: `webhook-endpoint-reservation.e2e-spec.ts` 헤더 JSDoc(`:23-25`)이 "이 파일은 백필·DB 트리거
  메커니즘만 보고, 서비스/API 시나리오(409 응답 형태·수신 404)는 `webhook-trigger` B7~B9가 맡는다"고 스코프를 명시 — 실제로
  두 파일의 검증 대상이 겹치지 않는다(SQL 파일은 raw SQL만 쓰고, API 파일은 HTTP 계층까지 확인). 중복 커버리지도, 커버리지
  공백도 없다.
- **B7~B9 e2e가 지운/바꾼/워크스페이스-삭제 세 시나리오를 API 레벨에서 실측**: `webhook-trigger.e2e-spec.ts:387-486` — 지운
  경로 재등록 거부/같은 워크스페이스 재사용 허용(B7), 워크스페이스 삭제 후 예약 고아화(B8), DB 트리거 정의·전역 불변식
  스키마 검증(B9)까지 API 관점의 코드 경로를 빠짐없이 태운다. 중복 헬퍼 `expectConflict`/`expectPathConflict` 를 `expectPathConflict`
  하나로 통합한 것(diff 확인)도 이전 리뷰 INFO#5 해소와 정확히 일치한다.
- **엔티티 스키마 드리프트 가드가 자동으로 신규 엔티티를 흡수**: `entity-schema-declarations.e2e-spec.ts`는
  `ROOT_ENTITIES`(`root-entities.ts`)를 순회하는 제네릭 가드라, `WebhookEndpointReservation` 을 그 배열에 추가한 것만으로
  컬럼·인덱스·FK 선언이 실제 DB DDL과 일치하는지가 자동으로 검증 대상에 들어간다 — 신규 엔티티 전용 테스트를 따로 안 써도
  되는 구조이며, 실제로 그렇게 구성돼 있다.
- **테스트 용이성**: DB 강제 로직 전체가 애플리케이션 코드가 아니라 순수 SQL/plpgsql(V133)에 있어, 서비스 유닛 테스트는
  "이름으로 판정하는 술어"만 mock으로 검증하고 실제 무결성 강제는 별도 e2e(SQL 계층)가 전담하는 계층 분리가 잘 되어 있다 —
  단위 테스트가 DB를 흉내 내려 하지 않고 정직하게 역할을 나눴다(Mock 적절성 관점에서 양호).

## 요약

이번 diff의 테스트 스위트는 계층별 책임(유닛=이름 판정 술어, SQL e2e=DB 트리거 메커니즘·경합, API e2e=409 응답 계약)이
명확히 분리돼 있고, 각 계층에서 이전 리뷰 라운드가 지적한 갭(표면 축 누락, 약한 경합 단언, 정보 노출 메시지)을 정확히
겨냥해 닫았다. 실제로 유닛 테스트 16개를 실행해 통과를 확인했고, 신설 SQL e2e의 경합 테스트는 `pg_stat_activity` 기반
결정적 인터리빙 제어로 레이스 컨디션을 견고하게 재현한다. Critical/Warning 급 결함은 찾지 못했다. 유일하게 남는 지점은
production의 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 집합이 export 되지 않아 테스트가 리터럴을 복제한 점("이름 추가" 방향
회귀에 둔감)과, 신규 경합 e2e가 만드는 예약 행 2개가 (설계상 의도대로) 영구히 청소되지 않는다는 점 — 둘 다 INFO 수준이며
차단 사유는 아니다.

## 위험도

NONE
