# 의존성(Dependency) 리뷰 보고서

## 검토 범위 확인

`git diff origin/main...HEAD` 기준으로 이번 변경분은 13개 파일, 전부 `.claude/**` (harness 툴링:
agent/skill 정의 md, Python hook·orchestrator 스크립트, 신규 unit test 3건, plan 추적 md) 이다.
`codebase/**` (실 제품 코드), `package.json`, `requirements.txt`/`Pipfile`/`pyproject.toml` 등
의존성 매니페스트 변경은 **0건**이다.

전체 diff 의 `+import ...` / `+from ... import ...` 추가 라인을 전수 확인한 결과 (`git diff
origin/main...HEAD | grep -E '^\+(import |from )'`), 신설된 import 는 신규 테스트 3개 파일이 각각
추가한 `json`/`subprocess`/`sys`/`textwrap`/`unittest`/`from __future__ import annotations`
(전부 표준 라이브러리) 와 기존 헬퍼 `from _harness import REPO_ROOT` (사전 존재 모듈, `#357`/`#1003`
커밋 이력 확인) 뿐이다. 그 외 파일(`review_guard.py`, `guard_review_before_stop.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`)은 이번 diff 에서 **신규 import
라인 자체가 없다** — 기존에 이미 import 되어 있던 stdlib(`re`/`os`/`subprocess`/`json`/`time`/
`dataclasses`/`datetime`)와 내부 모듈(`_lib.*`, `lib.*`, `_shared.*`, `branch_guard`,
`review_guard`, `plan_guard`, `failopen_state`)만 사용한다.

## 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 프로젝트 자체 규약과 일치
  - 위치: `.claude/tests/README.md:14` (직접 Read 확인 — 파일 전체가 프롬프트 크기 제한으로 생략된
    파일 7)
  - 상세: `.claude/tests/README.md:14-17`가 "The suite uses **only the standard library**
    (`unittest`, `unittest.mock`), matching the harness convention that its Python carries zero
    third-party dependencies — hooks must run on a bare `python3`. Do not introduce
    `pytest`/`requirements.txt` here without revisiting that convention." 라고 명문화하고 있다.
    이번 PR 의 신규 테스트 3개(`test_consistency_bundle_priority.py`,
    `test_prompt_omission_notice.py`, `test_review_changeset_warning.py`)와 수정된 hook/orchestrator
    코드 전부 이 규약을 그대로 준수한다(표준 라이브러리 + 내부 모듈만 사용, `pytest` 등 3rd-party
    테스트 프레임워크 도입 없음). 버전 고정·라이선스 호환·알려진 취약점·번들 크기/빌드 시간·기존
    의존성과의 버전 충돌 — 이번 관점 8개 항목 중 1~7번은 새 외부 패키지가 전혀 없으므로 해당 사항
    없음(N/A)이다.
  - 제안: 없음 (현행 유지가 곧 규약 준수).

