# Requirement Review — router_safety.py 정책 표 drift 수정 + 가드 테스트

## 발견사항

- **[WARNING]** README.md 미러 표의 "24 확장자" 가 여전히 수정되지 않았고, 신규 가드 테스트도 이를 잡지 못한다 — 이번 PR 이 없애려는 바로 그 결함 클래스가 한 곳에 남아 있음
  - 위치: `.claude/skills/code-review-agents/README.md:68` (`| 소스 파일 (24 확장자) | ... |`)
  - 상세: `router_safety.py` 의 module docstring(리뷰 대상 파일 1, gate 36)은 `_SOURCE_CODE_EXTENSIONS` 가 44개임을 반영해 "24 extensions below" → "44 extensions below" 로 정정됐다. 그러나 그 docstring 이 스스로 "동일 내용을 미러링" 한다고 명시하는 `.claude/skills/code-review-agents/README.md` 의 Trigger 표(line 68, `소스 파일 (24 확장자)`)는 이번 diff 에 포함되지 않아 여전히 옛 값 "24" 를 갖고 있다. `grep -rn "24.*확장자" .claude/` 로 확인한 결과 저장소 전체에서 이 한 줄만 아직 stale 하다.
    새로 추가된 `test_router_safety_policy_doc.py`(리뷰 대상 파일 3)는 자신의 docstring 에서 "the source-extension count and spelled-out list (**both docs**)" 를 검증한다고 명시(파일 2 `.claude/tests/README.md` gate 37 의 신규 행도 동일 문구를 복제)하지만, 실제 구현은 다음과 같이 **README 의 개수(count) 는 검증하지 않는다**:
    - `test_table_states_the_real_extension_count` — `router_safety.py` 자신의 docstring(`self.doc`, `Source-code file (\d+ extensions below)`)만 검사, `README` 는 대상이 아님.
    - `test_readme_list_is_exactly_the_constant` / `_readme_extension_list()` — README 의 "소스 코드 확장자: `...`" **철자 나열 목록**(line 79, 이미 44개로 정확함)만 검사하며, Trigger 표의 "(24 확장자)" **개수 문자열**(line 68)은 정규식 대상이 아니다.
    실측: `python3 -m unittest discover -s .claude/tests -p 'test_router_safety_policy_doc.py' -v` 실행 결과 6개 테스트 전부 `ok` — README 의 stale "24" 가 여전히 존재함에도 그린으로 통과한다. 즉 "다음 divergence 는 테스트가 잡는다" 는 이 PR 의 목적이 정확히 이 지점(README Trigger 표 카운트)에서는 아직 충족되지 않는다.
  - 제안: (1) `.claude/skills/code-review-agents/README.md:68` 의 "24 확장자" → "44 확장자" 로 정정, (2) `test_router_safety_policy_doc.py` 에 README 의 `| 소스 파일 (\d+ 확장자) |` 카운트를 추출해 `_SOURCE_CODE_EXTENSIONS` 길이와 비교하는 케이스를 추가(또는 기존 케이스 docstring 의 "both docs" 주장을 실제 커버리지에 맞게 정정). `.claude/tests/README.md` 의 신규 행 문구("the source-extension count ... (both docs)")도 실제 커버리지에 맞춰 조정 필요.

- **[INFO]** `test_router_safety_policy_doc.py` 에서 `from pathlib import Path` 가 import 되지만 실제로 사용되지 않는다 (`REPO_ROOT` 는 이미 `_harness` 에서 Path 인스턴스로 제공되어 `/` 연산자만 쓰임).
  - 위치: `.claude/tests/test_router_safety_policy_doc.py:29`
  - 상세: 기능에 영향은 없는 미사용 import(lint 관점의 사소한 이슈). 리뷰 대상 코어 로직과 무관.
  - 제안: 불필요하면 제거.

- **[INFO]** spec fidelity — 이번 변경(router_safety.py 정책 표, harness 테스트) 은 `spec/` 문서로 정의된 제품 요구사항이 아니라 `.claude/skills/code-review-agents/` 하위의 harness 내부 도구 정책이다. `grep -rn "router_safety" spec/` 결과 0건 — 대응하는 spec 문서가 존재하지 않으므로 spec fidelity 체크는 해당 없음(정보성).
  - 위치: N/A (spec 미존재)
  - 상세: 이 변경은 `.claude/skills/code-review-agents/README.md` "Router safety policy" 절이 SSOT 미러이며, `spec/` 트리와는 무관.
  - 제안: 없음.

## 검증한 항목 (문제 없음)

- `_SOURCE_CODE_EXTENSIONS` 실제 원소 수는 44개(직접 import 하여 `len()` 확인), docstring 의 나열 목록(48~51행)과 정확히 일치.
- `_SOURCE_FORCED_REVIEWERS`(security/requirement/scope/side_effect/maintainability/testing 6개) 는 docstring 표(gate 36 행)·README Trigger 표(line 68 의 두 번째 컬럼, 이건 이미 올바름)·신규 테스트 3종(`test_table_row_names_the_real_forced_reviewers` 등) 모두와 합치.
- `compute_forced_agents` / `_file_matches` / `_RULES` 등 실제 라우팅 로직은 이번 diff 에서 변경되지 않음 — 이번 변경은 순수 문서 정정 + 신규 테스트이며, 라우터의 실제 강제 포함 동작(런타임 정확성)에는 이전부터 문제 없었음(표는 사람이 읽는 문서일 뿐, 로직이 참조하지 않음). 따라서 이번 drift 는 기능적 버그가 아니라 문서 정확성 문제였고, 그 스코프 안에서는 CRITICAL 이 아님.
- 신규 테스트 6종은 실행 시 전부 통과(`OK`), subprocess 기반 격리(`router_safety` vs `_harness` 의 `_lib` 이름 충돌 회피)도 의도대로 동작.
- `.claude/tests/README.md` 신규 행 추가는 형식·위치(표 순서, 기존 컨벤션) 모두 기존 패턴과 일치.

## 요약

`router_safety.py` docstring 표의 "24→44" 정정과 이를 지키는 신규 가드 테스트(`test_router_safety_policy_doc.py`) 자체는 정확하고 잘 구현됐으며, 실행 결과도 전부 통과한다. 다만 이 PR 이 명시적으로 해결하려는 문제("두 곳(문서)을 같이 갱신하지 않으면 stale 해진다")가 **정확히 같은 유형으로 한 곳에 남아 있다** — `.claude/skills/code-review-agents/README.md` 의 Trigger 표는 아직 "24 확장자"이고, 신규 가드 테스트는 자신의 docstring 이 주장하는 "both docs" 커버리지와 달리 README 의 이 카운트를 검사하지 않아 이 stale 값을 통과시킨다. 실제 라우팅 로직에는 영향이 없는 문서 정확성 이슈이므로 severity 는 WARNING 으로 판단했으나, PR 의 목적("다음 divergence 는 테스트가 잡는다")을 완전히 충족하지 못했다는 점에서 반드시 후속 조치가 필요하다.

## 위험도

MEDIUM
