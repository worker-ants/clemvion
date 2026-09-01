# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** `_CHECKBOX` 정규식 확장(blockquote 접두 허용)이 shared 상수라 해당 함수의 **모든** 호출 대상(현재·미래의 모든 `plan/in-progress/*.md`)에 소급 적용된다
  - 위치: `.claude/hooks/_lib/plan_guard.py:87` (정의), `:259` (`_all_checkboxes_done` 내 유일한 사용처)
  - 상세: `_CHECKBOX = re.compile(r"^\s*[-*]\s+\[(?P<mark>[ xX])\]")` → `re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")`. 이 상수는 모듈 레벨 전역이고 사용처는 `_all_checkboxes_done()` 한 곳뿐임을 실측 확인(`grep -n "_CHECKBOX\b"` 저장소 전체 1개 정의 + 1개 사용). `_all_checkboxes_done()` 은 `evaluate_plan()` → `guard_review_before_stop.py`(Stop nudge) 와 `guard_review_before_push.py`(push gate) 양쪽에서 import 되지만, `_linked_plans()` 가 `plan/in-progress/**` 만 스캔하므로(`.claude/hooks/_lib/plan_guard.py:68,186-215`) 영향 범위는 in-progress plan 으로 국한된다. 또한 `evaluate_plan()` 내부에서 `complete_pending`(이 함수의 반환값)은 `complete_but_in_progress`(소프트 넛지)에만 쓰이고, push 하드블록(`untouched`)은 `handled`(plan 갱신 여부)로만 결정되므로(`:302,306-331` 확인) **push 를 새로 막는 방향의 부작용은 없다** — 최악의 경우도 "이미 완료됐다" 는 잘못된 넛지 문구 표시뿐이다.
  - 이 확장이 의도적으로 넓힌 것이라 이번 세션 시점의 저장소 상태는 diff 주석이 스스로 실측(인용문 안 `[ ]` 6건 중 불릿 구조 3건, 전부 실제 열린 작업)해 회귀가 없음을 확인해 두었다. 다만 그 실측은 **현재 스냅샷 한정**이다 — 앞으로 누군가 "체크박스 문법 예시" 를 인용문으로 설명하며 `> - [ ] 예시` 형태를 쓰면(예: 이 정규식 자체를 설명하는 문서), 실제로는 서술적 예시인데도 열린 작업으로 오탐될 수 있다. 코드가 fenced code block 을 건너뛰지 않는 것도 이번 diff 가 새로 만든 gap 이 아니라 기존 함수의 pre-existing 특성이다(옛 정규식도 코드펜스를 구분하지 않았다).
  - 제안: 조치 불요(설계상 수용된 트레이드오프로 보인다, blast radius 가 소프트 넛지로 이미 제한됨). 다만 향후 이 파일이나 관련 컨벤션 문서에서 체크박스 문법을 blockquote 예시로 설명할 일이 생기면, 그 예시가 이 넓어진 패턴에 걸려 오탐을 만들 수 있음을 염두에 둘 것.

- **[INFO]** `plan/complete/**` 문서에서 도구 아티팩트 태그(`</content>`, `</invoke>`) 제거 — 코드/툴링 의존성 없음을 확인
  - 위치: `plan/complete/agent-memory-model-config.md`, `plan/complete/agent-memory-model-select.md`, `plan/complete/fix-model-select-label.md`, `plan/complete/webchat-session-apibase-binding.md`, `plan/in-progress/webchat-usewidget-extraction.md` (각 파일 말미 `</content>`/`</invoke>` 삭제 라인)
  - 상세: 저장소 전체(`.claude`, `codebase`)에서 `</content>`/`</invoke>` 문자열을 참조하는 non-test 코드가 있는지 검색했으나 0건 — 이 문자열을 마커로 파싱하는 도구가 없어 삭제가 다른 동작에 부작용을 일으키지 않는다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 새 가드 테스트 `stray-tool-tags.test.ts` 는 실행 시 `plan/**`·`spec/**` 전체를 디스크에서 읽지만(쓰기 없음), `review/**` 는 파일 설명대로 의도적으로 스캔 범위에서 제외돼 있어 이 diff 가 정리하지 않은 `review/**` 31개 파일의 잔존 태그는 이 테스트로 감지되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` `findStrayTags()` (`walkTree(root, ["plan", "spec"], …)`)
  - 상세: 파일시스템 부작용은 없다(순수 read). 다만 "재발 감지" 라는 가드의 목적상, `review/**` 를 범위 밖에 둔 설계 선택이 문서 주석에 명시돼 있어(§"범위를 왜 직접 정하나") 이는 의도된 스코핑이지 부작용은 아니다.
  - 제안: 없음(요구사항/커버리지 관점 리뷰어 소관).

## 요약

이번 changeset 은 대부분 harness 위생(plan lifecycle 문서·리뷰 산출물·plan 체크리스트 갱신)과 두 개의 신규/확장 테스트 파일로 구성돼 있으며, 진정한 "부작용" 표면은 `.claude/hooks/_lib/plan_guard.py` 의 `_CHECKBOX` 정규식 확장 하나뿐이다. 이 상수는 모듈 전역이지만 사용처가 단 하나(`_all_checkboxes_done`)이고, 그 함수의 영향 범위도 in-progress plan 의 Stop-gate 소프트 넛지로 국한되며 push 하드블록에는 영향이 없음을 코드 추적으로 확인했다. 확장이 만드는 잠재적 오탐(미래의 서술적 blockquote 체크박스 예시)은 현재 저장소 실측으로는 발생하지 않지만 구조적으로 완전히 막혀 있지는 않다 — 다만 이는 blast radius 가 이미 좁게 억제된 낮은 리스크다. 시그니처·공개 인터페이스·환경변수·네트워크 호출·전역 상태 변경은 발견되지 않았고, 도구 아티팩트 태그 삭제도 코드 의존성이 없음을 확인했다.

## 위험도
LOW
