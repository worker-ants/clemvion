# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/3-error-handling.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [INFO] §1.5 / §1.6 신설 섹션의 Rationale 미기재 — 코드 분리 원칙

- **target 위치**: `§1.5 WS commands 에러 코드` 섹션 도입부, `§1.6 EIA REST 외부 표면 에러 코드` 섹션 도입부
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md § Rationale R13` — "WS 평면 ack 에러 코드 ↔ EIA REST 에러 코드 매핑 원칙"
- **상세**: target 의 §1.5·§1.6 은 WS / EIA 전용 에러 코드를 카탈로그에 등재하면서, 이 코드들이 기존 REST core 코드(`INVALID_STATE`/422, `VALIDATION_ERROR` 등)와 **의도적으로 분리**된다는 원칙을 각 섹션 본문에 주석(예: §1.3 의 `INVALID_STATE` 비고 등)으로만 언급하고 `## Rationale` 에는 명시하지 않는다. 반면 이 결정(표면별 코드명 분리 — 내부 `EXECUTION_*` 네임스페이스 vs EIA 간결 코드)의 근거는 EIA spec Rationale R13 에 상세히 작성되어 있고, error-handling spec 자체의 Rationale 에는 해당 항이 없다. 코드 분리 원칙이 error-handling 의 에러 카탈로그 배치 결정이기도 하므로, 이 spec 의 Rationale 에도 "표면별 분리는 R13 에 의한 의도적 결정" 이라는 참조 항목이 있어야 일관성이 높다.
- **제안**: `## Rationale` 에 아래 취지의 항목 추가 검토. "§1.5·§1.6 은 WS·EIA REST 전용 카탈로그이며 기존 REST core 코드와 의도적으로 분리된다 — 근거는 [EIA §Rationale R13](./14-external-interaction-api.md#r13-ws-평면-ack-에러-코드--eia-rest-에러-코드-매핑-원칙)." 참조 링크만 추가해도 충분하다.

---

### 2. [INFO] §7 헬스 체크 probe 역할 분리 — `## Rationale` 누락 (본문 주석으로만 기록)

- **target 위치**: `§7.2` 아래 주석 블록 — "probe 역할 분리 (구 "liveness probe 용" 결정 번복)"
- **과거 결정 출처**: `spec/data-flow/9-observability.md §1.1` 및 해당 spec `## Rationale` — "liveness / readiness probe 분리 (기존 '/api/health = liveness' 결정 번복)"
- **상세**: target 의 §7 에는 `## Rationale` 가 없다. 기존 결정("구 '/api/health = liveness probe'")을 번복한 사유(readiness 무력화 + 전 replica liveness 동반 장애 위험)는 observability spec Rationale 에 상세히 기재되어 있다. target 은 §7.2 본문 내 `> **참고 — probe 역할 분리 (구 "liveness probe 용" 결정 번복)**` 블록쿼트에서 이를 언급하고 SoT 를 data-flow 로 명시하고 있어 **완전히 미기록 상태는 아니다**. 다만 결정 번복임을 Rationale 절(spec 문서 끝의 ## Rationale)이 아닌 본문 중간 주석에만 두는 것은 규약(각 spec 문서 끝 `## Rationale`)과 다소 다른 배치다. 단, SoT 를 명시하고 cross-ref 가 충분하므로 실질적 정보 손실은 없다.
- **제안**: 현재 §7.2 내 blockquote 의 내용을 `## Rationale` 절에도 간략히 반영하거나, 기존 `## Rationale` 에 "§7 probe 역할 분리 — SoT 는 [data-flow/9-observability.md Rationale](../data-flow/9-observability.md#liveness--readiness-probe-분리)" 한 줄 참조를 추가하는 것을 권장한다. 이는 규약 준수 보완이며 정합 오류는 아니다.

---

### 3. [INFO] §1.5 `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` — client-safe 누출 차단 결정 근거 미기재

- **target 위치**: `§1.5` 표의 `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG` 항목
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §7.5.2 Rationale` — "Continuation ack client-safe typed error — 내부 메시지 누출 차단 (§7.5.2, 2026-06-14 결정)"
- **상세**: target §1.5 는 두 코드를 카탈로그에 등재하고 SoT 링크를 §7.5.2 로 명시하고 있다. 그러나 이 코드들이 왜 신설됐는지(기존 generic plain Error 노출 → typed `ExecutionError` + client-safe fallback 구조 도입)와, 왜 `EXECUTION_INTERNAL_ERROR` 가 내부 메시지를 노출하지 않는지의 Rationale 는 error-handling spec 의 `## Rationale` 에 없다. 사용자(혹은 미래 편집자)가 error-handling spec 만 보고 `EXECUTION_INTERNAL_ERROR` 가 generic fallback 인 이유와 내부 message 미노출 게이트 원칙을 이해하려면 execution-engine spec 을 따로 봐야 한다. 이 spec 의 기존 Rationale 에는 `MODEL_CONFIG_NOT_FOUND`/`MODEL_CONFIG_DEFAULT_MISSING` 분리 결정이 항으로 기재된 선례가 있으므로, client-safe 누출 차단 결정도 간략히 추가되어야 일관성이 높다.
- **제안**: `## Rationale` 에 "§1.5 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` — typed `ExecutionError` + 내부 메시지 누출 차단 정책 도입 (2026-06-14, [실행 엔진 §7.5.2 Rationale](./4-execution-engine.md#continuation-ack-client-safe-typed-error--내부-메시지-누출-차단-§752-2026-06-14-결정) 참조)" 항목 추가를 권장한다.

---

## 요약

target `spec/5-system/3-error-handling.md` 는 기존 Rationale 의 결정(MODEL_CONFIG 분리·probe 역할·에러 코드 명명 원칙)을 번복하거나 기각된 대안을 재도입하는 내용이 없다. §1.3 비고(`INVALID_STATE`)와 §7.2 blockquote 는 과거 결정 번복 사실을 명시하고 SoT cross-ref 를 달고 있어 합의 원칙이 무시된 흔적이 없다. 다만 (1) §1.5·§1.6 표면별 코드 분리 원칙, (2) §7 probe 역할 분리 결정 번복, (3) §1.5 신규 코드(`EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG`)의 client-safe 정책 — 이 세 결정이 본 spec 의 `## Rationale` 절에 직접 기재되지 않고 각 도메인 spec 과 본문 주석에만 분산되어 있다. 기각·폐기 결정의 재도입이나 invariant 위반은 없으므로 위험도는 낮으나, Rationale 정합 보완이 권장된다.

## 위험도

LOW
