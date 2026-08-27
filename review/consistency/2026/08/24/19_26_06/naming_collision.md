# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 방법

prompt 번들은 `spec/5-system/` 18개 파일 중 3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만
전문이 포함되고 나머지 15개는 예산 초과로 절단됐다. 절단된 파일 중 이번 작업(`masking-expression-egress-split`,
worktree `masking-residuals-0b195b`)이 실제로 건드리는 영역(`4-execution-engine.md`·`6-websocket-protocol.md`)은
`Read`/`grep` 으로 직접 열어 보완했다. plan(`plan/in-progress/masking-expression-egress-split.md`)의
실제 변경 내용은 "새 요구사항 ID·엔티티·endpoint·이벤트·ENV 를 신설"하는 것이 아니라 `handler-output.adapter.ts`
의 `maskSensitiveFields(config)` 호출(엔진 boundary 마스킹)을 제거하고 egress 마스킹에 위임하는 **삭제/이관**
작업이다 — 따라서 6개 관점 중 1~6 어디에도 문자 그대로 들어맞는 "새 이름이 기존 이름과 겹친다" 사례는 없다.

다만 검토 중 이 삭제가 **기존 식별자(요구사항/Rationale ID)가 명시한 보장을 무효화**하면서 그 식별자를 담은
문서가 이번 작업의 `spec_impact` 밖에 있는 사례를 발견했다. 엄밀히는 "신규 식별자 충돌"의 정의보다 넓지만,
이 게이트가 막으려는 위험(구현 후 문서가 서로 다른 뜻을 말하게 되는 것)과 정확히 같은 결이라 CRITICAL 로 보고한다.

## 발견사항

- **[CRITICAL]** `spec/2-navigation/14-execution-history.md` R-5 의 안전 근거가 target 변경으로 무효화되는데 `spec_impact` 밖에 있다
  - target 신규 식별자: 없음(신규 도입 아님) — 대신 target 이 **삭제**하는 대상은
    `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:36` 의
    `maskSensitiveFields(r.config)` 호출("엔진 boundary" 마스킹).
  - 기존 사용처: `spec/2-navigation/14-execution-history.md:469` (R-5, "노드 상세 Config 탭이 viewer 롤에도
    노출되지만 안전한 이유") — *"config echo 는 엔진 boundary(`handler-output.adapter.ts` 의
    `maskSensitiveFields`)에서 DB·WS·REST 모든 경로에 **보편 마스킹**되어 내려오므로(민감 필드는 저장
    시점에 이미 마스킹), 노출 자체가 새로운 시크릿 유출 경로를 만들지 않는다. 즉 안전성은 **롤 게이팅이
    아니라 서버 boundary masking parity** 에 의존한다."*
  - 상세: target 은 이 정확한 메커니즘(핸들러 반환 직후, DB 쓰기 이전의 boundary 마스킹)을 제거하고
    "표현식은 원문을 읽는다 · WS/REST 는 각자의 egress 마스커(`maskWireEnvelope`→`deepRedactSecretsPreserving`,
    `redactStoredDataForResponse`→`deepRedactSecrets`) · DB 는 원문 보존" 으로 옮긴다(plan §"안전성은 키
    집합 포함관계에 걸려 있다"). 이는 정확히 R-5 가 "안전한 이유"로 든 그 문장 — *"저장 시점에 이미
    마스킹"* / *"boundary masking parity"* — 을 문자 그대로 반증한다. R-5 는 이 근거로 **Config 탭에
    별도 `@Roles` 게이트를 두지 않기로 한 보안 결정**을 정당화하고 있으므로, 이 텍스트가 stale 로 남으면
    다음 독자(코드 리뷰어·보안 감사·차기 consistency-check)가 "DB 저장 자체가 안전하다"는 이미 깨진
    전제를 계속 신뢰하게 된다. `spec/conventions/node-output.md` Principle 7(2026-08-17 갱신분)은 이미
    "DB 는 원문을 보존한다(egress-only) — 이 마스킹은 저장이 아니라 나가는 경로에만 건다"고 **다른 계층**
    (자유 텍스트 값-패턴 backstop)에 대해서만 적어 두었는데, target 이후에는 이 문장이 `config` 필드
    **전체**에도 사실상 적용되게 되어 R-5 와 완전히 반대 방향의 서술이 두 문서에 공존하게 된다.
  - 제안: `plan/in-progress/masking-expression-egress-split.md` 의 `spec_impact` 에
    `spec/2-navigation/14-execution-history.md` 를 추가하고, R-5 본문의 "저장 시점에 이미 마스킹" /
    "boundary masking parity" 를 "egress(WS/REST) 마스킹 parity — DB 는 원문 보존, 표현식은 원문을 읽음"
    으로 정정한다. 이 정정은 developer 자신이 쓴 "예고" 문장의 자기반증이 아니라 **보안 설계 근거(Rationale)**
    이므로 CLAUDE.md 의 "자기-반증형 소정정" 좁은 예외 대상이 아니다 — planner 턴으로 처리해야 한다.

