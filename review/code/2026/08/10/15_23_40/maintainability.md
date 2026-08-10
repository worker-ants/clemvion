# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `--frozen-lockfile --strict-peer-dependencies` 플래그 쌍이 이제 5곳에 손으로 복제됐는데, 그중 1곳(composite action)만 실행 검증 가드가 있고 나머지 4곳은 무방비다
  - 위치: `.claude/test-stages.sh:20` · `codebase/backend/Dockerfile:41` · `codebase/frontend/Dockerfile:38` · `codebase/frontend/Dockerfile.playwright-e2e:52` (문자열 복제 4곳) / 대조: `.github/actions/pnpm-workspace/action.yml:87`(가드 있는 유일한 곳, `.claude/tests/test_pnpm_workspace_action.py::InstallCommandTest.test_pnpm_receives_both_gate_flags_and_the_filter` 가 실제 argv 로 고정)
  - 상세: **추출은 권하지 않는다** — 세 매체(Dockerfile `RUN`, bash 함수, GitHub Actions composite `run:`)가 실행 시점·격리 방식이 근본적으로 다르다. Dockerfile 은 빌드 컨텍스트 안에서 COPY 된 것만 보이므로 공유 스크립트를 쓰려면 각 Dockerfile 에 COPY 레이어를 추가해야 하고(캐시 무효화 비용), composite action 은 자신이 checkout 을 하지 않는다는 이 파일 자체의 설계 제약(`action.yml` 상단 주석 "## checkout 은 왜 안 들어 있나")이 있어 저장소 스크립트를 무조건 참조하기 어렵다. 2단어짜리 리터럴 플래그 쌍을 위해 이 이질성을 가로지르는 런타임 추출을 만드는 비용이 중복 자체의 비용보다 크다 — `action.yml:76-78` 의 신설 주석도 정확히 이 판단("다섯 곳을 다 짚어야 `#1049` 경로가 닫힌다")을 그대로 문서화하고 있어, 판단 자체는 코드에도 남아 있다.
    다만 **판단이 맞다고 해서 위험이 사라지는 것은 아니다.** 실제로 이번 라운드의 CRITICAL 이 정확히 이 갭에서 나왔다 — 처음엔 `action.yml` 한 곳만 고치고 "한 줄이 전부를 덮는다"고 적었다가 리뷰가 나머지 4곳을 짚었다(`RESOLUTION.md` §1). 지금은 5곳 모두 수정됐지만, `.claude/test-stages.sh`·Dockerfile 3개는 여전히 **실행 검증이 없는 평문**이다 — 앞으로 누군가 그중 하나를 손으로 고치다 플래그를 빠뜨려도 어떤 테스트도 RED 를 내지 않는다(`scripts/check-e2e-playwright-config.py` 는 이 Dockerfile 들의 COPY 목록·버전 정렬만 검사하고 `RUN pnpm install` 줄의 플래그는 검사 대상이 아님 — `grep -n "RUN\|pnpm install" scripts/check-e2e-playwright-config.py` 0건으로 직접 확인). `#1049` 자체가 "설치가 경고만 내고 조용히 통과"한 사고였고, 이 저장소가 반복해 겪은 클래스가 정확히 "게이트가 문서/코드 한 곳에는 있는데 다른 소재지에는 없어 조용히 새는" 형태(`.claude/tests/README.md` 의 여러 항목이 "coverage gap this repo has hit six times" 로 명시)라는 점에서, 4곳이 아무 자동 신호 없이 남아 있는 상태는 그 클래스의 재발 조건 그 자체다.
  - 제안: 런타임 추출 대신, `test_e2e_exemption_paths_sync.py` 류의 **문자열/정적 대조 가드**를 하나 추가하는 것을 고려할 것 — `.claude/test-stages.sh`·3개 Dockerfile 의 해당 `RUN`/설치 줄을 읽어 `--frozen-lockfile`·`--strict-peer-dependencies` 두 토큰이 모두 있는지 확인하는 가벼운 정적 테스트(예: `.claude/tests/test_pnpm_install_flags_sync.py`). `test_pnpm_workspace_action.py` 처럼 실제 bash 실행까지는 필요 없고, 다섯 소재지를 나열한 명시적 목록 하나가 다음 편집에서 "무엇을 다 고쳐야 하는지" 사람이 다시 세지 않아도 되게 만든다 — 이번에 처음 놓친 것과 같은 실수를 코드 리뷰가 아니라 테스트가 잡게 된다.

