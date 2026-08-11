# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 테스트 메서드 이름이 새로 추가된 단언(`--strict-peer-dependencies`)을 반영하지 못함
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:107` (`def test_pnpm_receives_frozen_lockfile_and_the_filter`)
  - 상세: 이 테스트는 이제 `argv(proc)` 전체 리스트를 통해 `--frozen-lockfile` 뿐 아니라 `--strict-peer-dependencies` 존재까지 단언한다(120번째 줄 `assertEqual` 대상 리스트에 포함됨). docstring(108~114줄)은 두 플래그를 모두 언급하도록 갱신됐지만 메서드 이름은 여전히 `frozen_lockfile_and_the_filter` 만 가리킨다. 향후 `strict-peer-dependencies` 관련 회귀를 검색·확인하려는 사람이 메서드 이름만으로는 이 테스트를 찾기 어렵고, 중복 테스트를 실수로 새로 추가할 여지가 있다.
  - 제안: 메서드 이름을 `test_pnpm_receives_frozen_lockfile_strict_peer_deps_and_the_filter` 등으로 갱신하거나, 두 플래그를 별도 테스트로 분리해 각각의 이름이 검증 대상을 정확히 반영하도록 한다.

- **[INFO]** `ARGC=5` 매직 넘버가 별도 소스(전체 argv 리스트)와 암묵적으로만 동기화됨
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:134` (`self.assertIn("ARGC=5", proc.stdout, proc.stdout)`)
  - 상세: 이 숫자 `5` 는 `install`, `--frozen-lockfile`, `--strict-peer-dependencies`, `--filter`, `<value>` 총 5개 인자를 세어 나온 값인데, 그 유도 과정이 주석·상수 어디에도 명시돼 있지 않다. 이번 diff 는 정확히 `4`→`5` 로 갱신했지만, 향후 `action.yml` 의 install 커맨드에 플래그가 추가/제거될 때 이 리터럴을 손으로 다시 세어 맞춰야 하며, 놓치면 (인용이 깨져 인자가 분할되는) 실제 회귀와 (단순히 플래그 개수가 늘어난) 무해한 변경을 이 단언이 구분하지 못하게 된다.
  - 제안: `len(argv(proc))` 를 직접 비교하거나, 최소한 `ARGC=5  # install + --frozen-lockfile + --strict-peer-dependencies + --filter + value` 형태로 숫자의 유도 근거를 주석으로 남긴다.

- **[INFO]** `pnpm-workspace.yaml` 신규 섹션의 구분선 스타일이 파일 내 기존 관례와 다름
  - 위치: `pnpm-workspace.yaml:124` (`# ── peer dependency 게이트 ──────────────────────────────────────────────────`)
  - 상세: 이 파일의 기존 섹션들(`overrides`, `onlyBuiltDependencies`, `auditConfig` 등, 1~123줄)은 모두 일반 주석 문단으로 구획되고 유니코드 박스 문자(`──`)를 쓴 헤더가 없다. 이번에 추가된 `peer dependency 게이트` 섹션만 이 구분선을 새로 도입해, 같은 파일 안에서 섹션 헤더 스타일이 갈린다.
  - 제안: 기존 섹션과 동일하게 일반 주석 문단으로 시작하거나, 반대로 가독성 개선이 의도라면 기존 섹션들에도 같은 구분선을 소급 적용해 파일 전체의 일관성을 맞춘다.

- **[INFO]** plan 체크리스트에서 완료 항목의 서술 길이가 형제 항목 대비 크게 김
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:92`~`93` (체크된 두 항목)
  - 상세: 같은 `## 체크리스트` 섹션의 미완료 항목들(94~96줄, 예: `- [ ] §2 eslint 10 상향 — 10개 워크스페이스 + config 검증`)은 한 줄 요약인 반면, 이번에 체크된 두 항목은 여러 문장의 조사 경위·정정 이력을 통째로 담아 문단 수준으로 길다. 체크리스트 본연의 "한눈에 스캔" 기능이 이 두 항목에서만 떨어진다.
  - 제안: (의도적으로 감사 추적을 남기는 것이라면 그대로 두되) 상세 서술은 본문 인용문(42~67줄)에 이미 있으므로 체크리스트 항목 자체는 한 줄 요약 + "상세는 위 실측 표 참조" 정도로 축약하는 것도 고려할 수 있다. 다만 이 저장소는 체크박스 완료 시 근거를 함께 남기는 관례가 있어(MEMORY: `feedback_plan_checkbox_actual_state`), 의도된 선택일 가능성이 높다 — 우선순위 낮음.

## 요약

이번 변경은 4개 파일(테스트 가드, composite action, plan 문서, workspace 설정)에 걸쳐 `--strict-peer-dependencies` 게이트 도입을 일관되게 반영하고 있다. 소스(action.yml)와 이를 고정하는 가드(test_pnpm_workspace_action.py)를 함께 갱신한 점, 왜 이 플래그가 필요한지·왜 억제 규칙을 넣지 않았는지를 각 파일에 근거와 함께 남긴 점은 이 저장소의 기존 문서화 관례(풍부한 rationale 주석)와 잘 맞는다. 심각한 가독성·복잡도·중복 문제는 없으며, 발견된 사항은 모두 사소한 네이밍 정밀도·매직 넘버·스타일 일관성 수준의 INFO 급이다.

## 위험도
LOW
