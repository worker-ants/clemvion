# 요구사항(Requirement) 리뷰 — 내부 패키지 등록 목록 drift 가드

## 검증 방법

정적 리뷰에 더해 실제로 다음을 실행/실측했다.

- `codebase/packages/*` 7개 디렉터리와 각 `package.json` name 필드 실측.
- `codebase/backend/package.json` 의 `@workflow/*` 의존 5개 실측(가드의 "backend-공유" 모집단과 대조).
- `pnpm vitest run .../internal-package-registration.test.ts` — **12/12 통과** (verbose 로 각 assertion 이 vacuous 하지 않음을 확인).
- **뮤테이션 테스트 2건** (수정 후 원복, `git status`/`git diff` 로 무잔존 확인):
  1. `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 에서 `"@workflow/ai-end-reason"` 제거 → PR #968 과 동일한 회귀 재현 → 가드가 정확히 `cmd_build` 케이스를 `AssertionError: ... 실행되지 않는 패키지: @workflow/ai-end-reason` 로 잡음(3개 케이스 fail, 9 pass).
  2. `packages-checks.yml` 의 `matrix.pkg` 에서 `'@workflow/ai-end-reason'` 삭제 → 가드가 즉시 red.
- `gh api repos/:owner/:repo/actions/permissions` → `enabled:false`, `gh run list --workflow=packages-checks.yml/harness-checks.yml` → 0건. 파일 헤더 주석의 "Actions 전역 비활성·런 수 0" 주장과 정확히 일치.
- `tsconfig.json` exclude에 `src/**/__tests__/**` 존재, `vitest.config.ts` include 가 `src/**/*.{test,spec}.{ts,tsx}` 글롭이라 신규 파일이 배선 없이 자동 발견됨을 확인 — 주석의 "호출부 없음/컴파일타임 단언 무의미" 주장과 일치.

## 발견사항

- **[INFO]** 관련 spec 문서 부재 (spec fidelity 항목 9)
  - 위치: `spec/` 전역 grep — `INTERNAL_PACKAGES`, `packages-checks.yml`, `internal-package-registration` 어느 것도 매치 없음.
  - 상세: 이 변경은 `.claude/`(harness 자동화)·`.github/workflows/`(CI 배선)·frontend 내부 테스트 인프라에 대한 순수 리포지토리 tooling 가드로, `spec/` 이 규정하는 제품 요구사항 도메인(기능 명세) 밖이다. 따라서 spec 본문과의 line-level 불일치 여부를 판정할 대상 자체가 없다 — CRITICAL/SPEC-DRIFT 아님, 정보성 확인.
  - 제안: 조치 불요. (참고: `plan/in-progress/eia-context-schema-followups.md` L36 이 이 계열 작업의 배경이 되는 "다른 내부 packages harness 배선" 항목을 이미 완료로 기록하고 있어, 이번 커밋은 그 항목의 사후 하드닝으로 문맥상 자연스럽다.)

- **[INFO]** `internalPackages()` 파서가 큰따옴표만 인식
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:407-411` (`/"([^"]+)"/g`)
  - 상세: `INTERNAL_PACKAGES=(...)` 항목이 향후 홑따옴표로 바뀌면 이 정규식이 빈 배열을 반환한다. 다만 이 실패는 침묵이 아니라 "INTERNAL_PACKAGES 를 파싱한다" vacuity 테스트가 즉시 red 로 잡으므로(fail-closed) 실질적 위험은 낮다. 현재 파일의 실제 컨벤션(전부 큰따옴표)과도 일치.
  - 제안: 조치 불요(현행 컨벤션 유지 시 무해). 스타일 가이드 상 홑따옴표 허용을 명시적으로 금지하고 싶다면 코멘트에 한 줄 추가 고려.

- **[INFO]** 신규 `repo-guards/` 네임스페이스가 기존 레이어 가드(`src/lib/__tests__/eslint-layering-guard.test.ts`, PR #967/#969)와 다른 디렉터리 관례를 사용
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/`
  - 상세: 같은 "repo 구조/등록 목록 drift 를 막는 자체-검증 테스트" 계열이 두 개의 다른 폴더 컨벤션(`src/lib/__tests__/*` vs `src/lib/repo-guards/__tests__/*`)으로 나뉘게 됐다. 기능상 문제는 없고(vitest include 글롭이 양쪽 다 커버), 강제 컨벤션 문서도 없어 CRITICAL/WARNING 대상 아님.
  - 제안: 조치 불요. 추후 3번째 유사 가드가 생기면 그때 통일 여부 판단.

## 요약

세 파일 모두 실제로 검증했다: `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 은 **주석 전용** 변경(diff에 기능 코드 변화 없음, `git diff HEAD~3` 로 확인)이고, 신규 테스트 `internal-package-registration.test.ts` 가 PR #968 에서 실제로 발생한 "INTERNAL_PACKAGES 누락 → run-test.sh 는 그 패키지를 건너뛰고도 status=PASS" 사고를 정확히 겨냥한 drift 가드다. 코드에 실린 모든 사실 주장(Actions 전역 off·런 수 0, backend `@workflow/*` 5개 의존, packages 클로저 flat, tsconfig exclude/vitest include 배선)을 리포지토리에서 직접 실측해 전부 일치함을 확인했고, 12개 assertion 전부 현재 통과하며 vacuity 방지 테스트까지 갖춰 "조용히 항상 PASS" 위험을 스스로 차단한다. 추가로 2건의 뮤테이션 테스트(INTERNAL_PACKAGES 항목 삭제, matrix.pkg 항목 삭제)로 가드가 실제 회귀를 잡아내는지 직접 재현·원복까지 검증했으며 두 경우 모두 즉시 red 로 전환됨을 확인했다. CRITICAL/WARNING 급 기능 결함이나 spec 불일치는 발견되지 않았고, 남은 항목은 전부 INFO 수준의 이론적 견고성 메모다.

## 위험도
NONE
