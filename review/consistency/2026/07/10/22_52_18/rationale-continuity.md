# Rationale 연속성 검토 — #501 후속 attribution 하드닝 (impl-prep)

- target: `/private/tmp/claude-501/-Volumes-project-private-clemvion--claude-worktrees-llm-usage-doc-alignment-01d7a4/9b5ca835-aa0d-4284-9bf6-3602bfcb6c7a/scratchpad/impl-prep-draft.md`
- 대상 spec Rationale: `spec/5-system/4-execution-engine.md:1378-1385`("resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)"), `spec/data-flow/7-llm-usage.md` `## Rationale` "`llm_usage_log` 의 nullable context 컬럼들"
- 관련 plan: `plan/in-progress/resume-llm-usage-attribution.md`, `plan/complete/fix-resume-turn-usage-log-attribution.md`, `plan/complete/refactor/03-maintainability.md` (M-7)

## 발견사항

0건 (CRITICAL/WARNING/INFO 없음). 아래는 판정 근거 기록.

### 검토 1 — 변경 (e)(타입 주석)·(g)(테스트 추가)가 Rationale 의 강제 수단을 강화하는가

`spec/5-system/4-execution-engine.md:1382`: "현재 이 불변식은 회귀 테스트(...)로만 강제되므로,
`CREDENTIAL_CONTEXT_FIELDS`/`resumeStateSchema` 를 리팩터할 때 이 spec 불변식을 근거로 두 식별
필드의 재주입을 반드시 보존한다."

- 변경 (g)는 이 문장이 명시한 강제 수단(회귀 테스트)을 IE `collection retry` 2번째 chat 으로
  **확장**하는 것이다. 기존 테스트(`information-extractor.handler.spec.ts:921` 부근)는 1번째 호출만
  단언하고, 대칭 선례(`ai-turn-executor.spec.ts:520`, ai_agent tool-loop 2번째 chat)가 이미 존재함을
  실제 코드로 확인했다(`information-extractor.handler.ts:1037` `traceChat(... params.llmContext)`
  가 루프의 매 호출마다 동일 `llmContext` 를 전달). 커버리지 격차를 메우는 방향이며 새 대안 도입이
  아니다.
- 변경 (e)는 Rationale 이 우려하는 계층(`buildRetryReentryState`/`CREDENTIAL_CONTEXT_FIELDS`/
  `resumeStateSchema` 재구성 계층)과는 **다른, 인접 계층**(`ai-turn-executor.ts:2599` 소비 사이트의
  local object literal)의 안전망이다 — `state.workflowId`/`state.nodeExecutionId` 자체가 존재하지
  않게 되는 리팩터 회귀는 이 타입 주석이 잡지 못하며(옵셔널 필드라 `undefined` 허용), 잡는 것은
  필드 **오탈자**(`nodeExecutionID` 등)로 인한 excess-property 누락뿐이다. draft 자체가 이 범위를
  정확히 그렇게 서술하고 있어(§변경(e) "근거"), Rationale 이 요구하는 보장 범위를 벗어난 과잉 주장은
  없다. 즉 "강화"이되, Rationale 문장의 "회귀 테스트로만 강제된다"는 서술을 무효화하지는 않는다 —
  두 메커니즘은 서로 다른 실패 모드를 잡으므로 병존 가능하고 상충하지 않는다.