- **[INFO]** 내부 의존성 — "기본 브랜치 해석" 로직의 4번째 독립 구현이 이번 PR 에서 신설됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1126`
    (`_default_branch_ref()` — 프롬프트에는 크기 제한으로 실리지 않아 실제 소스를 `Read`로 직접
    확인한 줄 번호. `git diff` 상으로도 이번 PR 의 순수 신설(`+`) 함수임을 확인) /
    관련 자기-기록: `plan/in-progress/harness-review-gate-ci-backstop.md:27-33` (게이트 번호,
    "신규 후속 1건 (defer)" 절)
  - 상세: 이번 diff 가 "origin 기본 브랜치를 알아낸다" 는 동일한 목적의 로직을 한 곳 더 만들었다.
    plan 문서 자신이 이미 정확히 이 사실을 인지·기록해 두었다: `branch_guard._origin_default_branch()`
    (정본) · `review_guard._default_branch()` · 이번에 신설된
    `code_review_orchestrator._default_branch_ref()` · `consistency_orchestrator` 의
    `args.diff_base or "origin/main"` 리터럴, 이렇게 **4곳의 독립 구현**이 병존하게 됐다(반환 계약도
    로컬 `main` vs `origin/main` 로 서로 다르다). plan 은 통합이 `.claude/hooks/_lib` 와 각 skill의
    `scripts/_lib` 사이 Python 모듈명 충돌 해소가 선행돼야 하는 별도 범위임을 근거로 이번 PR 에서는
    의도적으로 defer 했다고 명시한다. 즉 이 항목은 은폐된 결함이 아니라 **PR 저자가 스스로 인지하고
    추적 중인 내부 의존성 중복**이다 — 기본 브랜치 판정 정책이 바뀌면 4곳을 모두 손으로 맞춰야 하는
    drift 위험이 현재 상태로 남아 있다는 점만 리뷰 관점에서 재확인해 기록한다.
  - 제안: 즉시 조치 불필요(이미 plan 에 defer 로 등재·근거 문서화됨). 다만 향후 `_lib` 네임스페이스
    충돌을 해소하는 별도 작업이 열리면, 그 작업의 스코프에 "4곳 통합"을 명시적으로 포함시켜 이번에
    늘어난 4번째 사본까지 함께 접도록 우선순위 목록에 남겨 둘 것을 권장.

- **[INFO]** 내부 의존성 — git-diff 서브프로세스 호출 헬퍼가 같은 파일 안에 유사한 모양으로 2개 존재
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`
    (`_branch_changed_rels`, 이번 PR 신설) 및 같은 파일 `:323` (`_collect_code_diff`, 기존)
  - 상세: 두 함수 모두 `git diff <base>...HEAD` 를 3-dot 규약으로 실행하고
    `subprocess.run(..., capture_output=True, text=True, timeout=30, cwd=root)` +
    `try/except` 로 실패를 흡수하는 동일한 골격을 따로 구현한다. 다만 목적이 다르다 —
    `_collect_code_diff` 는 `code_areas` 로 좁힌 **diff 본문 텍스트**(`--impl-done` 프롬프트에 삽입),
    `_branch_changed_rels` 는 전체 레포(또는 `subpath`) 범위의 **변경 파일 경로 집합**(`--name-only`,
    `prioritize_bundle_files` 랭킹 입력)을 반환한다 — 그래서 단순 중복 제거 대상은 아니다. 다만
    `subprocess.run` 호출부·타임아웃·에러 로깅 패턴이 거의 동일해, 공유 `_git_diff(args, root)` 류
    헬퍼로 뽑으면 향후 두 곳이 각자 드리프트(예: 한쪽만 timeout 값이 바뀌는 등)할 여지를 줄일 수
    있다.
  - 제안: 블로킹 사유 아님. 유지보수 관점의 선택적 개선(추후 리팩터 시 참고).

## 요약

이번 PR 은 `.claude/**` harness 툴링(코드 리뷰/일관성 체크 게이트 및 그 테스트) 안에서만 이뤄진
변경으로, `codebase/**` 나 의존성 매니페스트(package.json/requirements.txt 등)에는 손대지 않았다.
diff 전수 검사 결과 새로 추가된 import 는 표준 라이브러리(json/subprocess/sys/textwrap/unittest)와
기존 내부 헬퍼(`_harness.REPO_ROOT`) 뿐이며, 새 외부 패키지·버전 고정·라이선스·알려진 취약점·번들
크기/빌드 시간·기존 의존성과의 호환성 이슈는 전혀 발생하지 않는다. 저장소가 스스로 규정한
"harness Python 은 표준 라이브러리만 사용한다"(`.claude/tests/README.md:14-17`) 규약도 그대로
지켜졌다. 유일하게 실질적인 관측은 8번 관점(내부 의존성)에 해당하는 것으로, `code_review_
orchestrator.py` 가 "기본 브랜치 해석" 로직의 4번째 독립 구현(`_default_branch_ref`)을 추가해 기존
3곳(`branch_guard`/`review_guard`/`consistency_orchestrator`)과 병존하게 됐다는 점인데, 이는 PR
자신이 `plan/in-progress/harness-review-gate-ci-backstop.md` 에 "`_lib` 네임스페이스 충돌 해소가
선행돼야 하는 별도 범위" 라는 근거와 함께 이미 defer 로 명문화해 둔 의도적 트레이드오프이지 은폐된
결함이 아니다. 차단 사유가 될 항목은 없다.

## 위험도

LOW
