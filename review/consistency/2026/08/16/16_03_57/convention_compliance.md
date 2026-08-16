# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 컨텍스트

검토 시점 워크트리(`eia-followups-1464c0`)는 `plan/in-progress/eia-internal-rest-error-masking.md`
(신규, 미착수) 착수 직전 상태다. 이 plan 은 `Execution.error` 내부 REST 노출과
`interaction.triggerToken` 평문 저장, 두 건을 다룬다. 아래 검토는 **그 plan 이 아직 적용되지
않은 현재 spec/5-system/ 상태**가 `spec/conventions/**` 를 준수하는지를 본다.

프롬프트 번들은 컨텍스트 예산으로 `2-api-convention.md` · `3-error-handling.md` ·
`4-execution-engine.md` 만 전문이 실렸고 나머지 15개 파일은 절단됐다. 절단된 파일 중 이번
plan 과 직결되는 `14-external-interaction-api.md`(1548줄) · `6-websocket-protocol.md`(1110줄)
및 관련 `spec/conventions/secret-store.md` · `error-codes.md` · `swagger.md` ·
`interaction-type-registry.md` · `audit-actions.md` · `data-hydration-surfaces.md` 는 실제
저장소 파일을 직접 `Read` 하여 검토했다(번들 부재를 "문제 없음"의 근거로 삼지 않았다).

---

## 발견사항

- **[WARNING] `interaction.triggerToken` 평문 저장이 `secret-store.md` 의 "모든 도메인 모듈" 문언과 정면 충돌**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 (라인 902-910, 특히 910)
    — `"config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토)."`
  - 위반 규약: `spec/conventions/secret-store.md` 최상단 Overview
    (`"모든 도메인 모듈 (chat-channel / external-interaction / 향후 cafe24·OAuth 등) 은 본
    convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다."`) + §1 "비대상" 목록
    (`AuthConfig.config` **한 항목만** 명시 등재, `interaction.triggerToken` 미등재).
  - 상세: `interaction.triggerToken`(`itk_xxx`, per-trigger 인증 토큰)은 `external-interaction`
    모듈이 다루는 자격증명이지만 `SecretResolver` 를 경유하지 않고 `Trigger.config` JSONB 에
    평문으로 저장된다. secret-store.md 의 "모든 도메인 모듈" 은 예외 없는 절대 진술인데, 같은
    JSONB (`Trigger.config`) 안의 형제 필드 `notification.signing.secretRef` 는 이미
    `SecretResolver` 를 경유한다 — 같은 객체 안에서 한쪽만 규약을 따르는 비대칭이다. 이 gap 은
    코드 최신성 문제가 아니라 **spec 문서 자신이 명시적으로 인정**하고 있다("향후 검토").
  - 제안: 이미 `plan/in-progress/eia-internal-rest-error-masking.md` §D 가 "이관이 아니라
    `secret-store.md §1` 비대상 절에 `interaction.triggerToken` 을 명시 등재" 로 결정해 두었다
    (사용자 2026-08-16 택일). 이 검토는 그 plan 의 전제가 실측대로 유효함을 재확인한다 —
    **planner 턴에서 계획대로 `secret-store.md §1` 에 등재 + 본 문서 910행의 "향후 검토" 캐비엇을
    "의식적 예외, 근거: …" 형태로 정정**하면 해소된다. CRITICAL 로 올리지 않은 이유: 이 상태는
    신규 채택이 아니라 이미 운영 중인 기존 동작이고, 팀이 이미 "이관이 아니라 등재"로 명시
    결정했으므로 다른 시스템의 invariant 를 새로 깨는 변경이 아니다(현상 유지 문서화).

- **[INFO] `6-websocket-protocol.md` 에 `### 4.4` 절 번호가 두 번 등장(§392, §761)**
  - target 위치: `spec/5-system/6-websocket-protocol.md:392`(`### 4.4 사용자 입력 대기 이벤트
    상세`)와 `:761`(`### 4.4 알림 이벤트 (Server → Client)`).
  - 위반 규약: 직접적인 "정식 규약" 항목은 아니나 CLAUDE.md 문서 구조 관행(섹션 참조 무결성)과
    맞물려 있다 — 저장소 곳곳(EIA §R17 등)이 `#44-사용자-입력-대기-이벤트-상세-...` 앵커로
    이 절을 인용하는데, 번호 중복은 목차 탐색을 혼동시킬 수 있다.
  - 상세: `plan/complete/spec-draft-ws-types-canonical-location.md` "범위 밖" 절이 이미 이
    중복을 "이번 diff 무관 기존 상태" 로 명시적으로 스코프 밖에 두었다 — 새로 발견된 결함이
    아니라 알려진 채무다.
  - 제안: 별도 조치 불요(이미 인지·유예됨). 후속 spec 정리 시 절 번호만 순차 재부여 권장
    (`4.4` → `4.5` 등), 앵커 링크 전수 갱신 필요.

