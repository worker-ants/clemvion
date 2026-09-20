# 부작용(Side Effect) 리뷰 — schedule-cron-flake

## 검토 범위

- `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 「D. PATCH cron → nextRunAt 재계산」 케이스 수정 (cron 리터럴 교체 + 시각-창 단언 추가)
- `plan/in-progress/schedule-cron-flake.md` — 신규 작업 트래커 (워크플로 관례상 산출물)
- `review/consistency/2026/09/20/11_21_16/*` — `--impl-prep` consistency-check 산출물 (SUMMARY, meta.json, `_retry_state.json`, 4개 checker 리포트) — 워크플로 관례상 산출물

프로덕션 코드(서비스·컨트롤러·엔티티 등)는 이번 diff에 포함되지 않는다. 실질 변경은 테스트 파일 1건뿐이다.

## 발견사항

- **[INFO]** 신규 파일 9개가 저장소에 추가됨 — 워크플로 관례에 부합, 의도치 않은 부작용 아님
  - 위치: `plan/in-progress/schedule-cron-flake.md`, `review/consistency/2026/09/20/11_21_16/` 하위 8개 파일
  - 상세: `CLAUDE.md` 정보 저장 위치 표에 따라 진행 중 작업은 `plan/in-progress/<name>.md`(frontmatter에 `worktree` 명시)에, `--impl-prep` consistency-check 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`에 쓰는 것이 정식 규약이다. 실제로 두 파일 다 규약이 요구하는 형태(frontmatter, `meta.json`, checker별 `.md`)를 그대로 따른다. "예상치 못한 파일 생성"에 해당하지 않는다.
  - 제안: 조치 불요. 참고용으로만 기재.

- **[INFO]** `_retry_state.json`에 워크트리 절대경로가 다수 하드코딩되어 저장됨
  - 위치: `review/consistency/2026/09/20/11_21_16/_retry_state.json` (`session_dir`, `prompt_file`, `output_file` 필드들)
  - 상세: `/Volumes/project/private/clemvion/.claude/worktrees/schedule-cron-flake-2f9a4c/...` 형태의 머신·워크트리 종속 절대경로가 그대로 커밋 대상 파일에 박혀 있다. 이는 orchestrator의 표준 상태 파일 포맷(다른 `_retry_state.json` 선례들도 동일 패턴)이라 이번 변경이 새로 도입한 문제가 아니며, 부작용이라기보다 기존 관례를 그대로 따른 것이다.
  - 제안: 조치 불요(기존 관례).

- **[NONE 근접, 참고]** 테스트 로직 변경 자체는 부작용 관점에서 관측되는 문제 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)` 블록
  - 상세: 변경 내용은 (1) 생성 cron 리터럴을 `'0 10 * * *'` → `'0 0 1 1 *'`로 교체, (2) `patchedAt = Date.now()` 지역 변수 추가, (3) PATCH 응답 `nextRunAt`이 `patchedAt` 기준 `[-5s, +65s]` 창 안에 있는지 보는 단언 2개 추가. 아래 각 관점을 확인했다.
    - 전역/공유 상태: `patchedAt`은 `it()` 콜백 로컬 `const`이며 모듈/전역 스코프에 영향 없음.
    - 전역 변수 도입: 없음.
    - 파일시스템: 테스트가 만드는 schedule/trigger DB row는 기존 패턴(다른 케이스들도 정리 없이 row를 남김)과 동일 — 이번 diff가 새로 도입한 정리-누락 패턴이 아님.
    - 시그니처/인터페이스 변경: 없음 — 테스트 전용 파일이고 export되는 함수/클래스 없음.
    - 환경 변수: 읽기/쓰기 없음 (`BASE_URL`은 파일 상단 기존 `process.env.E2E_BASE_URL` 참조를 그대로 재사용, 이번 diff의 변경분 아님).
    - 네트워크 호출: 기존에 존재하던 동일한 `POST /api/schedules`, `PATCH /api/schedules/:id` 호출 그대로이며 호출 횟수·대상 엔드포인트 변경 없음.
    - 이벤트/콜백: 없음.
  - 제안: 조치 불요.

## 요약

이번 diff의 실질 코드 변경은 e2e 테스트 파일 1건, 그것도 cron 리터럴 교체와 시각-창 단언 추가에 국한된 테스트-전용 수정이다. 전역 상태·환경 변수·네트워크 호출·함수 시그니처·공개 인터페이스 어느 축으로도 의도치 않은 부작용을 일으키지 않는다. 나머지 파일(plan 트래커, consistency-check 산출물)은 프로젝트가 명시한 워크플로 관례에 정확히 부합하는 신규 파일 생성이라 "예상치 못한 파일시스템 부작용"으로 볼 수 없다. `_retry_state.json`의 워크트리 절대경로 하드코딩은 기존 선례와 동일한 관례이며 이번 작업이 새로 만든 문제가 아니다.

## 위험도

NONE
