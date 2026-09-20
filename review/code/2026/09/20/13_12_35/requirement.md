# 요구사항(Requirement) 리뷰

## 리뷰 범위

이번 diff 는 사실상 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 「D. PATCH cron → nextRunAt 재계산」
케이스 한 곳(cron 리터럴 교체 + 판정 로직 교체)이 실제 코드 변경의 전부다. 나머지(`plan/in-progress/schedule-cron-flake.md`
신규, `plan/in-progress/spec-draft-nullable-notation-followups.md` 두 항목 추가, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/**`,
`review/consistency/2026/09/20/11_21_16/**`)는 이 작업의 1~3라운드 리뷰·consistency-check 산출물과 추적 문서로, 프로세스
기록이며 기능 변경이 아니다. 뮤테이션 없이 읽기 전용으로 분석했다(`git status --short` 확인 — 시작·종료 모두 세션
출력 디렉터리(`review/code/2026/09/20/13_12_35/`) 하나만 untracked, 저장소에 아무것도 쓰지 않았다).

## 검증한 것

- 현재 파일 상태(`Read`/`grep`)로 diff 가 실제로 그대로 반영됐는지 확인 — `originalNext` 잔존 참조 없음(정리 완료),
  게이트 줄 번호(313/323/324/325)가 실제 파일 줄 번호와 일치.
- `SchedulesService.update()`(`codebase/backend/src/modules/schedules/schedules.service.ts:260-266`)의 재계산 조건
  (`if (dto.cronExpression || dto.timezone) { … computeNextRuns(…) }`)과 `computeNextRuns`(`:407-423`, `cron-parser` 의
  `next()` — 호출 시각 이후 다음 발화만 반환)를 대조해 테스트가 세우는 시간창 가정(분 단위 cron 은 요청 시각부터 60초
  안, 초 자리는 항상 0)이 실제 구현과 맞는지 확인 — 일치한다.
- spec 대조: `spec/data-flow/10-triggers.md:138`("Schedule cron/timezone 변경 | UPDATE schedule + next_run_at 재계산 +
  `registerJob`") 과 `:214`("생성/수정 시(`computeNextRuns`)와 process() 완료 직후 … 재계산해 저장")가 구현·테스트
  전제와 line-level 로 일치한다. `spec/2-navigation/3-schedule.md` §4 API 표는 PATCH 의 `isActive` 토글 동작만 명시하고
  cron 재계산 자체의 테스트-레벨 허용 오차(초 단위 tolerance)는 규정하지 않는다 — spec 이 침묵하는 구현 디테일이라
  회색지대(INFO), CRITICAL 아니다.
- 인용 정확성 재검증: JSDoc(`:286`)·`schedule-cron-flake.md:21`이 가리키는 `plan/in-progress/spec-draft-nullable-notation-followups.md`
  의 해당 항목(`:4962-4966`)과 `review/code/2026/09/20/09_35_16/RESOLUTION.md`("e2e: 통과 (366) — 첫 실행은 `schedule-trigger`
  「D. PATCH cron → nextRunAt 재계산」 1건 실패 … `_test_logs/e2e-20260920-095855.log`")를 직접 열어 대조 — 1라운드
  `documentation.md` WARNING(`plan/complete/ssrf-catch-instanceof.md` 오인용)이 지적한 결함은 실제로 고쳐져 있고, 지금
  가리키는 두 문서 모두 그 서술을 뒷받침하는 실측을 담고 있다.

## 발견사항

- **[INFO]** 반대 방향의 좁은 거짓-통과 창(연 1회, 12/31 23:58:30~01/01 00:00:30 KST 근방)이 의도적으로 미해결 상태로 남아 있다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-299` (JSDoc), `plan/in-progress/schedule-cron-flake.md:40-41`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4939`
  - 상세: 생성 cron(`0 0 1 1 *`, Asia/Seoul)의 자체 다음 실행값이 연말 그 ~2분 구간에서는 PATCH 후 판정창(`patchedAt-30s ~
    +90s`, 초=0) 안에 우연히 들어가므로, 재계산이 실제로 일어나지 않아도 테스트가 통과할 수 있다(거짓 통과). e2e 는
    시각을 고정할 수 없어 이 창을 닫지 못한다는 점, 닫는 자리는 `computeNextRuns` 를 spy 로 보는 단위 테스트라는 점이
    JSDoc·plan·후속 트래커 세 곳에 일관되게 기록돼 있고, 이미 세 라운드(1~3)에 걸쳐 두 번 반증·조치된 이력의 최종
    잔여물로 등재돼 있다(재-flag 대상 아님, 새로 발견한 결함이 아니라 확인 항목).
  - 제안: 조치 불필요(이미 트래커 등재·범위 밖으로 확정). 후속 단위 테스트 항목이 이 창을 닫는다.

- **[INFO]** spec(`spec/2-navigation/3-schedule.md`)은 PATCH 의 cron 재계산 자체를 API 표 수준에서 명시하지 않는다
  - 위치: `spec/2-navigation/3-schedule.md:140` (PATCH 행), 관련 근거는 `spec/data-flow/10-triggers.md:138`,`:214`
  - 상세: 재계산 규칙 자체는 `data-flow/10-triggers.md` 에 정의돼 있고 구현·테스트 전제와 일치한다. `2-navigation` 문서
    쪽은 PATCH 의 `isActive` 토글만 특기하고 cron 재계산은 언급하지 않는데, 이는 침묵일 뿐 모순이 아니다(다른 문서가
    이미 그 규칙의 SoT).
  - 제안: 조치 불필요.

## 확인했으나 문제 없음

- 시간창 산술: `nextRunMs`(서버가 `computeNextRuns` 호출 시각 이후 첫 분 단위 발화)는 항상 `patchedAt` 이후이고 최대
  `patchedAt + 60s + 지연` 이내다 — 하한 `-30_000`(클라이언트·서버 시계 오차 여유), 상한 `+90_000`(e2e 부하 여유)이
  실측 근거와 함께 합리적이다. 1라운드(W2, 상한 `+65_000`→실질 여유 5초)의 결함은 이번 값(`+90_000`)에서 재발하지
  않는다.
- `patch.body.data.nextRunAt` 이 `undefined` 일 가능성은 `expect(...).toBeDefined()` 로 먼저 걸러진 뒤에만 `new Date(...)`
  로 넘어간다 — null/undefined 를 `Invalid Date`로 흘려보내는 경로 없음.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:319-322`
- 뮤턴트 판별력(RESOLUTION.md 기록: `update()` 재계산 블록 삭제 → RED)이 세 라운드에 걸쳐 매번 재확인됐고, 이번 라운드
  기준으로도 최종 형태(«1분 안 · 분 경계» 두 단언)가 그 블록 없이는 통과할 수 없다 — 생성 cron(`0 0 1 1 *`)의 값은
  재계산 없이는 요청 시각으로부터 몇 달 뒤이므로 시간창·초=0 두 단언 중 최소 하나가 걸린다.
- `originalNext`(옛 값) 참조가 코드에서 완전히 제거됐다 — 세 라운드에 걸쳐 반증된 "옛 값과 비교" 패턴의 재발 없음.
- TODO/FIXME/HACK/XXX 없음. 함수명(`it('D. PATCH cron → nextRunAt 재계산')`)·JSDoc·실제 단언이 서로 정확히 일치한다.
- E 케이스(`0 0 1 1 *`, UTC)와 D 케이스가 같은 cron 리터럴을 쓰지만 서로 다른 `scheduleId`·독립 assertion 이라 겹침에
  따른 상호 오염은 없다.

## 요약

핵심 변경은 「달라졌다」라는 대리 지표 비교를 「PATCH 뒤 값이 새 cron 이 만드는 값인가」라는 직접 판정으로 교체한
e2e 플레이크 수정이며, 실제 서비스 구현(`SchedulesService.update()`)·spec(`data-flow/10-triggers.md`)과 line-level 로
일치한다. 3라운드에 걸쳐 두 개의 시각-충돌 결함 클래스(연 1회 겹침, 여유 부족)가 실제로 반증·수정됐고, 남은 유일한
잔여(연말 ~2분의 반대 방향 거짓 통과)는 JSDoc·plan·트래커 세 곳에 일관되게 기록된 의도적 유예이지 은닉된 결함이
아니다. 인용 오류(옛 WARNING)도 실제로 정정됐음을 원본 문서 대조로 확인했다. 새로 발견한 CRITICAL/WARNING 은 없다.

## 위험도

NONE
