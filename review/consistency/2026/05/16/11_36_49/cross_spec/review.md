# Cross-Spec 일관성 검토 — spec-draft-cafe24-cleanup.md

검토 대상: `plan/in-progress/spec-draft-cafe24-cleanup.md`
수정 대상 파일: `spec/4-nodes/4-integration/4-cafe24.md`
검토 일시: 2026-05-16

---

### 발견사항

- **[WARNING]** §9.9 의 "다른 통합 노드 적용" 선언이 `1-http-request.md` 의 기존 `KeyValue[]` 저장 모델과 잠재적 긴장
  - target 위치: `plan/in-progress/spec-draft-cafe24-cleanup.md` §변경 1, 신규 §9.9 본문 마지막 단락 — "같은 패턴(KeyValueEditor + object-shaped backend contract)이 다른 통합 노드에 도입될 때 동일 결정을 그대로 적용한다"
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §1 config 정의 (L17-18) — `headers: KeyValue[]`, `queryParams: KeyValue[]`. 이 노드는 이미 `KeyValue[]` 형태를 config/output 직렬화 형식으로 사용하며, "UI 버퍼 = 저장 형식"이 일치하는 모델이다.
  - 상세: cafe24 의 `fields: Record<string, unknown>` 는 "UI 배열 버퍼 → object 변환" 이 필요한 이유가 backend contract 형식이 object 이기 때문이다. 반면 http_request 의 `headers`/`queryParams` 는 config 자체가 `KeyValue[]` 이므로 버퍼 변환 레이어가 필요 없다. §9.9 의 선언을 그대로 읽으면 http_request 에도 "내부 버퍼 → Record 변환" 을 적용해야 한다고 오해될 수 있다. 두 노드의 config 직렬화 형식이 다른데 같은 결정을 "그대로 적용"한다고 기술하면 혼란을 유발한다.
  - 제안: §9.9 마지막 단락을 "같은 패턴(`KeyValueEditor` + **object-shaped** backend contract, 즉 `config.X: Record<string, unknown>`)이 다른 통합 노드에 도입될 때 동일 결정을 적용한다"로 좁혀 범위를 명시한다. `KeyValue[]` 를 그대로 저장하는 http_request 형 노드는 적용 대상 외임을 병기하거나, 단락을 삭제하고 cafe24 한정 결정으로만 남긴다.

- **[WARNING]** CHANGELOG §10 의 신규 항목에 "§5 Case 번호 연속화"가 기록될 위험
  - target 위치: `plan/in-progress/spec-draft-cafe24-cleanup.md` §CHANGELOG 추가 — "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)"
  - 충돌 대상: 동일 draft §변경 3 — "변경 3 은 적용하지 않는다"
  - 상세: Draft 의 CHANGELOG 신규 행(L97)에는 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)"가 적용 항목으로 서술되어 있다. 그러나 §변경 3 섹션에서 해당 변경은 명시적으로 드롭 처리되었다. 이 항목이 CHANGELOG 에 그대로 삽입되면 실제 수행하지 않은 변경이 이력에 기록되어 이후 cross-reference 추적 시 혼란을 유발한다.
  - 제안: CHANGELOG 신규 행에서 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)" 문구를 삭제하고 적용된 변경(§2 편집 버퍼 원칙, §9.9 신설, §9.7 본문 위치 정정)만 기록한다.

- **[INFO]** §9.7 orphan 본문의 `1-http-request.md` 와의 scope wire format 기술 중복
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` L439-450 (현 §9.7 orphan 본문)
  - 충돌 대상: `spec/2-navigation/4-integration.md §3.2 4단계` — 동일 날짜 CHANGELOG(2026-05-14) 에서 "spec/2-navigation/4-integration.md §3.2 4단계에도 동일 노트 inline" 으로 기록됨
  - 상세: §9.7 본문 위치 정정 자체는 cross-spec 충돌이 아니다. 다만 같은 OAuth scope wire format 결정이 `4-cafe24.md §9.7`과 `4-integration.md §3.2` 두 곳에 중복 기술되어 있는 상태다. 이번 draft 가 §9.7 본문을 올바른 위치로 이동시키면서 관련 cross-reference anchor(`4-integration.md §3.2`)와의 동기화 여부를 확인할 필요가 있다.
  - 제안: §9.7 위치 정정 후 `spec/2-navigation/4-integration.md §3.2` 의 inline 노트가 여전히 유효한지 확인한다. 중복 기술이 유지되는 구조라면 §9.7 끝에 cross-reference 링크를 명시한다. 변경 필요 없으면 INFO 수준이므로 그대로 진행 가능.

- **[INFO]** §9.9 에서 참조하는 이전 consistency-check 세션의 INFO 번호 표기
  - target 위치: 신규 §9.9 본문 마지막 줄 — `review/consistency/2026/05/16/09_03_04/` (INFO 1·2 — cross_spec + rationale_continuity)
  - 충돌 대상: 없음 (참조 오류 가능성)
  - 상세: 해당 세션의 INFO 번호가 각각 cross_spec checker 와 rationale_continuity checker 에서 나왔음을 parenthetical 로 기술하고 있다. 실제 세션 산출물의 번호 체계와 일치하는지 세션 SUMMARY 를 한 번 더 확인하는 것이 안전하다. 잘못된 번호가 Rationale 에 박히면 추후 traceability 를 방해한다.
  - 제안: spec 반영 전 `review/consistency/2026/05/16/09_03_04/SUMMARY.md` 의 INFO 항목 번호와 대조 후 §9.9 본문을 확정한다. 번호가 맞으면 INFO 수준이므로 그대로 진행 가능.

---

### 요약

이번 draft(spec-draft-cafe24-cleanup.md) 는 `spec/4-nodes/4-integration/4-cafe24.md` 단일 파일에만 영향을 미치는 정리성 변경으로, 데이터 모델·API 계약·RBAC·상태 전이·계층 책임 관점에서 다른 spec 영역과의 직접적 모순(CRITICAL)은 발견되지 않았다. 다만 WARNING 2건이 있다. 첫째, §9.9 에서 "다른 통합 노드에 동일 결정 적용"이라는 범위가 과도하게 넓어 `http_request` 의 `KeyValue[]` 직렬화 모델과 오해를 유발할 수 있으며 명시적 범위 한정이 필요하다. 둘째, CHANGELOG 신규 행에 드롭된 변경 3(§5 Case 번호 연속화)이 이력으로 기록될 위험이 있어 해당 문구를 삭제해야 한다. INFO 2건은 cross-reference 이중 기술과 세션 번호 검증에 관한 것으로 blocking 사안은 아니다.

---

### 위험도

LOW
