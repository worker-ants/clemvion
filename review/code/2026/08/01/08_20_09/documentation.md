# 문서화(Documentation) 리뷰 — deps-guard-hardening (11차 라운드, `08_20_09`)

## 스코프 메모

router 가 넘긴 14개 파일 중 12개(파일 1~12)는 5~10차 `/ai-review` 세션의 산출물(리뷰
markdown·JSON 상태 파일, `review/code/2026/08/01/{05_36_28,06_03_11}/**`)이고, 실 코드는
2개(파일 13 `scripts/check-override-floors.py`, 파일 14
`scripts/check-pnpm-security-config.py`)뿐이다. 프롬프트의 diff 는 `origin/main` 대비
누적 diff 라 파일 13 전체(303줄)가 "신규"로 표시되지만, `git log`로 대조한 결과 10차
리뷰(`06_03_11`, 커밋 `e18fc7227` 까지 반영) 이후 실제로 새로 얹힌 델타는 커밋
`f71be98d8`("축 3 철회") 하나뿐이다 — 386줄 → 303줄로 83줄이 줄며 `widened` 경로·
`EXPECTED_SUPPRESSED_PATHS`·`_report_widened()`·`classify_vulnerable()`의 `actions[]`
드리프트 검사를 통째로 제거했다. 문서화 관점의 실질 분석은 이 델타와, 파일 12
(`user_guide_sync.md`)가 명시적으로 판단을 유보하며 다른 리뷰어에게 넘긴 질문("PROJECT.md
보조 스크립트 절 카탈로그화 여부")에 집중했다. `Read`/`grep`/`git show`/`git log`로 실제
저장소 상태(현재 `scripts/check-override-floors.py` 전문, `PROJECT.md`,
`pnpm-workspace.yaml`, `.github/workflows/deps-security-checks.yml`, `plan/in-progress/
deps-guard-hardening.md`, `.claude/tests/README.md`)와 직접 대조해 검증했다. 파일 1~12(리뷰
산출물·JSON 상태 파일)는 각자 생성 시점의 스냅샷으로 저장소 관례(`review/code/<YYYY>/<MM>/
<DD>/<hh>_<mm>_<ss>/`)에 맞게 커밋되는 대상이라 "최신 코드와 불일치"를 문서화 결함으로
보지 않는다(6~10차 문서화 리뷰가 이미 확립한 판단과 동일) — 다만 그중 파일 4·5·7(10차 자신의
documentation/maintainability/requirement 리포트)은 이번 델타가 조치한 CRITICAL 2건·구조
개선 요구의 "이전(before)" 상태 기록이므로, "이후(after)" 상태인 파일 13과 대조해 정합성을
직접 확인했다.

## 발견사항

- **[INFO]**(긍정 관측, 미해결 질문 해소) 파일 12(`user_guide_sync.md`, 10차)가 스스로의
  권한 밖이라며 판단을 유보한 질문 — "`PROJECT.md` §보조 스크립트 절에 `check-override-floors.py`를
  카탈로그화해야 하는가" — 를 확인한 결과, 현재 배치는 갭이 아니라 기존 선례를 그대로 따른
  것이다.
  - 위치: `review/code/2026/08/01/06_03_11/user_guide_sync.md:35`("PROJECT.md §보조
    스크립트 절 자체에 이 신규 스크립트를 문서화할지는 별개 사안일 수 있으나... 프로젝트
    내부 도구 카탈로그 문제"), 대조: `PROJECT.md:48`, `PROJECT.md:323-350`(`## 보조 스크립트
    (검증·운영)` 절)
  - 상세: `PROJECT.md:323`부터 시작하는 "보조 스크립트" 절은 `check-doc-links.py`·
    `report_playwright_flaky.py` 처럼 실행 명령·종료 코드·의존성을 상세 기술하는 독립
    서브섹션 카탈로그다. `check-override-floors.py`는 이 절에 없지만, 그 형제 스크립트
    `check-pnpm-security-config.py`(선행 스크립트, 여러 라운드에 걸쳐 이미 저장소에 존재)도
    이 절에 없다 — 대신 둘 다 `PROJECT.md:48`의 "**의존성 취약점 audit·핀 거버넌스**" 서술에
    포함돼 audit 잡·config-guard·override-floors 세 게이트를 하나의 정책 서사로 함께
    설명한다(`grep -n "check-pnpm-security-config\|check-override-floors" PROJECT.md`로 직접
    대조 — 두 스크립트 모두 line 48 한 곳에서만 등장, "보조 스크립트" 절엔 0건). 즉
    `check-override-floors.py`가 이미 존재하는 형제 스크립트와 동일한 문서화 계층(정책
    서사 vs 독립 사용법 카탈로그)에 놓인 것은 신규 결정이 아니라 기존 관례의 연장이다 —
    파일 12가 열어 둔 질문에 "갭 없음"으로 답할 수 있다.
  - 제안: 조치 불요. (선호에 따라 향후 "보조 스크립트" 절에도 두 스크립트를 교차 링크할 수
    있으나, 현재 두 스크립트 모두 CI 전용 게이트이고 로컬 수동 실행 절차를 문서화할 실익이
    "보조 스크립트" 절의 다른 항목들과 다르므로 강제 사항은 아니다.)

- **[INFO]**(긍정 관측, 대규모 리팩터 정합성 확인) 커밋 `f71be98d8`("축 3 철회")가 지운 83줄
  분량의 기능(`widened` 경로 계산·`EXPECTED_SUPPRESSED_PATHS`·`_report_widened()`·
  `classify_vulnerable()`의 `actions[]` 드리프트 검사)에 대해, 남은 코드의 모듈 docstring·
  함수 docstring·인접 문서 어디에도 이제 존재하지 않는 개념을 가리키는 매달린(dangling)
  참조가 없다.
  - 위치: `scripts/check-override-floors.py:220-229`(`classify_vulnerable()` docstring,
    "**`actions[]` 는 읽지 않는다.**" 로 시작해 철회 근거를 실측치로 서술)
  - 상세: 저장소 전체를 `EXPECTED_SUPPRESSED_PATHS`/`_report_widened`/`widened`로 검색한
    결과, 현재 코드·`PROJECT.md`·`.github/workflows/deps-security-checks.yml`·
    `pnpm-workspace.yaml`·`.claude/tests/README.md` 어디에도 살아있는(활성) 참조가 없고,
    남은 히트는 전부 `plan/in-progress/deps-guard-hardening.md`의 과거 이력 서술(철회
    자체를 설명하는 절)과 `review/code/**`의 시점 스냅샷뿐이다 — 둘 다 "한때 있었다"는
    역사 기록이라 stale 이 아니다. `classify_vulnerable()`의 새 docstring 은 철회 근거
    (`brace-expansion@2.1.4`를 lockfile 에 고정한 상태에서 `--audit-level=low`로 돌려도
    `ignoreCves` 유무와 무관하게 0건)를 구체적 실측치로 남기고 `plan §축 3 철회`를
    교차참조하며, 그 절은 실제로 `plan/in-progress/deps-guard-hardening.md:294-329`에
    존재해(직접 Read 로 확인) 2×2 표·CVE 2건 개별 사유까지 코드 주석과 정확히 일치한다.
    `.claude/tests/README.md`(범위 밖이나 교차 검증 목적으로 확인)의 "**Ten** sites exit 2"
    서술도 현재 코드의 `_undecidable(` 호출 지점을 직접 센 결과(정의부 제외 10곳: audit
    경로 6 + config 경로 4)와 정확히 일치한다 — 축 3 철회로 fail-closed 지점이 11→10으로
    줄었다는 커밋 메시지의 주장이 코드·문서 양쪽에서 재현된다.
  - 제안: 조치 불요.

- **[INFO]**(carried, 대상 축소) `main()`·`_report_eroded()` 2개 함수에 독립 docstring 이
  없는 점은 5차 문서화 리뷰(`03_47_10/documentation.md:67-75`)가 이미 발견해 "형제 스크립트
  관례와 일치, 강제성 없는 선택 사항"으로 정리한 이래 6~10차 연속 재상정되지 않은 판단이다.
  이번 라운드는 축 3 철회로 같은 부류였던 `_report_widened()` 자체가 코드에서 제거돼 대상이
  3개→2개로 줄었다는 점만 갱신해 기록한다 — 판단은 그대로 유지.
  - 위치: `scripts/check-override-floors.py:252`(`def main() -> int:`), `:283`
    (`def _report_eroded(eroded: list[tuple[str, str, str, list[str]]]) -> None:`)
  - 상세: (변경 없음, 5차 판단 유지) 두 함수 모두 본문은 짧고 흐름이 선형이라 별도 "왜"
    설명이 필요한 복잡도는 아니며, 파일의 다른 6개 함수(`chain_segments`,
    `override_target`, `load_override_targets`, `_undecidable`, `run_audit`,
    `classify_vulnerable`)는 전부 docstring 을 갖춰 비대칭이 크지 않다.
  - 제안: 조치 불요.

- **[INFO]** `run_audit()`의 `"actions" not in data` 존재 검사와 `classify_vulnerable()`의
  "**`actions[]` 는 읽지 않는다**" 선언이 같은 파일 안에서 개별적으로만 읽으면 언뜻 모순으로
  보일 여지가 있다(실제로는 모순이 아니다 — 전자는 응답 형태 검증, 후자는 값 소비 안 함을
  뜻한다).
  - 위치: `scripts/check-override-floors.py:210-216`(`run_audit()`의
    `if not isinstance(data, dict) or "actions" not in data:` 분기), `:223`
    (`classify_vulnerable()` docstring 의 "actions[] 는 읽지 않는다" 선언)
  - 상세: `run_audit()`의 주석("정상 응답이면 `actions`/`advisories`/`metadata` 를 갖는다.
    없으면 오류 페이로드다")은 이 검사가 `actions` 키의 **존재**를 pnpm 정상 응답의 스키마
    판별자로 쓴다는 것이지 그 **내용물**을 소비한다는 뜻이 아니라서, 두 함수를 각각 따로
    읽으면 자기모순처럼 안 보이지만 나란히 놓고 보면 "왜 안 쓰는 키의 존재를 검사하나"라는
    의문이 생길 수 있다. 축 3 철회 이전에는 이 존재 검사가 downstream 의 `actions[]` 소비와
    자연스럽게 이어졌으나, 철회 이후로는 두 함수의 관계가 한 단계 간접적이 됐다.
  - 제안: 급하지 않음. `run_audit()`의 해당 주석에 "이 검사는 `actions[]` 내용을 더 이상
    소비하지 않아도 유효한 스키마 판별자다(축 3 철회 이후에도 유지)" 한 줄을 보태면 향후
    독자의 혼선을 예방할 수 있다.

- **[INFO]**(긍정 관측) `scripts/check-pnpm-security-config.py`의 `EXPECTED_IGNORED_CVES`
  공집합화(파일 14 의 유일한 실질 변경)가 파일 내부 주석과 `pnpm-workspace.yaml`의
  `auditConfig` 주석 양쪽에 정확히 교차 근거로 기재돼 있다.
  - 위치: `scripts/check-pnpm-security-config.py:75-78`
  - 상세: 새 주석("2026-08-01 현재 비어 있다 — 종전 2건은 실측으로 무효 확인 후 제거(사유는
    `pnpm-workspace.yaml`의 `auditConfig` 주석). 항목을 되살릴 때는 그 주석과 **함께**
    고친다")이 가리키는 `pnpm-workspace.yaml:86-100`을 직접 열어 대조한 결과, CVE-2026-53550
    (js-yaml, override 로 해소됨)과 CVE-2026-14257(brace-expansion, advisory 재매칭 범위
    변경으로 무관해짐) 각각의 근거가 코드 주석과 정확히 같은 서술로 존재한다 — 2-place
    편집 규약(설정 변경 시 baseline 도 함께 갱신)이 이번에도 실제로 지켜졌다.
  - 제안: 조치 불요.

## README/CHANGELOG 필요성 재확인

이번 델타(축 3 철회 + `EXPECTED_IGNORED_CVES` 공집합화)는 신규 기능 추가가 아니라 이미
존재하던 CI 전용 가드 스크립트의 죽은 코드 제거·설정값 정리이며, 사용자가 별도로 알아야 할
사용법 변경이 없다(스크립트의 실행 방식·인자·종료 코드 의미는 변경 없음). `CHANGELOG.md`를
확인한 결과 이 계열 CI/의존성 가드 스크립트(`check-pnpm-security-config.py` 최초 도입 포함)에
대한 개별 항목이 애초에 없어(제품 기능·버그 수정 위주로 기재하는 관례), 이번에도 항목을
추가하지 않는 판단은 5~10차가 이미 확립한 선례와 일치한다. README 갱신 필요성도 동일 —
`PROJECT.md`의 관련 서술(§48, 의존성 거버넌스)은 이미 세 게이트(audit·config-guard·
override-floors)를 일반화해 설명하고 있어 이번 축소로 인해 stale 해진 문장이 없다.

## 요약

이번 라운드가 검토해야 할 실질 델타는 커밋 `f71be98d8`("축 3 철회") 하나이고, 이는 10차
requirement 리뷰의 CRITICAL 2건(스키마 드리프트 오판·`widened` 사문화 코드)을 재설계가 아닌
전면 제거로 닫았다. 문서화 관점에서는 이 대규모 제거(83줄, 함수 1개·모듈 상수 1개·테스트
클래스 3개)가 남은 코드베이스 어디에도 매달린 참조를 남기지 않았고, `classify_vulnerable()`의
갱신된 docstring이 구체적 실측치(`brace-expansion@2.1.4`, `--audit-level=low`,
`ignoreCves` 유무 무관 0건)로 철회 근거를 남기며 plan 문서의 대응 절과 정확히 교차참조된다는
점을 직접 확인했다. `.claude/tests/README.md`의 "Ten sites"(범위 밖이나 교차검증)도 현재
`_undecidable()` 호출 10곳과 일치해 축소 자체가 문서·코드 양쪽에서 일관되게 반영됐다.
Critical·Warning 수준의 문서화 결함은 발견되지 않았다. 발견된 것은 전부 INFO 수준으로:
(1) 10차 user_guide_sync 리뷰가 유보한 "PROJECT.md 보조 스크립트 카탈로그화" 질문은 기존
형제 스크립트와 동일한 배치이므로 갭이 아님을 확인, (2) `main()`/`_report_eroded()` 독립
docstring 부재는 5차부터 이어진 carried 판단(이번엔 대상만 3→2개로 축소), (3) `run_audit()`
의 `actions` 키 존재검사와 `classify_vulnerable()`의 "actions[] 안 읽음" 선언 사이에 사소한
독해 혼선 여지 — 주석 한 줄로 예방 가능하나 급하지 않음, (4)(5) 축 3 철회와 `EXPECTED_IGNORED_CVES`
공집합화 각각의 근거 문서화가 모범적이라는 긍정 관측. README/CHANGELOG 갱신 불요 판단도
재확인했다. 리뷰 산출물인 파일 1~12(5~10차 세션 markdown/JSON)는 각자 시점의 정규 스냅샷으로
저장소 관례에 맞게 커밋되는 대상이라 별도 결함으로 보지 않는다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 대규모 코드 제거
리팩터 이후에도 docstring·주석·plan 문서·인접 정책 문서(`PROJECT.md`,
`.github/workflows/deps-security-checks.yml`, `pnpm-workspace.yaml`) 사이의 정합성이
전부 확인됐고, 신규 발견은 모두 선택적 개선 제안(INFO) 수준이다. 5~10차와 동일한 위험도
등급이 이번 라운드에도 유지된다.
