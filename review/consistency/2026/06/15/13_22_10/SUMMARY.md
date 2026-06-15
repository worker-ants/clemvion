# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 모든 발견사항이 INFO 또는 WARNING 등급이며, 동작·계약 충돌은 없음. 테스트 주석 오기(13종→14종) 1건이 cross-spec/rationale 양쪽에서 중복 지적됨(통합 후 단일 항목으로 처리).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | spec §1 FormField 표 `allowedMimeTypes` 항목 서술 확인 — 검토 결과 14종으로 일치 확인돼 실질 불일치 없음 (관찰 등급 WARNING) | `spec/4-nodes/6-presentation/4-form.md` §1 FormField 표 line 46, §1 본문 line 51 | `form-mode.ts` `DEFAULT_FILE_ALLOWED_MIME_TYPES` (14종) | 조치 불필요. 이미 일치 확인됨. |
| 2 | Convention Compliance | `validateFormSubmission` 공개 API 유지 + `validateScalarField`/`validateFileField`/`validateAllFields` 신규 export — API 표면 증가 관찰 | `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` export 목록 | `spec/4-nodes/6-presentation/4-form.md` §Rationale "file 검증은 cluster 로 분리 구현" | 조치 불필요. `validateFormSubmission` 은 hooks.service scalar-only 경로에서 정당하게 유지. JSDoc 에 역할 명시됨. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec + Rationale Continuity (중복 통합) | 테스트 주석 MIME 종수 오기 — "13종" → 실제 14종 | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:296` | 주석을 "기본 14종"으로 수정 (동작 영향 없음) |
| 2 | Cross-Spec | spec §1.5 내부 함수명 stale — `renderField file case` vs `renderFileField` (W6 리팩터 미반영) | `spec/4-nodes/6-presentation/4-form.md §1.5` line 101 | §1.5 헤더를 `DynamicFormUI — renderFileField / validateFilesClient` 로 갱신 |
| 3 | Cross-Spec | `form-mode.ts` JSDoc 호출 체인 명시 권장 — `validateFormSubmission` → `validateScalarField` 위임 | `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` JSDoc | 향후 함수 정리 시 "내부적으로 `validateScalarField` 위임" 한 줄 추가 권장 |
| 4 | Convention Compliance | spec 내 구현 파일 라인 번호 하드코딩 패턴(`form.schema.ts:71-74`) — 이번 diff 신규 도입 아님, 기존 패턴 | `spec/4-nodes/6-presentation/4-form.md §1` line 51 | 향후 spec 수정 시 라인 번호 대신 함수명/export 명 참조로 전환 권장 |
| 5 | Plan Coherence | `spec-sync-form-gaps.md` §INFO 후속 통합 테스트 2건(min/max·pattern)이 diff 에 포함됐으나 체크박스 미갱신 | `plan/in-progress/spec-sync-form-gaps.md` §INFO 후속 두 번째 항목 | 해당 체크박스를 `[x]` 로 갱신 |
| 6 | Plan Coherence | `node-output-redesign/form.md` file 검증 책임 경계 명시 항목이 이번 구현으로 사실상 해소됐으나 plan 미반영 | `plan/in-progress/node-output-redesign/form.md` §종합 개선안 세 번째 항목 | 완료 표기 후 전 항목 [x] 시 `plan/complete/` 로 이동 라이프사이클 검토 |
| 7 | Plan Coherence | `spec-sync-slack-gaps.md` Slack file MIME bypass 설계와 미체크 항목의 관계 미명시 | `plan/in-progress/spec-sync-slack-gaps.md` Slack file 잔여 항목 | 이번 PR 이후에도 Slack file shape 는 size/type 미보유라 MIME/크기 서버 검증이 자연 bypass 됨(의도된 동작, §1.5 divergence)임을 노트 추가 |
| 8 | Naming Collision | `MB_IN_BYTES` 및 `DEFAULT_FILE_*` 상수 4종이 backend export + frontend local 로 이중 정의 | `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:53`, `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:64` 및 각 상수 | 현 상태 허용 가능. 빌드 분리 제약상 복제 불가피. B-1 백로그 추적 중. |
| 9 | Naming Collision | `validateFilesClient`(frontend) vs `validateFileField`(backend) — 역할 유사, 이름 상이 | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`, `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` | 현 이름이 역할 경계를 잘 드러냄. 변경 불필요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | INFO 3건: 테스트 주석 오기(13→14종), spec §1.5 함수명 stale, JSDoc 호출 체인 명시 권장 |
| Rationale Continuity | LOW | INFO 1건: 테스트 주석 오기(13→14종). 7개 Rationale 결정(FIRST 오류 반환·chokepoint·chat-channel 제외·coerceFormSubmission 제거·metadata-only·Principle 1.1·frontend 미러) 모두 충실히 구현됨. |
| Convention Compliance | NONE | WARNING 2건(실질 조치 불필요한 관찰). i18n·에러코드·node-output·Swagger 규약 전부 준수. |
| Plan Coherence | NONE | INFO 3건: plan 체크박스 미갱신, node-output-redesign 완료 미반영, slack-gaps 관계 미명시. |
| Naming Collision | NONE | INFO 2건: 이중 상수 정의(빌드 분리 불가피), 대칭 함수명(역할 명확). |

## 권장 조치사항

1. **(권장, 저비용)** `dynamic-form-ui.test.tsx:296` 주석 "13종" → "14종" 수정 — 동작 영향 없으나 spec 과의 텍스트 일관성 향상.
2. **(권장)** `spec/4-nodes/6-presentation/4-form.md §1.5` 헤더에서 `renderField file case` → `renderFileField / validateFilesClient` 로 갱신 — W6 리팩터 반영.
3. **(권장)** `plan/in-progress/spec-sync-form-gaps.md` §INFO 후속 두 번째 체크박스 `[x]` 갱신 — 이미 구현 완료된 min/max·pattern 통합 테스트 반영.
4. **(선택)** `plan/in-progress/node-output-redesign/form.md` file 검증 책임 경계 항목 완료 표기 후 plan 라이프사이클(전 항목 [x] 시 complete/ 이동) 검토.
5. **(선택)** `plan/in-progress/spec-sync-slack-gaps.md` 미체크 항목에 Slack file bypass 설계가 §1.5 divergence 의도임을 노트 추가 — PR-E 해소와 별개 여부 명확화.