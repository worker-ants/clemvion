# Resolution — review/code/2026/07/23/15_59_54

대상 커밋: `af40f8613` (router 결정 신뢰 검증 — 강제 목록 위반 시 결정 폐기 + 구성 사실 명시)
SUMMARY 위험도: **LOW** / CRITICAL 0 / WARNING 9 / INFO 14
forced reviewer 7명 전원 결과 확보 (`forced_missing: []`, `unfinished: []`).

## CRITICAL

없음.

## WARNING — 7건 반영, 2건 사유 기록 후 미조치

### W1 SKILL.md Route 서술이 distrust 분기 미반영 → **반영**

`SKILL.md` §2 Route 불릿에 두 줄 추가: (a) forced 위반 시 결정 통째 폐기 → 전수 실행
(`fallback-distrusted-decision`), CLI `--apply-routing` 도 동일 판정이며 두 구현이 차등
테스트로 묶여 있음. (b) 실행 reviewer 0명은 **fatal** 이지 전수 fallback 이 아니며 옛
"0~1 → 전수" 규칙은 #244 에서 폐기됐음.

### W2 `_apply_routing()` docstring 이 3번째 분기 미설명 → **반영**

세 결과(fallback / distrusted / 정상)를 모두 서술하고, distrust 시 routing 기인 버킷만
복원하고 `agents_success`·`agents_fatal` 은 건드리지 않는다는 불변식을 명시.

### W3 독스트링 인용 수치 오류 (15:4 vs 실제 16:3) → **반영**

지적이 정확했다. 실측(`awk` 확장자 집계): **16 md / 3 py**. "라우터의 파일 카운트 오판을
막는" 코드가 자기 근거 수치를 틀리게 인용한 아이러니가 맞다. 3곳 정정
(`router_safety.py` docstring, `test_router_decision_trust.py` 모듈 docstring,
`code_review_orchestrator.py:742` 주석).

부수로 `test_mixed_changeset_is_declared_not_doc_only` 의 docstring("15 docs + 1 module")도
자기 fixture 와 불일치였다(`*-reviewer.md` 는 14개뿐이라 `[:15]` 는 14를 반환). 하드코딩
숫자를 없애고 `len(docs)` 파생 단언으로 교체 — fixture 가 바뀌어도 조용히 어긋나지 않는다.

### W5 26줄 근거 주석이 `BINARY_EXTENSIONS` 앞에 위치 → **반영**

주석 블록을 `_routing_distrust_reason()` 바로 위로 이동. 지적대로 맥락 단절이었고
`BINARY_EXTENSIONS` 이동 시 고아 주석이 될 위험이 있었다.

### W7 JS 함수 추출 휴리스틱이 테스트 안에서 2중 구현 → **반영**

`_js_function(name)` 헬퍼로 통합하고, 의존하는 가정(top-level `function`, 다음 `\n}` 이
종료)을 docstring 에 명시. 추가로 `test_js_function_slicing_assumption_holds` 로 가정 자체를
검증 — 중괄호 균형·시작/끝·본문 완전성. 스타일이 바뀌면 차등 테스트가 **잘린 본문으로
조용히 무의미해지는** 대신 여기서 먼저 실패한다.

### W8 "변경 구성" 20개 초과 truncation 분기 미테스트 → **반영**

`test_long_source_list_is_truncated_with_an_accurate_remainder` 신설: 실제 23개 `.py` 를
임시 생성해 `**소스 코드 파일 23개**` · `… 외 3개` · 나열 정확히 20개를 검증. 지적대로 이
PR 의 동기 자체가 파일 카운트 오판 방지이므로 우선순위가 높았다.

### W9 distrust 분기가 `agents_pending`/`agents_skipped` 미재구성 → **반영**

실제 결함이었다. `--apply-routing` 이 한 세션에서 두 번 호출되고(재라우팅·재개) 두 번째가
distrust 면, 로그는 "전량 실행" 인데 state 에는 첫 호출의 부분 skip 이 남았다. distrust
분기에서 `agents_skipped` 를 pending 으로 복원 + 초기화하도록 수정. `agents_success`·
`agents_fatal` 은 의도적으로 미복원(이미 실행된 reviewer 는 routing 폐기로 재무장되지 않음).
회귀 테스트 2건 추가.

### W4 별건 테스트 리팩터가 커밋에 번들 → **미조치 (사유 기록)**

`test_line_anchors.py` 의 `_prepare()` 3분할은 이 커밋에서 **강제된 변경**이다. 직전 PR
머지로 HEAD 가 대형 머지 커밋이 되면서 whole-file 단언이 깨졌고(예산 구속), 고치지 않으면
suite 가 red 라 커밋 자체가 불가능했다. 분리 커밋이 이상적이나 되돌려 분리하면 그 사이
suite 가 깨진다. 커밋 메시지 "부수" 에 미기재한 것은 실수 — 본 RESOLUTION 과 PR 본문에
명시하는 것으로 갈음한다.

### W6 "샘플 N개 + 외 N건/개" 패턴 3중복 → **미조치 (사유 기록)**

세 사용처가 서로 다른 모듈(`code_review_orchestrator` ↔ `router_safety`)·한도(20 vs 3)·
단위(개 vs 건)·문맥(프롬프트 본문 vs forced 사유 문자열)이다. 공용 헬퍼로 묶으면 두 모듈
사이에 새 결합이 생기고 파라미터가 4개인 헬퍼가 되어 실이 득보다 크다고 판단. 진짜 동일
보일러플레이트만 추출한다는 기존 판단(#920)과 같은 기준.

## INFO — 14건 미조치

- INFO 1·5·7·9 — 조치 불요로 리뷰어가 직접 판정(긍정적 발견 / 필연적 부수 변경 / 비파괴적 확장 / 차등 테스트로 완화).
- INFO 2 (subprocess 보간) — 현재 고정 매트릭스라 안전. 외부/모델 생성 데이터로 재사용 시 재검토 필요하다는 지적은 타당하나 지금 조치할 대상 없음.
- INFO 3 ("24 extensions" vs 실제 44) — **선재 이슈**(2026-05-16부터), 이번 PR 무관. 별건.
- INFO 4 (`decisions: null` 시 python 무방비) — 기존 코드와 동일 취약점, 신규 회귀 아님. `_routing_decision.json` 은 router 가 schema 로 쓰는 파일이라 실경로 도달성이 낮음. 별건.
- INFO 6 (distrust 발동 비용) — 의도된 안전장치. 발동 빈도 모니터링은 선택 사항.
- INFO 8·11·12·13 — 낮은 우선순위 / 현 상태 유지 가능으로 리뷰어가 분류.
- INFO 10 (인시던트 서술 5파일 복붙) — W3 정정으로 수치는 일치시켰다. 정본 1곳 + 참조 구조로의 재편은 각 파일이 서로 다른 독자(모듈 사용자 / 테스트 읽는 사람 / workflow 편집자)를 향하고 있어 이번 턴 미조치. doc-only 루프 회피.
- INFO 14 (README `routing_skip_reason` 예시) — **반영함** (INFO 이나 1줄이라 함께 처리).

## 검증

- harness suite **398 green** (반영 전 394 → 신규 테스트 4건).
- 신규/수정 가드 mutation 실측 **5/5 killed**: skipped 미복원 · agents_skipped 미초기화 ·
  success 재무장 · truncation 한도 off-by-one · 나머지 개수 오산.
- 사고 changeset 실측 재확인: `16 md / 3 py` — 정정한 수치와 일치.

## 잔여

없음 (WARNING 9건 중 7건 반영, 2건은 위 사유로 미조치).
