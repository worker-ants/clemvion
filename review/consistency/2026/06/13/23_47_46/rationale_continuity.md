# Rationale 연속성 검토 결과

검토 대상: `spec-sync-s-batch-draft` (3건 spec doc-sync + 1건 코드 주석 교정)
검토 기준: `spec/data-flow/7-llm-usage.md`, `spec/conventions/interaction-type-registry.md`, `spec/data-flow/15-external-interaction.md` 의 `## Rationale` 및 관련 Rationale 발췌

---

## 발견사항

### 발견사항 없음 — 모든 변경이 Rationale 연속성과 정합

변경 3건과 부수 교정 1건 모두 기존 Rationale 결정에 부합하며, 기각된 대안 재도입이나 합의 원칙 위반은 확인되지 않는다. 세부 점검 결과는 아래와 같다.

---

#### 변경 1 — `spec/data-flow/7-llm-usage.md §1.3` attribution 갭 note 압축 (W10)

- **점검 1 (기각된 대안 재도입)**: 현행 `## Rationale` 의 `llm_usage_log 의 nullable context 컬럼들` 항은 "코드 수정 vs spec 차원 집계 의미 재정의가 결정 대상"이라는 미결 상태를 명시한다. target 의 §1.3 압축 note 도 동일하게 "결정 대기 상태로 기술 — 갭이 해소됐다고 주장하지 않음"을 유지한다. attribution 갭 해소를 기각한 종전 결정을 번복하거나 우회하지 않는다.
- **점검 2 (합의된 원칙 위반)**: CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`; 본문은 latest-only 사실"이라는 단일 진실 원칙에 정합 — 인과 상세를 Rationale 에 일원화하고 §1.3 을 요약 참조 형식으로 압축하는 것이 원칙을 실행하는 방향이다.
- **점검 3 (결정 무근거 번복)**: 번복 없음. "미결"이라는 상태 자체가 보존된다.
- **점검 4 (암묵적 가정 충돌)**: 없음.

#### 변경 2 — `spec/conventions/interaction-type-registry.md §1.2` 재개 turn 라우팅 진입점 등재 (W2)

- **점검 1 (기각된 대안 재도입)**: `interaction-type-registry.md §4 Rationale` 의 핵심 결정은 "enum 1개 값 추가 시 N개 처리 분기 위치를 매트릭스에 동시 등록"이다. target 변경은 **enum 신규 값 추가가 아니라** 매트릭스 하단에 "재개 turn 라우팅 단일 진입점" 노트를 추가하는 것이므로 이 원칙의 적용 범위 밖이다. WaitingInteractionType 4값(form/buttons/ai_conversation/ai_form_render)은 불변으로 유지된다고 명시되어 있다.
- **점검 2 (합의된 원칙 위반)**: §4 Rationale 의 "매트릭스가 SoT — 모든 분기 위치를 한 표로 응집" 원칙에 대해, 노트는 분기 위치를 추가하는 것이 아니라 "resume 시 Backend emit 위치" 열의 설명 보완을 제공한다. 위반 없음.
- **점검 3 (결정 무근거 번복)**: 없음.
- **점검 4 (암묵적 가정 충돌)**: `§1.1` 에 명시된 "신규 enum 값 추가 시 두 위치 동시 변경 + 본 §1.2 매트릭스에 행 추가" 규칙이 있는데, target 은 행 추가가 아니라 노트(주석) 추가다. 이는 규칙 발동 조건(신규 enum 값)이 충족되지 않으므로 충돌이 아니다.

#### 변경 3 — `spec/data-flow/15-external-interaction.md` Rationale SSE single-instance 블록 추가

- **점검 1 (기각된 대안 재도입)**: 현행 `§1.3` 본문 L146 은 "v1 은 single-instance in-memory buffer — 분산 fan-out 은 follow-up (`sse-adapter.service.ts` 주석)"을 이미 사실로 기술하고 있다. 현행 Rationale 에는 SSE 버퍼 설계 근거 블록이 없다. target 은 이 사실의 **근거를 Rationale 에 명문화**하는 것이다. "분산 fan-out 미채택"은 현행에서도 결정된 상태이며, target 은 그 근거(지연/신뢰성 트레이드오프, 단일 엔트리포인트 가정, 다중 인스턴스 잔여 위험, Redis Pub/Sub 이관 방향)를 기록하는 것이므로 기각된 대안(분산 fan-out)의 재도입이 아니라 기각 근거의 **명문화**다.
- **점검 2 (합의된 원칙 위반)**: 현행 Rationale 의 "fail-open 정책의 일관 표기" 항과 "단일 sink(R10)" 항의 원칙에 반하지 않는다. 신규 블록은 독립 항으로 추가되며 기존 원칙을 덮지 않는다.
- **점검 3 (결정 무근거 번복)**: 번복 없음. 신규 정책 없이 현행 동작의 근거만 기록하는 것임을 draft 가 명시한다.
- **점검 4 (암묵적 가정 충돌)**: 현행 spec 의 "v1 single-instance" 가정을 그대로 유지하면서 그 이유를 명시하므로 invariant 위반 없다. Redis Pub/Sub 이관 방향은 follow-up 이라는 현행 서술과 일치한다.

#### 부수 — `resume-turn-dispatch.ts` JSDoc 교정 (I3)

- JSDoc 내 `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개)` 레이블 교정은 코드 주석 정합으로 spec Rationale 와 무관하다. Rationale 연속성 검토 범위 밖 (정보 제공 수준).

---

## 요약

3건의 doc-sync 변경과 1건의 코드 주석 교정 모두 기존 Rationale 결정과 완전히 정합한다. 변경 1은 단일 진실 원칙을 실행하는 방향의 본문 압축이고, 변경 2는 enum 불변을 유지하면서 매트릭스 완전성만 보강하며, 변경 3은 이미 사실로 기술된 single-instance 결정의 근거를 Rationale 에 명문화하는 것이다. 기각된 대안의 재도입, 합의된 invariant 위반, 무근거 번복은 어느 변경에서도 발견되지 않았다.

---

## 위험도

NONE
