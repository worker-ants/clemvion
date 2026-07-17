# RESOLUTION — W2 forced 커버리지 게이트

대상 SUMMARY: `./SUMMARY.md` (**MEDIUM**, Critical 0, Warning 9)

> 이번에도 수정 대상 워크플로가 자기 자신을 리뷰했다. `forced_missing=[]` · `recovered=[]` ·
> `unfinished=[]` — 강제 7/7 전원 확보. 신설 게이트 관점에서 본 세션 자체는 gap 없음.

## 조치 항목

| # | 카테고리 | 판정 | 조치 | commit |
| --- | --- | --- | --- | --- |
| W1 | 문서-구현 불일치 | **fix (뼈아픈 지적)** | 아래 §W1 | `a7c31f8` |
| W2 | 상태 버그 | **fix** | `_reconcile_state_with_disk` 가 fatal 인 agent 를 `agents_pending` 에도 넣어 **이중 멤버십**(pending/fatal 카운트가 서로 어긋남). fatal 은 "아직 안 돌았다" 가 아니므로 fatal 로 유지하고 pending 에서 제외 | `a7c31f8` |
| W3 | 상태 버그 | **fix** | `changed` 비교 튜플이 자신이 갱신하는 `agents_fatal` 을 빠뜨려, fatal 만 바뀐 조합에서 메모리는 고쳐지고 **디스크 저장이 스킵**됐다. 튜플에 포함 + 회귀 테스트 | `a7c31f8` |
| W4 | 부작용 | **fix** | 조회 커맨드가 조용히 `_retry_state.json` 을 쓰던 것 → 실제 변경 시 **stderr 로 고지**(`(reconciled …)`). 감사 목적 조회가 워킹트리를 dirty 하게 만들 수 있다는 지적이 맞다 | `a7c31f8` |
| W5 | 유지보수성 | **fix** | report-path 해석이 `review_guard`·`code_review_orchestrator`·(신규)`consistency_orchestrator` 3곳에 있는데 상호 참조가 없었다 → 각 docstring 에 "the two enforcement points must agree — change both" 명시. 완전 공유는 `_lib` 패키지 이름 충돌 제약이라 별도 작업 |
| W6 | 견고성 | **부분 조치** | manifest 부재/손상 시 fail-open 은 **의도된 트레이드오프로 유지** — manifest 가 곧 화이트리스트의 출처라 없으면 검증할 대상 자체가 없고, fail-closed 는 pre-manifest 히스토리 전체를 막는다. 근거를 docstring 에 명시. 타입 방어(`isinstance`)는 추가(INFO#1) | `a7c31f8` |
| W7 | 견고성/보안 | **fix** | 존재만 확인해 `touch security.md` 로 통과 가능하던 것 → **비어있지 않을 것**을 요구. 실측으로 안전 확인: 커밋된 리포트 4749개 **최소 254B**, 50B 미만 0건 → 정상 리포트 오탐 0 | `a7c31f8` |
| W8 | 문서 정확성 | **fix** | 모듈 docstring 의 "Fresh, resolved review" 정의에 coverage 조건 추가(1·2·3 번호목록) | `a7c31f8` |
| W9 | 문서 정확성 | **fix** | `_summary_is_resolved` docstring 의 평면 불리언 목록이 표준 우선순위로 `(A AND B) OR C` 로 읽혀 **"위험도만 낮으면 커버리지 무시"** 라는 정확히 이 PR 이 막는 오독을 유발 → BOTH 1/2 구조로 재작성 + 왜 그렇게 썼는지 명시 | `a7c31f8` |
| INFO#1 | 견고성 | **fix** | `agents_forced`/`subagent_invocations` 타입 방어 추가(문자열이 주어지면 문자 단위 순회) + 테스트 | `a7c31f8` |
| INFO#8 | 테스트 갭 | **fix** | fallback 분기(`f"{name}.md"`) 테스트 추가 | `a7c31f8` |
| INFO#3·4·6 | 설계/복잡도 | **조치 불요** | 리뷰어가 "설계 의도 / 참고 기록 / 지금 조치 불필요" 로 명시 | — |
| INFO#5·7·9 | 문서 중복·테스트 | **후속** | canonical hub 정리·cross-session 통합 테스트·`mkdtemp` cleanup — 범위 밖 | — |

## W1 — 내가 문서에 거짓을 썼다 (4개 리뷰어가 독립 재현)

`consistency-checker/SKILL.md` 와 `subagent-call-contract.md` 에 "`--summary-state`/`--resume`
가 읽을 때 디스크로 자가 reconcile" 이라 써놓고, **구현은 `code_review_orchestrator.py` 에만**
했다. `consistency_orchestrator.py` 는 손도 안 댔다.

직접 재현 (fix 전):
```
$ consistency_orchestrator.py --summary-state <session>
pending=2 success=0 fatal=0     ← cross_spec.md 는 디스크에 있는데 success=0
```

**이 PR 이 없애려는 "메커니즘 없는 산문" 을 자매 서브시스템에 그대로 만든 것**이다. 게다가
내 consistency 세션 4개가 stale 로 커밋된 것이 애초에 이 작업의 발단이었는데, 정작 그쪽을
고치지 않았다.

**조치**: 두 orchestrator 가 상태 함수를 완전 복제하는 기존 컨벤션대로 `consistency_orchestrator.py`
에도 `_report_paths`/`_reconcile_state_with_disk` 구현 + `--summary-state`/`--resume` 연결.
리뷰어가 함께 지적한 **"회귀 테스트 0건"** 도 해소 — `test_consistency_orchestrator_state.py`
신설(6건: 자가 reconcile · 꾸민 success 강등 · 워크트리 소멸 · rate-limit 보존 · fatal 이중멤버십).

재현 (fix 후):
```
$ consistency_orchestrator.py --summary-state <session>
(reconciled _retry_state.json with reports on disk)
pending=1 success=1 fatal=0     ← 문서가 이제 참
```

## TEST 결과

- **lint / build**: 해당 없음 (`codebase/**` 무변경)
- **unit**: 통과 — 하네스 **243 OK** (신규 13건: consistency 6 · orchestrator 2 · review_guard 5)
- **e2e**: **면제** — PROJECT.md §e2e 면제 화이트리스트 인용: "`.claude/**` (skills, hooks, agents 정의)"(97행), "`spec/**` · `plan/**` · `review/**` …"(96행). 변경 set 은 `.claude/**` + `plan/**` + `review/**` 로 **부분집합**이며 `codebase/**` 는 한 줄도 없다.

실측 검증:
- W1 재현 → fix 후 소멸 (위 §W1)
- W7 안전성: 커밋된 리포트 4749개 최소 254B → 비어있지 않음 요구가 정상 리포트를 배제하지 않음
- 게이트 blast radius: resolved 570→464, 현재 브랜치 `guard_review_before_stop.py` **exit 0**

## 보류·후속 항목

| 항목 | 사유 |
| --- | --- |
| report-path 해석 3곳 완전 공유 (W5) | `.claude/skills/_lib` 와 `.claude/hooks/_lib` 의 패키지 이름 충돌 — 두 orchestrator 가 서로를 import 못 하는 기존 제약(`test_orchestrator_state.py` 헤더에 기록). 별도 아키텍처 작업 |
| 리포트 **내용** 구조 검증 (W7 심화) | 지금은 "비어있지 않음" 까지. 섹션 헤더 강제는 리포트 포맷을 고정시켜 트레이드오프가 큼 |
| 문서 3곳 중복 → hub canonical 화 (INFO#5) | 범위 밖 |
| cross-session `_newest_resolved_review_mtime` 통합 테스트 (INFO#7) | 이번 diff 이전부터의 기존 공백 |
