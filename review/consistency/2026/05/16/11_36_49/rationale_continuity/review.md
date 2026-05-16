# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-cleanup.md`
참조 spec: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/2-navigation/4-integration.md`

---

### 발견사항

- **[WARNING]** CHANGELOG 에 드롭된 변경 3 이 적용된 것처럼 기재됨
  - target 위치: draft `## CHANGELOG 추가 (§10)` 절 (L94-96)
  - 과거 결정 출처: draft `## 변경 3 (선택) — §5 Case 번호 연속화 — **드롭 (의도된 컨벤션)**` 절 (L77-90)
  - 상세: CHANGELOG 예시 문자열에 `§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)` 라는 구절이 명시되어 있다. 그러나 동일 draft 본문에서 변경 3 은 명시적으로 **적용하지 않는다**고 결정했다. 해당 CHANGELOG 항목을 그대로 spec 에 반영하면 실제로는 이루어지지 않은 변경이 이력에 기록된다. 이는 spec CHANGELOG 를 읽는 후속 독자가 §5 번호가 연속화되었다고 오해하게 만들어, 0-common.md §7 cross-node alignment (5.1/5.3/5.8 sparse 컨벤션) 를 정당한 근거 없이 번복한 것처럼 보이게 된다.
  - 제안: CHANGELOG 항목에서 `§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)` 구절을 삭제하고, 대신 INFO 성격의 조사 결과를 기술한다. 예: `§5 Case 번호 불연속 (5.1·5.3·5.8) — cross-node 컨벤션임을 확인, 변경 없음.`

- **[INFO]** §9.9 신설에서 대안 (A) 의 폐기 이유가 동일 spec 내 기존 결정(§9.8 HMAC 식별 전략)과 독립적임을 명시하지 않음
  - target 위치: draft `신규 §9.9` 절 (L53-62)
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.8` HMAC 검증 알고리즘 / `spec/2-navigation/4-integration.md ## Rationale` "install_token 을 App URL path 식별 키로 승격" 항
  - 상세: §9.9 의 대안 (A) `config.fields 를 그대로 컴포넌트 state 의 원천으로 사용` 폐기 이유로 `PR #62 가 해결한 버그` 를 언급하는데, 이는 충분하다. 다만 §9.9 는 UI 내부 버퍼 패턴에 관한 결정이므로 §9.8 (backend 식별 전략) 과 관계가 없음이 자명하지만, Rationale 구조상 `같은 패턴이 다른 통합 노드에 도입될 때 동일 결정을 그대로 적용한다` 는 일반화 원칙을 선언하면서 `backend 가 받는 직렬화 형식 (Record<string, unknown>) 은 불변이다` 라는 invariant 를 제시한다. 이 invariant 가 기존 §1 config 스키마(`fields | Record<string, unknown>`)와 정합하므로 문제는 없으나, 향후 `fields` 타입이 변경될 경우 §9.9 의 `불변` 선언이 Rationale 충돌 지점이 될 수 있다. 현 단계에서는 §1 과 일치하므로 INFO 로 분류.
  - 제안: §9.9 본문 끝에 `불변 전제 기준: §1 config 스키마의 \`fields: Record<string, unknown>\` 정의 (변경 시 본 결정 재검토 필요)` 를 한 줄 추가해 invariant 의 근거 anchor 를 명시한다.

- **[INFO]** 변경 2 (§9.7 본문 위치 정정) 가 spec Rationale 변경이 아닌 오탈자 수정임에도 CHANGELOG 기재 방식이 Rationale 결정 번복처럼 읽힐 수 있음
  - target 위치: draft `## CHANGELOG 추가 (§10)` / `## 변경 2` 절
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.7` (헤더만 존재, 본문 orphan 상태)
  - 상세: §9.7 본문이 §9.8 본문 뒤에 위치한 것은 편집 오류(orphan)이며 결정 번복이 아니다. CHANGELOG 가 이를 `§9.7 본문 위치 정정` 으로 충분히 명시하고 있어 큰 문제는 없다. 다만 검토자 관점에서 §9.7 이 현재 헤더만 있는 상태임을 알지 못하면 "본문이 삭제·이동된 결정 번복" 으로 오해할 여지가 있다. 현 draft 는 `(orphan, 9.8 본문 뒤에 잘못 위치)` 라는 설명을 포함해 이를 완화하고 있으므로 INFO 로 분류.
  - 제안: CHANGELOG 항목에 `(편집 오류 수정 — 내용 변경 없음)` 을 괄호로 병기해 결정 번복이 아님을 명확히 한다.

---

### 요약

Rationale 연속성 관점에서 본 draft 의 핵심 변경 (§9.9 신설, §9.7 본문 위치 정정, 변경 3 드롭) 은 모두 기존 spec 의 합의된 원칙·invariant 와 충돌하지 않는다. 변경 3 드롭 결정이 0-common.md §7 의 cross-node alignment 컨벤션을 명확히 인식하고 내린 것임도 Rationale 연속성 관점에서 올바르다. 다만 CHANGELOG 예시 문자열에 실제로는 적용되지 않은 변경 3 내용이 포함되어 있어, 이 상태로 spec 에 반영되면 이력이 사실과 불일치하는 WARNING 이 발생한다. 이 항목만 수정하면 Critical·CRITICAL 이슈 없이 spec 반영 가능하다.

---

### 위험도

LOW
