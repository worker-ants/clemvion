# 변경 범위(Scope) 리뷰 — 트리거 삭제 자원 정리 (DRT-2, 2라운드)

검증을 위해 저장소 파일을 수정하지 않았다 — `git show`/`git diff`/`git log` 등 읽기 전용 명령만
사용했다. `git status --short` 로 확인한 잔여 변경은 이 리뷰 세션 자신의 출력 디렉터리
(`review/code/2026/09/17/19_14_29/`) untracked 뿐이다.

## 요약 판단

이번 프롬프트는 `origin/main...HEAD` 전체 누적 diff(44개 파일, `git diff --name-only` 로 완전 일치
확인)이며, 1라운드 스코프 리뷰(`review/code/2026/09/17/18_45_09/scope.md`, 위험도 NONE)가 이미 검토한
27개 파일에 더해 그 리뷰의 처분 커밋 3개(`097e583e1`·`a11889086`·`048ddc271`)가 추가됐다. 세 커밋을
개별적으로 diff 대조한 결과, 전부 직전 라운드 SUMMARY/RESOLUTION 이 지목한 특정 항목(C1, W2, W4, W5,
W6, W7, W8, W10, W11, INFO24, INFO26)에 **1:1로 대응하는 최소 수정**이었고, 그 처분표에 없는 임의
변경은 발견하지 못했다.

## 발견사항

- **[INFO]** 리뷰 처분 커밋(`097e583e1`)이 "C1(스케줄 job 배치 해제 롤백)"을 고치며 스케줄 조회를
  `select: { id: true }` 에서 전체 컬럼 조회로 넓혔다 — 언뜻 무관한 축소 취소로 보일 수 있다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (`releaseExternalMany` 내 `scheduleRepository.find` 호출부, `git show 097e583e1` 대조)
  - 상세: 새로 추가된 `removeScheduleJobsOrRestore` 가 실패 시 `this.scheduleRunner.registerJob(schedule)` 로 **활성 job 을 재등록**해야 하는데, `registerJob` 은 `id`·`isActive` 이상의 필드(cron 표현식 등)를 필요로 한다. `select: { id: true }` 를 유지했다면 재등록에 필요한 필드가 없어 컴파일 또는 런타임에서 깨진다 — 즉 이 확장은 C1 수정 자체가 요구하는 필연적 부수 효과이지 스코프 이탈이 아니다.
  - 제안: 없음 — 조치 불필요, 정당한 범위 내 변경.

- **[INFO]** `review/code/2026/09/17/18_45_09/**`(15개 파일)와 `review/consistency/2026/09/17/18_00_19/**`(8개 파일)가 이번 diff 에 포함돼 있다.
  - 위치: 파일 목록 중 `review/code/2026/09/17/18_45_09/*.md`·`meta.json`·`_retry_state.json`, `review/consistency/2026/09/17/18_00_19/*.md`·`meta.json`·`_retry_state.json`
  - 상세: `CLAUDE.md` 정보 저장 위치 표가 코드 리뷰·일관성 검토 산출물을 각각 `review/code/**`·`review/consistency/**` 에 저장하도록 명시하고, "review/ 는 gitignored 아님"(메모리 `feedback_plan_checkbox_actual_state.md`)이 확립돼 있다. 1라운드 스코프 리뷰가 이미 이 범주를 검토했고(파일 19~27), 2라운드에 새로 추가된 `RESOLUTION.md`·plan 체크리스트 갱신도 같은 프로세스 증거다. 코드 스코프 이탈이 아니다.
  - 제안: 없음 — 조치 불필요.

- **[INFO]** 커밋 `048ddc271`(`docs(review)`)이 `plan/in-progress/trigger-deletion-release.md` 에 "정지 규칙(2라운드 결과를 보기 전에 선언)" 문단을 추가했다.
  - 위치: `plan/in-progress/trigger-deletion-release.md` "`/ai-review` 1라운드" 절
  - 상세: 이는 이 저장소 메모리 교훈(`feedback_review_fix_stale_loop.md` — "정지 규칙은 마지막 라운드 결과를 보기 *전에* 선언")을 정확히 실천한 프로세스 기록이며, 코드 변경도 스코프 확장도 아니다.
  - 제안: 없음 — 조치 불필요, 오히려 권장되는 관행.

## 스코프 밖 변경 후보 — 발견되지 않음

1라운드 리뷰 발견사항 각각이 실제로 해당 처분(RESOLUTION.md)과 일치하는 diff 만 만들었는지 커밋
단위로 대조했다:

- `097e583e1`: `CHANGELOG.md`·`secret-ref.{ts,spec.ts}`·`chat-channel-binder.service.ts`·
  `trigger-resource-release.ts`·`trigger-resource-releaser.service.{ts,spec.ts}`·
  `workflows.service.{ts,spec.ts}`·`workspaces.service.{ts,spec.ts}` 11개 파일 — 전부 RESOLUTION.md
  표의 C1/W2/W4/W5/W6/W7/W8/W10/W11/INFO24/INFO26 항목과 대응. 대응 없는 잉여 hunk 없음.
- `a11889086`: `workspaces.service.spec.ts`(대칭 테스트 1건 추가)·e2e spec(판정 헬퍼 교체)·plan.md
  갱신 3개 파일 — 커밋 메시지가 밝힌 "잘못된 판정 API 교정 + 대칭 빈틈 보강"과 diff 가 정확히 일치.
- `048ddc271`: `plan/in-progress/trigger-deletion-release.md` + `review/code/2026/09/17/18_45_09/**`
  14개 신규 파일 — 리뷰 세션 산출물 커밋으로, 코드 파일은 0건.

## 요약

44개 누적 변경 파일(코드 15·spec/e2e 8·plan 1·리뷰 산출물 23·CHANGELOG 1)을 diff 단위로 재대조한
결과, 1라운드 스코프 판정(NONE) 이후 추가된 두 처분 커밋 모두 직전 리뷰 SUMMARY 의 개별 항목에
1:1로 대응하는 최소 수정이었다. 스케줄 조회 컬럼 확장처럼 언뜻 별개로 보일 수 있는 지점도 C1 수정이
요구하는 필연적 부수 효과임을 실측(재등록 로직 참조)으로 확인했다. 의도 이상의 리팩토링·기능 확장·
무관한 파일 수정·의미 없는 포맷팅·불필요한 주석/임포트 변경·의도치 않은 설정 변경 — 어느 것도
발견하지 못했다.

## 위험도

NONE