- **[WARNING]** `spec/4-nodes/3-ai/1-ai-agent.md:480` 의 credential 마스킹 서술도 동일 이유로 stale 화
  - target 신규 식별자: 없음 — 위와 동일한 삭제 대상.
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md:480` — *"credential (`llmConfigId` 가 가리키는 provider
    secret 등) 은 `maskSensitiveFields` 에 의해 자동 마스킹 (`adaptHandlerReturn` boundary)."*
  - 상세: `adaptHandlerReturn` 은 바로 `handler-output.adapter.ts` 의 함수명이고, 이 문장이 지목하는
    것도 R-5 와 동일한 그 boundary 호출이다. target 이후 AI Agent 노드의 `output.config.llmConfigId` 류
    credential 은 boundary 가 아니라 egress 레이어(WS/REST 각자의 마스커)에서만 걸린다 — 표현식
    (`$node["X"].config...`)이 원문을 읽는 것도 이 노드의 `config` 에 그대로 적용된다.
  - 제안: 같은 planner 턴에서 이 문장도 "`adaptHandlerReturn` boundary" → "egress 마스킹(WS/REST 각자
    경유)" 로 정정하고, 표현식이 이제 raw credential 을 읽을 수 있다는 사실(§7 Config echo 원칙의
    직접 영향)을 §7.10 또는 §1.4.2 인근에 명시할지 검토.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md:261` 의 "다른 소비처" 열거에서 "노드 `config`
  echo boundary" 항목이 사라지는 소비처를 계속 가리키게 됨
  - target 신규 식별자: 없음.
  - 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md:261` — *"그 유틸을 공유하는 다른 소비처(AI
    Agent 노드 · 노드 `config` echo boundary)는 **포맷 축에서** 영향을 받지 않는다."*
  - 상세: 이 문장은 `maskSensitiveFields` 를 공유하는 소비처 목록에 "노드 `config` echo boundary"(=
    `handler-output.adapter.ts`)를 포함시키고 있다. target 이 그 호출을 제거하면 이 소비처가 목록에서
    빠져야 정확하다 — 실질 영향은 작지만(이 문서 자체의 결론에는 영향 없음), 위 두 건과 같은 근본 원인
    (동일 boundary 호출을 가리키는 서술이 여러 문서에 흩어져 있음)이라 같은 정정 묶음에 넣는 것이 싸다.
  - 제안: 위 planner 턴에서 함께 정정하거나, 사유를 명시하고 defer.

- **[INFO]** `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문 포함 3개 파일)
  에는 이번 세션 기준 신규/미검토 식별자가 없음
  - 상세: 세 파일 모두 오늘(2026-08-24) 또는 최근 며칠 내 신규 추가된 요구사항 ID·엔드포인트·에러
    코드·ENV var 를 찾지 못했다(`grep "2026-08-2[2-4]"` 결과 `INVALID_TRIGGER_PARAMETERS` re-run 이관
    기록 하나뿐이며 이는 기존 코드 통합의 역사 기록이지 신규 충돌이 아님). 세 파일은 이미 `PASSWORD_INVALID`
    vs `INVALID_PASSWORD`, `INVALID_STATE`/`INVALID_EXECUTION_STATE`/`STATE_MISMATCH`, `RATE_LIMITED`
    재사용 등 근접 명명을 명시적 "근접 명명 주의" 각주로 선제 disambiguate 해 두고 있어 추가로 지적할
    충돌이 없다.
  - 제안: 없음(참고용 기록).

## 요약

이번 target(`masking-expression-egress-split`)은 신규 식별자를 도입하지 않는 **삭제/이관형 변경**이라 6개
관점의 문자 그대로의 "이름 충돌"은 없다. 그러나 삭제 대상(`handler-output.adapter.ts` 의 boundary 마스킹)을
안전 근거로 인용하는 문서가 최소 2곳(`spec/2-navigation/14-execution-history.md` R-5, `spec/4-nodes/3-ai/1-ai-agent.md`)
더 있고 둘 다 `spec_impact`(`spec/conventions/egress-masking.md` 단독)에서 빠져 있다 — 특히 R-5 는 "Config 탭에
role 게이트를 안 둬도 되는 이유"라는 **보안 결정의 근거**라서, 정정 없이 구현이 착지하면 존재하지 않게 될
보장을 여전히 존재한다고 말하는 문서가 저장소에 남는다. 나머지(spec/5-system/ 의 전문 포함 3개 파일)에는
새로 발견된 이름 충돌이 없다.

## 위험도

HIGH
