# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `.github/actions/pnpm-workspace/action.yml` 의 "유일한 소재지" 서술이 같은 주석 블록 안에서 자기모순 — 직전 라운드가 고친 "8개 워크플로" 오기와 동일 클래스가 살아남았다
  - 위치: `.github/actions/pnpm-workspace/action.yml:63,66` (모순의 앞쪽) vs `.github/actions/pnpm-workspace/action.yml:75-78` (같은 파일, 뒤쪽 정정)
  - 상세: 63번 줄은 "`--frozen-lockfile` 은 ... 이제 저장소에서 **이 한 줄이 유일한 소재지**다" 라고 하고, 66번 줄은 "'유일한 소재지' 는 이제 두 플래그 모두에 대한 서술이다" 라며 그 단정을 `--strict-peer-dependencies` 까지 확장한다. 그런데 불과 몇 줄 아래(75-78)에서 같은 주석 블록이 "다만 여기가 **전부는 아니다** — `pnpm install` 은 `.claude/test-stages.sh` 와 Dockerfile 3개에도 있고 그쪽도 같은 플래그를 받는다. 다섯 곳을 다 짚어야 `#1049` 경로가 닫힌다" 라고 정확히 반대되는 사실을 적는다. 즉 이 파일 하나 안에서 "여기가 유일한 소재지" 와 "여기 말고 4곳 더 있다"가 동시에 주장된다. 실제로 `git log`(`db2cca7a1`)로 확인한 바 이 diff 자체가 정확히 그 5곳(action + test-stages.sh + Dockerfile ×3) 전부에 게이트를 적용한 커밋이므로, "유일한 소재지" 프레이밍은 이 diff 가 스스로 뒤집은 전제를 상단에 그대로 남겨 둔 것이다. 이 세션이 방금 겪은 것과 정확히 같은 클래스("게이트 소재지 오지목"·"소비자 수" 오기)이고, 직전 라운드 requirement 리뷰가 이미 이 정확한 문구를 INFO 로 지목하며 "CRITICAL 항목 해소 시 자연히 문구도 재검토될 것"이라 예측했으나 — 실제로는 CRITICAL 이 해소되면서 오히려 이 문구가 (66번 줄에서) *강화*됐고, 정정 문장(75-78)만 별도로 추가돼 모순이 남았다.
  - 제안: 63·66번 줄의 "이 한 줄이 유일한 소재지" / "'유일한 소재지' 는 이제 두 플래그 모두에 대한 서술" 표현을 "**CI 워크플로가 공유하는 install 한 줄의 소재지**"(즉 9개 잡/5개 워크플로 파일이라는 CI 컨텍스트 한정) 등으로 좁히거나, 아예 삭제하고 75-78번 줄의 "다섯 곳 전부" 서술로 통일한다. 같은 파일 안에서 두 문장이 서로를 반박하는 상태로 두지 않는다.

