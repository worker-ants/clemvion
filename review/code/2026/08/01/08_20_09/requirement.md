# 요구사항(Requirement) 리뷰 — deps-guard (11차 라운드)

## 스코프 메모

router 가 넘긴 파일 14개 중 12개는 리뷰 아티팩트(9~10차 `/ai-review` 세션의 산출물 —
`05_36_28/testing.md`, `06_03_11/{SUMMARY,requirement,scope,security,side_effect,testing,
documentation,maintainability,user_guide_sync}.md`, `_retry_state.json`, `meta.json`)이고,
실 코드는 `scripts/check-override-floors.py`(303줄)·`scripts/check-pnpm-security-config.py`
(149줄) 2개뿐이다. diff 는 브랜치 시작(origin/main) 기준 누적분이라 두 스크립트 모두
"new file" 로 잡혀 있지만, `git log`로 확인한 현재 HEAD(`f71be98d8`)는 10차 리뷰(`06_03_11`)가
낸 **CRITICAL 2건을 조치한 직후 상태**다. 이번 라운드의 실질 작업은 그 조치의 정확성·완전성
검증에 집중했다 — 코드 직접 Read, `git show f71be98d8` diff 대조, in-process 함수 호출(뮤턴트가
아니라 실제 함수를 malformed 입력으로 직접 호출)로 검증했다. `.claude/tests/
test_override_floors.py`는 이번 라운드도 router 파일 목록 밖(9개 라운드 전부 동일 판단이었던
`.claude/**` 제외 정책)이라 정보 컨텍스트로만 참조했다.

## 발견사항

