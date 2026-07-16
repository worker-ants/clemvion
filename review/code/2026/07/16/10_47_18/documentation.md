# 문서화 리뷰 — commit b9c162cd1

`ci(e2e): playwright base 태그 ↔ @workflow 클로저 정합 config-guard (§4 후속)`

대상: `scripts/check-e2e-playwright-config.py` (신규), `.claude/tests/test_check_e2e_playwright_config.py` (신규),
`.github/workflows/e2e.yml` / `.github/workflows/harness-checks.yml` (wiring), `codebase/frontend/Dockerfile.playwright-e2e` /
`docker-compose.e2e.yml` (참조 주석 추가).

## 검증 방법

- 정적 대조: 스크립트 docstring·인라인 주석의 각 주장을 실제 `codebase/frontend/package.json`,
  `pnpm-lock.yaml`, `Dockerfile.playwright-e2e`, `docker-compose.e2e.yml` 내용과 대조.
- 동적 검증: `python3 scripts/check-e2e-playwright-config.py` 실 repo 대상 실행 →
  `[e2e-config-guard] OK: @playwright/test 1.61.0 ↔ base tag aligned; @workflow closure (4) synced across Dockerfile COPY + compose masks.` (exit 0).
- `python3 -m unittest discover -s .claude/tests -p 'test_check_e2e_playwright_config.py'` → 11 tests 전부 pass
  (`RealRepoSmokeTest` 포함 — 실 repo 가 현재 정합임을 재확인).
- 스타일 대조: `scripts/check-migration-versions.py`, `scripts/check-pnpm-security-config.py` 의 docstring 구조·실패 메시지
  포맷·`main()`/`--root` 처리와 비교.

## 발견사항

- **[INFO]** 성공/실패 메시지 접미사 문구가 자매 스크립트와 미세하게 다름
  - 위치: `scripts/check-e2e-playwright-config.py:238-241` (`f"\n[e2e-config-guard] {len(failures)} violation(s). See ..."`)
  - 상세: `check-migration-versions.py:219-221` 은 `f"[migration-guard] {len(failures)} violation(s) found. See spec/conventions/migrations.md for the policy."` 형태(“found.” + 정책 문서 링크)를 쓴다. 신규 스크립트는 “violation(s).”(found 생략) + 정책 문서 대신 `Dockerfile.playwright-e2e` / `docker-compose.e2e.yml` 헤더를 가리킨다. 기능상 문제는 아니고(이 가드는 별도 spec/conventions 문서가 없어 실제로 더 적절한 타겟을 가리킴), 정확성에도 문제없음 — 순수 문구 톤 차이.
  - 제안: 필요 시 “violation(s) found.”로 통일해 grep/톤 일관성을 높일 수 있으나 우선순위는 낮음.

- **[INFO]** `check()` 및 일부 파서 헬퍼(`base_tag_major_minor`, `dockerfile_copy_dirs`, `compose_mask_dirs`)에 함수 docstring 없음
  - 위치: `scripts/check-e2e-playwright-config.py:96` (`base_tag_major_minor`), `:104` (`dockerfile_copy_dirs`), `:112` (`compose_mask_dirs`), `:150` (`check`)
  - 상세: 같은 파일 내 `frontend_playwright_version`/`pkgname_to_dir`/`frontend_workflow_closure_dirs` 는 one-line docstring 이 있는데 위 4개는 없음(이름 + 인라인 `# --- 검사 N ---` 주석으로 대체). 다만 `check-pnpm-security-config.py` 의 `_check_set`/`main` 도 docstring 이 없어(참고: 해당 파일 71·80행) 이는 기존 컨벤션 자체가 느슨한 것과 일치 — 순수 개선 여지로만 기록.
  - 제안: (선택) 위 4개 함수에도 한 줄 docstring 을 붙이면 파일 내부 일관성이 올라감. 차단 사유 아님.

- **[INFO]** `PROJECT.md` §보조 스크립트에 신규 가드 항목 미등재
  - 위치: `PROJECT.md:319-345` (`check-doc-links.py`, `report_playwright_flaky.py` 는 “보조 스크립트 (검증·운영)” 섹션에 사용법·의존성·CI 연동이 문서화됨)
  - 상세: 신규 `check-e2e-playwright-config.py`는 이 섹션에 등재되지 않았다. 다만 같은 계열의 CI-only fail-fast 가드인 `check-migration-versions.py`, `check-pnpm-security-config.py`도 이 섹션에 없고(전자는 자체 docstring + `spec/conventions/migrations.md` 참고, 후자는 `PROJECT.md` §버전·도구 정책의 정책 서술 문장 안에 인라인 언급), 이 서브시스템(`Dockerfile.playwright-e2e`/`docker-compose.e2e.yml`) 자체가 직전 커밋(`8697bf5db`)부터 인라인 주석만으로 self-documenting 되어 온 기존 패턴과 일치한다. Critical/Warning 급 문서 갭은 아님.
  - 제안: (선택) 다른 CI-guard 스크립트들과의 정리 필요성이 커지면 그때 일괄로 §보조 스크립트에 짧은 목록 형태(“CI 전용 fail-fast 가드” 서브섹션)로 정리해도 됨. 이번 diff 범위에서는 필수 아님.

