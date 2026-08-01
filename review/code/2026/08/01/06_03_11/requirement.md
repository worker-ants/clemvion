# 요구사항(Requirement) 리뷰 — deps-guard (10차 라운드)

## 스코프 메모

router 가 넘긴 파일 2개: (1) `review/code/2026/08/01/05_36_28/testing.md` — 9차 라운드 testing
reviewer 의 산출물(문서, 실 코드 아님), (2) `scripts/check-override-floors.py` — 실 코드(신규
스크립트, 이번 diff 에서는 전체가 `+`로 잡힘). 요구사항 충족 관점의 실질 분석은 (2)에 집중했다.

**검증 방법**: 9차까지의 리뷰가 이미 정적 분석 + mutation(코드 되돌리기) + 스텁 기반 45개
unit test 로 매우 깊게 훑은 상태라, 이번 라운드는 그 방식으로는 원천적으로 못 잡는 축 —
**스크립트가 실제로 통합되는 대상인 라이브 `pnpm audit`(현재 registry, CI 와 동일 핀
`pnpm@10.23.0`)에 대해 스크립트 자신의 docstring 이 권장하는 재현 절차**("override 를 caret
없이 취약 버전으로 고정하고 `pnpm install --lockfile-only`")를 실제로 실행해 대조했다. 이
과정에서 CRITICAL 2건을 실측으로 발견했다 — 45개 unit test 전부가 손으로 작성한 JSON 픽스처를
쓰기 때문에, 그 픽스처 자체가 실제 pnpm 출력 형태와 다르면 어떤 mutation 도 이 클래스의 결함을
드러낼 수 없다.

**작업 환경 원복 확인**: 실험은 `pnpm-workspace.yaml`/`pnpm-lock.yaml` 을 3회 임시로 편집(각각
`liquidjs`, `next>postcss`, `protobufjs`, `brace-expansion` 오버라이드를 취약 버전으로 고정)하고
매번 `git checkout -- pnpm-workspace.yaml pnpm-lock.yaml` 로 되돌렸다. 최종 `git status
--porcelain`/`git diff --stat` 모두 비어 있고(`review/code/2026/08/01/06_03_11/` 미추적 리뷰
산출물 제외), 스크립트 재실행은 `OK: override 대상 26개 패키지 중 취약 재유입 0건`, 45개 unit
test 전부 GREEN 을 재확인했다.

## 발견사항

- **[CRITICAL]** `classify_vulnerable()`의 "actions 스키마 드리프트" 가드가 pnpm 이 실제로 내는
  **정상적인** `"action": "update"` 출력 형태(최상위 `module`/`target` 이 `null`)를 스키마
  드리프트로 오판해, 스크립트의 핵심 목적(§1, P1 — override 침식을 정확히 분류)이 5개 실제
  동기 사례 중 하나(`liquidjs`)의 재현에서 실제로 깨진다.
  - 위치: `scripts/check-override-floors.py:267`
    (`actions_with_module = [a for a in actions if a.get("module")]`), `:288-293`
    (`if actions and not actions_with_module: _undecidable(...)`)
  - 상세: 스크립트 자신의 모듈 docstring 이 권장하는 회귀 재현법 그대로 —
    `pnpm-workspace.yaml` 의 `liquidjs: ^10.27.1` 을 `liquidjs: 10.27.0`(caret 제거, 실제 CVE
    발단 버전)으로 고정하고 `pnpm install --lockfile-only` 후 **실제 registry**에
    `pnpm audit --json` 을 호출했다. 결과 `advisories` 는 기대대로
    `{"1124277": {"module_name": "liquidjs", "github_advisory_id": "GHSA-g357-x5c3-c72p",
    "patched_versions": ">=10.27.1", ...}}` 로 정상 파싱되지만, 같은 응답의 `actions[]` 는
    ```json
    [{"action": "update", "resolves": [{"id": 1124277,
      "path": "codebase__backend>@nestjs-modules/mailer>liquidjs", ...}],
      "module": null, "target": null, "depth": 3}]
    ```
    로 `module`/`target` 이 `null` 이다(반면 같은 실측으로 재현한 `next>postcss`,
    `protobufjs` 케이스는 `"action": "review"` 이고 `module` 이 정상 채워진다 — 즉 pnpm 은
    같은 `pnpm audit --json` 안에서도 항목별로 **두 형태**를 섞어 낸다). 45개 unit test 의
    모든 `run_with_stub_audit(...actions=[...])` 픽스처는 예외 없이 `{"action": "review",
    "module": "<str>", ...}` 형태만 손으로 작성해 뒀고(`SchemaDriftTest` 포함), 실제 pnpm 이
    같은 CVE·같은 단순 override 대상에 대해 `"update"`+`module: null` 을 낼 수 있다는 사실은
    스텁으로는 원천적으로 재현되지 않는다. 그 결과 `main()` 실행 시
    `ERROR: \`actions\` 항목이 있는데 \`module\` 을 가진 것이 하나도 없다 — pnpm audit
    스키마가 바뀐 것으로 보고 판단 불가로 처리한다(fail-closed).` (exit 2)가 출력되는데, 이
    메시지 바로 아래 "본 키" 목록에는 `'module'` 이 버젓이 나열돼 있어(`['action', 'depth',
    'module', 'resolves', 'target']`) 메시지 자체가 자기모순적이고 원인 파악을 오도한다.
    실질 피해: CI 는 여전히 비-0(exit 2)으로 막긴 하므로 "조용한 통과"는 아니지만, 이
    스크립트의 존재 이유로 명시된 "본 가드의 가치는 검출이 아니라 **분류**다"(모듈
    docstring)가 정확히 이 경로에서 무력화된다 — `advisories` 만으로 이미 완전히 계산 가능한
    `reported={"liquidjs": "GHSA-g357-x5c3-c72p"}` 를 갖고 있음에도, `actions[]` 쪽의 형태
    불일치 하나로 그 정보를 버리고 "스키마가 바뀐 것 같다"는 오도성 메시지로 대체한다 — 여러
    advisory 가 섞인 실제 상황(`#1038` 원본 사고, 17건 중 4건)에서는 이 형태의 항목이 섞이는
    순간 "이미 관리 중이니 값만 올리면 된다"는 판단이 다시 **묻히는** 결과가 된다(막으려던
    바로 그 문제의 변주).
  - 제안: `actions_with_module` 판정과 이후 `module = action["module"]`(라인 269)을
    `action.get("module")` 우선, 없으면 `resolves[].id` 로 이미 파싱된 `advisories` 딕셔너리를
    역참조(`advisories.get(str(r["id"]), {}).get("module_name")`)하는 헬퍼로 교체할 것 — 실측
    결과 `resolves[].id`(예: `1124277`)가 `advisories` 딕셔너리 키(문자열 `"1124277"`)와 정확히
    일치해 이 역참조가 항상 성립함을 확인했다. 그 위에서도 하나도 module 을 못 찾는 경우에만
    진짜 스키마 드리프트로 fail-closed 유지. `SchemaDriftTest` 에 이번에 재현한 실측 payload
    형태(`"action": "update", "module": null, "target": null`)를 고정 픽스처로 추가해 회귀를 막을 것.

- **[CRITICAL]** `widened`/`EXPECTED_SUPPRESSED_PATHS`("수용 범위 밖 재유입" 탐지) 메커니즘이
  실제 pnpm 의 `ignoreCves` 동작과 어긋나 있어 **항상 발동 불가능한 코드**다 — 이 메커니즘이
  막으려는 바로 그 사고("가드가 자기 실패 모드를 그대로 재현")를 메커니즘 자신이 재현한다.
  - 위치: `scripts/check-override-floors.py:250-254`(`classify_vulnerable()` docstring 의
    "pnpm 은 억제된 항목도 `actions[]`... 에는 남기므로 존재는 알 수 있다" 전제), `:63-69`
    (`EXPECTED_SUPPRESSED_PATHS`), `:313-321`(`main()`의 `widened` 계산 루프)
  - 상세: 실제 저장소의 `pnpm-workspace.yaml` 은 override 로 관리되면서 동시에
    `auditConfig.ignoreCves` 로 수용된 CVE 를 **이미 2건** 갖고 있다 — `brace-expansion`
    (CVE-2026-14257, 현재도 `brace-expansion@1.1.18` 이 `@eslint/eslintrc` 경로에 실제로
    설치돼 있음을 `pnpm why -r brace-expansion` 로 확인)와 `js-yaml`(CVE-2026-53550, 다만 이
    경로는 현재 `gray-matter → js-yaml@3.15.0`(패치됨)로 이미 해소돼 있어 지금은 무관).
    **실측 1** (현재 상태 그대로): `pnpm audit --json` → `actions: [], advisories: {},
    metadata.vulnerabilities` 전부 0. 즉 실제로 취약한 `brace-expansion@1.1.18` 이 설치돼
    있음에도 `actions[]` 에 아무 흔적이 없다. **실측 2** (스크립트 docstring 의 재현법 그대로:
    `"brace-expansion@>=2.0.0 <3.0.0"` override 를 `^5.0.9` → `2.1.4`(caret 제거, 과거 실제
    취약 버전)로 되돌리고 `pnpm install --lockfile-only`로 재설치 확인 후): 결과는 동일하게
    `actions: [], advisories: {}`, 취약성 카운트 전부 0 — 즉 baseline 경로(`1.1.18`)든 baseline
    밖 새 경로(`2.1.4`)든 **구분 없이** `ignoreCves` 가 걸린 CVE 는 `actions[]` 에서 완전히
    사라진다. 이는 `classify_vulnerable()` docstring 이 명시한 전제("pnpm 은 억제된 항목도
    actions[] 에는 남긴다")와 정면으로 배치된다. 이 전제가 거짓이면 `suppressed` 딕셔너리는
    실제 운영에서 **항상 빈 값**이고, 따라서 `widened` 리스트도 항상 비며,
    `EXPECTED_SUPPRESSED_PATHS`·`_report_widened()`·"경로가 늘면 fail" 로직 전체가 죽은
    코드다 — 정확히 `#1038` 사고("취약 버전이 실제로 설치됐는데 가드가 OK 를 냈다")와 같은
    조용한 통과가, 이번엔 그 사고를 막으려고 새로 만든 안전장치 안에서 재발한다. (실험은
    `git checkout --` 로 완전히 원복했고 스크립트/45개 테스트 GREEN 재확인함 — 위 "검증 방법"
    참조.)
  - 제안: 현재 설계(`pnpm audit --json` 사후 필터링으로 baseline 대조)는 이 pnpm 버전의 실제
    동작 위에서 성립하지 않는다 — 재설계가 필요하다. 후보: (a) override-관리 대상의
    `ignoreCves` 항목만 선택적으로 제외한 별도 `pnpm audit --json` 호출을 추가로 수행해 그
    원본(억제 전) advisory/paths 를 직접 대조, 또는 (b) `pnpm audit --ignore-unfixable`/CLI
    `--ignore <cve>` 조합으로 auditConfig 의 영구 억제 대신 per-invocation 억제를 써서 이
    스크립트만 원본을 보게 함. 어느 쪽이든 **손으로 작성한 JSON 픽스처가 아니라 실제
    `pnpm audit --json` 캡처본을 fixture 로 고정**하는 통합 테스트를 추가하지 않는 한 이 클래스의
    드리프트(가정 대 실제 동작 불일치)는 향후에도 mutation 으로 못 잡는다.

- **[WARNING]** `run_audit()`/`classify_vulnerable()`가 `actions`/`advisories` 최상위
  컨테이너의 **존재 여부만** 검증하고 **타입**은 검증하지 않는다 — 리스트/딕셔너리가 아닌 값이
  오면 `AttributeError` 로 크래시해 exit 1(이 스크립트 어휘로 "침식 발견")로 죽는다. 이 클래스는
  5~9차가 반복적으로 잡아 온 "판단 불가와 조용한 실패를 못 가르는" 실패 형태와 같은 급이다.
  - 위치: `scripts/check-override-floors.py:224`(`if not isinstance(data, dict) or "actions"
    not in data:` — 존재만 검사, 타입 미검사), `:260`(`for name, adv in advisories.items():`),
    `:267`(`actions_with_module = [a for a in actions if a.get("module")]`)
  - 상세: 직접 뮤턴트 주입으로 재현(스텁 `pnpm` 이 조작된 JSON 을 내도록): (1) `actions` 값을
    리스트 대신 dict(`{"weird": "not-a-list"}`)로 주면 `classify_vulnerable()`의
    `[a for a in actions if a.get("module")]` 에서 dict 를 순회해 키(문자열)가 나오고
    `"weird".get("module")` 에서 `AttributeError: 'str' object has no attribute 'get'` 로 즉시
    크래시(raw traceback, exit 1). (2) `advisories` 값을 dict 대신 리스트
    (`[{"module_name": "liquidjs"}]`)로 주면 `for name, adv in advisories.items():` 에서
    `AttributeError: 'list' object has no attribute 'items'` 로 동일하게 크래시(exit 1). 두
    경우 다 `run_audit()`의 "`actions` 없음" 검사는 통과한다(키는 존재하니까) — 검사가 얕다.
    이 시나리오는 pnpm 이 필드명이 아니라 필드 **타입**을 바꾸는 것을 요구해 위 CRITICAL
    2건보다는 훨씬 드물지만(발생 조건이 더 큼), 발생 시 결과는 이 스크립트가 명시적으로
    피하려는 정확한 실패 형태(exit 1 = "erosion found"와 같은 코드로 크래시)다. 45개 테스트의
    `run_with_stub_audit()` 헬퍼는 `advisories: dict`/`actions: list | None` 로 타입을 강제해
    이 형태를 애초에 표현할 수 없다(`raw_stdout=` 우회 경로로만 가능하나 아무 테스트도 안 씀).
  - 제안: `run_audit()`에서 `"actions" not in data` 대신
    `not isinstance(data.get("actions"), list)` 로, `classify_vulnerable()` 진입부에서
    `advisories`/`actions` 를 각각 `isinstance(..., dict)`/`isinstance(..., list)` 로 확인 후
    아니면 `_undecidable()` 로 통일할 것. `FailClosedTest` 에 `raw_stdout=` 을 이용해
    `{"actions": {}, ...}`/`{"advisories": [], "actions": []}` 두 케이스를 추가.

- **[INFO]** `review/code/2026/08/01/05_36_28/testing.md` 자체는 리뷰 산출물(문서)이라 이
  파일에 대한 별도 "기능 요구사항"은 없다. 내용은 9차 라운드 당시 이용 가능했던 검증 수단
  (정적 분석 + mutation + 스텁 기반 45개 unit test) 범위에서는 타당해 보인다. 다만 그 라운드가
  "Critical 없음"으로 결론 낸 것은 검증 방법의 한계(스텁 픽스처가 실제 pnpm 출력 형태를
  선반영)에서 비롯된 사각지대이지, 9차 리뷰의 판단이 틀렸다는 뜻은 아니다 — 위 CRITICAL 2건은
  실 registry 재현이라는, 이전 라운드들이 쓰지 않았던 검증 축에서만 드러난다.
  - 위치: `review/code/2026/08/01/05_36_28/testing.md` (전체)
  - 상세: 조치 불요. 참고용 기록.
  - 제안: 없음.

- **[INFO]** spec fidelity — `spec/` 전체를 검색했으나 `check-override-floors.py`/
  `override-floors`/`pnpm audit`/의존성 가드 관련 스펙 문서가 없다. `plan/in-progress/
  deps-guard-hardening.md` frontmatter 가 `spec_impact: none` 을 명시하고 근거("CI·스크립트·
  설정 변경으로 제품 명세와 무관")도 타당하다 — 이 변경은 CI/개발 인프라 스코프이지 제품
  요구사항이 아니므로 spec 미존재는 결함이 아니다.
  - 위치: 해당 없음 (spec 부재 확인)
  - 상세: 조치 불요.
  - 제안: 없음.

## 그 외 확인한 것 (결함 아님, 기록용)

- `chain_segments()`/`override_target()`/정규식 3종(`_NAME_CHAR`/`_INNER_SPACE`/
  `_RANGE_SUFFIX`) 을 직접 트레이스 — docstring/주석이 서술하는 "체인 구분자 vs 레인지의 `>`"
  판별 규칙과 실제 정규식·루프 로직이 일치함을 확인(`a>@scope/b>c`, `undici@>=7.0.0 <7.28.0`,
  `@grpc/grpc-js`, `next>@types/react` 등 문서화된 케이스 전부 수기 트레이스로 검증).
- TODO/FIXME/HACK/XXX 주석: 스크립트·테스트 파일 전체에 0건(`grep` 확인).
- CI 배선(`deps-security-checks.yml`의 `override-floors` 잡, `harness-checks.yml` 의 PyYAML
  스텝)은 2차 라운드가 잡았던 "동일 YAML 키에 `run:` 중복" 류 결함 없이 정상 구조.
- `main()`의 모든 코드 경로가 값을 반환하거나(`0`/`1`) `_undecidable()`(`NoReturn`)로 종료 —
  반환값 누락 경로 없음.

## 요약

`scripts/check-override-floors.py`는 이미 8차의 mutation 기반 리뷰를 거쳐 매우 견고해 보였으나,
이번 라운드에서 스크립트 자신이 문서화한 재현법("override 를 caret 없이 취약 버전으로 고정 +
`pnpm install --lockfile-only`")을 CI 와 동일 pnpm 버전(10.23.0)으로 **실제 registry** 에 대해
실행해 대조한 결과, 45개 unit test 전부가 손으로 쓴 JSON 픽스처에 의존한다는 사각지대에서 CRITICAL
2건을 발견했다. (1) 실제 `pnpm audit --json` 은 같은 응답 안에서도 `"action": "review"`(모듈명
채워짐)와 `"action": "update"`(모듈명 `null`)를 섞어 내는데, 테스트 픽스처는 전자만 가정해 후자가
나오면(실측: `liquidjs` 재현 시 발생) "스키마 드리프트"로 오판, 스크립트의 핵심 가치인 "분류"가
무력화된다(CI 는 여전히 막지만 진단이 오도성). (2) `EXPECTED_SUPPRESSED_PATHS` 기반 "수용 범위 밖
재유입" 탐지는 `ignoreCves` 로 억제된 CVE 가 `actions[]` 에 흔적을 남긴다는 전제 위에 설계됐는데,
실제로는(현재 상태·되돌린 상태 양쪽 실측) 그 CVE 가 `actions`/`advisories`/`metadata` 전부에서
완전히 사라져 이 메커니즘 전체가 발동 불가능한 죽은 코드다 — 이 메커니즘이 막으려던 바로 그
사고 유형("가드가 자기 실패 모드를 재현")을 메커니즘 자신이 재현하는 형태다. 이 두 결함은 이전
9차례 라운드가 쓴 검증 방식(정적 분석·코드 되돌리기 mutation)으로는 원천적으로 드러나지
않는다 — 픽스처 자체가 실제 pnpm 출력과 다른 가정을 인코딩하고 있었기 때문이다. 추가로
컨테이너 최상위 타입 미검증에 의한 크래시 가능성(WARNING, mutation 재현)도 발견했다. 모든 실험은
`git checkout --`로 완전히 원복했고(`git status`/`git diff --stat` 클린, 스크립트 재실행
`OK`, 45개 테스트 GREEN 재확인) 저장소에 남은 변경은 없다.

## 위험도

CRITICAL — §1(P1, 이 PR 의 헤드라인 기능)의 두 핵심 경로 모두에서 실제 registry 재현 결함을
확인했다. 하나는 실제 5대 동기 사례 중 하나(liquidjs)의 분류를 오도성 메시지로 대체하고, 다른
하나는 "수용 CVE 의 재유입 확대" 탐지 자체가 실제로는 전혀 발동하지 않는 죽은 코드다 — 후자는
정확히 이 스크립트가 막으려는 "조용한 통과" 클래스에 해당한다. push/PR 전에 두 CRITICAL 을 재설계
수준에서 조치할 것을 권한다.
