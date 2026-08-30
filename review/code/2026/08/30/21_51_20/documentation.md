# 문서화(Documentation) 리뷰

## 배경

이 changeset 은 `.claude/` 하네스의 `REPORT_RETURN_CONTRACT` file/return sink 분리 계약 정정
(파일 1~6) + `execution-engine.service.ts` 의 `updateExecutionStatus` self-deadlock JSDoc
호출 스택 축 감사(파일 7) + 관련 plan 문서(파일 8~10) + 이미 4라운드(`20_21_06` →
`20_46_48` → `21_12_21` → `21_34_15`)를 거쳐 Critical 0 · Warning 0(4라운드째)로 수렴한
리뷰 산출물(파일 11~54)로 구성된다. 과거 라운드 서술을 그대로 받지 않고 저장소 현재 상태를
직접 재확인했다(`Read`/`Grep`/`Bash` 만 사용, 저장소 뮤테이션 없음 — 아래 검증 메모 참고).

## 발견사항

없음. 아래 검증에서 신규 CRITICAL/WARNING/INFO 급 문서화 결함을 찾지 못했다 — 과거 4라운드가
지적한 항목(가드 파일명 절반 리네임, 오지 않은 날짜 "2026-08-31" 11곳, JSDoc "9" 이중 지시
혼동, 세는 방법 안내의 수치 비대칭)이 전부 실제로 정정돼 있음을 독립 재현으로 확인했다.

## 검증 메모 (독립 재현, 뮤테이션 없음)

- **날짜**: `grep -rn "2026-08-3[01]"` 를 관련 9개 파일(`.claude/tests/test_agent_return.mjs`,
  `_lib/agent-return.mjs`, 3개 workflow 미러, `execution-engine.service.ts`,
  `backend-lint-gate-broken-on-main.md`, `update-returning-tuple-shape.md`,
  `spec-draft-raw-query-results.md`) 에 돌린 결과 **"2026-08-31" 잔여 0건** — 전부
  `2026-08-30`(오늘 날짜, 커밋 날짜와 일치)로 정정돼 있다.
- **SHARED-BLOCK 미러 무결성**: `_lib/agent-return.mjs`/`ai-review.js`/`consistency-check.js`/
  `merge-coordinate.js` 4개 파일의 `>>> SHARED-BLOCK`~`<<< SHARED-BLOCK` 구간을 `awk` 로
  추출해 `diff` 했다 — **3파일 모두 정본과 바이트 단위로 완전히 동일**.
  `test_agent_return.mjs`(13/13)·`test_workflow_scripts.py` 가 기계적으로 같은 사실을 보증한다.
- **가드 파일명 리네임 잔여**: `grep -rln "test_workflow_shared_block" --include="*.js"
  --include="*.mjs" --include="*.py" --include="*.ts"` 를 저장소 전수로 돌린 결과 유일한
  잔여는 `.claude/tests/test_workflow_scripts.py:119` 의 신규 테스트
  (`test_guard_filename_references_point_at_this_file`) docstring 안 문장인데, 이는 "가드
  테스트 파일이 …로 바뀌었는데 마커 줄만 갱신되고 헤더 주석 3곳이 옛 이름을 계속
  가리켰다"는 **과거 드리프트 사고를 설명하는 의도된 역사적 인용**이다 — 해당 테스트는
  `LIB`/`FAN_OUT` 대상 파일만 스캔하고 자기 자신(테스트 파일)은 스캔하지 않으므로 자기참조
  오탐이 아니다. 3개 워크플로의 `SHARED-BLOCK` 마커 줄과 그 위 "Editing rule" 헤더 주석
  모두 `test_workflow_scripts.py` 를 정확히 가리킴을 직접 열어 재확인했다.
- **`.transaction(` 수치 3종 독립 재현** — `execution-engine.service.ts` JSDoc(8571~8580행)이
  주장하는 세 수치를 각각 다른 grep 패턴으로 재계산:
  - "36개(모듈 안 9 + 밖 27)" — 제네릭 인자 포함(`\.transaction\s*<\|\.transaction\s*(`),
    `*.spec.ts`/주석 줄 제외 → **정확히 36개**, `execution-engine.service.ts`(8) +
    `retry-turn.service.ts`(1) = **모듈 안 9개**, 나머지 **27개**. 오차 0.
  - "35(제네릭 누락)" — 제네릭 패턴 없이(`\.transaction\s*(`), 주석 줄 제외 → **정확히 35개**.
  - "39(주석 포함)" — 제네릭 포함, 주석 줄 미제외 → **정확히 39개**(JSDoc 프로즈 자신의
    `` `.transaction(` `` 리터럴 언급이 섞여 자기참조로 부푸는 3~4줄 포함).
  세 수치 모두 JSDoc 서술과 정확히 일치 — "세는 방법이 축의 일부" 라는 JSDoc 의 경고 문구
  자체가 실측으로 뒷받침된다.
- **"536개/271개" 재현** — `review/**` 전수(`find ... -exec awk 'FNR==1 && /^STATUS=/'`)로
  1행이 `STATUS=` 로 시작하는 파일을 세면 **정확히 536개**, 그중 2행이 정확히
  `===REPORT_MARKDOWN_BELOW===` 인 것은 **정확히 271개** — `_lib/agent-return.mjs`·
  `backend-lint-gate-broken-on-main.md` 양쪽의 서술과 오차 0으로 일치.
- **`.claude/tests/README.md`** — `test_workflow_scripts.py` 항목이 이미 정확한 파일명과
  정확한 커버리지 서술(workflow JS 문법 + SHARED-BLOCK 미러 무결성)로 기재돼 있어 갱신 불요.
- **`.claude/docs/subagent-call-contract.md`** — §2 는 "prompt 에 '출력 규약' 이 붙어 있으면
  그쪽이 우선한다" 고만 위임하고 파일/반환 메시지의 정확한 문구를 복제하지 않는다. 이는
  이번 계약 변경과 **불일치가 아니다** — SoT 를 워크플로 쪽에 단일화하는 설계라 애초에
  드리프트가 발생할 수 없는 구조다.
- **`CHANGELOG.md`** — `## ` 항목 98개 전수에 `.claude/`·harness 관련 항목이 0건. 이번 diff
  는 harness 툴링 + 백엔드 순수 주석뿐이라 이 저장소의 기존 관례(제품 변경만 기록)상
  갱신 대상이 아니라는 4라운드 전체의 판단이 유지된다.
- 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인 시 이번 리뷰 세션 산출
  디렉터리 외 잔여물 없음). 중간 계산은 전부 scratch 디렉터리(`/private/tmp/claude-501/...`)와
  파이프라인 출력에서만 수행했다.

## 요약

이 changeset 의 핵심 문서화 작업(파일 vs 반환 메시지 sink 분리 계약, self-deadlock 확인의
호출 스택 축 JSDoc, plan 갱신)은 4라운드에 걸쳐 지적된 문제(가드 파일명 절반 리네임, 도래하지
않은 미래 날짜, JSDoc 수치 비대칭·이중 지시 혼동)를 전부 실제로 해소한 상태이며, 이번 라운드에서
독립적으로 재현한 모든 핵심 수치(36/9/27, 35, 39, 536/271)와 텍스트 대조(날짜, 미러 바이트
동일성, 가드 파일명 잔여)가 오차 없이 일치했다. 새로 도입된 결함은 관측되지 않았다.

## 위험도

NONE
