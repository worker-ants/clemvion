# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)  
대상 스코프: `spec/4-nodes/6-presentation/4-form.md` + 구현 변경 diff  
관련 plan: `plan/in-progress/impl-form-file-validation.md`, `plan/in-progress/spec-sync-form-gaps.md`

---

## 발견사항

### 발견사항 없음

미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 — 세 관점 모두에서 충돌·문제가 발견되지 않았다.

**점검 근거:**

**1. 미해결 결정과의 충돌 — 없음**

`spec-sync-form-gaps.md` 에서 file 검증 관련 미결 항목 3개(`§6.2 서버측 file 검증`, `§1.5 클라이언트 검증`, `§1 file 기본값`)는 모두 "파일검증 cluster" 로 명시적으로 묶여 별도 PR 권장 대상이었다. 본 구현은 정확히 이 cluster 를 구현하였으며, `impl-form-file-validation.md` 가 그 설계 결정(검증 위치·기본값·Slack divergence 처리 등)을 모두 사전에 문서화하고 impl-prep consistency-check(11_33_17, BLOCK NO)를 통과한 상태에서 착수됐다.

`ValidationPreset(phone)` 은 `spec-sync-form-gaps.md` 와 spec `4-form.md §1` 양쪽 모두 "Planned / 보류" 로 명기되어 있으며, 본 구현은 이에 접촉하지 않는다.

**2. 선행 plan 미해소 — 없음**

본 구현이 전제하는 선행 조건:
- `validateFormSubmission` 의 scalar core 가 이미 존재함 → min/max·pattern PR(#610)에서 완성, main 에 머지됨
- `FormValidationError` / `assertFormSubmissionValid` publisher chokepoint 가 이미 존재함 → eia-form-validation PR(#608)에서 완성, main 에 머지됨
- `extractFormFields` 가 이미 존재함 → 선행 PR들에서 확립됨

모두 `spec-sync-form-gaps.md` 의 `[x]` 체크된 선행 구현이며 `origin/main` 에 반영되어 있다. `impl-form-file-validation.md §작업 체크리스트` 가 이를 정확히 기록한다.

**3. 후속 항목 누락 — 없음**

`spec-sync-form-gaps.md INFO 후속` 의 두 번째 항목("execution-engine.service.spec 에 min/max·pattern 위반 시 FormValidationError throw 통합 케이스")이 본 구현의 diff(`execution-engine.service.spec.ts` §6.2 number min/max 위반 / pattern(정규식) 위반 테스트 2건)에서 함께 처리됐다. 이 INFO 후속을 체크(`[x]`)하는 plan 갱신이 단계 10에서 수행될 예정이며(`spec-sync-form-gaps.md 잔여(ValidationPreset 보류만) 확인 후 본 plan 처리`), 아직 체크리스트가 미완이나 이는 review 단계(9) 완료 전 의도된 상태다.

`node-output-redesign/form.md` 의 잔여 개선 제안들(`allowedMimeTypes` 기본 목록 적용 시점 명시, file size/mime/count 검증 책임 경계 명시 등)은 본 구현에서 실제로 해소됐다 — spec §1 `allowedMimeTypes` 기본값 주석, §6.2 검증 지점 주석, Rationale 이 모두 갱신됐다. 해당 plan 파일의 `[ ]` 체크박스 갱신이 누락돼 있으나, `node-output-redesign/form.md` 는 2026-05-16 분석 산출물로 actionable 체크박스(`[ ]`)가 "spec 보완 권장" 수준이고 pending_plans 로 등록된 추적 계획이 아니기 때문에 차단 사안이 아니다.

---

## 요약

`spec/4-nodes/6-presentation/4-form.md` 와 구현 변경 diff 는 `plan/in-progress/impl-form-file-validation.md` 및 `plan/in-progress/spec-sync-form-gaps.md` 의 계획과 완전히 정합한다. 미해결 결정(ValidationPreset)은 건드리지 않았고, 선행 plan(A-1 PR들)은 모두 main 에 머지된 상태였으며, 후속 항목 누락도 없다. INFO 후속 테스트 케이스가 구현 diff 에 포함되어 있고 plan 10단계에서 체크박스 갱신이 예정되어 있다.

---

## 위험도

NONE
