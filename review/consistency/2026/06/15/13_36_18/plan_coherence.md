# Plan 정합성 검토 결과

검토 대상: `spec/4-nodes/6-presentation/4-form.md` (구현 diff, --impl-done)
검토 시점: 2026-06-15

---

## 발견사항

- **[INFO]** `node-output-redesign/form.md` 미결 항목 — 구현으로 해소됨, plan 갱신 필요
  - target 위치: diff 전체 (`form-mode.ts` extractFormFields + validateFileField, execution-engine assertFormSubmissionValid)
  - 관련 plan: `plan/in-progress/node-output-redesign/form.md` §종합 개선안 (하단 3개 `[ ]` 항목)
    - `[ ]` (spec) §1 `allowedMimeTypes` 기본 목록의 적용 시점 명시 — "form.schema.ts 에 default 부재"
    - `[ ]` (impl) file 타입 필드 size/mime/count 검증 시점 (engine vs handler) 의 책임 경계 명시 + cross-track 테스트
  - 상세: 이번 구현이 `extractFormFields`(형-mode.ts)에서 file 필드 한정 `DEFAULT_FILE_*` 기본값을 주입하고, `validateFileField`/`validateAllFields` 로 MIME/크기/개수 검증을 execution-engine `assertFormSubmissionValid` 에서 수행하도록 확정했다. "적용 시점 모호" / "책임 경계 미명시" 두 미결 항목이 사실상 해소됐으나 plan 체크박스가 그대로 미체크다.
  - 제안: `plan/in-progress/node-output-redesign/form.md` 의 두 `[ ]` 항목을 `[x]` 로 체크하고 해소 근거(form-file-validation PR)를 기재한다. 세 번째 `[ ]` (`rawConfig` ↔ `config` 분리 검증 unit 테스트)는 본 구현 범위 밖이므로 미체크 유지.

- **[INFO]** `spec-sync-form-gaps.md` — 모든 미결 항목이 구현 완료로 체크됐으나 plan 이 업무 종료 후에도 `in-progress/` 에 잔류
  - target 위치: diff 전체 (A-2 file 서버측 검증, A-3 클라이언트 검증, §1 기본값)
  - 관련 plan: `plan/in-progress/spec-sync-form-gaps.md`
  - 상세: 현재 plan 의 미구현 항목 체크리스트를 보면 `§1 ValidationPreset(phone)` 만 `[ ]` 로 남아 있고 나머지는 전부 `[x]` 다. ValidationPreset 은 spec 자체에 "Planned" 마킹된 항목이라 구현 대상이 아니라고 plan 이 명시했다. 즉 실질 미구현 항목이 없다. 그러나 해당 spec 파일이 여전히 `partial` status 라면 이 plan 의 완료 이동을 막고 있을 가능성이 있다. 구현을 마친 현 시점에서 plan-lifecycle 절차에 따라 `plan/complete/` 이동 여부를 검토해야 한다.
  - 제안: `spec-sync-form-gaps.md` 를 `plan/complete/` 로 이동하는 시점을 기록 또는 별도 작업으로 예약한다. (구현 PR 커밋 포함 후 plan-lifecycle §완료 절차 진행.)

---

## 요약

`plan/in-progress/spec-sync-form-gaps.md` 에서 추적 중이던 file 검증 cluster 항목(§6.2 서버측 file 검증, §1.5 클라이언트 검증, §1 기본값 주입)이 이번 구현 diff 에서 정확히 해소됐다. 미결 결정을 일방적으로 우회한 항목은 없고, 전제 조건(min/max·pattern 서버측 검증 — A-1 완료)도 이미 해소된 상태다. 유일하게 남은 정합 갭은 `node-output-redesign/form.md` 의 두 미결 항목이 구현 완료로 해소됐음에도 plan 체크박스가 갱신되지 않은 것으로, 차단 사안이 아닌 추적 업데이트 권장 수준이다.

---

## 위험도

LOW
