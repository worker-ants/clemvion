# 변경 범위(Scope) 코드 리뷰

## 컨텍스트 확인 방법

Payload 에는 diff 가 아니라 7개 파일의 **전체 파일 컨텍스트**만 주어져, 실제 변경분은
대상 워크트리(`harness-guard-followups-f7140c`)의 git 이력으로 직접 재구성했다.

**주의(중요)**: `git status` 확인 결과 이 브랜치는 `origin/main` 과 **7개 대 1개로
diverge** 되어 있었다(`git merge-base origin/main HEAD` = `cdad5a1ec`). 실제로
`git diff origin/main..HEAD` 를 그대로 썼다면 `origin/main` 이 이 브랜치 이후 독립적으로
추가한 무관한 커밋(다른 작업 `spec-draft-frontend-layering` 의 `spec/0-overview.md`,
`spec/conventions/frontend-layering.md`, `review/consistency/2026/07/17/{19_44_52,20_00_05}/*`
19개 파일)이 **역방향 삭제 diff**로 섞여 나왔을 것이다(직접 확인: `git diff --stat
<merge-base>..origin/main` 로 그 19개 파일이 origin/main 쪽에만 있음을 검증). 이는
과거 기록된 실패 패턴("origin/main 이 base 앞서면 `git diff origin/main` 이 reverse-diff
로 오염")과 정확히 같은 함정이라 병합base(`cdad5a1ec9ea9b0d9cdc02dc181cd4a42471550b`)를
diff 기준으로 명시해 이 브랜치의 **순수 기여분**만 골라냈다(`git diff
<merge-base>..HEAD`). 리뷰 대상 7개 파일은 이 순수 기여분과 정확히 일치했다.

재구성 결과, 리뷰 대상 7개 파일은 아래 커밋들로만 만들어졌다:

- `bbf72268e`, `d31f99a11` — 이번 작업(plan §A: bootstrap npm install 경쟁 + 부분
  설치 영속)의 원 구현. **직전 세션의 코드 리뷰(`review/code/2026/07/18/00_59_56`,
  scope.md 포함)가 이미 이 두 커밋을 라인 단위로 대조해 위험도 NONE 으로 판정**했다.
- `441820b89`, `e8a056fec`, `8308515c4` — 그 `00_59_56` 리뷰의 SUMMARY WARNING
  W1/W2/W3/W7/W8/W9/W10/W11/W12/W13 을 그대로 반영한 **RESOLUTION fix 커밋 3건**
  (`RESOLUTION.md` 의 조치표와 1:1 대조 완료).
- `48a8e2da1`, `7459ec16a` — `00_59_56` 리뷰 산출물·plan 갱신 docs 커밋. `git show
  --stat` 로 확인한 결과 이 두 커밋은 `review/**`, `plan/**` 만 건드리고 리뷰 대상
  7개 파일 중 어느 것도 손대지 않았다.

이번 라운드(02_06_42)는 "resolution 후 fresh 재리뷰"에 해당하므로, 3개 fix 커밋이
① `00_59_56` 이 지목한 항목에 정확히 대응하는지, ② fix 과정에서 새 범위 이탈이
끼어들지 않았는지를 각 커밋의 실제 diff(`git show <sha> -- <file>`)로 직접 대조했다.

## 발견사항

범위를 벗어나는 변경을 찾지 못했다. 점검한 8개 관점 전부 결과를 아래에 남긴다.

- **의도 이상의 변경 없음**: 3개 fix 커밋이 건드린 파일은 `bootstrap-session.sh`
  (`441820b89`), `test_bootstrap_mermaid_install.py`(`441820b89`),
  `lint_mermaid_posttooluse.py`(`e8a056fec`), `test_mermaid_lint_ready.py`
  (`e8a056fec`), `harness-checks.yml`(`8308515c4`) 다섯 개뿐이며, 각 hunk 를 커밋
  메시지가 선언한 SUMMARY 번호(W1/W2/W3/W7/W8/W9/W10/W11/W12/W13)와 대조한 결과
  전부 정확히 대응했다. `mermaid_lint_ready.py`, `.githooks/pre-commit` 두 파일은
  이번 3개 fix 커밋 중 어디에서도 변경되지 않아(원 커밋 `d31f99a11` 그대로) 이미
  `00_59_56` 리뷰가 확인한 상태와 동일하다.
- **불필요한 리팩토링 없음**: `00_59_56` 리뷰가 W6(아키텍처, `bootstrap-session.sh`
  책임#2를 `ensure-mermaid-lint-deps.sh` 로 추출하자는 제안)을 냈지만, RESOLUTION.md
  에 "main 의 이번 지시 3분류 어디에도 W6 이 없어 손대지 않았다"고 명시돼 있고 실제로
  3개 fix 커밋 중 어느 것도 그 추출을 수행하지 않았다 — 이후 `7459ec16a` 커밋으로
  별건 plan 항목 G 로 등록만 했다(코드 변경 0). 파일을 이미 만지는 김에 "같이
  정리"하고 싶은 유혹을 참아낸, scope 규율이 정확히 지켜진 사례다.
- **기능 확장(over-engineering) 없음**: W2·W12 조치는 코드 동작을 바꾸지 않는 순수
  주석(알려진 한계 문서화)이며, 새 환경변수나 새 분기·새 옵션을 추가하지 않았다.
  `MERMAID_INSTALL_LOCK_GRACE_SEC`/`MERMAID_INSTALL_RETRY_SEC` 등 기존 표면은
  이번 3개 커밋에서 변경되지 않았다.
- **무관한 파일 수정 없음**: 병합base 기준 이 브랜치의 전체 순변경분(44개 파일)을
  전수 확인한 결과, 리뷰 대상 7개 코드 파일 외에는 `.claude/tests/README.md`(+2,
  신규 테스트 파일 2개의 커버리지 표 행 추가 — `bbf72268e`/`d31f99a11` 소속, 이미
  `00_59_56` 확인 완료), `.gitignore`(+4, `.install.lock/` 무시 주석 — 동일),
  `plan/in-progress/harness-guard-followups.md`, `review/code/2026/07/17/20_06_45/**`,
  `review/code/2026/07/18/00_59_56/**` 뿐이었고 전부 이 작업 자신의 plan·리뷰
  산출물이라 저장소 컨벤션(`CLAUDE.md` "정보 저장 위치") 상 정상 위치다. `codebase/**`,
  `spec/**` 등 무관 영역은 이 브랜치의 순수 기여분에 전혀 없었다(`spec/` 변경 2건은
  전부 origin/main 의 **다른 작업** 소속임을 위 방법으로 이미 분리 확인).
- **포맷팅 변경 혼입 없음**: 리뷰 대상 7개 파일에 대해 `--ignore-all-space` diff 와
  일반 diff 의 라인 통계(837 insertions / 9 deletions)가 완전히 동일 — 공백만
  다른 hunk 가 실질 변경에 섞여 있지 않다.
- **주석 변경**: 이번 3개 fix 커밋이 추가/수정한 주석(W1 초단위 산술 설명, W2/W12
  "Known limitation" 블록, W10 "rmdir's"→"removes" 정정, W11 테스트 docstring
  요약)은 전부 그 커밋이 고치는 로직·정책을 1:1 로 설명하며, 대상과 무관한 주석
  편집은 없었다.
- **임포트 변경**: `lint_mermaid_posttooluse.py` 에 추가된 `import traceback` 은
  `except Exception: traceback.print_exc(...)` 에서 실사용, `test_mermaid_lint_ready.py`
  에 추가된 `import json`/`from unittest import mock` 도 각각 `json.dumps(payload)`,
  `mock.patch("os.path.isdir", ...)` 에서 실사용 확인 — 미사용 임포트 없음.
- **설정 변경**: `harness-checks.yml` 의 유일한 변경은 `paths:` 에 `.githooks/**`
  한 줄(+ 3줄 주석) 추가뿐이며, 이는 바로 이 브랜치가 만든 `.githooks/pre-commit`
  결속 테스트(`ConsumerBindingTest`)가 그 워크플로로만 실행된다는 W3 지적에 대한
  최소 대응이다 — CI 트리거 조건 자체를 넓히거나 다른 잡·스텝을 건드리지 않았다.

### 참고(신규 지적 아님, 연속성 확인)

`bootstrap-session.sh` 헤더의 "Three"→"Four responsibilities" 정정은 `00_59_56`
리뷰가 이미 INFO 로 분류(무관한 pre-existing drift 정정이지만 순수 텍스트·위험
없음·디스클로즈됨)했고, 이번 3개 fix 커밋에서는 손대지 않아 그 상태 그대로다 — 이번
라운드의 새 발견사항이 아니라 이전 판정이 계속 유효함만 재확인한다.

## 요약

리뷰 대상 7개 파일의 순변경분은 `git merge-base`(`cdad5a1ec`)를 기준으로 재구성한
결과 plan §A(bootstrap npm install 경쟁 + 부분 설치 영속) 원 구현(`bbf72268e`,
`d31f99a11` — 이미 `00_59_56` 세션이 위험도 NONE 으로 스코프 검증)과, 그 세션이 낸
10개 WARNING(W1·W2·W3·W7·W8·W9·W10·W11·W12·W13)을 그대로 반영한 3개 RESOLUTION fix
커밋(`441820b89`/`e8a056fec`/`8308515c4`)에만 정확히 대응했다. 각 fix 커밋의 실제
diff 를 라인 단위로 대조한 결과 커밋 메시지가 선언한 범위를 벗어나는 hunk 는 없었고,
`origin/main` 이 이 브랜치와 무관하게 앞서 나간 19개 파일(다른 작업의 spec/consistency
산출물)은 병합base 고정으로 명확히 분리해 오염 없이 확인했다. 특히 W6(아키텍처
리팩터 제안)을 "지정된 것만 처리" 원칙에 따라 이번 fix 라운드에서 의도적으로
건드리지 않고 별건 plan 항목으로만 등록한 점은 scope 규율이 정확히 작동한 사례다.
전체적으로 이 변경은 자기 리뷰 발견사항에 정확히 대응하는 RESOLUTION 커밋들의
모범 사례에 해당한다.

## 위험도

NONE
