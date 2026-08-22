# 요구사항(Requirement) 리뷰 — 미러 가드 사본 통합 (repo-guards.yml 신설)

## 조사 방법

diff 18개 파일(하네스 테스트 2·워크플로 3(신설 1·수정 2)·backend 삭제 2·frontend 수정 2·plan
2·consistency 산출물 8) 을 정독한 뒤, 다음을 실제로 실행/실측했다:

- `.claude/tests/test_required_check_skip_jobs.py` + `test_workflow_yaml_structure.py` 29건 전체 실행 — 전부 GREEN.
- `pnpm --filter frontend exec vitest run masked-marker-mirror.test.ts typescript-toolchain.test.ts` — 44건 GREEN.
- `npx jest --listTests`(backend) — 삭제된 `masked-marker-mirror-guard.ts`/`.spec.ts` 가 더 이상
  발견되지 않음, 다른 backend 파일에서의 잔존 import 없음(grep 0건).
- `codebase/frontend` tsc `--noEmit` — repo-guards/masked-marker 관련 에러 없음.
- `spec/` 전체 grep — `masked-marker-mirror`·`repo-guards` 어느 spec 문서에도 등장하지 않음(빈
  결과) → 이 변경 영역을 규정하는 spec 본문이 없다(순수 CI/test-infra).

## 발견사항

