# 변경 범위(Scope) Review — commit 30943e8c8

## 전제 확인

`git show --stat 30943e8c8` 로 실제 커밋 파일 목록(15개)을 프롬프트의 "리뷰 대상 파일" 목록과
전수 대조 — **정확히 일치**한다. 프롬프트 밖에 숨겨진 변경 파일은 없다.

커밋 목적은 plan 항목 "frontend 테스트가 어떤 게이트에서도 타입체크되지 않는다"
(`plan/in-progress/harness-review-gate-followups.md`) 를 닫는 것 — backend 에 이미 있는
typecheck ratchet 게이트를 frontend 에도 신설한다.

## 발견사항

- **[INFO]** backend 스크립트를 공유 코어로 리팩토링 — 요청 범위(“frontend 게이트 신설”)를
  기술적으로 넘어선다
  - 위치: `scripts/check-backend-typecheck-ratchet.py` (전체 diff, 187줄 삭제), `scripts/_typecheck_ratchet.py` (신규 219줄)
  - 상세: 이 PR 의 직접 요구사항은 "frontend 에 대응 게이트를 만든다" 이지, "backend 게이트를
    리팩토링한다" 가 아니다. 그런데 backend 의 판정 로직(`run_tsc`/`count_by_file`/
    `load_baseline`/`write_baseline`/`verdict`/`main`)이 통째로 `_typecheck_ratchet.py` 로
    이동하고 `check-backend-typecheck-ratchet.py` 는 68줄짜리 설정 파일로 축소됐다. 다만 이
    선택은 커밋 메시지·`_typecheck_ratchet.py` docstring 양쪽에서 "사본을 두 개 만들면 판정
    규칙이 갈리는데 틀리는 방향이 조용한 통과다 — `plan_guard.py`/`plan-stale-audit.sh` 로 이미
    세 번 데였다" 는 구체적 선례로 근거를 남겼고, frontend 엔트리포인트가 정확히 같은 판정
    규칙(exit 2/증가·감소 양방향 실패)을 요구하므로 "복사 후 갈라지는" 대안보다 방어적이다.
    범위를 벗어난 손대기라기보다는 **신규 기능이 기존 코드의 구조를 강제하는 정당한 경우**에
    가깝지만, 리뷰어라면 "frontend 게이트만 원했는데 backend 파일도 187줄 바뀌었다"는 점은
    변경 단위(revert 단위) 관점에서 기록해 둘 가치가 있다.
  - 제안: 조치 불요(근거가 구체적이고 테스트로 양쪽 다 커버됨). 다음에 유사한 "코어 공유"
    리팩토링을 할 때는 plan 항목에 "backend 엔트리포인트도 함께 리팩토링" 을 명시적으로 적어
    두면 이 판단 근거가 diff 밖에서도 추적된다.

- **[INFO]** 무관해 보이는 파일(`jest-axe.d.ts`/`vitest-matchers.d.ts`)의 타입 선언 버그 수정이
  같은 커밋에 포함
  - 위치: `codebase/frontend/src/test/jest-axe.d.ts` (19줄 삭제), `codebase/frontend/src/test/vitest-matchers.d.ts` (신규 26줄)
  - 상세: "frontend typecheck ratchet 신설" 이라는 목적과 별개로 보일 수 있는 코드 변경 —
    `declare module "vitest"` 가 global script 컨텍스트에서 augmentation 대신 shadowing 으로
    작동해 vitest 타입 전체를 가리던 기존 버그를 고쳤다. 다만 이 수정은 **이 PR 자체의
    전제조건**이다: 고치지 않으면 신설하려는 ratchet 의 첫 baseline 이 1,414건(그중 1,256건
    phantom `TS2305`)으로 잡혀 게이트가 무의미해진다. 커밋 메시지에 뮤테이션 검증(`import
    "vitest"` 제거 시 1,414 로 복귀, matcher 선언 제거 시 `accessibility.test.tsx` RED)까지
    남겨 변경의 필요성과 정확성을 실측으로 뒷받침했다. 범위 이탈이 아니라 "게이트를 넣기 위해
    반드시 걷어내야 했던 선행 결함"으로 판단된다.
  - 제안: 조치 불요. 커밋 메시지에 이미 "왜 이 파일까지 건드렸는지"가 명시돼 있어 revert 단위
    추적에 문제없다.

- **[INFO]** `.claude/tests/test_backend_typecheck_ratchet.py` → `test_typecheck_ratchet.py`
  파일명 변경(삭제+신규, git 이 rename 으로 추적하지 못함)
  - 위치: `.claude/tests/test_backend_typecheck_ratchet.py` (전체 삭제), `.claude/tests/test_typecheck_ratchet.py` (신규)
  - 상세: 테스트 파일이 backend 전용에서 backend+frontend 공용으로 바뀌었으므로 이름 변경
    자체는 합리적이다. 다만 `git diff` 상 rename 감지가 안 돼 리뷰어에게는 "전량 삭제 + 전량
    신규"로 보인다 — 실질적으로는 기존 `ParseTest`/`VerdictTest`/`FailClosedTest`/
    `RunTscFailClosedTest`/`UpdateBaselineTest` 5개 클래스가 파라미터화(`CORE`/`fake_config`)
    형태로 이식되고 `PerPackageShapeTest`/`FrontendTypecheckConfigTest` 2개가 새로 추가된
    것이라, 실제 diff 는 표시된 것보다 작다. 스코프 위반은 아니고 git 메커니즘의 한계다.
  - 제안: 조치 불요. 향후 유사 상황에서 `git mv` 후 편집하면 rename 추적이 유지돼 리뷰가 쉬워질
    수 있다는 점만 참고.

이 외 `.github/workflows/frontend-checks.yml` 신규 job, `.github/workflows/harness-checks.yml`
paths 등재, `codebase/frontend/tsconfig.typecheck.json` 신규, `scripts/frontend-typecheck-baseline.json`
신규, `PROJECT.md`/`.claude/tests/README.md`/`test_workflow_yaml_structure.py`(1줄) 갱신,
`plan/in-progress/harness-review-gate-followups.md` 체크박스 처분은 전부 "frontend typecheck
ratchet 신설"이라는 단일 목적에 직접 필요한 배선(wiring)이며 포맷팅-only 변경, 미사용
임포트, 무관한 주석/설정 변경은 발견되지 않았다.

## 요약

15개 변경 파일 전부가 "frontend 테스트 타입체크 사각 봉인"이라는 단일 plan 항목으로 수렴한다.
`git show --stat` 대조 결과 프롬프트 밖의 은닉 변경은 없다. backend 스크립트를 공유 코어로
재구성한 것과 `jest-axe.d.ts`/`vitest-matchers.d.ts` 버그 수정은 표면적으로는 "요청한 것보다
넓은 변경"처럼 보이지만, 둘 다 신규 게이트가 정확히 동작하기 위한 선행조건이며 커밋 메시지에
실측(뮤테이션 테스트, 진단 건수 재측정)으로 근거가 남아 있어 무분별한 확장이 아니라 목적에
묶인 필연적 변경으로 판단된다. 포맷팅 전용 변경, drive-by 정리, 미사용 임포트, 요청 밖 기능
추가는 관찰되지 않았다.

## 위험도
LOW
