# 아키텍처(Architecture) Review

## 이전 라운드 대비 해소 확인

이 diff 는 이미 두 차례(19:47:10, 20:05:23) 아키텍처 리뷰를 거쳤고, 그 사이 fix 커밋
(`64c71ae14`, `7d3cf7721`)이 들어갔다. 재리뷰 시작 전 이전 라운드가 지적한 아키텍처
관점 항목이 실제로 해소됐는지 소스를 직접 열어 대조했다:

- `git_probe.py` 모듈 docstring — "세 push-gate guard 가 공유" → 현재
  `"Git probes shared by the three push-gate guards and two skill orchestrators."`
  (`.claude/_shared/git_probe.py:1`)로 갱신되어 실제 소비자 범위와 일치. **해소됨.**
- `retry_state.py` 모듈 제목 — "shared by both orchestrators" → 현재
  `"shared by all three orchestrators"`(`.claude/_shared/retry_state.py:1`)로 갱신.
  **해소됨.**
- `_record_fatal` → `save_state` 순서 불변식이 주석에만 의존한다는 WARNING → 현재
  `test_the_sentinel_is_on_disk_before_the_state_file_is_written`
  (`.claude/tests/test_retry_state_shared.py:311`)이 그 순서 자체를 직접 회귀 테스트로
  고정. **해소됨.**
- README(`code-review-agents`)의 "영구 실패" 과장 표현 → 현재
  `.claude/skills/code-review-agents/README.md:118`에 "`/loop` 가 자동 재시도하지 않음.
  '영구' 는 아니다" 로 정정. **해소됨.**
- merge-coordinator README/`consistency-checker/SKILL.md`에 `_fatal/` 운영 함정 미러링
  누락 → 양쪽 모두 `code-review-agents/README.md` §운영 함정으로 링크 추가
  (`.claude/skills/merge-coordinator/README.md:76,90`,
  `.claude/skills/consistency-checker/SKILL.md:100-104`). **해소됨.**

## 발견사항

