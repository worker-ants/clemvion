# Requirement Review — 8R

## 발견사항

- **[CRITICAL]** `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 에 라운드 7 이 못 닫은 **별도의, 실측 확인된 O(n²)** 가 남아 있다 — 같은 파일, 같은 라운드-7 "고정" 대상, 같은 hot path.
  - 위치: `.claude/_shared/block_integrity.py:80` (`_BLOCK_AT_LINE_START`), `.claude/_shared/block_integrity.py:83` (`_BLOCK_AT_LINE_END`) — 두 패턴이 공유하는 `BLOCK:\s*\**\s*(YES|NO)` 서브패턴.
  - 상세: 라운드 7 커밋(`5526fc8f8`)은 **선두** 문자 클래스(`[\s>#*_`-]*` → `[ \t>#*_`-]*`)의 개행-교차 이차 스캔만 고쳤다. 그런데 두 정규식 모두 "BLOCK:" 리터럴 **바로 뒤, `(YES|NO)` 바로 앞**에 `\s*\**\s*` — 즉 같은 문자집합(`\s`)에 대한 두 개의 인접 quantifier 가 통상 폭 0 인 `\**` 하나만 사이에 두고 이어진 형태 — 를 그대로 갖고 있다. `\**` 가 실제로 소비할 `*` 문자가 없을 때(공백/개행만 있을 때) 이 서브패턴은 `\s*\s*` 와 동치가 되고, 이는 교과서적인 "인접 동일-클래스 quantifier" 파국적 백트래킹 형태다. 직접 벤치마크(서브프로세스 격리, `/private/tmp/.../scratchpad/req_reviewer_bisect.py` 로 실행 — 커밋 메시지가 자인하듯 in-process 타이밍은 신뢰 불가하므로):

    ```
    text = "BLOCK:" + (" " * n)   # 그 뒤 YES/NO 전혀 없음 — 순수 공백만
    n        200      400      800     1600     3200     6400    12800
    t     0.0008s  0.0026s  0.0110s  0.0406s  0.1718s  1.5167s  6.0379s   (≈ ×4/doubling)
    ```
    n=100,000 은 50 초 넘게 끝나지 않아 강제 종료했다(2차식 외삽 시 ≈166s와 부합). `_BLOCK_AT_LINE_END`/`_BLOCK_AT_LINE_START` 를 개별 `.search()` 로 격리해도 동일 배율로 재현되고(n=3200 에서 각각 0.138s/0.145s), 순수 공백 대신 "BLOCK:" + 개행 6,400개(더 자연스러운 마크다운 형태)로도 0.607s — 같은 결함이다. 대조로 **꼬리쪽** `\**\s*$`(`(YES|NO)` 뒤)는 진짜 quantifier 가 하나뿐이라 선형임을 확인했다(`"BLOCK: YES" + " "*6400 + "x"` → 0.0001s) — 즉 결함은 **선두쪽 `\s*\**\s*` 만**의 문제로 정확히 국한된다.

    이 서브패턴은 라운드 7 이 아니라 **라운드 2**(`780e0837e`, `_BLOCK_AT_LINE_START`/`_END` 신설)부터 있었고 라운드 2~7 을 통과해 지금까지 살아 있었다 — 즉 라운드 7 이 "같은 클래스의 결함을 처음 잡은 라운드" 라는 서사와 정확히 같은 성격의, **아직 못 잡은** 잔여 결함이다. 이 경로는 `evaluate_review()`(`.claude/hooks/_lib/review_guard.py:906`) → `_newest_resolved_impl_done_mtime`(`:729`) → `_summary_block_is_no`(`:710`) → `block_integrity.summary_block_verdict` 로 이어져 **spec-linked 변경이 있는 모든 push 와 모든 턴-종료**에서, `--impl-done` 세션인 `review/consistency/**/SUMMARY.md` 전량에 대해 동기 실행된다. 이 저장소는 이미 `review/` 아래 14,517개 파일을 추적 중이라(`plan/in-progress/harness-review-gate-ci-backstop.md` §후보) 그중 단 하나가 "BLOCK:" 뒤 우연히/사고로 긴 공백·개행 런을 담고 있으면(코드 블록 인용, 표 정렬, 잘린 출력 등 — 악의적 조작 불필요) 그 시점부터 **모든** push/턴종료가 몇 초~몇 분 멈추고, 훅이 타임아웃하면 fail-open 되어 이 PR 이 강화하려는 게이트를 정반대로 우회한다 — 라운드 7 자신의 module docstring(`:69-74`)이 정확히 이 결과를 "훅이 타임아웃에 걸리면 fail-open 되므로 이 PR 이 강화하려는 게이트가 정반대로 우회된다" 라고 서술한 바로 그 실패 모드다.
    실측으로 현재 커밋된 735개 `review/consistency/**/SUMMARY.md` 전체를 이 함수로 파싱해 봤는데(총 0.038s, 최장 개별 파일 0.4ms) 지금 당장 터지는 파일은 없다 — 이 결함은 **잠재적**이지 실측 가능한 현재 장애는 아니다. 다만 그건 방어 부재를 정당화하지 않는다: 라운드 7 의 원 결함도 "관측된 장애" 가 아니라 "적대적 입력에 대한 실측" 만으로 CRITICAL 판정됐고, 여기 적용된 근거(핫패스·무제한 크기·fail-open 시 게이트 우회)는 완전히 동일하다.
  - 제안: `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 의 선두 `\s*\**\s*` 를 "같은 문자집합에 대한 두 개의 독립 quantifier" 구조가 아니게 재구성 — 예컨대 `\s*(?:\*+\s*)?` 처럼 asterisk 런의 유무로 분기를 하나로 합쳐 두 `\s*` 가 같은 구간을 나눠 갖는 모호성 자체를 없앤다(이 저장소는 `re` possessive/atomic 을 쓰지 않는 하위호환 python3 를 전제하므로 `*+`/`(?>...)` 보다 구조 재작성 쪽이 안전). 수정 후 기존 방식대로 커밋된 1,506(consistency 732)개 SUMMARY 전수 재검증(verdict 불변 확인) + `test_block_integrity.py::VerdictParserStaysLinearTest` 에 "`BLOCK:` 리터럴이 실제로 존재하되 그 뒤로 긴 순수 공백/개행 런이 이어지고 YES/NO 는 끝내 없음" 케이스를 서브프로세스+하드 타임아웃으로 추가(현재 테스트는 "BLOCK: 자체가 전혀 없는" 케이스 1개만 고정하고 있어 이 배치를 놓친다).

- **[INFO]** (검증 완료, 조치 불요) 라운드 7 의 결함 (b) — `_evaluate_over_targets` 의 조기 `return` 이 뒤 target 들의 notes 를 버리던 문제 — 는 완전하고 정확하게 수정돼 있다.
  - 위치: `.claude/hooks/guard_review_before_push.py:809-883` (`_evaluate_over_targets`).
  - 상세: 현재 구현은 `blocked` 를 지역 변수로 기억만 하고(`if result.push_blocks and blocked is None: blocked = render(...)`) 루프를 끝까지 완주한다(`:874-880`) — 차단 이후의 target 들도 계속 순회되어 `notes` 수집(`:864-873`)이 이어지고, 첫 차단 target 이 메시지만 결정한다. 전용 회귀 테스트(`test_block_integrity.py::NotesFromLaterTargetsSurviveAnEarlierBlockTest`, 실제 `_evaluate_over_targets` 를 구동)와 하네스 스위트 전체(753 tests, 재실행 결과 90.6s 전부 OK)로 확인. `_run_gates` 가 REVIEW 차단 시 PLAN 게이트를 아예 실행하지 않는 것(그래서 PLAN 쪽 notes 는 구조적으로 못 모음)은 별개의, 사전에 인지되고 문서화된(`.claude/hooks/_lib/failopen_state.py:106-113` 의 v2 회고) 설계이지 이번 fix 의 사각지대가 아니다 — "댓글이 함의하는 모든 배치를 커버하는지" 기준으로 봐도 이건 다른 축(게이트 간 순서)이라 (b) 의 재발이 아니다.
  - 제안: 해당 없음 — 기록 목적.

- **[INFO]** (검증 완료) 라운드 7 이 실제로 고친 메커니즘(선두 문자 클래스가 `re.MULTILINE` 의 `^` 와 맞물려 줄마다 재스캔)은 그 자체로는 올바르고 완전하다.
  - 위치: `.claude/_shared/block_integrity.py:79-84`.
  - 상세: 커밋 메시지가 제시한 정확한 재현(`("> " * 3 + "\n") * n`, n=1000..16000)을 독립적으로 재실행 — n=16000 에서 0.0016s, 선형(위 CRITICAL 항목의 표와 달리 ×4/doubling 이 아니라 거의 배수 그대로 증가). `#`\`_-` 혼합 문자로도, tab 문자로도 선형 유지. `test_block_integrity.py::VerdictParserStaysLinearTest`(20,000줄, subprocess+5s 하드 타임아웃)도 통과. 다만 이 테스트/주석의 "must not go quadratic on adversarial input" 이라는 일반화된 문구는 위 CRITICAL 항목이 보여주듯 실제로는 "이 한 가지 배치에서" 만 참이다 — 댓글의 주장 범위와 실제로 닫힌 범위 사이의 간극이 그 항목의 핵심이다.
  - 제안: 해당 없음 — 기록 목적. (위 CRITICAL 항목의 제안이 이 테스트 확장까지 포함.)

- **[INFO]** spec fidelity — 이 변경 영역(`.claude/`)은 `spec/` 문서가 아니라 `.claude/agents/consistency-summary.md` §요약 지침 3·4, `.claude/skills/consistency-checker/SKILL.md` §4, 그리고 `plan/in-progress/harness-consistency-summary-downgrade-rule.md`(2026-07-31 종결)가 사실상의 계약이다. 세 문서와 `block_integrity.py`/`review_guard.py` 구현을 line-level 로 대조한 결과 불일치 없음 — "하향 금지 + 상향만 허용", "권한 밖 Critical 은 §planner 인계 표로, BLOCK: YES 유지", "체커 명단은 `block_integrity.ALL_CHECKERS` 에서 파생"이 모두 문서·코드 양쪽에서 일치.
  - 위치: `.claude/agents/consistency-summary.md:44-61`, `.claude/skills/consistency-checker/SKILL.md:113-127`, `.claude/_shared/block_integrity.py:86-97`.
  - 상세: 관련 spec 은 없음(harness 내부 자동화 영역이라 `spec/`  범위 밖) — 위 3개 문서가 대체 SoT 이며 대조 결과 정합.
  - 제안: 해당 없음.

## 요약

라운드 8 관점에서 라운드 7 이 고친 두 결함을 각각 재현·재검증했다. (b)(`_evaluate_over_targets` 의 조기 return 이 뒤 target 의 notes 를 버리던 문제)는 완전하고 정확하게 수정됐고 전용 테스트로 고정돼 있다 — 추가 조치 불요. (a)(판정 파서 O(n²))는 커밋이 주장한 **그 배치**(선두 문자 클래스가 개행을 넘던 경로)에 한해서는 올바르게 고쳐졌지만, **직접 벤치마크한 결과** 같은 두 정규식이 공유하는 또 다른 서브패턴(`BLOCK:` 리터럴 바로 뒤의 `\s*\**\s*`)에 **독립적인 O(n²) 이 그대로 남아 있음**을 확인했다 — n=12,800(≈13KB, "BLOCK:" 뒤 순수 공백뿐인 지극히 평범한 형태)에서 이미 6초, n=100,000 에서는 50초 넘게 끝나지 않았다. 이 경로는 라운드 7 이 고친 것과 정확히 같은 hot path(`evaluate_review()`, 모든 push·턴종료)이고 같은 결과(훅 타임아웃 → fail-open → 이 PR 이 강화하려는 리뷰 게이트의 실질적 우회)를 낳는다. 현재 커밋된 735개 실제 SUMMARY.md 전량을 실측했을 때는 아무것도 이 경로를 건드리지 않아(총 0.038초) 당장의 장애는 아니지만, 그 방어 부재를 정당화하지는 못한다 — 라운드 7 자신이 "적대적 입력에 대한 실측만으로" CRITICAL 을 인정한 선례와 근거가 동일하다. 이 결함은 실제로는 라운드 2(`780e0837e`)부터 존재해 라운드 2~7 을 통과해 왔고, 두 리뷰어가 "형태 검사"로 통과시켰던 것과 같은 방식으로 이번에도 형태만 봤다면 놓쳤을 것 — 벤치마크로만 드러났다. 그 외 하네스 위생(체커 명단 파생, plan 문서 자기-카운트 정정, PlanStubs 대칭 커버리지, forward-reference 정리 등)은 전부 확인한 범위에서 정확했고 TODO/FIXME 류 미완성 표식은 diff 전체에서 없었다. 하네스 스위트 753개 테스트는 재실행 결과 전부 green(90.6s).

## 위험도

HIGH
