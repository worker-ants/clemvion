# 요구사항(Requirement) 리뷰 — report-return sink 분리 + self-deadlock 호출 스택 축 확정 + plan 동기화

## 검증 방법

저장소 파일은 수정하지 않았다(`git status --short` clean 유지, 사본은 만들지 않음 — 읽기 전용 검증만 수행). 아래는 diff 서술이 아니라 **현재 HEAD 코드베이스를 직접 재실행/재계산**해 얻은 결과다.

- `node --test .claude/tests/test_agent_return.mjs` → **13/13 pass** (신규 두 테스트 포함).
- `python3 -m pytest .claude/tests/test_workflow_scripts.py -q` → **6 passed, 17 subtests passed**.
- `grep -rn '\.transaction<\|\.transaction('` 로 backend 전수(`*.spec.ts` 제외) 재계산, 주석 줄(JSDoc 프로즈 3줄: `execution-engine.service.ts:8572,8577,8578`) 제외 → **정확히 36개**. 그중 `execution-engine.service.ts`(8) + `retry-turn.service.ts`(1) = **9개**가 엔진 모듈 안, 나머지 **27개**가 밖. JSDoc/plan 이 주장하는 `36 = 9 + 27` 과 **정확히 일치**.
- `updateExecutionStatus(` 호출부 재계산: 이 파일 안 직접 호출 **11곳**(652/2309/2409/2485/2574/3569/4307/4432/4755/4893/5014) + `EngineDriver` 경유 **9곳**(form-interaction 2·button-interaction 2·ai-turn-orchestrator 3·retry-turn 2) = **20곳**, JSDoc 주장과 일치.
- `retry-turn.service.ts` 를 직접 열어, 유일하게 `.transaction(` 을 여는 소비 서비스인 이 파일에서 트랜잭션 블록(197~240행)이 `updateExecutionStatus` 경유 호출부(696/915행)보다 훨씬 앞에서 닫힘을 확인 — "소비 서비스 넷 중 트랜잭션을 여는 것은 하나뿐이고 그 호출은 트랜잭션 밖" 이라는 주장이 실측과 일치.
- `grep -rn "2026-08-31"` 을 대상 4개 파일(plan 2개 + execution-engine.service.ts)에 돌려 **잔여 0건** 확인 — "오지 않은 날짜 11곳 정정" 커밋 주장과 일치.
- `grep -rln "test_workflow_shared_block"` → `.claude/tests/test_workflow_scripts.py` 단 1건, 그것도 자기 파일의 **드리프트 이력을 서술하는 docstring** 안(119행)이라 신규 테스트의 스캔 대상(`LIB` + 3 workflow 파일)에서 제외되어 자기 참조 오탐이 없음 — 소스 쪽 잔여 스테일 참조는 **0건**(완전 정정 확인).

## 발견사항

- **[INFO]** self-deadlock 호출 스택 축 수치(36/9/27, 20=11+9)가 세 판에 걸쳐 반복 정정됐던 이력(11→20, 어휘적→호출 스택, 26→27) 끝에 **이번 판(HEAD)에서는 실측과 완전히 일치**함을 독립 재계산으로 확인했다. 별도 조치 불필요 — 과거에 반복적으로 틀렸던 값이라는 점(메모리에도 기록된 패턴: "설계 근거는 쓰기 전에 뮤테이션으로 반증하라")을 감안해 이번 라운드에서 직접 재현 검증을 수행한 결과다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8571-8583`, `plan/in-progress/backend-lint-gate-broken-on-main.md:291-306`

- **[INFO]** 이 리뷰 세션 자체가 **여전히 수정 전(pre-fix) `REPORT_RETURN_CONTRACT` 문구**로 기동됐다 — `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 미해결 체크박스("새 계약이 실제 실행 경로에 붙는지 다음 세션에서 확인")가 아직 닫히지 않았음을 다시 확인하는 신선한 증거다.
  - 위치: 해당 없음 — 이 리뷰를 기동한 호출 프롬프트 자체(diff 대상 파일 아님). 참조: `plan/in-progress/backend-lint-gate-broken-on-main.md:317-335`
  - 상세: 이번 호출의 "출력 규약" 블록은 `1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도 아래 2·3 은 반드시 수행). / 2) 첫 줄에 STATUS=... / 3) 둘째 줄에 정확히 DELIM...` 이라는 **file/return sink 분리가 없는 구버전 3줄** 그대로였다 — 정확히 이 diff 가 **제거하는** 문구다. `21_12_21` 라운드가 이미 "persisted `ai-review-wf_*.js` 18개 전부가 17300 바이트로 불변" 이라고 실측했고, plan 은 "이 세션 안에서는 원리적으로 닫히지 않는다" 고 명시했다 — 이번 관측은 그 예측과 정확히 일치하며 새로운 결함이 아니다. 다만 소스(`_lib/agent-return.mjs` 및 3개 workflow 미러)는 이미 올바르게 수정돼 있음을 직접 확인했으므로(위 검증 방법 참조), **고쳐야 할 코드는 이미 고쳐져 있고, 남은 것은 caller wrapper 캐시가 새 top-level 세션에서 반영되는지의 사후 확인뿐**이라는 plan 의 판단에 동의한다.
  - 제안: 코드 fix 불요. plan 의 해당 체크박스를 이 세션 안에서 닫으려 하지 말 것(이미 그렇게 기록돼 있음) — 진짜 새 top-level 세션에서 재확인 필요.

