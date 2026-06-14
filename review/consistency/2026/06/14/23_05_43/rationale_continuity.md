### 발견사항

- **[INFO]** 과거 defer Rationale 을 구현 완료에 맞춰 갱신 — 정합
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §Rationale "file 검증(MIME/크기/개수)·`validation.min`/`max`·`pattern` 분리 defer" (삭제) → "validation.min/max·pattern 은 공유 validator 확장으로, file 검증은 cluster 로 분리" (신규)
  - 과거 결정 출처: 동일 문서(main 브랜치) §Rationale "file 검증·`validation.min`/`max`·`pattern` 분리 defer" — `validation.min`/`max`·`pattern` 을 공유 validator 확장으로 file cluster 와 독립 진행한다고 명시했고, file cluster 는 Planned 로 분리
  - 상세: 과거 결정은 `validation.min`/`max`·`pattern` 이 "공유 validator 확장만으로 3 경로 공통 적용되므로 file cluster 와 독립적으로 진행한다" 는 경로를 이미 예고했다. 이번 target 은 그 경로대로 구현 완료 후 Rationale 을 신규 헤딩("공유 validator 확장으로 먼저 구현됐다")으로 재작성했다. 기각된 대안 채택이 아니라 예고된 분리 경로의 실행이다. 새 Rationale 은 `file` cluster 를 여전히 Planned 로 유지하며 양립 논리를 명확히 서술한다.
  - 제안: 현재 상태로 충분하다. 다만 §6.2 표에서 이전에 한 행으로 묶여 있던 "`validation.min`/`max`(숫자 범위)·`pattern`(정규식) 위반 — Planned`" 행이 두 줄로 분리·승격되었으므로, 기존 외부 cross-ref(`plan/in-progress/spec-sync-form-gaps.md`) 의 Planned 항목 목록도 함께 갱신되었는지 확인 권장.

### 요약

target 문서(`spec/4-nodes/6-presentation/4-form.md`)가 `validation.min`/`max`·`pattern` 검증을 Planned 에서 구현 완료로 승격시킨 것은, 기존 Rationale 이 이미 "공유 validator 확장으로 file cluster 와 독립 진행" 를 명시한 예고 경로의 실행이다. 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다. 새 Rationale 헤딩은 과거 Rationale 의 논리(file 은 cluster, min/max·pattern 은 단순 확장)를 그대로 승계하면서 완료 사실을 명문화하였다. file cluster 가 여전히 Planned 로 유지됨으로써 두 결정 사이의 경계도 유지된다. Rationale 연속성 관점에서 번복이나 충돌은 없다.

### 위험도

NONE
