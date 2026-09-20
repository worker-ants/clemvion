# 변경 범위(Scope) 리뷰

## 검토 범위 및 방법

`origin/main` 대비 누적 diff(30개 파일, 전부 신규 추가/순수 삽입, 삭제 0줄) 전체를 대상으로 검토했다.
구성은 크게 세 그룹이다.

1. **핵심 작업물** (6개): `CHANGELOG.md`, `triggers.service.ts`, `triggers.service.spec.ts`,
   `trigger-delete-concurrency.e2e-spec.ts`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커),
   `plan/in-progress/trigger-dup-delete.md`(신규 plan)
2. **`/ai-review` 산출물** (16개): `review/code/2026/09/20/22_07_23/**` — 직전 라운드 리뷰 리포트 + `RESOLUTION.md`/
   `_resolution_log.md`/`_resolution_state.json` (SUMMARY#1~#5 조치 기록)
3. **`consistency-check --impl-prep` 산출물** (8개): `review/consistency/2026/09/20/21_43_47/**`

## 발견사항

- **[INFO]** 리뷰/일관성 검사 산출물(그룹 2·3, 24개 파일)이 diff 대부분을 차지함 — 범위 이탈 아님
  - 위치: `review/code/2026/09/20/22_07_23/**`, `review/consistency/2026/09/20/21_43_47/**`
  - 상세: `CLAUDE.md` 는 developer 가 구현 착수 직전 `consistency-check --impl-prep` 을, 구현 완료 후
    `/ai-review` 를 상시 승인된 강제 절차로 규정하고, `review/` 는 gitignore 대상이 아니므로 그 산출물이
    커밋에 포함되는 것이 정상 워크플로다. `plan/in-progress/trigger-dup-delete.md` 체크리스트 1번 항목이
    `--impl-prep spec/2-navigation` 실행을 명시하고 그 경로가 정확히 `21_43_47/`과 일치하며, `RESOLUTION.md`
    는 직전 `22_07_23` 라운드 SUMMARY 의 WARNING 5건(#1~#5)을 조치한 로그다. 이 리포지토리의 직전
    라운드 scope 리뷰(`review/code/2026/09/20/22_07_23/scope.md`) 자신도 같은 근거로 동일 판정(NONE)을
    내린 바 있어 판단이 이번 라운드까지 일관된다.
  - 제안: 조치 불요.

- **[INFO]** 핵심 코드 변경은 목표 결함 하나에 정확히 국한됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1085-1101)
  - 상세: 추가된 것은 advisory lock 획득 후 `m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })`
    재조회 + `!fresh` 시 `throwTriggerNotFound()`, 그리고 `.catch` 안의 `if (err instanceof NotFoundException) throw err;`
    한 줄뿐이다(주석 포함 총 14줄 추가, 게이트 1082-1101 범위). import 변경, 기존 코드 재배치·리팩토링,
    포맷팅 변경 없음 — 순수 삽입.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트 2건(`triggers.service.spec.ts`)과 신규 e2e 파일 모두 이번 결함에만 대응
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 게이트 4025-4054(락 안 404),
    4117-4146(genuine 실패 시 `logger.error` 단언) / `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`(신규 파일)
  - 상세: 두 `it()` 블록 모두 기존 `describe` 안에 추가만 됐고 기존 테스트의 내용·순서 변경은 없다.
    `logger.error` 단언 테스트는 직전 라운드 testing WARNING(로그 삭제 뮤턴트가 11/11 GREEN으로 남는 공백)을
    직접 메운 것으로, RESOLUTION.md SUMMARY#4 기록과 일치한다. e2e 파일은 형제 `workflow-/workspace-delete-concurrency.e2e-spec.ts`
    패턴을 재사용하며 lock key 는 리터럴 대신 `triggerConfigLockKey` import(SUMMARY#3 조치)로 되어 있어
    직전 라운드 maintainability WARNING 도 반영됐다.
  - 제안: 조치 불요.

- **[INFO]** plan/tracker 문서 수정은 이번 PR 이 발견한 사실에만 국한된 순수 추가·체크박스 토글
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4583-4589(신규 불릿),
    4760(`- [ ]` → `- [x]`), 4767-4784(정정 각주 + 신규 `SchedulesService.remove()` 항목)
  - 상세: 기존 불릿 목록 사이에 신규 항목을 삽입하거나 완료 체크박스를 토글한 것 외에 주변 서술을
    재작성·삭제한 흔적이 없다. 새로 등재된 `SchedulesService.remove()` 항목·`releaseExternal` 중복 호출
    크로스레퍼런스는 각각 이번 세션의 requirement WARNING #2·side_effect WARNING #1 을 그대로 옮긴 것이라
    범위 밖 리팩토링이 아니라 이번 작업이 직접 발견한 잔여를 기록하는 필수 부기다.
  - 제안: 조치 불요.

- 기타 스코프 이탈·불필요 리팩토링·포맷팅 혼입·무관한 임포트/주석/설정 변경: **미발견**.

## 요약

이번 diff 는 `TriggersService.remove()` 의 동시 DELETE 감사 중복 결함 하나를 겨냥한 최소 코드 변경(구현
14줄, 단위 테스트 2건, 신규 e2e 파일 1건)과 그에 직결된 plan/tracker 부기로 구성되며, 나머지 24개 파일은
프로젝트 규약이 강제하는 `--impl-prep` consistency-check 및 `/ai-review` 절차의 정상 산출물(이전 라운드
리포트 + RESOLUTION 기록)이다. 핵심 코드·테스트 파일은 전부 순수 추가(삭제 0줄)이고 기존 로직 재배치·
포맷팅 변경·불필요한 리팩토링·무관한 임포트/주석 정리는 없다. plan 문서 자체가 "이 PR 이 하지 않는 것"
(외부 자원 해제 중복 미수정, 네 자리 공용 헬퍼 추출 미실시, spec caveat 정정은 planner 위임)을 사전에
명시했고 실제 diff 도 그 경계를 정확히 지킨다. 범위 이탈 징후를 발견하지 못했다.

## 위험도

NONE