- **[INFO]** 신규 계약 1) 항의 "파일은 `#` 제목으로 시작해야 합니다" 는 sub-agent 자신의 "출력 형식" 정의가 실제로 최상단에 `#` 제목을 두도록 강제하는 별도 가드가 없어, 관례에 의존한다.
  - 위치: `.claude/workflows/_lib/agent-return.mjs:61` (`1) **output_file 에는 보고서 마크다운 본문만**...`)
  - 상세: 예컨대 이 `requirement` sub-agent 자신의 system prompt "출력 형식" 절은 `### 발견사항` 으로 시작하도록 정의돼 있고 최상단 `# <제목>` 을 명시적으로 요구하지 않는다(과거 산출물들이 `# 요구사항(Requirement) 리뷰 — ...` 로 시작하는 것은 관례일 뿐 강제된 스펙이 아님). `test_agent_return.mjs`/`test_workflow_scripts.py` 어느 쪽도 실제로 쓰여진 `output_file` 의 첫 줄이 `#` 로 시작하는지 검증하지 않는다(계약 **문구**만 검증하고 다운스트림 산출물은 검증 밖). 기능상 치명적이지 않다 — 헤더/구분자만 없으면 통합 SUMMARY 파싱이 깨지지 않기 때문이다.
  - 제안: 조치 불요(회색지대, spec 이 아니라 관례). 원한다면 후속으로 `output_file` 첫 줄이 `^#\s` 인지 확인하는 가벼운 산출물 가드를 고려할 수 있으나 이번 PR 범위 밖.

- **[INFO]** `.claude/docs/subagent-call-contract.md` §2(줄 23, 26-29) 는 이번 계약 정정과 **불일치가 아니다** — "prompt 에 '출력 규약' 이 붙어 있으면 그쪽이 우선" 이라고 위임할 뿐 file/return 분리 문구를 자체 복제하지 않으므로, SoT 단일화 설계상 정상이다(직접 대조 확인).
  - 위치: `.claude/docs/subagent-call-contract.md:23,26-29`

## 요약

핵심 변경 두 가지 — (1) `REPORT_RETURN_CONTRACT` 를 `output_file`(마크다운 본문 전용) 과 반환 메시지(STATUS+DELIM+전문) 두 sink 로 명확히 분리해 `_lib/agent-return.mjs` 및 3개 workflow(ai-review/consistency-check/merge-coordinate)에 verbatim 미러링한 것, (2) `updateExecutionStatus` self-deadlock JSDoc 의 호출 스택 축(36=9+27 트랜잭션 블록, 20=11+9 호출부) 확정 — 모두 **독립 재계산으로 실측과 완전히 일치**함을 확인했다. 신규 회귀 테스트(`test_agent_return.mjs` 2건, `test_workflow_scripts.py` 1건)도 직접 실행해 13/13, 6/6(17 subtests) GREEN 을 확인했고, 가드 파일명 리네임의 잔여 스테일 참조(직전 라운드 documentation/maintainability 리뷰가 지적했던 워크플로 3개의 로컬 헤더 주석)도 소스 쪽에서 **0건**으로 완전히 정정됐음을 확인했다. plan 체크박스 상태(완료 2건, 미해결 1건 — 실행 경로 반영 확인)도 실제 코드 상태와 정확히 일치한다. 함수 시그니처·에러 코드·상태 전이·필드 정의를 규정하는 `spec/` 문서는 이번 변경 영역(harness 하네스 툴링 + 내부 JSDoc + plan 문서)에 해당하지 않아 spec fidelity 위반이나 spec-drift 는 발견되지 않았다. TODO/FIXME/HACK/XXX 류 미완성 마커도 diff 전체에서 없음을 확인했다. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
