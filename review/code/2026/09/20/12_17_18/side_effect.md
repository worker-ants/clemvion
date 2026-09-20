# 부작용(Side Effect) 리뷰 — schedule-cron-flake (2라운드 / 머지 후속)

## 검토 범위

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 「D. PATCH cron → nextRunAt 재계산」 케이스. 1라운드 리뷰(W1)가 지적한 `not.toBe(originalNext)` 잔존-겹침 창을 커밋 `a8ddcfb32`가 제거하고, 대신 "생성 cron 값은 판정 창 밖" 단언으로 대체한 상태.
- `plan/in-progress/schedule-cron-flake.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 체크박스 갱신) — 프로세스 산출물.
- `review/code/2026/09/20/11_54_10/*`, `review/consistency/2026/09/20/11_21_16/*` — 1라운드 `/ai-review` + `--impl-prep` 산출물이 이번 diff 에 신규 파일로 포함됨.

프로덕션 코드(서비스·컨트롤러·엔티티) 변경은 이번 diff 에도 포함되지 않는다.

## 발견사항

- **[INFO]** 신규 파일 다수(plan 문서 2건 갱신/신설 + `review/code/2026/09/20/11_54_10/*` 10여 개 + `review/consistency/2026/09/20/11_21_16/*` 7개)가 저장소에 추가됨 — 워크플로 관례(`CLAUDE.md` 정보 저장 위치 표)에 정확히 부합. 예상치 못한 파일 생성이 아니다.
  - 위치: `plan/in-progress/schedule-cron-flake.md`(전체), `review/code/2026/09/20/11_54_10/`, `review/consistency/2026/09/20/11_21_16/` 하위 전체
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/20/11_54_10/_retry_state.json`·`review/consistency/2026/09/20/11_21_16/_retry_state.json`에 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/schedule-cron-flake-2f9a4c/...`)가 다수 하드코딩되어 커밋 대상 파일에 그대로 남음
  - 위치: 위 두 `_retry_state.json`의 `session_dir`/`prompt_file`/`output_file`/`router_*` 필드
  - 상세: orchestrator 의 표준 상태 파일 포맷이며 다른 세션의 `_retry_state.json` 선례와 동일 패턴(1라운드 `side_effect.md` 자신도 이미 이 항목을 INFO 로 지적·조치 불요로 처분함). 이번 라운드가 새로 만든 문제가 아니다.
  - 제안: 조치 불요(기존 관례).

- **[정보/확인, 발견 아님]** 1라운드 W1(잔존 겹침 창)의 실제 조치가 부작용 관점에서 문제를 만들지 않았는지 확인함 — 문제 없음.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts`, `it('D. PATCH cron → nextRunAt 재계산', ...)` 블록 (293~326행)
  - 상세: `RESOLUTION.md`(`review/code/2026/09/20/11_54_10/RESOLUTION.md` W1 행)가 서술한 대로 `not.toBe(originalNext)` 단언이 실제로 제거됐고, 대신 316~323행의 「1분 안 + 초=0」 단언과 「생성 cron 값은 창 밖」 단언 두 개로 대체됐음을 소스에서 직접 확인(`grep -n` 대조, gate 번호와 실제 파일 줄 번호 일치). `originalNext`/`patchedAt`/`nextRunMs`는 모두 `it()` 콜백 로컬 `const`로 모듈/전역 스코프에 영향 없음. 새 전역 변수 도입 없음.
  - 전역/공유 상태: 없음. 시그니처/인터페이스: 테스트 전용 파일, export 없음 — 변경 없음. 환경 변수: 읽기/쓰기 없음(`BASE_URL`은 파일 상단 기존 `process.env.E2E_BASE_URL` 참조 재사용, 이번 diff 변경분 아님). 네트워크 호출: 기존과 동일한 `POST /api/schedules`·`PATCH /api/schedules/:id` 두 호출뿐, 횟수·대상 변경 없음. 이벤트/콜백: 없음.
  - 제안: 조치 불요.

- **[INFO, 참고용 — 이번 diff 로 새로 생기지 않음]** D 케이스는 PATCH 로 실제 매분(`*/1 * * * *`) cron 을 등록한 뒤 schedule/trigger 를 정리(DELETE)하지 않는다 — e2e 컨테이너 생존 기간 동안 그 워크스페이스에 실제로 매분 잡히는 BullMQ 트리거가 계속 존재하게 된다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:293-326` (D 케이스 전체, `afterAll`(파일 55행)에도 이 schedule 에 대한 정리 없음)
  - 상세: 이는 이번 diff 가 새로 도입한 패턴이 아니다 — 수정 전에도 D 케이스는 동일하게 `'0 10 * * *'` 생성 → `'*/1 * * * *'` PATCH 로 끝났고 정리하지 않았다(diff 의 `-cronExpression: '0 10 * * *'` 줄이 그 증거). 이번 수정은 *생성* cron 리터럴만 `'0 0 1 1 *'`로 바꿨을 뿐, PATCH 후 상태·정리 여부는 그대로다. 1라운드 `side_effect.md`(파일시스템 항목)도 "기존 패턴과 동일 — 이번 diff 가 새로 도입한 정리-누락 패턴이 아님"으로 이미 처분했다. 새 부작용으로 보지 않는다.
  - 제안: 조치 불요(스코프 밖 — plan 의 "비대상"이 서비스 코드·다른 케이스는 건드리지 않는다고 명시).

## 확인했으나 문제 없음

- `plan/in-progress/spec-draft-nullable-notation-followups.md`의 트래커 체크박스 `[ ]` → `[x]` 전환 + 해소 메모 추가는 문서 텍스트 편집일 뿐 실행 가능한 부작용 표면이 없다.
- `review/consistency/2026/09/20/11_21_16/naming_collision.md`·`cross_spec.md` 등은 이번 작업이 새 API endpoint·이벤트명·ENV 변수·설정키·엔티티를 전혀 도입하지 않았음을 이미 확인해 두었고, 소스 diff(schedule-trigger.e2e-spec.ts 만 실질 변경)와 대조해도 일치한다.
- 저장소 뮤테이션 없음 — 분석 전체를 읽기 전용으로 수행했고(`Read`/`grep`만 사용), `git status --short` 결과 이 세션 자신의 미기록 산출물 디렉터리(`review/code/2026/09/20/12_17_18/`) 외에는 변화가 없다.

## 요약

이번 라운드의 실질 코드 변경은 1라운드 리뷰가 지적한 잔존 겹침 창(W1)을 해소한 것이 전부이며, 그 조치(`not.toBe(originalNext)` 제거 + 새 범위/경계 단언 추가)는 전역 상태·환경 변수·네트워크 호출·함수 시그니처·공개 인터페이스 어느 축으로도 새로운 부작용을 만들지 않는다. 신규로 커밋되는 다수의 plan·review 산출물은 프로젝트가 명시한 워크플로 관례에 정확히 부합하는 예상된 파일 생성이며, `_retry_state.json`의 절대경로 하드코딩도 기존 선례와 동일한 관례다. D 케이스가 정리 없이 실제 매분 cron 트리거를 남기는 것은 사실이지만 이는 이번 diff 이전부터 존재하던 동작이고 이번 수정은 그 상태를 바꾸지 않았으므로 새 부작용으로 분류하지 않는다.

## 위험도

NONE
