# 성능(Performance) Review — keyset 커서 UUID 검증 (filter-pg-invalid-text)

## 발견사항

- **[INFO]** 검증 로직은 O(1)·비-backtracking 정규식이며, 오히려 실패 경로의 DB 왕복을 줄인다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:42-47` (`isUuidShaped`/`UUID_SHAPE_PATTERN`),
    호출부 `codebase/backend/src/modules/auth/login-history.service.ts:65`,
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180`
  - 상세: 신설 술어 `UUID_SHAPE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` 는
    고정 길이 그룹만 사용해 중첩 정량자가 없다 — 캐터스트로픽 백트래킹(ReDoS) 위험 없음. 요청당 정규식
    매치 1회(O(길이), 사실상 O(1))가 추가되는 정도로 알고리즘적 비용은 무시 가능하다.
    오히려 이 변경은 **성능상 개선**에 가깝다 — 종전에는 비-UUID `id` 성분이 그대로 쿼리 파라미터에
    바인딩되어 Postgres 까지 왕복한 뒤 SQLSTATE 22P02 예외를 던지고, TypeORM 드라이버 에러 매핑 +
    `GlobalExceptionFilter` 예외 처리 경로를 전부 타야 500 을 반환했다. 지금은 애플리케이션 레벨에서
    정규식 1회로 즉시 걸러 DB 라운드트립·드라이버 예외 생성 비용을 완전히 우회한다(fail-fast).
    `login-history.service.ts`(무시 후 1페이지)·`background-runs.service.ts`(400 즉시 throw) 두
    경로 모두 동일하게 해당.
  - 제안: 조치 불요 — 긍정적 부수효과로만 기록.

- **[INFO]** 신규 e2e 테스트 2건이 e2e 스위트 실행 시간에 소폭 추가되나 무시 가능한 수준
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts` (`it('커서 i 가 비-UUID 면 500 이 아니라 400 INVALID_CURSOR …')`),
    `codebase/backend/test/session-revocation.e2e-spec.ts` (`it('F. 커서 id 가 비-UUID 여도 500 이 아니라 200 + 1페이지 …')`)
  - 상세: 각 케이스는 워크플로우 생성·실행·폴링(`pollExecution`, 최대 15초 타임아웃) 등 기존 헬퍼를
    재사용한다. 폴링은 이 파일의 사전 존재 패턴이며 이번 변경이 새로 도입한 병목은 아니다. HTTP
    요청 수가 케이스당 2~4회 늘어나는 정도로 CI 실행 시간에 유의미한 영향은 없다.
  - 제안: 조치 불요.

- **[INFO]** `decodeCursor` 내 검증 순서 — id 검증이 base64/JSON/날짜 검증 뒤에 위치해 비용이 큰 파싱이 먼저 실행됨
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:150-181`
    (`decodeCursor`), `codebase/backend/src/modules/auth/login-history.service.ts:45-67` (`decodeCursor`)
  - 상세: `isUuidShaped(id)` 체크가 base64 디코드 + `JSON.parse` + `Date` 파싱 뒤에 실행된다. 이미
    비싼 순서로 보일 수 있으나, base64/JSON 파싱 자체가 짧은 문자열(커서 페이로드) 대상이라 실질
    비용은 마이크로초 이하이고, 검증 순서를 바꿔도 관측 가능한 성능 차이가 없다. 다만 두 디코더의
    실패 경로가 모두 "짧은 문자열 파싱 → 값 형태 검증" 순서를 따르는 것은 가독성·유지보수 목적상
    합리적이며 성능 이슈로 볼 근거는 없다.
  - 제안: 조치 불요 — 참고로만 기록.

## 요약

이번 변경은 keyset 커서의 `id` 성분에 `isUuidShaped` (고정 길이·비-backtracking 정규식) 검증을 추가하는 것이
핵심이며, 알고리즘 복잡도·N+1·메모리 할당·캐싱·블로킹 I/O·데이터 구조·지연 로딩 어느 관점에서도 새로운
리스크를 도입하지 않는다. 오히려 종전에는 비-UUID 값이 Postgres 까지 흘러가 SQLSTATE 22P02 예외 생성·드라이버
에러 매핑·전역 필터 처리라는 무거운 실패 경로를 매번 태웠던 것을, 애플리케이션 레벨의 O(1) 정규식 검사로
조기 차단(fail-fast)하도록 바꿔 실패 케이스의 DB 부하와 지연을 줄이는 방향으로 개선됐다. 신규 e2e 테스트도
기존 폴링 헬퍼를 재사용할 뿐 새로운 병목을 만들지 않는다. 성능 관점에서 우려할 사항이 없다.

## 위험도
NONE
