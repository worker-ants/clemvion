### 발견사항

- **[INFO]** `spec-sync-form-gaps.md` 의 INFO 후속 항목(통합 테스트 케이스 추가) 이 이번 diff 로 충족됨 — plan 체크박스 미갱신
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `§6.2 number min/max 위반 → FormValidationError throw` · `§6.2 pattern(정규식) 위반 → FormValidationError throw` 케이스 신규 추가 (diff 라인 730~770)
  - 관련 plan: `plan/in-progress/spec-sync-form-gaps.md` §INFO 후속 두 번째 항목 — `[ ] execution-engine.service.spec 에 min/max·pattern 위반 시 FormValidationError throw 통합 케이스 1건씩 추가`
  - 상세: 해당 통합 테스트 2건이 이번 PR diff 에 포함되어 있으나 plan 체크박스는 아직 미체크 상태.
  - 제안: plan/in-progress/spec-sync-form-gaps.md §INFO 후속 두 번째 항목을 `[x]` 로 갱신.

- **[INFO]** `node-output-redesign/form.md` 개선안 열린 항목(file 검증 책임 경계 명시) 이 이번 구현으로 사실상 해소됨 — plan 갱신 없음
  - target 위치: `execution-engine.service.ts` — `assertFormSubmissionValid` 주석이 `validateAllFields` 위임 경로(scalar=`validateScalarField`, file=`validateFileField`)를 명시; `workflow-errors.ts` `FormValidationError` JSDoc 에 `file MIME·크기·개수` 추가.
  - 관련 plan: `plan/in-progress/node-output-redesign/form.md` §종합 개선안 세 번째 항목 — `[ ] (impl) file 타입 필드의 size/mime/count 검증 시점 (engine vs handler) 의 책임 경계 명시 + cross-track 테스트`
  - 상세: 이번 구현이 engine `assertFormSubmissionValid` chokepoint 를 SoT 로 확정하고 주석·에러 클래스 JSDoc 에 책임 경계를 명문화했다. 별도 cross-track 테스트도 `execution-engine.service.spec.ts` 에 추가됐다. plan 은 해소 표기 없이 열린 상태.
  - 제안: `node-output-redesign/form.md` 세 번째 항목을 완료로 표기하거나(이미 세 번 모두 [x] 처리 시 plan 을 `plan/complete/` 로 이동하는 라이프사이클 검토).

- **[INFO]** `spec-sync-slack-gaps.md` 의 미해소 항목("잔여(slack 외 종속): form file 필드 MIME 검증 — fieldsCatalog v1 한계(PR-E)에 블록됨")과 이번 구현의 관계 추적 필요
  - target 위치: `form-mode.ts` `validateFileField` — Slack `{fileId, mimeType, ...}` shape 는 `size`/`type` 부재로 MIME·크기 체크가 자연 bypass(방어적 skip)됨을 명시적으로 설계에 반영 (diff 라인 564~566).
  - 관련 plan: `plan/in-progress/spec-sync-slack-gaps.md` 미체크 항목 — `file_shared → files.info 보강 → submit_form` 잔여(MIME 검증 PR-E 의존).
  - 상세: 이번 구현이 Slack file shape 의 MIME 검증을 의도적으로 bypass 하도록 설계된 것은 spec §1.5 divergence 로 코드 주석에 명시되어 있다. 그러나 `spec-sync-slack-gaps.md` 의 미체크 항목은 여전히 `fieldsCatalog v1 한계(PR-E)` 를 이유로 열려 있어, 이번 구현이 그 블로커를 해소했는지(다른 경로로 MIME 검증이 이뤄지게 됐는지) 혹은 bypass 설계가 해소 불필요를 의미하는지 plan 에서 명시하지 않았다.
  - 제안: `spec-sync-slack-gaps.md` 의 미체크 항목에, 이번 PR 이후에도 Slack file shape 는 size/type 미보유라 MIME/크기 서버 검증이 자연 bypass 됨(의도된 동작, §1.5 divergence 주석) 을 명기하고, 이 항목이 PR-E(fieldsCatalog) 해소와 별개로 남아 있는지를 판정하는 노트 추가 권장.

### 요약

이번 구현 diff 는 `plan/in-progress/spec-sync-form-gaps.md` 가 추적하는 모든 file 검증 cluster 항목(§6.2 서버측 file 검증 A-2, §1.5 클라이언트 검증 A-3, §1 기본값 주입)을 완결하고 있으며, 미해결 결정을 우회하거나 선행 plan 미해소 전제를 깨는 CRITICAL·WARNING 수준 충돌은 발견되지 않았다. 다만 세 가지 INFO 추적 항목이 있다: spec-sync-form-gaps 의 INFO 후속 통합 테스트 항목이 diff 에 포함됐으나 체크박스가 갱신되지 않았고, node-output-redesign/form 의 file 검증 책임 경계 명시 항목이 이번 구현으로 사실상 해소됐으나 plan 에 미반영됐으며, spec-sync-slack-gaps 의 Slack file MIME 검증 미해소 항목이 이번 bypass 설계와의 관계 설명 없이 열린 채 남아 있다.

### 위험도
NONE
