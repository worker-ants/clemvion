# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 5건. 기능 로직 변경은 사실상 0(순수 주석/문구/plan 서술)이지만, **이 PR이 "발생원을 막았다"고 주장하는 계약-오염 문제가 이 리뷰 세션을 기동한 caller(Agent-tool fallback wrapper)에서 여전히 구버전 문구로 재현됨**이 `side_effect` 리뷰에서 직접 관측됐다(WARNING #4) — diff 파일로는 못 고치는 caller-side 갭이며, 이전 라운드가 "머지 후 재확인" 으로 유예했던 항목이 그 재확인 시점에도 닫히지 않았다는 뜻이므로 낮은 위험도 판정과 별개로 반드시 후속 조치가 필요하다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 드리프트 가드(`_extract_block()`)가 `SHARED-BLOCK` 마커 **안**만 비교해, 이번에 고친 결함 클래스(로컬 헤더 주석의 가드 파일명 드리프트)가 재발할 수 있는 구조가 그대로 남음. 이번 diff 는 3곳을 수동으로 고치고 수동 grep 으로만 검증했을 뿐, 사각지대를 닫는 회귀 테스트는 추가하지 않았다 | `.claude/tests/test_workflow_scripts.py` `_extract_block()`, `test_every_fan_out_workflow_mirrors_the_block_verbatim` | 비교 범위를 "MIRROR of..." 주석부터 END 마커까지 확장하거나, 로컬 헤더의 가드 파일명 언급을 정규식으로 뽑아 실제 가드 테스트 경로와 일치하는지 별도 단언하는 서브테스트 추가 |
| 2 | testing | self-deadlock 불변식의 핵심 수치(`.transaction(` 총 36개 = 모듈 안 9 + 모듈 밖 27)가 여전히 자동 정적 가드 없이 사람의 수동 grep 에만 의존. 이전 라운드에선 35 vs 36으로 리뷰어 둘이 실제로 갈렸던 이력이 있음 — 절차 자체가 사람이 반복해도 신뢰도가 낮음이 실측됨 | `execution-engine.service.ts` `updateExecutionStatus` JSDoc (게이트 8574~8601) | `.transaction\s*(<[^>]*>)?\s*\(` 패턴으로 backend 전체를 스캔해 콜백 본문이 `this.updateExecutionStatus` 를 참조하지 않는지 검사하는 정적 가드 unit test를 backend에 추가 |
| 3 | documentation | 신규/수정 주석·JSDoc·plan 서술 9곳이 실측 날짜를 일관되게 "2026-08-31"로 기재 — 실제 커밋 시각(`7d6854cb9`/`5a33656f9` 모두 2026-08-30)과 리뷰 시점 시스템 시각 모두 "2026-08-30"이라 하루 앞선(아직 오지 않은) 날짜. 정본→3개 워크플로 verbatim 미러링 때문에 오타 하나가 5곳으로 퍼졌고, JSDoc 2곳 + plan 2곳에도 별도로 반복돼 총 9곳 | `_lib/agent-return.mjs:56`, `ai-review.js:121`, `consistency-check.js:60`, `merge-coordinate.js:70`, `test_agent_return.mjs:104`, `execution-engine.service.ts:8577,8591`, `plan/in-progress/backend-lint-gate-broken-on-main.md:289,332` | 9곳 모두 "2026-08-31" → "2026-08-30"으로 정정(verbatim 미러 재동기화 포함) |
| 4 | side_effect | 이 리뷰 세션 자체를 기동한 호출 wrapper(Agent-tool fallback 경로)가 **여전히 구버전 `REPORT_RETURN_CONTRACT` 문구**("1) output_file에 Write, 2) 첫 줄 STATUS, 3) 둘째 줄 DELIM" — 이 PR이 정확히 지운 옛 3줄 형태)로 이 세션을 호출했다. 이전 라운드가 INFO로 지적하고 "PR 머지 후 재확인"을 권고한 항목이 그 재확인 시점(이번 라운드)에도 재현됨 — 이 경로로 호출된 reviewer가 지시를 문자 그대로 따르면 이 PR이 막으려는 오염(536개 산출물 헤더 유출)이 계속 늘어날 수 있음 | 리뷰 세션 기동 wrapper (diff 파일 외부, caller-side — 저장소 내 소스 파일로 추적 불가) | fallback Agent-tool 호출 경로 문서에 "출력 규약"을 손으로 재구성하지 말고 `_lib/agent-return.mjs`의 `REPORT_RETURN_CONTRACT`를 그대로 붙여넣도록 명시. 가능하면 이 호출 경로도 드리프트 가드 스캔 대상에 포함하거나 최소한 plan에 "자동 검증 없음" 한계를 명시 |
| 5 | maintainability | `updateExecutionStatus` JSDoc의 개정 이력 누적 문제는 직전 라운드(`20_21_06`)가 "다음에 이 영역을 손댈 때 plan으로 이관"하기로 명시 유예했는데, 이번 diff가 정확히 그 "다음 접촉" 시점임에도 이관 대신 서사를 한 겹 더 쌓았다(4세대째, 총 49줄). 같은 수치(36/9/27)가 plan 문서에도 거의 동일하게 재기재돼 두 SoT가 함께 자라는 패턴이 반복 | `execution-engine.service.ts:8553-8601`(JSDoc 전체), `plan/in-progress/backend-lint-gate-broken-on-main.md:289-306` | 최소한 plan에 "다음 접촉 시 이관" 항목을 재등록해 유예가 무기한으로 늘어지지 않게 하거나, JSDoc은 현재 유효 제약+최신 스냅샷만 남기고 세대별 각주는 plan 링크로 축약 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | self-deadlock 불변식 JSDoc의 "모듈 안 9개 블록이 `updateExecutionStatus`에 도달하지 않는다" 주장 중 2곳만 직접 재확인했고 나머지 7곳은 예산상 전수 재확인을 못함(grep상 상충 정황은 없었음). JSDoc 스스로 "자동 가드 없음, 사람이 grep으로 확인"이라 명시한 기존 한계와 같은 성격 | `execution-engine.service.ts:8577-8596` | 조치 불요(선택: 9개 블록 라인번호를 JSDoc/plan에 명시해 두면 향후 재검증 비용 감소) |
| 2 | scope | 첫 커밋(`7d6854cb9`)이 서로 무관한 두 결함(계약 sink 분리 + self-deadlock JSDoc 감사)을 한 커밋에 담은 패턴이 diff에 여전히 보이나, 이전 라운드가 이미 지적했고 개발자가 "되돌리지 않되 plan에 판단 기록"으로 명시적으로 처분 완료(같은 세션 세 번째 지적임을 스스로 인정) | `execution-engine.service.ts:8574-8601`, `plan/...:302-306` | 조치 불요(재-revert 요구 안 함). 다음 PR부터 커밋 분리 습관 권고 |
| 3 | maintainability | 신규 회귀 테스트 2건이 계약 문구의 번호("1)","2)","3)") 문자열 매칭(`indexOf`/`startsWith`)에 구조적으로 결합. 현재는 뮤테이션으로 vacuous 아님을 확인했으나, 향후 문구가 다른 표기(예: "①")로 바뀌거나 우연히 동일 부분 문자열이 먼저 등장하면 오탐 여지 | `.claude/tests/test_agent_return.mjs:109-138` | 당장 조치 불요. 향후 계약 문구 변경 시 번호 리터럴 대신 배열 인덱스/명명 상수로 리팩터 고려 |
| 4 | side_effect | `REPORT_RETURN_CONTRACT`/`DELIM` 문구 변경은 4곳(정본+3미러) 모두에 영향을 주는 광범위한 인터페이스 변경 — 향후 3개 워크플로가 기동하는 모든 fan-out sub-agent 호출에 영향. 의도된 변경이며 byte-identical 미러링과 가드 테스트 통과를 직접 확인함 | `_lib/agent-return.mjs`, `ai-review.js`, `consistency-check.js`, `merge-coordinate.js` | 조치 불요(의도됨), 영향 범위 기록 목적 |
| 5 | scope | `review/code/2026/08/30/20_21_06/**` 전체(이전 라운드 산출물)를 신규 파일로 커밋한 것은 CLAUDE.md 저장 위치 규약 및 저장소 기존 관행과 일치 | `review/code/2026/08/30/20_21_06/*` | 조치 불요 |

