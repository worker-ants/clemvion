# Security Review — pnpm 의존성 보안 거버넌스 (deps-security-checks.yml / check-pnpm-security-config.py / pnpm-workspace.yaml auditConfig)

## 발견사항

- **[WARNING]** config-guard 는 `overrides` 의 **키(패키지명)만** 스냅샷 비교하고 **값(버전 범위)은 검증하지 않음** — pin 약화(downgrade)가 탐지되지 않을 수 있음
  - 위치: `scripts/check-pnpm-security-config.py` — `EXPECTED_OVERRIDES` 가 `set`(이름만), `actual_overrides = set((ws.get("overrides") or {}).keys())`
  - 상세: 예를 들어 `lodash: ^4.18.0` → `lodash: ^3.0.0` 로 키는 그대로 두고 값(버전 범위)만 취약 버전대로 되돌려도, 가드는 `lodash` 키가 여전히 존재하므로 통과시킨다. `EXPECTED_OVERRIDES`/`EXPECTED_ONLY_BUILT` 가 "삭제·무단 추가" 만 잡는다고 docstring 에 명시돼 있는데, 이는 "값 약화"까지 포괄하지 않는다. 단, `undici@>=7.0.0 <7.28.0` 처럼 range 가 key 자체에 인코딩된 scoped override 는 값 변경 시 key 문자열도 바뀌므로 이 경우는 우연히 잡힌다 — 나머지 순수 패키지명 키(예: `lodash`, `hono`, `ws`, `@babel/core` 등 대다수)는 값 약화에 취약.
  - 완화 요인: 이 PR 의 두 번째 축인 `pnpm audit --audit-level=moderate` 잡은 lockfile 의 **실제 해소 버전** 을 검사하므로, override 값이 약화되어 lockfile 이 재생성되면 (동일 CVE 가 여전히 공개 advisory DB 에 moderate+ 로 등재돼 있는 한) audit job 이 재탐지할 개연성이 높다. 즉 완전한 무방비는 아니나, "공개 advisory 로 아직 안 잡히는" 케이스나 "공개 CVE 가 아닌 사유로 pin 한" 케이스에는 보호가 없다.
  - 제안: `EXPECTED_OVERRIDES` 를 `set`(이름만) 대신 `dict`(이름→기대 버전 범위 문자열)로 바꿔 값까지 정확히 비교하거나, 최소한 이 잔여 gap 을 스크립트 docstring/PROJECT.md 에 "값 변경은 audit job 이 backstop" 이라고 명시적으로 문서화.

- **[WARNING]** `auditConfig.ignoreCves` 자체는 스냅샷 가드 대상이 아님 — 이 기능 전체의 존재 이유(핀 무단 변경의 silent 통과 차단)와 동일한 계열의 gap 이 가장 강력한 억제 레버인 `ignoreCves` 에는 열려 있음
  - 위치: `pnpm-workspace.yaml` `auditConfig.ignoreCves` / `scripts/check-pnpm-security-config.py` (해당 필드를 전혀 읽지 않음)
  - 상세: `check-pnpm-security-config.py` 는 `overrides` 와 `onlyBuiltDependencies` 만 baseline 대조한다. `ignoreCves` 리스트에 CVE ID 를 추가하면 `pnpm audit --audit-level=moderate` 의 실패를 그대로 무력화할 수 있는데, 이 변경 자체를 잡는 자동 가드가 없다 — 순수 PR 리뷰(사람)만이 방어선이다. 이는 정확히 "overrides 를 조용히 지워도 `--frozen-lockfile` CI 는 통과한다" 는, 이 전체 거버넌스를 만들게 된 원래 문제와 같은 구조의 리스크를 `ignoreCves` 필드에 그대로 남겨둔 것.
  - 제안: 스크립트에 `EXPECTED_IGNORED_CVES = {"CVE-2026-53550"}` 같은 baseline 을 추가해 동일한 missing/extra 대조 로직을 적용 (핀 추가/제거처럼 "의도한 변경이면 스크립트도 함께 갱신" 2-place 편집 게이트로 통일). 최소한으로는 개수 상한이라도 assert.

- **[INFO]** CVE 수용 범위·근거는 적절하고 과도하게 넓지 않음 — 검증 결과 실제 코드베이스와 일치
  - 위치: `pnpm-workspace.yaml` `auditConfig.ignoreCves: [CVE-2026-53550]`
  - 상세: 와일드카드/패키지 전체 무시가 아니라 **CVE 1건만** 명시적으로 등재 (`ignoreGhsas: ["*"]` 류의 blanket 억제가 아님). `pnpm --filter frontend why js-yaml` 로 직접 확인한 결과, 프로덕션 경로는 정확히 `gray-matter@4.0.3 → js-yaml@3.14.2` 단 하나이며, devDependency 체인(`eslint` 계열)은 별도 메이저 라인인 `js-yaml@4.2.0` 을 사용해 이 pin 대상이 아니다. `codebase/frontend/src/lib/docs/registry.ts` 확인 결과 gray-matter 는 저장소에 커밋된 MDX 문서의 frontmatter 만 파싱하며(신뢰 입력), 코드베이스 전체에서 `js-yaml` 직접 사용처는 없다 — "신뢰 입력만 처리" 주장이 실측과 일치. 근거·영향경로·해소조건(`gray-matter` 상향/교체)·추적 plan 링크까지 모두 주석에 포함돼 문서화 수준도 충분.
  - 결론: 이 항목에 대해서는 추가 조치 불필요.

