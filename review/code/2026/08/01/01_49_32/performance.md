# 성능(Performance) Review

## 검토 방법

`git diff origin/main...HEAD` (source 15개 파일 + review 세션 아티팩트 다수) 전체를 대상으로 하되,
실질 실행 코드가 있는 `.claude/_shared/*.py`, `.claude/hooks/**/*.py`,
`.claude/skills/**/scripts/*.py`, `.claude/tests/*.py` 에 집중했다. 프롬프트에서 잘린 대형 파일은
`Read`/`git show`/`git diff origin/main...HEAD --stat`로 직접 열어 실제 소스 줄 번호를 확인했다.

이 worktree 는 이미 두 차례 독립 성능 리뷰(`review/code/2026/08/01/00_33_34/performance.md` NONE,
`review/code/2026/08/01/01_17_35/performance.md` LOW)를 거쳤고, 그 사이 5R 수정 커밋
(`7dd4ad8c7`, "4R 에서 넣은 스로틀이 하향 경고를 영구히 삼키던 CRITICAL" 수정)이 반영됐다. 이번
라운드는 그 결론을 그대로 옮기지 않고, `7dd4ad8c7`가 실제로 건드린 코드를 다시 읽고 이 저장소에서
직접 함수를 호출해 실측치를 재현했다.

## 발견사항

- **[INFO]** `summary_block_verdict()`의 동률 처리 방식이 조기종료 `.search()`에서 전량 스캔
  `finditer()` + 마지막 채택으로 바뀜 — 실측상 회귀 없음
  - 위치: `.claude/_shared/block_integrity.py:117-120` (`summary_block_verdict`)
  - 상세: 5R 수정 전에는 `_BLOCK_AT_LINE_END.search(text)`로 첫 매치에서 조기 종료했지만, 이제는
    `list(_BLOCK_AT_LINE_END.finditer(text))`로 문서 전체를 스캔해 모든 매치를 모은 뒤
    `matches[-1]`(마지막 매치)을 채택한다. 이는 "동률일 때 텍스트상 첫 번째가 아니라 마지막이
    이겨야 한다"는 실제 결함(5R CRITICAL과 함께 처리된 W15)을 고치기 위한 의도적 변경이며, 알고리즘
    복잡도 등급 자체는 바뀌지 않는다(둘 다 O(문서 길이) 단일 패스 정규식 스캔 — 매치가 없거나 끝에
    있는 경우 `search()`도 사실상 전체를 스캔해야 하고, `SUMMARY.md`는 "수 KB" 수준으로 작다). 직접
    재현: 이 저장소의 `_newest_resolved_impl_done_mtime()`(이 함수를 세션마다 반복 호출하는
    호출부)을 현재 상태로 실행한 결과 0.0672초로, 5R 이전 두 라운드가 측정한 0.0804초/0.061~0.098초
    범위와 사실상 동일하다 — 측정 가능한 회귀가 없다.
  - 제안: 없음(현행 유지). 정확성을 위한 정당한 트레이드오프이고 비용은 잡음 수준.

- **[INFO]** Stop 훅의 note 중복억제 키가 `enumerate` 인덱스에서 note 텍스트의 `sha1` 다이제스트로
  바뀜 — 추가 비용은 무시 가능
  - 위치: `.claude/hooks/guard_review_before_stop.py:380-382`
  - 상세: 5R CRITICAL 수정으로 `marker = _marker_path(session_id, token, f"note{idx}")`가
    `digest = hashlib.sha1(note.encode("utf-8")).hexdigest()[:12]` 후
    `marker = _marker_path(session_id, token, f"note{digest}")`로 바뀌었다. `decision.notes`는
    "게이트가 채택한 세션 1건"만 담으므로(`.claude/hooks/_lib/review_guard.py:729-771`) 실제로는
    최대 1개 문자열에 대해 짧은 문자열 해시 1회를 추가로 계산하는 정도이며, 이는 이 CRITICAL(다른
    하향 경고가 영구히 억제되던 결함)을 고치기 위해 반드시 필요한 변경이다. 성능 영향은 없다.
  - 제안: 없음.

