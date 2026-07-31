STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===

# Dependency Review — harness bundle correctness (5 files)

## 검토 범위 확인

`git diff origin/main...HEAD --stat` 로 실제 변경분을 직접 대조했다 (프롬프트가 5개 파일 모두
"전체 파일 컨텍스트"만 제공하고 unified diff 를 생략했으므로, 무엇이 이번 PR 에서 실제로
바뀐 줄인지는 diff 로 별도 확인 필요했음):

```
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py    | 47 ++++++++++++----
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py   | 51 ++++++++++++++---
.claude/tests/test_consistency_bundle_priority.py                       | 26 ++++++++-
.claude/tests/test_consistency_context_budget.py                        | 65 +++++++++++++++++++++-
plan/in-progress/harness-consistency-summary-downgrade-rule.md          | 28 ++++++----
5 files changed, 184 insertions(+), 33 deletions(-)
```

전부 `.claude/`(harness 내부 도구) 및 `plan/`(문서) 영역이며 `codebase/**`(애플리케이션 코드) 는
전혀 포함되지 않는다. `package.json`/`pnpm-lock.yaml`/`requirements.txt`/`pyproject.toml` 등
의존성 매니페스트 변경은 0건.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전부 표준 라이브러리
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:37` (테스트 파일 쪽은 `.claude/tests/test_consistency_context_budget.py` — 아래 별도 항목)
  - 상세: 이번 diff 가 추가한 유일한 import 는 `.claude/tests/test_consistency_context_budget.py` 의 `import re` (표준 라이브러리, `re.findall`/`re.escape` 테스트 단언에 사용). `consistency_orchestrator.py` 의 신규 함수 `_natural_key`(원본 라인 213)는 이미 그 파일에 존재하던 `import re`(원본 라인 23, 기존 `RATIONALE_HEADER_RE`/`_CATALOG_BULK_RE` 용)를 재사용할 뿐 새 import 를 추가하지 않는다. `code_review_orchestrator.py` 의 신규 헬퍼 `_charge_notice`(원본 라인 561)도 순수 로컬 함수로 새 import 가 없다. pip 패키지·npm 패키지·시스템 바이너리 어느 것도 새로 추가되지 않았다.
  - 제안: 없음 — 정보성 확인.

- **[INFO]** 버전 고정 / 라이선스 / 취약점 / 번들 크기 / 호환성 — 해당 없음
  - 위치: 전체 5개 파일
  - 상세: 새 외부 의존성이 0건이므로 버전 pinning, 라이선스 호환성, 알려진 CVE, 번들 크기·빌드 시간 영향, 기존 의존성과의 버전 충돌 항목은 모두 평가 대상이 없다. `codebase/frontend`·`codebase/backend` 의 어떤 매니페스트도 diff 에 포함되지 않았으므로 JS/TS 빌드 파이프라인에 대한 영향도 없다.
  - 제안: 없음.

- **[INFO]** 내부 의존성 — 두 orchestrator 스크립트 간 "손으로 미러링" 패턴이 이번 PR 로 한 번 더 늘어남 (사전 확립된 관행, 신규 문제 아님)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:561`(`_charge_notice` 신설) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:213`(`_natural_key` 신설), `:679`(`_BUNDLE_FILE_SENTINEL` 신설)
  - 상세: 두 스크립트는 코드 자체 주석으로 "Mirrors `code_review_orchestrator._reconcile_state_with_disk`. Change both." 처럼 상호 미러링을 명시하는 기존 관행을 갖고 있다(예: `consistency_orchestrator.py` 원본 109줄). 이번 PR 은 그 표면을 두 곳에서 확장한다 — (a) `code_review_orchestrator.py` 에 예산 차감을 한 곳(`_charge_notice`)으로 모으는 리팩터, (b) `consistency_orchestrator.py` 에 `_natural_key` 자연정렬 + `_BUNDLE_FILE_SENTINEL` 파일-경계 sentinel 도입. 두 로직 모두 상대편 스크립트에 대응 구현이 없어 "따로 진화"가 시작됐다(예산-차감 정합성 버그가 과거 "절반만 이식됐다"는 코드 주석 자체가 이 위험을 실증). 다만 이 패턴은 프로젝트가 이미 채택한 결정(관련 이력: reaper/engine DRY 리팩터에서 "진짜 동일 보일러플레이트만 추출, axes 발산은 full-unification defer")과 일치하므로, 이번 PR 만의 새로운 결함이 아니라 기존에 받아들여진 트레이드오프의 연장이다. cross-skill import 엣지 자체(=consistency-checker 가 `code-review-agents/lib` 를 `sys.path` 로 재사용, `consistency_orchestrator.py:29-36`)는 이번 diff 가 건드리지 않은 기존 구조다.
  - 제안: 블로킹 아님. `_charge_notice`/자연정렬 키/파일-경계 sentinel처럼 두 스크립트가 같은 문제를 반복해서 겪는 조각이 하나둘 늘어나면, 다음 라운드에서는 `_shared/`(이미 `report_paths.py` 를 양쪽이 공유하는 전례가 있음) 아래로 승격해 "change both" 주석에 의존하지 않는 편이 유지보수 비용을 줄인다 — 지금 강제할 필요는 없음.

- **[INFO]** 테스트 파일의 신규 코드도 내부 의존만 사용
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` (변경 없이 기존 `_harness.REPO_ROOT`, `subprocess`, `unittest` 재사용) / `.claude/tests/test_consistency_context_budget.py:37`(`import re` 신규)
  - 상세: 두 테스트 파일 모두 `sys.executable -c` 서브프로세스로 orchestrator 모듈을 `importlib.util.spec_from_file_location` 로 동적 로드하는 기존 패턴을 그대로 쓴다. 신규 테스트 클래스(`ContentCannotForgeAFileBoundaryTest` 등)도 새 테스트 프레임워크·픽스처 라이브러리를 끌어오지 않고 표준 `unittest` 범위 안에 머문다. `_SENTINEL` 값을 하드코딩하지 않고 `run_in_orchestrator("emit(orch._BUNDLE_FILE_SENTINEL)")` 로 모듈에서 직접 읽어오는 방식(원본 라인 89 부근)은 리터럴 재중복을 피해 커플링을 오히려 줄이는 선택이다.
  - 제안: 없음 — 긍정적으로 참고할 사항.

