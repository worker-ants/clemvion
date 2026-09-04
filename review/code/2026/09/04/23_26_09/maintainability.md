# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

실질 "코드" 변경은 3개 파일이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규, 4줄)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규, 63줄 — 주석 52줄 + DDL 11줄)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 파일에 `it` 블록 2개 추가: `schema:` 테스트, `J.` 테스트)

나머지(`plan/in-progress/*.md`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/code/2026/09/04/23_02_51/**`, `review/consistency/2026/09/04/{22_34_55,22_43_40}/**`)는 문서·plan·이전 리뷰 라운드 산출물이라 "함수 길이·중첩·매직넘버·복잡도" 관점의 점검 대상이 실질적으로 없다. 이 changeset 은 이전 라운드(`23_02_51`)가 이미 같은 SQL/conf/e2e 파일을 검토해 위험도 NONE 을 매긴 뒤, 그 라운드의 WARNING 4건을 단일 커밋(`dd6549796`)으로 조치하고 그 라운드 자신의 산출물까지 저장소에 커밋한 상태다. 저장소 파일은 건드리지 않았다 — `git status --short` 결과 `review/code/2026/09/04/23_26_09/` 만 untracked.

이전 라운드가 놓친 지점을 찾기 위해 `dd6549796` 로 새로 추가된 `it('J. ...')` 블록과, 이전 라운드 대비 이번 diff 에 새로 실린 `spec/1-data-model.md` `## Rationale` 항목을 중점적으로 대조했다.

## 발견사항

- **[WARNING]** 신규 `J.` 테스트가 파일 자체의 알파벳 레이블 관례를 깬다 — 물리적 위치가 `I.` 보다 앞인데 레이블은 `J.`
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)', ...)` 블록 (함수명·블록 위치 기준: `H.` 테스트 직후, `I.` 테스트 직전)
  - 상세: 이 파일은 `A.`부터 `I.`까지 9개 `it()` 블록을 **물리적 등장 순서와 알파벳이 정확히 일치**하도록 유지해 왔다(`A.`→`B.`→...→`H.`→`I.`, `grep -n "it('[A-Z]\."` 로 직접 확인). 이번 diff(`dd6549796`)가 새 `J.` 테스트를 `H.` 와 `I.` 사이에 삽입해, 실제 파일 순서는 `...G, H, J, I` 가 됐다 — `J` 가 `I` 보다 먼저 나온다. 파일을 위에서 아래로 훑는 독자는 이 관례를 신뢰해 레이블만 보고 위치를 가늠하는데, 이 파일에서 처음으로 그 가정이 깨진다. 기능적 결함은 아니지만(레이블은 문자열일 뿐이라 테스트 실행·통과 여부에는 영향 없음), 정확히 이 리뷰 관점(가독성·네이밍·일관성)의 대상이다. `RESOLUTION.md`/`SUMMARY.md`(`23_02_51`)의 testing 조치 항목은 "`J.` 테스트 신설"만 언급했을 뿐 삽입 위치의 순서 문제는 어느 라운드에서도 지적되지 않았다.
  - 제안: `J.` 블록을 파일 맨 끝(`I.` 테스트 뒤)으로 옮기거나, 두 블록의 레이블을 맞바꿔(`I.`↔`J.`) 물리적 순서와 알파벳이 다시 일치하도록 한다. 전자가 diff 도 더 작다.

- **[INFO]** 신규 `J.` 테스트 내부에 `asc`/`desc` 응답에서 시간 배열을 뽑는 로직이 거의 동일하게 두 번 반복
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts`, `it('J. ...')` 블록 — `ascTimes` 계산부와 `descTimes` 계산부 (같은 `map(nextRunAt) → filter(non-null) → map(getTime)` 3단 체인)
  - 상세: `ascTimes`/`descTimes` 모두 `.map((r) => r.nextRunAt).filter((v): v is string => v !== null).map((v) => new Date(v).getTime())` 형태를 그대로 반복한다. 로직이 단순해 즉각적인 가독성 문제는 아니지만, 같은 함수(같은 `it` 블록) 안에서의 반복이라 지역 헬퍼로 뽑으면 (예: `const toTimes = (rows) => rows.map(...).filter(...).map(...)`) 의도(오름차순/내림차순 각각에서 "정렬된 시각 목록"을 뽑는다는 것)가 더 분명해진다.
  - 제안: 결함은 아니고 우선순위 낮음 — 이후 같은 파일에 유사 검증이 하나 더 늘어날 때 추출을 고려.

- **[INFO]** 마이그레이션 헤더 주석이 이 저장소의 동종 마이그레이션 대비 눈에 띄게 길다 — 이전 라운드에서 이미 확인된 경향이 이번 라운드(`23_02_51` W1 대응)로 한 번 더 늘어남
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:1`~`51` (주석부, DDL 은 `:53`~`:63` 11줄뿐)
  - 상세: 직접 대조 결과 `V056__notification_active_partial_index.sql` 은 총 23줄, `V106__schedule_trigger_id_index.sql` 은 총 15줄인데 `V110` 은 총 63줄(주석 52줄) — 저장소의 인덱스 마이그레이션 중 최장이다. 이전 라운드(`23_02_51`)의 maintainability 리뷰가 이미 이 경향을 INFO 로 기록했었는데, 그 라운드의 W1(재실행 안전성) 조치가 `## IF NOT EXISTS 만으로는 재실행이 안전하지 않다` 절(약 20줄)을 추가로 얹으면서 격차가 더 벌어졌다. 저장소 관례(장애 대응 중 읽는 자리라 자체 완결적 수치가 기능)를 감안하면 의도된 선택으로 보이나, "코드보다 주석이 5배" 인 형태가 반복되면 다음 CONCURRENTLY 마이그레이션 작성자가 이 파일을 템플릿으로 복제할 유인이 커진다.
  - 제안: 결함 아님. 다만 W1 정정처럼 반복되는 안전성 설명은 파일 자체보다 `migrations/README.md` §5 나 `spec/conventions/migrations.md` 로 옮기고 마이그레이션 파일에는 그 문서로의 링크 한 줄만 남기는 편이, 앞으로 CONCURRENTLY 패턴을 쓰는 모든 신규 마이그레이션(`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 이 후속을 등재해 두었다)에서 헤더 비대화를 막는다 — 등재된 후속 항목과 같은 방향의 관찰.

- **[INFO]** 같은 벤치마크 표가 이제 세 곳(SQL 헤더/plan draft/spec Rationale)에 중복 — 이미 의도된 트레이드오프로 처분됨(확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:14`~`19`, `plan/in-progress/spec-draft-schedule-index.md` §1, `spec/1-data-model.md` `## Rationale` → `### Schedule 인덱스 ... (2026-09-04)`
  - 상세: `spec/1-data-model.md` 에 이번 diff 로 새로 추가된 `## Rationale` 항목이 동일 수치(5.99/12.77/0.30 ms)를 세 번째로 반복한다. 이전 라운드 maintainability 리뷰는 SQL-plan 2중 중복만 INFO 로 남겼고, `RESOLUTION.md` INFO #6 이 "안정된 SoT 를 함께 가리키도록 spec Rationale 에도 표를 뒀다"고 의도를 명시했다 — plan 은 `complete/` 로 이동하며 경로가 바뀌므로 spec 쪽에 안정적 사본을 둔 것은 근거가 있다. 새로운 지적이 아니라 이미 내려진 처분의 연장임을 확인차 기록.
  - 제안: 없음 — 기존 처분 유지 타당.

## 요약

실질 코드 변경(V110 마이그레이션 쌍 + e2e 테스트 추가 2건)은 이름·구조·DDL 순서(DROP→CREATE→DROP)·`.conf` 설정 모두 저장소 기존 패턴(`V056`, `V106`)을 그대로 따르고, 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 관점에서 지적할 대상이 거의 없을 만큼 변경 규모가 작다(SQL 5문 + `it` 블록 2개). Critical 급 결함은 없다. 다만 이전 라운드(`23_02_51`) 리뷰 이후 새로 추가된 `J.` 테스트가 이 파일이 스스로 유지해 온 "물리적 순서 = 알파벳 레이블" 관례를 깨고 `H, J, I` 순으로 삽입되어 있다 — 기능에는 영향이 없지만 어떤 라운드에서도 지적되지 않은 순수 가독성/일관성 결함이라 WARNING 으로 표시한다. 그 외에는 소소한 지역 중복(같은 테스트 안의 asc/desc 시간 추출 반복)과, 이미 이전 라운드에서 처분된 마이그레이션 헤더 비대화·벤치마크 표 중복 경향이 INFO 로 남을 뿐이다.

## 위험도

LOW
