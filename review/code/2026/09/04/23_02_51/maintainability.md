# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

`codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규 마이그레이션 쌍),
`codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 e2e 스키마 테스트 1건 추가)를 코드 변경의
핵심으로 보고 분석했다. 나머지 파일(`plan/in-progress/*.md`, `spec/1-data-model.md`,
`spec/data-flow/10-triggers.md`, `review/consistency/2026/09/04/22_34_55/**`)은 문서/plan/자동 생성된
consistency-check 세션 산출물이라 "가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도" 등 코드 유지보수성
관점의 점검 대상이 거의 없다 — 해당 부분은 `spec/1-data-model.md`와 `spec/data-flow/10-triggers.md`
양쪽 미러가 이미 이 diff 안에서 함께 갱신되어 있음을 확인(consistency-checker의 WARNING #1이 이미 반영됨)한
정도만 크로스체크했다.

기존 코드베이스와의 일관성 확인을 위해 `codebase/backend/migrations/V056__notification_active_partial_index.sql`,
`V072__integration_unify_store_identifier_index.sql`, `codebase/backend/test/notifications-dismiss.e2e-spec.ts`
등 선례를 직접 열어 대조했다.

## 발견사항

- **[INFO]** 마이그레이션 헤더에 실측 벤치마크 표 전문을 그대로 박아 넣어 `plan/` 문서와 동일 데이터가 두 곳에 존재 — 한쪽(마이그레이션)은 append-only 로 사실상 불변, 다른 쪽(plan)은 가변
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:14`~`19` (실측 표), 대응하는 `plan/in-progress/spec-draft-schedule-index.md:37`~`45`
  - 상세: 같은 벤치마크 수치(`5.99 ms` / `12.77 ms` / `0.30 ms` / `20배` 등)가 마이그레이션 SQL 주석과 plan 문서 양쪽에 리터럴로 중복된다. 이 저장소의 `migrations.md §3` append-only 원칙상 머지된 `V<N>` 파일은 이후 수정이 금지되므로, 만약 plan 문서 쪽 수치가 나중에 다시 정정되면(이번 PR 내에서도 실제로 초안 수치 `7.80/12.39/0.188/31배` → 최종 `5.99/12.77/0.30/20배` 로 한 번 정정된 이력이 `review/consistency/2026/09/04/22_34_55/_target/spec-draft-schedule-index.md` 스냅샷에 남아 있다) 마이그레이션 헤더의 사본은 영구적으로 stale 상태로 굳는다. `V056`/`V072` 선례는 근거·결정을 서술식으로만 남기고 원표 그대로의 벤치마크 테이블은 옮기지 않는 정도로 그쳐, 이번 V110 헤더(34줄, 이 저장소 인덱스 마이그레이션 중 최장)만큼 원본 데이터를 그대로 복제하지는 않는다.
  - 제안: 결함은 아니고 저장소가 이미 "인덱스 실측은 문서에 남기는 관례"(`plan/complete/refactor/05-database.md` 등)를 갖고 있어 의도된 선택으로 보이지만, 다음에 유사 패턴을 쓸 때는 마이그레이션 헤더에는 "결론 + plan 문서 링크"만 남기고 원표는 plan 쪽에만 두는 편이 SoT 중복을 줄인다는 점을 참고 남김.

- **[INFO]** 신규 e2e 테스트의 주석 스타일이 같은 파일의 다른 테스트보다 훨씬 무겁다 (내용 자체는 정당하지만 파일 내 스타일 일관성만 참고)
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:54`~`63` (JSDoc 블록, `it('schema: schedule 인덱스가 (workspace_id, next_run_at) 로 교체됨 (V110)'` 바로 위)
  - 상세: 같은 파일의 나머지 9개 테스트(`A.`~`I.`)는 주석이 없거나 최대 1줄 인라인 주석(예: `:247` `// [data-flow 10-triggers §1.4] 역방향(...) 동기화 — PATCH /api/triggers/:id 경유.`)인데, 이 테스트만 10줄짜리 JSDoc 블록을 둔다. `schema:` 접두 네이밍 자체는 `notifications-dismiss.e2e-spec.ts:109,120`에 이미 선례가 있어 파일 간에는 일관되고 문제 없다 — 다만 이 신규 테스트가 "왜 양방향(신규 인덱스 존재 + 구 인덱스 부재)을 다 검증해야 하는지"를 설명하는 근거는 타당하므로(단방향만 보면 구 인덱스 부활을 놓친다는 논지), 결함이라기보다 파일 내 주석 밀도 편차 정도로만 남긴다.
  - 제안: 별도 조치 불필요. 이후 같은 파일에 스키마 테스트가 늘어나면 공통 설명은 파일 상단 `describe` 블록 주석으로 한 번만 두고 개별 `it` 은 짧게 유지하는 방향을 고려.

- **[INFO]** `.conf`/`.sql` 페어, `executeInTransaction=false` 사유 주석, `CONCURRENTLY` + `IF NOT EXISTS`/`IF EXISTS` 재실행 안전성, DOWN 롤백 주석 형식 모두 `V056`/`V105`/`V106`/`V109` 선례와 정확히 일치 — 별도 발견사항 없음(확인용 기록).

## 요약

실질 코드 변경(V110 마이그레이션 쌍 + e2e 테스트 1건)은 이름·구조·재실행 안전성·주석 관례 모두 저장소 기존 패턴(`V056`, `V072`, `V105/106/109`, `notifications-dismiss.e2e-spec.ts`)을 그대로 따르고 있어 가독성·네이밍·일관성 면에서 결함이 없다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 관점에서 지적할 대상 자체가 거의 없을 만큼 변경 규모가 작고 단순하다(SQL 5줄 실행문 + 테스트 1개 `it` 블록). 유일하게 참고할 만한 지점은 마이그레이션 헤더에 원본 벤치마크 표를 통째로 복제해 append-only 파일과 가변 plan 문서 사이에 SoT 가 갈릴 여지를 만든 것인데, 이는 저장소가 이미 채택한 "인덱스 실측을 문서에 남기는" 관례의 연장선이라 결함보다는 향후 참고 사항에 가깝다. Critical·Warning 급 유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
