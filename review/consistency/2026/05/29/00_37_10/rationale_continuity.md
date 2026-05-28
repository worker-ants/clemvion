# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
검토 대상: `spec/2-navigation/6-config.md`
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] R-1 (select-only) 기각 대안 — combobox 완전 제거 확인됨

- target 위치: `spec/2-navigation/6-config.md §B.2 "기본 모델 선택 UX"` + `## Rationale R-1`
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-1` (2026-05-26) — combobox/자유 입력 fallback 을 기각 대안으로 명시
- 상세: target 본문 §B.2 와 R-1 은 자유 입력 제거·select-only 강제를 일관되게 선언하고 있다. 기각된 "combobox 유지 + 저장 시점 서버 검증" 및 "조회 실패 시 자유 입력 허용" 두 대안이 R-1 에 명시 기록되어 있어, 구현자가 이를 재도입하지 않도록 명확히 안내하고 있다. 충돌 없음.
- 제안: 없음. 현 기술로 충분.

### [INFO] R-2 (bearer_token 자동 발급 강제) — 이전 "사용자 입력" 옵션 번복 정합 확인됨

- target 위치: `spec/2-navigation/6-config.md §A.2 Bearer Token` + `## Rationale R-2`
- 과거 결정 출처: `spec/1-data-model.md §2.17.3 Rationale — bearer_token 자동 발급 강제 (2026-05-28, consistency W-2)` 및 `spec/5-system/12-webhook.md ## Rationale — inline auth path 폐지 (2026-05-28)`
- 상세: target §A.2 Bearer Token 표는 "Token | 자동 생성 (`wft_<hex32>`, … 사용자 입력은 받지 않음)" 으로 기술하고, R-2 가 "기존 '자동 생성 또는 사용자 입력' 중 사용자 입력 옵션 제거" 라는 번복 근거를 명시하고 있다. 데이터 모델 §2.17.3 도 동일 결정을 Rationale 에 기록했다. 번복이 의도적이고 새 Rationale 이 동반되어 있어 연속성 훼손 없음.
- 제안: 없음.

### [INFO] R-2 (Bearer Token 만료 시간 필드 v1 제외) — 이전 "만료 시간 (선택)" 제거 근거 명시 확인됨

- target 위치: `spec/2-navigation/6-config.md ## Rationale R-2` 세 번째 항목 "Bearer Token 만료 시간 필드 v1 제외"
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-2` (2026-05-28) — "기존 '만료 시간 (선택)' 행을 제거. … 만료/회전이 필요해지면 후속 결정으로 재도입" 이라는 조건부 번복 명시
- 상세: 이전에 존재하던 만료 시간 필드를 이번 v1 scope 에서 제외하는 번복이 목적·조건(JSONB 스키마 `{ token }` 정합)과 함께 기록되어 있다. 구현자가 v1 에서 만료 시간 UI 를 추가하면 이 결정에 위배되며, 후속 결정 없이 재도입하면 CRITICAL 이 된다. 현 spec 상태 자체는 연속성 충돌 없음.
- 제안: 구현 착수 시 만료 시간 필드를 누락한 것이 의도임을 플랜 문서에 명시해 두면, 향후 개발자가 "누락" 으로 오인하는 위험을 차단할 수 있다.

### [INFO] KB spec 과 select-only 정책 cross-reference 정합 확인됨

- target 위치: `spec/2-navigation/6-config.md ## Rationale R-1` 마지막 "연관 spec" 항
- 과거 결정 출처: `spec/2-navigation/5-knowledge-base.md ## Rationale R-1` (2026-05-26)
- 상세: 두 spec 이 동일 select-only 정책을 cross-reference 하고 있으며, KB spec 이 6-config R-1 을 단일 진실로 위임하는 구조가 정합적이다. 충돌 없음.
- 제안: 없음.

---

## 요약

`spec/2-navigation/6-config.md` 는 Rationale 연속성 관점에서 전반적으로 건강하다. 주요 번복 결정(bearer_token 자동 발급 강제, 만료 시간 필드 v1 제외, select-only 강제)은 모두 R-1·R-2 에 동반 근거를 기록해 "이유 없는 번복" 에 해당하지 않는다. 기각된 대안(combobox 자유 입력, 저장 시점 서버 검증, 사용자 입력 bearer token)은 명시적으로 폐기 이유가 기록되어 있어 구현자가 재도입하는 것을 사전에 차단할 수 있는 구조다. 합의된 시스템 invariant(AuthConfig 단일 진입 원칙, 평문 secret DB 잔존 금지, RBAC 일관성)에 반하는 설계가 target 에 포함된 것은 확인되지 않는다. 발견된 4건은 모두 INFO 수준이며 구현 진행을 차단하지 않는다.

---

## 위험도

NONE
