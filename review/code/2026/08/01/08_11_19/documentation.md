# Documentation Review — 2026/08/01 08_11_19

## 검증 방법 (요약보다 먼저 기록)

이번 라운드 지침("inspection 대신 measurement, 주석의 주장이 모든 배치를 커버하는지 확인")에
따라 다음을 실제로 수행했다 — 추론이 아니라 실행 결과:

- `git diff origin/main...HEAD --stat` 로 이 PR 이 실제로 건드린 파일을 특정하고, 리뷰 대상
  17개 파일 각각에 대해 `git diff`로 **정확히 어느 줄이 바뀌었는지**를 소스와 대조했다(프롬프트가
  준 것은 전체 파일 컨텍스트이지 diff 가 아니었으므로).
- 프롬프트에서 잘려 있던 5개 파일(`review_guard.py`, `guard_review_before_push.py`,
  `code_review_orchestrator.py`, `consistency_orchestrator.py`, `test_block_integrity.py`) 을
  전부 `Read` 로 직접 열어 전문을 확인했다.
- `block_integrity.summary_block_verdict()` 를 실제로 임포트해 n=1,000/4,000/16,000/32,000 줄의
  적대적 입력(`("> " * 3 + "\n") * n`, `BLOCK:` 없음)에 돌려 **선형 스케일링을 직접 측정**했다
  (아래 결과). 주석의 성능 주장을 "설계상 그럴 것"이 아니라 실측으로 확인한 것.
- `.claude/tests/` 전체 스위트를 실행해 현재 총 테스트 수(753, 전부 OK)를 확인했다.
- plan 문서가 인용한 커밋 SHA(`30cc0f738`, `5526fc8f8`)를 `git log`로 실재 확인했다.
- 5개 checker 에이전트 정의 파일(`*.md`)이 실제로 `.claude/agents/` 에 존재하는지 `ls` 로 대조했다.

측정 결과 (직접 실행):
```
n=  1000 verdict=None time=0.0001s
n=  4000 verdict=None time=0.0004s
n= 16000 verdict=None time=0.0016s
n= 32000 verdict=None time=0.0031s
```
32배 입력 증가에 시간도 약 31배 — 선형이다. `_shared/block_integrity.py`(파일 1) 의 주석과
`test_block_integrity.py`의 `VerdictParserStaysLinearTest`(라인 470-517) 가 주장하는 "O(n²) → O(n)"
수정은 지어낸 서사가 아니라 실측 가능한 사실이다.

## 발견사항