- **[INFO]** 5R 회귀 테스트(`StopThrottleKeysOnTextTest`)가 훅 프로세스를 테스트당 2회 구동 —
  harness 테스트 스위트 실행 시간은 늘지만 프로덕션 경로와 무관한 정당한 비용
  - 위치: `.claude/tests/test_block_integrity.py:416-478` (`StopThrottleKeysOnTextTest`, 특히
    `setUp`의 `shutil.copytree`와 `_run()`의 `subprocess.run` — 두 테스트 메서드가 각각 `_run()`을
    2회씩 호출)
  - 상세: 이 CRITICAL이 그동안 잡히지 않은 이유 자체가 "스위트 전체에 훅을 두 번 호출하는 테스트가
    하나도 없었다"는 것이었으므로, 고치는 테스트는 구조적으로 훅 프로세스를 최소 2회 구동해야
    한다. 직접 실측(`python3 -m unittest discover -s .claude/tests -p 'test_block_integrity.py'`):
    5R 이전 라운드가 측정한 23 tests / 0.168초 대비 지금은 **29 tests / 0.780초**로 늘었고, 신규
    클래스 2개 테스트만 별도로 돌리면 0.508초(전체 증가분의 대부분)를 차지함을 확인했다 —
    `copytree`(훅 디렉터리 전체 복사, 테스트 메서드당 1회) + 서브프로세스 파이썬 인터프리터 기동
    (테스트당 2회, 총 4회)이 원인이다. harness 전체 스위트는 749 tests / 63.4초(직접 실행해
    재확인, 커밋 메시지의 "749 tests OK"와 일치)로 이미 서브프로세스 기반 격리 테스트가 대부분을
    차지하는 구조라 이 증가분이 스위트 성격을 바꾸지는 않는다.
  - 제안: 없음(현재로선 조치 불요) — 다만 앞으로 이런 "훅 2회 구동" 류 회귀 테스트가 더 늘어나면
    `setUp`의 `copytree`를 클래스 스코프(`setUpClass`)로 공유하는 최적화를 고려할 수 있다(현재는
    각 클래스가 독립적으로 훅 디렉터리를 손보는 스텁을 주입하므로 공유가 항상 안전하지는 않음 —
    우선순위 낮음).

- **[INFO]** (참고 — 이번 diff가 만들거나 악화시키지 않음) `review/**` 전수 `os.walk` 스캔은 여전히
  세션 수에 비례하는 O(N)이고 매 `git push`·매 turn-end 마다 실행 — 오늘 하루 동안만도 코퍼스가
  추가로 늘었지만 절대 시간은 안정적임을 재확인
  - 위치: `.claude/hooks/_lib/review_guard.py:689-697`(`_iter_consistency_summaries`),
    `:400`(`_iter_summaries`), `:535`(`_newest_resolved_review_mtime`),
    `:729-771`(`_newest_resolved_impl_done_mtime` — 이번 diff가 `notes` 파라미터와
    `contradiction_note()` 호출을 얹은 함수, 다만 그 안의 `os.walk` 루프 자체는 origin/main 대비
    변경되지 않음 — `git diff origin/main...HEAD` 헝크 확인 결과 `_iter_consistency_summaries`
    본문은 diff에 전혀 등장하지 않는다)
  - 상세: 이 관찰은 앞선 두 라운드(`00_33_34`, `01_17_35`)가 이미 독립적으로 지적했고
    (`01_17_35`는 WARNING), `plan/in-progress/harness-review-gate-ci-backstop.md`의 5R
    "후속 등재" 표에도 "`review/consistency/` 전수 순회 비용 | 실측 +0.39초. 채택 세션만 보도록
    이미 좁혀둠"으로 명시적으로 기록돼 추적 중이다. 이번 라운드에 직접 재측정한 결과: 이
    worktree의 실제 세션 디렉터리 수가 앞선 라운드 측정 시점(consistency 732 / code 769) 대비
    이미 consistency 767 / code 850으로 늘었음에도(같은 날 반복된 리뷰 라운드 자체가 세션을
    계속 만들어내는 구조이기 때문), `_iter_consistency_summaries` 0.0222초 /
    `_newest_resolved_impl_done_mtime` 0.0672초 / `_iter_summaries` 0.0257초 /
    `_newest_resolved_review_mtime` 0.1599초 / `evaluate_review()` 전체 0.1009초로, 앞선
    두 라운드의 측정치(각각 0.0225s/0.0804s, 0.0203s/0.1351s, ~0.095~0.11s)와 사실상 동일한
    범위다. 즉 "성장 추세가 실재한다"는 이전 판단은 유효하지만, 오늘 하루의 증분만으로는 아직
    체감 가능한 변화가 없다. 이번 5R 커밋 자체는 이 스캔 로직을 한 줄도 바꾸지 않았다(신규
    `notes`/`contradiction_note` 배선은 루프가 이미 찾아낸 단일 `best_dir`에 대해서만 실행되도록
    이미 스코프가 좁혀져 있고, 이 성질은 `test_block_integrity.py`의
    `GateSurfacesTheContradictionTest.test_only_the_session_the_gate_adopts_is_checked`로
    회귀 고정돼 있다).
  - 제안: 이번 PR 범위에서 조치 불요(이미 계획 문서에 후속 항목으로 등재됨, 새로 지적할 필요
    없음). 세션 수가 한 자릿수 더 늘어나는 시점에는 "채택 후보 세션의 식별자/타임스탬프 캐싱"
    또는 "디렉터리명 내림차순 정렬 후 첫 적격 세션에서 조기 종료" 같은 인덱싱을 고려할 가치가
    있다는 기존 권고를 유지한다.