## 요약

이번 변경은 `.claude/skills/**`(리뷰·컨시스턴시 orchestrator) 와 `.claude/tests/**`, `plan/in-progress/*.md` 에 한정된 harness 자체 개선(번들 우선순위 자연정렬, 파일-경계 sentinel, 예산 차감 통합)이며 애플리케이션 코드(`codebase/**`)나 의존성 매니페스트는 전혀 건드리지 않는다. `git diff --stat` 로 실제 변경 라인을 직접 대조한 결과 새로 추가된 import 는 테스트 파일의 표준 라이브러리 `re` 하나뿐이고, 신설된 함수(`_charge_notice`, `_natural_key`, `_BUNDLE_FILE_SENTINEL`)는 모두 순수 로컬 로직으로 외부 패키지·pip/npm 의존성·라이선스·취약점·번들 크기·버전 호환성 어느 축에도 영향이 없다. 유일하게 언급할 만한 것은 두 orchestrator 스크립트가 이미 갖고 있던 "손으로 미러링, change both" 내부 의존 패턴이 이번 PR 로 두 조각(예산 차감 통합/자연정렬+sentinel) 더 늘어난다는 점인데, 이는 코드 주석이 스스로 인지하고 있고 프로젝트가 이미 채택한 defer-unification 관행과 일치하므로 비차단 INFO 로 남긴다.

## 위험도

NONE
