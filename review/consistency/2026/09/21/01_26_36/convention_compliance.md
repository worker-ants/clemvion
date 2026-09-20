# 정식 규약 준수 검토 — `spec/2-navigation` (impl-done, diff-base origin/main)

## 검토 대상 요약

- spec 델타: `spec/2-navigation` 0개 파일 (코드 전용 PR — 전제 무효 아님, 프롬프트 지시대로 CRITICAL 근거로 쓰지 않음)
- 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.ts`(+52/-11) ·
  `schedules.service.spec.ts`(+107) · 신규 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`(137줄) ·
  `CHANGELOG.md` — 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/schedule-dup-delete-6c81d4`)를
  절대경로로 직접 diff/grep 하여 확인.
- 변경 내용: `SchedulesService.remove()` 의 동시 DELETE 중복 감사(`schedule.deleted` 2건) 결함을,
  락 안 `m.delete(Trigger, triggerId)` 의 `affected === 0` 명시 판정 + `triggerId` 없는 방어 분기의
  `scheduleRepository.delete(...).affected === 0` 판정으로 닫음 (형제 PR #1369/#1370 과 같은 결함 클래스의
  네 번째 자리).

## 발견사항

없음 — CRITICAL·WARNING 급 정식 규약 위반을 찾지 못함. 아래는 확인한 준수 근거와 참고용 INFO 1건.

- **[INFO] 스케줄 축 "동시 삭제 → 404" 계약이 `3-schedule.md §4` 본문에 없음 — 이미 추적 중, 재조치 불요**
  - target 위치: `spec/2-navigation/3-schedule.md` §4 (`DELETE /api/schedules/:id` 행)
  - 위반 규약: 없음 (직접 규약 위반이 아니라 완전성 격차). 참고: `spec/conventions/spec-impl-evidence.md` 는
    `code:` 글로브 ≥1 매치만 의무화하며 본문 서술의 완전성은 그 가드 대상이 아니다(R-1: stale/누락 표현
    검출은 `/spec-coverage` standing audit 몫).
  - 상세: `2-trigger-list.md §4.3/§4.4` 는 "트리거 행을 없애는 모든 경로"(스케줄 화면 삭제 포함)에 대해
    동시 삭제 시 두 번째 요청이 404 를 받는다는 계약을 이미 일반화해 서술하지만, `3-schedule.md §4` API
    표 자체에는 이 문장이 없다. 이번 diff 는 그 서술 없는 동작을 실제로 구현·강화했다.
  - 확인: `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 `1-workflow-list.md §2.6` ·
    `data-flow/12-workspace.md §1.10` 과 함께 이미 planner 항목으로 등재돼 있고(2026-09-20, 이번 커밋이
    `3-schedule.md §4` 로 스코프를 확장), `--impl-prep`/직전 3회 code-review documentation 관점 모두
    "SPEC-DRIFT 아님 · 완전성 격차 · 이미 추적 중 · 비차단" 으로 동일 판정했다
    (`review/code/2026/09/21/00_56_52/SUMMARY.md` INFO #6 등). 세 라운드 연속 동일 결론이므로 본 검토에서
    재상향하지 않는다.
  - 제안: 조치 불요. 후속 `project-planner` 턴에서 트래커 항목을 해소할 때 `3-schedule.md §4` 에 한 문장
    추가.

## 확인한 준수 근거 (positive findings)

- **에러 코드**: `throwScheduleNotFound()` 가 던지는 `{ code: 'RESOURCE_NOT_FOUND', message: 'Schedule not found' }`
  는 형제 `TriggersService.throwTriggerNotFound()`(`triggers.service.ts`)와 동일한 코드·형식이며,
  `spec/5-system/2-api-convention.md §5.3` 에러 봉투 형식과 정합. `spec/conventions/error-codes.md` 의
  신규 코드 신설 없이 기존 코드를 재사용 — §2 안정성 정책(불필요한 rename/신설 금지)에 부합.
- **감사 액션**: 신규 액션 신설 없이 기존 `SCHEDULE_DELETED → 'schedule.deleted'`
  (`audit-action.const.ts:102`)를 그대로 사용 — `spec/conventions/audit-actions.md §3` 레지스트리(schedule:
  과거분사, `created/updated/deleted`)와 정합. 동시 삭제의 진 쪽에서 `recordAudit` 를 건너뛰므로 중복 감사
  행 결함이 닫히고 레지스트리 자체에는 변화가 없다.
  중복 방지 로직으로 audit_log 중복 행이 없어졌다.
- **명명 대칭**: `throwScheduleNotFound()` private 헬퍼는 형제 서비스의 `throwTriggerNotFound()` 네이밍
  패턴을 그대로 따름. `affected === 0` 명시 비교는 자매 함수 `rewriteTriggerConfigLocked`
  (`trigger-config-lock.ts`)의 기존 결정("`null`/`undefined`="모른다"를 "없다"로 읽지 않는다")과 동일
  판정 관용구로 통일 — 규약 문서화는 없으나 이 코드베이스 내 확립된 관용구와 이번 diff가 일치.
- **e2e 파일 명명**: 신규 `schedule-delete-concurrency.e2e-spec.ts` 는 `trigger-delete-concurrency.e2e-spec.ts` ·
  `workflow-delete-concurrency.e2e-spec.ts` · `workspace-delete-concurrency.e2e-spec.ts` 와 정확히 동일한
  `<resource>-delete-concurrency.e2e-spec.ts` 명명 패턴을 따름. (참고로 두 spec 모두 frontmatter `code:` 에
  개별 delete-concurrency e2e 파일을 나열하지 않는 것이 기존 관행이라, 이번 신규 파일을
  `3-schedule.md` frontmatter `code:` 에 별도 등재하지 않은 것도 기존 관행과 어긋나지 않음 — 요구 사항
  아님.)
- **산출물 경로**: `review/code/2026/09/21/{00_06_01,00_37_06,00_56_52}/` · `review/consistency/2026/09/21/01_26_36/`
  모두 CLAUDE.md 의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` · `review/consistency/...` nested-ISO 명명을
  정확히 따름.
- **plan frontmatter**: `plan/in-progress/schedule-dup-delete.md` 의 `worktree: schedule-dup-delete-6c81d4` ·
  `started: 2026-09-20` · `owner: developer` · `spec_impact: none` 모두 스키마 요구 형식(ISO 날짜, bare
  sentinel)에 부합 — `spec_impact: none` 은 리스트가 아닌 bare 값이나 [`.claude/docs/plan-lifecycle.md`](../../../../../.claude/docs/plan-lifecycle.md) Gate C 가 no-op sentinel 로 명시 허용하는 `none` 값과 일치 (배열 오분류 아님).
- **swagger·secret-store 규약**: 이번 diff 는 DTO·컨트롤러 데코레이터·secret 경로를 건드리지 않아
  `spec/conventions/swagger.md`, `spec/conventions/secret-store.md` 적용 대상 표면이 없음 (해당 없음).

## 요약

이번 변경(스케줄 동시 DELETE 감사 중복 수정)은 정식 규약 관점에서 CRITICAL·WARNING 급 위반이 없다.
에러 코드·감사 액션 모두 신규 신설 없이 기존 레지스트리(`error-codes.md`/`audit-actions.md`)를 그대로
재사용했고, 헬퍼 명명·판정 관용구(`affected === 0`)·e2e 파일 명명·review/plan 산출물 경로 모두 이
코드베이스의 기존 확립 패턴과 대칭을 이룬다. 유일하게 남는 항목은 `3-schedule.md §4` 의 "동시 삭제 →
404" 서술 누락인데, 이는 직접적 규약 위반이 아니라 완전성 격차이며 이미 사흘 연속(`--impl-prep` ·
2회 code-review documentation 관점) 동일하게 "비차단·이미 추적 중"으로 판정된 사안이라 본 검토에서도
그 판단을 유지한다(재상향 근거 없음).

## 위험도
NONE
