# Rationale 연속성 검토 결과

## 검토 범위

target = `spec/5-system/`(impl-prep, 컨텍스트 예산으로 `2-api-convention.md`·`3-error-handling.md`·
`6-websocket-protocol.md`·`12-webhook.md`·`14-external-interaction-api.md` 5개 파일만 전문 포함,
나머지 13개는 절단). 관련 배경으로 `eia-fanout-and-internal-data-masking.md`(plan, 이 검토 직후 착수 예정 —
WS `execution.node.*`/`execution.*` fanout emit 의 `error` 값-패턴 마스킹(§A) + 내부 REST
`toExecutionDto`/`toResponseExecution` 의 `inputData`/`outputData` 마스킹(§B))도 함께 참고했다.

전문 포함된 5개 파일과, 그 안에서 교차 참조되는 타 spec 의 `## Rationale`(`spec/1-data-model.md`,
`spec/2-navigation/14-execution-history.md`, `spec/data-flow/15-external-interaction.md`,
`spec/7-channel-web-chat/1-widget-app.md` 등)을 대조했다. `4-execution-engine.md` 등 절단된 13개
파일은 판정에 직접 근거로 쓰지 않았다(부재를 "내용 없음"으로 취급하지 않음).

## 발견사항

- **[INFO]** 마스킹 시점 철학(ingestion-time vs egress-time)의 공존이 상호 참조 없이 병립
  - target 위치: `spec/5-system/12-webhook.md` "민감 헤더 마스킹 — ingestion(저장) 시점 채택
    (2026-07-07)" (§5.3 인접 Rationale, ~L434) vs `spec/5-system/14-external-interaction-api.md`
    §R17 "`execution.failed` payload 의 ... — DB `Execution.error` 원문 (강제됨 — 2026-08-16)"의
    "egress-only(§R17 원칙 준수)" 불릿 (~L1486 부근)
  - 과거 결정 출처: `12-webhook.md` Rationale은 webhook 민감 헤더에 대해 **display(응답) 시점 마스킹**을
    명시적으로 **기각**했다 — "raw secret 이 DB 에 잔존해 유출 표면(DB 접근·백업·신규 endpoint)이
    남고, 모든 read 경로를 개별적으로 마스킹해야 한다"는 근거였다. 반면 §R17(`Execution.error`,
    `conversationThread`)은 정반대 방향인 **egress-only(read-time) 마스킹을 채택**하고 DB 는 원문
    보존을 원칙으로 못박았다.
  - 상세: 두 결정은 실제로 모순이 아니다 — webhook 헤더는 "검증 후에는 순수 시크릿이라 원문을 남길
    이유가 없는" 케이스이고, `Execution.error`/`conversationThread` 는 "서버 로그·사후 디버깅의
    진실 보존" 및 "저장 시점 redaction 이 LLM 컨텍스트·에러 진단 정보를 조용히 훼손할 위험"이라는
    **다른, 개별적으로 타당한 근거**를 §R17 이 명시하고 있다(`egress-only(의도)` 불릿, `egress-only(§R17
    원칙 준수)` 불릿). 다만 두 철학이 같은 `spec/5-system/` 영역 안에 있으면서 서로를 인지·교차
    참조하지 않는다 — 이번에 착수하는 fanout/내부 REST 마스킹(plan §A·§B)도 egress-only 계열을
    확장하는 것이므로, 이 지점에서 "왜 이 필드는 ingestion 이 아니라 egress 인가"를 되짚어 줄 근거가
    분산돼 있으면 다음 결정자가 임의로 아무 쪽이나 골라도 되는 것처럼 보일 위험이 있다.
  - 제안: 이번 작업으로 §R17 카탈로그를 갱신할 때, "왜 이 필드들은 ingestion-time 이 아니라
    egress-only 인가"를 일반화한 한두 문장(예: "구조화된 시크릿 전용 필드(헤더 등)는 ingestion-time,
    자유 텍스트·진단용 필드는 egress-only — 근거는 각 Rationale 항목 참조")를 추가하거나 최소한
    `12-webhook.md` 결정을 상호 링크로 걸어 두면, 이후 read 경로가 늘어날 때(예: plan §B 의
    `inputData`/`outputData`) 동일 질문이 반복 제기되는 것을 막을 수 있다. CRITICAL/WARNING 급은
    아니다 — 현재 두 결정 모두 개별적으로 근거가 있고 서로를 반증하지 않는다.

