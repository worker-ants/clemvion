# Rationale 연속성 검토 결과

- 검토 모드: spec draft (--spec)
- Target: `plan/in-progress/spec-fix-isactive-drawer-toggle.md`
- 관련 spec: `spec/2-navigation/2-trigger-list.md`
- 검토 시각: 2026-05-29

---

## 발견사항

### INFO-1 — R-4 참조 구조가 올바르게 유지됨 (확인)

- target 위치: "적용 변경 §2.3.1 `isActive` 행 변경" 비고 문구
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` Rationale R-4
- 상세: 변경 후 비고가 `(Rationale R-4 / R-16)` 으로 R-4 를 명시 유지한다. R-4 의 핵심 합의("PATCH body 와 `/toggle` API 경로를 모두 유지") 는 본 변경에서 손대지 않으며, target 문서도 "API 편집 경로 자체는 PATCH body 와 /toggle 양쪽 유지 (Rationale R-4 / R-16)" 로 이를 명문화했다. R-4 원칙 위반 없음.
- 제안: 이미 적절히 처리됨. 별도 조치 불필요.

### INFO-2 — R-2 계보 추적 가능 여부 (확인)

- target 위치: 전체 문서 (R-2 직접 언급 없음)
- 과거 결정 출처: R-2 (Webhook HMAC secret 입력 vs rotate 분리, 2026-05-22), R-14 (authConfigId v1 격상, 2026-05-28)
- 상세: R-2 는 R-14 에 의해 이미 공식 번복됐다 (`R-14` 항에 "R-2 TBD 번복" 명시). 현재 spec §2.3.1 에는 R-2 가 다루던 인라인 `hmacSecret` 행 자체가 삭제되어 있다. target 문서는 `isActive` UI 변경만 다루며 R-2 와 접점이 없다. R-2 번복·R-14 격상 계보는 spec 본문에 이미 기록됐고, target 문서가 이를 재도입하거나 무시하는 요소는 없다.
- 제안: 이미 적절히 처리됨.

### WARNING-1 — R-16 신설을 plan 문서에만 기술하고 spec 에 아직 미반영 상태임

- target 위치: "적용 변경" 항목 2번 ("Rationale R-16 신설")
- 과거 결정 출처: N/A (신규 Rationale)
- 상세: target plan 문서가 R-16 신설을 선언하지만, 실제 `spec/2-navigation/2-trigger-list.md` 의 Rationale 섹션에는 R-16 이 존재하지 않는다. Plan 문서는 작업 지시서이므로 spec 변경이 아직 미적용된 상태 자체는 정상이나, R-16 의 내용(drawer read-only + ⋮ 액션 단일 편집 경로 결정 근거)이 plan 문서에는 요약만 되어 있고 대안 기각 사유·근거 상세가 아직 없다. spec 에 R-16 을 실제 작성할 때 "Drawer 내 edit 토글 구현 (Option A)" 이 기각된 이유가 충분히 문서화되어야 한다.
- 제안: spec 반영 시 R-16 에 (a) 기각된 Option A (drawer inline toggle 신규 구현)와 그 사유(shipping 동작과 불일치·추가 구현 부담·reviewer 가 버그로 분류하지 않음), (b) §2.1 "⋮ 행 액션과 동등" 표현과의 관계를 명시해야 한다. plan 문서가 이미 근거를 충분히 담고 있으므로 spec 작성 시 그대로 이관하면 된다.

### INFO-3 — §2.3.1 현행 문구 ("edit 토글 버튼") 와 target 변경 간 충돌은 의도된 spec 정정임

- target 위치: "적용 변경" 항목 1번 (현행 → 변경)
- 과거 결정 출처: spec §2.3.1 `isActive` 행 원문 ("edit (토글 버튼)")
- 상세: 현행 spec 표현은 구현보다 앞서 작성된 요구사항이다. target 문서는 이를 "구현이 이미 Option B 형태로 출시됨" 을 근거로 spec 을 현실에 정렬하는 것이라 명확히 밝히고 있다. 이는 "결정의 무근거 번복" 이 아니라 "미구현 spec 을 shipping 상태에 맞춰 갱신"하는 패턴으로, R-16 이라는 새 Rationale 신설을 수반한다. 번복 근거가 plan 문서 안에 기재되어 있어 Rationale 연속성 관점에서 허용 가능하다.
- 제안: spec 반영 시 "이전 `edit (토글 버튼)` 명세는 구현 전 요구사항이었고 shipping 구현과 일치하지 않아 R-16 에 의거 정정" 이라는 맥락 한 문장을 R-16 안에 포함하면 미래 독자의 혼란을 방지할 수 있다.

---

## 요약

target plan 문서(`spec-fix-isactive-drawer-toggle.md`)는 기존 Rationale 에서 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. R-4(API 이원화 유지)는 명시적으로 보존되고, R-14 에 의해 이미 번복된 R-2 와는 접점이 없다. 유일한 주의점은 plan 문서가 예고한 R-16 신설이 아직 spec 에 반영되지 않았다는 점으로, spec 반영 시 Option A 기각 사유와 §2.1 행 액션 동등 선언과의 관계를 R-16 본문에 충분히 서술해야 미래 리더가 "drawer 에 toggle 이 없는 이유" 를 추적할 수 있다. 전체적으로 Rationale 연속성 관점의 구조적 위반은 없으며, spec 미반영 상태는 plan 문서의 성격상 자연스럽다.

---

## 위험도

LOW