- **[INFO]** audit gate level (`moderate`) 은 적절한 기준
  - 위치: `.github/workflows/deps-security-checks.yml` `pnpm audit --audit-level=moderate`
  - 상세: low 심각도의 노이즈를 걸러내면서 moderate/high/critical 을 모두 차단 — 일반적인 업계 관행과 일치. 주간 schedule 병행으로 의존성 변경이 없어도 신규 공시 CVE 를 지속 탐지하는 점도 적절.

- **[INFO]** GH Actions 워크플로가 흔한 함정을 피함 — script injection·권한 과다·안전하지 않은 YAML 파싱 없음
  - 위치: `.github/workflows/deps-security-checks.yml`, `scripts/check-pnpm-security-config.py`
  - 상세: (1) `run:` 셸 블록에 `${{ github.event.* }}` 같은 신뢰 불가 expression 을 직접 보간하지 않음(전형적 GH Actions script-injection 패턴 회피). (2) `pull_request_target` 이 아닌 `pull_request` 사용 — fork PR 에서도 시크릿·상승된 토큰 노출 없음. (3) Python 가드는 `yaml.safe_load` 사용(임의 객체 역직렬화 방지, `yaml.load` 아님). (4) 하드코딩된 시크릿/API 키/토큰 없음. (5) `permissions:` 블록 미지정은 리포지토리 내 다른 워크플로들(대부분 미지정)과 일관되고, 두 job 모두 쓰기 동작(코멘트 게시 등)이 없어 실질적 과다권한 리스크는 낮음.

- **[INFO]** 이 CI 게이트가 실제로 병합을 막으려면 GitHub 브랜치 보호의 "필수 상태 검사" 등록이 전제
  - 위치: `.github/workflows/deps-security-checks.yml` (diff 범위 밖 — 리포지토리 설정)
  - 상세: 워크플로 자체는 실패 시 exit 1 이지만, `main` 브랜치 보호 규칙에 `config-guard`/`audit` job 이 required check 로 등록돼 있지 않으면 실패한 PR 도 병합 가능하다. 이 diff 범위에서는 확인 불가.
  - 제안: 브랜치 보호 설정에 두 job 이 required status check 로 등록됐는지 별도로 확인/문서화 권장.

- **[INFO]** `check-pnpm-security-config.py` 자체에 대한 회귀 테스트 부재
  - 위치: `scripts/check-pnpm-security-config.py` (비교: `scripts/report_playwright_flaky.py` 는 `.claude/tests/test_report_playwright_flaky.py` 동반)
  - 상세: 프롬프트에 기술된 "제거 시 exit 1 / 무단 추가 시 exit 1" 검증은 수동으로 수행된 것으로 보이며, 향후 리팩터링 시 회귀를 막을 자동 테스트가 저장소에 없음.
  - 제안: `.claude/tests/test_check_pnpm_security_config.py` 를 추가해 baseline 대조 로직(missing/extra 양방향)을 고정.

## 요약

이 변경은 이전 리뷰에서 지적된 두 가지 공급망 거버넌스 공백(무단 override 삭제가 `--frozen-lockfile` CI 를 그대로 통과하는 문제, 신규 moderate+ CVE 를 잡는 CI 부재)을 실질적으로 닫는 net-positive 변경이다. CVE 수용(`ignoreCves`)은 단일 CVE 로 좁게 스코프되어 있고 근거·경로·해소조건이 충분히 문서화돼 있으며, 실제 코드베이스 조사 결과 "신뢰 입력만 처리" 라는 주장과 일치했다. audit 레벨(moderate)도 합리적이다. 다만 신설된 `check-pnpm-security-config.py` 가드는 `overrides` 의 **키만** 대조하고 **값(버전 범위)** 은 검증하지 않아 pin 약화가 이론상 통과할 수 있고(다만 `pnpm audit` 이 상당 부분 backstop 역할), 무엇보다 `auditConfig.ignoreCves` 자체는 어떤 스냅샷 가드도 받지 않아 — 이 기능이 막고자 한 것과 정확히 같은 계열의 "조용한 무단 변경" 리스크가 가장 강력한 억제 지점에 그대로 열려 있다. 이들은 직접 익스플로잇 가능한 애플리케이션 취약점이 아니라 CI 거버넌스 프로세스의 잔여 공백이므로 심각도는 WARNING 수준으로 평가한다.

## 위험도

LOW
