# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** 신규 인덱스가 partial → full 전환되며 크기가 약 48% 증가(200,000행 기준 5,368 kB → 7,960 kB) — 읽기 20배 개선의 트레이드오프인 쓰기 경로(INSERT/UPDATE 시 인덱스 유지보수) 비용은 크기 변화로만 추정되고 별도 벤치마크(지연시간·처리량)가 없다.
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:27` (`-- 크기: 5,368 kB(부분) → 7,960 kB(전체 행). 200,000행 기준 +2.6 MB.`)
  - 상세: 종전 인덱스는 `WHERE is_active = TRUE` partial 이라 활성 70%(140,168/200,000행)만 유지보수 대상이었다. 신규 `(workspace_id, next_run_at)` 은 non-partial 이라 비활성 30%(schedule 이 자주 편집되진 않지만, 존재만으로 매 INSERT/UPDATE 마다 인덱스 엔트리 갱신 대상)까지 포함한다. `schedule-runner.service.ts` 의 `UPDATE last_run_at, next_run_at`(발사 후 재계산)이 활성 스케줄에서 cron tick 마다 반복되므로, 워크스페이스당 스케줄 수·평균 cron 주기가 커지면 이 증가분이 누적될 수 있다. 문서는 이 트레이드오프를 명시적으로 인지(Rationale "쓰기 비용만 낸다")하고 있으나 실측치는 아니다.
  - 제안: 읽기 성능 개선폭(20배)이 압도적이라 결정을 뒤집을 사안은 아니다. 다만 실제 프로덕션 스케일에서 스케줄 UPDATE 처리량이 높다면(예: 대량 테넌트 + 짧은 cron 주기) 배포 후 `pg_stat_user_tables`(`n_tup_upd`)·인덱스 쓰기 지연 모니터링을 권장.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 자체의 빌드 소요 시간(운영 중 적용 시 실제 락 보유 기간)이 실측·문서화되지 않았다 — `.conf`/`.sql` 주석은 "실측·운영 영향"을 언급하지만 본문에 있는 실측은 전부 *생성 완료 후* 쿼리 성능 비교이고, 빌드 자체의 소요 시간은 없다.
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf:3` (`# 자세한 실측·운영 영향·롤백 절차는 ... 참조`), `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:35-36`
  - 상세: `CREATE INDEX CONCURRENTLY` 는 테이블을 락하지 않지만 `SHARE UPDATE EXCLUSIVE` 를 유지하는 동안 다른 DDL(예: 동시 배포되는 다른 마이그레이션의 `ALTER TABLE schedule`)과 충돌할 수 있고, 대상 테이블 스캔에 필요한 시간만큼 실행된다. 8MB 미만 인덱스 크기(측정치)로 미루어 실제 운영 규모에서도 위험은 낮아 보이지만, 그 판단 근거(예상 소요 시간)가 문서에 명시돼 있지 않다.
  - 제안: 크리티컬한 사안은 아니므로 blocking 은 아니나, 배포 런북에 "N만 행 기준 예상 소요 Xs" 정도를 추정치로 남기면 향후 훨씬 큰 테이블에 재적용할 때 참고 근거가 된다.

- **[INFO]** e2e 회귀 테스트(`schema: schedule 인덱스가 ... 로 교체됨`)는 인덱스의 **존재·컬럼 순서·non-partial 여부**만 검증하고, 실제 쿼리 플래너가 그 인덱스를 **선택하는지**(`EXPLAIN`)는 검증하지 않는다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:64-82`
  - 상세: 이 PR 의 핵심 성능 주장(20배 개선)은 "인덱스가 존재한다"가 아니라 "플래너가 그 인덱스로 목록 쿼리를 서빙한다"는 것이다. 스키마 드리프트(인덱스가 사라지거나 컬럼 순서가 바뀌는 것)는 이 테스트로 잡히지만, 통계 미갱신·행 분포 변화 등으로 플래너가 향후 다시 Seq Scan 을 고르게 되는 회귀는 이 테스트가 감지하지 못한다.
  - 제안: e2e 환경의 시드 데이터 규모가 통계적으로 유의미하지 않을 수 있어 `EXPLAIN` 단언을 e2e 에 넣는 것은 flaky 위험이 있다는 점은 이해된다. 강제하기보다는, 리스크를 인지하고 있다는 점만 기록해 두면 충분하다.

## 요약

이번 변경의 핵심은 `schedule` 테이블의 목록 조회 인덱스를 `(next_run_at, is_active) WHERE is_active` (사용되지 않던 partial 인덱스)에서 `(workspace_id, next_run_at)` (전체 행)로 교체하는 Flyway 마이그레이션(V110)이다. `EXPLAIN (ANALYZE, BUFFERS)` 기반 실측(200,000행/2,000 워크스페이스, 5회 반복 median)으로 목표 쿼리(`WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`)가 5.99ms → 0.30ms(20배)로, 기본 정렬(`ORDER BY created_at`)도 6.89ms → 1.08ms(6.4배)로 개선됨을 확인했고, 오답 후보였던 "정렬 컬럼만 남기는 안"이 오히려 2.2배 느려짐(플래너가 인덱스를 선택해 39,797개 엔트리를 버리며 스캔)까지 실측으로 배제한 것은 이 리뷰가 본 마이그레이션 중 드문 수준의 근거 밀도다. `CREATE/DROP INDEX CONCURRENTLY` + `executeInTransaction=false` + `IF NOT EXISTS/IF EXISTS`(부분 실패 후 재실행 안전) 조합은 무중단 배포 관례(V056 선례)를 정확히 따른다. e2e 테스트도 "새 인덱스 존재"만이 아니라 "옛 인덱스 DROP 확인"까지 양방향으로 걸어 교체의 절반이 조용히 안 닫히는 회귀를 방지한다. 발견한 사항은 모두 INFO 수준(쓰기 경로 비용 미측정, 빌드 시간 미문서화, 플래너 선택 여부는 스키마 테스트로 커버 못함)이며 이 변경을 막을 사유가 아니다.

## 위험도
LOW
