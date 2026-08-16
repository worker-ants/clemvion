# Plan 정합성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 대상 요약

이번 diff (`23d1148d5`, `a50a5764e`)는 `toTerminalErrorPayload`(EIA 종결 `error.message`/`details`)에
`deepRedactSecrets` egress 마스킹을 추가한 것으로, `spec/**` 자체는 변경하지 않았다
(`git diff origin/main...HEAD -- spec/` 0건). 대응 plan 은
`plan/in-progress/eia-terminal-error-sanitize.md`(`spec_impact: none`)이고, 자매 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 항목(`22_55_51` security W2)을
같은 커밋에서 `[x]` 로 닫으며 잔여 항목(자격증명 없는 연결 문자열 등은 여전히 통과)을 새로
등재했다 — 두 plan 상호 참조는 정합적이다.

## 발견사항

- **[WARNING]** 새 egress 마스킹 지점이 EIA §R17 마스킹 카탈로그·§6 필드 집합 표 어디에도 반영되지 않았다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" 블릿 목록
    (`conversationThread`(강제됨) · `execution.ai_message`(강제됨) · `nodeOutput.conversationConfig`
    + terminal `result`/`error`(강제됨) · `nodeOutput` 일반 키(미구현·잔여) 4개 항목), 및 §6 도입부
    필드 집합 표의 `error` 행(`{code, message, nodeId, details?}`, 마스킹 언급 없음)
  - 관련 plan: `plan/in-progress/eia-terminal-error-sanitize.md`("이건 계약 위반이 아니라
    하드닝이다" 절, `spec_impact: none`) · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    ("종결 `error.message` 가 값-패턴 마스킹을 안 거친다" 항목, `[x]` 로 닫힘 + 잔여 `[ ]`)
  - 상세: R17 은 EIA 도메인에서 "어느 필드가 어떤 egress 지점에서 어떤 마스킹을 강제로 거치는가"를
    카탈로그화하는 절이고, 실제로 4개 항목이 전부 "(강제됨)" 형식으로 마스킹 메커니즘·소비자·
    trade-off 를 명시한다. 이번 PR 은 WS/SSE/webhook 종결 `error.message`·`details` 에 `deepRedactSecrets`
    를 새로 강제했는데(호출부 5곳, DB 미변경) 이 사실이 R17 목록에 5번째 항목으로 추가되지 않았다.
    developer 는 "spec §6.4 가 새니타이즈를 요구하지 않으므로 계약 위반이 아니다" 로 `spec_impact: none`
    을 정당화했는데, 이는 "약속을 어기지 않는다"는 근거일 뿐 "R17 카탈로그가 이 마스킹 지점을
    누락한 채로 둬도 되는가"에는 답하지 않는다. 자매 plan(`spec-sync-external-interaction-api-gaps.md`)
    이 등재한 잔여 항목도 마스킹 **패턴 커버리지**(자격증명 없는 문자열 등) 갭만 다루고, R17
    **카탈로그 자체의 누락**은 어느 plan 에도 등재돼 있지 않다 — 이 PR 이 "새로 만들어야 하는
    후속 항목"을 만들지 않고 넘어간 사례다.
  - 제안: 둘 중 하나 — (a) `spec-sync-external-interaction-api-gaps.md` 의 기존 잔여 항목에
    "R17 카탈로그에 5번째 항목(`error.message`/`details` egress 마스킹)을 등재" 를 명시적으로
    추가해 플래너 턴에서 처리하거나, (b) 이번 PR 이 이미 `spec_impact: none` 을 결정했으므로 그
    결정에 "R17 은 의도적으로 갱신하지 않는다(이유: …)" 캐비엇을 plan 에 남겨 향후 재지적을
    막는다. 둘 다 없는 현재 상태가 가장 취약하다 — 다음 세션이 R17 을 "완전한 목록"으로 믿고
    새 마스킹 지점을 놓칠 위험이 있다(이 저장소가 반복해서 겪은 "표는 있는데 미러가 안 됨" 형태).

- **[INFO]** `eia-terminal-emit-facade.md` 체크리스트가 병합된 지 오래된 작업을 여전히 미완료로 표시
  - target 위치: 해당 없음(target spec 내용과 직접 충돌은 아님) — plan 위생 참고용
  - 관련 plan: `plan/in-progress/eia-terminal-emit-facade.md` 체크리스트 하단
    (`- [ ] /ai-review CRITICAL 0` · `- [ ] --impl-done BLOCK: NO` · `- [ ] push 게이트 통과 → PR`)
  - 상세: 이 facade 작업은 `8e0728a90`(#1174)로 이미 `origin/main` 에 병합돼 있다
    (`git merge-base HEAD origin/main` == `57917975c`, #1174 는 그 조상). `spec-sync-external-interaction-api-gaps.md`
    도 이 항목을 `[x] 완료` 로 참조한다. 그런데 `eia-terminal-emit-facade.md` 자신의 체크리스트는
    갱신되지 않아 "미완료"로 읽힌다 — 이 저장소가 기록한 "plan 체크박스 = 실제 상태" 교훈의 재발이다.
  - 제안: 체크리스트를 `[x]` 로 갱신하고 `plan/complete/` 로 이동(라이프사이클 규칙 참조). 이번
    PR 의 범위 밖이라 차단 사유는 아니다.

## 요약

이번 diff 는 spec 본문을 건드리지 않는 순수 하드닝(egress 마스킹 추가)이고, 대응 plan
(`eia-terminal-error-sanitize.md`)이 EIA §R17 의 egress-only 원칙을 뒤집지 않았는지, 자매 트래커
(`spec-sync-external-interaction-api-gaps.md`)와 상호 참조가 맞는지, 이전 선행 plan(facade/durationMs/
DB=wire invariant 등)이 실제로 merge 돼 전제가 충족됐는지는 모두 확인됐다 — CRITICAL 급 충돌은
없다. 다만 R17 이 스스로 표방하는 "egress 마스킹 카탈로그" 완전성 관점에서, 이번에 새로 생긴
5번째 마스킹 지점이 그 목록에도 어느 plan 의 후속 항목으로도 등재되지 않은 갭이 하나 있고,
별개로 이미 병합된 `eia-terminal-emit-facade.md` 의 체크리스트가 실제 상태를 반영하지 못하는
plan 위생 이슈가 하나 있다. 둘 다 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
