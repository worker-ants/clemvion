# Code Review 통합 보고서

**리뷰 대상**: form file validation cluster (A-2) — type:'file' 서버측 + 클라이언트 검증 + 공유 기본값  
**리뷰 일시**: 2026-06-15  
**세션**: review/code/2026/06/15/12_29_50

---

## 전체 위험도

**MEDIUM** — 서버-클라이언트 MIME 검증 불일치(`type:''` 빈 MIME 처리)가 실사용 시 재현 가능한 기능 결함이며, 상수 중복 DRY 위반 및 검증 경로 이원화가 장기 유지보수 위험으로 존재한다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 기능 결함 | **서버-클라이언트 MIME 검증 불일치 — `type:''`(빈 MIME) 서버가 거부** spec §1.5 는 "브라우저가 타입 미판별 파일을 거부하지 않음"으로 명시. 프론트엔드 `validateFilesClient`는 `if (f.type && ...)` 로 빈 문자열 skip. 서버 `validateFileField`는 `typeof m.type === 'string' && !allowed.includes(m.type)` 로 `''`를 "미허용 MIME"으로 판정해 `FormValidationError` throw. 클라이언트에서 허용→서버에서 거부하는 불일치가 실사용 재현 가능 | `form-mode.ts` `validateFileField` L371 / `dynamic-form-ui.tsx` `validateFilesClient` L95 | 서버 조건을 `typeof m.type === 'string' && m.type !== '' && !allowed.includes(m.type)` 로 수정. `form-mode.spec.ts`에 `type:''` 파일 통과 단위 테스트 추가 |
| W2 | 아키텍처/유지보수 | **DEFAULT_FILE_* 상수 백엔드/프론트엔드 이중 정의 (DRY 위반)** `DEFAULT_FILE_ALLOWED_MIME_TYPES`(14종), `DEFAULT_FILE_MAX_FILE_SIZE_MB`, `DEFAULT_FILE_MAX_TOTAL_SIZE_MB`, `DEFAULT_FILE_MAX_FILES`, `MB_IN_BYTES` 5개 상수가 두 파일에 리터럴 복사 선언. 타입 시스템·빌드 파이프라인이 동기화를 강제하지 않음. MIME 한 항목 추가 시 조용히 검증 불일치 발생 가능 | `form-mode.ts` L30–53 / `dynamic-form-ui.tsx` L42–61 | 단기: 두 상수 집합 값 동치를 자동 검증하는 통합 테스트 추가. 중기: `packages/` 공유 모듈 추출(아키텍처 백로그 B-1) |
| W3 | 아키텍처 | **검증 경로 이원화 — `validateFormSubmission` vs `assertFormSubmissionValid` 루프 공존** chat-channel modal 경로와 EIA/WS 경로가 각각 별도 루프를 구성. 새 필드 검증 규칙 추가 시 두 경로 동시 수정 필요성이 구조상 불명확 | `form-mode.ts` `validateFormSubmission` L321–332 / `execution-engine.service.ts` `assertFormSubmissionValid` L4347–4358 | `assertFormSubmissionValid` 루프를 독립 순수 함수 `validateAllFields(rawData, fields)` 로 추출해 두 경로의 모듈 경계 명확화 |
| W4 | 문서/일관성 | **"13종 MIME" 표기 오류 — 코드 주석 및 spec 다중 위치** 실제 배열은 14종이나 `types.ts` JSDoc, `dynamic-form-ui.tsx` JSDoc, `spec/4-nodes/6-presentation/4-form.md` 4개 위치 모두 "13종" 표기. 향후 MIME 변경 시 혼동 야기 | `types.ts` L255 / `dynamic-form-ui.tsx` L35 / `spec/4-nodes/6-presentation/4-form.md` L44, L49, L105, L363 | 코드 JSDoc 2곳 "14종"으로 수정. spec 4개 위치는 project-planner 위임 |
| W5 | 테스트 | **프론트엔드 `useT` i18n mock 미명시 — 전역 store 기본값 암묵 의존** 테스트가 한국어 문자열로 단언하나 `vi.mock('@/lib/i18n', ...)` 선언 없음. `DEFAULT_LOCALE='ko'` 암묵 의존으로, locale 변경 또는 테스트 간 state 잔류 시 조용히 실패 | `dynamic-form-ui.test.tsx` | `vi.mock('@/lib/i18n', () => ({ useT: () => translateKo }))` 명시 추가 또는 setup.ts에 `beforeEach(() => useLocaleStore.setState({ locale: 'ko' }))` 추가 |
| W6 | 유지보수 | **`renderField` 파라미터 6개 — file 전용 관심사 누수** `onError`, `t(TFunction)` 는 `case "file"` 분기에서만 사용. 나머지 8개 case는 무시. 새 필드 타입 추가 시 파라미터 목록 더 누증 우려 | `dynamic-form-ui.tsx` `renderField` L133–140 | `renderFileField(field, idx, value, onChange, onError, t)` 별도 함수 분리 (첫 신규 타입 추가 시 권장) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | **[SPEC-DRIFT] spec 본문 "13종 MIME" — 실제 목록은 14종** 코드가 옳고 spec prose만 오기 | `spec/4-nodes/6-presentation/4-form.md` L44, L49, L105, L363 | spec "13종" → "14종" 4곳 정정 (project-planner) |
| I2 | SPEC-DRIFT | **[SPEC-DRIFT] EIA §5.1 — `type:'file'` 검증 "Planned" 표기 잔존** A-2에서 구현 완료됐으나 spec 미갱신 | `spec/5-system/14-external-interaction-api.md` §5.1 L313 | "Planned" 제거, file MIME/크기/개수 항목 추가 (project-planner) |
| I3 | SPEC-DRIFT | **[SPEC-DRIFT] WS §4.2 VALIDATION_ERROR 열거에 file 미포함** 실제 경로는 `assertFormSubmissionValid` 통해 검증 적용되나 spec 열거 누락 | `spec/5-system/6-websocket-protocol.md` §4.2 L313 | file MIME/크기/개수 열거 추가 (project-planner) |
| I4 | SPEC-DRIFT | **[SPEC-DRIFT] spec §1.5 `multiple` 속성 스니펫 구현과 상이** spec: `(maxFiles ?? 1) > 1` vs 구현: `typeof field.maxFiles === "number" && field.maxFiles > 1`. 선행 RESOLUTION에서 조치 기록됐으나 반영 확인 필요 | `spec/4-nodes/6-presentation/4-form.md` §1.5 L101 | spec L101 스니펫 확인 및 갱신 (project-planner) |
| I5 | 보안 | `image/svg+xml` 기본 허용 — 현 아키텍처(binary 미전달)에서 XSS 경로 없음. 파일 서빙 기능 도입 시 격리 필요 | `form-mode.ts` L35 / `dynamic-form-ui.tsx` `DEFAULT_FILE_ALLOWED_MIME_TYPES` | 파일 서빙 도입 시 SVG를 별도 origin + CSP 격리 또는 기본 목록 제거 |
| I6 | 보안 | 클라이언트 MIME 검증 `File.type` 우회 가능 — 설계상 UX 가드 전용, 서버가 최종 게이트. 현행 설계 올바름 | `dynamic-form-ui.tsx` `validateFilesClient` | `validateFilesClient` JSDoc에 "UX 가드 전용, 보안 게이트 아님" 한 줄 추가 (선택) |
| I7 | 아키텍처 | 클라이언트-서버 FIRST 오류 순서 동치 계약이 타입/테스트로 미강제. 수동 JSDoc 의존 | `validateFilesClient` / `validateFileField` | 두 함수 JSDoc에 "§1.5 FIRST 오류 순서: MIME → per-file size → total → count" 명시 |
| I8 | 유지보수 | `posFinite` 인라인 람다 — `extractFormFields` 내부 선언, 모듈 재사용 불가 | `form-mode.ts` L169–170 | 모듈 상단 `isPositiveFinite` 함수로 분리 (선택) |
| I9 | 유지보수 | `handleError`에서 `prev[name] === undefined` 보다 `!(name in prev)` 가 의미론 정확 | `dynamic-form-ui.tsx` L346–356 | `!(name in prev)` 로 변경 (선택) |
| I10 | 유지보수 | `validateFilesClient` 빈 배열 조기 반환이 `required` skip 이유를 미명시. "HTML 네이티브 validation에 위임" 의도 불명확 | `dynamic-form-ui.tsx` L85 | 해당 조기 반환에 의도 주석 추가 |
| I11 | 문서 | `validateScalarField`/`validateFileField` JSDoc에 `@returns` 설명 없음 | `form-mode.ts` L213–230 | `@returns null — 통과 / { field, message } — FIRST 오류` 추가 (선택) |
| I12 | 문서 | 프론트엔드 `FormField` 인터페이스 `maxFileSize`/`maxTotalSize` 필드 단위(MB) 주석 없음 | `dynamic-form-ui.tsx` L7–18 | `/** MB — 단일 파일 최대 크기. §1 기본 10 */` 한 줄 주석 추가 |
| I13 | 문서 | `coerceFormValue` 인라인 주석 "file 메타 등" 참조 잔존 — scalar-only 역할과 불일치 | `execution-engine.service.ts` L4386 | "file 메타 등" → "JSON 등" 로 수정 |
| I14 | 테스트 | `file required` 미제출 통합 케이스 누락 — 단위 커버리지로 충분, 낮은 우선순위 | `execution-engine.service.spec.ts` | `required: true` + 빈 배열 → `FormValidationError` + publish 미호출 통합 케이스 추가 고려 |
| I15 | 테스트 | `multiple` attribute 조건 분기 테스트 미포함 — UI 계약 문서화 차원, defer | `dynamic-form-ui.test.tsx` | `maxFiles:1` → single / `maxFiles:3` → multiple 단언 케이스 추가 고려 |
| I16 | 성능 | `validateFilesClient` 파일 배열 3회 순회 — maxFiles≤5 규모에서 무시 가능 | `dynamic-form-ui.tsx` | 현 규모 조치 불필요 |
| I17 | 성능 | `assertFormSubmissionValid` 내 `extractFormFields` 매 요청마다 재파싱 — 순수 메모리 파싱, 무시 가능 | `execution-engine.service.ts` | 현 규모 조치 불필요 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | 서버-클라이언트 `type:''` MIME 불일치 기능 결함(W1) + SPEC-DRIFT 4건(I1–I4) |
| architecture | LOW | DEFAULT_FILE_* 상수 DRY 위반(W2) + 검증 경로 이원화(W3) |
| maintainability | LOW | 상수 이중 정의(W2 공통) + `renderField` 파라미터 누증(W6) |
| testing | LOW | useT i18n mock 미명시 취약 격리(W5) |
| documentation | LOW | "13종 MIME" 표기 오류 코드 주석(W4) |
| security | LOW | SVG 기본 허용·metadata-only MIME 한계(현 아키텍처 무해, defer) |
| scope | NONE | 범위 내 변경만, 미허가 이탈 없음 |
| side_effect | NONE | 의도하지 않은 부작용 없음 |
| performance | NONE | 모든 발견 INFO, 실질 영향 없음 |
| api_contract | NONE | API 계약 변경 없음 |
| user_guide_sync | NONE | i18n parity 충족, 동반 갱신 누락 0건 |

