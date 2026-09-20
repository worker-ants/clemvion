# 요구사항(Requirement) 리뷰

## 리뷰 범위

이 changeset 은 `git diff origin/main` 기준 63개 파일이지만, 실제 코드 변경은
`codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 「D. PATCH cron → nextRunAt 재계산」 케이스
한 곳(cron 리터럴 교체 + 판정 로직 교체)뿐이다. 나머지 62개는 `plan/complete/schedule-cron-flake.md`
(신규, 이번에 `in-progress` 에서 이동·완료 처리됨), `plan/in-progress/spec-draft-nullable-notation-followups.md`
항목 갱신(2건 등재 + 1건 완료 처리), 그리고 4라운드에 걸친 `/ai-review`·`--impl-prep`/`--impl-done`
`consistency-check` 산출물(`review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/**`,
`review/consistency/2026/09/20/{11_21_16,13_34_15}/**`)로, 프로세스 기록이며 기능 변경이 아니다.
저장소에 뮤테이션 없이 읽기 전용으로 분석했다(`git status --short` 확인 — 시작·종료 모두 이번 세션
출력 디렉터리(`review/code/2026/09/20/13_41_04/`) 하나만 untracked).

## 검증한 것

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 직접 `Read` 해 diff 가 그대로 반영됐는지 확인 —
  `originalNext` 잔존 참조 없음, 게이트 줄 번호(301, 308, 313, 317~325)가 실제 파일 줄 번호와 정확히
  일치한다.
- `SchedulesService.update()`(`codebase/backend/src/modules/schedules/schedules.service.ts:259-273`)의
  재계산 조건(`if (dto.cronExpression || dto.timezone) { const [nextRun] = this.computeNextRuns(schedule.cronExpression, schedule.timezone, 1); schedule.nextRunAt = nextRun ? new Date(nextRun) : null; }`)과
  `computeNextRuns`(`:407-429`, `CronExpressionParser.parse(cronExpression, { tz: timezone, currentDate: new Date() })`
  로 호출 시각 이후 다음 발화만 반환)를 직접 대조 — 테스트가 세우는 시간창 가정(분 단위 cron 은 요청
  시각부터 60초 안, 초 자리는 항상 0)이 실제 구현과 line-level 로 맞는다.
- spec 대조: `spec/data-flow/10-triggers.md:138`("Schedule cron/timezone 변경 | UPDATE schedule +
  next_run_at 재계산 + `registerJob` 로 job scheduler upsert")와 `:214`("생성/수정 시(`computeNextRuns`)와
  process() 완료 직후 … 재계산해 저장한다")가 구현·테스트 전제와 정확히 일치한다.
  `spec/2-navigation/3-schedule.md:140`(PATCH 행)은 `isActive` 토글만 특기하고 cron 재계산 자체를
  언급하지 않는데, 재계산 규칙의 SoT 는 `data-flow/10-triggers.md` 쪽이라 침묵일 뿐 모순은 아니다.
- 인용 정확성: JSDoc(`:286-287`, `:293`)이 가리키는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 해당 항목과 `review/code/2026/09/20/09_35_16/RESOLUTION.md`("e2e: 통과 (366) — 첫 실행은
  `schedule-trigger` 「D. PATCH cron → nextRunAt 재계산」 1건 실패 …")를 직접 열어 대조 — 1라운드에서
  지적됐던 오인용(`plan/complete/ssrf-catch-instanceof.md` 오인용)은 실제로 정정돼 있고, 2라운드에서
  지적된 순번-only 인용(`293`행)도 전체 경로 인용으로 정정돼 있다(`568fd2ecd`).
- `plan/complete/schedule-cron-flake.md` 의 체크리스트(4라운드 `/ai-review` 수렴, `--impl-done`
  `review/consistency/2026/09/20/13_34_15` BLOCK: NO 5/5 NONE, 트래커 해소)가 실제 커밋 이력
  (`6ebaf59ef`, `34a9e0140`, `568fd2ecd`, `8f56c3256`, `5d551ad73`)과 일치함을 확인 — 서술된 상태와
  실제 git 상태 사이 괴리 없음.

## 발견사항

- **[INFO]** 반대 방향의 좁은 거짓-통과 창(연 1회, 12/31 23:58:30~01/01 00:00:30 KST 근방)이 의도적으로
  미해결 상태로 남아 있다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-299` (JSDoc),
    `plan/complete/schedule-cron-flake.md:41-42`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939`
  - 상세: 생성 cron(`0 0 1 1 *`, Asia/Seoul)의 자체 다음 실행값이 연말 그 ~2분 구간에서는 PATCH 후
    판정창(`patchedAt-30s ~ +90s`, 초=0) 안에 우연히 들어가므로, 재계산이 실제로 일어나지 않아도
    테스트가 통과할 수 있다(거짓 통과). e2e 는 시각을 고정할 수 없어 이 창을 구조적으로 닫지 못한다는
    점과, 닫는 자리는 `computeNextRuns` 를 spy 로 보는 단위 테스트라는 점이 JSDoc·plan·트래커 세 곳에
    일관되게 기록돼 있고, 이미 4라운드에 걸쳐 반증·처분된 이력의 최종 잔여물로 등재돼 있다(새로 발견한
    결함이 아니라 확인 항목, 재-flag 대상 아님).
  - 제안: 조치 불필요 — 이미 트래커 등재·범위 밖으로 확정. 후속 단위 테스트 항목이 이 창을 구조적으로
    닫는다.

- **[INFO]** spec(`spec/2-navigation/3-schedule.md`)은 PATCH 의 cron 재계산 자체를 API 표 수준에서
  명시하지 않는다
  - 위치: `spec/2-navigation/3-schedule.md:140` (PATCH 행), 근거는 `spec/data-flow/10-triggers.md:138,214`
  - 상세: 재계산 규칙 자체는 `data-flow/10-triggers.md` 에 정의돼 있고 구현·테스트 전제와 일치한다.
    `2-navigation` 문서는 PATCH 의 `isActive` 토글만 특기하는데, 이는 spec 이 침묵하는 영역일 뿐
    모순이 아니다(다른 문서가 이미 그 규칙의 SoT).
  - 제안: 조치 불필요.

## 확인했으나 문제 없음

- 시간창 산술: `nextRunMs`(서버가 `computeNextRuns` 호출 시각 이후 첫 분 단위 발화)는 항상 `patchedAt`
  이후, 최대 `patchedAt + 60s + 지연` 이내다 — 하한 `patchedAt - 30_000`(클라이언트·서버 시계 오차 여유),
  상한 `patchedAt + 90_000`(e2e 부하 여유)이 실측 근거와 함께 합리적이다. 1라운드에서 지적된 상한 여유
  부족(`+65_000`→실질 여유 5초) 결함은 현재 값(`+90_000`)에서 재발하지 않는다.
- `patch.body.data.nextRunAt` 이 `undefined` 일 가능성은 `expect(...).toBeDefined()` 로 먼저 걸러진 뒤에만
  `new Date(...)` 로 넘어간다 — null/undefined 가 `Invalid Date` 로 흘러 들어가 항상 통과/항상 실패하는
  경로 없음 (`schedule-trigger.e2e-spec.ts:319-322`).
- 뮤턴트 판별력(4라운드 RESOLUTION 전부에서 재확인: `update()` 재계산 블록 삭제 → RED) — 생성
  cron(`0 0 1 1 *`)의 값은 재계산 없이는 요청 시각으로부터 몇 달 뒤이므로, 시간창·초=0 두 단언 중
  최소 하나가 걸린다.
- `originalNext`(옛 값) 참조가 코드에서 완전히 제거됐다 — 세 라운드에 걸쳐 반증된 "옛 값과 비교" 패턴의
  재발이 이번 최종 상태에 없다.
- TODO/FIXME/HACK/XXX 없음. 함수명(`it('D. PATCH cron → nextRunAt 재계산')`)·JSDoc·실제 단언이 서로
  정확히 일치한다.
- E 케이스(`0 0 1 1 *`, 같은 파일 `:346` 부근)와 D 케이스가 같은 cron 리터럴을 쓰지만 서로 다른
  `scheduleId`·독립 assertion 이라 겹침에 따른 상호 오염은 없다.
- `plan/complete/schedule-cron-flake.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md`
  양쪽의 「할 것」·체크리스트·트래커 항목 서술이 실제 diff·commit 이력과 괴리 없이 대응한다(plan 서술이
  과거형으로 남아 실제 상태와 어긋나는 stale claim 없음).

## 요약

핵심 변경은 「달라졌다」라는 대리 지표 비교를 「PATCH 뒤 값이 새 cron 이 만드는 값인가(요청 시각부터
1분 안, 분 경계)」라는 직접 판정으로 교체한 e2e 플레이크 수정이며, 실제 서비스 구현
(`SchedulesService.update()`/`computeNextRuns`)·spec(`data-flow/10-triggers.md:138,214`)과 line-level 로
일치함을 직접 대조로 재확인했다. 4라운드에 걸쳐 세 개의 시각-충돌 결함 클래스(하루 1분 겹침 → 연 1분
겹침 → 연 90초 겹침)가 실제로 반증·수정됐고, 남은 유일한 잔여(연말 ~2분의 반대 방향 거짓 통과)는
JSDoc·plan·트래커 세 곳에 일관되게 기록된 의도적 유예이지 은닉된 결함이 아니다. 인용 오류(1·2라운드
WARNING)도 실제로 정정됐음을 원본 문서 대조로 확인했다. `plan/complete/` 이동·체크리스트 상태도 실제
커밋 이력과 일치한다. 새로 발견한 CRITICAL/WARNING 은 없다.

## 위험도

NONE
