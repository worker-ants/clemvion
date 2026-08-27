# Plan 정합성 검토 — `spec/5-system/` (masking-residuals, impl-done)

## 조사 방법
`origin/main...HEAD` 의 실제 diff(커밋 `348c2b3c`~`006b8aa2`)를 절대경로 워크트리에서 직접 열어
확인했다. 핵심 변경은 config echo 마스킹을 엔진 boundary(`handler-output.adapter.ts`)에서
egress(REST/WS)로 옮긴 것 — `plan/complete/masking-expression-egress-split.md` (완료 처리됨) +
`spec_impact` 6개 spec 파일 정정 + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
갱신. 프롬프트에서 두 컨텍스트(target spec 본문, plan 목록)가 전량 예산 초과로 생략되었기 때문에
실제 diff 와 두 파일을 직접 Read/grep 하여 아래를 확인했다.

## 발견사항

- **[WARNING]** `node-output.md` Principle 0 의 `config` 정의가 이번 변경 뒤에도 구식 서술로 남아 있다
  - target 위치: `spec/conventions/node-output.md:23` — `- \`config\`: 해석된 설정값 (자격증명 제거)`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (이 파일이 `node-output.md`
    Principle 0 관련 항목들의 정본 트래커임 — 예: L120 wire-only 키 항목, L322/331 Principle 0 참조).
    이 트래커에 **해당 라인에 대한 항목이 없다**.
  - 상세: 이번 PR 이 같은 파일의 **Principle 7 인접 절**(L154 부근, `spec_impact` 목록에 명시)에
    "마스킹은 egress 에서만 한다 — 표현식은 원문을 읽는다" 를 신설하고, `NodeExecution.outputData`
    의 `config` 가 이제 **원문으로 저장**된다고 명문화했다. 그런데 같은 문서 상단 Principle 0 이
    5필드 계약을 정의하며 여전히 `config`: "해석된 설정값 **(자격증명 제거)**" 라고 적고 있다 —
    `git log -S`로 확인한 결과 이 문구는 2026-08-24/27 diff 에 포함되지 않은 기존 서술이다.
    핸들러가 반환하는 `config` 자체(= NodeHandlerOutput 5필드 계약)에는 이제 자격증명 제거가
    **일어나지 않는다** (그것이 egress 로 옮긴 목적이다) — Principle 0 을 먼저 읽는 독자는
    "config 는 항상 자격증명이 빠져 있다" 는 반대의 결론을 얻는다. 같은 파일 안에서 Principle 0
    과 Principle 7 신설 문단이 서로 다른 진실을 말하는 self-contradiction 이고, 이 PR 이 정확히
    그 인접 절을 고치면서 놓친 자매 서술이다.
  - 제안: `spec/conventions/node-output.md` Principle 0 의 해당 불릿을 "egress 에서 자격증명 제거"
    로 정정하거나 Principle 7 신설 문단을 상호 참조하도록 각주를 달 것. 이 PR 의 `spec_impact` 로
    싣기 늦었다면 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 잔여 항목으로
    등재해 후속 세션이 놓치지 않게 할 것.

## 그 외 확인했으나 문제 없음으로 판정한 항목 (참고용, 발견사항 아님)

- `plan/complete/masking-expression-egress-split.md` 는 `spec_impact` 6개 파일과 실제 diff 대상
  6개 spec 파일이 **정확히 일치**한다. planner 턴을 거쳤고 `consistency-check --impl-prep`
  BLOCK:YES → 해소 기록도 있다 — 미해결 결정 우회 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 선행 항목 두 건
  (`DEFAULT_SENSITIVE_KEYS` 정적 grep 한계 / `handler-output.adapter.ts` 값 축)이 이 PR 로
  **정확히 그 재개 신호가 발화**해 `[x]` 처리되고 해소 근거가 기록됨 — 선행 plan 미해소 없음.
  같은 파일에 후속 항목 두 건(자격증명 참조 간접화 검토, `chatChannel` 로컬 마스커 통합)도
  새로 등재되어 "후속 항목 누락" 은 이 트래커 범위에서는 발생하지 않았다.
- `plan/in-progress/node-output-redesign/{http-request,send-email,cafe24,database-query,
  variable-modification,background}.md` 는 각 노드별 **독립적인** config-echo 안전장치
  (`sanitizeUrlCredentials`/`sanitizeConfigEcho`/explicit-enumeration)를 다루며, 이번에 제거된
  범용 `maskSensitiveFields` boundary 에 의존하지 않는다 — 이 PR 로 무효화되는 서술 없음.
  다만 `http-request.md`(L133,157)가 문서화한 "config.headers/body 자유 텍스트에 자격증명이
  실려도 sanitize 되지 않는다" 는 관찰은, 새로 등재된 "자격증명 참조 간접화" 후속 항목이
  겨냥하는 위험과 **정확히 같은 벡터** — 중복 등재나 누락이 아니라 상호 보강 증거다.
- CHANGELOG.md 신규 항목이 DB 저장 방식 변경·안전성 근거·두 trade-off 를 spec 서술과
  동일하게 요약 — drift 없음.
- 코드(`handler-output.adapter.ts`)를 절대경로로 직접 열어 `config: r.config ?? {}` (마스킹 없이
  원문 echo)를 확인 — spec·plan 의 "구현됨" 서술과 일치.

## 요약
이번 PR(masking-residuals)은 config echo 마스킹을 엔진 boundary 에서 egress 로 옮기는 단일
결정을 완결된 plan(`masking-expression-egress-split`, complete 로 이동)과 갱신된 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)로 잘 추적했다 — 선행 항목 해소, 후속 항목 신규
등재, spec_impact 6파일 모두 실제 diff 와 일치해 미해결 결정 우회나 선행 plan 미해소는 없다.
다만 이 PR 이 고친 절의 바로 위 Principle 0 정의(`config`: "자격증명 제거")가 새 서술과
모순되는 채로 미수정 남았고, 이를 추적하는 plan 항목도 없다 — 사소하지만 실제 drift 이므로
WARNING 하나로 기록한다.

## 위험도
LOW