---

## 발견 없는 에이전트

- **api_contract** — HTTP/WS API 경로·상태코드·응답 구조 불변. 검토 대상 없음.
- **user_guide_sync** — `new-ui-string` trigger 매칭, ko/en parity 충족. 동반 갱신 누락 없음.
- **scope** — plan 명시 항목 내 정확히 수렴. 미허가 범위 이탈 없음.
- **side_effect** — 공개 API 시그니처 불변, private 삭제, optional 추가 전용. 의도하지 않은 부작용 없음.
- **performance** — 모든 발견 INFO 수준. 캐싱/N+1/블로킹 I/O 위험 없음.

---

## 권장 조치사항

1. **(필수·즉시) W1 — 서버 `validateFileField` `type:''` 조건 수정**: `form-mode.ts` MIME 체크 조건에 `m.type !== ''` 추가 + `form-mode.spec.ts` 단위 테스트 추가
2. **(권장) W4 — 코드 JSDoc "13종" → "14종" 수정**: `types.ts` L255, `dynamic-form-ui.tsx` L35 2곳 수정 (개발자 직접). spec 4곳은 project-planner 위임
3. **(권장) W5 — useT i18n mock 명시**: `dynamic-form-ui.test.tsx` 에 `vi.mock('@/lib/i18n', ...)` 또는 setup.ts locale 리셋 추가
4. **(단기 권장) W2 — 상수 동치 통합 테스트 추가**: `packages/` 공유 모듈 추출(B-1) 전 임시 방어선으로 상수 snapshot/동치 테스트 추가
5. **(중기) W3 — `validateAllFields` 공통 함수 추출**: 두 검증 경로를 단일 순수 함수로 통합
6. **(spec 갱신 — project-planner) I1–I4 SPEC-DRIFT**: EIA §5.1 "Planned" 제거, WS §4.2 file 열거 추가, spec §1 "13종"→"14종" 4곳, §1.5 `multiple` 스니펫 확인
7. **(선택) W6 — `renderFileField` 분리**: 첫 신규 필드 타입 추가 시 file 전용 렌더러 함수 독립
8. **(선택) I10–I13 — 문서/주석 소규모 개선**: `validateFilesClient` required 위임 주석, JSDoc `@returns`, `FormField` MB 단위 주석, `coerceFormValue` "file 메타" 참조 제거

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행** (11명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync
- **제외** (3명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 의존성 추가·변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |

- **강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)