- **[WARNING]** `frontend-checks.yml` 에서 `codebase/channel-web-chat/**` pathspec 을 제거하며,
  그 근거를 "미러 가드가 이 잡에 산다" 는 **단일 소비처** 기준으로만 판단했다 — 같은 frontend
  vitest 스위트 안에 `codebase/channel-web-chat` 를 실제로 스캔하는 **또 다른** 가드
  (`typescript-toolchain.test.ts`)가 있는지는 검증되지 않았다.
  - 위치: `.github/workflows/frontend-checks.yml:41-46`(pathspecs 블록, 삭제된 줄은 새 파일에
    없어 게이트 번호가 붙지 않음 — diff 상 옛 43번째 항목이던 `codebase/channel-web-chat/**`
    가 사라진 자리)
  - 상세: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts:46-58`
    (`discoverWorkspaceDirs()`)은 `pnpm-workspace.yaml` 이 선언한 워크스페이스
    (backend·frontend·**channel-web-chat**·packages/*) 전부를 순회해 typescript 선언
    lockstep·compiler API 계약을 검사한다(`52행` 주석: *"pnpm-workspace.yaml 의 고정
    3개(backend·frontend·channel-web-chat)"*). 이 가드는 `codebase/channel-web-chat/**`
    pathspec 이 PR #1190(`3f8543eae`)에서 **마커 미러 가드 때문에** 우연히 추가되기 전부터
    이미 존재했었고(`eeb194b6a`, #1126), 당시엔 이 커버리지가 없었다 — 즉 이번 PR 은 "새
    회귀" 라기보다 **PR #1190 이전 상태로 되돌리는** 것이지만, 그 되돌림이 typescript-toolchain
    가드에 미치는 영향은 이 PR 의 plan(`mirror-guard-single-copy.md`)·Rationale 어디에도
    언급되지 않는다. 실질 위험은 낮다 — `codebase/channel-web-chat/package.json` 변경은
    pnpm workspace 특성상 거의 항상 `pnpm-lock.yaml` 도 함께 바꾸므로(그 pathspec 은
    유지됨), 실제로 트리거가 빠지는 시나리오는 드물다. 다만 이 저장소가 "경로 커버리지 갭"
    클래스를 반복해 겪었다는 점(스크립트·워크플로 헤더 도처에 명시)을 고려하면, 사본 삭제로
    "그 근거가 소멸한다" 고 판단할 때 **그 pathspec 을 쓰는 다른 소비처가 있는지** 전수
    확인이 빠졌다는 점 자체가 이 PR 이 고치려는 패턴(단일 이유만 보고 판단)과 같은 성격이다.
  - 제안: `codebase/channel-web-chat/**` 를 완전히 제거하는 대신, `typescript-toolchain.test.ts`
    가 여전히 그 경로를 필요로 함을 확인하고 (a) pathspec 을 유지하고 주석만
    "typescript-toolchain 가드용" 으로 갱신하거나, (b) `pnpm-lock.yaml` pathspec 으로 충분함을
    plan 에 명시적으로 근거와 함께 남긴다. (참고: consistency-check `plan_coherence.md` INFO
    #2 는 이 줄 제거를 "미러 가드 중복 실행" 관점에서만 다뤘고, typescript-toolchain 소비처는
    지목하지 않았다 — 이 발견은 그와 별개의 새로운 각도다.)

- **[INFO]** 관련 spec 본문 부재(spec fidelity 항목 9) — `spec/` 전체에서 `masked-marker-mirror`·
  `repo-guards.yml` 문자열이 0건이다(실측 grep). 이 PR 이 다루는 영역(CI 워크플로 구조·테스트
  하네스 사본 통합)은 `.claude/docs/`·`PROJECT.md` 소관이며 `spec/` 의 규율 대상이 아니다 —
  `plan/in-progress/mirror-guard-single-copy.md` 의 `spec_impact: none` 은 정확하다(이미
  convention_compliance.md·cross_spec.md 두 consistency checker 가 같은 결론에 실측으로
  도달했고, 본 리뷰도 독립적으로 재확인했다). CRITICAL 대상 아님.

- **[INFO]** consistency-check(`13_20_18`) 가 지적한 WARNING("정본 트래커 항목 `[x]` 이 파일
  경로를 명시하지 않는다")은 실제 구현에서 해소됨을 확인했다 — `plan/in-progress/
  mirror-guard-single-copy.md` §작업 항목이 `plan/in-progress/masked-marker-shared-package.md:165`
  로 파일·앵커를 명시했고(`:82` 부근), 대상 plan(`masked-marker-shared-package.md:165-188`)의
  체크박스도 실제로 `[x]` + 대체 근거로 갱신돼 있다(실측: `plan/in-progress/
  masked-marker-shared-package.md` 가 여전히 `plan/in-progress/`(아직 `complete/` 아님)에
  존재함을 확인, dangling 아님). 재-flag 불필요.

- **[INFO]** 삭제 뒤 잔존 참조 없음 — `git grep`/`jest --listTests` 로 backend
  `masked-marker-mirror-guard.ts`/`.spec.ts` 삭제 후 다른 소스 파일의 import·`test-stages.sh`·
  `jest.config` 어디에도 참조가 남지 않음을 확인. 캐너리 9종(vacuity 방지·파생 비지 않음·
  워크스페이스 src 포함·합성 fixture·함수 선언·경로 접두 겹침·심볼별·오탐 방지 2종) 전부가
  frontend spec 에 그대로 존재함을 라인 단위로 대조 완료 — plan 의 "잃는 검사 없음" 주장이
  사실과 일치한다.

- **[INFO]** 하네스 레지스트리 4곳(`_JOB_CONDITIONS`·`_SKIP_JOB_WORKFLOWS`·`_PULL_REQUEST_KEYS`·
  `_PERMISSIONS`, `test_workflow_yaml_structure.py:260,294,365,418`)이 `repo-guards.yml` 의
  실제 job 조건(`mirror-guard` → `!cancelled()`)·bare `pull_request`·`permissions: contents:
  read` 와 line-level 로 정확히 일치함을 확인(실측 — 실제 29건 하네스 테스트 전부 GREEN).
  `codebase/**` trailing glob 은 depth-0(`codebase/package.json`) 도 잡으므로(`test_ci_paths_
  changed.py::test_matching_change_is_relevant` 가 depth-1 직계 자식 매치를 이미 실측 고정)
  `test_manifest_globs_cover_depth_zero` 갭에 해당하지 않는다 — repo-guards.yml 은 애초에
  `codebase/**/package.json`(middle `**`) 형태를 쓰지 않는다.

## 요약

`repo-guards.yml` 신설 + backend 미러 가드 사본 삭제는 계획(`mirror-guard-single-copy.md`)이
서술한 설계·검증 기준과 코드가 정확히 일치한다 — 4곳 하네스 레지스트리 등록, `CONVERTED` 목록
알파벳 순 삽입, skip-job 패턴(job `needs: changes`+`!cancelled()`, 모든 step `if:` 게이팅,
no-op 안내 step)이 다른 8개 전환 워크플로와 동형이며 실제로 29건 하네스 테스트·44건 vitest 가
모두 GREEN 임을 직접 실행해 확인했다. backend 사본 삭제는 잔존 참조가 없고 캐너리 9종이 frontend
쪽에 전량 보존돼 "동작 무변경" 검증 기준을 충족한다. spec 본문이 이 영역을 규정하지 않아 spec
fidelity 관점 위반은 없다(INFO). 유일하게 실질적인 지적은 `frontend-checks.yml` 의
`codebase/channel-web-chat/**` pathspec 제거가 미러 가드 외에 `typescript-toolchain.test.ts` 라는
또 다른 소비처의 트리거 커버리지에 (낮은 확률이지만 검증되지 않은 채로) 영향을 줄 수 있다는
점이다(WARNING) — 이 PR 자신이 "중복의 이유를 실측 없이 판단하지 않는다" 는 원칙으로 설계됐다는
점에서 이 하나의 사각지대는 그 원칙과 대칭적으로 다뤄질 가치가 있다. CRITICAL 은 없다.

## 위험도

LOW