- **[WARNING]** "같은 agent 에 대한 `--update` 는 겹치면 안 된다"는 불변식이 실제 호출
  경계(CLI 인자·call-contract 문서)가 아니라 3계층 아래 공유 구현 모듈의 함수 docstring
  에만 존재한다
  - 위치: 계약 서술 — `.claude/_shared/retry_state.py:178-188` (`_record_fatal`
    docstring "**Caller contract: updates for the SAME agent must not overlap.**").
    호출 경계 — `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1473-1475`,
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:897-899`,
    `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:518-520`
    (세 orchestrator 의 `--update` argparse `help=` 문자열). 프로젝트 공통 규약 —
    `.claude/docs/subagent-call-contract.md` §5("재시도 결정은 호출자(main)가
    `_retry_state.json` 으로 추적").
  - 상세: `_record_fatal`이 이 위반을 감지하지 못하는 구체적 이유(자기 `status` 값만 보고
    무조건 sentinel 을 지운다)와 그로 인한 결과(양쪽 기록에서 fatal 판정이 복구 불가능하게
    소멸)는 이미 concurrency 리뷰(2R, `review/code/2026/08/07/20_05_23/concurrency.md`)가
    실제 인터리빙으로 재현했고, `test_two_overlapping_updates_for_the_SAME_agent_lose_the_
    fatal` 캐너리로 고정되어 새로 발견한 결함은 아니다. 이번에 짚는 것은 다른 층위다 —
    **이 불변식을 지켜야 하는 쪽(main 이 sub-agent 를 fan-out 하고 `--update` 를 호출하는
    경로)은 그 계약이 존재한다는 사실 자체를 알 방법이 없다.** 세 orchestrator의 CLI
    `--update` 옵션 `help=` 문자열 어디에도 "동일 agent 에 대해 겹쳐 호출하지 말 것"이라는
    문구가 없고, 이 저장소가 sub-agent 호출 규약의 SSOT로 명시한
    `subagent-call-contract.md` §5(재시도 흐름을 정확히 다루는 절)도 이 제약을 언급하지
    않는다. 계약이 "낮은 층(공유 라이브러리 내부 함수)에만 문서화되고, 그 계약을 실제로
    지켜야 하는 높은 층(호출 순서를 결정하는 main/오케스트레이션 로직)에는 노출되지 않는"
    구조로, 의존성 역전 원칙이 요구하는 "정책은 세부구현에 의존하지 않고 계약은 경계에서
    보인다"는 방향과 반대로 놓여 있다. 현재는 "문서화된 흐름에서는 발생하지 않는다"는
    전제(에이전트 1회 호출 = `--update` 1회)로 위험이 낮게 억제돼 있지만, 그 전제가 깨지는
    것을 막는 장치가 코드에도 CLI 문서에도 없고 오직 사람이 `retry_state.py` 내부 함수
    docstring 을 읽었는지에만 의존한다.
  - 제안: `subagent-call-contract.md` §5(재시도 흐름)에 "동일 agent 이름에 대한
    `--update` 재호출은 이전 호출이 완전히 끝난 뒤에만 하라"는 한 줄을 추가하거나, 세
    orchestrator 의 `--update` argparse `help=` 문자열에 같은 제약을 반영한다. 구조적으로
    닫으려면(패치가 아니라 설계 축이라 이미 plan 에 "잔여 2"로 등록돼 있는 mtime 비교
    설계와 같은 작업으로 묶을 수 있음) `_record_fatal`이 자신이 읽은 `state` 스냅샷의
    시각과 sentinel mtime 을 비교해 "나보다 나중에 생긴 fatal 판정"이면 해제를 보류하게
    하는 편이 계약을 코드로 강제한다. 지금 당장은 문서 동기화만으로도 "몰라서 어긴다"는
    실패 모드는 닫힌다.

- **[INFO]** `_shared/retry_state.py` 가 하나의 모듈에서 서로 다른 성격의 관심사를 계속
  흡수하고 있다 — 이미 두 차례(20:05:23 아키텍처 리뷰) INFO 로 지적됐고 이번 라운드 코드
  변경분에는 구조 변화가 없어 그대로 재확인만 한다
  - 위치: `.claude/_shared/retry_state.py` 전체 — JSON CRUD(`load_state`/`save_state`,
    `:51-109`), 파일시스템 sentinel 관리(`FATAL_SENTINEL_DIR`~`_record_fatal`,
    `:112-201`), 세 orchestrator 공통 재조정 정책(`reconcile_state_with_disk`,
    `:204-247`), CLI stdout 포맷팅(`emit_summary_state`, `:250-286`), 상태 전이
    (`apply_status_update`, `:289-328`).
  - 상세: 지금은 "재시도 상태의 내구성"이라는 하나의 상위 목적으로 응집돼 있어 즉시
    분리할 이유는 없다. 다만 이번 diff 로 "디스크 기반 재도출" 축이 `agents_success`
    (리포트 파일)에 이어 `agents_fatal`(sentinel 파일)까지 두 번째로 늘었고, plan 문서
    자신이 "잔여 3"(성공 이후 sentinel 청소 안 됨)·"잔여 4"(같은 agent 겹침) 처럼 이
    영역에 후속 설계 축이 이미 대기 중임을 기록해 뒀다. 세 번째 유형의 디스크-재도출
    필드가 추가되는 시점에는 "상태 저장(store)"·"재조정 정책(reconcile policy)"·"CLI
    포맷팅(emit)" 세 축을 별도 파일로 나눌 근거가 충분해질 것이다.
  - 제안: 지금 조치 불필요. 다음에 이 파일에 디스크-재도출 축을 추가하게 되면(예: 위
    "잔여 2/4"를 닫는 `_cleared/`·mtime 비교 설계) 그 작업과 함께 모듈 분리를 재검토할
    것을 백로그에 남겨 둘 만하다.

## 긍정적으로 확인된 설계

- **Facade 로 캡슐 경계 보존**: `code_review_orchestrator.get_git_branch_diff_files`
  (`:1047-1064`)와 `consistency_orchestrator._branch_changed_rels`(`:244-257`)는 기존
  시그니처·반환 타입(list vs set)을 그대로 유지한 채 내부 구현만
  `_shared/git_probe.branch_diff_files` 로 위임한다. 각 orchestrator 내부의 다른 호출부는
  이 리팩터링을 전혀 인지할 필요가 없다 — 공유 커널을 도입하면서도 각 스킬의 기존 계약
  표면을 건드리지 않은 좋은 Facade/Adapter 적용이다.
- **레이어별로 분리된 예외 처리 정책**: `_run_git_raw`(`.claude/_shared/git_probe.py:131-179`)는
  hook 세 개(`review_guard`/`plan_guard`/`branch_guard`)가 그대로 재사용하는 원시
  프로브라 좁은 `except (TimeoutExpired, FileNotFoundError, OSError)`만 잡고, 그 위에
  놓인 `branch_diff_files`(`:200-260`)는 두 orchestrator 만을 위해 넓은
  `except Exception`을 별도로 두른다(docstring `:235-244`가 이 분리 이유를 명시). 원시
  계층의 안전성과 상위 소비자별 실패 정책을 같은 파일 안에서 함수 단위로 정확히 나눈
  설계로, 향후 세 번째 실패 정책이 필요한 소비자가 생겨도 `_run_git_raw`를 건드리지 않고
  새 래퍼 함수 하나로 확장 가능하다(OCP).
- **Strategy 로 orchestrator 별 차이 필드 주입**: `emit_summary_state(session_dir,
  extra_fields=None)`(`.claude/_shared/retry_state.py:250-286`)는 code-review(`skipped=`/
  `routing=`)와 merge-coordinator(`branches=`/`base=`)가 서로 다른 필드를 요구하는
  유일한 차이를 콜러블 파라미터로 열어, 공유 커널이 각 스킬 고유 필드를 알 필요 없이
  OCP 를 지킨다.
- **순환 의존 없는 단방향 그래프**: `git_probe.py`(외부 의존 없음) → `retry_state.py`
  (같은 패키지의 `report_paths`만 상대 import) → hook 3개 + orchestrator 3개, 로 이어지는
  의존 방향이 이번 diff 전후로 일관되게 단방향이며, `_shared` 가 역으로 hook 이나
  orchestrator 를 import 하는 지점은 없다(실측: 두 모듈의 import 문 확인).

## 요약

이번 diff 는 세 orchestrator(`code_review_orchestrator`/`consistency_orchestrator`/
`merge_coordinator_orchestrator`)에 흩어져 있던 브랜치-diff 프로브와 재시도 상태 자기치유
로직을 `.claude/_shared/` 공유 커널로 통합한 리팩터링이며, 이미 두 차례의 아키텍처
리뷰(모두 LOW)와 그 사이의 fix 커밋을 거쳐 대부분의 지적 사항(모듈 docstring 의
소비자-범위 불일치, README/SKILL.md 문서 동기화 누락, sentinel-우선-저장 순서 불변식의
테스트 부재)이 해소된 상태로 확인됐다. 남은 것은 두 가지다 — (1) "같은 agent 에 대한
겹친 `--update` 금지"라는 정합성 불변식이 낮은 층의 함수 docstring 에만 있고 그 불변식을
실제로 지켜야 하는 호출 경계(CLI help·call-contract SSOT 문서)에는 노출되지 않은 계약
배치 문제(WARNING, 이미 알려진 레이스 자체를 재발견한 것이 아니라 그 계약이 어디에
드러나야 하는지를 짚은 것), (2) `retry_state.py` 가 디스크-재도출 축을 하나씩 계속
흡수하며 책임이 늘어나는 추세(INFO, 즉각 분리 사유는 아님). 순환 의존은 없고, 세
orchestrator 간 의존 방향은 `_shared` 로만 단방향이며, Facade/Strategy/레이어별 예외
정책 분리 등 확장에 유리한 패턴이 여러 곳에서 의도적으로 적용돼 있다. 구조적 결함이나
레이어 붕괴는 발견되지 않았다.

## 위험도

LOW
