# 부작용(Side Effect) 리뷰 — schedule-cron-flake (머지 후 재확인, 5차 세션)

## 검토 범위

`meta.json` 기준 63개 파일 중 실질 코드 변경은 여전히 단 하나다.

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 「D. PATCH cron → nextRunAt 재계산」 케이스: 생성 cron 리터럴 교체(`'0 10 * * *'` → `'0 0 1 1 *'`), 옛 값(`originalNext`) 비교 완전 제거, 「PATCH 시각부터 1분 안(-30s~+90s) · 분 경계(초=0)」 단언 신설, JSDoc 갱신.
- `plan/complete/schedule-cron-flake.md`(신규, 완료 이동) — 작업 트래커.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커 항목 체크(`[ ]`→`[x]`) + 후속 백로그 2건 등재.
- `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/**`, `review/consistency/2026/09/20/{11_21_16,13_34_15}/**` — 선행 4라운드 코드리뷰 + 2회 consistency-check 의 워크플로 산출물(전부 markdown/json, 자동 생성).

프로덕션 코드(서비스·컨트롤러·엔티티·마이그레이션·설정)는 이번 diff 어디에도 없다. 현재 저장소의 실제 파일 내용을 직접 열어(`sed -n '282,320p' codebase/backend/test/schedule-trigger.e2e-spec.ts`) diff 및 앞선 라운드(`13_12_35/side_effect.md`)가 기술한 최종 형태와 대조 확인했다 — 완전히 일치한다. `git status --short` 로 저장소가 이 세션의 신규 출력 디렉터리(`review/code/2026/09/20/13_41_04/`) 외에 미커밋 변경이 없음도 확인했다. 뮤테이션(코드 임시 수정)은 수행하지 않았다 — 재현 없이도 판단 가능한 변경이었다.

## 발견사항

- **[INFO]** 신규 파일 다수(plan 2건 이동/갱신 + review·consistency 산출물 다수)가 저장소에 추가됨
  - 위치: `plan/complete/schedule-cron-flake.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/**`, `review/consistency/2026/09/20/{11_21_16,13_34_15}/**`
  - 상세: 전부 `CLAUDE.md` 저장 위치 표가 규정하는 정식 워크플로 산출물이다(완료 plan → `plan/complete/`, 코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`, 일관성 검토 산출물 → `review/consistency/<...>`). "예상치 못한 파일 생성"에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `_retry_state.json`(6개 세션 모두)·`meta.json` 에 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/schedule-cron-flake-2f9a4c/...`)가 하드코딩되어 커밋 대상 파일에 그대로 남음
  - 위치: `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}/_retry_state.json`, `review/consistency/2026/09/20/{11_21_16,13_34_15}/_retry_state.json`
  - 상세: orchestrator 표준 상태 파일 포맷이며 선행 라운드(11_54_10·12_17_18·13_12_35)의 side_effect 리뷰가 모두 이미 동일하게 "기존 관례" 로 처분한 항목이다. 이번 세션이 새로 도입한 것이 아니다.
  - 제안: 조치 불요(기존 관례, 재-flag 하지 않음).

- **테스트 로직 자체는 부작용 관점에서 관측되는 문제 없음** (`it('D. PATCH cron → nextRunAt 재계산', ...)` 블록, `codebase/backend/test/schedule-trigger.e2e-spec.ts`)
  - 전역/공유 상태 변경: `patchedAt`·`nextRunMs` 는 `it()` 콜백 로컬 `const` — 모듈/전역 스코프 영향 없음.
  - 전역 변수 도입: 없음.
  - 파일시스템 부작용: 테스트가 만드는 schedule/trigger DB row 는 기존 패턴(다른 케이스도 정리 없이 row 를 남김)과 동일 — 이번 diff 가 새로 도입한 정리-누락이 아니다. 로그·캐시 등 실제 파일시스템 쓰기는 없다.
  - 시그니처/인터페이스 변경: 없음 — export 되는 함수/클래스가 없는 테스트 전용 블록. 공개 API 변경 없음.
  - 환경 변수: 읽기/쓰기 없음. `BASE_URL` 은 파일 상단 기존 `process.env.E2E_BASE_URL` 참조 그대로이며 이번 diff 의 변경분이 아니다.
  - 네트워크 호출: 기존에 존재하던 동일한 `POST /api/schedules`, `PATCH /api/schedules/:id` 호출 그대로다. 호출 횟수·대상 엔드포인트·페이로드 필드 변경 없음(cron 리터럴 값만 바뀜) — 의도치 않은 외부 서비스 호출 없음.
  - 이벤트/콜백: 없음 — BullMQ job scheduler 재등록은 `SchedulesService.update()` 내부 기존 경로이며 이번 diff 는 그 서비스 코드를 건드리지 않는다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음

- 4라운드에 걸친 코드리뷰 산출물·2회 consistency-check 산출물(`review/**/*.md`, `*.json`)은 harness 가 자동 생성한 시점 기록물이며 코드 실행 경로·전역 상태·네트워크·환경 변수와 무관하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재된 두 트래커 항목(`NAV-WF-02`/`06` 불일치, cron 재계산 단위 테스트 부재)은 텍스트 등재일 뿐 실행되는 코드가 아니다.
- 이번 diff 는 이전 4라운드 side_effect 리뷰(`11_54_10`·`12_17_18`·`13_12_35`)에서 이미 각각 NONE 으로 확인된 동일 코드 변경이며, 이번 세션에서 파일 내용을 직접 재대조해도 결론이 달라질 근거가 없다.
- 이 리뷰 세션 자체는 저장소에 아무것도 쓰지 않았다(`git status --short` 확인 — 이 세션의 산출물 디렉터리 외 변경 없음).

## 요약

이번 diff(63개 파일)의 실질 코드 변경은 여전히 backend e2e 테스트 파일 1건, cron 리터럴 교체와 시각-창 단언 재구성에 국한된 테스트 전용 수정이다. 전역 상태·전역 변수·파일시스템·함수 시그니처·공개 인터페이스·환경 변수·네트워크 호출·이벤트/콜백 어느 축으로도 의도치 않은 부작용을 일으키지 않으며, 이는 선행 4라운드 side_effect 리뷰의 결론과 정확히 일치한다. 나머지 62개 파일(plan 완료 이동, 트래커 갱신, 코드/컨시스턴시 리뷰 산출물)은 프로젝트가 명시한 워크플로 관례에 정확히 부합하는 신규 파일 생성·이동이라 "예상치 못한 파일시스템 부작용"으로 볼 수 없다. 서비스 코드(`schedules.service.ts` 의 재계산·트리거 재등록 로직)는 이번 diff 어디에도 없어 그쪽 부작용 표면은 애초에 열리지 않았다.

## 위험도

NONE
