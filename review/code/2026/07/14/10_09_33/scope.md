# 변경 범위(Scope) 리뷰 — AI Agent 도구 정의 payload 예산 가드레일

대상 커밋셋(20 파일): 구현 4(`ai-turn-executor.ts/.spec.ts`, `tool-payload-budget.ts/.spec.ts`) + plan 2 + consistency-check 산출물 11 + spec 3.

## 발견사항

- **[INFO]** 구현 코드(`ai-turn-executor.ts`)의 실제 변경 범위는 plan 문서가 명시한 "본 PR 범위(구현 완료)" — estimator SoT 호출 + `buildTools` 직후 fail-fast + single-turn `error` 포트 라우팅 + multi-turn throw 전파 — 를 정확히 벗어나지 않는다.
  - 확인: import 추가(1곳), `executeSingleTurn` 내부(타이밍 변수·config-echo 조립·try/catch), `buildTools` 메서드 끝(`enforceToolPayloadBudget` 호출) 3곳으로 국한. plan 이 후속 PR 로 명시적으로 분리한 두 항목 — (a) `saveCanvas` config-time graph warning, (b) resume 턴 `timeoutMs`/`signal` 배선 — 은 diff 어디에도 나타나지 않는다(별도 `ai-agent-tool-payload-budget-followups.md` 로 정확히 분리됨). 스코프 이탈 없음.

- **[INFO]** `singleTurnConfigEcho` 를 메서드 하단(정상 종결부)에서 `buildTools` 호출 이전으로 재배치한 것은 겉보기엔 리팩토링이지만, "정상 `out` 종결과 §4.2 payload-budget `error` 종결이 **동일 config echo shape** 을 공유해야 한다"는 명시된 요구(Principle 7)를 만족시키기 위한 필수 구조 변경이다. 코드 중복 없이 단일 조립 지점으로 통합했고 그 외 무관한 재정렬은 없음 — 불필요한 리팩토링 아님.

- **[INFO]** 신규 파일 `tool-payload-budget.ts` 는 estimator(`estimateAgentToolPayload`) + budget enforcement(`enforceToolPayloadBudget`) + 에러 클래스만 담고 있으며, 기능이 spec draft(D1/D2, 이후 `spec/4-nodes/3-ai/1-ai-agent.md` §4.2·§10 본문)에 1:1 대응한다. `perProvider`/`culpritProvider` 그룹핑도 스펙이 요구하는 "범인 provider 지목" 요건이지 임의 확장이 아니다. 관측 로깅(`logger.warn`)·env override 3종도 계획된 soft/hard/count 3축 그대로 — over-engineering 징후 없음.

- **[INFO]** import·주석 추가는 전부 신규 로직을 직접 설명하는 것으로, 무관한 임포트 정리나 주석 이동/삭제는 발견되지 않았다.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md`(§4.2 신규, §10 표 1행, §12.15 rationale), `spec/5-system/11-mcp-client.md`(§5.8 신규), `spec/conventions/cross-node-warning-rules.md`(status: implemented→partial, §5 backend-only 예외 조항, §8 표 1행) 는 plan 문서 "Phase 1 — Spec 갱신(project-planner, 본 PR 포함)" 이 사전 정의한 D1~D5 draft 를 그대로 반영한 것으로, 코드 구현 범위와 정확히 대응한다. 다른 절/무관한 섹션에 대한 부수 편집은 없음.

- **[INFO]** `review/consistency/2026/07/14/{08_49_37,09_04_19}/**` (consistency-check 산출물 2회분, 1차 BLOCK + 2차 재실행)이 diff 에 포함돼 있다. 이는 CLAUDE.md 가 강제하는 "project-planner 는 spec/ 쓰기 직전 consistency-check --spec 의무" 절차의 감사 추적 산출물이며, `review/consistency/**` 는 consistency-checker 전용 쓰기 영역(developer 소관 아님)이다. 코드 diff 자체에 스코프를 벗어나는 로직 변경을 유입시키지 않으며, 프로젝트 관례상 정상 동반 산출물 — 스코프 이탈로 보지 않음. (참고 수준: 1차 BLOCK 런 산출물까지 영구 보존할지는 별개의 plan-lifecycle 판단이나, 본 리뷰 관점(Scope) 밖.)

- **[INFO]** 테스트 파일(`ai-turn-executor.spec.ts` 신규 describe 블록, `tool-payload-budget.spec.ts` 신규 파일)은 새로 추가된 동작(soft warn/hard throw/count throw, culprit 지목, error 포트 shape, multi-turn throw 전파)만을 검증하며 기존 테스트를 건드리거나 무관한 스냅샷/포맷을 바꾸지 않았다.

## 요약

구현 코드(`ai-turn-executor.ts/.spec.ts`, `tool-payload-budget.ts/.spec.ts`)는 plan 문서가 사전에 명시적으로 확정한 "본 PR 범위"를 정확히 지키고 있으며, 후속으로 분리하기로 한 saveCanvas config-time 경고·resume timeout/signal 배선은 diff 에 나타나지 않는다. config-echo 위치 이동은 목적이 분명한 필수 구조 변경이지 드라이브바이 리팩토링이 아니고, 무관한 포맷팅·주석·임포트 정리도 발견되지 않았다. spec 3파일·plan 2파일·consistency-check 산출물 11파일이 함께 포함돼 diff 규모가 크지만, 이는 프로젝트가 강제하는 SDD 워크플로(consistency-check → spec 갱신 → 구현 → 동일 PR 내 단계별 커밋)의 정상 산물이며 코드 자체의 스코프 이탈은 아니다.

## 위험도
NONE