- **[INFO]** `pnpm-workspace.yaml` 신규 섹션의 구분선 스타일이 파일 내 기존 관례와 여전히 다름 (이전 라운드에서 지적된 항목, 미반영 상태로 남음)
  - 위치: `pnpm-workspace.yaml:124` (`# ── peer dependency 게이트 ──────────────────────────────────────────────────`)
  - 상세: 같은 파일의 다른 섹션(`overrides`·`onlyBuiltDependencies`·`auditConfig`, 1~122줄)은 전부 일반 주석 문단으로 시작하고 유니코드 박스 문자(`──`) 헤더를 쓰지 않는다. 직전 라운드(`review/code/2026/08/10/15_11_16/maintainability.md`)에서 이미 INFO 로 지적됐고 우선순위 낮음으로 남겨졌는데, 이번 라운드 diff 에서도 그대로 유지돼 파일 안에서 섹션 헤더 스타일이 하나만 갈린 상태가 지속된다.
  - 제안: 필수 아님 — 다음에 이 파일을 편집할 기회에 기존 문단 스타일로 맞추거나, 반대로 가독성 개선이 목적이라면 다른 섹션에도 소급 적용해 일관성을 맞출 것.

- **[INFO]** plan 체크리스트 완료 항목의 서술 길이가 형제 항목 대비 여전히 김 (이전 라운드 지적, 의도된 감사 추적 관례로 판단돼 낮은 우선순위 유지)
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:92`~`93`
  - 상세: 같은 `## 체크리스트` 섹션의 `- [ ] §2 …` 항목들(94~96줄)은 한 줄 요약인 반면 이번에 체크된 두 항목은 조사·정정 경위를 문단째 담아 스캔 가독성이 떨어진다. 이 저장소는 체크박스 완료 시 근거를 남기는 관례가 있어(예: 이전 라운드에서도 동일 판단) 의도적 선택으로 보이며, 이번 라운드에서 추가로 악화되지는 않았다.
  - 제안: 없음 — 참고 사항으로만 유지.

## 요약

이번 diff 의 핵심은 CRITICAL 로 지적된 "게이트가 한 곳에만 있다"를 5개 호출부(액션 1 + Dockerfile 3 + 로컬 하니스 1) 전부로 넓히는 수정이다. 지시받은 판정 — 5곳 복제가 추출 대상인가 — 에 대한 답은 **아니다**: Dockerfile·bash·composite action 은 실행 시점·격리 경계가 근본적으로 달라, 2토큰짜리 플래그 문자열을 위해 매체를 가로지르는 공유 아티팩트를 만드는 비용이 중복 자체보다 크고, 이 판단은 `action.yml` 자신의 신설 주석에도 이미 명시돼 있다. 다만 추출을 안 한다는 결정이 자동 검증 부재를 정당화하지는 않는다 — 5곳 중 4곳(`.claude/test-stages.sh`, Dockerfile ×3)은 여전히 어떤 테스트로도 지켜지지 않는 평문이고, 이번 라운드 CRITICAL 이 발생한 경로(처음엔 1곳만 고치고 "전부 덮는다"고 적었던 것) 자체가 바로 이 갭에서 나왔다. 가벼운 정적 대조 가드 하나로 이 잔여 위험을 닫을 수 있다. 그 외 함수 길이·중첩·순환 복잡도·네이밍에서 새로운 문제는 없고, 이전 라운드에서 지적된 스타일 수준의 INFO 2건(구분선 스타일·체크리스트 서술 길이)은 낮은 우선순위로 그대로 남아 있다. `review/code/2026/08/10/15_11_16/**` 로 새로 추가된 리포트 파일들은 세션별로 보존되는 리뷰 산출물(코드가 아님)이라 유지보수성 기준의 적용 대상에서 제외했다.

## 위험도
LOW
