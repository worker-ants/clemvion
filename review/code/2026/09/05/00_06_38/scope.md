# 변경 범위(Scope) 코드 리뷰

## 검토 방법

`git diff --stat origin/main..HEAD` 로 브랜치 전체 65개 파일을 실측하고, 핵심 diff(마이그레이션
`.sql`/`.conf`, `schedules.service.spec.ts`, `schedule-trigger.e2e-spec.ts`, `spec/1-data-model.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/complete/spec-draft-schedule-index.md`)는
직접 `git diff`/`Read` 로 열어 프롬프트 요약과 대조했다. 이 changeset 은 이미 동일 브랜치에서
`23_02_51`→`23_26_09`→`23_47_43` 세 라운드의 scope 리뷰를 거쳤고(`review/code/2026/09/04/*/scope.md`,
모두 위험도 NONE), 이번 라운드는 그 마지막 라운드(`23_47_43`) 이후 산출물 커밋(`703e10dca`)까지
포함한 전체 diff를 독립적으로 재검증한 것이다. 저장소에는 쓰기를 하지 않았다 —
`git status --short` 결과 이 세션이 만든 `review/code/2026/09/05/00_06_38/` 외 변경 없음.

## 발견사항

- **[INFO]** `(trigger_id)` 인덱스 행 추가는 원 티켓(`idx_schedule_next_run` 부분 조건 불일치)과
  무관한 V106 문서화 공백을 함께 메우는 드라이브바이 — 3라운드 연속 동일 지적, 처분 불변
  - 위치: `spec/1-data-model.md:915` (`| Schedule | (trigger_id) | ... V106 |`)
  - 상세: `idx_schedule_trigger_id` 는 이번 PR 이전에 이미 적용된 `V106` 의 산물이고, 이번
    changeset 의 실제 코드 변경(V110)과는 무관하다. `plan/complete/spec-draft-schedule-index.md`
    `## 4. 변경안 (B)` 이 "같은 표·같은 테이블이므로 함께 메운다"는 근거를 명시하고 있고,
    코드·마이그레이션 변경은 수반하지 않는다(spec 표 행 1개뿐). `review/code/2026/09/04/23_02_51/scope.md`
    (INFO#4)·`23_26_09/scope.md`(INFO#1) 가 이미 동일하게 지적·저위험 판정했고, 이번 diff 에서
    내용 변경도 없다 — 새로 늘어난 범위가 아니라 기존 처분이 유지되는 항목이다.
  - 제안: 기존 처분(공개·저위험) 유지로 충분. 조치 불요.

- **[INFO]** append-only 마이그레이션 헤더가 저장소 로컬 리뷰-세션 ID(`23_02_51 W1`, `23_26_09 W3`)를
  인용 — 제품 코드 주석에 리뷰 프로세스 산출물 식별자가 새어 들어간 경계선 사례
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32`, `:53`
  - 상세: 이 마이그레이션 SQL 은 `spec/conventions/migrations.md §3` 상 머지 후 수정 불가한
    영구 기록인데, 그 본문이 두 곳에서 이 저장소 리뷰 도구의 내부 타임스탬프 디렉터리 표기
    (`23_02_51 W1`, `23_26_09 W3`)를 인용한다. `codebase/backend/migrations/*.sql` 전체를 grep 한
    결과 이런 세션-ID 인용은 V110 이 유일해 선례가 없다. `documentation.md`(`23_47_43`)가 이미
    같은 지점을 문서화 관점에서 INFO 로 기록했지만("본문이 자기완결적이라 손실 없음"), scope
    관점에서 보면 이는 "이번 PR 의 산출물(마이그레이션 SQL)에 이 PR 을 검토한 리뷰 프로세스 자신의
    라운드 라벨이 역참조로 박히는" 순환적 결합이다 — 코드 리뷰 산출물은 `review/**` 에 남기고
    코드 자체는 그와 독립적으로 자기완결적이어야 한다는 경계가 이번에 처음 흐려졌다. 실질
    위험(정보 손실·동작 결함)은 없어 INFO 에 그친다.
  - 제안: 결함은 아니나, 앞으로 유사 패턴(마이그레이션 헤더에 리뷰 근거를 남기는 것)을 반복할
    계획이면 세션 ID 대신 커밋 SHA/PR 번호처럼 저장소에 영구 고정되는 식별자로 대체할 것
    (`documentation.md` 제안과 동일 — 중복 조치 불필요, 참고로만 병기).

- **[INFO]** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험의 규약 차원 처리가 신규
  plan 항목으로 등재됨 — 구현 확장이 아니라 위험의 문서화·이관이므로 범위 위반 아님
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (V110 항목 직후 신규 `- [ ]` 블록)
  - 상세: `23_02_51` 라운드 WARNING(재실행 시 invalid 인덱스 잔존)에 대해 V110 자신은 DROP-먼저
    순서로 완전히 고쳤으나, 동일 결함이 남은 선례(`V056`/`V106`, 이미 적용된 append-only
    마이그레이션)에 대한 규약·런북 차원 처리는 이 PR 이 구현하지 않고 plan 항목으로만 등재했다.
    코드 변경은 없고, `spec/conventions/` 쓰기는 planner 트랙이라는 이 저장소 역할 분리 규약을
    정확히 따른 처리다 — `23_26_09/scope.md`(INFO#2)가 이미 동일 결론.
  - 제안: 조치 불요. 참고로만 기록.

## 확인 결과 (문제 없음)

- 핵심 코드/DB 변경은 `codebase/backend/migrations/V110__*.{sql,conf}`(신규 4+70줄) +
  `codebase/backend/test/schedule-trigger.e2e-spec.ts`(순수 추가, 삭제 줄 0) +
  `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(신규 `it` 1개, 10줄) 뿐이다.
  controller/DTO/다른 모듈 레이어는 건드리지 않았고, 인덱스 컬럼 순서 교체 하나로 수렴한다.
- `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 는 해당 인덱스를 서술하는 행 교체/추가에
  국한되고, 무관한 행·섹션 리플로우나 포맷팅 변경은 없다(`git diff` 로 직접 확인, hunk 밖 변경 없음).
  두 파일이 이번에 정합을 이루도록 함께 갱신된 것은 이전 라운드(`22_34_55` cross_spec WARNING)가
  지적한 미러 drift 를 닫은 것으로, 스코프 확장이 아니라 정합성 요구를 충족한 것이다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 hunk 는 이번에 닫는 항목
  (스케줄 인덱스)의 본문·종결조건 표 행에만 국한된다. `## §2`(auth 네임스페이스 예외)·`## §3`
  (nullable DTO) 등 인접 섹션은 컨텍스트로만 노출됐을 뿐 diff 밖이다.
- `plan/complete/spec-draft-schedule-index.md`(신규 239줄)는 이 항목의 실측·근거 draft이며
  `plan-lifecycle.md` 관례대로 `plan/complete/` 로 이동해 커밋됐다 — 내용도 "네 후보 실측 비교 →
  (c) 채택" 이라는 단일 결정에 집중돼 있고 무관한 서술이 섞이지 않았다.
- `review/code/2026/09/04/{23_02_51,23_26_09,23_47_43}/**`, `review/consistency/2026/09/04/{22_34_55,22_43_40}/**`
  (65개 중 57개 파일)은 이 저장소 CLAUDE.md 가 명시한 산출물 경로(`review/code/**`,
  `review/consistency/**`)에 정확히 위치하며, "구현 완료 후 `/ai-review` + fix 사이클을 밟고
  그 산출물을 커밋한다"는 이 저장소의 상시 승인된 워크플로 그대로다 — 별도 신청 없이도 매
  라운드 반복되는 정상 패턴이며, 세 차례 선행 scope 리뷰가 모두 동일하게 "스코프 위반 아님"으로
  판정했다. 코드 변경이 문서 산출물에 섞여 들어간 사례는 없다(각 리포트가 md/json 뿐).
- import 정리, 불필요한 주석 변경, lint/CI/빌드 설정 파일 변경은 diff 전체에서 발견되지 않았다.
  포맷팅-only 변경(공백·줄바꿈만 바뀐 hunk)도 없다.

## 요약

전체 changeset(65개 파일, 4개 diff 세션에 걸쳐 커밋)은 "`schedule` 목록 조회 인덱스를
쓰이지 않던 부분 인덱스에서 `(workspace_id, next_run_at)` 로 교체(V110)"라는 단일 목표에
계속 수렴하며, 이번 4번째 라운드에서도 의도 밖 리팩토링·기능 확장·무관 파일 수정·포맷팅
노이즈는 발견되지 않았다. 앞선 세 라운드가 이미 저위험으로 처분한 두 드라이브바이(`(trigger_id)`
행 추가, CONCURRENTLY 재실행 규약 후속 등재)는 이번 라운드에서도 근거·범위가 그대로이며 내용
변경이 없어 재확인만 했다. 새로 짚은 지점 하나는 마이그레이션 헤더가 이 저장소 최초로
리뷰-세션 ID를 인용한다는 것인데, 이는 동작 위험이 아니라 "영구 코드 주석에 일시적 프로세스
식별자가 새어 들어간" 경계선 사례로 INFO 수준이다. `review/**` 산출물 57개 파일의 동반 커밋은
이 저장소의 명시된 표준 워크플로이며 스코프 위반이 아니다.

## 위험도

NONE
