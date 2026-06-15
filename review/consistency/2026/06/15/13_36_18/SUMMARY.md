# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견이 없으므로 호출자 차단 불필요

## 전체 위험도
**LOW** — 모든 발견사항이 INFO 등급. Critical/Warning 없음. 기존 기술 부채 승계 항목과 plan 추적 업데이트 권장 사항만 존재.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/2-api-convention.md §9` 의 50MB KB 업로드 한도와 Form 노드 `DEFAULT_FILE_MAX_TOTAL_SIZE_MB=50` 는 동일 값이나 완전히 다른 도메인 — 독자 혼동 가능성 | `form-mode.ts` `DEFAULT_FILE_MAX_TOTAL_SIZE_MB` / `spec/4-nodes/6-presentation/4-form.md §1` | `2-api-convention.md §9` 에 "Form 노드 `submit_form` 은 metadata-only 이므로 본 절 적용 범위 밖" 1줄 주석 추가 또는 Form spec §1 에 "api-convention §9 미적용" 부연 (선택 사항) |
| 2 | Cross-Spec | WS ack `details[]` 미포함 정책 — 구현 JSDoc 이 spec 과 정합 | `workflow-errors.ts` JSDoc / `spec/5-system/6-websocket-protocol.md §4.2` | 조치 불필요 |
| 3 | Cross-Spec | `hooks.service.ts` `validateFormSubmission` 잔존 — chat-channel native modal scalar 경로 전용, file 경로 미해당 | `hooks.service.ts` / `spec/conventions/chat-channel-adapter.md §4.1` | `chat-channel-adapter.md §4.1` 에 "file 필드는 native modal 미수용 → publisher chokepoint 전담" 1줄 부연 가능 (선택 사항) |
| 4 | Rationale Continuity | `coerceFormSubmission` 제거 Rationale — spec `4-form.md ## Rationale` 에 충분히 명시됨 | `spec/4-nodes/6-presentation/4-form.md ## Rationale` | 조치 불필요 |
| 5 | Rationale Continuity | frontend 기본값 상수 복제 정책이 구현 코드 주석에만 기록되고 spec Rationale 에 별도 항 없음 | `dynamic-form-ui.tsx` 상단 상수 블록 / `spec/4-nodes/6-presentation/4-form.md ## Rationale` | spec `## Rationale` 에 "frontend 복제 채택 이유 + 런타임 중립 패키지 추출 미채택 이유" 항 추가 권장 (약한 SoT gap) |
| 6 | Rationale Continuity | `validateFormSubmission` 시그니처 유지 — chat-channel-adapter spec `§4.1` 계약 정합, 과거 기각 대안 재도입 없음 | `form-mode.ts` `validateFormSubmission` | 조치 불필요 |
| 7 | Convention Compliance | 백엔드 `validateFileField` 의 4개 에러 메시지를 한국어 리터럴로 직접 박음 — `i18n-userguide.md` Principle 3 위반 패턴이나, 기존 `validateScalarField` 에 동일 패턴이 선재하는 기술 부채 승계 | `form-mode.ts` `validateFileField` 반환 메시지 리터럴 4종 | 향후 scalar 메시지 i18n화 트랙과 함께 `ERROR_KO` 매핑 테이블로 통합 처리 권장 |
| 8 | Convention Compliance | 프론트엔드 i18n 키 처리 (`t()` 호출, ko/en parity) — 규약 완전 준수 | `dynamic-form-ui.tsx` `validateFilesClient` / `dict/ko/editor.ts`, `dict/en/editor.ts` | 조치 불필요 |
| 9 | Convention Compliance | frontend 상수 복제 — 의도적 결정, 주석에 근거 명시, spec conventions 명시 금지 항목 없음 | `dynamic-form-ui.tsx` `DEFAULT_FILE_*` / `form-mode.ts` `DEFAULT_FILE_*` | 향후 추출 시 spec §1 + 공유 패키지를 단일 SoT 로 묶기 권장 |
| 10 | Plan Coherence | `node-output-redesign/form.md` 의 2개 `[ ]` 항목(기본값 적용 시점, 검증 책임 경계)이 이번 구현으로 사실상 해소됐으나 체크박스 미갱신 | `plan/in-progress/node-output-redesign/form.md` | 두 항목 `[x]` 로 체크 + 해소 근거 (form-file-validation PR) 기재. 세 번째 `[ ]` (`rawConfig`↔`config` unit test) 는 본 구현 범위 밖이므로 미체크 유지 |
| 11 | Plan Coherence | `spec-sync-form-gaps.md` 의 실질 미구현 항목 없음에도 `in-progress/` 잔류 | `plan/in-progress/spec-sync-form-gaps.md` | plan-lifecycle 절차에 따라 `plan/complete/` 이동 검토 (PR 커밋 포함 후) |
| 12 | Naming Collision | `MB_IN_BYTES` 상수 backend(export) · frontend(module-scoped) 중복 선언 — 빌드 경계 분리로 충돌 없음, 아키텍처 백로그 B-1 추적 중 | `form-mode.ts:53` / `dynamic-form-ui.tsx:64` | 현 상태 유지. 공유 패키지 추출 시 이름 자명하게 선택 가능 |
| 13 | Naming Collision | `DEFAULT_FILE_*` 4개 상수 backend(export) · frontend(module-scoped) 중복 — 빌드 경계 분리, spec·코드 주석 양쪽 명시 | `form-mode.ts:30,47,49,51` / `dynamic-form-ui.tsx:45,61,62,63` | 조치 불필요 |
| 14 | Naming Collision | `validateScalarField` 신규 + `validateFormSubmission` 공존 — 추상화 레벨 다름, 역할 문서화됨 | `form-mode.ts:234` / `form-mode.ts:324` | 조치 불필요 |
| 15 | Naming Collision | i18n 키 4종 (`formFileMimeRejected` 등) 신규 추가 — 기존 키와 충돌 없음 | `dict/ko/editor.ts:256-259` / `dict/en/editor.ts:260-263` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 인접 spec 영역과 직접 모순 없음. api-convention §9 50MB 와 Form 노드 50MB 는 다른 도메인(이름 공간 혼동 가능성만). |
| Rationale Continuity | LOW | `coerceFormSubmission` 제거 Rationale 충분히 명시됨. frontend 상수 복제 근거가 코드 주석에만 있고 spec Rationale 에 별도 항 없음 — 약한 SoT gap. |
| Convention Compliance | LOW | 프론트엔드 i18n 완전 준수. 백엔드 에러 메시지 한국어 직접 박기는 기존 debt 승계 (신규 위반 패턴 아님). |
| Plan Coherence | LOW | 구현으로 해소된 plan 체크박스 미갱신, `spec-sync-form-gaps.md` `in-progress/` 잔류 — 추적 업데이트 필요. |
| Naming Collision | NONE | 신규 식별자 전체 기존 코드베이스와 충돌 없음. backend/frontend 중복 상수는 빌드 경계 분리로 무해. |

