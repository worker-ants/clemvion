# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** `PATCH /notifications/read-all` → `POST /notifications/mark-all-read` 표기 정정 — 기존 Rationale 부재
  - target 위치: 변경안 #1-C §3 상태 전이 다이어그램 + 변경안 #1-E Rationale "옛 spec 의 `PATCH /notifications/read-all` 표기 정정 (2026-05-17)"
  - 과거 결정 출처: `spec/data-flow/8-notifications.md §3` (기존 다이어그램에 `PATCH /notifications/read-all` 표기), `spec/2-navigation/9-user-profile.md` (이미 `POST /api/notifications/mark-all-read` 로 올바르게 기재)
  - 상세: 기존 `8-notifications.md §3` 다이어그램이 `PATCH /notifications/read-all` 로 잘못 표기되어 있었고, `9-user-profile.md` 에는 이미 `POST /notifications/mark-all-read` 로 올바르게 기재되어 있었다. 두 spec 파일 간에 불일치가 있었고, draft 는 이를 `POST /notifications/mark-all-read` 로 통일하면서 오기 정정임을 Rationale 에 기록하고 있다. 이는 과거 결정을 번복하는 것이 아니라 잘못 기재된 spec 과 실제 구현의 불일치를 해소하는 것이므로 Rationale 추가 요건을 충족한다. 다만, `POST /notifications/mark-all-read` 가 언제, 왜 `PATCH` 가 아닌 `POST` 액션 endpoint 로 설계되었는지의 원래 결정 배경이 Rationale 에 전혀 없다. draft 에서 이를 단순히 "구현과 맞춤" 으로만 처리하고 있어, 이 endpoint 자체의 동사 선택 근거가 Rationale 에 누락된 채 새 dismiss 엔드포인트의 동사 대칭 근거로 사용되고 있다.
  - 제안: `mark-all-read` 의 `POST` 채택 경위(기존 관례 또는 최초 설계 근거)를 Rationale 에 한 문장이라도 보충하거나, 해당 경위가 불명인 경우 "구현 기반 사실 확인, 동사 선택 근거 불명" 임을 명시. 이는 향후 dismiss 동사 선택의 대칭 근거 체인이 완전해지게 한다.

- **[INFO]** `hasRecentByResource` — dismissed row 카운트 포함 결정의 기존 Rationale 참조 부재
  - target 위치: 변경안 #1-D §4.4 "중복 방지 와의 관계" + 변경안 #1-E Rationale `dismissed_at` 근거 4번
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` 의 기존 Rationale (현행 두 항목 — JSONB preference 이유, Email 실패 warn 만) 어디에도 `hasRecentByResource` 동작 원칙이 없음
  - 상세: `hasRecentByResource` 가 dismissed row 를 카운트에 포함해야 한다는 결정은 신규 결정이며, 기존 Rationale 에 관련 항목이 없으므로 Rationale 재도입·충돌 문제는 없다. 단, "향후 별도 옵션으로 분리하지 않는다" 라는 강한 표현("본 동작은 의도된 것이며, 향후 별도 옵션으로 분리하지 않는다")이 본문(§4.4)에만 있고 Rationale 에 충분히 옮겨지지 않았다. spec 본문이 의사결정 근거를 담는 자리는 Rationale 이며, 본문에 의사결정을 박제하면 spec 갱신 시 이 문장이 삭제될 위험이 있다.
  - 제안: §4.4 의 "본 동작은 의도된 것이며, 향후 별도 옵션으로 분리하지 않는다" 문장을 §4.4 본문에서 제거하거나 간략화하고, 해당 결정 근거(over-noise 방지)를 변경안 #1-E Rationale 의 `dismissed_at` 채택 근거에 §4.4 참조와 함께 명시적으로 포함. 현재 Rationale 근거 4번이 이를 다루고 있으나, 별도 옵션을 두지 않는다는 결정 자체를 Rationale 에 더 명시적으로 분리 기록하는 것이 좋다.

- **[INFO]** `active` 어휘 회피 — 기존 어휘 점유 충돌 근거 Rationale 미등재
  - target 위치: 변경안 #1-D §4.1 차원 분리 표 아래 blockquote ("'active' 라는 어휘는 … 이미 점유되어 있으므로, 본 spec 에서는 … `visible` 로 일관 표기")
  - 과거 결정 출처: `spec/1-data-model.md`, `spec/data-flow/` 전반 (`Workflow.is_active`, `Trigger.is_active`, `Schedule.is_active` 의 어휘)
  - 상세: `active` 어휘 회피 결정의 근거(기존 라이프사이클 컬럼과의 충돌)가 §4.1 본문 blockquote 에만 있고 Rationale 에 독립적으로 등재되어 있지 않다. 이 결정은 향후 다른 개발자가 `visible` 대신 `active` 를 사용하는 코드를 작성하려 할 때 반드시 알아야 하는 invariant 이므로, Rationale 에 별도 항목으로 등재하는 것이 적절하다. 현재 CLAUDE.md 규약상 "아키텍처 결정의 배경·근거"는 Rationale 에 두어야 한다.
  - 제안: 변경안 #1-E Rationale 에 "어휘 선택 — `visible` / `dismissed` (2026-05-17)" 항목을 추가해 `active` 회피 이유를 기록. §4.1 본문 blockquote 는 간략한 안내로 유지하되 Rationale 참조를 추가.

---

### 요약

Rationale 연속성 관점에서 target draft 는 전반적으로 양호하다. 기존 `spec/data-flow/8-notifications.md` Rationale 에는 현재 두 항목만 존재하며, draft 가 도입하는 dismissed_at soft delete, POST 액션 endpoint, 차원 분리 결정 중 어느 것도 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하지 않는다. HTTP 동사(DELETE → POST)에 관한 이전 consistency-check 세션(r1, `15_53_16`)의 CRITICAL C-1/C-2 차단 내용을 draft 가 올바르게 반영하고 있으며, 새 결정마다 Rationale 을 inline 으로 작성한 점도 규약을 준수한다. 단, 세 가지 소규모 정합 보완 사항이 있다: (1) `mark-all-read` 의 POST 동사 선택 원래 근거가 Rationale 에 없어 새 dismiss endpoint 의 대칭 논거 체인이 불완전한 점, (2) `hasRecentByResource` 의 dismissed row 포함이라는 강한 결정이 Rationale 이 아닌 본문에만 박혀 있는 점, (3) `active` 어휘 회피 결정이 Rationale 에 독립 항목으로 등재되지 않은 점 — 이 모두 INFO 등급이며 CRITICAL 또는 WARNING 에 해당하는 Rationale 연속성 위반은 없다.

### 위험도

LOW
