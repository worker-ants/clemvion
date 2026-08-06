# 아키텍처(Architecture) 리뷰

## 리뷰 대상 요약

`codebase/packages/*` 내부 6개 패키지의 `prepare` 스크립트를 `[ -d dist ] || tsc`(디렉터리
존재만 확인)에서 typescript 가용성 기반 3분기(항상 컴파일 / no-op / throw) 스크립트로 교체하고,
이를 지키는 `.claude/tests/test_packages_prepare_contract.py` 를 신설, `harness-checks.yml` 의
`paths:` 트리거에 `codebase/packages/*/package.json` 을 등재, `.claude/tests/README.md` 카탈로그에
행을 추가한 harness/빌드-도구 계층 변경.

## 발견사항

- **[INFO]** `prepare` 스크립트 로직이 7개 `package.json` 파일에 문자 그대로(byte-identical) 중복된다.
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12`
  - 상세: 약 500자 길이의 동일한 `node -e "..."` 문자열이 7개 매니페스트에 물리적으로 복제되어 있다. DRY 관점에서는 결합도 문제로 보일 수 있으나, 이 저장소는 이미 같은 패턴(물리적 중복 + 동일성을 강제하는 테스트)을 다른 곳에서도 정책으로 채택하고 있다 — 예: `.claude/workflows/*.js` 세 파일에 걸친 `SHARED-BLOCK`(sandbox 가 `import` 를 금지하므로 어쩔 수 없이 복제) 을 `test_workflow_scripts.py` 가 바이트 단위로 대조. 이번 변경도 `test_packages_prepare_contract.py::PrepareIsUniformTest.test_every_package_that_builds_uses_the_same_prepare` 가 `len(distinct) == 1` 을 단언해 드리프트를 구조적으로 막는다. `node -e` 형태를 쓰는 이유(Windows 호환성, review #231)도 코드 주석에 근거로 남아 있어, 셸 스크립트 파일로의 추출을 의도적으로 배제한 결정임을 알 수 있다.
  - 제안: 현재 수준에서는 fix 불요. 다만 이 인라인 스크립트가 더 복잡해지거나 8번째 패키지가 추가되는 시점에는 `scripts/prepare-package-dist.mjs` 같은 단일 소스로 추출하고 각 `package.json` 은 `node ../../scripts/prepare-package-dist.mjs` 로 위임하는 편이 "복제 후 테스트로 동일성 강제" 보다 근본적으로 결합도가 낮다 — 지금은 정당화된 트레이드오프이므로 정보성으로만 남긴다.

- **[INFO]** 새 테스트가 문자열 비교가 아니라 실제 서브프로세스 실행으로 세 분기(항상 컴파일 / no-op / throw)를 검증한다.
  - 위치: `.claude/tests/test_packages_prepare_contract.py:114-169` (`PrepareBranchBehaviourTest`)
  - 상세: `_run()` 이 격리된 임시 디렉터리에 가짜 `tsc` 바이너리와 가짜 `typescript/package.json` 을 배치하고 실제 `sh -c <prepare>` 를 구동한다. "데이터 도출"(매니페스트에서 `prepare` 목록 추출)과 "행위 검증"(그 스크립트를 실제로 실행)을 별개 `TestCase` 로 분리한 것은 책임 분리가 명확하고, 이 리포의 다른 가드들(`test_review_gate_ci.py` 의 `VerdictComesFromTheGateTest` 등)과 같은 "정적 파싱이 아니라 행위로 증명" 원칙을 일관되게 따른다. 결함이 아니라 긍정적 관찰.

- **[INFO]** CI 트리거 스코프가 `codebase/packages/*/package.json` 로 정확히 좁혀져 있고 `codebase/packages/**` 전체가 아니다.
  - 위치: `.github/workflows/harness-checks.yml:69`
  - 상세: 이 harness 스위트는 매니페스트(계약)만 감시하면 되고 패키지 소스 변경마다 돌 필요는 없다는 모듈 경계 판단이 주석(`harness-checks.yml:65-68`)에 명시되어 있고 glob 폭도 그 판단과 일치한다. `frontend-checks` 등 다른 워크플로가 이미 `codebase/packages/**` 소스 변경을 커버하므로 책임이 중복되지 않는다 — 경계가 명확하다.

- **[INFO]** harness 테스트(`.claude/tests/`)가 product 코드 트리(`codebase/packages/`)를 직접 순회(`PACKAGES_DIR.iterdir()`)한다.
  - 위치: `.claude/tests/test_packages_prepare_contract.py:52,57`
  - 상세: `.claude/tests/README.md` 자체가 이미 이런 교차 참조를 명시적으로 허용한 전례(`test_doc_sync_matrix.py` 가 `codebase/`·`spec/` 를 참조 — "harness↔product binding" 이라고 README 에 기재)가 있으므로 새로운 레이어 위반이 아니라 기존에 승인된 패턴의 연장이다. 다만 이 결합이 늘어날수록 harness 스위트가 product 디렉터리 구조 변경(패키지 rename/이동)에 취약해진다는 점은 인지해 둘 가치가 있다 — 지금 시점에는 감내 가능한 수준.

순환 의존성, 레이어 책임 붕괴, God-object/anti-pattern, 인터페이스 오남용 등 CRITICAL/WARNING 급 구조적 결함은 발견되지 않았다.

## 요약

이번 변경은 애플리케이션 레이어를 건드리지 않는 순수 빌드-도구/harness 계층 변경으로, `prepare` 스크립트의 행위(디렉터리 존재 확인 → typescript 가용성 기반 3분기)를 7개 패키지에 걸쳐 일관되게 교체하고 그 일관성을 테스트로 구조적으로 강제한다. 물리적 코드 중복(7개 `package.json` 에 동일 스크립트 복제)이 눈에 띄지만, 이는 이 저장소가 이미 다른 곳(`SHARED-BLOCK`, `EnvValueSubpatternSharedTest` 등)에서 채택한 "복제 + 바이트 단위 동일성 테스트" 정책과 일관되고 근거(cross-platform `node -e`)도 문서화되어 있어 아키텍처 결함이라기보다 의도된 트레이드오프로 판단된다. CI 트리거 스코프(`codebase/packages/*/package.json` 로 한정)와 신규 테스트의 설계(문자열 비교가 아닌 서브프로세스 행위 검증)는 모듈 경계와 테스트 추상화 수준 모두 적절하다. 순환 의존성, 레이어 침범, 안티패턴은 관찰되지 않았다.

## 위험도

LOW
