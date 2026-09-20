# 부작용(Side Effect) 리뷰 — schedule-cron-flake (머지 후속 / 3라운드)

## 검토 범위

`git diff --stat origin/main...HEAD` 로 실제 변경 파일을 재확인했다 — 프롬프트에 나열된 33개 파일과 일치하며, 실 코드 변경은 다음 한 곳뿐이다.

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)` 블록 (296~332행). 순 25줄 변경.
- 나머지 32개 파일은 전부 `plan/**`·`review/**` 문서/워크플로 산출물(1·2라운드 `/ai-review` 결과, `--impl-prep` consistency-check 결과, 작업 트래커)이다.

서비스·컨트롤러·엔티티·설정·package.json·CI 워크플로 등 프로덕션 코드나 인프라 파일은 이번 diff 어디에도 포함되지 않는다. 뮤테이션은 수행하지 않았다(`Read`/`Bash grep,diff,log`만 사용). `git status --short` 로 이 세션 자신의 산출물 디렉터리 외 변화 없음을 확인했다.

## 발견사항

- **[정보/확인, 발견 아님]** 2라운드 W1 조치(커밋 `b40b5b98f`)가 부작용 관점에서 새 문제를 만들지 않았는지 확인함 — 문제 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` `it('D. PATCH cron → nextRunAt 재계산', ...)` 블록 (296~332행)
  - 상세: 실제 파일을 열어 대조한 결과, 1·2라운드가 순차로 넣었던 `originalNext`(옛 값) 비교·`not.toBe(originalNext)`·`originalNext > patchedAt + 90_000` 세 형태의 단언이 모두 사라졌고, 남은 것은 316~321행의 「PATCH 시점 기준 1분 안(-30s~+90s) + 초 자리 0」 두 단언뿐이다. `patchedAt`·`nextRunMs`는 `it()` 콜백 스코프의 로컬 `const`로 모듈·전역 스코프에 아무것도 노출하지 않는다 — 새 전역 변수·모듈 레벨 상태 없음. 함수 시그니처·export·공개 인터페이스 변경 없음(테스트 파일 자체가 export 하는 것이 없다). 환경 변수는 파일 상단에 이미 있던 `process.env.E2E_BASE_URL` 참조뿐이고 이번 diff 는 이를 건드리지 않는다. 네트워크 호출은 기존과 동일하게 `POST /api/schedules` · `PATCH /api/schedules/:id` 두 번뿐, 횟수·대상 endpoint 변경 없음. 이벤트/콜백 발생 지점 없음.
  - 제안: 조치 불요.

- **[INFO, 참고용 — 이번 diff 로 새로 생기지 않음, 3라운드 연속 확인]** D 케이스가 PATCH 로 등록한 실제 매분(`*/1 * * * *`) cron 트리거를 정리(DELETE)하지 않는다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:296-332`(D 케이스 전체), `afterAll`(파일 55행 — `db.end()`만 하고 이 schedule 정리는 없음)
  - 상세: `git diff --stat origin/main...HEAD` 로 봐도 이 케이스가 생성한 schedule/trigger 를 지우는 `DELETE` 호출은 diff 전후 어디에도 없다 — PATCH 로 매분 cron 이 활성 상태로 남아 e2e 컨테이너 생존 기간 동안 그 워크스페이스에서 계속 발화(BullMQ job scheduler 잔존)한다. 다만 이는 1·2라운드 side_effect 리뷰(`review/code/2026/09/20/11_54_10/side_effect.md`, `review/code/2026/09/20/12_17_18/side_effect.md`)가 이미 "이번 diff 이전부터 있던 패턴(생성 cron 리터럴만 바뀌었을 뿐 PATCH 후 미정리 동작은 그대로)"으로 확인·조치 불요 처분한 항목과 동일하다. `git log -p` 상으로도 삭제된 줄(`-cronExpression: '0 10 * * *'`)만 있고 정리 로직 추가/삭제는 없어, 이번 라운드가 새로 도입한 부작용이 아님을 재확인했다.
  - 제안: 조치 불요(스코프 밖 — plan `plan/in-progress/schedule-cron-flake.md` §비대상이 서비스 코드·정리 로직은 대상이 아님을 명시).

- **[INFO]** 신규 파일 33개(실질적으로 plan 1건 갱신·1건 신설 + `review/code/**`·`review/consistency/**` 산출물 31건)가 저장소에 추가됨 — 워크플로 관례(`CLAUDE.md` 정보 저장 위치 표: `plan/in-progress/`, `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`, `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)와 정확히 일치한다. 예상치 못한 파일 생성이 아니다.
  - 위치: 위 33개 파일 전체 (`git diff --stat origin/main...HEAD` 목록과 일치)
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/20/{11_54_10,12_17_18}/_retry_state.json`에 워크트리 절대경로가 다수 하드코딩되어 커밋 대상 파일에 그대로 남음
  - 위치: 두 `_retry_state.json`의 `session_dir`/`prompt_file`/`output_file`/`router_*` 필드 (`/Volumes/project/private/clemvion/.claude/worktrees/schedule-cron-flake-2f9a4c/...`)
  - 상세: orchestrator 의 표준 상태 파일 포맷이며 1·2라운드 자신의 side_effect 리뷰가 이미 같은 항목을 INFO·조치 불요로 처분했다. 이번 라운드가 새로 만든 문제가 아니다.
  - 제안: 조치 불요(기존 관례).

## 확인했으나 문제 없음

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 신규 항목 2건(`NAV-WF-02`/`NAV-WF-06` 불일치, cron 재계산 단위 테스트 부재 등재)은 텍스트 편집일 뿐 실행 가능한 부작용 표면이 없다.
- `review/consistency/2026/09/20/11_21_16/*` 는 `--impl-prep` 단계의 읽기 전용 분석 산출물로, 새 API endpoint·이벤트명·ENV 변수·설정 키·엔티티를 이번 작업이 도입하지 않았다는 결론(NONE)을 담고 있으며, 실 소스 diff(테스트 파일 1건)와 대조해도 일치한다.
- 저장소 뮤테이션 없음 — 이 세션 자신도 읽기 전용으로 분석했고, `git status --short` 로 이 세션 산출물 디렉터리 외 잔여 변경이 없음을 확인했다.

## 요약

3라운드에 걸친 리뷰-조치 사이클의 최종 상태(`origin/main...HEAD`)를 기준으로 보면, 실 코드 변경은 e2e 테스트 한 케이스의 cron 리터럴 교체 + 판별 단언 재구성(순 25줄)에 그치고, 2라운드가 지적한 "새로 넣은 단언 자체가 같은 클래스의 겹침 창을 재도입"하는 결함(W1)은 옛 값 비교를 통째로 제거하는 방식으로 해소되어 전역 상태·환경 변수·네트워크 호출·함수 시그니처·공개 인터페이스 어느 축에서도 새로운 부작용을 만들지 않는다. 함께 커밋되는 다수의 plan·review 산출물은 프로젝트가 명시한 워크플로 관례에 정확히 부합하는 예상된 파일 생성이다. D 케이스가 정리 없이 실제 매분 cron 트리거를 남기는 것과 `_retry_state.json`의 절대경로 하드코딩은 사실이지만 둘 다 이번 diff 이전부터 존재하던 동작으로, 1·2라운드에 이어 이번 라운드에서도 새 부작용으로 분류하지 않는다.

## 위험도

NONE