## 이전 라운드(`20_21_06`) WARNING 재검증 결과 — 4건 전부 해소 확인

- **가드 파일명 절반 리네임**: 저장소 소스 전수(`*.js`/`*.mjs`/`*.py`/`*.ts`) 재확인 결과 `test_workflow_shared_block` 잔여 0건(다수 reviewer가 각각 독립 재현·일치).
- **`.transaction(` 개수 35 vs 36 상충**: 정확히 36개(모듈 안 9 + 모듈 밖 27)로 다수 reviewer가 독립 재현·일치. 단, 그 수치 산출 절차 자체가 사람 수동 grep에 계속 의존한다는 점은 WARNING #2로 별도 승계.
- **forward-looking 지시문 삭제**: "새 호출부 추가 시 재확인" 문장이 JSDoc에 복원됨을 확인.
- **무관 커밋 혼재**: 기능 결함 아님, plan에 판단 기록 완료(INFO #2로 승계, 조치 불요).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | self-deadlock 불변식 재검증 예산 한계(INFO 1건) 외 이전 WARNING 4건 전부 해소 확인 |
| testing | LOW | 드리프트 가드 구조적 사각지대 재발 위험 + `.transaction(` 수동 카운트 의존 (WARNING 2건) |
| documentation | LOW | "2026-08-31" 날짜 오기 9곳 (WARNING 1건), 그 외 수치·리네임 전부 정확 재검증 |
| scope | LOW | 신규 scope 위반 없음 — 기결 사안(INFO)만 diff에 잔존 |
| security | NONE | 실질 보안 표면 변경 없음(순수 문구/주석/문서) |
| side_effect | LOW | 리뷰 세션 기동 wrapper가 구버전 계약 문구 재사용 (WARNING 1건, caller-side 갭) |
| maintainability | LOW | JSDoc 이관 유예조건 충족했으나 미이행, 서사 4세대째 누적 (WARNING 1건) |

## 발견 없는 에이전트

- **security** — 실질 발견 0건(NONE). harness 프롬프트 문구·JSDoc 주석·plan/review 문서로만 구성돼 인증/인가·DB·암호화·시크릿 표면이 diff에 존재하지 않음을 확인.

## 권장 조치사항

1. **(가장 중요)** side_effect WARNING #4 — 이 리뷰 세션을 기동한 Agent-tool fallback wrapper가 구버전 계약 문구를 쓰고 있음을 정정. 이 PR의 핵심 주장("계약 오염 발생원 차단")이 실제 전체 호출 경로를 덮었는지 확인하는 가장 시급한 후속 조치 — 방치 시 이 PR이 막으려던 536개 산출물 헤더 유출 패턴이 이 경로에서 계속 재발할 수 있다.
2. documentation WARNING #3 — 9곳의 "2026-08-31" 날짜 오기를 "2026-08-30"으로 정정(verbatim 미러 5곳 동반 재동기화).
3. testing WARNING #1, #2 — 드리프트 가드 비교 범위를 로컬 헤더 주석까지 확장하고, `.transaction(` 전수 카운트에 대한 정적 가드 unit test를 backend에 추가.
4. maintainability WARNING #5 — `updateExecutionStatus` JSDoc 서사를 plan으로 이관하거나, 최소한 plan에 "다음 접촉 시 이관" 항목을 재등록.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, testing, documentation, scope, security, side_effect, maintainability` (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 사실상 전원이 안전 강제 화이트리스트로 포함됨. forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |