# RESOLUTION — 5R (harness-block-backstop)

리뷰어 14/14 성공. **CRITICAL 2 / WARNING 20 / INFO 32.**

CRITICAL 2건은 서로 다른 리뷰어가 같은 결함을 본 것이고, 그 결함은 **4R 에서 내가 넣은
수정(W4 스로틀)** 이다. 총 5명이 독립 지적했다.

## CRITICAL — Stop 훅 스로틀이 텍스트가 아니라 인덱스로 키잉 (documentation, testing)

`_marker_path(session_id, token, f"note{idx}")` 의 `idx` 는 `enumerate` 위치다. 그런데
바로 위 내 주석은 "The marker keys on the note text, so a DIFFERENT contradiction still
gets through" 라고 **정반대**를 단언하고 있었다.

`notes` 는 최대 1개다(게이트가 채택한 세션 하나만 보고한다) → `idx` 는 항상 0.
따라서 한 브랜치에서 처음 뜬 하향 경고 이후로는 **다른 세션·다른 checker·완전히 다른
문구의 하향 경고가 전부 영구히 억제**된다. 리뷰어 둘 다 서브프로세스로 재현했다:

```
RUN1 note="SESSION-A: …"  → stderr 에 출력
RUN2 note="SESSION-B: …"  → stderr 완전히 빈 상태 (억제됨)
```

이 PR 의 존재 이유가 "하향이 조용히 게이트를 통과하는 것을 막는다" 인데, 그 실패 모드를
정작 막으려는 기구 안에서 재현했다. push 하드 게이트는 무영향(`_report_notes` 는 스로틀이
없다) — Stop 넛지 한정이다.

**처분: 수정.** 마커 키를 노트 텍스트의 sha1 앞 12자로 바꿨다. 회귀 테스트는 두 축을 모두
고정한다 — 같은 문구 2회 → 2번째 억제 / **다른 문구 2회 → 2번째도 출력**.

> 왜 아무도 못 잡았나: 스위트 전체에 **훅을 두 번 호출하는 테스트가 하나도 없었다**.
> 스로틀은 정의상 2회차에만 관측되는 동작인데, 1회만 부르는 테스트로 "고쳤다" 고 적었다.

## WARNING — 처분한 것

| # | 내용 | 처분 |
|---|---|---|
| W15 | `summary_block_verdict()` 가 END-모양 매치 중 **첫 번째**를 채택 — "가장 나중" 이 아니라 "가장 먼저" 가 이긴다 | 수정 (`finditer`→`[-1]`) |
| W16 | `NotesReachBothHooksTest._CLEAN_PLAN` 스텁이 `push_blocks` 를 빠뜨려, 테스트가 ALLOW 경로가 아니라 **PLAN 게이트 크래시→fail-open** 경로로 통과 | 수정 + `assertNotIn("Traceback")` 로 통과 이유를 고정 |
| W17 | `contradiction_note()` 의 포맷팅(`.md` 제거·정렬·`name=count` join)에 단언 없음 | 단언 4개 추가 |
| W18 | merge-coordinator `--summary-state` 무테스트 (이 PR 이 위임을 바꾼 경로) | 테스트 2개 추가(정상 + state 파일 부재 시 exit 1) |
| W5 | `save_state` docstring 이 "버킷들은 디스크에서 재도출된다" 로 읽혀 보장 범위 과대주장 | **정정** — 재도출되는 건 `agents_success` 뿐. `agents_fatal` 은 메모리 값 필터링이라 유실 시 복구 불가 |
| W6 | `Outcome` docstring 이 신규 `notes` 미기술 | 추가 (4번째 상태가 아님을 명시) |
| W7 | `_evaluate_over_targets` docstring 이 3번째 책임 미기술 | 추가 |
| W8 | `review_guard` 모듈 docstring(Policy) 이 backstop 미언급 | 추가 (차단 조건이 아님을 명시) |
| W9 | `test_consistency_orchestrator_state.py` + README 가 이 PR 이 없앤 "중복" 을 현재형으로 서술 | 양쪽 갱신 |

## WARNING — 후속 등재 (plan 에 기록, 이 PR 밖)

| 내용 | 사유 |
|---|---|
| `agents_fatal` 도 디스크에서 재도출하도록 `<name>.fatal` sentinel 도입 | **새 설계** — 이 브랜치가 지켜온 "다른 skill 의 동작 변경은 분리" 관행. plan §후속 10 |
| `notes` 가 정본 `Outcome` + 손으로 짠 fallback shim 2개에 흩어짐 | 구조 리팩터. `_lib` 네임스페이스 충돌 해소가 선행 |
| `_retry_state.json` lost update (잠금 없음) | plan §후속 10 — **종전에 등재했다고 여겼으나 실제로 plan 에 없었다.** 이번에 등재 |
| `review/consistency/` 전수 순회 비용 | 실측 +0.39초. 채택 세션만 보도록 이미 좁혀둠 |

## 검증

- harness 스위트 **749 tests OK** (5R 착수 시 743 → 신규 6).
- mutation 3종 전부 RED:
  - `[M1 인덱스 키잉으로 회귀]` FAILED — 원 결함 재현이 잡힌다
  - `[M2 마지막→첫 매치 회귀]` FAILED — *1차 시도에선 GREEN 이었다.* 동률 케이스 테스트가
    없어서였고, 회귀 테스트 2개를 추가한 뒤에야 RED
  - `[M3 _CLEAN_PLAN 에서 push_blocks 제거]` FAILED — vacuous 재현이 잡힌다

## 스스로 정정한 것

W15 를 고치며 docstring 에 "revision 은 문서 아래쪽에 쓰이므로 마지막이 진짜" 라고 적었는데,
**실측된 유일한 override 사례(`review/consistency/2026/07/17/00_17_40`)는 최종 판정이 위에
있다.** 실제 판별자는 END 앵커이고 last-rule 은 앵커가 못 가리는 동률만 처리한다. 코퍼스가
뒷받침하는 것과 내 판단인 것을 갈라 docstring 을 다시 썼다. 코퍼스 1,504개 SUMMARY 실측:
END 모양 2개 이상 = 2건, first→last 로 판정이 뒤집히는 것 = **0건**.
