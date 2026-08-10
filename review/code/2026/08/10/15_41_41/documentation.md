# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `.claude/tests/test_pnpm_workspace_action.py` 모듈 최상단 docstring이 이 PR 이 이미 두 라운드에 걸쳐 잡고 고친 것과 **똑같은 과장 문구**("이 저장소 전체에서 이 한 줄이 유일하다")를 그대로 보존
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:5-6` (`## 왜 이 파일이 있는가` 절, `git blame` 확인 결과 `5fd068a26a`(2026-08-09, 이번 PR 이전의 액션 추출 커밋)부터 존재 — 이번 diff 가 건드린 hunk(`@@ -104,15 +104,26 @@` 이하) 밖이라 프롬프트 unified diff 에는 없음)
  - 상세: 5-6번 줄은 "추출 전에는 `pnpm install --frozen-lockfile --filter "<scope>"` 가 워크플로마다 **한 줄씩 직접** 적혀 있었다. 지금은 저장소 전체에서 **그 한 줄이 여기 하나뿐**이다." 라고 단정한다. 그런데 바로 같은 파일 안, 이번 diff 로 새로 작성된 `InstallCommandTest.test_pnpm_receives_both_gate_flags_and_the_filter` 의 docstring(107-110줄, 이번 diff 로 정확히 이 문제를 두 번째로 고친 자리)은 "**저장소 전체의 유일한 소재지가 아니다**(`pnpm install` 은 5곳에 있다)" 라고 정반대를 명시한다. 즉 파일 하나 안에서 상단 요약은 "여기 하나뿐" 이라 하고 100여 줄 아래 테스트는 "여기 하나뿐이 아니다" 라고 한다 — `.github/actions/pnpm-workspace/action.yml` 자체에서 이미 한 번(63/66줄 vs 75-78줄), `.claude/tests/README.md:52` 에서 또 한 번(직전 라운드 documentation 리뷰가 WARNING 으로 지목·조치 완료) 발견돼 고쳐진 바로 그 자기모순 클래스의 **네 번째 인스턴스**다. 두 라운드의 documentation 리뷰(`review/code/2026/08/10/15_11_16/documentation.md`, `review/code/2026/08/10/15_23_40/documentation.md`)가 모두 이 파일을 대상에 포함했지만 놓친 이유가 확인된다: 두 라운드 다 이번 diff 가 편집한 클래스 docstring(107-110줄)만 살폈고, diff 밖의 모듈 최상단 docstring(1-32줄)은 스코프에 들어오지 않았다. `pnpm install --frozen-lockfile --filter "<scope>"` 형태의 줄은 실제로 `codebase/backend/Dockerfile`·`codebase/frontend/Dockerfile`·`codebase/frontend/Dockerfile.playwright-e2e` 세 곳에도 있어(`--strict-peer-dependencies` 가 추가된 것 말고는 같은 패턴), "여기 하나뿐" 이라는 문장은 문언 그대로 거짓이다. 처음 이 문구를 믿고 action 한 곳만 고쳤다가 CRITICAL 이 났다는 사실(RESOLUTION #1)을 이 파일 스스로도 알고 있는데, 그 사실을 배우기 전에 쓰인 오래된 요약 문장만 갱신에서 빠졌다.
  - 제안: "지금은 저장소 전체에서 **그 한 줄이 여기 하나뿐**이다." 를 "지금은 **CI 워크플로가 공유하는 install 한 줄**이 여기 하나다(저장소 전체의 유일한 소재지는 아니다 — `pnpm install` 은 5곳에 있고, `test_install_gate_flags.py` 가 다섯 곳의 일치를 정적으로 대조한다)." 처럼, 같은 파일 107-110줄이 이미 쓴 caveat 를 그대로 끌어와 정정. 파급(blast radius) 서술("이 줄이 망가지면 9개 잡이 한꺼번에 잘못된다")은 CI 워크플로 컨텍스트에서는 여전히 정확하므로 그대로 두고, "저장소 전체" 라는 수식어만 좁히면 된다.

- **[INFO]** 직전 두 라운드의 documentation 리뷰가 지적한 3건("유일한 소재지" — `action.yml:63/66`, `test_pnpm_workspace_action.py` 클래스 docstring, `tests/README.md:52`)은 현재 작업 트리 실측 결과 전부 정정 상태를 확인
  - 위치: `.github/actions/pnpm-workspace/action.yml:67`("**"저장소에서 유일한 소재지" 가 아니다**"), `.claude/tests/test_pnpm_workspace_action.py:108-110`("저장소 전체의 유일한 소재지가 아니다"), `.claude/tests/README.md:52`("Not the only copy in the repository — …")
  - 상세: 세 곳 모두 "CI 워크플로가 공유하는 한 줄" 로 범위를 좁히고 5곳 존재를 명시하는 caveat 를 달고 있어, 정정이 요청대로 반영됐다. 위 WARNING 항목(모듈 docstring)만 같은 클래스의 미반영 잔여다.
  - 제안: 없음 — 확인 완료 기록.

- **[INFO]** CHANGELOG.md 미갱신은 정상 범위 판단
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: `CHANGELOG.md` 는 `git log`상 backend/frontend 런타임 동작(보안 수정·API 변경·엔진 로직 등) 항목만 기록해 왔고, CI/의존성 하니스 강화(devDependency install 플래그) 류는 이 문서의 관례 범위 밖이다. 이번 변경은 사용자 대면 동작을 바꾸지 않으므로 CHANGELOG 항목이 없는 것 자체는 결함이 아니다.
  - 제안: 없음.

## 요약

핵심 코드·테스트·plan·설정(`pnpm-workspace.yaml`) 4개 파일은 이번 diff 범위 안에서 서로 잘 동기화돼 있고, 직전 두 라운드가 지적한 "유일한 소재지" 과장 문구 3건도 실측상 전부 정정되어 있다. 다만 지시받은 대로 저장소 전체를 같은 용어 축("유일"·"only"·"전부"·"한 줄이")으로 재추적한 결과, 정확히 같은 클래스의 **네 번째** 인스턴스가 발견됐다 — `test_pnpm_workspace_action.py` 자신의 모듈 최상단 docstring(diff 밖, 이번 PR 이전부터 존재)이 "이 저장소 전체에서 이 한 줄이 여기 하나뿐" 이라고 여전히 단정하는데, 같은 파일 100여 줄 아래 이번 diff 로 새로 쓰인 테스트 docstring은 정확히 그 반대("유일한 소재지가 아니다")를 명시한다. 기능에는 영향 없는 순수 서술 오류이지만, 이 문구를 믿었던 것이 이 PR 이 열리게 된 원인(CRITICAL, RESOLUTION #1)이었던 만큼 같은 파일 안의 자기모순으로 남겨 두면 다음 유지보수자를 다시 같은 방향으로 오도할 수 있다.

## 위험도
MEDIUM