- **[INFO]** §R17 "잔여(범위 밖)" 열거가 ①만 명시된 채 plan 이 ①·② 를 동시에 닫으려 함
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여(범위 밖)" 불릿
    (~L1515, `## Rationale` 안 "내부 읽기 경로도 같은 마스킹을 적용한다" 하위)
  - 과거 결정 출처: 같은 불릿 — "① WS `execution.node.*` **emit** 경로의 `error` 는 여전히 원문이다
    ... ② `inputData`/`outputData` 는 **다른 컬럼**이라 포함되지 않는다 ... ③ workflow-assistant LLM
    도구는 ... 여기에 값-패턴 마스킹을 **단순 합성하면 안 된다**"
  - 상세: 이 문서 자신이 "적용 범위는 총칭이 아니라 열거다"라는 원칙을 §R17 안에서 두 번 반복해
    강조한다(과거 "네 표면 중 하나만" 실패 패턴 재발 방지). 그런데 참고한 `eia-fanout-and-internal-data-
    masking.md` plan 은 §A(=①)·§B(=②) 둘 다 이번 작업 범위로 잡으면서도, 체크리스트의 spec 갱신 항목은
    "`14-external-interaction-api.md` §R17 카탈로그 등재 + **잔여 ① flip**"로 ①만 명시하고 있다.
    target(현재 spec) 자체는 아직 ①·② 모두 정확히 "미해소"로 정직하게 서술돼 있어 지금 시점 위반은
    아니지만, 이 열거식 잔여 추적 관행을 감안하면 구현 완료 후 spec 갱신 시 ② 불릿도 함께 flip 하지
    않으면 "고쳤는데 문서엔 여전히 gap 으로 남아있는" stale 잔여가 생긴다 — 이 저장소가 반복해 겪어 온
    실패 형태(자매 항목 중 일부만 반영)와 같은 모양이다.
  - 제안: 구현 완료 후 spec 갱신 단계에서 §R17 "잔여(범위 밖)" 불릿의 ①·② 를 모두 명시적으로 flip(또는
    "해소됨" 각주 추가)하고, ③(workflow-assistant 값-패턴 마스킹 단순 합성 금지 경고)은 이번 범위 밖임을
    그대로 유지한다고 명시할 것.

- 그 외 값-패턴/키-패턴 마스킹, egress-only 원칙, "boundary masking parity"(R-5) 원용 등 여러 축을
  교차 검증했으나 명시적으로 기각된 대안의 무단 재도입이나 합의 원칙의 직접 위반은 발견하지 못했다.
  특히 `spec/2-navigation/14-execution-history.md` R-5 는 2026-08-16 자체 addendum으로 "Config 탭의
  write-time 보편 마스킹"과 "`Execution.error`의 egress-only 마스킹"을 명시적으로 분리해 "두 정책을
  하나로 읽으면 잘못된 결론이 난다"고 선제적으로 캐비엇을 달아 두고 있어, 이 저장소의 Rationale 연속성
  관리가 이례적으로 꼼꼼하다.

## 요약

전문 검토한 5개 `spec/5-system/` 파일과 교차 참조되는 타 spec Rationale 사이에서 기각된 대안의
무단 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. `spec/5-system/14-external-interaction-api.md`
§R17 은 이번에 착수할 fanout/내부 REST 마스킹 작업(plan `eia-fanout-and-internal-data-masking.md`)이
닫으려는 잔여 갭(①·②)을 이미 정확하게 "미해소"로 정직하게 기록해 두고 있고, 관련 스펙들은 서로
모순처럼 보일 수 있는 지점(ingestion-time vs egress-time 마스킹, R-5 boundary parity vs
Execution.error egress masking)에 대해 이미 명시적 구분 각주를 달아 두는 등 자기 감사(self-audit) 밀도가
높다. 발견된 두 항목은 모두 INFO 급으로, 현재 target 문서의 결함이 아니라 **후속 spec 갱신 시점에
지켜야 할 문서화 규율**(잔여 열거의 완전성, 마스킹 철학 간 상호 참조)에 대한 제안이다.

## 위험도

LOW
