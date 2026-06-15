# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/6-presentation/4-form.md` (구현 완료 후 검토, diff-base=origin/main)
검토 대상 변경: form-file-validation 구현 — `validateFileField`, `validateScalarField`, `DEFAULT_FILE_*` 상수, `coerceFormSubmission` 제거, frontend `validateFilesClient` 신설

---

## 발견사항

### INFO: `coerceFormSubmission` 제거는 Rationale 에 명시적으로 설명되어 있음

- target 위치: `form-mode.ts` diff — `coerceFormSubmission` 헬퍼 삭제 + `assertFormSubmissionValid` 단일 패스 전환
- 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §Rationale` "file 검증은 cluster 로 분리 구현" 마지막 단락
- 상세: spec §Rationale 이 "scalar/file 단일 패스 도입으로 EIA/WS 의 typed 값을 string 으로 정규화하던 `coerceFormSubmission` 헬퍼는 제거되고 per-field `coerceFormValue`(scalar 전용) 로 대체됐다" 고 직접 설명한다. 구현이 이 설명과 완전히 일치한다.
- 제안: 없음 — 정합.

### INFO: `validateFormSubmission` (scalar batch) 은 hooks.service 에서 계속 사용 — Rationale 과 정합

- target 위치: `hooks.service.ts` diff — `validateFormSubmission` 유지, 신규 NOTE 주석 추가
- 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §Rationale` "검증 지점 = publisher 측 `continueExecution` chokepoint (3 경로 공통)" + "file 검증은 cluster 로 분리 구현"
- 상세: spec §Rationale 이 "file 필드는 native modal 미수용(`isFieldModalCompatible` 배제)이라 modal(`hooks.service` validateFormSubmission)에 도달하지 않기 때문이다" 고 명시한다. 구현 역시 hooks.service 에서 파일 검증을 추가하지 않고 NOTE 주석으로 그 이유를 기록했다. Rationale 과 정합.
- 제안: 없음 — 정합.

### INFO: frontend 상수 복제(미러) — Rationale 기록과 정합

- target 위치: `dynamic-form-ui.tsx` — `DEFAULT_FILE_*` 상수 로컬 복제
- 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §1` (파일 옵션 기본값 주석, "backend `form-mode.ts` `DEFAULT_FILE_*` (frontend `dynamic-form-ui.tsx` 가 동일 값 미러)")
- 상세: frontend 소스 내 주석에 "SoT 는 spec §1 … frontend(CSR Next.js)는 backend NestJS 모듈을 직접 import 할 수 없어(빌드/번들 분리) 값을 복제한다. 변경 시 spec §1 + 양쪽 미러를 함께 갱신한다. (런타임 중립 공유 패키지로의 추출은 아키텍처 백로그 B-1 추적 — 검증 로직 전체 승격과 함께.)" 라고 명시하여 복제의 이유와 향후 경로를 기록했다. spec §1 이 이를 SoT 로 인정한다.
- 제안: 없음 — 정합.

### INFO: FIRST 오류 순서 원칙 — 구현이 Rationale 정의와 일치

- target 위치: `validateFileField` 구현 (MIME → per-file size → total size → count 순서), 테스트 "FIRST 오류 순서 — MIME 가 size 보다 먼저 표면"
- 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md §Rationale` "field 검증은 FIRST 오류만 반환 (전수 수집 아님)" — "file 은 required → MIME → 단일 크기 → 합계 크기 → 개수" 순서 명시
- 상세: 구현 순서(MIME → per-file size → total size → count)가 spec Rationale 이 정의한 순서와 일치한다. 구현 정합.
- 제안: 없음 — 정합.

### INFO: 확장자 없는 파일(`File.type === ""`) MIME 체크 skip — 기각된 대안 미해당, 신규 결정

- target 위치: `dynamic-form-ui.tsx` `validateFilesClient` 의 `if (f.type && !allowedMime.includes(f.type))` 분기, spec §1.5 "확장자 없는 파일(`File.type === ""`)은 MIME 체크를 skip 한다" 명시
- 과거 결정 출처: 과거 Rationale 에 이 결정에 대한 기각된 대안 기록 없음
- 상세: spec §1.5 가 이 동작("브라우저가 타입을 못 매기는 경우 거부하지 않음 — 서버 검증이 최종 게이트")을 명시적으로 결정하고, 구현이 그것을 따른다. 서버측 `validateFileField` 도 `typeof m.type === 'string'` 가드로 동일하게 처리한다. 과거 Rationale 에서 이 방향을 기각한 기록이 없으므로 새 결정의 도입에 해당하며 spec §1.5 에 이미 근거가 기록됐다.
- 제안: 없음 — 정합.

---

## 요약

검토 대상 구현(form file 검증 cluster — `validateFileField`, `validateScalarField`, `DEFAULT_FILE_*`, frontend `validateFilesClient`, `coerceFormSubmission` 제거)은 `spec/4-nodes/6-presentation/4-form.md §Rationale` 의 모든 합의된 원칙과 정합한다. 특히 (1) FIRST 오류 순서(required → MIME → per-file size → total size → count), (2) publisher chokepoint 단일 검증 원칙, (3) file 은 native modal 미수용이므로 hooks.service 경로에서 file 검증을 하지 않는 결정, (4) `coerceFormSubmission` 제거 근거, (5) frontend 상수 복제 + B-1 백로그 기록 — 모두 spec §Rationale 에 이미 명문화된 방향과 일치한다. 기각된 대안의 재도입, 합의된 invariant 위반, 근거 없는 결정 번복은 발견되지 않았다.

---

## 위험도

NONE
