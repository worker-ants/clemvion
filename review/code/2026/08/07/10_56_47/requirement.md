# 요구사항(Requirement) 리뷰 — deps override 하한 침식 수정

## 대상
- `codebase/backend/package.json` (undici 직접 의존 `^6.21.3` → `^6.28.0`)
- `pnpm-lock.yaml` (파생 반영)
- `pnpm-workspace.yaml` (`overrides` 5건 상한 정정 + `socket.io-parser` 신규 override)
- `scripts/check-pnpm-security-config.py` (`EXPECTED_OVERRIDES` baseline 동기화)

커밋: `c8ad8de6b` "fix(deps): override 하한이 낡아 취약 버전이 다시 해소되고 있었다 — audit 13건 → 0건"
(현재 브랜치가 origin/main 대비 1커밋 ahead — 이 diff 전체가 그 한 커밋).

## 검증 절차 (직접 재현)

리뷰 대상 주장을 커밋 메시지만 믿지 않고 직접 재실행해 확인했다.

| 검증 | 결과 |
|---|---|
| `python3 scripts/check-override-floors.py` | `OK: override 대상 27개 패키지 중 취약 재유입 0건` (exit 0) |
| `python3 scripts/check-pnpm-security-config.py` | `OK: overrides 30건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 0건 baseline 일치` (exit 0) |
| `pnpm audit --audit-level=moderate` | `No known vulnerabilities found` |
| `pnpm install --frozen-lockfile` (workspace 전체) | `Lockfile is up to date, resolution step is skipped` — exit 0 |
| `python3 -m pytest .claude/tests/test_override_floors.py` | 39 passed, 5 subtests passed — 회귀 없음 |
| `grep -c "libc:" pnpm-lock.yaml` (현재 vs `origin/main`) | 61 = 61 — 커밋 메시지의 "libc 61줄 유지" 주장과 일치, 수작업 lockfile 패치가 platform 메타데이터를 훼손하지 않았음 확인 |