판정: (e)·(g) 모두 기각된 대안의 재도입이 아니라 기존 Rationale 결정을 실제로 강화하는 방향이며,
draft 의 출처(`plan/in-progress/resume-llm-usage-attribution.md:74,78` INFO#1/INFO#4 — 직전
#877/#879 PR 의 최종 /ai-review 산출물)로도 뒷받침된다. 새 Rationale 미기재가 문제될 결정 번복은
없음 (아래 검토 3 참고).

### 검토 2 — M-7 "`z.custom<T>()` = 런타임 무검증(identity)" 결론과의 모순 여부

`plan/complete/refactor/03-maintainability.md:227`(스키마 enrich 클러스터): "`z.custom<T>()` 로
enrich — 런타임 validator **미추가**(zod v4: predicate 없으면 identity `()=>true`, 모든 값 통과),
`z.infer` 타입만 concrete domain 으로 sharpen." + impl-done 산출물 인용 "rationale-continuity:
z.custom=런타임 무검증 확인."

이 결론은 **zod 스키마의 `z.custom()`** 이 런타임 검증을 제공하지 않는다는 것이지, "TS 타입 주석
일반이 아무것도 강제하지 못한다"는 일반 명제가 아니다. 두 메커니즘은 성격이 다르다:

- `z.custom<T>()` (M-7 대상): zod `.parse()`/`.safeParse()` 를 **호출해도** predicate 가 없으면
  아무 값도 거부하지 않음 — 런타임 게이트로서 무효.
- TS 타입 주석 + excess-property check (변경 (e) 대상): `tsc` **빌드 시점**에 fresh object literal
  의 초과/오탈자 프로퍼티를 컴파일 에러로 잡는다 — 이는 CI 빌드 게이트를 통과하려면 반드시 고쳐야
  하는 실질적 강제이며, "타입은 소비를 강제 못 한다"는 취지와는 다른 층위(구조적 오탈자 방지 vs.
  런타임 값 검증)다. draft 도 "타입 주석이 이를 **컴파일 타임**에 잡는다"고 정확히 그 범위로
  한정해 서술한다.
- 검색 결과 `plan/complete/`·`plan/in-progress/` 어디에도 "TS 타입 주석만으로는 소비를 강제할 수
  없다"는 취지의 **일반** 결론은 없었다(M-7 은 zod predicate 부재에 국한). 오히려 M-7 자체가 named
  type(`ResumeState`/`RetryState`)·`narrowResumeState` 등 타입 레벨 구조 정리를 "고가치"로 채택한
  선례라 변경 (e)의 방향(타입 정밀화)과 같은 계열이다.

판정: 모순 없음. M-7 의 "런타임 무검증" 결론은 zod predicate 부재 사안이고, 변경 (e)는 별개의
컴파일 타임 메커니즘이라 그 결론을 무효화하거나 반박하지 않는다.

### 검토 3 — "attribution 코드 churn 리스크"로 미룬 결정의 우회적 선취 여부

`plan/in-progress/resume-llm-usage-attribution.md:72-79`(최종 /ai-review INFO 섹션)에 draft 의
두 변경 항목(INFO#1=변경(e), INFO#4=변경(g))이 원문 그대로 등재돼 있고, "review-loop 재무장
방지로 본 PR 미포함 → 별도 PR" 로 명시적으로 예정돼 있었다. 즉 이번 draft 는 **새로 발견한 우회
경로가 아니라 이미 계획된 후속**이다.

"재개 식별 필드 hydration 공용화"를 churn 리스크로 미뤘다는 취지의 명시적 과거 결정은
`plan/complete/`·`spec/` 전수 검색에서 발견되지 않았다(`grep "재개 식별\|churn 리스크"` 0건,
관련 유사어 "churn 최소화" 1건은 무관한 `refactor-cron-to-bullmq.md` 항목). draft 자체가 밝힌
"방금(#877/#879) 안정화된 attribution 코드라 churn 최소화가 의도적 제약"은 draft 작성자가 스스로
부과한 스코프 제약이지, 과거 spec/plan 이 명시적으로 유보한 결정을 우회 선취하는 것이 아니다.
오히려 이 태도는 `plan/complete/refactor/03-maintainability.md:82`(C-3/M-4 "조기 일반화 회피")나
M-7 "잔여 defer"(§03-maintainability.md:229, "재기 조건부") 계열의 기존 원칙 — 안정화된 코드의
불필요한 일반화·리팩터를 미루고 필요시에만 재기 — 과 정합된다.

판정: 우회 선취 없음. 오히려 기존 "조기 일반화 회피" 원칙과 정합.

## 요약

target draft 의 두 변경(타입 주석 (e), 회귀 테스트 확장 (g))은 모두 `spec/5-system/4-execution-engine.md`
Rationale 의 "#501 식별 필드 재유도 불변식" 항이 명시한 강제 수단(회귀 테스트)을 그대로 계승·확장하는
방향이며, `plan/in-progress/resume-llm-usage-attribution.md` 최종 /ai-review 에서 이미 계획된 INFO
항목의 실행이다. M-7 의 "`z.custom<T>()` = 런타임 무검증" 결론은 zod predicate 부재에 국한된 것으로
변경 (e)의 컴파일 타임 TS 메커니즘과 층위가 달라 모순되지 않으며, "재개 식별 필드 hydration 공용화"류의
churn-deferred 결정이 우회되는 정황도 발견되지 않았다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거
결정 번복, invariant 우회 — 4개 관점 모두 위반 없음.

## 위험도

NONE

STATUS: DONE
