# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/4-integration/4-cafe24.md`
검토 범위: `--impl-prep` — Cafe24 `fields` 추가 버튼 버그 수정 구현 착수 전 검토
수정 방향 요약: `Cafe24Config` 컴포넌트에 keyvalue 편집용 React state 도입 → 빈 key 행이 UI에 유지되도록 함. 사용자가 key를 채운 시점에 `Record<string,unknown>` 형태로 `config.fields`에 반영. 백엔드 계약의 object shape은 그대로 보존.

---

### 발견사항

이하 4개 점검 관점 모두 적용한 결과, 명시적 CRITICAL·WARNING 항목은 발견되지 않았다. INFO 1건을 기록한다.

- **[INFO]** UI state 분리 패턴이 Rationale 어느 항목에도 명시되지 않음
  - target 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` `Cafe24Config` 컴포넌트 (spec §2 설정 UI 구현부)
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.5` (Principle 7 — config는 rawConfig echo) 및 `§1` (fields 타입 `Record<string, unknown>`)
  - 상세: Principle 7은 백엔드 handler가 `context.rawConfig`를 config echo로 사용하는 **backend 측 계약**이다. 수정 방향은 프론트엔드 편집 중간 상태(빈 key 행)를 React state에 격리하고, key가 채워진 시점에만 `Record<string,unknown>`으로 `config.fields`를 갱신하는 패턴이다. 이는 Principle 7을 위반하지 않는다 — 백엔드에는 항상 key가 있는 행만 전달되기 때문이다. 다만 이 "UI 편집 버퍼"와 "저장 계약 state"를 분리하는 패턴은 spec §2 설정 UI 섹션이나 §9 Rationale 어디에도 명시된 적이 없다. 이번 수정이 처음으로 이 패턴을 도입하는 구현 사례가 된다.
  - 제안: spec §9 Rationale 또는 §2 설정 UI 섹션에 "편집 버퍼와 config 저장 상태의 분리" 원칙을 짧게 기록해두면, 동일 컴포넌트를 이후 수정하는 구현자가 패턴 의도를 오해할 가능성을 줄일 수 있다. 필수 수정 사항은 아니다.

---

### 점검 결과 (4개 관점)

1. **기각된 대안의 재도입**: 해당 없음. spec §9.1은 endpoint-당 노드(A)·범용 HTTP 노드(B)를 기각하고 단일 노드+메타데이터(C)를 채택했다. 수정 방향은 이 결정과 무관한 UI 버그 수정이다.

2. **합의된 원칙 위반**: 해당 없음. spec §1의 `fields: Record<string, unknown>` 타입 계약과 §9.5의 Principle 7(config echo) 모두 이번 수정 후에도 유지된다. UI 내부 편집 버퍼는 백엔드에 노출되지 않으며 key가 채워진 행만 object로 변환되어 전달된다.

3. **결정의 무근거 번복**: 해당 없음. 수정 방향은 기존 결정을 번복하지 않는다. spec 변경도 없다.

4. **암묵적 가정 충돌**: 해당 없음. spec §9.3(메타데이터 위치)·§9.4(Private/Public 앱)·§9.8(HMAC 검증) 등 모든 시스템 invariant는 프론트엔드 UI state 레이어와 무관하다.

---

### 요약

이번 구현은 `Cafe24Config` 내부 React state에서 빈 key 행을 일시적으로 보유하고, key가 채워진 시점에만 `config.fields`(`Record<string,unknown>`)로 반영하는 UI 버그 수정이다. spec §4-cafe24.md의 모든 Rationale 항목 — 단일 노드+메타데이터 원칙(§9.1), config echo 계약(§9.5 Principle 7), object shape 타입(§1), HMAC 보안 invariant(§9.8) — 과 충돌하지 않는다. 기각된 대안의 재도입이나 합의된 원칙의 위반은 발견되지 않았다. 유일한 발견은 INFO 1건으로, UI 편집 버퍼 분리 패턴이 Rationale에 미기록 상태라는 보완 제안이다.

### 위험도

NONE
