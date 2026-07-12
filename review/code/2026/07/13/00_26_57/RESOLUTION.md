# RESOLUTION — ai-review (00_26_57) eia-context 내부 패키지 eslint/harness/CI

원 리뷰: `review/code/2026/07/13/00_26_57/SUMMARY.md` — RISK LOW, CRITICAL 0, WARNING 3(+documentation disk-write gap).

## WARNING (반영/판정)
- **W1 (Maintainability) — 패키지 목록 3곳 하드코딩**: ✅ `test-stages.sh` 에 `INTERNAL_PACKAGES` 배열 +
  `_run_internal <stage>` 헬퍼 추출, cmd_lint/cmd_unit/cmd_build 3함수가 loop 공유 → 15줄 중복 제거,
  다음 내부 패키지 추가 시 단일 지점 갱신.
- **W3 (Testing/Maint) — packages-checks.yml 단일 job 실패 은폐**: ✅ `strategy.matrix`(fail-fast:false)
  per-package job 으로 재작성 — 다중 패키지 동시 실패 시 신호 완전화 + web-chat-checks.yml 패턴 통일.
- **W2 (Testing) — harness 커버리지 회귀 가드 부재**: 후속 등재(plan). pnpm-workspace glob 파싱으로
  test-stages.sh 완전성 검증하는 harness unittest, 또는 test-stages.sh 를 harness-checks trigger 등재 —
  신규 infra 라 별 slice.
- **W4 (documentation disk-write gap)**: tooling/CI 배선(eslint config·harness·yml)은 리포 관례상
  README/CHANGELOG 동반 갱신 대상 아님(선행 npm→pnpm 전환도 CHANGELOG 없음, spec 범위 밖). fresh 라운드가 재확인.

## INFO (판정)
- ✅ I5: test-stages.sh 상단 주석에 내부 공유 packages 반영.
- I2 (eslint config 보일러플레이트 5중복): rule-of-three, 6번째 패키지 시 base config 추출 → tracked(plan I2 기존).
- I3 (package.json 배열 재포맷 노이즈): 생성 스크립트 JSON.stringify 부산물, low risk — 수용(되돌림 불요).
- I6 (devDeps 정렬 vs web-chat-sdk 비정렬): 강제 규약 없음 — 수용.
- I1(action pin)/I7/I8/I9: 리포 전역 기존 패턴/의도 — 조치 불요.

## 검증
- bash 문법 OK + 리팩터된 lint 스테이지(INTERNAL_PACKAGES loop) PASS.
- packages-checks.yml matrix yaml valid.
- 본 라운드 변경은 `.claude/**`·`.github/**`·plan·review (codebase/** 무변경) → e2e 면제 화이트리스트.
  직전 라운드 e2e(253)·5패키지 lint/test/build 유효.

fresh `/ai-review --branch origin/main` 후속(W1/W3 확인 + documentation 회수).