- **[WARNING]** `.claude/tests/test_pnpm_workspace_action.py` 의 신규 테스트 docstring이 위 모순을 그대로 이식 — action.yml 자신의 정정 문구(다섯 곳)를 결여한 채 "유일한" 만 남았다
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:107-109` (`def test_pnpm_receives_both_gate_flags_and_the_filter`)
  - 상세: 이번 diff 로 새로 작성된 docstring 이 "저장소에서 `--frozen-lockfile` + `--strict-peer-dependencies` 의 **유일한** 소재지다 — 인자로 확인한다" 라고 단정한다. 그러나 같은 커밋(`db2cca7a1`)이 정확히 이 두 플래그를 `.claude/test-stages.sh`·`codebase/backend/Dockerfile`·`codebase/frontend/Dockerfile`·`Dockerfile.playwright-e2e` 4곳에도 추가했으므로, 이 테스트가 검증하는 `action.yml` 은 다섯 곳 중 하나일 뿐 "유일한 소재지"가 아니다. `action.yml` 쪽 주석(위 항목)은 최소한 뒤쪽에 정정 문장을 달아 뒀는데, 이 테스트 docstring 은 그 caveat 없이 "유일한" 이라는 단어만 그대로 가져와 오히려 더 절대적으로 읽힌다. 같은 커밋 안에서 형제 파일(`action.yml`)이 스스로 부정하는 주장을 다른 파일이 무비판적으로 반복하는 형태다.
  - 제안: "**이 액션이 받는 인자**로 두 플래그를 확인하는 유일한 테스트다"(테스트 커버리지의 유일성)처럼 검증 대상을 좁히거나, "다섯 소재지 중 CI 잡이 공유하는 한 곳" 임을 명시. `action.yml` 의 caveat 문장(다섯 곳 전부)을 그대로 인용해도 된다.

- **[WARNING]** `.claude/tests/README.md` 카탈로그 행이 이번 diff 로 편집됐음에도 "저장소에서 유일한 사본" 이라는 이제-거짓인 문장을 그대로 보존
  - 위치: `.claude/tests/README.md:52`
  - 상세: 이 행은 이번 diff 로 실제로 편집됐다(끝에 "**2026-08-10**: `--strict-peer-dependencies` joined `--frozen-lockfile` on that same line..." 문장이 추가됨). 그런데 그 편집이 손대지 않은 앞쪽 문장이 여전히 "`pnpm install --frozen-lockfile --filter <scope>` used to be one line per workflow, and is now **the only copy in the repository**" 라고 적혀 있다. 직전 라운드 RESOLUTION.md #4 는 "`tests/README.md` 카탈로그 행도 동반 갱신"이라 적어 이 행이 완전히 정정된 것처럼 기록했지만, 실제로는 뒤에 문장 하나를 덧붙였을 뿐 "the only copy in the repository" 자체는 고치지 않았다 — 그리고 그 주장은 위 두 항목과 정확히 같은 이유(5곳 존재)로 거짓이다. 세 파일(action.yml·test 파일·이 README) 이 모두 같은 PR 에서 편집됐는데 정확히 같은 문구가 세 곳 모두에서 살아남은 것은, 이 세션이 이미 두 번 겪은 "소재지/소비자 수 오기" 패턴이 세 번째로 반복된 것이다.
  - 제안: "and is now **the only copy in the repository**" 를 "and is now the only copy among the CI check workflows(5 more call sites — local harness + 3 Docker builds — carry the same flags but are documented/tested separately)" 등으로 정정하거나, 최소한 "the only copy" 뒤에 각주로 5곳 존재를 명시.

- **[INFO]** 위 세 건의 공통 근본 원인 — "소재지 유일성"을 서술하는 문장이 3개 파일에 손으로 복제돼 있고, 이를 하나로 묶는 테스트가 없다
  - 위치: `.github/actions/pnpm-workspace/action.yml:63-66`, `.claude/tests/test_pnpm_workspace_action.py:107-109`, `.claude/tests/README.md:52`
  - 상세: 이 저장소는 정확히 이 클래스의 결함(hand-synced 서술이 서로 갈라짐)을 `test_e2e_exemption_paths_sync.py`·`test_router_safety_policy_doc.py` 등 전용 바인딩 테스트로 반복해 막아 온 전례가 있다(같은 PR 의 `.claude/tests/README.md` 카탈로그 텍스트 자체가 이 전례를 언급한다). "소비자 수"(9개 잡/5개 워크플로)는 `ConsumerBindingTest.consumers()` 라는 SoT 로 고정돼 있어 이번 라운드에서 3곳 모두 정확히 갱신됐지만, "install 호출부가 몇 곳인가"(1곳 vs 5곳)는 그런 SoT 테스트가 없어 코멘트마다 다른 답을 하게 됐다.
  - 제안: 필수는 아니나, `.claude/tests/test_pnpm_workspace_action.py` 에 "`--frozen-lockfile`/`--strict-peer-dependencies` 를 받는 `pnpm install` 호출부는 정확히 5곳(action + test-stages.sh + Dockerfile×3)"임을 실측하는 가벼운 테스트(예: 5개 경로에 대한 grep 카운트 어서션)를 추가하면, 향후 소재지 수가 바뀔 때 산문 서술이 다시 갈라지는 것을 막을 수 있다.

- **[INFO]** (해결됨, 참고용) 이전 라운드가 지적한 3건 — 게이트 소재지 오지목(`deps-security-checks.yml`)·소비자 수(8→9잡/5파일)·`eslint-unicorn-peer.spec.ts` 의 "미도입" stale 주석 — 은 현재 작업 트리 실측 결과 전부 정정되어 있다
  - 위치: `pnpm-workspace.yaml:124-140`(다섯 소재지 정확히 열거, `deps-security-checks.yml` 참조 없음), `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:199-206`("미도입" 문구 없음, 게이트와 이 테스트의 관계를 축이 다르다고 명시), 관련 파일 전체에서 "8개 워크플로" 재검색 시 이 PR 범위 안에는 잔존 인스턴스 없음(전부 "9개 잡/5개 워크플로"로 통일).
  - 상세: 지시받은 대로 저장소 전체를 용어 축("`--frozen-lockfile` 유일한 소재지"·"8개 워크플로"·"미도입")으로 재검색했다. "8개 워크플로"·"미도입" 두 축은 이 PR 이 건드리는 범위 안에서 전부 정정된 상태였고, 남은 매치는 전부 무관한 주제(spec 의 다른 기능 미도입 결정, 과거 review/ 아카이브)였다. "유일한 소재지" 축만 위 3건(WARNING)으로 살아있었다.
  - 제안: 없음 — 확인 완료 기록.

## 요약

핵심 코드 변경(5곳 install 호출부에 `--strict-peer-dependencies` 적용, `pnpm-workspace.yaml` peer 억제 정책 주석, plan 문서의 조사 이력)은 잘 문서화돼 있고, 직전 라운드가 잡은 "게이트 소재지 오지목"·"소비자 수 오기"·"`미도입` stale 주석" 3건은 실측 결과 전부 정정되어 있다. 다만 지시받은 대로 같은 클래스를 용어 축으로 저장소 전체에서 추적한 결과, **"`--frozen-lockfile`/`--strict-peer-dependencies` 의 유일한 소재지"라는 서술이 같은 성격의 새 결함으로 남아 있다** — `action.yml` 자신이 한 주석 블록 안에서 "유일한 소재지" 라고 썼다가 몇 줄 뒤에 "다섯 곳 중 하나일 뿐" 이라고 스스로 정정하는 자기모순을 보이고, 이번 diff 로 새로 작성된 테스트 docstring 과 손대지 않은 README 카탈로그 문장은 그 정정 없이 "유일한"/"the only copy" 를 그대로 반복한다. 직전 라운드 requirement 리뷰가 이 문구를 INFO 로 지목하며 "CRITICAL 해소 시 자연히 재검토될 것"이라 예측했으나 실제로는 재검토되지 않고 오히려 문구가 하나 더 늘었다 — 이 저장소가 반복해서 겪은 "hand-synced 서술이 코드 변경을 따라가지 못하는" 클래스의 세 번째 인스턴스다. 기능에는 영향 없는 순수 서술 오류이지만, 다음에 5곳 중 한 곳을 실수로 빠뜨렸을 때 "유일한 소재지"라는 문구를 믿은 사람이 나머지 4곳을 점검하지 않을 위험이 있다.

## 위험도
MEDIUM
