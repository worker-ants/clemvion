# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** V131 중복 정리가 set-based `UPDATE` 대신 행 단위 PL/pgSQL 루프를 쓴다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:30-46` (`FOR r IN … LOOP` ~ `END LOOP;`, 특히 `40`행 `UPDATE trigger SET endpoint_path = gen_random_uuid()::text, … WHERE id = r.id;`)
  - 상세: 중복 묶음마다 "나머지" 행을 하나씩 커서로 순회하며 개별 `UPDATE` 를 실행한다. 동일한 결과는 `row_number()` CTE 를 그대로 `UPDATE … FROM dupes` 조인으로 바꿔 한 문장으로 처리할 수 있어, 중복 건수가 많아지면(공격 흔적이 대량으로 남아 있는 경우) 행 단위 루프가 set-based UPDATE 보다 느리다. 다만 이 파일 자신의 Rationale 이 "정상 경로로는 중복이 생기지 않는다 — 중복이 있다면 복사 등록의 흔적" 이라고 명시해 실제 영향 행 수는 극소수로 예상되고, 루프는 트리거 id·워크스페이스 id·chat_channel 여부를 행마다 `RAISE NOTICE` 로 남기기 위한 의도적 설계다(감사 로그 요구사항). 즉 처리량 문제가 아니라 진단 목적의 트레이드오프이므로 현재 규모에서는 문제 되지 않는다.
  - 제안: 없음(현 상태 수용 가능). 다만 duplicate 수가 비정상적으로 커질 수 있는 환경(대량 공격 흔적)이라면 사전에 `SELECT count(*) … WHERE rn > 1` 로 영향 행 수를 가늠한 뒤 실행하는 운영 절차를 README/운영 노트에 남겨 두면 좋다.

- **[INFO]** V131 의 후보 산출 서브쿼리가 `endpoint_path IS NOT NULL` 전체 행에 대해 `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)` 를 계산한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:32-37` (서브쿼리 `SELECT id, workspace_id, (config ? 'chatChannel') …` ~ `FROM trigger WHERE endpoint_path IS NOT NULL`)
  - 상세: 실제 중복 여부와 무관하게 webhook 트리거 전체(`endpoint_path IS NOT NULL`)를 `endpoint_path` 기준으로 정렬/파티셔닝해야 하므로 O(n log n) 풀 스캔·정렬이 매 실행마다 발생한다. 마이그레이션 헤더는 정책·재현 절차는 자세히 실측했지만(묶음 2·셋 케이스), 이 전체 스캔 자체의 실행 시간·락 보유 시간은 실측 수치가 문서에 없다 — V132 헤더의 "웹훅 트리거 5만" 수치는 조회 쿼리(`hooks.service` 등) 성능 실측이지 V131 DO 블록의 실행 시간 실측이 아니다. 현재 규모(5만 행 안팎)에서는 무시할 수준이겠으나, 다음에 이런 dedupe 마이그레이션을 벤치마킹할 때는 DO 블록 자체의 소요 시간도 같이 재는 것이 좋다.
  - 제안: 없음(차단 사유 아님) — 참고용 기록.

## 확인한 항목 (성능 개선/중립, 문제 아님)

- V132 는 `CREATE UNIQUE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY` 로 테이블 장기 락 없이 인덱스를 교체한다(README §5, V110 선례와 동일 패턴) — `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21-25`. `executeInTransaction=false`(`.conf`) 로 트랜잭션 블록 제약도 올바르게 회피했다.
- 인덱스 선두 컬럼이 `(workspace_id, endpoint_path)` → `(endpoint_path)` 로 바뀌면서, 워크스페이스를 모르는 수신 조회(`hooks.service.ts:115`, `public-webhook-throttle.guard.ts:70`, `embed-config.service.ts:44` 의 `where: { endpointPath, … }`)가 예전엔 해당 인덱스를 리딩 컬럼 불일치로 전체 스캔했던 것을, 이제 직접 인덱스 탐색으로 바꾼다 — 마이그레이션 주석에 적힌 실측(웹훅 트리거 5만에서 0.200 ms → 0.025 ms)과 코드상 조회 패턴이 일치한다. 이번 변경의 성능적 부수 효과는 개선이다.
- `triggers.service.ts` 의 `findByEndpointPath(workspaceId, endpointPath)` (`where: { workspaceId, endpointPath }`, 1682~1689행)는 이번 diff 대상이 아닌 기존 코드이며 현재 어디에서도 호출되지 않는(dead code) 상태를 grep 으로 확인했다 — `idx_trigger_workspace_endpoint` 제거로 이 쿼리의 실행 계획이 바뀔 여지는 있으나(이제는 `endpoint_path` unique 인덱스로 단일 행을 먼저 찾고 `workspace_id` 를 필터링하는 편이 오히려 더 빠르다), 호출부가 없어 실질적 영향은 없다. 이번 PR 이 만든 결함이 아니므로 별도 조치는 불요.
- `triggers.controller.ts`(Swagger 설명 문구), `triggers.service.spec.ts`/`webhook-trigger.e2e-spec.ts`(테스트 픽스처·assertion 문구), `triggers.service.ts` 의 상수 값 재배선(`TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`)과 에러 메시지 문자열 변경은 런타임 경로에 추가 연산·할당·I/O 를 더하지 않는다.
- 신규 e2e 테스트(B5, B6)는 HTTP 왕복·DB 카탈로그 조회를 추가하지만 테스트 실행 시간 증가일 뿐 운영 코드 경로의 성능과 무관하다.
- N+1 쿼리, 블로킹 I/O, 캐싱 전략 변경, 불필요한 문자열 누적, 부적절한 자료구조 사용은 diff 범위에서 발견되지 않았다.

## 요약

이번 변경은 보안 결함(웹훅 `endpoint_path` 워크스페이스 단위 UNIQUE → 전역 UNIQUE) 수정이 목적이며, 부수적으로 수신 웹훅 조회의 인덱스 탐색 방식을 리딩 컬럼 불일치 전체 스캔에서 직접 탐색으로 개선한다(마이그레이션 주석 실측: 0.200 ms → 0.025 ms). V131 dedupe 마이그레이션은 행 단위 `UPDATE` 루프와 전체 테이블 윈도우 함수 스캔을 쓰지만, 이는 감사 로그(NOTICE) 요구사항에 따른 의도적 설계이고 예상 영향 행 수가 극소수(복사 등록 흔적)라 현재 규모에서 실질적 위험은 낮다. V132 는 `CONCURRENTLY` 로 테이블 락 없이 인덱스를 교체해 배포 중 가용성에도 문제가 없다. 애플리케이션 코드(controller/service/test) 변경은 문구·상수 값 재배선 수준으로 성능에 영향을 주지 않는다. 전반적으로 성능 관점에서 심각하거나 즉시 조치가 필요한 결함은 없다.

## 위험도

LOW
