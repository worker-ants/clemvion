# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/button-cap-spec-validator.md` (plan draft 검토 모드)
검토 일시: 2026-05-19

---

### 발견사항

- **[CRITICAL]** `1-carousel.md` 에 기각된 "4개 cap" 표현 다수 잔존
  - target 위치: `spec/4-nodes/6-presentation/1-carousel.md` — 라인 22 (`동적 아이템 공통 버튼, 최대 4개`), 24 (`글로벌 버튼 정의, 최대 10개`), 35 (`per-item 버튼, 최대 4개`), 417 (`최대 10개 버튼(글로벌). per-item은 ItemDef당 최대 4개, itemButtons도 최대 4개`), 432 (에러 메시지 표: `maximum 4 buttons per item`)
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §Rationale "버튼 cap 정책 (2026-05-19)" — 선택지 ①(`4개 유지`)·②(`10개 상향`) 기각, ③(`frontend 5 / backend 5 통일`)을 채택. "종전 carousel itemButtons 만 4개 → 본 spec 개정으로 5개" 로 명문화됨.
  - 상세: `0-common.md` §1.1 은 이미 "5개"로 갱신됐고 §Rationale 이 "4개 → 5개" 기각을 기록했다. 그러나 `1-carousel.md` 은 해당 값들이 그대로 남아 있어, 새 Rationale 에서 명시 기각된 "4개 / 10개" cap 을 carousel 세부 spec 이 그대로 재표방하는 상태다. 에러 메시지 표(§7, 라인 432)도 `maximum 4 buttons per item` 이라 실제 backend 검증 기준(5)과 다른 내용을 보여준다. plan 의 작업 항목에는 `spec/4-nodes/6-presentation/0-common.md` 갱신만 명시되어 있고 `1-carousel.md` 갱신은 포함되지 않았다.
  - 제안: `1-carousel.md` 라인 22/24/35/417 의 "4개" → "5개", "10개" → "5개" 로 수정. §7 에러 메시지 표의 `maximum 4 buttons per item` → `maximum 5 buttons per item` 로 수정. plan 작업 항목에 해당 수정을 추가한다.

- **[WARNING]** `2-table.md` 에 기각된 "10개 초과" 에러 설명 잔존
  - target 위치: `spec/4-nodes/6-presentation/2-table.md` — 라인 353 (`버튼 라벨 누락 / link URL 누락 / port + URL 충돌 / 버튼 ID 중복 / 10개 초과 | …`)
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §Rationale "버튼 cap 정책 (2026-05-19)" — globalButtons 도 10 → 5 로 기각.
  - 상세: Table 에러 표에서 "10개 초과" 라고 직접 숫자를 명시한 채 `validateButtons`(공통 §1.1) 를 위임한다고 기술한다. §1.1 이 이제 5개라 실제 검증 기준은 5개이지만, table 에러 표는 "10개 초과" 라는 기각된 값을 독자에게 제시한다. 즉 spec 을 읽는 사람이 table 에서 10개까지 허용된다고 오해할 수 있다.
  - 제안: 라인 353 의 `/ 10개 초과` 를 `/ 5개 초과` 로 수정하거나, 숫자를 직접 쓰는 대신 `(공통 §1.1 의 최대 버튼 수 초과)` 처럼 cap 정의를 §1.1 에 위임하는 표현으로 교체.

- **[INFO]** plan 작업 항목에 `1-carousel.md` / `2-table.md` 갱신이 누락됨
  - target 위치: `plan/in-progress/button-cap-spec-validator.md` §작업 항목 — spec 변경 항목이 `spec/4-nodes/6-presentation/0-common.md` 만 체크됨.
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` §Rationale "버튼 cap 정책 (2026-05-19)" — 4-layer SSOT(spec §1.1, 백엔드 상수, validator, frontend default) 전체 정렬을 선언.
  - 상세: Rationale 이 "4-layer SSOT 정렬" 을 명시 채택했음에도, spec 레이어 안에서 `0-common.md` 만 갱신하고 `1-carousel.md` 와 `2-table.md` 는 plan 체크리스트 범위에서 빠졌다. SSOT 원칙을 선언하면서 하위 spec 을 남긴 것이 불완전하다.
  - 제안: plan §작업 항목에 "[ ] `spec/4-nodes/6-presentation/1-carousel.md`: 라인 22/24/35/417/432 cap 값 5로 수정" 및 "[ ] `spec/4-nodes/6-presentation/2-table.md`: 라인 353 '10개 초과' → '5개 초과' 수정" 항목 추가.

---

### 요약

`0-common.md` §Rationale "버튼 cap 정책 (2026-05-19)" 은 "4개 cap 유지"(안 ①)와 "10개 유지"(안 ②) 를 명시 기각하고 5/5 통일(안 ③)을 채택했다. 그러나 `1-carousel.md` 는 기각된 "4개"(itemButtons)·"10개"(globalButtons) cap 을 라인 22·24·35·417·432 에 그대로 유지하고 있어, 새 Rationale 에서 결정적으로 기각된 대안이 carousel 세부 spec 에서 재표방되는 직접 충돌이 발생한다. 에러 메시지 표(§7 라인 432)의 `maximum 4 buttons per item` 은 backend 가 현재 5를 강제하는 상황에서 spec 독자에게 오정보를 제공한다. `2-table.md` 의 "10개 초과" 표현도 같은 사유로 갱신이 필요하다. plan 작업 항목이 `0-common.md` 만 체크한 채 두 파일을 누락한 것이 이 일관성 결손의 직접 원인이다.

---

### 위험도

HIGH
