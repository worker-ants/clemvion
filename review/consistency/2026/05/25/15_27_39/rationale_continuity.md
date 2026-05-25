# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 문서: `spec/4-nodes/6-presentation/0-common.md`
검토 일자: 2026-05-25

---

## 발견사항

### 발견사항 없음 (NONE) — 문서 자체의 내부 Rationale 연속성은 유지됨

target 문서(`spec/4-nodes/6-presentation/0-common.md`)는 직접적인 변경이 없는 상태로 `--impl-prep` 검토를 받았다. 문서 내 모든 Rationale 항목은 이전 결정과 일관성을 유지하고 있으며, 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 사항이 없다.

아래 두 항목은 **target 문서 자체의 Rationale 위반은 아니나**, 구현 착수 전 인식해야 할 인접 spec 과의 기존 known drift 로 기록한다.

---

- **[WARNING]** `config.buttonConfig` 위치 — Principle 7 (config = raw echo) 와의 긴장
  - target 위치: `spec/4-nodes/6-presentation/0-common.md §3` (Blocking Mode 실행 흐름 step 1-2), `§7` 5필드 표 (`config.buttonConfig` 항)
  - 과거 결정 출처: `spec/conventions/node-output.md` Principle 7 ("config = raw echo"), Principle 1.1 ("런타임 생성값은 output 에")
  - 상세: `buttonConfig.buttons` (글로벌 + per-item 합산) 와 `buttonConfig.buttonItemMap` 은 핸들러가 런타임에 생성하는 값이다. 이를 `config.*` 안에 두는 것은 Principle 7 "config 는 사용자 입력의 raw echo" 와 긴장 관계에 있다. 이 점은 `plan/in-progress/node-output-redesign/carousel.md §"진단" 2번` 및 `§종합 개선안` 에서도 "검토 권장" 으로 표시되어 있고, 미결 open 상태다. target 문서는 이 배치를 스펙으로 명시하면서도 명시적 Rationale ("`config` 위치인 이유: 프런트엔드 일관 접근을 위함") 를 내부 Rationale 절에 기술하지 않고 있다.
  - 제안: 구현 착수 전 `§Rationale` 에 "`buttonConfig` 를 `config` 안에 두는 이유 — 프런트엔드가 `config.*` 단일 경로로 접근하기 위함. Principle 7 의 raw echo 원칙과 완전히 부합하지 않음을 인식하고 수용한 배치" 를 한 항으로 명시하거나, 아니면 `meta.buttonConfig` 로 이동하는 결정을 내리고 Rationale 을 함께 기재하는 것이 권고된다.

- **[WARNING]** WS Protocol spec 의 `buttonConfig.timeout` / `nodeOutput.type` 판별자 — 기각된 패턴의 타 문서 잔존
  - target 위치: `spec/4-nodes/6-presentation/0-common.md §3` ("버튼 클릭 시까지 무제한 대기"), `§4` ("노드 판별용 `type:` 래퍼는 사용하지 않는다 — Principle 1.1.4")
  - 과거 결정 출처: target 문서 본문 §3 ("무제한 대기" invariant), §4 CHANGELOG 2026-04-19 및 §4 본문 Principle 1.1.4 (판별자 폐기)
  - 상세: `plan/in-progress/spec-drift-ws-button-config.md` (C2, C3) 가 이미 공식 문서화한 known drift 다. `spec/5-system/6-websocket-protocol.md §4.4` 에는 (a) `buttonConfig: { timeout: 300, timeoutAction: "cancel" }` 예시 (target 문서가 기각한 타임아웃 정책 재도입과 동일한 모양) 와 (b) `buttonConfig.nodeOutput: { "type": "carousel", ... }` (target 문서 §4 에서 명시 폐기한 `type` 판별자 패턴) 가 잔존한다. target 문서 자체의 Rationale 은 명확하나, 인접 spec 이 기각된 패턴을 보여주고 있어 구현자가 WS spec 을 SoT 로 오인할 위험이 있다.
  - 제안: 구현 착수 전 `plan/in-progress/spec-drift-ws-button-config.md` 의 C2·C3 수정을 선결하거나, target 문서 §3 / §4 에 "WS spec §4.4 예시는 stale — timeout 정책은 본 문서 §3 이 SoT, 판별자 금지는 §4 가 SoT" 교차 참조 노트를 추가한다.

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 문서 자체는 내부 Rationale 연속성 측면에서 양호하다. 모든 기각된 대안(타입 판별자·`output.type` 래퍼·`output.submittedData`·슬러그 기반 option backfill·휴리스틱 dispatch 등)이 Rationale 절에 명시적으로 기록되어 있고, 이를 번복하거나 재도입하는 구조가 보이지 않는다. 다만 구현 착수 전 두 가지 인접 이슈를 인지해야 한다. 첫째, `config.buttonConfig` 의 위치 결정 근거가 Rationale 절에 빠져 있어 향후 구현자 혼동 가능성이 있다. 둘째, 인접 `spec/5-system/6-websocket-protocol.md §4.4` 가 target 문서가 기각·폐기한 패턴(`timeout` 정책, `type` 판별자)을 예시로 노출하고 있어 구현자가 WS spec 쪽을 SoT 로 오인할 경우 회귀 위험이 있다. 두 항목은 모두 기존에 공식 문서화된 known drift(`plan/in-progress/spec-drift-ws-button-config.md`, `plan/in-progress/node-output-redesign/carousel.md`)이므로 새로운 발견이 아니나, 구현 착수 전 처리 여부 결정이 권고된다.

---

## 위험도

MEDIUM
