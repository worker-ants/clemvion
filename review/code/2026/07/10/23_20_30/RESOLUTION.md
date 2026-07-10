# RESOLUTION — review/code/2026/07/10/23_20_30

- **대상**: `5e6f70b76` (#501 attribution 하드닝)
- **SUMMARY 집계**: Critical 0 · Warning 1 · Info 6

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
| --- | --- | --- | --- |
| W1 | Warning (documentation) — plan 체크박스 미갱신에 durable 추적 부재 | **defer + durable 등록** (아래 §보류·후속 항목 1). WARNING 이 실제로 요구한 "durable 추적" 은 본 RESOLUTION + PR 설명 + background task chip `task_33bc64aa` 3중으로 해소 | (문서만) |
| INFO#3 | Info (testing) — 대칭 커버리지 갭 | **defer** (§보류·후속 항목 2) | — |
| INFO#1 | Info — import 스타일 결 | **조치 불요.** 수정 대상 파일의 로컬 관례(inline `type` 수식어)를 따른 의도적 선택. `@typescript-eslint/consistent-type-imports` 미활성이라 lint 위반 아님 | — |
| INFO#2 | Info — mock 셋업 반복 | **조치 불요.** 파일 내 기존 3곳의 확립된 패턴을 따른 것. 본 PR 이 도입한 문제 아님 | — |
| INFO#4 | Info — `expect.objectContaining` 초과 필드 미검출 | **조치 불요.** 저장소 전역 관용구. 본 PR 만 강화하면 오히려 불일치 | — |
| INFO#5 | Info — `as string \| undefined` 캐스팅 | **조치 불요.** 본 diff 이전부터 존재, 스코프 밖. 값이 서버 내부 생성 식별자라 보안 영향 없음 | — |
| INFO#6 | Info — CHANGELOG 신규 항목 | **조치 불요.** 런타임 무변경이라 규약상 의무 없음 | — |

### 후속 impl-done 지적에 대한 fix

`--impl-done` consistency (`review/consistency/2026/07/10/23_33_44/`) 가 추가로 3건을 지적했고, 전부 반영했다.

| 출처 | 지적 | 조치 |
| --- | --- | --- |
| rationale-continuity INFO | `ai-turn-executor.ts` 인라인 주석의 TS 규칙 서술이 부정확 — "인자로 직접 넘길 때만 걸린다" 는 **주석 붙은 변수 선언**에도 같은 검사가 적용된다는 점을 누락 | **fix.** "object literal 이 타입이 알려진 대상(함수 인자 또는 주석 붙은 변수)에 직접 assign 될 때만 걸린다" 로 정정 |
| convention-compliance Warning | 본 RESOLUTION 이 developer SKILL 의 3-헤더 스키마(`## 조치 항목` / `## TEST 결과` / `## 보류·후속 항목`)를 리터럴로 쓰지 않음 | **fix.** 본 문서를 해당 스키마로 재작성 |
| plan-coherence Warning | 종결 조건이 `plan/in-progress/resume-llm-usage-attribution.md:53` 의 `- [ ] PR (push + gh pr create)` (#879 시절부터 남은 stale 미체크) 를 누락 | **fix.** §보류·후속 항목 1 의 종결 조건에 추가. task chip 도 교체 — `task_e03a0b87` dismiss → `task_33bc64aa` (세 번째 체크박스 포함) |

## TEST 결과

- **lint**: 통과
- **unit**: 통과 — backend 400 suites / 7952 tests, frontend 271 files / 5295 tests
- **build**: 통과 (최초 실패는 Docker 디스크 포화 → `docker builder prune -af` 로 24.7GB 회수 후 통과)
- **e2e**: 통과 — 249 tests

**추가 mutation 검증** (vacuous test / 무의미 주석 방지):

1. `runTurnWithCollectionRetries` 를 "첫 반복만 `llmContext` 전달, 재시도는 `undefined`" 로 변조 →
   신규 테스트 **단 1건만** 실패, 기존 retry 테스트는 통과. 변조 되돌림.
2. `nodeExecutionId` → `nodeExecutionID` 오탈자 주입 →
   주석 있음: `TS2561` 컴파일 차단 / 주석 없음(대조군): `tsc` 무오류. 변조 되돌림.

> 본 RESOLUTION 의 fix 중 코드에 닿는 것은 **주석 문구 정정 1건**뿐(런타임 무영향)이며,
> 그 커밋 이후 fresh `/ai-review` 를 재실행해 clean 을 확인한다.

## 보류·후속 항목

### 1. W1 — plan 체크박스 갱신 + `plan/complete/` 이동 (별도 pass 로 이관)

**왜 지금 하지 않는가**: `plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1(74-75행)·INFO#4(78-79행) 는
선행 docs PR **#898** 이 편집한 INFO#3(76-77행) 과 빈 줄 없이 인접하다. git 기본 diff context(3줄) 안에서
hunk 가 겹치므로 두 PR 중 나중 것이 merge conflict 를 낸다. 이 위험은 구현 착수 전 `--impl-prep` 의
`plan_coherence` checker 가 W1 으로 사전 경고했고(`review/consistency/2026/07/10/22_52_18/plan-coherence.md`),
그 권고를 따라 **의도적으로** plan 파일을 제외했다. 누락이 아니라 머지 순서를 통제할 수 없는 상황에서의 정합한 선택.

**durable 등록**: 본 RESOLUTION.md(저장소 영구 기록) + PR 설명 + background task chip `task_33bc64aa`.
(초기 chip `task_e03a0b87` 은 종결 조건에 세 번째 stale 체크박스가 빠져 있어 dismiss 하고 `task_33bc64aa` 로 대체했다.)

**종결 조건** — `#898` 과 본 PR 이 모두 main 에 들어간 뒤:

- `plan/in-progress/resume-llm-usage-attribution.md` 의 **INFO#1 · INFO#4** 를 `[x]` 로 갱신.
- **`:53` 의 `- [ ] PR (push + gh pr create)`** 도 `[x]` 로 갱신 — #879 시절부터 남은 stale 미체크이며
  해당 PR 은 이미 origin/main 에 머지됐다. (impl-done plan_coherence 가 검출; 이걸 놓치면
  `plan-lifecycle.md:68` 의 self-check "모든 체크박스가 `[x]`" 를 문자 그대로 통과하지 못한다.)
- 잔여 follow-up 이 전부 소진되므로 `git mv` → `plan/complete/`.
- 이동 시 frontmatter `spec_impact` 를 **YAML 리스트**로 선언 (bare string 은 frontend Gate C unit 실패).
  #898 이 건드린 spec 5개: `spec/1-data-model.md` · `spec/5-system/4-execution-engine.md` ·
  `spec/data-flow/7-llm-usage.md` · `spec/data-flow/6-knowledge-base.md` · `spec/data-flow/13-agent-memory.md`.

> 참고: 이 plan 의 frontmatter `worktree: elastic-shannon-e52824` 는 현재 worktree 명과 달라
> `plan_guard.py` 의 push-gate 가 애초에 이 plan 을 "연결된 plan" 으로 인지하지 않는다 —
> gate 우회가 아니라 gate 미작동 상태다 (impl-done plan_coherence 가 확인).

### 2. INFO#3 — 대칭 커버리지 갭 (테스트, 비차단)

"attribution 이 애초에 `undefined` 인 기본 경로(`retryState()` override 없음)에서 2회차 chat 호출도
여전히 `undefined` 로 유지되는지" 의 역방향 assertion 부재.

**defer 근거**:

- 실제 프로덕션 리스크는 압도적으로 **"attribution 누락/오염"** 방향이고(회귀 #501 이 바로 그것),
  그 방향은 신규 테스트 + mutation 검증으로 견고히 닫혔다.
- 역방향("원래 없는데 재시도 시 값이 새어 들어감")은 발생 경로가 없다 — `runTurnWithCollectionRetries` 가
  루프 전체에서 `params.llmContext` **동일 참조 하나**만 재대입 없이 넘기고 `traceChat` 도 가공 없이
  전달한다. impl-done 의 `rationale-continuity` checker 가 `information-extractor.handler.ts:1019-1145` ·
  `:1881-1899` 를 직접 읽어 이 근거가 **사실과 일치**함을 확인했다.
- 본 PR 의 명시적 제약이 "방금(#877/#879) 안정화된 attribution 코드의 churn 최소화" 다.

**재검토 조건**: `runTurnWithCollectionRetries` 가 루프 내부에서 `llmContext` 를 재계산/변형하도록 바뀌면
즉시 이 assertion 을 추가한다 (그때 발생 경로가 생긴다).
