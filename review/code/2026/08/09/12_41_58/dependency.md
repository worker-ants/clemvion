# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `dompurify` 패치 버전 상향(GHSA-55q2-fjhq-7xh7, moderate 해소) — 핀 정책·해소 상태 정합 확인
  - 위치: `codebase/channel-web-chat/package.json:15` (`"dompurify": "3.4.13"`), `codebase/frontend/package.json:47` (`"dompurify": "^3.4.13"`)
  - 상세: 두 패키지 모두 취약 상한(`<=3.4.12`)을 벗어나는 `3.4.13`으로 올랐다. `channel-web-chat`은 기존 exact pin(`//pin` 주석의 "공급망 무결성" 사유)을 그대로 유지했고 `frontend`는 기존 caret 범위 형태를 유지해 프로젝트 버전 핀 정책과 어긋나지 않는다. `pnpm-lock.yaml` 실측 결과 트리 전체에서 `dompurify@3.4.13` 단일 버전만 해소되어(`3.4.12` 잔존 없음) 두 임포터가 실제로 같은 해소 버전을 쓴다.
  - 제안: 없음 — 정상 조치.

- **[INFO]** `nanoid` override 신설(GHSA-2v37-7h3g-55p8, high 해소) — 2곳 등록 규약 준수 확인
  - 위치: `pnpm-workspace.yaml:56-62`(override 선언), `scripts/check-pnpm-security-config.py:54`(`EXPECTED_OVERRIDES["nanoid"] = "^3.3.17"`)
  - 상세: `codebase/frontend`가 `postcss`를 직접 의존하는 경로(`postcss@8.5.25 > nanoid@3.3.16`)가 취약했고, 같은 트리의 `next>postcss` 경로(`nanoid@3.3.17`)는 이미 안전했던 비대칭 상태였다. `next>postcss` 스코프 override로는 전자 경로를 못 덮으므로 `nanoid` 패키지 자체에 바닥(`^3.3.17`)을 건 것은 타당한 선택이고, 저장소의 "override 2곳 동시 갱신" 규약(`pnpm-workspace.yaml` + `check-pnpm-security-config.py`)도 지켰다. `pnpm-lock.yaml` 실측 결과 `nanoid@3.3.17` 단일 버전만 해소되어(`3.3.16` 잔존 없음) 실제로 두 경로 모두 수렴했다.
  - 제안: 없음 — 정상 조치.

- **[INFO]** `nanoid` override가 패키지 전역(unscoped) 형태 — 향후 major 상향 요구와 충돌 가능성
  - 위치: `pnpm-workspace.yaml:62` (`nanoid: ^3.3.17`)
  - 상세: 같은 파일의 `next>postcss`·`undici@>=7.0.0 <7.29.0` 등은 특정 의존 경로/범위로 스코프된 override인 반면, `nanoid`는 트리 전체에 적용되는 전역 override다. 주석이 "트리에 3 계열만 있음을 실측했다"고 명시해 현재는 안전하지만, 향후 어떤 신규 의존성이 `nanoid@^4`(ESM-only, breaking API)나 `^5`를 요구하게 되면 pnpm override가 그 요구를 조용히 `3.3.17`로 눌러버려 설치는 성공하되 런타임에서 예기치 않게 깨질 수 있다(전역 override는 특정 상위 패키지 요구를 우회하므로 semver 불일치를 install 단계에서 드러내지 않는다).
  - 제안: 낮은 확률의 미래 리스크이므로 이번 PR을 막을 사유는 아님. `check-pnpm-security-config.py`/`check-override-floors.py`가 override 목록을 정기 감시하고 있으므로 그 안에서 자연히 재검토될 것 — 별도 조치 불요, 기록만.

- **[INFO]** `pnpm-lock.yaml`의 `libc:` 필드 57줄 삭제는 본 변경(의존성 버전 상향)과 무관한 재생성 부작용 — 이미 별도 추적됨
  - 위치: `pnpm-lock.yaml` (`@img/sharp-libvips-linux-*`·`@css-inline/*` 패키지 블록들의 `libc: [glibc|musl]` 행)
  - 상세: `plan/in-progress/ci-required-check-skip-jobs.md`(§lockfile 의 `libc:` 57줄이 함께 사라진다)와 `plan/in-progress/deps-guard-hardening.md`(§후속 — lockfile `libc:` 필드가 커밋마다 진동한다, P3)에서 근본 원인(핀된 `pnpm@10.23.0`이 축약 packument를 써 `libc` 필드를 채우지 못함)을 실측으로 특정하고 후속 항목으로 이미 등재했다. `--frozen-lockfile` 검증에는 영향 없다고 명시돼 있어 이번 diff의 결함은 아니다.
  - 제안: 없음 — 이미 추적 중.

- **[INFO]** 신규 외부 의존성 없음, GitHub Actions 핀 버전 불변
  - 위치: `.github/workflows/deps-security-checks.yml`, `.github/workflows/frontend-checks.yml`, `scripts/ci-paths-changed.sh`
  - 상세: `changes` 잡은 기존 핀 `actions/checkout@v7`만 재사용하고, 판정 스크립트는 bash+git만 쓴다(신규 외부 도구 없음). 신규 테스트(`test_required_check_skip_jobs.py`)의 `import yaml`도 저장소가 이미 승인한 유일한 non-stdlib 예외(PyYAML)를 재사용한 것으로, 이전 라운드(11_40_34) dependency 리뷰가 이미 확인한 사항과 동일하다.
  - 제안: 없음.

- **[INFO]** 이전 라운드에서 지적된 "두 skip-job 레지스트리 간 미검증(WARNING)"이 본 diff에서 해소됨 — 내부 결속 개선 확인
  - 위치: `.claude/tests/test_required_check_skip_jobs.py` `test_the_two_registries_agree`(`CONVERTED` vs `test_workflow_yaml_structure.WorkflowStructureTest._SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS` 빈집합 비교)
  - 상세: 이전 라운드(`review/code/2026/08/09/11_40_34/dependency.md`)가 지적했던 "두 독립 레지스트리가 서로 바인딩되지 않음" WARNING이 이번 diff에서 `assertEqual` 기반 상호 검증 테스트로 닫혔다. 내부 모듈 간 의존 관계(§8 관점)가 테스트로 명시적으로 결속되어 한쪽만 갱신하는 회귀를 잡는다.
  - 제안: 없음 — 개선 확인.

## 요약

이번 diff의 의존성 관련 핵심은 새로 가동된 `pnpm audit` 게이트가 드러낸 main의 기존 취약점 2건(`nanoid` high, `dompurify` moderate)을 해소하는 버전 상향/override이며, 두 조치 모두 프로젝트의 버전 핀 정책(exact/caret 유지)과 override 2곳 동시 등록 규약을 지켰고 `pnpm-lock.yaml` 실측으로 취약 버전 잔존이 없음을 확인했다. 신규 외부 패키지·라이선스 문제는 없으며(PyYAML 재사용만), `nanoid` override가 전역(unscoped) 형태라 먼 미래에 major 상향 요구와 충돌할 여지가 있다는 점과 `libc:` 필드 57줄의 무관한 lockfile churn만 정보성으로 기록한다(둘 다 이미 문서·후속 plan에 추적됨). 나머지 CI 워크플로 변경(skip-job 패턴)은 신규 의존성을 도입하지 않으며, 이전 라운드에서 지적된 내부 레지스트리 결속 WARNING도 이번 diff에서 해소됐다.

## 위험도
LOW
