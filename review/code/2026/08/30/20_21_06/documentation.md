# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 가드 테스트 파일명이 리네임됐는데, 워크플로 3개에 "박제된" 옛 이름이 그대로 남았다 (같은 파일 안에서 4줄 아래 줄과 서로 모순).
  - 위치:
    - `.claude/workflows/ai-review.js:109`
    - `.claude/workflows/consistency-check.js:48`
    - `.claude/workflows/merge-coordinate.js:58`
  - 상세: 이번 PR 은 `SHARED-BLOCK` 마커 줄의 가드 파일명을 `test_workflow_shared_block.py` →
    `test_workflow_scripts.py` 로 정정했다(`.claude/workflows/_lib/agent-return.mjs:15,48` 및
    3개 워크플로 파일의 마커 줄 — 예: `ai-review.js:113`). 그런데 그 마커 줄 바로 위, **같은
    파일 안의 "Editing rule" 주석**(`// \`.claude/tests/test_workflow_shared_block.py\` fails
    the build if these drift apart;`)은 3개 워크플로 파일 전부에서 옛 이름 그대로 남았다.
    실제로 `test_workflow_shared_block.py` 는 저장소에 더 이상 존재하지 않는다(확인:
    `find . -iname test_workflow_shared_block.py` → 0건, `find . -iname
    test_workflow_scripts.py` → `.claude/tests/test_workflow_scripts.py` 1건).
    `.claude/tests/README.md:58` 는 이미 새 이름으로 정확히 기재돼 있어, 3개 워크플로 파일만
    뒤쳐진 상태다.
    이 주석은 `SHARED-BLOCK`/`<<< SHARED-BLOCK` 마커 **밖**에 있어 `test_workflow_scripts.py`
    자체의 드리프트 가드(`_extract_block`, 마커 사이 텍스트만 바이트 비교)가 검사하는
    범위가 아니다 — 즉 이 불일치는 어떤 자동 가드도 잡지 못하고 조용히 남는다. 아이러니하게도
    `test_workflow_scripts.py` 의 모듈 docstring 은 "이 계약이 필요했던 원인 자체가 드리프트된
    중복 주석이었다"고 적고 있는데, 이번 수정이 정확히 같은 클래스의 드리프트를 한 겹 더
    남겼다.
  - 제안: 3개 워크플로 파일의 해당 줄도 `test_workflow_scripts.py` 로 정정한다(정확히
    `_lib/agent-return.mjs` 에서 이미 한 것과 동일한 편집). 재발 방지를 원하면
    `test_workflow_scripts.py` 의 드리프트 가드 범위를 `SHARED-BLOCK` 마커 밖의 "Editing
    rule" 주석까지 넓히거나, 최소한 파일명을 상수로 인용하는 유일한 위치(`_lib` 헤더)만
    남기고 3개 워크플로 파일의 해당 문장은 삭제해 SoT 를 하나로 좁히는 방법도 있다.

## 검증 메모 (뮤테이션 없음)

- 저장소 파일은 수정하지 않았다. `grep`/`find`/`Read` 로만 대조했다.
- 4개 파일(`_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`,
  `merge-coordinate.js`)의 `SHARED-BLOCK`~`<<< SHARED-BLOCK` 구간을 `awk` 로 추출해 서로
  `diff` 했다 — **바이트 단위로 완전히 동일**함을 확인했다(verbatim 미러링 규칙 준수, 위
  발견사항과 무관하게 이 부분은 정상).
- `execution-engine.service.ts` 의 새 JSDoc(호출 스택 축 확인, "36개 = 모듈 안 9개 + 모듈 밖
  27개")은 실측으로 재검증했다: `grep -rn '\.transaction\s*<\|\.transaction\s*('`(스펙 파일
  제외, 주석 내 인용 2줄 제외)로 backend 전수를 세면 **정확히 36개**이고, 그중
  `execution-engine.service.ts`(8) + `retry-turn.service.ts`(1) = **9개**가 이 모듈 안이다.
  처음에 단순 `\.transaction(` 패턴으로 셌을 때 35개가 나와 불일치로 의심했으나, 원인은 내
  정규식이 제네릭 타입 인자가 낀 `webauthn.service.ts:338` 의
  `this.dataSource.transaction<Outcome>(` 형태를 놓친 것이었다 — 그 1건을 포함하면 36개로
  docstring 과 정확히 일치한다. **주석의 수치 자체는 정확하다.**
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 신규 항목(536개/271개 실측, plan
  체크박스 전환)은 본문 서술과 체크리스트가 일치하고, "이전 825개는 느슨한 grep 오차였다"는
  자기 정정도 근거(측정 방법 차이)를 함께 적어 두었다 — 문서 품질 문제 없음.
- `CHANGELOG.md` 는 `codebase/` 제품 변경만 기록하는 관례로 보인다(grep 결과 harness/`.claude/`
  변경 항목이 전무). 이번 PR 은 harness 스크립트 + 코드 주석 1건뿐이라 CHANGELOG 갱신
  대상이 아니라고 판단했다.
- `.claude/docs/subagent-call-contract.md` §2 는 "prompt 에 '출력 규약' 이 붙어 있으면 그쪽이
  우선한다"고만 위임하고 정확한 파일/반환 분리 문구를 복제하지 않는다 — 이는 SoT 를
  워크플로 쪽에 단일화하는 설계이므로 드리프트가 아니다(정상).

## 요약

핵심 변경(파일 vs 반환 메시지 sink 분리 계약 정정, self-deadlock 확인의 호출 스택 축 보강,
plan 갱신)은 모두 실측을 동반한 정확하고 꼼꼼한 문서화로, 오히려 이 저장소의 모범 사례에
가깝다(수치 재검증까지 통과). 다만 가드 테스트 파일 리네임(`test_workflow_shared_block.py` →
`test_workflow_scripts.py`)을 반영하면서 `SHARED-BLOCK` 마커 줄만 고치고 그 4줄 위 "Editing
rule" 주석은 3개 워크플로 파일 전부에서 고치지 않아, 같은 파일 안에 서로 다른 이름을 가리키는
두 문장이 공존하게 됐다. 자동 드리프트 가드의 검사 범위 밖이라 방치되면 다음 사람이 존재하지
않는 파일을 찾게 된다.

## 위험도

LOW
