# 문서화(Documentation) 리뷰

## 검토 대상 요약

이번 changeset(39개 파일)의 실질 코드/설정 변경은 `PROJECT.md`, `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`(신설) 5개뿐이고, 나머지는
plan 문서 2개 신설(`jest-esm-native-load.md`, `nestjs-v12-coordinated-upgrade.md`) + 기존 plan
트래커에 백로그 1건 추가(`spec-draft-nullable-notation-followups.md`) + 이전 라운드
(`review/code/2026/09/24/14_24_10`, `review/consistency/2026/09/24/{12_57_36,13_55_20}`) 산출물의
사후 커밋이다.

이전 라운드(`14_24_10`)의 documentation reviewer가 낸 CRITICAL 1건(plan 신규 스텁의
`worktree:` legacy placeholder)과 WARNING 1건(`jest.config.ts` 상단 docstring이 이 PR이 제거한
정규식을 여전히 존재 이유로 서술)은 `RESOLUTION.md`가 조치 완료로 기록했고, 현재 워킹트리를
직접 열어 **둘 다 실제로 반영돼 있음을 확인했다**:

- `plan/in-progress/nestjs-v12-coordinated-upgrade.md:5` → `worktree: (unstarted)`. `plan-scan.ts`의
  `WORKTREE_SENTINEL = "(unstarted)"`와 정확히 일치하고, `WORKTREE_PLACEHOLDER` 정규식에도
  걸리지 않음을 직접 대조했다.
- `codebase/backend/jest.config.ts:3-11` 상단 docstring이 "정규식에 주석 달기 위해 분리"에서
  "그 목록은 사라졌고, 지금 남길 것은 부재가 의도적인 이유"로 갱신돼 현재 파일 내용과 일치한다.
- `codebase/backend/package.json:22-26` 5개 `test*` 스크립트가 전부
  `./node_modules/jest/bin/jest.js`로 통일돼 있다(이전 라운드 WARNING 1 `test:debug` 형태 불일치
  조치 확인).

이 세 건은 재-flag하지 않는다.

## 발견사항

- **[WARNING]** 새 백로그 항목의 "실측 목록은 …뿐이다" 열거가 실제로는 완전하지 않다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:5085` (「docs 가드가 검사하는
    데이터가 그 가드를 트리거하지 않는다」 항목, "실측 목록은 …뿐이다" 문장)
  - 상세: 이 항목은 `.github/workflows/frontend-checks.yml`의 `changes` 잡 pathspec을
    "`codebase/frontend/**` · `codebase/channel-web-chat/**` · `codebase/packages/**` ·
    `pnpm-lock.yaml` · `pnpm-workspace.yaml` · `scripts/ci-paths-changed.sh` ·
    `.github/workflows/_changed-paths.yml` · 공유 셋업 액션뿐이다"라고 적는다. 실제 워크플로 파일을
    열어 대조하면 그 블록에는 이 8개 외에 `.github/workflows/frontend-checks.yml`(자기 자신) ·
    `scripts/_typecheck_ratchet.py` · `scripts/check-frontend-typecheck-ratchet.py` ·
    `scripts/frontend-typecheck-baseline.json` 4개가 더 있다(타입체크 ratchet 임계값이 바뀌는
    커밋을 잡기 위한 등재라고 그 파일 자체가 주석으로 밝히고 있다). "뿐이다"라는 완전성 주장이
    거짓이다. 이 저장소는 열거의 불완전성이 반복 지적된 이력이 있다(자기-메모리:
    「열거 축이 전수를 결정한다」). 이번 경우 결론(`plan/**`·`spec/**`가 어느 쪽에도 없다 →
    plan/spec-only PR은 이 잡을 트리거하지 못한다)은 4개를 추가해도 바뀌지 않지만, 이 목록을
    다른 목적(예: "이 잡이 어떤 파일 변경에 반응하는지" 판단)으로 재사용할 다음 사람에게는
    거짓 정보가 된다.
  - 제안: "뿐이다"를 실제 8+4=12개 전체로 갱신하거나, 완전성을 주장하지 않는 표현(예: "다음을
    포함해 …이 있으나 `plan/**`·`spec/**`는 없다")으로 낮출 것.

- **[INFO]** CHANGELOG 미갱신을 "판정"으로 명시 — 근거 타당
  - 위치: `review/code/2026/09/24/14_24_10/RESOLUTION.md`의 "CHANGELOG — 해당 없음" 절
  - 상세: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표에 빌드/테스트 tooling 변경 행이 없고,
    `CHANGELOG.md`의 기존 항목이 전부 제품 동작·배포 의존성 변경이라는 근거를 직접 대조해
    확인했다 — 타당한 판단이다. 다만 이 판정 자체가 `PROJECT.md` 매핑 표에는 반영되지 않아,
    다음에 유사한 "테스트 러너 tooling-only" 변경이 오면 이 판단을 처음부터 다시 해야 한다.
  - 제안: 필수는 아니나, 매핑 표 하단에 "빌드/테스트 tooling 변경(제품 동작·배포 의존성
    불변)은 CHANGELOG 대상 아님"이라는 한 줄을 남기면 반복 판단 비용을 줄인다. Blocking 아님.

- **[INFO]** `PROJECT.md`의 전방 참조를 가드 스펙 헤더로 정정한 판단이 실제로 유효함을 확인
  - 위치: `PROJECT.md:82`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:6-23`
  - 상세: `RESOLUTION.md`는 최초 `plan/complete/jest-esm-native-load.md`(아직 존재하지 않는
    경로)로 근거를 링크했다가 `test_doc_sync_matrix.py`가 이런 종류의 링크를 검사하지 않는다는
    것을 확인하고 가드 스펙 헤더로 옮겼다고 적는다. 실측 확인: `PROJECT.md:82`는 현재
    `esm-native-load.spec.ts` 헤더를 가리키고, 그 헤더(파일 상단 주석, 6~23줄)가 실제로 배경·
    두 방향 실측 에러 문구·불변식 가드 근거를 담고 있어 참조가 끊기지 않는다. 문서 정합성
    관점에서 문제없음.

## 요약

핵심 코드 변경 3개(`jest.config.ts`/`package.json`/`test/jest-e2e.json`)와 신설 가드 스펙의
인라인 문서화는 예외적으로 상세하고 정확하며, 이전 라운드가 지적한 CRITICAL 1건(plan
frontmatter placeholder)·WARNING 1건(stale docstring)은 실제로 고쳐져 현재 워킹트리와 일치함을
직접 대조로 확인했다 — 재발 없음. 이번 라운드에서 새로 발견한 것은 새 plan 백로그 항목의
pathspec 열거가 "뿐이다"라고 주장하지만 실제로는 4개 항목이 누락된 WARNING 1건뿐이며, 결론
자체(plan/spec-only PR이 docs 가드 잡을 트리거하지 못함)에는 영향이 없다. CHANGELOG 미갱신
판정과 전방 참조 정정 판단은 둘 다 근거를 직접 대조해 타당함을 확인했다. Critical 급 문서화
결함은 없다.

## 위험도

LOW
