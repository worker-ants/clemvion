# 의존성(Dependency) Review

## 범위 확인

`git diff origin/main...HEAD --stat` 로 이 브랜치의 전체 변경 파일을 재확인했다 (프롬프트가 "전체 파일
컨텍스트"만 제공하고 unified diff 를 생략했기 때문에, 실제로 무엇이 바뀌었는지는 별도로 대조 필요):

```
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py    |  82 +++++++++++-----
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py  |  80 +++++++++++++---
.claude/tests/test_consistency_bundle_priority.py                      |  29 +++++-
.claude/tests/test_consistency_context_budget.py                       | 103 ++++++++++++++++++++-
plan/in-progress/harness-consistency-summary-downgrade-rule.md          |  37 +++++---
5 files changed, 277 insertions(+), 54 deletions(-)
```

5개 파일 전부 `.claude/` harness 내부 도구 코드(Python)와 `plan/` 추적 문서다.
`codebase/` 하위 애플리케이션 코드나 `package.json`/`requirements.txt`/`pyproject.toml`/
`Pipfile`/lockfile 등 의존성 매니페스트는 이 diff 에 전혀 포함되지 않았다
(`find .claude -iname "requirements*.txt" -o -iname "pyproject.toml" -o -iname "Pipfile"` 결과 0건 —
이 harness 스크립트군은 애초에 표준 라이브러리만으로 동작하도록 설계돼 있다).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 두 orchestrator 스크립트 모두 import 문 변경 0건
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
    (`git diff origin/main...HEAD -- <두 파일> | grep '^[+-]import\|^[+-]from'` → 결과 없음)
  - 상세: 이번 변경은 `_charge_notice`/`_notice_text`(예산 산술 통합), `_natural_key`(자연 정렬),
    `_neutralize_sentinel`/`_BUNDLE_FILE_SENTINEL`(파일 경계 sentinel) 등 순수 로직 리팩터/버그
    수정이며, 기존에 이미 import 되어 있던 표준 라이브러리(`re`, `os`)만 사용한다. 새로 추가된
    third-party 패키지, lockfile 변경, `pip install` 대상 없음.
  - 제안: 없음 (문제 아님, 확인 목적 기재).

- **[INFO]** 테스트 파일 1건에 표준 라이브러리 `import re` 신규 추가 — 외부 의존성 아님
  - 위치: `.claude/tests/test_consistency_context_budget.py` (diff 상단, `import json` 다음 줄에
    `+import re` 추가 — 실제 파일에서는 `import json` 아래)
  - 상세: `re.findall`/`re.escape` 로 생략 목록(`OMITTED_FILES_HEADING`) 파싱과 sentinel 이스케이프에
    사용. 표준 라이브러리이며 같은 스킬의 다른 스크립트(`consistency_orchestrator.py`)에서 이미
    사용 중인 모듈과 동일 — 신규 의존성 표면 없음.
  - 제안: 없음.

- **[INFO]** 내부 의존성 — `_natural_key` 스코프는 정상, 자매 orchestrator 와의 미러 누락 없음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `_natural_key`
    함수(및 `collect_markdown_files`/`prioritize_bundle_files` 호출부)
  - 상세: `code_review_orchestrator.py` 는 파일을 diff 크기(`indexed.sort(key=lambda x: len(...))`,
    693번째 줄 부근) 또는 크기(`content_indices.sort(...)`, 723번째 줄 부근) 기준으로만 정렬하고,
    "파일명 알파벳순 우선순위" 로 정렬하는 경로가 아예 없다 — 즉 이번에 고친 "`10-*.md` 가
    `4-*.md` 를 앞선다" 버그 클래스가 code-review 쪽에는 애초에 존재하지 않는다. 두 orchestrator
    가 "Mirrors ... Change both" 주석으로 여러 함수를 짝지어 유지하는 구조이지만(예:
    `_reconcile_state_with_disk`), `_natural_key` 는 그 짝 목록에 속하지 않아도 되는 함수이므로
    한쪽에만 있는 것이 정상이다. grep 결과 `_natural_key`/`natsort`/`natural_sort` 는
    `consistency_orchestrator.py` 1곳에만 정의·사용되고 중복 정의는 없다.
  - 제안: 없음 — 향후 `code_review_orchestrator.py` 에 파일명 기준 정렬이 추가되는 경우에만
    이 짝 관계를 재검토.

- **[INFO]** 새 유틸리티를 위해 외부 라이브러리(`natsort` 등)를 도입하지 않고 표준 라이브러리
  `re.split(r"(\d+)", path)` 로 자체 구현 — 의존성 관점에서 올바른 선택
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:_natural_key`
  - 상세: natural sort 는 흔히 `natsort` 패키지로 해결하지만, 이 harness 는 파일 경로 문자열
    비교라는 좁은 문제만 필요하므로 2줄짜리 표준 라이브러리 구현으로 충분하다. 새 의존성을
    추가하지 않은 판단은 "불필요한 의존성" 관점에서 바람직하며, `test_consistency_bundle_priority.py`
    에 해당 함수 자체의 동작(동수/두자리 우선순위 등)을 검증하는 테스트가 있어 자체 구현의
    리스크(엣지 케이스 누락)도 낮다.
  - 제안: 없음.

- **[INFO]** (컨텍스트, 신규 아님) `consistency_orchestrator.py` 는 여전히 `code-review-agents`
  스킬의 `lib/` 패키지를 `sys.path` 조작으로 import — 이번 diff 로 변경된 지점 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 상단
    `CODE_REVIEW_SKILL = os.path.normpath(os.path.join(SKILLS_DIR, "code-review-agents"))` 및
    `sys.path.insert(0, CODE_REVIEW_SKILL)` 블록 (파일 최상단, docstring 아래)
  - 상세: 두 스킬 간 cross-import 커플링(consistency-checker → code-review-agents/lib)은 기존
    아키텍처이며, 이번 diff 의 hunk 는 이 블록을 전혀 건드리지 않는다(`git diff` 로 확인). "8. 내부
    의존성" 관점에서 존재를 기록해 두지만, 이번 변경이 새로 만든 결합은 아니다.
  - 제안: 없음 — 기존 결정 사항이므로 재작업 불필요.

## 요약

이번 변경분(`code_review_orchestrator.py`, `consistency_orchestrator.py`,
`test_consistency_bundle_priority.py`, `test_consistency_context_budget.py`,
`harness-consistency-summary-downgrade-rule.md`)은 전부 `.claude/` harness 내부 Python 도구와
`plan/` 추적 문서로, `codebase/` 애플리케이션이나 의존성 매니페스트(package.json/requirements 등)를
전혀 건드리지 않는다. import 문 변경은 테스트 파일 1곳의 표준 라이브러리 `re` 추가뿐이며, 그 외
전부 기존에 이미 사용 중이던 표준 라이브러리(`re`, `os`)를 이용한 순수 로직 리팩터·버그 수정이다.
새 외부 패키지, 버전 고정 이슈, 라이선스 문제, 알려진 취약점, 번들/빌드 영향, 버전 충돌은 발견되지
않았다. 내부 모듈 의존성 측면에서도 자연 정렬 헬퍼(`_natural_key`)의 스코프가 적절하고 자매
orchestrator 와의 "Change both" 미러 대상에도 해당하지 않음을 확인했으며, 기존 cross-skill lib
커플링은 이번 diff 로 변경되지 않았다. 실질적으로 이 변경은 의존성 관점에서 검토할 항목이 없는
diff 다.

## 위험도

NONE
