# Plan 정합성 검토 — `spec/4-nodes/4-integration/` (impl-prep)

대상 작업: `plan/in-progress/ssrf-guard-integration-unify.md` (owner: developer, `spec_impact: none`) —
`http-safety.ts`(HTTP Request·Database Query)와 `ssrf.util.ts`(SMTP·LLM·S3)의 SSRF 판정 불일치를
`http-safety.ts` 기준으로 통일한다. 코드 변경 전 단계(diff 없음, `git status` 확인).

## 발견사항

- **[WARNING]** `spec-draft-nullable-notation-followups.md` 트래커의 `developer→planner` 태그 항목을
  planner 턴 없이 developer 단독 판단으로 닫는다
  - target 위치: `plan/in-progress/ssrf-guard-integration-unify.md` "할 것" §1~§2 (SMTP 가드를
    `http-safety` 로 흡수 — 코드만 변경, spec 변경 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4777-4779` — «SMTP SSRF
    가드에 CGNAT 대역이 없는데 §5.5 는 막는다고 적는다» 항목이 `(developer→planner, 2026-09-19
    등재)` 로 명시 태깅되어 있고, 항목 본문이 "가드를 맞출지(코드)·문장을 맞출지(spec)" 를 **열린
    질문**으로 남겨뒀다. 이 프로젝트에서 `→planner` 태그는 관례상 "developer 권한 밖 → planner
    턴이 선행"(`plan/complete/HANDOFF-eia-terminal-payload.md:68`, `plan/in-progress/execution-engine-residual-gaps.md:62` 등 다수 선례, "우회 금지" 명시)을 뜻해 왔다.
  - 상세: 새 plan 은 이 질문에 "코드를 spec 에 맞춘다"고 스스로 답하고 트래커 항목을 해소 대상으로
    삼는다(체크리스트 "트래커 두 항목 해소"). 결론 자체는 근거가 탄탄하다 — `spec/2-navigation/4-integration.md:523`
    와 `spec/4-nodes/4-integration/3-send-email.md §4` 7번이 이미 "SMTP 는 HTTP/DB 와 **동일한
    메커니즘·플래그**로 CGNAT 를 막는다" 고 모호함 없이 서술하고 있어(§4 SSRF opt-out callout,
    §8.2 Rationale 의 2026-06-11 "전 인증 방식 공통" 사용자 결정과도 정합), 실제로는 spec 이 이미
    답을 정해 놓은 **정확성 버그**이지 새 정책 트레이드오프가 아니다. 이 프로젝트의 planner-턴
    강제 규칙도 명시적으로 "spec/ **쓰기**가 필요할 때" 로 좁혀져 있고, 본 plan 은 `spec_impact: none`
    으로 spec 을 전혀 건드리지 않으므로 규칙 문언상 developer 단독 진행이 위반은 아니다. 다만
    트래커 항목 자체가 "developer→planner" 로 명시 escalate 된 상태에서, **왜 이번엔 planner 턴이
    불필요한지**(= spec 문장이 이미 명확·정확해 spec 변경 자체가 없다)를 트래커 닫는 문장에 남기지
    않으면, 이후 이 트래커를 훑는 사람이 "→planner 항목이 developer plan 에 의해 조용히 우회됐다"
    로 오독할 위험이 있다. 선례(`plan/complete/spec-draft-setup-error-classification.md:475` "트래커
    항목을 developer → planner 완료 + developer 후속 으로 재기술")는 이런 경우에도 해소 사유를
    트래커에 명문화하는 패턴을 보인다.
  - 제안: (a) target/코드 변경 방향은 그대로 진행하되, (b) `spec-draft-nullable-notation-followups.md`
    의 해당 항목을 체크할 때 "spec 문장(§5.5·§4 step7)이 이미 명확·정확함을 확인 → spec 변경
    불필요 → planner 턴 생략, `plan/complete/ssrf-guard-integration-unify.md` 참조" 한 줄을 남겨
    `→planner` 태그가 의도적으로 생략된 것이지 우회된 것이 아님을 문서로 고정한다.

- **[INFO]** TEST WORKFLOW 단계가 마주칠 pre-existing 실패는 이 plan 과 무관 — 사전 인지용
  - target 위치: `ssrf-guard-integration-unify.md` 체크리스트 "TEST WORKFLOW (lint · unit · build · e2e)"
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md`(backend eslint, 79개 파일
    pre-existing 실패, origin/main 자체가 깨짐) · `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`(`expression-engine` unit 컴파일 실패, origin/main 자체가 깨짐)
  - 상세: 두 항목 모두 이 SSRF plan 의 diff 범위(`nodes/integration/http-request/http-safety.ts`,
    `common/utils/smtp-host-guard.ts`, 관련 spec 파일)와 무관한 **선재(pre-existing) main 브레이크**로
    이미 별도 P1 plan 에 추적 중이다. lint/unit 스테이지 실행 시 이 두 원인으로 인한 실패가 섞여
    나올 수 있으니, diff 밖 파일의 실패로 판명되면 (cafe24-backlog-residual.md 등 기존 선례처럼)
    "본 PR 무관 pre-existing" 으로 diff-scope 해 판단하면 된다. 이 plan 자체의 결함은 아니다.
  - 제안: 별도 조치 불요 — TEST WORKFLOW 결과 해석 시 위 두 plan 을 pre-existing 실패의 근거로
    인용만 하면 된다.

## 요약

`ssrf-guard-integration-unify.md` 는 실측(scratch 프로브)으로 `http-safety.ts`(HTTP/DB)와
`ssrf.util.ts`(SMTP/LLM/S3) 두 SSRF 구현의 판정 불일치(CGNAT·IPv4-mapped IPv6·`[::]`)를 확인하고,
`spec/4-nodes/4-integration/1-http-request.md`·`2-database-query.md`·`3-send-email.md`·
`spec/2-navigation/4-integration.md §5.5` 가 이미 선언한 "SSRF 는 세 노드가 동일 메커니즘·플래그"
라는 명제에 코드를 맞추는 방향(spec 변경 없음)으로 계획을 세웠다. 방향 자체는 spec 문언과 완전히
정합하고 다른 in-progress plan(node-output-redesign 3종·chat-channel-adapter 매핑·EIA 등)의 전제나
후속 항목을 무효화하지 않는다(호출 시그니처·에러 코드 이름 불변, LLM/S3 는 명시적 비대상으로 분리
등재 예정). 유일한 절차적 흠은 트래커에 `developer→planner` 로 명시 escalate 된 항목을 developer
plan 이 planner 턴 없이 스스로 해소한다는 점인데, 그 결론이 이미 명확한 spec 문언에 근거해 실질
정합성 리스크는 낮다 — 다만 트래커 종결 시 그 판단 근거를 남기지 않으면 "결정 우회" 로 오독될
여지가 있어 WARNING 으로 남긴다.

## 위험도

LOW
