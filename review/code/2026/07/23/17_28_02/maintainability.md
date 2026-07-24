# Maintainability Review — push-guard-worktree-scope

## 발견사항

- **[WARNING]** REVIEW 게이트와 PLAN 게이트의 "scoped 루프" 구조가 거의 동일하게 두 번 중복
  - 위치: `.claude/hooks/guard_review_before_push.py` 505~520행(REVIEW 게이트), 523~540행(PLAN 게이트)
  - 상세: `scoped = _accepts_cwd(fn)` → `for target in targets if scoped else [None]:` → `try/except: continue` → `if <blocked 조건>: print(...); return 2` 골격이 `evaluate_review`/`evaluate_plan` 두 곳에 그대로 반복된다. 차이는 (1) 호출 함수, (2) blocked 판정 필드(`decision.blocked` vs `plan.untouched`), (3) 메시지 템플릿/포맷 인자뿐이다. 이 프로젝트 메모리에도 "두 orchestrator 가 미러링(중복)으로 유지되다 한쪽만 테스트돼 드리프트" 사례가 기록되어 있듯, 이런 병렬 복제 루프는 향후 한쪽만 수정(예: fail-open 정책 변경, target 순회 로직 보강)되고 다른 쪽이 누락될 위험을 안는다.
  - 제안: `_run_scoped_gate(evaluate_fn, targets, is_blocked, message_template, message_kwargs)` 같은 공통 헬퍼로 추출해 `main()` 에서는 REVIEW/PLAN 각각 한 줄 호출로 줄이는 것을 권장. 단, 이 프로젝트는 두 게이트를 "독립적으로 best-effort" 로 유지하는 것을 명시적 설계 원칙으로 삼고 있으므로(모듈 임포트도 각각 독립적으로 try/except) 헬퍼 추출 시에도 "한 게이트의 예외가 다른 게이트를 막지 않는다"는 불변식이 깨지지 않도록 주의가 필요하다.

- **[INFO]** `timeout=5.0` 이 이 파일의 "매직넘버는 반드시 근거 주석과 함께" 관례에서 벗어남
  - 위치: `.claude/hooks/guard_review_before_push.py` 362행 (`_worktree_branches` 내부 `subprocess.run(..., timeout=5.0)`)
  - 상세: 같은 파일의 다른 모든 숫자 상수(`_OWNER_WINDOW = 512`, `_MAX_REDACTION_INPUT = 16_384` 등)는 "왜 이 값인가"를 몇 줄씩 설명하는 주석을 동반한다(가독성·유지보수성을 의식한 이 파일 고유의 강한 컨벤션). 반면 새로 추가된 `timeout=5.0` 은 근거 설명이 전혀 없어 왜 5초인지, 이 값이 늘어나면/줄어들면 어떤 트레이드오프가 있는지(훅이 매 Bash 호출을 동기적으로 게이트한다는 이 파일의 반복되는 우려사항과 직결) 알 수 없다.
  - 제안: 한 줄이라도 "왜 5초인가(예: 훅이 동기 게이트이므로 상한이 필요하지만 `git worktree list` 는 일반적으로 즉시 반환)" 근거를 남기면 이 파일의 기존 관례와 일관된다.

- **[INFO]** 새 함수 내부의 지역 `import` 가 파일 전체의 모듈-top import 관례와 다름
  - 위치: `.claude/hooks/guard_review_before_push.py` 355행(`_worktree_branches` 안의 `import subprocess`), 413행(`_accepts_cwd` 안의 `import inspect`)
  - 상세: 파일 최상단에는 이미 `json, os, re, sys, traceback` 이 모듈 레벨로 import 되어 있고(28~32행), 이 파일 나머지 부분 전체가 그 관례를 따른다. 새 코드만 함수 내부 지연 import 방식을 쓰는데, 그 이유(예: 훅이 매 Bash 호출마다 로드되므로 `subprocess`/`inspect` 임포트 비용을 아끼려는 의도인지)에 대한 설명이 없어 왜 이 두 함수만 다른 패턴을 쓰는지 다음 리뷰어/작성자가 추측해야 한다.
  - 제안: 모듈 top-level import 로 통일하거나, 지연 import 를 유지한다면 그 이유를 한 줄 주석으로 남겨 파일의 다른 설계 결정들과 같은 수준의 근거를 갖추길 권장.

- **[INFO]** `main()` 이 target 해석 + 게이트 오케스트레이션까지 맡아 책임이 늘어남
  - 위치: `.claude/hooks/guard_review_before_push.py` `main()` (486~542행)
  - 상세: 이번 변경으로 `main()` 은 payload 파싱 → `_push_targets` 호출(예외 처리 포함) → REVIEW 게이트 루프 → PLAN 게이트 루프까지 담당하게 되어 함수가 눈에 띄게 길어졌다(entry point 로서는 여전히 읽을 만한 수준이나, 위 WARNING 의 중복 제거를 적용하면 자연히 짧아진다). 현재 단계에서 심각한 문제는 아니지만, 향후 세 번째 게이트가 추가되면 복잡도가 선형으로 계속 늘어날 구조다.
  - 제안: 위 WARNING 의 헬퍼 추출과 함께라면 자연히 해결됨. 별도 조치 불필요.

## 요약

전체적으로 이 변경은 이 저장소의 harness 코드 컨벤션(모든 설계 결정에 근거 주석, blind-vs-parser 철학 일관 유지, fail-open 정책 명시)을 충실히 따르고 있고 가독성·네이밍은 양호하다. 가장 눈에 띄는 유지보수성 이슈는 REVIEW/PLAN 두 게이트의 scoped 루프가 거의 동일한 형태로 두 번 복제된 것으로, 당장 버그를 유발하지는 않지만 이 프로젝트가 과거에 "미러링된 중복 코드가 한쪽만 갱신돼 드리프트" 문제를 반복적으로 겪었다는 점에서 향후 유지보수 리스크로 남는다. 그 외 `timeout=5.0` 매직넘버와 함수 내부 지역 import 는 이 파일 자체가 세워둔 엄격한 주석/스타일 관례에서 소폭 벗어난 정도로, 기능적 문제는 아니다.

## 위험도
LOW
