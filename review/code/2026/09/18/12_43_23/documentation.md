# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 새로 확립한 "신규 추가 + DROP-먼저 잔재정리" 인덱스 패턴이 두 canonical 컨벤션 문서에 반영되지 않음
  - 위치: `codebase/backend/migrations/README.md:141` (`**인덱스 교체는 DROP-먼저**` 절), `codebase/backend/migrations/README.md:168-173` (V056/V106 대조표), `spec/conventions/migrations.md:74-77` (§5 하단 "인덱스 교체는 별도 패턴이 있다" 안내)
  - 상세: `V111__trigger_workflow_id_index.sql`(`codebase/backend/migrations/V111__trigger_workflow_id_index.sql:31-33`)은 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 두 문장을 쓴다. 그런데 README §5 "인덱스 교체는 DROP-먼저"·migrations.md §5 의 "인덱스 교체는 별도 패턴이 있다"는 문면 그대로 **기존 인덱스를 "갈아 끼우는"(교체) 경우**를 대상으로 서술한다("옛 인덱스를 새 것으로 갈아 끼우는 파일은…", "기존 인덱스를 갈아 끼우는 마이그레이션은…"). V111 은 교체가 아니라 **순수 신규 추가**(같은 이름의 옛 인덱스가 존재한 적이 없음)인데도 0)+1) 잔재정리 DROP 을 쓴다 — README 자체가 예시로 든 두 선례(`V056`=진짜 교체, `V106`=짝 DROP 없는 순수 신규 추가로 "영영 유효해지지 않는" 리스크를 감수)중 어디에도 해당하지 않는 **세 번째 형태**다. 이 개선된 패턴(신규 추가에도 방어적 DROP 을 두어 V106 의 영구-invalid 리스크를 없앤 형태)에 대한 근거는 V111.sql 자신의 헤더 주석과 `plan/in-progress/spec-draft-trigger-workflow-index.md` 의 "## 구현" 절에만 있고, 향후 마이그레이션 작성자가 실제로 참조하는 **README/migrations.md 본문 어디에도 이 패턴이 "신규 추가에도 적용 가능/권장"이라고 등재돼 있지 않다**. README 표(168-173행)를 참조하는 사람은 여전히 "신규 추가면 V106 처럼 CREATE 만" 이라는 인상을 받을 수 있고, V106 이 갖는 영구-invalid 리스크를 다시 반복할 수 있다.
  - 참고: 이 특정 긴장은 `review/consistency/2026/09/18/12_18_52/rationale_continuity.md`(INFO 3)가 이미 "V106 형태 채택이 V110 과 다른 이유가 draft 에 명시돼 있지 않다"고 지적했고, developer 는 V111.sql 헤더 주석에 한 줄(“## CREATE 앞에 DROP 을 두는 이유(신규 추가인데도)”)을 추가하는 것으로 해소했다("README §5 스코프상 정당"으로 판정됨). 그 해소는 **이 파일 하나의 정당화**로는 충분하지만, README/migrations.md 라는 **재사용 가능한 가이드**에는 여전히 반영되지 않았다 — 다음 net-new 인덱스 작성자는 이 V111.sql 코멘트를 우연히 읽지 않는 한 이 판단을 재발견해야 한다.
  - 제안: README §5 대조표(168-173행)에 `V111`(신규 추가 + 방어적 DROP, 짝이 되는 "옛 인덱스 DROP" 없음)을 세 번째 행으로 추가하거나, 최소한 "신규 추가에도 0) 잔재정리 DROP 을 두는 편이 V106 보다 안전하다"는 권고 문장을 §5 에 명시한다. `spec/conventions/migrations.md` §5 의 "인덱스 교체는 별도 패턴이 있다" 문구도 "교체"에 "신규 추가+방어적 DROP" 을 포함하도록 범위를 넓히는 것을 고려.

- **[INFO]** 구현물 3곳이 아직 존재하지 않는 `plan/complete/spec-draft-trigger-workflow-index.md` 경로를 인용
  - 위치: `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:196`(JSDoc), `spec/1-data-model.md:987`
  - 상세: 세 곳 모두 "실측·근거는 `plan/complete/spec-draft-trigger-workflow-index.md`" 라고 적지만, 실측 시점 현재 이 파일은 `plan/in-progress/spec-draft-trigger-workflow-index.md` 에 있다(`plan/complete/spec-draft-trigger-workflow-index.md` 는 `ls` 상 존재하지 않음). 다만 이는 미검토 누락이 아니라 **의도된 절차**다 — `plan/in-progress/spec-draft-trigger-workflow-index.md` 자신의 체크리스트가 "`--impl-prep` WARNING 1: … draft 이동을 이 PR 의 마지막 커밋에서 한다 — 다른 PR 로 떼지 않는다(선례 #1285 와 같다)"라고 명시하고, 실제로 선례 `V110__schedule_workspace_next_run_index.sql` 도 같은 방식(커밋 시점엔 `in-progress`, PR 마지막 커밋에서 `plan/complete/spec-draft-schedule-index.md` 로 이동)을 썼고 현재 `plan/complete/spec-draft-schedule-index.md` 로 존재해 정합이 맞는 것으로 확인했다. 즉 이 PR 의 마지막 커밋(체크리스트 항목 "트래커 반영 · 이 draft `complete/` 이동", 현재 미체크)에서 draft 를 이동하면 세 인용은 저절로 정확해진다.
  - 제안: 별도 조치 불요 — 이 PR 의 마지막 커밋에서 draft 이동이 실제로 수행되는지만 확인(체크리스트 항목이 이미 추적 중).

## 요약

핵심 구현 파일(`trigger-resource-releaser.service.ts`, 대응 unit/e2e 스펙, V111 마이그레이션 SQL/.conf)의 JSDoc·인라인 주석·마이그레이션 헤더 주석은 이례적으로 상세하고 실제 코드·spec 원문과 정확히 일치한다(예: `select: { id, type, config }` 축소가 실제 소비처인 `teardownChatChannel`/`scheduleRunner`/`channelListenerRegistry` 사용과 정확히 대응함을 소스 대조로 확인). `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 갱신도 실측 수치·인접 관례와 정합하며, 선행 5개 consistency checker 가 이미 CRITICAL/WARNING 0건으로 통과시킨 정밀한 검토를 거쳤다. 다만 이번 PR 이 실제로 확립한 "신규 추가 인덱스에도 방어적 DROP-먼저를 적용"하는 개선된 패턴이 재사용 가능한 컨벤션 문서(`migrations/README.md` §5, `spec/conventions/migrations.md` §5)에는 반영되지 않아, 다음 net-new 인덱스 작성자가 이 판단을 다시 발견해야 하는 갭이 남아 있다(WARNING 1건). 그 외 `plan/complete/…` 선반영 인용 3곳은 선례(#1285/V110)와 동일한 절차이며 체크리스트로 추적 중이라 실질적 결함은 아니다(INFO).

## 위험도
LOW