## 정확성 검증 결과 (문제 없음 확인)

- 스크립트 docstring 의 두 핵심 주장 모두 실측으로 확인됨:
  1. playwright 버전↔base 태그 major.minor 정합 — 실 repo 값(`@playwright/test` resolve `1.61.0`, base 태그 `v1.61.0-jammy`)과 일치, 가드 실행 결과도 OK.
  2. `@workflow/*` 클로저(4개: `expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules`) ↔ Dockerfile COPY ↔ compose 마스킹 — 세 집합 모두 4개로 일치.
- Dockerfile COPY 누락 시 `--frozen-lockfile` 이 fail 한다는 주장(`scripts/check-e2e-playwright-config.py` 모듈 docstring)은 각 내부 패키지의 `"prepare": "[ -d dist ] || tsc"` 스크립트(예: `codebase/packages/expression-engine/package.json`)로 뒷받침됨 — source COPY 가 없으면 `tsc` 가 실패해 install 전체가 실패하는 경로가 타당함.
- `codebase/frontend/Dockerfile.playwright-e2e:16` / `codebase/frontend/Dockerfile.playwright-e2e:40` / `docker-compose.e2e.yml:236-237` 에 추가된 “이 정합은 `scripts/check-e2e-playwright-config.py`(e2e.yml config-guard)가 강제한다” 주석은 실제로 그 가드가 정확히 해당 두 invariant(버전↔태그, 클로저↔COPY/mask)를 검사하므로 정확 — 오래된/과장된 주장 없음.
- `.github/workflows/e2e.yml` 신규 `config-guard` job 주석의 “30분짜리 e2e” 표현은 `e2e`/`e2e-frontend` 두 job 의 실제 `timeout-minutes: 30` 과 일치.
- `.github/workflows/harness-checks.yml` 에 추가된 `scripts/check-e2e-playwright-config.py` 트리거 경로는 기존 주석(“scripts/ 중 harness unittest 가 커버하는 것은 명시 등재… cf. migration-check.yml 의 check-migration-versions.py”)이 요구하는 패턴을 정확히 따름 — harness unittest(`.claude/tests/test_check_e2e_playwright_config.py`)가 실제로 이 스크립트를 커버하므로 등재가 타당.
- 실패 메시지들은 모두 “무엇이 왜 어긋났는지”(대상 파일 경로 명시) + “무엇을 어떻게 고쳐야 하는지”(예: `→ align the base tag to vX.Y.x-<distro>...`, `missing from Dockerfile: [...]; extra in Dockerfile: [...]`)를 구체 집합/파일 경로와 함께 제시 — actionable.
- 신규 harness 테스트(`.claude/tests/test_check_e2e_playwright_config.py`) 모듈 docstring 은 fixture 기반 유닛 테스트 + 실 repo smoke test 구성을 정확히 서술하며, `RealRepoSmokeTest`/`ParserTest`/`CheckTest` 구성과 일치.
- CHANGELOG.md·README.md 갱신 불필요 판단: 이번 변경은 순수 CI 인프라 가드(제품 기능·spec 대상 아님)이며, 동일 계열의 최근 CI/build 전용 커밋들(`8697bf5db`, `82f257114`, `8a5c667bc`)도 CHANGELOG.md 를 건드리지 않는 기존 관례와 일치. 신규 env var·API 엔드포인트도 없음.

## 요약

신규 config-guard 스크립트·테스트·워크플로 wiring·Dockerfile/compose 참조 주석 모두 문서 정확도가 높다. 모듈 docstring 의 두 핵심 주장(버전↔태그 정합, 3자 클로저 정합)은 실측(스크립트 실행 성공 + 유닛테스트 11건 pass + 소스 대조)으로 뒷받침되며, Dockerfile/compose 에 새로 추가된 "이 가드가 강제한다" 주석은 실제 가드 동작과 정확히 일치해 stale/과장된 문구가 없다. 실패 메시지는 대상 파일·구체 diff 집합·수정 방향을 함께 제시해 actionable 하고, docstring/실패-메시지 스타일은 `check-migration-versions.py`/`check-pnpm-security-config.py` 컨벤션과 잘 정렬된다. 발견된 사항은 모두 INFO 수준(문구 톤 미세 차이, 일부 헬퍼 함수 docstring 누락, PROJECT.md 미등재)이며 기존 자매 스크립트들도 동일한 완화된 컨벤션을 따르고 있어 실질적 문서화 리스크는 없다.

## 위험도

NONE
