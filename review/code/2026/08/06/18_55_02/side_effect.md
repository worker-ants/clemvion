# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `prepare` 스크립트의 의미 변경 — "dist 존재 시 스킵" → "typescript 가 resolve 되면 항상 tsc 실행"
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12`
  - 상세: 7개 내부 패키지의 `prepare` 가 동시에 `[ -d dist ] || tsc` (또는 sdk 의 동등 변형)에서 "typescript resolvable → 항상 tsc, 아니고 dist 있으면 no-op, 아니고 dist 도 없으면 throw" 로 교체됐다. 이는 `pnpm install` 이 호출하는 lifecycle 스크립트의 **동작 계약 변경**이며 두 가지 실질 효과를 가진다. (1) 로컬 개발 환경에서 `dist` 가 이미 존재하는 상태로 (관련 없는 의존성 추가 등으로) `pnpm install` 을 다시 돌리면, 과거엔 조용히 스킵되던 것이 이제 7개 패키지 전부에서 무조건 `tsc` 재컴파일을 유발한다 — 설치 시간 증가. (2) 컴파일 에러가 있는 상태에서 `pnpm install` 을 돌리면 과거엔(dist 가 stale 하게 남아있어) 조용히 성공했던 경우도 이제는 install 자체가 실패한다. 두 효과 모두 이 PR 의 의도된 핵심 수정(정확히 이 갭을 막기 위함)이며 `.claude/tests/test_packages_prepare_contract.py`/`README.md`/`harness-checks.yml` 주석에 측정치와 함께 명시적으로 문서화되어 있어 "숨은" 부작용은 아니다. 다만 "인터페이스 변경이 기존 사용자에 미치는 영향" 관점에서, `pnpm install` 을 호출하는 모든 로컬 개발자·CI job·Docker 빌드가 이 새 계약의 소비자이므로 리뷰 요약에 남겨둘 가치가 있다.
  - 제안: 조치 불필요(의도된 변경, 테스트로 고정됨). 팀 전체에 "이제 `pnpm install` 이 소스 컴파일 에러로 실패할 수 있다"는 점만 공유되면 충분.

- **[INFO]** 7개 `package.json` 동시 변경 — 변경 반경이 넓지만 균일성 테스트로 보호됨
  - 위치: `.claude/tests/test_packages_prepare_contract.py` (`PrepareIsUniformTest.test_every_package_that_builds_uses_the_same_prepare`, 함수 시작 지점 — 전체 파일 컨텍스트 기준 69번째 줄)
  - 상세: 하나의 PR 이 `codebase/packages/` 하위 7개 독립 패키지의 빌드 계약을 동시에 바꾼다. `test_every_package_that_builds_uses_the_same_prepare` 가 "모든 prepare 는 byte-identical 이어야 한다"를 강제하므로, 향후 한 패키지만 조용히 구형 형태로 되돌아가거나 다른 형태로 drift 하면 즉시 실패한다 — 이번 diff 의 넓은 블라스트 레이디어스 자체가 새 회귀 앵커로 고정되어 있다. 실제 조사 결과(backend Dockerfile 의 `deps`→`builder`→`deploy` 3단계) 이 변경이 기존 Docker 빌드 흐름(소스 COPY 이후 `--frozen-lockfile` install, 이후 `--prod` prune 후 재-prepare)과 정확히 맞아떨어짐을 확인했다 — pruned 프로덕션 트리에서 typescript 가 사라진 뒤에도 이미 빌드된 `dist` 가 있으므로 no-op 분기를 타 기존 배포 파이프라인을 깨지 않는다.
  - 제안: 없음(정보성 기록).

- **[INFO]** 신규 테스트의 파일시스템 부작용은 격리되어 있음
  - 위치: `.claude/tests/test_packages_prepare_contract.py` (`PrepareBranchBehaviourTest._run`, 전체 파일 컨텍스트 기준 114번째 줄)
  - 상세: 실제 `prepare` 문자열(`node -e "..."`)을 `tempfile.TemporaryDirectory()` 안에서 `subprocess.run(..., env=env, timeout=60)` 으로 실행한다. `env` 는 `dict(os.environ)` 을 복사해 PATH 만 로컬로 수정하므로 부모 프로세스의 실제 환경변수를 오염시키지 않고, 임시 디렉터리는 `with` 블록 종료 시 자동 정리되어 저장소 밖에 잔여 파일을 남기지 않는다. `timeout=60` 으로 hang 방지도 되어 있다. 의도치 않은 파일시스템/환경변수 부작용은 없다.
  - 제안: 없음(확인 완료, 문제 없음).

- **[INFO]** `harness-checks.yml` 트리거 확장은 다른 워크플로와 중복되지 않음
  - 위치: `.github/workflows/harness-checks.yml:69`
  - 상세: `codebase/packages/*/package.json` 를 harness-checks 트리거에 추가했다. 저장소에는 이미 `packages-checks.yml`, `frontend-checks.yml` 등이 `codebase/packages/**` 를 감시하지만, 이번 추가는 그와 다른 목적(harness 파이썬 스위트 — `test_packages_prepare_contract.py` — 를 매니페스트 단독 수정 PR 에서도 트리거)이라 중복 실행이 아니라 갭을 메우는 추가 커버리지다. `*` 는 GitHub Actions glob 에서 `/` 를 넘지 않으므로 `codebase/packages/<pkg>/package.json` 딱 한 단계만 매칭 — 실제 7개 패키지 디렉터리 구조와 일치한다.
  - 제안: 없음.

## 요약

핵심 변경은 7개 내부 패키지의 `prepare` npm 스크립트를 "dist 디렉터리 존재만 확인" 에서 "typescript 가 resolve 되면 항상 재컴파일, 아니면 dist 존재 여부로 no-op/throw 분기" 로 교체한 것이다. 이는 `pnpm install` 이라는 광범위하게 소비되는 인터페이스의 동작 계약을 바꾸므로 파급 범위는 넓지만(전체 저장소의 모든 `pnpm install` 호출자), (1) CI 는 항상 fresh checkout 이라 기존 동작과 동일하고, (2) 유일하게 동작이 달라지는 로컬 개발 흐름·Docker 프로덕션 prune 경로 둘 다 신규 테스트(`test_packages_prepare_contract.py`)와 저장소의 기존 Dockerfile 흐름 대조로 검증되어 있으며, (3) 전역 변수·환경변수·네트워크 호출·이벤트/콜백 축에서는 문제되는 변경이 없고 신규 테스트도 임시 디렉터리로 완전히 격리되어 부작용이 없다. 발견된 항목은 전부 "의도되고 문서화된, 그러나 넓은 블라스트 레이디어스를 갖는 인터페이스 변경"이라는 성격의 INFO 수준이며, 코드 결함이나 숨은 부작용은 확인되지 않았다.

## 위험도

LOW
