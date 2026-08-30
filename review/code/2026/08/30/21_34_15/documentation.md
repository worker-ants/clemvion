# 문서화(Documentation) 리뷰

## 검증 절차 (독립 재현, 뮤테이션 없음)

이 diff 는 이미 3라운드(`20_21_06` → `20_46_48` → `21_12_21`)의 리뷰를 거치며 문서화 관점
WARNING 이 전부 처분된 누적 상태다. 과거 라운드 서술을 그대로 받지 않고 저장소 현재 상태를
직접 재확인했다(저장소 파일은 전혀 수정하지 않음, `Read`/`Grep`/`Bash` 만 사용):

- `grep -rn "2026-08-31" <8개 관련 파일>` → **0건**. `20_46_48` 이 지적한 "오지 않은 날짜
  11곳"(당시 오늘은 2026-08-30) 정정이 그대로 남아 있다. `.claude/tests/test_agent_return.mjs:104`
  는 `Measured 2026-08-30.` 로 정확하다.
- `grep -rln "test_workflow_shared_block" --include="*.js,*.mjs,*.py,*.ts"` → 유일한 잔여는
  `.claude/tests/test_workflow_scripts.py:119` 의 신규 테스트 docstring 인데, 이는 "가드 테스트
  파일이 `test_workflow_shared_block.py` → `test_workflow_scripts.py` 로 바뀌었는데 …" 라는
  **과거 드리프트 사고를 설명하는 의도된 역사적 인용**이다(깨진 포인터 아님). 3개 워크플로 파일의
  `SHARED-BLOCK` 마커 줄과 그 위 "Editing rule" 헤더 주석 모두 `test_workflow_scripts.py` 로
  일치함을 직접 열어 확인했다 — `20_21_06` W1(마커 밖 헤더만 스테일)은 완전히 해소됐다.
- `execution-engine.service.ts:8571-8573` — `20_46_48`/`21_12_21` 이 세 번째로 지적했던 "같은
  JSDoc 문장 안에서 '9' 가 서로 다른 두 모집단(호출부 vs 블록)을 가리켜 혼동된다" 는 이번엔
  `"이 9는 **블록 수**라 앞의 '경유 9곳'과 무관한 집합이다"` 로 명시 disambiguation 됐다(직접
  확인).
- `.transaction(<...>)?\(` 패턴(제네릭 인자 포함, `*.spec.ts`/주석 줄 제외)으로 backend 전수를
  독립 재측정: **정확히 36개**, `execution-engine`/`retry-turn` 두 파일 합산 **정확히 9개** —
  JSDoc 의 "36 = 모듈 안 9 + 밖 27" 과 오차 0으로 일치.
- `plan/in-progress/backend-lint-gate-broken-on-main.md:325,329` — `21_12_21` W1(“새 세션에서
  확인”이 같은 세션의 새 리뷰 라운드로 오독될 여지)에 대해 `**새로운 top-level Claude Code
  세션**(현재 세션 안의 새 리뷰 라운드가 아니다)` 로 명시 정정된 문구가 실제로 반영돼 있다.
- `git status --short` → 이 리뷰 세션의 산출 디렉터리(`review/code/2026/08/30/21_34_15/`) 외
  잔여물 없음. 저장소 뮤테이션 없이 검증 완료.

## 발견사항

(신규 CRITICAL/WARNING 없음 — 세 라운드에 걸쳐 지적된 항목 전부가 diff 안에서 실측 재확인
가능한 상태로 닫혀 있고, 이번 라운드가 새로 만든 문서 결함도 관측되지 않았다.)

