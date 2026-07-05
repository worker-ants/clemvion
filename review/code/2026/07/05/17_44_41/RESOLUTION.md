# RESOLUTION — V-10 트리거 목록 Schedule enrichment (17_44_41)

## 조치 항목

| # | Reviewer/위험도 | 발견 | 조치 |
|---|---|---|---|
| 1 | database / INFO(LOW) | `schedule.trigger_id` 인덱스 부재(Postgres FK 자동 인덱스 없음) — findAll 배치 조회가 목록 로드마다 seq scan(선존 갭이나 hot-path 화로 빈도 증가) | 마이그레이션 `V106__schedule_trigger_id_index.sql`(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id)`) + `.conf executeInTransaction=false`(V105 패턴 미러). CHANGELOG 반영 |
| 2 | testing / INFO(LOW) | batch("N+1 회피") 단언이 schedule 1건 fixture라 per-row loop 로 퇴행해도 통과(약한 가드) | unit 테스트를 schedule 2건 fixture 로 강화 — `find` 가 여전히 `toHaveBeenCalledTimes(1)` 이며 `In(['s-trig-1','s-trig-2'])` 양쪽 id 포함·둘 다 enrich 됨을 단언 |
| 3 | cross_spec / (초기 fatal) | orchestrator prompt payload 가 generic spec/2-navigation 내용이라 mismatch → 검토 불가 | 명시적 diff 컨텍스트로 cross_spec 재실행 → NONE(§2.1 약속 충족·데이터모델/§5.2 정합) |
| 4~ | testing INFO 2~5·database INFO 2~5 | cross-WS 단위검증·페이지경계·prototype·타입회귀 | **조치 불요** — where 절 `toHaveBeenCalledWith` 고정 검증·e2e C-2 end-to-end 직렬화 커버·로직 단순성. 리뷰어도 "조치 불요/낮은 우선순위" 판정 |

나머지 11개 Agent 위험도 NONE.

## TEST 결과

- lint / unit / build: 통과 (재수행 — 강화된 findAll 배치 테스트 포함)
- e2e: 통과 (재수행 — V106 마이그레이션 적용 + schedule-trigger C-2 목록 enrichment 검증)

## 보류·후속 항목

없음. (인덱스 UNIQUE 여부는 trigger_id 1:1 이나 기존 데이터 안전을 위해 non-unique 채택 — 스키마 의도 UNIQUE 강제는 별도 판단 사항으로 남김, 본 PR 은 perf 인덱스만.)
