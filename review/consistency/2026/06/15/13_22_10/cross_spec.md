# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target: `spec/4-nodes/6-presentation/4-form.md`
Diff base: `origin/main`

---

## 발견사항

- **[INFO]** 테스트 주석 내 MIME 타입 수 오기재 ("13종" vs 실제 14종)
  - target 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:296` (추가된 줄)
  - 충돌 대상: `spec/4-nodes/6-presentation/4-form.md §1` — `allowedMimeTypes` 기본값 "14종 MIME" 명기; `spec/4-nodes/6-presentation/4-form.md §1.5` — "기본 14종"; `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `DEFAULT_FILE_ALLOWED_MIME_TYPES` 실제 14종 상수
  - 상세: 신규 테스트의 인라인 주석 `// allowedMimeTypes 미설정 → 클라이언트가 §1 기본 13종 적용.` 이 "13종"으로 기재돼 있으나, spec §1 / §1.5 는 "14종"으로 명기하고 frontend 상수도 실제로 14개다(`image/jpeg`·`image/png`·`image/gif`·`image/webp`·`image/svg+xml`·`application/pdf`·`application/msword`·`.docx`·`application/vnd.ms-excel`·`.xlsx`·`application/vnd.ms-powerpoint`·`.pptx`·`text/plain`·`text/csv`). 런타임 동작 자체는 올바르며 오류는 주석 텍스트에만 존재한다.
  - 제안: 테스트 파일 해당 주석을 "14종"으로 수정.

- **[INFO]** spec §1.5 내부 함수 이름 참조 stale — `renderField` vs `renderFileField`
  - target 위치: `spec/4-nodes/6-presentation/4-form.md §1.5` 줄 101
  - 충돌 대상: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — diff 에서 file case 를 `renderField` switch 에서 `renderFileField` 독립 함수로 분리 (W6 리팩터)
  - 상세: spec §1.5 의 헤더 서술 `**UI 렌더 (`DynamicFormUI.renderField` 의 file case)**:` 가 구현과 어긋난다. 코드에서 file 필드는 이제 `renderField` 의 switch-case 가 아니라 `renderFileField` 로 위임된다. 동작 계약(입력 element 속성·onChange 처리·metadata-only 직렬화)은 동일하므로 런타임 영향 없음; 함수 이름만 오래된 상태.
  - 제안: spec §1.5 헤더를 `**UI 렌더 (`DynamicFormUI` — `renderFileField` / `validateFilesClient`)**:` 수준으로 갱신. 계약(accept 속성·multiple 조건·onChange 동작)은 변경 없으므로 본문 나머지는 유지.

- **[INFO]** `form-mode.ts` JSDoc SoT 주석이 구식 함수 이름(`validateFormSubmission`) 을 내부 참조로 언급
  - target 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFormSubmission` 함수 JSDoc 내 "scalar 전용 경로" 설명 블록
  - 충돌 대상: `spec/4-nodes/6-presentation/4-form.md §Rationale "file 검증은 cluster 로 분리 구현"` — `validateFormSubmission`(scalar batch)과 `validateAllFields`(단일 패스) 의 관계를 설명
  - 상세: JSDoc 이 `validateFormSubmission` 의 scalar 전용 역할을 올바르게 기술하나, diff 에서 함수 본체가 내부적으로 `validateScalarField` 위임으로 변경됐고, 그 구조 변경을 설명하는 SoT 주석이 spec §Rationale 만 가리켜 JSDoc 자체 설명과 일치한다. 실제 문제는 없으나, 호출 체인(`validateFormSubmission` → `validateScalarField` 위임)을 명시적으로 JSDoc 에 기록하면 향후 혼동을 줄일 수 있다.
  - 제안: 현 상태로 허용 가능(INFO). 향후 함수 정리 시 JSDoc 에 "내부적으로 `validateScalarField` 위임" 한 줄 추가 권장.

---

## 요약

Cross-Spec 일관성 관점에서 이번 구현 변경(form file 검증 cluster: `validateFileField`·`validateAllFields`·frontend `validateFilesClient`·i18n·기본값 상수)은 `spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/6-presentation/0-common.md` 와 직접 모순되는 항목이 없다. MIME 기본값 14종, 숫자 제약(10MB/50MB/5), 검증 순서(MIME → per-file size → total size → count), chokepoint 단일 패스, chat-channel 어댑터 file bypass 정책 모두 spec 과 일치한다. 발견된 3건은 모두 INFO 등급 — 테스트 주석의 "13종" 오기재(실제는 14종), spec §1.5 내부 함수명 stale(`renderField` → `renderFileField` 리팩터 미반영), JSDoc SoT 연결 명시 권장이며, 어느 것도 두 영역이 동시에 작동 불가하거나 계약 충돌을 일으키지 않는다.

---

## 위험도

LOW

---

STATUS: OK
