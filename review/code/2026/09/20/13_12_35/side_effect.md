# 부작용(Side Effect) 리뷰 — schedule-cron-flake (머지 후 최종 확인)

## 검토 범위

리뷰 대상 44개 파일(`meta.json` 확인) 중 실질 코드 변경은 단 하나다.

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 「D. PATCH cron → nextRunAt 재계산」 케이스의 cron 리터럴 교체(`'0 10 * * *'` → `'0 0 1 1 *'`) + 판별 단언 재구성(옛 값 비교 제거, 「PATCH 시각부터 1분 안 · 분 경계(초=0)」 단언 신설) + JSDoc 갱신
- `plan/in-progress/schedule-cron-flake.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 항목 추가) — 문서
- `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/**`, `review/consistency/2026/09/20/11_21_16/**` — 선행 3라운드 리뷰·컨시스턴시 워크플로 산출물(전부 자동 생성 markdown/json)

프로덕션 코드(서비스·컨트롤러·엔티티·마이그레이션·설정)는 이번 diff 어디에도 없다. 현재 저장소의 실제 파일 내용(`sed -n '280,335p' codebase/backend/test/schedule-trigger.e2e-spec.ts`)을 직접 열어 diff 와 대조 확인했고, 3라운드 RESOLUTION 이 기술한 최종 형태(하한 `-30_000`/상한 `+90_000`, 옛 값 비교 완전 제거, `getUTCSeconds() === 0` 단언)와 정확히 일치한다.

## 발견사항

- **[INFO]** 신규 파일 다수(plan 1건 + review 산출물 다수)가 저장소에 추가됨
  - 위치: `plan/in-progress/schedule-cron-flake.md`, `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/**`, `review/consistency/2026/09/20/11_21_16/**`
  - 상세: 전부 `CLAUDE.md` 저장 위치 표가 규정하는 정식 워크플로 산출물이다(진행 중 작업 → `plan/in-progress/`, 코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`, 일관성 검토 산출물 → `review/consistency/<...>`). "예상치 못한 파일 생성"에 해당하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `_retry_state.json`(3개 세션 모두)에 워크트리 절대경로가 하드코딩되어 커밋 대상 파일에 그대로 남음
  - 위치: `review/code/2026/09/20/{11_54_10,12_17_18,12_45_31}/_retry_state.json`, `review/consistency/2026/09/20/11_21_16/_retry_state.json`
  - 상세: orchestrator 표준 상태 파일 포맷이며 선례와 동일한 패턴이다. 이번 작업이 새로 도입한 것이 아니다.
  - 제안: 조치 불요(기존 관례).

- **테스트 로직 자체는 부작용 관점에서 관측되는 문제 없음** (`it('D. PATCH cron → nextRunAt 재계산', ...)` 블록)
  - 전역/공유 상태 변경: `patchedAt`·`nextRunMs` 는 `it()` 콜백 로컬 `const` — 모듈/전역 스코프 영향 없음.
  - 전역 변수 도입: 없음.
  - 파일시스템 부작용: 테스트가 만드는 schedule/trigger DB row 는 기존 패턴(다른 케이스도 정리 없이 row 를 남김)과 동일 — 이번 diff 가 새로 도입한 정리-누락이 아니다. 실제 파일시스템 쓰기(로그·캐시 등)는 없다.
  - 시그니처/인터페이스 변경: 없음 — export 되는 함수/클래스가 없는 테스트 전용 블록.
  - 환경 변수: 읽기/쓰기 없음. `BASE_URL` 은 파일 상단 기존 `process.env.E2E_BASE_URL` 참조 그대로이며 이번 diff 의 변경분이 아니다.
  - 네트워크 호출: 기존에 존재하던 동일한 `POST /api/schedules`, `PATCH /api/schedules/:id` 호출 그대로다. 호출 횟수·대상 엔드포인트·페이로드 필드 변경 없음(cron 리터럴 값만 바뀜).
  - 이벤트/콜백: 없음 — BullMQ job scheduler 재등록은 `SchedulesService.update()` 내부 기존 경로이며 이번 diff 는 그 서비스 코드를 건드리지 않는다.
  - 제안: 조치 불요.

- **[정보, 선행 라운드 인용]** 새 cron(`0 0 1 1 *`)도 이론상 PATCH 대상(`*/1 * * * *`)과 특정 순간(연말 창)에 값이 같아질 수 있다는 잔존 논점이 1~3라운드 리뷰에서 반복 지적됐으나, 이는 **테스트 판별력(flakiness)** 의 문제이지 부작용(side effect) 축의 문제는 아니다. 3라운드 `RESOLUTION.md`/plan 문서가 이 잔여를 "반대 방향의 좁은 창(거짓 통과, 연 ~2분)"으로 명시적으로 등재했고, 닫는 자리를 단위 테스트 트래커 항목으로 위임했다 — side-effect 관점에서 추가할 새 발견은 없다.

## 확인했으나 문제 없음

- 리뷰/컨시스턴시 산출물(`review/**/*.md`, `*.json`)은 harness 가 자동 생성한 시점 기록물이며 코드 실행 경로·전역 상태·네트워크·환경 변수와 무관하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 두 트래커 항목(NAV-WF-02/06 불일치, cron 재계산 단위 테스트 부재)은 텍스트 등재일 뿐 실행되는 코드가 아니다.
- 뮤테이션 없이 읽기 전용으로 분석했다(`git status --short` 확인 — 세션 산출물 디렉터리 외 변경 없음, 저장소에 아무것도 쓰지 않았다).

## 요약

이번 diff 의 실질 코드 변경은 backend e2e 테스트 파일 1건, 그것도 cron 리터럴 교체와 시각-창 단언 재구성에 국한된 테스트 전용 수정이다(3라운드에 걸쳐 이미 side-effect 관점 NONE 으로 3회 확인됐고, 현재 파일 상태를 직접 재확인해도 그 최종 형태와 일치한다). 전역 상태·전역 변수·파일시스템·함수 시그니처·공개 인터페이스·환경 변수·네트워크 호출·이벤트/콜백 어느 축으로도 의도치 않은 부작용을 일으키지 않는다. 나머지 43개 파일(plan 트래커, 코드/컨시스턴시 리뷰 산출물)은 프로젝트가 명시한 워크플로 관례에 정확히 부합하는 신규 파일 생성이라 "예상치 못한 파일시스템 부작용"으로 볼 수 없다. 서비스 코드(`schedules.service.ts` 의 재계산·트리거 재등록 로직)는 이번 diff 어디에도 없어 그 쪽 부작용 표면은 애초에 열리지 않았다.

## 위험도

NONE
