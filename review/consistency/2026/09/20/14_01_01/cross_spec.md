# Cross-Spec 일관성 검토 — target: `spec/2-navigation/` (--impl-prep)

## 검토 범위와 방법

target 은 `spec/2-navigation/` 전체이나, 실제 작업(plan/in-progress/sched-recalc-unit.md)은
`SchedulesService.update()` 의 cron/timezone 재계산 happy-path 에 **결정적 단위 테스트를
추가**하는 것으로 `spec_impact: none` — spec 본문 변경이 없다. `git status`/`git log` 로 확인한
결과 `spec/2-navigation/**` 에 미커밋 변경이 없어, 이번 검토는 **새 draft 가 아니라 현재
커밋된 spec 상태**를 대상으로 한 impl-prep 게이트다.

프롬프트 번들은 컨텍스트 예산 초과로 `1-workflow-list.md` / `2-trigger-list.md` / `3-schedule.md`
세 파일만 전문이 실렸고, 나머지 15개 `spec/2-navigation/*` 및 대다수 관련 spec(`1-data-model.md`
전체 등)은 절단됐다. 절단된 영역은 이 보고서의 "없다" 판정 근거로 쓰지 않았고, 대신 실제
`spec/**` 파일을 직접 `Read`/`grep` 하여 아래 교차 참조를 점검했다:

- `spec/1-data-model.md` §2.9/§2.9.1 (Schedule 엔티티 · Trigger↔Schedule 동기화 규칙)
- `spec/data-flow/10-triggers.md` §1.4/§2.1/§3.2 (동기화 이벤트 표, `next_run_at` 재계산 서술)
- `spec/5-system/1-auth.md` §3.2 (리소스별 권한 매트릭스 — Trigger/Schedule/Auth Config CRUD)
- `spec/5-system/2-api-convention.md` §5.2/§5.4 (목록 응답·부재 표현 규약)

## 발견사항

없음 — 위 네 교차 참조 지점 모두 target 문서의 서술과 정확히 일치했다:

- `2-trigger-list.md §2.3.1` 의 `nextRunAt` (스케줄 생성·수정 시 + 각 실행 완료 직후 재계산,
  cron 파싱 실패 시 `-`) 은 `data-flow/10-triggers.md §1.4`(cron/timezone 변경 시 재계산)와
  `§3.2`(발사 후 `UPDATE last_run_at, next_run_at` 정보성 재계산)에 그대로 대응한다. `3-schedule.md`
  의 동일 서술도 일치.
- `1-data-model.md §2.9.1` 의 Trigger↔Schedule 동기화 이벤트 표(생성/이름 변경/`is_active`/삭제/
  직접 생성 금지)는 `3-schedule.md §3` · `2-trigger-list.md §4.3` 의 표와 방향·주체가 일치한다.
- `2-trigger-list.md §4.1`(트리거 삭제: viewer 불가/editor 가능/admin·owner 가능)과 `§2.3.1`
  Auth Config 행(editor 는 기존 목록만, "새 인증 설정 만들기"는 Admin+)은 `5-system/1-auth.md §3.2`
  의 매트릭스(Trigger: Owner/Admin/Editor=CRUD, Viewer=R · Auth Config: Owner/Admin=CRUD,
  Editor/Viewer=R)와 정확히 부합한다.
- API 규약 인용(§5.2 목록 응답, §5.4 부재 표현 "키 생략" 기준 (b))은 `5-system/2-api-convention.md`
  에 실제로 그 절·기준이 존재하며 문구도 상응한다.

target 문서 자체가 이미 다수의 `Rationale` 섹션(R-1~R-17)에서 "SoT는 어느 문서인가", "무엇이
계약이고 무엇이 구현 스냅샷인가"(R-17), "행/카드 두 표시가 왜 모순이 아닌가"(§2.1 팀 뱃지 각주)
등을 선제적으로 정리해 두어, 통상 cross-spec 검토에서 걸리는 유형의 애매성(SoT 미표기·중복
정의)이 대부분 이미 해소돼 있다.

## 요약

target 범위(`spec/2-navigation/`)의 실제 변경은 없고(spec_impact: none), 계획된 작업은
`schedules.service.spec.ts` 에 재계산 happy-path 단위 테스트 2건을 추가하는 코드 전용 변경이다.
접근 가능했던 세 전문 파일(`1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md`)과 그것이
참조하는 데이터 모델·데이터 흐름·인증·API 규약 spec 을 직접 대조한 결과 모순을 찾지 못했다.
번들이 절단한 나머지 12개 파일(`4-integration.md` 등)은 이번 작업(스케줄 서비스의 순수 재계산
로직 단위 테스트)과 참조 관계가 없어 추가 조회를 생략했다.

## 위험도

NONE