- **[WARNING]** 10차 리뷰의 요구사항 WARNING #1("`actions`/`advisories` 최상위 컨테이너 타입
  미검증 → 크래시")이 이번 라운드(축 3 철회 커밋 `f71be98d8`)에서 **`advisories` 쪽은 그대로
  남았다** — `classify_vulnerable()`이 `audit.get("advisories")`를 `isinstance` 검사 없이 바로
  `.items()`로 순회한다.
  - 위치: `scripts/check-override-floors.py:230`(`advisories = audit.get("advisories") or {}`),
    `:233`(`for name, adv in advisories.items():`), `:234`(`module = adv.get("module_name")`)
  - 상세: 10차 리뷰(`review/code/2026/08/01/06_03_11/requirement.md`)가 이미 이 결함을
    뮤턴트로 실증하고 정확한 수정안(`isinstance(data.get("actions"), list)` /
    `classify_vulnerable()` 진입부에 `isinstance(advisories, dict)` 가드)까지 제시했는데, 이번
    커밋은 그 라운드의 CRITICAL 2건(스키마 드리프트 오판·widened 죽은 코드)만 조치하고 이
    WARNING 은 손대지 않았다. `git show f71be98d8 -- scripts/check-override-floors.py`로
    대조한 결과 `classify_vulnerable()`/`run_audit()`에 `isinstance` 가드가 추가된 흔적이
    없다. 직접 재현(in-process, 저장소 파일 변경 없이 실제 함수를 malformed 입력으로 호출):
    ```python
    mod.classify_vulnerable({"actions": [], "advisories": [{"module_name": "liquidjs"}], "metadata": {}})
    # -> AttributeError: 'list' object has no attribute 'items'
    ```
    를 실행해 `AttributeError`로 크래시함을 직접 확인했다 — 이 스크립트 자신의 어휘("exit 1 =
    침식 발견")로 보면 "pnpm 이 스키마를 바꿔 응답 형태가 달라짐"이 "취약점 발견"과 같은 exit
    code 로 나온다. 이는 이 리뷰 체인이 지난 9라운드 동안 반복적으로 잡아 온 것과 정확히 같은
    실패 클래스(FileNotFoundError·YAMLError·UnicodeDecodeError·TimeoutExpired 미포섭)인데,
    유독 `advisories` 컨테이너 타입만 아직 열려 있다. 다만 축 3 철회로 `actions[]` 쪽 위험은
    부수적으로 사라졌다 — `classify_vulnerable()`이 더 이상 `actions`를 전혀 읽지 않으므로
    (직접 확인: `actions`에 `list`가 아닌 `dict`를 넣어도 정상 동작), `run_audit()`의
    `"actions" not in data`(:210, 존재 여부만 검사)는 이제 위험하지 않다. 남은 노출면은
    `advisories`뿐이다. `main()`의 `patched_by_module` 컴프리헨션(:260-264)도 같은
    `audit.get("advisories")`를 쓰지만, 실행 순서상 `classify_vulnerable(audit)`(:259)이 먼저
    호출되므로 `advisories`가 실제로 비정상이면 그쪽에서 먼저 죽는다 — 별도의 새 크래시
    지점이 아니라 같은 취약점의 동일 원인이다.
  - 제안: 10차 리뷰가 제안한 수정을 그대로 적용 — `classify_vulnerable()` 진입부에
    `if not isinstance(advisories, dict): _undecidable(...)` 가드를 추가(선택적으로 `adv` 각
    원소도 `isinstance(adv, dict)` 확인). `run_audit()`의 `"actions" not in data`는 축 3 철회로
    더 이상 크래시 경로가 아니므로 시급하지 않지만, 응답 형태 조기 검증 목적이면
    `isinstance(data.get("actions"), list)`로 함께 강화해도 좋다. `FailClosedTest`류에
    `raw_stdout=`로 `{"advisories": [...], "actions": []}` (advisories 가 리스트인 경우) 케이스
    1건 추가(10차 리뷰가 이미 구체적 픽스처 형태까지 제시).

- **[INFO]**(긍정 관측, 검증 완료) 10차 CRITICAL #1(스키마 드리프트 오판 — `actions[].module`이
  정상 `"action":"update"` 응답에서 `null`인 것을 스키마 붕괴로 오판해 `liquidjs` 분류가
  무력화되던 결함)이 **완전히 해소**됐다 — 패치가 아니라 원인 자체(`actions[].module` 의존)를
  제거했다.
  - 위치: `scripts/check-override-floors.py:220-249`(`classify_vulnerable()`)
  - 상세: `git show f71be98d8`로 대조한 결과, 수정은 10차 리뷰가 제안한 "`action.get('module')`
    우선 + `resolves[].id` 역참조 폴백"이 아니라 **더 단순한 방식** — `actions[]`를 아예 읽지
    않고 `advisories`만으로 분류한다. 10차 리뷰 자신의 실측이 이미 "`advisories`는 기대대로
    정상 파싱된다"고 밝혔으므로(`actions[].module`이 `null`이어도 `advisories[id].module_name`은
    항상 채워짐), 이 방식이 원 제안보다 오히려 더 견고하다 — `actions[]`의 형태가 무엇이든
    (`"action":"update"`/`"review"` 혼재) 분류 결과에 영향을 주지 않는다. docstring도
    "`actions[]`는 읽지 않는다"로 실제 구현과 정확히 일치한다.
  - 제안: 조치 불요.

- **[INFO]**(긍정 관측, 검증 완료) 10차 CRITICAL #2(`widened`/`EXPECTED_SUPPRESSED_PATHS` —
  실제 pnpm `ignoreCves` 동작과 어긋나 항상 발동 불가능하던 죽은 코드)가 **완전히 제거**됐다 —
  리뷰의 제안(재설계)을 그대로 받지 않고, 개발자가 자체적으로 2×2 실측(정상/침식 lockfile ×
  ignoreCves 있음/없음, `brace-expansion@2.1.4`를 실제로 고정)을 재현해 "억제가 숨기는 게
  아니라 그 CVE 자체가 더 이상 보고되지 않는다"는 더 강한 결론에 도달한 뒤 축 자체를
  철회했다(`plan/in-progress/deps-guard-hardening.md` "축 3 철회" 절에 근거 기록).
  - 위치: `scripts/check-override-floors.py` 전체 — `widened`/`EXPECTED_SUPPRESSED_PATHS`/
    `_report_widened`/`suppressed` 관련 코드 0건(`grep` 확인)
  - 상세: 리뷰 결론을 무비판적으로 수용하지 않고, 리뷰어의 인과와 자신의 1라운드 관측 둘 다
    지금은 재현되지 않는다는 점까지 명시한 뒤 제거를 결정한 점이 근거 문서화 측면에서
    모범적이다. `ignoreCves` 거버넌스는 `check-pnpm-security-config.py`의
    `EXPECTED_IGNORED_CVES` 2-place 편집(현재 두 파일 모두 빈 집합으로 일치, 직접 대조 확인)이
    대체 수단으로 남아있어 요구사항 공백은 아니다.
  - 제안: 조치 불요.

