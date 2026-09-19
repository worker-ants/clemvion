# 변경 범위(Scope) 리뷰 — entity-column-declaration-drift

## 점검 방법

`git diff --stat origin/main...HEAD` 로 실제 diff(27개 파일, +1093/-23)를 프롬프트의 파일 목록과 대조해 누락·추가가 없음을 확인했다. 대상 작업은 `plan/in-progress/entity-column-declaration-drift.md` — "엔티티 컬럼 선언 아홉 곳 정정 + 가드를 컬럼 층으로 확장"이며, 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 항목과 사용자 결정("고치고 가드 확장")이 그 범위를 규정한다.

## 발견사항

- **[INFO]** 트래커에 추가된 체크리스트 한 항목(`spec/0-overview.md` Prisma/TypeORM 서술 drift)이 이번 핵심 작업(엔티티 컬럼 정정)과 직접 관련 없다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 상 새 항목, 원본 4857행 뒤에 6줄 추가)
  - 상세: `--impl-prep` 재실행(`review/consistency/2026/09/19/16_54_09/rationale_continuity.md`) 이 발견한 INFO — `spec/0-overview.md` Rationale 이 ORM 을 Prisma 로 서술하나 실제는 TypeORM — 을 developer 가 직접 고치지 않고 트래커에 후속 항목으로만 등재했다. `spec/` 파일 자체는 건드리지 않았고, `CLAUDE.md` 가 규정한 "developer 는 spec drift 발견 시 고치지 말고 planner 에 인계"를 정확히 따른 형태다. 스코프 위반이 아니라 오히려 올바른 처리이므로 감점 대상은 아니지만, 이번 작업의 핵심 diff(엔티티 8파일 + e2e 가드)와는 별개 관심사라는 점만 기록해 둔다.
  - 제안: 조치 불필요 — 다음 `project-planner` 턴에서 처리될 트래커 항목으로 남겨 두면 된다.

- **[INFO]** `entity-schema-declarations.e2e-spec.ts` 안의 `dataSourceOptions()` 함수 추출은 리팩토링처럼 보이지만 신규 테스트가 요구하는 것이다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `beforeAll()` 안 인라인 `DataSource` 옵션 객체를 `dataSourceOptions(): DataSourceOptions` 함수로 추출(hunk `@@ -113,6 +180,20` / `@@ -121,17 +202,7`)
  - 상세: 이 함수는 새로 추가된 컬럼 층 테스트가 읽기 전용 세션(`{ ...dataSourceOptions(), extra: {...} }`)을 만들 때 원래 `DataSource` 설정을 그대로 재사용하기 위해 필요하다 — 순수한 코드 정리가 아니라 새 기능이 기존 설정 재사용을 요구해서 생긴 최소 추출이다. 스코프 이탈로 보지 않는다.
  - 제안: 없음(참고용 기록).

## 관찰 — 스코프 규율이 잘 지켜진 지점

- `codebase/` 변경은 정확히 plan 표의 아홉 곳(파일 8개, `integration-usage-log.entity.ts` 는 컬럼 2개)과 e2e 가드 확장 한 파일로 국한된다. diff 각각이 `type: 'uuid'` / `enumName` / `default` 한 속성 추가에 그치고, 무관한 포맷팅·주석·임포트 정리가 섞이지 않았다.
- 1차 `--impl-prep`(10:58:34)이 발견한 무관한 기존 Critical(§5.4 lower_snake_case 에러 코드)을 이 브랜치에서 직접 고치지 않고, 별도로 머지된 PR(#1357)이 해소할 때까지 대기한 뒤 재실행했다 — plan 자신이 "지난 PR(#1354)처럼 무관한 spec 정정을 이 브랜치에 섞지 않는다"고 명시하며 스코프 누수를 스스로 경계한 기록이 남아 있다.
- `review/consistency/**`·`plan/in-progress/entity-column-declaration-drift.md` 등 비-코드 변경은 전부 이번 작업이 규약상 의무적으로 거쳐야 하는 게이트(`--impl-prep` 2회, plan 문서화)의 산출물이며, 임의로 추가된 기능·문서가 아니다.
- 신규 코드(`UNDECLARED_COLUMNS`, `COLUMN_LEVEL`, `COLUMN_LEVEL_SAMPLES`, 읽기 전용 세션 가드)는 전부 plan 문서에 기록된 리뷰 라운드(1·2차) 피드백에 대한 응답이며, 요청 범위를 넘어선 임의 기능 확장이 아니다.

## 요약

핵심 코드 변경(백엔드 엔티티 8파일의 컬럼 데코레이터 정정 9건 + e2e 컬럼 층 가드 확장 1파일)은 plan/트래커가 정의한 범위에 정확히 부합하며, 무관한 리팩토링·포맷팅·주석·임포트 정리가 섞여 있지 않다. 나머지 변경(신규 plan 문서, 트래커 1줄 추가, consistency-check 산출물 15개)은 모두 이 작업이 절차상 반드시 거쳐야 하는 게이트의 부산물이거나 정당한 이슈 인계이며, 임의의 범위 확장으로 보이는 지점은 없다.

## 위험도

NONE
