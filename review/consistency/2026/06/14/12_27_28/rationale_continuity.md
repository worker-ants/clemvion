# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md`
검토 모드: spec draft 검토 (--spec)
변경 범위: §5.1 에러 응답 표에 `MESSAGE_TOO_LONG` (400 Bad Request) 행 1건 추가

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] `MESSAGE_TOO_LONG` REST 코드명 — WS `EXECUTION_MESSAGE_TOO_LONG` 와의 명명 분기 근거가 target 본문에만 존재, Rationale 섹션 미반영

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표, 신규 행 (`MESSAGE_TOO_LONG`)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` §Rationale — 기존 선례(`STATE_MISMATCH` vs WS `INVALID_EXECUTION_STATE`)가 "WS 코드명을 EIA REST 에서 다른 이름으로 재매핑하는" 패턴임을 묵시적으로 확립하고 있으나, 이 패턴에 대한 명시적 Rationale 항목이 없음.
- **상세**: 신규 행의 본문 셀에 "WS 의 평면 ack `EXECUTION_MESSAGE_TOO_LONG` 와 동일 의미" 라고 inline 으로 명시하고, `spec/5-system/4-execution-engine.md §7.5.2` Rationale 의 "EIA(REST) 진입점 매핑" 노트(`InvalidExecutionStateError→STATE_MISMATCH(409)와 동형`)가 이미 교차 근거를 제공한다. Rationale 연속성 관점에서 이 패턴(WS 코드 → REST 전용 코드 매핑)을 EIA spec 자체 Rationale 에 한 항으로 선명하게 기록해두면, 향후 신규 에러 코드 추가 시 동일 선례를 쉽게 식별할 수 있다.
- **제안**: EIA `## Rationale` 에 `### R13. WS 에러 코드 → EIA REST 코드 매핑 원칙` 항을 추가해 `STATE_MISMATCH`(←`INVALID_EXECUTION_STATE`)·`MESSAGE_TOO_LONG`(←`EXECUTION_MESSAGE_TOO_LONG`) 두 선례를 함께 기록하는 것을 권장. 필수 차단 사항은 아니다.

---

## 요약

target 의 변경(§5.1 `MESSAGE_TOO_LONG` 행 추가)은 기존 Rationale 에서 기각된 대안을 재도입하지 않는다. EIA spec 의 기존 Rationale `STATE_MISMATCH` ↔ WS `INVALID_EXECUTION_STATE` 선례와 동일한 패턴이며, 실행 엔진 §7.5.2 Rationale(2026-06-14 확정, 에러 네임스페이스 `EXECUTION_*` 확장 채택·`EXEC_*` prefix 기각·내부 메시지 미누출 원칙)과도 정합한다. "내부 길이 수치를 응답에 노출하지 않고 고정 메시지만 반환" 조항은 §7.5.2 의 보안 invariant(내부 detail client 미전달)를 충실히 계승하고 있다. Rationale 자체의 갱신이 수반되지 않았으나, 신규 결정을 번복하거나 합의된 원칙을 위반하는 항목은 없다. 정합 보완 제안(INFO 1건)만 존재한다.

---

## 위험도

NONE
