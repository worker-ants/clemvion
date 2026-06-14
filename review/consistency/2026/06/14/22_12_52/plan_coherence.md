# Plan 정합성 검토 결과

Target: `plan/in-progress/spec-draft-form-hygiene.md`
검토 시각: 2026-06-14

---

### 발견사항

별도 중요 충돌 없음. 세부 INFO 2건만 확인되었다.

- **[INFO]** D-2 Rationale 내 "전수 수집은 file 검증 cluster 등 후속에서 필요 시 확장" 문구
  - target 위치: `spec-draft-form-hygiene.md` §D-2 Rationale 항목 1 끝
  - 관련 plan: `plan/in-progress/spec-sync-form-gaps.md` — file 검증 cluster 항목은 Planned 미착수 상태. min/max·pattern 은 별도 "A-1" 확장 경로로 적시됨.
  - 상세: Rationale 이 "전수 오류 수집은 file 검증 cluster 에서 필요 시 확장"이라 적는 것은 현재 Planned 추적 중인 `spec-sync-form-gaps.md` 와 방향이 일치한다. 그러나 "전수 수집"이 file cluster 의 요구사항인지는 `spec-sync-form-gaps.md` 어디에도 결정된 바 없다 — file cluster는 MIME/크기/개수 검증에 초점이 있으며 "전수 오류 수집"(배열 반환)으로의 확장이 그 cluster 의 선행 설계 결정은 아니다. Rationale 본문이 미결정 사항을 기정사실처럼 서술할 수 있다.
  - 제안: target(form.md Rationale) 신설 시 "전수 수집은 … 후속에서 필요 시 확장" 대신 "현재 단건 반환 — 복수 오류 수집은 필요 발생 시 별도 논의" 정도로 약화하거나, `spec-sync-form-gaps.md` 에 "전수 수집 여부는 file cluster 설계 시 결정" 메모를 추가하면 충분하다. 비차단.

- **[INFO]** D-2 Rationale 에서 `validateFormSubmission` 의 `form-mode.ts` 출처 인용
  - target 위치: `spec-draft-form-hygiene.md` §D-2 Rationale 항목 1 "사실" 줄 — `form-mode.ts 주석 L134` 참조
  - 관련 plan: `plan/in-progress/spec-sync-form-gaps.md` 및 최근 #608 구현
  - 상세: 구현 PR #608(eia-form-validation)에서 `validateFormSubmission` 위치가 `form-mode.ts` 와 `execution-engine.service.ts` 양쪽에 분산되어 있다고 `spec-sync-form-gaps.md` 는 `workflow-errors.ts FormValidationError · execution-engine.service.ts assertFormSubmissionValid` 라고 적는다. Rationale 의 `form-mode.ts L134` 가 실제 SoT 인지 아니면 `execution-engine.service.ts` 내 래퍼인지 spec 문서 독자 관점에서 혼동을 줄 수 있다.
  - 제안: target(form.md Rationale) 에서 파일 경로 표기를 생략하거나 양쪽을 모두 언급하는 쪽으로 작성하면 된다. 비차단.

---

### 요약

target(`spec-draft-form-hygiene.md`)는 순수 문서 hygiene(WS §4.2 부연 + form.md Rationale 신설) 범위의 plan이다. 검토 대상 in-progress plan 전체를 조회한 결과, D-1(WS ack 에 field-level `details[]` 미포함 명확화)은 `spec-sync-websocket-protocol-gaps.md` 가 추적하는 미구현 항목(in-band refresh, `VALIDATION_ERROR` 에러 코드 등)과 의미적으로 독립적이고, 기존 spec 본문(`§4.2` 의 `VALIDATION_ERROR` 행)에 부연을 추가하는 것일 뿐 미결정 사항을 우회하지 않는다. D-2 Rationale 신설 역시 `spec-sync-form-gaps.md` 의 Planned 항목을 변경하거나 우회하지 않으며, 이미 구현된 사실(chokepoint 위치, FIRST 오류 정책)과 defer 근거를 문서화하는 것이다. 선행 plan 미해소 사항이나 후속 항목 무효화는 확인되지 않았다. INFO 2건은 Rationale 본문 표현의 정밀도 권장 수준이며 plan 정합성 차단 요인이 아니다.

### 위험도

NONE