- **[INFO]**(긍정 관측) 2-place 편집 규약이 현재 상태에서 정확히 지켜지고 있다.
  - 위치: `pnpm-workspace.yaml:25-54`(`overrides`, 29건)·`:86-100`
    (`auditConfig.ignoreCves: []`) ↔ `scripts/check-pnpm-security-config.py:37-67`
    (`EXPECTED_OVERRIDES`, 29건)·`:78`(`EXPECTED_IGNORED_CVES: set[str] = set()`)
  - 상세: 두 위치의 override 29건(키+값)과 ignoreCves(둘 다 빈 집합)가 정확히 일치함을
    직접 대조했다. `f71be98d8`이 stale `ignoreCves` 2건(js-yaml, brace-expansion)을
    pnpm-workspace.yaml/EXPECTED_IGNORED_CVES 양쪽에서 함께 제거해 규약을 어기지 않았다.
  - 제안: 조치 불요.

- **[INFO]**(긍정 관측) plan 문서의 정량 서술("fail-closed 지점 11곳 → 10곳")을 소스에서 직접
  재검증했다.
  - 위치: `scripts/check-override-floors.py` 전체, `plan/in-progress/deps-guard-hardening.md:218`
  - 상세: `grep -n "_undecidable(" scripts/check-override-floors.py`로 정의부(1건) 제외 실제
    호출 지점을 센 결과 정확히 **10곳** — plan 서술과 일치한다(축 3 철회로
    `classify_vulnerable()`의 `actions` 드리프트 검사 1곳이 사라져 11→10). 이 리뷰 체인이
    4차부터 반복적으로 지적해 온 "plan 수치 stale" 패턴이 이번엔 재발하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** spec fidelity — `spec/` 전체에 이 가드 관련 문서가 없음을 재확인했다
  (`grep -rl` 0건). `plan/in-progress/deps-guard-hardening.md` frontmatter 의
  `spec_impact: none`(근거: "CI·스크립트·설정 변경으로 제품 명세와 무관")이 타당하다 —
  CI/개발 인프라 스코프이지 제품 요구사항이 아니므로 spec 미존재는 결함이 아니다. 10차
  requirement.md 도 동일 결론이었다(재확인).
  - 위치: 해당 없음
  - 상세: 조치 불요.
  - 제안: 없음.

- **[INFO]**(완전성, 낮은 우선순위, 이번 라운드 신규 변경분 아님) `classify_vulnerable()`의
  `reported[module] = ...`는 dict 컴프리헨션이 아닌 for-루프 덮어쓰기라, 같은 모듈에 대해
  advisory 가 **2건 이상 동시에** 존재하면 마지막으로 순회된 것만 보고에 남는다.
  - 위치: `scripts/check-override-floors.py:232-237`
  - 상세: 실무적으로 override 대상 패키지 하나가 같은 시점에 서로 다른 CVE 2건에 걸릴 확률은
    낮고, 이 동작은 이번 라운드 변경분이 아니라 1차부터 존재했던 로직이다(10라운드 동안
    security/requirement 전담 리뷰어들이 반복 검토했으나 지적된 적 없음). 발생해도 exit
    code(비-0)는 정확하므로 "조용한 통과"는 아니고, 보고서에 표시되는 patched-version 하한
    하나가 실제로 필요한 여러 하한 중 하나만 반영될 수 있다는 표시 완전성 문제에 그친다.
  - 제안: 급하지 않음. 필요 시 `reported`를 `dict[str, list[str]]`(모듈 → advisory id 리스트)로
    바꾸고 `_report_eroded()`가 전부 나열하도록 확장.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 — 두 스크립트 전체에 0건(`grep` 확인).

