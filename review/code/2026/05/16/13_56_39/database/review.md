### 발견사항

- **[INFO]** `attention` 가상 필터의 WHERE 절에 인덱스 활용 가능성 확인 필요
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — 추가된 `else if (status === 'attention')` 블록
  - 상세: 생성된 WHERE 절은 `i.status IN ('expired', 'error') OR (i.status = 'connected' AND i.token_expires_at IS NOT NULL AND i.token_expires_at > NOW() AND i.token_expires_at <= NOW() + INTERVAL '7 days')` 형태다. OR 조건은 일반적으로 인덱스 병합(Index Merge) 또는 비트맵 OR 스캔으로 처리되지만, `status` 컬럼과 `token_expires_at` 컬럼에 각각 단일 인덱스만 존재하는 경우 옵티마이저가 풀 스캔을 선택할 수 있다. 특히 workspace 단위 필터링(`workspace_id`)과 함께 복합 인덱스가 없다면 대용량 테이블에서 성능 저하가 우려된다.
  - 제안: `(workspace_id, status)` 복합 인덱스가 이미 있는지 확인하고, 없다면 `CREATE INDEX CONCURRENTLY idx_integrations_ws_status ON integrations(workspace_id, status)` 를 추가하는 마이그레이션을 검토한다. `token_expires_at` 범위 조건이 자주 실행된다면 `(workspace_id, status, token_expires_at)` 또는 `(workspace_id, token_expires_at) WHERE status = 'connected'` 부분 인덱스(Partial Index)도 고려한다.

- **[INFO]** `NOW()` 함수를 인라인 SQL 리터럴로 사용 — 파라미터화 여부 확인
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — 추가된 OR 절 내 `NOW()` 및 `NOW() + INTERVAL '7 days'`
  - 상세: 해당 쿼리는 TypeORM QueryBuilder 의 `andWhere()` 에 날짜 비교를 SQL 함수(`NOW()`)로 직접 삽입하고 있다. 외부 입력값이 포함되지 않으므로 SQL 인젝션 위험은 없다. 다만 테스트에서 `"7 days"` 문자열의 존재만 검증하므로(spec 값 하드코딩 검증), 향후 임박 기간 임계값(현재 7일)을 설정화하거나 파라미터로 변경할 때 리터럴 SQL 방식은 수정이 번거롭다.
  - 제안: 당장 인젝션 위험은 없으나, 임계값을 파라미터로 분리해두면 유지보수성이 향상된다. 예: `qb.andWhere('i.token_expires_at <= NOW() + INTERVAL :days', { days: '7 days' })`. TypeORM 이 interval 파라미터를 올바르게 바인딩하는지 확인 필요.

- **[INFO]** `attention` 필터의 페이지네이션 동작 — 기존 패턴 그대로 상속
  - 위치: `backend/src/modules/integrations/integrations.service.ts`
  - 상세: `attention` 분기는 기존의 `status=expired`, `status=error` 분기와 동일하게 QueryBuilder 조건 추가 후 `orderBy('i.created_at', 'DESC')` + 페이지네이션을 그대로 사용한다. 별도 집계 쿼리 없이 attention 집합을 페이지네이션하므로 대용량 attention 목록에서도 기존 패턴과 동등한 성능을 보인다. 문제는 없으나, attention 목록이 수천 건 이상으로 증가하는 시나리오에서 `OFFSET` 기반 페이지네이션의 일반적 한계는 공유된다(이는 기존 코드 문제이며 이번 변경의 범위가 아님).
  - 제안: 특이사항 없음. 기존 페이지네이션 패턴을 그대로 사용하고 있어 일관성 측면에서 적절하다.

### 요약

이번 변경은 `attention` 이라는 가상 필터값을 DB enum 에 추가하지 않고 서버 레이어에서 OR 조합 WHERE 절로 변환하는 올바른 설계를 취하고 있다. 마이그레이션 없이 기존 스키마를 그대로 유지하므로 무중단 배포 위험이 없다. SQL 인젝션 우려도 없다(외부 입력값이 SQL에 직접 삽입되지 않음). 다만 `(workspace_id, status, token_expires_at)` 방향의 복합 또는 부분 인덱스가 존재하지 않을 경우, OR 절이 포함된 쿼리에서 옵티마이저가 비효율적인 스캔을 선택할 수 있어 대용량 환경에서 점검이 권장된다. 전반적으로 DB 관련 위험도는 낮으며, 기존 패턴을 일관성 있게 확장한 변경이다.

### 위험도
LOW