## 권장 조치사항

1. **(BLOCK 해소 사유 없음 — 모두 선택적)** Critical/Warning 이 없어 작업 차단 불필요.
2. **(plan 추적 — 권장)** `plan/in-progress/node-output-redesign/form.md` 의 기본값 적용 시점·검증 책임 경계 두 `[ ]` 항목을 `[x]` 로 갱신하고 form-file-validation PR 을 근거로 기재.
3. **(plan 라이프사이클 — 권장)** PR 커밋 포함 후 `plan/in-progress/spec-sync-form-gaps.md` 를 plan-lifecycle 절차에 따라 `plan/complete/` 로 이동.
4. **(spec Rationale 보강 — 선택)** `spec/4-nodes/6-presentation/4-form.md ## Rationale` 에 "frontend 기본값 상수 복제 채택 이유 + 런타임 중립 패키지 추출 미채택 이유" 항 추가.
5. **(도메인 명확화 — 선택)** `spec/5-system/2-api-convention.md §9` 에 "Form 노드 `submit_form` metadata-only 제출은 본 절 미적용" 1줄 주석 추가.
6. **(기술 부채 등록 — 장기)** 백엔드 한국어 에러 메시지 리터럴(`validateFileField` + `validateScalarField`) 을 향후 i18n화 트랙으로 통합 처리.