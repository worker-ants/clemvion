# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** 신규로 들어온 Dockerfile 3개 + `.claude/test-stages.sh` 확장은 §1 범위 **안**이다 — plan 원문이 처음부터 "CI/로컬 게이트" 를 명시했고, 직전 리뷰 라운드의 CRITICAL 이 지적한 "고칠 곳을 절반만 봤다"는 결함을 이번 diff 가 완결시킨 형태다
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:28`(변경 없는 원 서술 — "`pnpm install --strict-peer-dependencies` 를 **CI/로컬** 게이트에 도입.") / `plan/in-progress/deps-peer-gating-and-eslint10.md:93`(이번 diff 로 갱신된 체크리스트 — "`pnpm install` 호출부 **5곳 전부**에 추가... plan 자신이 'CI/**로컬** 게이트' 라고 적어 둔 범위였다") / `review/code/2026/08/10/15_11_16/RESOLUTION.md:5-16`(직전 라운드 CRITICAL #1의 지적·판정·조치 근거) / 실제 5개 지점: `.claude/test-stages.sh:20`, `.github/actions/pnpm-workspace/action.yml:87`, `codebase/backend/Dockerfile:41`, `codebase/frontend/Dockerfile:38`, `codebase/frontend/Dockerfile.playwright-e2e:52`
  - 상세: `Read` 로 plan 파일을 직접 열어 확인한 결과 "조치 후보" 절(§1, 변경되지 않은 문구)이 애초에 "CI/**로컬** 게이트에 도입" 이라고 적어 뒀다 — 즉 이번 changeset 이전부터 §1 티켓 범위 자체가 CI 워크플로 하나(`action.yml`)로 국한되지 않고 로컬 실행 경로(`test-stages.sh`)와 이미지 빌드(Dockerfile 3개, 그중 backend/frontend 는 `e2e.yml`이 실제 CI 에서 빌드하고 playwright 는 `make e2e-test-full`이 CI/로컬 양쪽에서 빌드)까지 포함하도록 서술돼 있었다. 직전 라운드(`15_11_16`)의 requirement reviewer 가 CRITICAL 로 지적한 지점이 정확히 이 갭이었고(`review/code/2026/08/10/15_11_16/requirement.md` — "게이트가 install 호출부 한 곳에만"), `RESOLUTION.md` 가 "다섯 곳 전부에 적용" 으로 대응한 내역이 그대로 이번 diff 에 반영돼 있다. 따라서 3개 Dockerfile + `test-stages.sh` 확장은 새 기능 추가나 티켓 밖 리팩터가 아니라, **plan 자신이 처음부터 선언한 범위를 뒤늦게 완전히 채운 것**이다. 각 Dockerfile 의 diff 도 기존 `RUN pnpm install ...` 줄에 플래그 하나를 삽입하는 것 외에 다른 COPY·스테이지·레이어 변경이 전혀 없어, 부수적 변경도 섞이지 않았다.
  - 제안: 없음 — 범위 판정 결과를 기록하는 용도의 INFO. plan §1 은 이 확장으로 실질적으로 완료됐다고 볼 수 있다.

- **[INFO]** `review/code/2026/08/10/15_11_16/*` 신규 파일 11개(SUMMARY.md·RESOLUTION.md·meta.json·_retry_state.json·reviewer 리포트 7개)는 이번 diff 가 대응하는 직전 `/ai-review` 라운드의 산출물이며, 내용이 전부 §1(peer 게이트) 주제에 국한돼 스코프 이탈이 아니다
  - 위치: `review/code/2026/08/10/15_11_16/` 디렉터리 전체(파일 11~21)
  - 상세: CLAUDE.md 의 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약상 이 라운드는 §1 코드 변경에 대한 필수 리뷰 사이클이고, `review/` 는 gitignore 대상이 아니라 정상적으로 git 추적되는 영역이다(팀 관례). 11개 파일 전부를 확인한 결과 §2(eslint 10 상향)·다른 티켓으로 새는 언급은 없고, 전부 `--strict-peer-dependencies` 도입·소재지·소비자 수 문제만 다룬다. 즉 파일 개수는 많지만 주제 결속은 유지된다.
  - 제안: 없음.

- **[INFO]** `pnpm-workspace.yaml` 신규 주석이 게이트 "소재지"를 `action.yml` 한 곳으로만 서술해, 같은 diff 로 함께 확장된 나머지 4개 지점(로컬·Dockerfile)이 그 주석에는 반영돼 있지 않다 — scope 위반은 아니지만 위 판정과 관련해 참고할 사항
  - 위치: `pnpm-workspace.yaml:126-129`
  - 상세: 해당 주석은 "소재지는 `.github/actions/pnpm-workspace/action.yml` 의 install 한 줄이다(9개 잡 / 5개 워크플로 파일이 그 action 을 거친다 — 실측)" 이라고만 적는다. 이 자체는 "CI 워크플로 잡들이 거치는 소재지" 라는 좁은 의미로는 정확하지만(문장이 "CI 게이트"라고 한정), 같은 diff 가 동시에 로컬(`test-stages.sh`)과 이미지 빌드(Dockerfile 3개)에도 플래그를 넣었다는 사실은 이 파일 자체의 주석에는 드러나지 않는다. `action.yml`(파일 4) 쪽 주석은 이 5곳 전체를 명시(“다만 여기가 전부는 아니다 — … Dockerfile 3개에도 있고 … 다섯 곳을 다 짚어야 `#1049` 경로가 닫힌다”)하고 있어 정보가 한쪽에는 있고 다른 쪽에는 빠진 비대칭 상태다. 이는 스코프(변경 범위)가 아니라 문서 완결성 성격의 관찰이라 documentation reviewer 영역과 겹치므로 별도 조치를 강제하지는 않는다.
  - 제안: 필요 시 `pnpm-workspace.yaml` 주석 끝에 "로컬/이미지 빌드 4곳도 동일 플래그를 받는다(`action.yml` 주석 참조)" 한 줄만 추가하면 두 파일의 서술이 대칭을 이룬다 — 우선순위 낮음.

CRITICAL/WARNING 급 스코프 이탈(§2 eslint 10 상향 파일 혼입, 무관한 리팩토링, 포맷팅 전용 변경, 미사용 임포트, 의도치 않은 설정 변경)은 발견되지 않았다.

## 요약

이번 diff 의 핵심 판단 대상이었던 "Dockerfile 3개 확대가 §1 범위 안인가"는 **범위 안**으로 판정한다. `Read` 로 plan 원문을 직접 확인한 결과 §1 조치 후보 문구가 애초부터 "CI/로컬 게이트" 를 명시했고, 직전 리뷰 라운드가 CRITICAL 로 지적한 "install 호출부 한 곳만 고쳤다"는 결함(그중 3곳은 실제 CI 경로에서 지금도 실행됨)을 이번 diff 가 `RESOLUTION.md` 에 남긴 근거 그대로 5곳 전부로 확장해 닫았다. `.claude/tests/README.md`·`test_pnpm_workspace_action.py`·`eslint-unicorn-peer.spec.ts`·`pnpm-workspace.yaml` 의 주석/테스트 갱신도 전부 이 플래그 추가로 인해 사실이 어긋나게 된 기존 서술을 바로잡는 직접 파생 변경이며, §2(eslint 10 상향)에 속하는 파일은 일절 건드리지 않았다. 함께 커밋된 `review/code/2026/08/10/15_11_16/*` 11개 파일도 같은 §1 작업에 대한 필수 리뷰 사이클 산출물로 주제 이탈이 없다. 유일한 관찰 사항은 `pnpm-workspace.yaml` 자체 주석이 5곳 중 1곳(action.yml)만 언급해 `action.yml` 쪽 주석과 정보 비대칭이 있다는 점인데, 이는 스코프보다 문서 완결성 문제이고 이미 INFO 로 남겼다.

## 위험도

NONE