- **[INFO]** JSDoc 의 "세는 방법" 경고 문장에서 "주석 줄 포함 시 부풀려진다" 는 사실만 말하고
  구체적인 오염 수치를 남기지 않는다 — 참고용, 조치 불요.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `updateExecutionStatus` 바로 위 JSDoc, "그러지 않으면 각각 35(제네릭 누락)와 부풀린 수가
    나온다" 문장.
  - 상세: 제네릭 인자를 빼먹으면 정확히 "35" 라고 수치를 박아 뒀지만, 주석 줄을 포함할 때
    나오는 값은 "부풀린 수" 로만 서술해 비대칭적이다. `20_21_06` requirement 리뷰어가 실제로
    이 자기참조 오염(JSDoc 프로즈 자체가 `` `.transaction(` `` 문자열을 담고 있어 같은 파일에서
    단순 `grep -c` 시 10건 vs 실제 콜백 8건으로 부풀려짐)을 구체적 수치로 관측한 바 있다 — 그
    맥락을 아는 사람에게는 자명하지만, 이 JSDoc 문장만 읽는 다음 사람에게는 "부풀린 수" 가
    정확히 얼마나 부풀리는지 감이 없다.
  - 제안: 급하지 않음. 다음에 이 JSDoc 을 다시 손댈 기회가 있으면 "주석 줄을 포함하면 이 문단
    자신의 인용까지 잡혀 실제보다 커진다"는 원인 한 구절만 덧붙이는 정도로 충분.

## 확인된 항목 (세 라운드 처분 재검증 — 회귀 없음)

| 항목 | 라운드 | 처분 | 이번 라운드 독립 재확인 |
|---|---|---|---|
| 가드 테스트 파일명(`test_workflow_shared_block.py`→`test_workflow_scripts.py`) 절반 리네임 | `20_21_06` W1 | 완료 | 소스 잔여 0건 (재확인) |
| "2026-08-31" 미래 날짜 11곳 | `20_46_48` W3 | 완료 | 잔여 0건 (재확인) |
| `.transaction(` 수치 35 vs 36 상충 | `20_21_06` W2 | 완료(36=9+27 확정) | 독립 grep 재현 36=9+27 일치 |
| self-deadlock JSDoc 서사 무기한 누적 | `20_46_48` W5 | plan 으로 이관, JSDoc 축약 | JSDoc 25줄 내외로 축약 유지 확인 |
| JSDoc "9" 이중 지시 혼동 | `20_46_48`/`21_12_21` (3회 재지적) | 괄호 disambiguation | 문구 존재 확인 |
| plan "새 세션에서 확인"의 세션 스코프 모호성 | `21_12_21` W1 | 문구 명시 | "top-level Claude Code 세션" 반영 확인 |

## CHANGELOG / README / API 문서

- `CHANGELOG.md` 는 `codebase/` 제품 변경만 기록하는 저장소 관례이고, 이번 diff 는 harness
  툴링(`.claude/`) + 순수 주석(`execution-engine.service.ts`) 뿐이라 갱신 대상이 아니라는 이전
  라운드 판단이 유지된다.
- `.claude/tests/README.md` 는 이미 `test_workflow_scripts.py` 로 정확히 기재돼 있어 갱신 불요.
- API 계약(엔드포인트·DTO) 변경 없음 — `spec/` 문서 갱신 대상 아님.

## 요약

세 라운드에 걸쳐 문서화 관점에서 지적된 모든 항목(가드 파일명 절반 드리프트, 도래하지 않은
미래 날짜 11곳, JSDoc 서사 무기한 누적, 같은 문장 안 "9" 값 혼동, plan 의 세션 스코프 모호성)이
이번 diff 에서 실제로 정정돼 있음을 grep/독립 재측정으로 재확인했으며, 이번 라운드가 새로 만든
회귀는 관측되지 않았다. `REPORT_RETURN_CONTRACT` 의 file/return sink 분리 문구는 4곳(정본+3
워크플로 미러) 모두 정확하고, `updateExecutionStatus` self-deadlock JSDoc 의 정량 수치(36=9+27)
도 독립 재현과 오차 0으로 일치한다. 유일하게 남긴 것은 JSDoc 한 구절의 사소한 서술 비대칭
(INFO, 조치 불요 수준)뿐이다.

## 위험도

NONE