## 그 외 확인한 것 (결함 아님, 기록용)

- `chain_segments()`/`override_target()`이 이전 라운드들이 확정한 "체인 구분자 vs 레인지의
  `>`" 판별 규칙(구분자는 패키지명 글자 뒤, 레인지는 `@`/공백 뒤)을 그대로 유지하며, 이번
  라운드에서 변경되지 않았다(diff 확인).
- `run_audit()`/`load_override_targets()`의 기존 fail-closed 분기(YAMLError·
  UnicodeDecodeError·OSError·TimeoutExpired·JSONDecodeError 등)는 이번 커밋에서 손대지 않아
  이전 라운드들이 고정한 회귀 방지 상태 그대로다.
- CI 배선(`deps-security-checks.yml`)의 `override-floors` 잡 타임아웃(10분)과 스크립트의
  `_AUDIT_TIMEOUT_SEC=300`(5분)의 여유 관계도 그대로 유지.
- `main()`의 모든 경로는 `0`/`1`을 반환하거나 `_undecidable()`(`NoReturn`)로 종료 — 반환값
  누락 경로 없음(직접 트레이스로 재확인).

## 요약

이번 라운드(HEAD `f71be98d8`)는 10차 리뷰가 실 pnpm registry 재현으로 발견한 CRITICAL 2건
(§1 핵심 기능인 "분류"를 무력화하던 스키마 드리프트 오판, 그리고 영구 발동 불가능이던
`widened` 죽은 코드)을 검증했다 — 둘 다 코드 읽기·`git show` diff 대조·in-process 함수
호출로 직접 확인한 결과 완전히 해소됐다. 특히 CRITICAL #2 는 리뷰의 결론을 그대로 받아들이지
않고 개발자가 독립적으로 2×2 실측을 재현해 더 강한 근거로 축 자체를 철회한 점이 눈에 띈다.
다만 같은 10차 라운드가 낸 WARNING(`advisories`/`actions` 컨테이너 타입 미검증 크래시)은 이번
커밋에서 조치되지 않고 남았다 — `advisories`가 dict 가 아닌 형태로 오면 `AttributeError`로
크래시(exit 1)해 이 스크립트 자신의 어휘로 "침식 발견"과 같은 코드가 된다는 것을 in-process
재현으로 직접 확인했다. `actions[]` 쪽 노출면은 축 3 철회로 부수적으로 사라졌으므로 남은
범위는 좁다. 그 외 2-place 편집 정합성(overrides 29건·ignoreCves 공집합 양쪽 일치), plan 의
정량 서술("fail-closed 지점 10곳") 정확성, spec 부재의 타당성(`spec_impact: none`)은 전부
직접 대조로 확인했고 문제가 없다. TODO/FIXME 류 미완성 표식도 없다. 낮은 우선순위로, 동일
모듈에 동시에 여러 advisory 가 걸릴 경우 마지막 것만 보고되는 완전성 갭을 신규로 기록했으나
이번 라운드 변경분은 아니며 조용한 통과를 유발하지 않는다.

## 위험도

LOW — Critical 0(10차 CRITICAL 2건 모두 검증 완료 해소). WARNING 1건은 크래시가 발생해도
항상 비-0 종료(조용한 통과가 아님)이고 축 3 철회로 노출면이 절반으로 줄었으며, 10차 리뷰가
이미 구체적 수정안을 제시해 둔 상태라 조치 비용이 낮다. §1(P1, 이 PR 의 헤드라인 기능)의
핵심 두 경로는 실측 기반으로 정상 동작이 확인됐다.