네 파일 간 override 키 목록(순서까지) 을 직접 대조 — `pnpm-workspace.yaml` §overrides ↔ `pnpm-lock.yaml` 상단 `overrides:` 블록 ↔ `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 3자가 30개 키 전부(값 포함) 정확히 일치한다. 2-place 편집 규약(`PROJECT.md`, 설정+baseline 동시 갱신)이 실제로 지켜졌다.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec fidelity 항목)
  - 위치: 해당 없음 (`spec/` 전역 grep 결과 0건)
  - 상세: 이 변경은 CI/의존성 보안 설정(`pnpm-workspace.yaml` overrides, 가드 스크립트)만 건드리며 제품 기능 spec 과 무관하다. 관련 plan(`plan/in-progress/deps-guard-hardening.md`)도 하단에 `spec_impact: none` 을 명시하고 있어 CLAUDE.md 라우팅 규약(codebase 변경 → developer, spec 무관 시 project-planner 개입 불요)과 일치한다. spec 누락이 아니라 애초에 spec 대상이 아닌 영역.

- **[INFO]** 관련 없는 lockfile 부수 변경 (`@aws-sdk/core@3.977.4` deprecated 메타데이터 추가)
  - 위치: `pnpm-lock.yaml` (unified diff 상 `@@ -903,6 +904,9 @@` 부근, 게이트 907~909)
  - 상세: 이번 커밋의 목적(override 하한 상향)과 무관하게, 동일 버전(`3.977.4`, 변경 없음)에 대해 `deprecated: |- Deprecated due to Document number parsing bug in JSON...` 블록만 추가됐다. registry 메타데이터가 사후에 deprecated 로 갱신된 것을 이번 부분 재생성이 흡수한 것으로 보이며, 커밋 메시지가 설명하는 "insert/replace 채택, libc: delete 청크만 되돌림" 절차와 일치하는 정상적인 부수효과다. 기능적 결함은 아니나, upstream 이 해당 버전을 deprecated 처리했다는 신호이므로 향후 `@aws-sdk/client-s3`/관련 AWS SDK 계열 업그레이드 시 참고할 만하다.
  - 제안: 조치 불필요 (참고용 INFO). 별도 후속이 필요하면 dependency-bump PR로 자연스럽게 처리될 사안.

- **[INFO]** `pnpm-workspace.yaml` 내 quoting 스타일 불일치
  - 위치: `pnpm-workspace.yaml:37` (`"socket.io-parser": ~4.2.7`)
  - 상세: 동일 overrides 맵의 다른 plain 패키지명(`fast-uri`, `hono`, `uuid`, `ws`, `vite`, `sharp`, `svgo` 등)은 따옴표 없이 쓰는데 `socket.io-parser` 만 따옴표로 감쌌다. YAML 파싱 결과(`yaml.safe_load`)에는 영향이 없음을 `check-pnpm-security-config.py` 실행 성공으로 확인했다(문자열 키 값 동일). 기능적 문제는 아니고 스타일 일관성 정도의 사소한 지적.
  - 제안: 조치 불필요, 원한다면 따옴표 제거로 스타일 통일 가능.

CRITICAL/WARNING 은 발견되지 않았다. 검증 항목(엣지 케이스·에러 시나리오·데이터 유효성·비즈니스 로직·반환값)에 대해:

- **엣지 케이스**: override 상한 경계(`<4.3.0`→`<4.3.1`, `<7.28.0`→`<7.29.0`)가 실제로 "그 버전 자신이 취약한데 상한이 배제 안 하는" 경계 결함이었고, 이번 수정이 정확히 그 경계를 닫았다(`check-override-floors.py` 재실행으로 실증).
- **에러 시나리오**: `check-pnpm-security-config.py` 는 override 값 불일치 시 명확한 에러 메시지와 exit 1 을 반환하도록 기존 로직이 이미 구현돼 있고, 이번 diff 는 baseline 딕셔너리 값만 갱신했다 — 로직 변경 없음, 회귀 위험 최소.
- **데이터 유효성**: 상향된 버전들(`fast-uri@3.1.5`, `hono@4.13.0`, `js-yaml@4.3.1`/`3.15.1`, `undici@6.28.0`/`7.29.0`, `socket.io-parser@4.2.7`)이 레지스트리에 실재하며 `pnpm install --frozen-lockfile` 로 실제 해소 가능함을 확인.
- **비즈니스 로직(신규 socket.io-parser override)**: `socket.io@4.8.3` 이 요구하는 `socket.io-parser: ~4.2.4`(즉 `>=4.2.4 <4.3.0`) 범위 안에 override 값 `~4.2.7`(`>=4.2.7 <4.3.0`) 이 포함되므로 부모 패키지의 semver 계약을 깨지 않는다 — 주석의 설명과 실제 값이 일치.
- **반환값**: `check-pnpm-security-config.py::main()` 은 불일치 시 1, 일치 시 0 을 반환하는 기존 경로 그대로이며 diff 로 이 흐름 자체는 바뀌지 않았다.

TODO/FIXME/HACK/XXX 주석 없음. 함수명·주석과 구현 간 괴리 없음(신규 주석은 override rationale 설명이며 실제 값과 일치).

## 요약

이번 diff 는 `check-override-floors.py` 가드가 실제로 탐지한 "override 하한이 낡아 취약 버전이 재유입되는" 침식 6건(fast-uri, hono, js-yaml×2, undici×2)을 정정하고, 신규로 노출된 `socket.io-parser`(GHSA-2m8v-j782-fhvr) 취약점을 override 로 닫은 순수 의존성 보안 패치다. `pnpm-workspace.yaml`(override 정의) → `pnpm-lock.yaml`(파생 lockfile) → `scripts/check-pnpm-security-config.py`(EXPECTED_OVERRIDES baseline) → `codebase/backend/package.json`(6.x 직접 의존 자체 상향) 4개 파일이 하나의 논리적 단위로 정확히 동기화됐음을 직접 재실행으로 확인했다(override-floors 가드 0건, security-config 가드 0건, `pnpm audit` 0건, `--frozen-lockfile` install 성공, 39개 관련 unit test 전부 통과). spec 문서는 이 영역을 다루지 않으며(정상 — CI/인프라 스코프, plan 에 `spec_impact: none` 명시), CRITICAL/WARNING 급 결함은 발견되지 않았다. 발견된 3건은 전부 INFO(무관한 lockfile 부수 변경, 사소한 quoting 스타일)로 조치 불필요 수준이다.

## 위험도

NONE