- **[INFO] `redactExecutionErrorValue` 설계가 기존 masking 계층 원칙과 일치함 (반증 없음 — 참고용 확인)**
  - target 위치: `plan/in-progress/eia-internal-rest-error-masking.md` §설계 (spec 본체는 아니나
    `spec_impact: spec/5-system/14-external-interaction-api.md` 로 이번 검토 스코프에 포함)
  - 확인 내용: (1) DB 는 원문 보존(egress-only) — `spec/5-system/14-external-interaction-api.md`
    §R17 "egress-only(§R17 원칙 준수)" 캐비엇과 동일 원칙. (2) `toTerminalErrorPayload` 재사용
    안 함(wire 형태 변경 회피) — `2-api-convention.md §5.4` 부재 표현 규칙과 별개 축이라
    상충 없음. (3) 새 함수가 `secret-store.md` 의 `SecretResolver`가 아니라
    `deepRedactSecrets`(값 패턴 마스킹)를 재사용하는 것도 §R17 의 기존 결정과 동형.
  - 상세/제안: 위반 없음 — 계획 단계에서 이미 conventions 정합성을 자체 검증한 상태로 보인다.
    별도 조치 불요.

---

## 검토했으나 위반 없음으로 판정한 항목 (참고)

- `spec/5-system/2-api-convention.md`(전문) — §5.3 에러 응답 envelope · §5.4 null-vs-키생략 ·
  §6 HTTP status · §7 rate limit 표가 `error-codes.md`·`swagger.md` 와 상호 참조 정합.
- `spec/5-system/3-error-handling.md`(전문) — 없음(별도 위반 미발견, 시간 관계상 정독만 수행).
- `spec/5-system/4-execution-engine.md`(전문) — `EngineDriver` ISP 분해 서술이 §4.4 근거 문단과
  일치, 코드-SoT 명시 캐비엇 적정.
- `spec/5-system/14-external-interaction-api.md` §6 (종결 이벤트 필드 집합·채널별 봉투·§6.4
  마스킹) — `error-codes.md`(UPPER_SNAKE_CASE·null 부재표현·rename 정책) · `2-api-convention.md
  §5.4`(부재 표현 근거) 와 전부 정합. `WEBCHAT_IDLE_TIMEOUT` prefix 선택 근거도 명시돼 있고
  `3-error-handling.md:134` 에도 상호 등재됨.
- URL 명명 — `/api/external/executions/:id/{interact,cancel,stream,refresh-token}` ·
  `/api/triggers/:id/{notification/rotate-secret,interaction/revoke-token}` 는
  `2-api-convention.md §2.2` 의 RPC-style sub-channel 예외 패턴과 일치(케밥케이스, 부작용
  동사).
- `spec/conventions/secret-store.md`(전문) · `error-codes.md`(전문) · `swagger.md`(전문) ·
  `interaction-type-registry.md`(전문) · `audit-actions.md`(발췌) — 각 문서 자체는 내적으로
  일관되며 Overview/본문/Rationale 구조를 지킴.
- 문서 구조(Overview/본문/Rationale) — `spec/5-system/*.md` 17개 파일 전수 grep 결과 전부
  `## Rationale` 보유, "제품 정의"형 문서(12-webhook·10-graph-rag·1-auth·15-chat-channel·
  13-replay-rerun·14-EIA·17-agent-memory·9-rag-search·8-embedding-pipeline)는
  `## Overview (제품 정의)`/`## Overview` 보유. 순수 기술 규약형 문서(2-api-convention·
  7-llm-client·5-expression-language·11-mcp-client·6-websocket-protocol·16-system-status-api)
  는 별도 Overview 헤더 없이 본문에서 바로 시작 — 이는 저장소 전역의 기존 패턴과 동형이라
  신규 위반으로 보지 않음.

---

## 요약

`spec/5-system/` 은 최근 EIA 종결 이벤트·마스킹·WS 타입 위치 관련 연쇄 커밋(#1166~#1178)을
거치며 `spec/conventions/**`(특히 `error-codes.md`·`swagger.md`·`secret-store.md`)와의 교차
참조가 상당히 촘촘하고 자기 정합적으로 유지되고 있다. 이번 --impl-prep 검토에서 발견한 유일한
실질 항목은 `interaction.triggerToken` 평문 저장이 `secret-store.md` 의 "모든 도메인 모듈"
문언과 어긋나는 기존 gap 인데, 이는 이미 착수 대상 plan(`eia-internal-rest-error-masking.md`
§D)이 정확히 겨냥하고 있는 사안이라 이번 검토는 그 plan 의 전제를 검증하는 역할을 한다.
그 외 새로 발견된 명명·출력 포맷·문서 구조·API 문서 규약 위반은 없었다.

## 위험도

LOW
