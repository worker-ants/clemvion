# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
검토 기준: `spec/5-system/4-execution-engine.md ## Rationale` 및 관련 spec Rationale 발췌

---

## 발견사항

### [INFO] "의도적 중복 방어" 선언은 신규 원칙 — 기존 Rationale 와 충돌 없음
- target 위치: `## 제안 변경` 신규 blockquote — "이 두 레이어는 **의도적 중복 방어**이며, 한쪽만 변경할 경우 불일치 창이 재개방된다"
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — 기존 Rationale 는 cross-entity 원자성(Execution↔NodeExecution 단일 트랜잭션)만 기술하며, intra-row(컬럼 vs outputData 봉투) 불일치창 방어를 명시한 항목이 없음
- 상세: target 이 제안하는 내용은 기존 Rationale 가 **다루지 않은 빈 영역**에 새 설명을 추가하는 것이다. 기각된 대안을 재도입하거나 합의된 원칙을 번복하지 않는다. "의도적 중복 방어" 개념은 spec 내 다른 영역(`spec/4-nodes/6-presentation/0-common.md`, `spec/7-channel-web-chat/4-security.md`)에서 동일한 용어·개념으로 이미 합의된 패턴이므로, 본 target 의 사용도 기존 관행과 일관된다.
- 제안: 변경 없이 진행 가능. spec 반영 시 기존 blockquote 직후 위치에 새 blockquote 를 붙이는 것이 가장 충돌이 적다.

---

### [INFO] "Phase 3 fix (REPEATABLE READ 트랜잭션)" 참조 — spec 미기재 외부 사실
- target 위치: `## 배경` — "기존 Phase 3 fix (REPEATABLE READ 트랜잭션)는 … intra-row 불일치는 잡지 못한다"
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` 전체 — REPEATABLE READ 트랜잭션이 기존 방어로 작동한다는 내용이 현행 spec 어느 곳에도 없음
- 상세: target 의 "배경" 문단은 "Phase 3 fix (REPEATABLE READ 트랜잭션)"를 spec 에 없는 사실로 전제한다. 이는 plan 문서 내 배경 설명의 역할로 허용되지만, 제안하는 spec 본문 신규 blockquote 에는 이 Phase 3 fix 가 언급되지 않아 spec 텍스트 자체는 맥락이 완전하다. Rationale 충돌은 없으나, spec 정식 반영 시 "Phase 3 fix" 의 기원도 spec §Rationale 에 메모해두면 향후 유지보수자가 두 레이어의 역할 분담을 추적하기 쉬워진다.
- 제안: spec §Rationale 에 "pre-park read-window 정규화" 항 추가 시, "cross-entity 원자성(기존)은 intra-row 창을 막지 않는다"는 배경 한 줄을 함께 포함하면 충분하다(target 제안 blockquote 본문에 이미 포함됨).

---

### [INFO] `exec-park-durable-resume` Phase-B §1.1 전이표 삽입 순서 의존 — Rationale 내용 충돌 없음
- target 위치: `> 삽입 순서 NOTE (impl-done consistency W-1)` blockquote
- 과거 결정 출처: `spec/5-system/4-execution-engine.md ## Rationale` — "park 즉시 해제 + slow-path 일원화 (Phase B)" 항, §1.1 전이표는 Phase B 작업의 핵심 대상
- 상세: target 이 주의하는 텍스트 충돌 가능성은 Rationale 충돌이 아니라 편집 순서 관리 이슈다. Phase B 의 §1.1 전이표 편집이 먼저 main 에 랜딩된 뒤 본 plan 의 blockquote 를 삽입하라는 지시는 Rationale 의 합의된 원칙과 배치되지 않는다.
- 제안: 변경 없음. 해당 NOTE 는 plan 문서 범위 이슈이며 spec Rationale 연속성과 무관하다.

---

## 요약

target 문서(`spec-update-execution-engine-pre-park-window.md`)는 `spec/5-system/4-execution-engine.md §Rationale`에서 기각·폐기된 대안을 재도입하거나 합의된 불변식을 위반하지 않는다. 제안하는 spec 본문 추가는 기존 Rationale 가 다루지 않는 빈 영역(intra-row inconsistency 방어)을 새로 기술하는 것으로, 기존 원자성 보장(cross-entity, 단일 트랜잭션) 서술과 직교하며 이를 보완한다. "의도적 중복 방어" 개념은 프로젝트 내 다른 spec 영역에서 이미 합의·정착된 패턴과 일관된다. 경미한 정보성 사항으로는 plan 배경에 언급된 "Phase 3 fix (REPEATABLE READ)" 가 현행 spec 에 미기재인 점이 있으나, 이는 기각된 대안 재도입이나 원칙 위반이 아니며 spec 반영 시 Rationale 한 줄로 맥락을 완성할 수 있다.

## 위험도

NONE