## 그 외 점검 관점 — 새로운 문제 없음

- **N+1 쿼리/호출**: 해당 코드에 DB/외부 API 호출이 없다. `SUMMARY.md`가 게이트 1회 평가당 채택된
  세션 1건에 한해 두 번 읽히는 기존 "1+1" 중복(`review_guard.py:713-715`의
  `_summary_block_is_no` 내부 읽기와 `block_integrity.py:130`의 `downgraded_criticals` 내부
  재읽기)은 5R 이전부터 있었고 이번 diff로 새로 생기거나 악화되지 않았다.
- **메모리 할당**: `finditer()`로의 전환이 매치 리스트를 메모리에 적재하지만 `SUMMARY.md` 문서당
  매치 수는 실측상 0~2개 수준(코퍼스 1,504개 전수 실측 — 커밋 메시지 인용)이라 무의미하다.
- **캐싱**: 새로 캐싱이 필요해진 반복 계산은 없다. 위 O(N) 스캔의 캐시 부재는 기존 사안으로 이미
  후속 등재됨.
- **블로킹 I/O**: 훅은 PreToolUse/Stop 동기 프로세스로 실행되는 구조이므로 동기 파일 I/O는 설계상
  적절하다. 새로 추가된 I/O(해시 계산, temp 파일 서브프로세스 테스트)는 전부 로컬이고 빠르다.
  `save_state()`의 temp-file + `os.replace()` 원자적 쓰기는 이번 diff 범위 밖(이전 라운드에서
  이미 검토·확인됨)이며 5R에서 변경되지 않았다.
  - 위치 확인용: `.claude/hooks/_lib/failopen_state.py:41-47`, `.claude/hooks/guard_review_before_push.py:824-834`는 5R에서 docstring만 갱신됐다(`notes` 필드/책임 설명 추가) — 실행 로직 변경 없음.
- **불필요한 연산/문자열 연결**: `contradiction_note()`의 `", ".join(...)`(`block_integrity.py:150-152`)은 O(n²) 누적 없이 `join`을 사용하며 5R에서 변경되지 않았다(W17은 이 포맷팅에 대한 테스트 단언 추가였을 뿐 로직 변경이 아니다).
- **데이터 구조/지연 로딩**: Gate 2(spec-linked일 때만 impl-done 스캔 실행)는 이미 지연 평가 구조이고 5R에서 바뀌지 않았다.

## 요약

이번 라운드가 실제로 검토해야 했던 신규 변경분은 5R 수정 커밋(`7dd4ad8c7`)이며, 이는 성능 관점에서
중립적이다 — 핵심 두 가지 코드 변경(`summary_block_verdict()`의 tie-break를 `search()`에서
`finditer()+[-1]`로, Stop 훅 note 스로틀 키를 인덱스에서 `sha1` 다이제스트로)은 모두 정확성 결함을
고치기 위한 의도적 트레이드오프이고, 둘 다 원본 알고리즘의 복잡도 등급을 바꾸지 않으며, 이 저장소에서
직접 재현 측정한 결과 실행 시간에 측정 가능한 변화가 없었다(`_newest_resolved_impl_done_mtime`
0.0672초, 이전 두 라운드의 0.0804초/0.061~0.098초 범위와 동일 수준). 5R이 추가한 회귀 테스트가
`test_block_integrity.py`의 개별 실행 시간을 0.168초→0.780초로 늘렸지만, 이는 "훅을 두 번 호출하는
테스트가 하나도 없어서" 발생했던 CRITICAL을 닫기 위해 구조적으로 필요한 비용이며 harness 전체 스위트
(749 tests/63.4초)의 성격을 바꾸지 않는다. 이 diff가 얹히는 기반인 `review/**` 전수 `os.walk` 스캔은
여전히 세션 수에 비례하는 O(N)이고(이번 diff는 그 스캔 로직을 한 줄도 건드리지 않았다), 오늘 하루
동안 코퍼스가 실제로 더 늘었음에도(732→767 / 769→850) 절대 실행 시간은 안정적으로 유지됨을 직접
재확인했다 — 성장 추세 자체는 실재하고 이미 `plan/in-progress/harness-review-gate-ci-backstop.md`에
후속 항목으로 명시적으로 추적되고 있으므로 이번 라운드에서 새로 지적할 사항은 아니다. N+1 호출,
불필요한 O(n²) 연산, 부적절한 자료구조, 과도한 선행 로딩 등 다른 점검 관점에서도 신규 문제는
발견되지 않았다.

## 위험도

LOW
