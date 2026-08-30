# 요구사항(Requirement) 리뷰 — report-return contract 파일/반환 분리 + self-deadlock 호출 스택 축 audit

## 발견사항

- **[WARNING]** JSDoc 감사(audit) 서술의 `.transaction(` 블록 총계·모듈 밖 개수가 실측과 어긋난다 (self-referential grep 추정)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8577` (`**36개**`), `:8583` (`모듈 밖 **27개**`)
    같은 수치가 `plan/in-progress/backend-lint-gate-broken-on-main.md:292`(`**36개**`), `:294`(`모듈 밖 27개`)에도 그대로 반복됨.
  - 상세: 이 JSDoc은 "호출 스택 축도 확인했다 — backend 의 `.transaction(` 블록 **36개**(`*.spec.ts` 제외) 전수, 모듈 안 9개·모듈 밖 27개"라고 주장한다. 같은 방법론(`grep -rn "\.transaction(" src --include="*.ts" | grep -v spec`)으로 리뷰어가 직접 재측정한 결과: 실제 코드상의 `.transaction(` 호출부는 **35개**(모듈 안 9개는 일치 — `execution-engine.service.ts` 8곳 + `retry-turn.service.ts` 1곳, 모듈 밖은 **26개**)이다. `36`/`27`은 각각 1씩 많다. 원인은 자기참조(self-reference) 그렙 오염으로 보인다 — 새로 추가된 이 JSDoc 문단 자체가 산문으로 `` `.transaction(` `` 문자열을 담고 있어(gate 8577의 "backend 의 `.transaction(` 블록 **36개**" 문장 자체), 파일 전체를 대상으로 `grep -c "\.transaction("`을 돌리면 이 프로즈 줄까지 코드 블록으로 잡혀 카운트가 부풀려진다(같은 파일에서 `grep -c` 실측 시 10건이 나오는데 실제 콜백은 8개뿐이고 나머지 2건이 바로 이 JSDoc 문장들이다). 모듈 안 9개·"콜백이 `updateExecutionStatus`에 도달하지 않는다"는 결론과 "모듈 밖에서 엔진 서비스를 참조하는 유일한 트랜잭션 파일은 `executions.service.ts`뿐이고 그 트랜잭션 바디는 `manager`만 쓴다"는 결론은 리뷰어가 각 블록을 직접 열어 독립 재검증했고 **모두 사실과 일치**했다 — 안전성 결론 자체는 무너지지 않는다. 다만 이 JSDoc은 바로 아래 문단에서 "초판은 '11곳 전수 대조'라고 적었는데 그 11은 이 파일 안만 센 수였다 — `18_10_28`이 잡았다"며 과거 스코프 오기를 자체 반성하는 이력을 담고 있는 블록인데, 이번 판도 정확히 같은 실패 유형(측정 방법 오염으로 인한 수치 오기)을 새로 만들었다.
  - 제안: `36`→`35`, `27`→`26`으로 정정(모듈 안 9개는 유지). 재측정 시 프로즈 안의 `` `.transaction(` `` 리터럴 언급이 그렙에 섞이지 않도록 코드 블록만(예: `grep -n "\.transaction(" ... | grep -v ':\s*\*'` 또는 실제 호출 syntax만) 대상으로 하는 방법을 명시하거나, 이 JSDoc 자체를 감사 대상에서 제외하는 표기(예: 백틱 없이 서술)를 쓸 것. `plan/in-progress/backend-lint-gate-broken-on-main.md`의 동일 서술도 함께 정정 대상 — 두 곳 다 developer 소유 파일(`codebase/`, `plan/`)이라 `project-planner` 위임 불요, 직접 fix 가능.

- **[INFO]** 이 리뷰 세션 자체가 수정 전(pre-fix) `REPORT_RETURN_CONTRACT` 문구로 호출됨 — 회귀가 아니라 부트스트래핑 아티팩트로 판단
  - 위치: 해당 없음 (리뷰 세션 자체의 호출 프롬프트 — 리뷰 대상 diff 파일이 아님)
  - 상세: 본 리뷰를 기동한 프롬프트의 "출력 규약" 블록이 이 diff가 **제거하는(구버전)** 3줄 문구("1) 결과를 output_file 에 Write 하세요 (best-effort — 실패해도 아래 2·3 은 반드시 수행). / 2) 첫 줄에 STATUS=... / 3) 둘째 줄에 정확히 DELIM...")와 정확히 일치했다 — file/return 분리("output_file 에는 마크다운 본문만") 문구가 없는, 이 PR이 고치려는 바로 그 구버전이다. `.claude/` 전체에서 이 구문구를 grep했을 때 diff가 손대는 4개 정본(`_lib/agent-return.mjs` + 3개 workflow) 외에 다른 저장소 소스는 전혀 없었다 — 즉 저장소 안에 놓친 5번째 사본은 없다. 가장 개연성 있는 설명은, 이 리뷰를 기동한 오케스트레이션 경로가 (아직 머지되지 않은) 이 PR의 수정 **이전** 버전의 `ai-review.js`로 파이프라인을 구성했다는 자기참조적 부트스트랩 상황이다(리뷰 대상 diff가 리뷰 파이프라인 자체를 고치는 PR이므로).
  - 제안: 코드 fix 불요 — 관측 사실만 기록. 다만 이 PR이 머지된 뒤 동일 계열의 review/consistency/merge 세션을 한 번 더 돌려, 새 프롬프트가 실제로 새 문구("output_file 에는 보고서 마크다운 본문만... STATUS/DELIM 넣지 마세요")로 attach되는지 caller 측에서 사후 확인해 볼 가치는 있다.

## 검증 요약 (재현 가능)

- `test_agent_return.mjs` 13/13 통과(`node --test`) 확인. `test_workflow_scripts.py` 5 passed/9 subtests 확인 — 3개 workflow의 SHARED-BLOCK이 `_lib/agent-return.mjs` 정본과 verbatim 일치함을 기계적으로 보증.
- 뮤테이션 재검증: `_lib/agent-return.mjs`의 `REPORT_RETURN_CONTRACT` 1~3항을 구버전 3줄로 되돌린 사본(저장소 밖 scratch)에서 테스트를 돌리면 정확히 **11 pass / 2 fail**(신규 두 테스트만 RED) — PR 서술("반영 안 하면 기존 11개는 GREEN, 신규 2개는 RED")과 정확히 일치. 두 신규 단언은 vacuous가 아니다.
- `review/**`의 산출물 오염 규모 재실측: 1행이 `^STATUS=`인 파일 **536개**, 그중 2행이 `===REPORT_MARKDOWN_BELOW===`인 파일 **271개** — PR 서술과 정확히 일치(개수 오차 0). 종전 오기였다고 정정한 "825개"(느슨한 `grep -rl "^STATUS="`, 파일 내 아무 줄이나 매치)도 재측정하면 824(±1, 시간차)로 재현되어 "느슨한 grep이 부풀린 값이었다"는 자체 진단도 타당함을 확인.
- `updateExecutionStatus` self-deadlock 호출 스택 축 주장 중 정성적 결론(모듈 안 9개 블록 전부 콜백에서 `updateExecutionStatus` 미도달, 모듈 밖에서 엔진 서비스를 참조하는 유일한 트랜잭션 파일 `executions.service.ts`의 트랜잭션 바디가 `manager`만 사용)은 각 콜백 바디를 직접 열어 확인했고 전부 사실이었다. 정량 수치(36/27)만 위 WARNING 대상.
- 저장소 트리 변경 없음 — 검증 중 만든 임시 대조 파일(`status_first_line_list.tmp`)은 확인 후 삭제, `git status --short` 로 clean 확인. 뮤테이션 재현은 전량 저장소 밖 scratch 디렉터리에서 수행.

## 요약

이 변경은 두 개의 독립된 실제 결함을 수정한다: (1) `.claude/workflows/_lib/agent-return.mjs` 및 3개 workflow 미러의 `REPORT_RETURN_CONTRACT`가 `output_file`(파일)과 반환 메시지 두 sink를 구분하지 않아 sub-agent들이 STATUS 헤더·구분자를 파일에도 섞어 써 `review/**` 산출물 536개가 오염된 것을 원천 차단(파일=마크다운 본문만로 명시 스코프), (2) `execution-engine.service.ts`의 `updateExecutionStatus` self-deadlock 감사에서 이전에 명시했던 "어휘적 범위만 확인했다"는 한계를 호출 스택 축까지 채워 해소. 두 수정 모두 실측·테스트로 뒷받침되며(신규 mjs 테스트 2건이 뮤테이션에 RED로 반응, `test_workflow_scripts.py` 드리프트 가드 통과, `536`/`271` 수치 정확 재현), self-deadlock 감사의 정성적 결론도 독립 재검증에서 사실로 확인됐다. 유일한 흠은 그 감사 JSDoc(및 plan 파일에 동일 반복된) 자체의 정량 수치 `.transaction(` "36개"/"모듈 밖 27개"가 자기참조 그렙 오염으로 실측(`35`/`26`)보다 1씩 부풀려진 것 — 기능·런타임에는 영향 없는 문서 정확도 결함이나, "전수 재검증했다"는 이 JSDoc의 존재 이유 자체를 스스로 훼손하는 종류의 오류라 WARNING으로 남긴다. TODO/FIXME류 미완성 표시나 반환값 누락, spec 불일치(파일 1-5는 `.claude/` 하네스 툴링이라 `spec/` 대상 밖, 파일 6은 순수 주석 변경이라 `spec/5-system/4-execution-engine.md` 본문 자체에 영향 없음)는 발견되지 않았다.

## 위험도

LOW
