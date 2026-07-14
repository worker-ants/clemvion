# 의존성(Dependency) 리뷰 — deps-security-checks CI 신설

대상: `.github/workflows/deps-security-checks.yml` (신규), `PROJECT.md`, `pnpm-workspace.yaml`
(auditConfig 추가), `scripts/check-pnpm-security-config.py` (신규)

## 검증 방법

- `pnpm-workspace.yaml` 실제 파일과 `scripts/check-pnpm-security-config.py` 의
  `EXPECTED_OVERRIDES` / `EXPECTED_ONLY_BUILT` 를 직접 대조.
- PyYAML 을 로컬에 설치 후 `python3 scripts/check-pnpm-security-config.py` 실행 →
  `OK: overrides 19건 · onlyBuiltDependencies 5건 baseline 일치`, exit 0 확인.
- `node_modules` 가 전혀 없는 격리 디렉터리(매니페스트·`pnpm-lock.yaml`만 복사)를 만들어
  `pnpm audit --audit-level=moderate` 를 실제 실행 — `1 vulnerabilities found / Severity: 1
  moderate (1 ignored)`, exit 0 확인 (`pnpm install` 불필요를 실측 검증).
- `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 를 임시로 비워 재실행 → `--json` 출력에서
  `id: 1121859, cves: ['CVE-2026-53550'], module: js-yaml, severity: moderate` 확인 — ignoreCves
  에 등재된 식별자가 레지스트리가 실제로 보고하는 CVE 번호와 정확히 일치함을 검증. (검증에 쓴
  격리 디렉터리·수정본은 scratchpad 임시본이며 실제 저장소 파일은 무변경 — `git status`/`git
  diff --stat` clean 확인 완료.)

## 발견사항

- **[INFO]** (a) 스냅샷 baseline은 현재 `pnpm-workspace.yaml` 과 정확히 일치
  - 위치: `scripts/check-pnpm-security-config.py` `EXPECTED_OVERRIDES`(19개) / `EXPECTED_ONLY_BUILT`(5개) vs `pnpm-workspace.yaml` `overrides`/`onlyBuiltDependencies`
  - 상세: 실측 결과 두 집합이 이름 단위로 완전히 1:1 일치(19/5). 스크립트를 직접 실행해 `OK` exit 0 확인. 현재 시점 기준 드리프트 없음.

- **[WARNING]** (b) 가드가 override **키의 존재 여부만** 검증하고, 핀의 **버전 하한(range)** 은 검증하지 않음
  - 위치: `scripts/check-pnpm-security-config.py` — `actual_overrides = set((ws.get("overrides") or {}).keys())` (값은 버림)
  - 상세: 2-place 편집 거버넌스(`pnpm-workspace.yaml` + `EXPECTED_*` 동시 갱신) 자체는 CI가 실패로 강제하므로 "키 삭제" 회귀에는 유효한 방어다. 그러나 예컨대 누군가 `lodash: ^4.18.0` → `lodash: ^4.0.0` 처럼 **키는 유지한 채 하한만 낮춰** 취약 버전을 다시 허용해도, 이 가드는 키 집합만 비교하므로 통과한다. 즉 "보안 핀 무단 삭제 방지" 라는 스크립트의 목적 진술과 실제 검증 범위(존재 여부) 사이에 간극이 있다. `pnpm audit` 잡이 최종 안전망 역할(하한이 낮아져 실제 취약 버전이 해소되면 audit 이 재탐지)을 하므로 치명적이진 않으나, config-guard 단독으로는 "핀이 최소 안전 버전을 보장한다"는 착각을 줄 수 있다.
  - 제안: (선택) `EXPECTED_OVERRIDES` 를 `dict[str, str]` (이름→최소 버전)로 확장해 `packaging.version` 또는 semver 비교로 "현재 값이 baseline 이상"을 확인하거나, 최소한 스크립트 docstring/PROJECT.md 문구에 "키 존재만 검증, 버전 하한은 `pnpm audit` 이 담당" 이라는 범위 한정을 명시해 오해를 줄인다.

- **[INFO]** (b) 거버넌스 모델(2-place 편집) 자체는 합리적 trade-off
  - 위치: `scripts/check-pnpm-security-config.py` 상단 docstring, `PROJECT.md` §버전·도구 정책
  - 상세: "핀 변경 시 `pnpm-workspace.yaml` 과 `EXPECTED_*` 를 함께 갱신" 요구는 수동 동기화이지만, 어긋나면 CI가 즉시 `missing`/`extra` 로 fail 하므로 *silent* drift 가 아니라 *loud* 드리프트다 — PR 머지 전 반드시 고쳐야 하는 강제 게이트로 기능한다. 이는 "핀을 의도적으로 건드릴 때 리뷰어의 주의를 강제로 끈다"는 목적에 부합하는 설계이며, 자동 파생(예: override 변경을 스크립트가 자동 read)보다 오히려 "의식적 승인" 을 요구하는 편이 보안 핀 맥락에서는 더 안전한 선택일 수 있다. Drift 위험은 (위 WARNING 처럼) 검증 범위의 얕음(키 존재만)에서 오지, 2-place 편집 모델 자체에서 오지 않는다.

- **[INFO]** (c) `pnpm audit` 는 `pnpm install` 없이 lockfile + `pnpm-workspace.yaml` 만으로 동작 확인됨
  - 위치: `.github/workflows/deps-security-checks.yml` `audit` job (checkout → action-setup → setup-node → `pnpm audit` 직행, install 단계 없음)
  - 상세: `node_modules` 가 전혀 없는 격리 디렉터리에서 매니페스트+`pnpm-lock.yaml` 만으로 `pnpm audit --audit-level=moderate` 를 실제 실행해 정상 동작(레지스트리 질의 + `ignoreCves` 반영 + exit 0) 확인. pnpm 10.23 기준 `audit` 는 lockfile 기반으로 의존성 그래프를 구성해 레지스트리 advisory 엔드포인트에 질의하는 방식이라 `node_modules` 설치가 불필요하다는 워크플로 주석의 주장이 실측으로 맞다. install 단계 생략은 CI 시간 단축 측면에서도 타당.
  - 참고(비차단, INFO): `--ignore-registry-errors` 미사용 — 레지스트리 일시 장애 시 실제 취약점과 무관하게 job 이 fail 할 수 있음(운영 flakiness). 필수 아니나 재발 시 고려 대상.

- **[INFO]** (d) `moderate` 게이트 레벨 적정 + CVE 식별자 정확성 확인
  - 위치: `deps-security-checks.yml` `pnpm audit --audit-level=moderate` / `pnpm-workspace.yaml` `auditConfig.ignoreCves: [CVE-2026-53550]`
  - 상세: `moderate` 는 업계 흔한 기본값(`high`)보다 엄격한 선택 — 이미 다수 CVE 를 선제적으로 override 로 핀한 이 프로젝트의 보수적 보안 태도와 일관됨. `--ignore` (CLI) 와 `auditConfig.ignoreCves` (workspace 파일) 는 pnpm 문서·`--help` 상 "CVE 식별자" 로 동작하도록 설계돼 있고(`--ignore <vulnerability> Ignore a vulnerability by CVE`), 실측으로도 `CVE-2026-53550` 문자열이 레지스트리가 보고하는 `cves` 필드와 정확히 일치함을 확인(GHSA slug 를 넣었다면 매칭되지 않았을 가능성이 높음 — pnpm 은 CVE 문자열을 기대). 주석에 GHSA(`GHSA-h67p-54hq-rp68`)를 병기한 것은 cross-reference 목적의 좋은 관행이며 실제 억제 키는 CVE 로 올바르게 사용됨.

- **[INFO]** PyYAML 도입 — 저장소 최초의 non-stdlib Python 의존성, 버전 미고정
  - 위치: `.github/workflows/deps-security-checks.yml` `Install PyYAML` step (`pip install pyyaml`, 버전 미지정)
  - 상세: `scripts/` 하위 기존 스크립트(`check-doc-links.py`, `report_playwright_flaky.py`, `check-migration-versions.py`)는 모두 "의존성 없음 (Python 3 표준 라이브러리만 사용)" 을 명시적 설계 원칙으로 삼고 있는데, 본 스크립트가 그 패턴에서 처음으로 이탈한다. YAML 파일에 quoted 복합 키(`"@grpc/grpc-js"`, `"undici@>=7.0.0 <7.28.0"`, `next>postcss`)가 섞여 있어 정규식 기반 자가 파서보다 실제 YAML 라이브러리 사용이 더 안전한 선택이므로 의존성 도입 자체는 타당하다. `yaml.safe_load` 사용도 올바르다(임의 코드 실행 취약점 있는 `yaml.load` 미사용). 다만 `pip install pyyaml` 이 버전 미고정이라, 저장소가 pnpm 의존성에는 명시 채택한 "재현성"(`pnpm-lock.yaml` SoT, exact/tilde 핀 사유 주석 의무) 원칙과 대비된다. PyYAML 은 성숙하고 API 가 안정적인 라이브러리라 실질 위험은 낮으나, 재현성·일관성 관점에서 버전 범위 고정(예: `pip install "pyyaml>=6,<7"`)을 권장.
  - 라이선스: PyYAML = MIT — CI 전용 도구이며 제품에 번들되지 않으므로 라이선스 충돌 없음.

- **[INFO]** 신규 외부 런타임 패키지·번들 크기 영향 없음
  - 상세: 이번 변경은 CI 워크플로·검증 스크립트·설정 주석 추가일 뿐, `codebase/**` 의 런타임 의존성(`package.json` dependencies)에는 아무것도 추가되지 않는다. 프론트/백엔드 번들 크기·빌드 시간에 대한 영향 없음. `pnpm/action-setup@v6`, `actions/setup-python@v6`, `actions/setup-node@v6` 는 기존 다른 워크플로(`frontend-checks.yml` 등)와 동일 버전 패턴을 재사용해 호환성 문제 없음.

## 요약

`pnpm-workspace.yaml` 의 override baseline(overrides 19개·onlyBuiltDependencies 5개)은 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_*` 와 실측 결과 정확히 일치하며, `pnpm audit --audit-level=moderate` 는 `pnpm install` 없이 lockfile + `pnpm-workspace.yaml` 만으로 정상 동작함을 격리 환경에서 직접 검증했다. 억제된 `CVE-2026-53550` 도 레지스트리가 실제 보고하는 CVE 식별자와 일치하고 severity(`moderate`)·게이트 레벨과도 정합적이다. 유일한 구조적 아쉬움은 config-guard 가 override "키 존재"만 검증하고 "버전 하한"은 검증하지 않아 핀을 삭제 없이 약화시키는 회귀는 `pnpm audit` 재탐지에만 의존한다는 점이며, 부수적으로 `PyYAML` 이 이 저장소 스크립트군 중 처음으로 non-stdlib·버전 미고정 의존성을 CI에 들여온다는 점은 재현성 관점에서 경미하게 개선 여지가 있다. 두 사항 모두 즉각적 위험은 아니고, 전체 설계(2-place 편집 게이트, no-install audit, CVE 억제 문서화)는 건전하다.

## 위험도

LOW