- **[INFO]** 라운드7 이 지적한 두 결함 모두 "고쳐짐"에서 그치지 않고, 그 결함의 **정확한 재발
  경로까지 주석/테스트에 남아 있다** — 문서화 관점에서 모범 사례.
  - 위치: `.claude/hooks/guard_review_before_push.py:809-840` (`_evaluate_over_targets` docstring)
  - 상세: 이전에는 `result.push_blocks` 인 순간 루프 안에서 바로 `return` 했다. 그 결과 그 target
    **이후**의 target 들은 평가되지 않고 그들의 `notes` 도 유실됐다. 지금 코드는 `blocked = render(...)`
    로 기억만 하고 루프를 끝까지 돌려 이후 target 의 advisory 도 수집한다(`.claude/hooks/guard_review_before_push.py:874-880`).
    docstring 자체가 "Which is why blocking no longer returns from inside the loop. It used to,
    and that silently dropped the notes of every target ordered *after* the first blocking one —
    a review found the gap before any test did." 라고 결함의 **정확한 모양**을 서술한다. 이는
    `.claude/tests/test_block_integrity.py:416-426` (`NotesFromLaterTargetsSurviveAnEarlierBlockTest`
    docstring: "The comment defending the feature only covered the other arrangement (the blocking
    target's *own* notes), which is why it read as complete.")과 완전히 정합한다 — 라운드8 컨텍스트가
    말한 "방어 주석이 거울상 케이스만 커버해 완전해 보였다"는 서술 그 자체가 지금 코드 안에 자기
    설명으로 남아 있다.
  - 제안: 없음(이미 해결·문서화·회귀 테스트 완비). 향후 유사 "per-target fail-open 루프"를 작성할
    reviewer 를 위한 참고 사례로 유지 권장.

- **[INFO]** O(n²) 정규식 결함도 같은 수준으로 투명하게 문서화되어 있고, 위에서 직접 측정해
  성능 주장이 사실임을 확인했다.
  - 위치: `.claude/_shared/block_integrity.py:60-81` (`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`
    위 주석 + 정규식 정의)
  - 상세: `[ \t…]` 를 `[\s…]` 대신 쓴 이유, `re.MULTILINE` 에서 `\s` 가 개행을 먹어 줄 경계를
    넘나들며 매 줄 시작에서 워크를 재시도하던 메커니즘, 그리고 n=1000~16000 에서 4배 스케일링
    측정치(0.027s→5.375s)까지 주석에 남아 있다. 위 "검증 방법"에서 재현 측정한 결과와 일치한다.
    같은 결함 클래스가 회귀하지 않도록 `test_block_integrity.py:470-517`
    (`VerdictParserStaysLinearTest`) 가 서브프로세스+timeout 으로 고정하고 있으며, 그 이유
    ("backtracking 은 CPython C-level `re` 안에서 일어나 시그널이 안 닿는다")도 정확하다.
  - 제안: 없음.

- **[INFO]** 자기 정정(self-correcting) 주석 — 이전 라운드의 잘못된 서술을 숨기지 않고 그대로
  남겨 "무엇이 왜 틀렸는지"를 기록한 사례가 2건 있고, 둘 다 사실관계를 재확인했다.
  - 위치 1: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:91-100`
    (`_load_state` 위 블록 주석). "`_apply_status_update` 를 '다르다'고 적었던 첫 서술은 틀렸다 —
    AST 차이가 이름 접두뿐인데 정규화를 안 하고 발산으로 읽었다." → 실제로 코드를 보면
    `_apply_status_update` 는 완전히 위임되어 동일하고, `_emit_summary_state` 만 `branches`/`base`
    필드를 다루어 실제로 다르다(라인 113-125). 주석의 정정 내용이 코드와 일치함을 확인했다.
  - 위치 2: `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 10 — "docstring 은 이번에
    정정했다. 종전 서술이 '버킷들은 디스크에서 재도출된다' 로 읽혀 보장 범위를 과대하게 주장하고
    있었다." → `.claude/_shared/retry_state.py:59-74` (`save_state` docstring) 를 직접 대조한 결과,
    실제로 `agents_success` 만 매번 재도출되고 `agents_fatal`/`agent_history`/
    `rate_limit_episodes`/`last_reset_hint_sec` 은 lost-update 에 취약하다고 정확히 구분해
    서술한다. 과장 없음.
  - 제안: 없음 — 오히려 반대 패턴(과거 실수를 지우고 새 설명만 남기는 것)보다 이 방식이 향후
    reviewer 가 "왜 이렇게 됐는지"를 추적하는 데 유리하다.

- **[INFO]** 테스트 docstring 안의 절대 테스트 개수 인용(`735`, `738`)은 라운드 시점의 스냅샷이며
  현재 총 개수(753, 직접 실행 확인)와 다르다.
  - 위치: `.claude/tests/test_block_integrity.py:337-339` ("Deleting the collection block in
    `_evaluate_over_targets` left all 735 tests GREEN"), 같은 파일 645-646 ("removing `tuple(notes)`
    from the returns left all 738 GREEN")
  - 상세: 이 저장소는 "측정한 사실을 그대로 남긴다"는 관례가 강하고(`732`/`400`/`24` 등 다른 곳의
    인용도 전부 이 방식), 이 두 숫자도 뮤테이션을 시도했던 **그 시점**의 전체 스위트 크기를 가리키는
    증거이지 "현재 스위트 크기가 735/738"이라는 불변식 주장이 아니다. 실행해 보면 현재는 753개이고
    전부 통과한다. 코드/논리 결함은 아니며, 이 저장소의 기존 관례(정확한 시점 측정치 인용)와도
    일치하므로 심각도는 매우 낮다 — 다만 신규 reviewer 가 "735/738"을 현재 스위트 크기로 오독할
    여지는 있다.
  - 제안: 조치 불요(정보 제공 목적). 굳이 손댄다면 "당시(그 뮤테이션을 처음 시도한 라운드) 스위트
    전체"라는 시점 표현을 한 단어만 추가해도 됨.

- **[INFO]** `code_review_orchestrator.collect_change_infos` 의 `--branch` > `--files`(positional)
  우선순위 결함은 **이 PR 의 diff 범위 밖**(git diff 로 확인: 이 함수는 origin/main 대비 변경 없음)
  이고, 이미 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 11 에 재현 실험표·원인
  (`if/elif` 체인에서 `--branch` 분기가 `--files` 보다 먼저)·최소 조치안까지 상세히 기록되어 있다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 의
    `collect_change_infos` (`elif args.branch:` / `elif args.files:` 분기, 이번 diff 미포함) —
    문서화는 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 11
  - 상세: 코드 자체에는 이 알려진 함정에 대한 인라인 주석이 없다(plan 문서에만 있음). 이 PR 이
    만든 회귀는 아니고 이미 올바른 위치(plan)에 추적되고 있으므로 새 발견으로 보고하지 않고
    참고용으로만 남긴다.
  - 제안: 해당 함수를 실제로 고치는 PR 에서는 plan 항목의 "최소 조치"(두 옵션이 함께 오면 `--files`
    우선 + 무시되는 쪽 stderr 경고) 를 적용할 때, `elif` 체인 옆에도 한 줄 인라인 주석을 남겨 이
    우선순위가 의도적 설계가 아니라 알려진 함정임을 코드 레벨에서도 알 수 있게 할 것.

- **[INFO]** README/카탈로그 동기화 — 신규 테스트 파일 2개(`test_block_integrity.py`,
  `test_retry_state_shared.py`)가 `.claude/tests/README.md` 의 "What's covered" 표에 각각
  누락 없이 추가되었고, 서술 내용(732 세션·24 건·3.3%, AST 비교·154 vs 113 줄 등)이 실제 코드/
  docstring 의 수치와 일치함을 대조 확인했다. `.claude/skills/consistency-checker/SKILL.md` 와
  `.claude/agents/consistency-summary.md` 의 하향-금지 경고 관련 서술도 서로, 그리고
  `review_guard.py`/`block_integrity.py` 의 실제 동작(경고는 오직 `--impl-done` 세션이 게이트에
  채택될 때만 발화)과 정합한다.
  - 위치: `.claude/tests/README.md` (test_block_integrity.py·test_retry_state_shared.py 행),
    `.claude/skills/consistency-checker/SKILL.md`, `.claude/agents/consistency-summary.md`
  - 제안: 없음 — 정합성 확인 완료.

## 확인했으나 문제 없음 (참고)

- 신규 환경변수/설정 옵션 없음(diff 전체에서 `os.environ.get`/`os.environ[` 신규 추가는 테스트
  전용 `FAKE_NOTE` 1건뿐 — 실 설정이 아님) → 설정 문서 갱신 불요.
- `spec/` 변경 없음(순수 `.claude/` 하네스 변경) → 제품 spec 문서 갱신 대상 아님.
- API 엔드포인트 변경 없음(REST API 가 아니라 훅/오케스트레이터 내부 로직) → API 문서 갱신 불요.
- `plan/in-progress/harness-review-gate-ci-backstop.md` 최상단 진행 요약 표가 이번 라운드
  처분(§관측(1) 전제 반증/§관측(2) 수정 완료/CI 백스톱 미착수)을 정확히 반영하고, 인용된 커밋 SHA
  (`30cc0f738`, `5526fc8f8`) 둘 다 `git log` 로 실재를 확인했다 — 변경 이력(이 저장소의
  CHANGELOG 대응물) 기록 상태 양호.
- `.claude/_shared/__init__.py` (패키지 목적 docstring) 는 이번 PR 이 건드리지 않았고, 기존에도
  하위 모듈 인덱스를 두지 않는 관례였으므로 새 모듈 2개(`block_integrity.py`, `retry_state.py`)
  추가가 관례 이탈은 아니다.

## 요약

이번 PR 은 문서화 관점에서 매우 높은 수준을 보인다. 라운드7 이 발견한 두 실제 결함(검증 정규식
O(n²), push 대상 루프의 조기 return 으로 인한 advisory 유실) 모두 수정되었을 뿐 아니라, "무엇이
왜 틀렸었는지"를 코드 주석과 테스트 docstring 양쪽에 서로 정합하게 남겨 재발 방지 근거로
기능한다 — 이는 직접 벤치마크와 전체 테스트 스위트 실행으로 확인했다. 자기 정정형 주석 2건도
과거 실수를 지우지 않고 정확한 정정 내용을 남겼으며 실제 코드와 대조해 정확함을 확인했다. 발견된
항목은 전부 INFO 수준으로, 실제 결함이 아니라 향후 참고를 위한 관찰(테스트 개수 인용의 시점성,
이 diff 범위 밖의 기존 알려진 함정)이다. README/SKILL.md/plan 문서/에이전트 정의 파일 간의
상호 참조도 전수 대조해 불일치를 찾지 못했다.

## 위험도

NONE
