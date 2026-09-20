# 성능(Performance) 리뷰 — rotate 동시성 lost-update 수정

## 발견사항

- **[INFO]** `pessimistic_write` 락 획득에 대기 상한(`lock_timeout`/`statement_timeout`)이 없음 — 경합 시 커넥션 풀 점유가 늘어날 수 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1146`~`1151` (`this.dataSource.transaction` 블록의 `repo.findOne({ ..., lock: { mode: 'pessimistic_write' } })`)
  - 상세: 트랜잭션이 시작되는 순간 커넥션 풀에서 커넥션 하나를 점유한 채로 락 대기를 한다. 같은 `id`(같은 통합)에 대해 rotate 가 짧은 간격으로 여러 번 겹치면(예: 클라이언트 재시도 버그, 스크립트 오작동), 대기 중인 각 요청이 커넥션을 계속 붙들고 있어 극단적인 경우 풀 고갈로 이어질 수 있다. 다만 이는 **같은 모듈의 기존 선례**(`integration-oauth.service.ts` CONC H-3, 재인증 콜백)와 정확히 같은 패턴이고, plan(`plan/in-progress/rotate-lost-update.md` INFO 2)에서 "임계 구간에 외부 호출이 없어 대기가 짧다(다른 rotate 의 재읽기+머지+UPDATE 만큼, 밀리초 단위)"는 근거로 의도적으로 타임아웃을 두지 않기로 결정했음을 확인했다. rotate 는 사용자가 수동으로 트리거하는 저빈도 admin 작업이라 실제 위험은 낮다.
  - 제안: 현재 설계 그대로 진행 가능. 다만 향후 이 엔드포인트가 자동화 스크립트(주기적 credential rotation 등)에서 고빈도로 호출되는 방향으로 바뀐다면, 같은 `id` 에 대한 동시 rotate 를 애플리케이션 레벨에서 짧게 debounce 하거나 `lock_timeout` 을 명시하는 것을 재검토할 필요가 있다.

- **[INFO]** 트랜잭션 도입으로 rotate 1회당 DB 왕복 횟수가 증가 (기존 최대 2회 → 최대 5회: `requireEntity` findOne · BEGIN · lock 포함 findOne · update · findOne · COMMIT)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 전체 (라인 1085 `requireEntity` 호출부터 1209 트랜잭션 종료까지)
  - 상세: 락 안에서 행을 다시 읽고(`repo.findOne` with lock), `update` 후 재조회까지 하므로 왕복이 늘었다. 각 왕복은 단일 PK 조회/갱신이라 개별 비용은 작고, 이 경로를 지배하는 비용은 바로 앞의 실제 접속 연결 테스트(수 초)이므로 상대적 영향은 미미하다. lost-update 를 고치기 위한 필수 대가로 보이며, 별도 조치는 불필요.
  - 제안: 조치 불필요. 다만 추후 성능 프로파일링 시 이 경로의 왕복 증가를 인지하고 있을 것.

- **[INFO]** `validateCredentials` 가 rotate 1회당 2번(연결 테스트 전 1회, 락 안 재검증 1회) 호출됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1108`(기존) 및 `1172`(신규, 락 블록 안)
  - 상세: `service-registry.ts` 의 `validateCredentials` 구현(라인 792)을 확인했다 — 대상 서비스 variant 의 필드 몇 개를 순회하는 순수 함수로, 비용이 O(필드 수)에 불과해 무시할 만하다. 코드 주석도 "순수 함수라 임계 구간을 늘리지 않는다"고 명시하고 있으며 실제로도 그렇다.
  - 제안: 조치 불필요.

## 요약

핵심 변경은 `IntegrationsService.rotate()` 의 lost-update 수정으로, 외부 연결 테스트(수 초)를 트랜잭션 밖에 두고 트랜잭션 안에서는 `pessimistic_write` 락으로 행을 다시 읽어 그 위에 머지하는 구조다. 같은 모듈의 기존 선례(CONC H-3)와 동일한 패턴을 재사용했고, 임계 구간(재읽기+검증+UPDATE+재조회)은 짧고 순수 계산만 포함해 알고리즘적으로 무겁지 않다. DB 왕복이 다소 늘고 락 대기 상한이 없다는 점이 눈에 띄지만 둘 다 저빈도 admin 작업이라는 특성과 기존 선례에 비추어 의도된 트레이드오프이며, 반복문 내 N+1 호출·불필요한 대량 메모리 할당·O(n²) 문자열 연산 등 심각한 성능 결함은 발견되지 않았다. 테스트 파일(unit/e2e) 역시 성능에 영향 없는 순수 검증 코드다.

## 위험도
LOW
