# Side Effect Review — review/code/2026/07/23/16_49_22

## 대상 changeset 요약

- `.claude/skills/code-review-agents/README.md` — 정책표 "24 확장자" → "44 확장자" (문자열만 수정, 로직 무변경)
- `.claude/skills/code-review-agents/lib/router_safety.py` — docstring 표의 동일 수치 수정 (실행 코드·`_SOURCE_CODE_EXTENSIONS` 상수 자체는 무변경)
- `.claude/tests/README.md` — 신규 테스트 파일 설명 행 1건 추가 (문서)
- `.claude/tests/test_router_safety_policy_doc.py` — 신규 테스트 파일 (322줄)
- `review/code/2026/07/23/16_30_52/*` — 직전 리뷰 사이클의 산출물(SUMMARY/RESOLUTION/`_retry_state.json`/`meta.json`/각 reviewer `.md`)을 커밋에 포함 — 컨벤션상 정상적인 리뷰 아티팩트 저장이며 런타임 부작용 대상 아님

### 발견사항

- **[INFO]** `runpy.run_path`가 `code_review_orchestrator.py` 전체 모듈 최상위 코드를 실행 — 현재는 무해하나 향후 orchestrator 상단에 부작용이 추가되면 매 테스트 실행마다 암묵적으로 함께 트리거됨
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:68` (`_all_agents()`), 구체적으로 72번째 줄의 `m=runpy.run_path({str(ORCH)!r})` 표현식
  - 상세: `_all_agents()`는 `subprocess.run([sys.executable, "-c", script], ...)`으로 별도 프로세스를 띄워 그 안에서 `runpy.run_path(ORCH)`를 호출한다. `code_review_orchestrator.py`를 직접 import(`from lib import router_safety as rs`와 달리 `runpy.run_path`는 `if __name__ == "__main__":`(해당 파일 line 1303 부근) 아래 `main()` 호출부는 `__name__`이 `"__main__"`이 아니므로 실행되지 않지만, 모듈 최상단의 함수/클래스 정의 이외의 모든 최상위 statement(현재는 import·상수·`sys.path.insert`·`debug_log = session.make_debug_logger(...)` 정도만 존재하고 실제 I/O는 없음, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:47` 부근)는 실행된다. 오늘 시점 실측으로는 파일 I/O·네트워크 호출 등 관측 가능한 부작용이 없음을 확인했으나, orchestrator 최상위에 향후 부작용(파일 쓰기, env 읽기·쓰기 등)이 추가되면 이 테스트가 그것을 매번 암묵적으로 트리거하는 결합점이 된다. 이 지점은 직전 리뷰 사이클(`review/code/2026/07/23/16_30_52/SUMMARY.md` INFO #4)에서 이미 지적·판정("현재 부작용 없음, 선택 사항")된 사안으로 이번 커밋에서 신규로 발생한 결함은 아니며 코드 수정도 없었다.
  - 제안: 기존 권고(orchestrator 모듈 docstring 또는 이 테스트 파일에 "runpy로 임포트되므로 최상위에 부작용을 두지 말 것" 주석 추가)를 유지. 이번 라운드에서 반드시 조치할 필요는 없음(이미 검토·판정 완료된 낮은 리스크).
- **[INFO]** `subprocess.run`으로 새 파이썬 인터프리터를 스폰해 `router_safety`/`ALL_AGENTS` 값을 조회 — 격리 목적의 의도된 설계, 부작용 없음 확인
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:59` (`_router_safety_values`), `:69` (`_all_agents`)
  - 상세: 두 헬퍼 모두 `sys.executable -c <script>`를 별도 프로세스로 실행한다. 스크립트에 삽입되는 문자열은 전부 로컬 `REPO_ROOT`/`SKILL_DIR`/`ORCH` 파생 경로이며 외부 입력이 아니고 `shell=True`도 아니라서 인젝션 표면이 없다. `cwd=str(REPO_ROOT)`, 그리고 스크립트 내부의 `sys.path.insert(0, ...)`·`sys.argv=['x']` 조작은 모두 **자식 프로세스 안에서만** 유효해 호스트(테스트 실행) 프로세스의 `sys.path`/`sys.argv`/cwd에는 어떤 영향도 주지 않는다. `.claude/_lib`(hooks)과 `skills/_lib`의 이름 충돌을 피하기 위한 기존 `test_router_decision_trust.py`와 동일한 격리 패턴이다.
  - 제안: 없음 (조치 불요, 기존 설계 재확인).
- **[INFO]** 문서 전용 수정(`README.md`, `router_safety.py` docstring)은 실행 경로·시그니처·전역 상태에 전혀 영향 없음
  - 위치: `.claude/skills/code-review-agents/README.md` (68번째 행 부근 표), `.claude/skills/code-review-agents/lib/router_safety.py` (docstring 내 정책표, 35번째 행 부근)
  - 상세: 두 파일 모두 표시 문자열의 숫자만 "24"→"44"로 바뀌었고 `_SOURCE_CODE_EXTENSIONS`·`_SOURCE_FORCED_REVIEWERS`·`_RULES` 등 실제 판정 로직·상수는 diff에 포함되지 않았다(사전에 이미 44개로 존재, 문서만 stale 이었음). 함수 시그니처·공개 API·환경변수·네트워크 호출·이벤트 흐름에 대한 변경 없음.
  - 제안: 없음.

### 요약

이번 changeset 은 사실상 문서 수치 정정(README.md, router_safety.py docstring) + 신규 회귀 테스트 파일 1개 추가이며, 프로덕션 함수 시그니처·전역 상태·환경 변수·네트워크 호출·콜백 흐름에 대한 변경은 전혀 없다. 유일하게 부작용 관점에서 검토할 대상은 신규 테스트가 사용하는 `subprocess`/`runpy.run_path` 조합인데, 둘 다 자식 프로세스 내부로 격리되어 있어 호스트(테스트 실행) 프로세스에 누출되는 상태 변경이 없음을 확인했다. `runpy.run_path`가 `code_review_orchestrator.py` 최상위 코드를 매 테스트 실행마다 실행한다는 잠재적 결합점은 실측상 현재 무해하며, 이미 직전 리뷰 사이클에서 지적·판정(조치 불요)된 사안이라 이번 라운드의 신규 결함이 아니다. `review/code/.../16_30_52/*` 산출물 커밋은 프로젝트 컨벤션에 따른 정상적인 리뷰 아티팩트 보존이며 런타임 부작용과 무관하다.

### 위험도
NONE
