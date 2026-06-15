# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현은 spec 요건을 충실히 충족하며 Critical 발견사항 없음. 주요 위험은 프론트엔드·백엔드 간 기본값 상수 중복 정의(수동 동기화 의무)와 검증 경로 분리의 문서화 미흡 두 가지로, 기능 정확성에는 영향을 주지 않으나 장기 유지보수성에서 취약점이 될 수 있음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 유지보수성 / 부작용 | **DEFAULT_FILE_* 상수 중복 정의** — `DEFAULT_FILE_ALLOWED_MIME_TYPES`(14종 MIME) · `DEFAULT_FILE_MAX_FILE_SIZE_MB` · `DEFAULT_FILE_MAX_TOTAL_SIZE_MB` · `DEFAULT_FILE_MAX_FILES` · `MB_IN_BYTES` 가 백엔드 `form-mode.ts` 와 프론트엔드 `dynamic-form-ui.tsx` 에 각각 복사본으로 존재. 코드 주석에 수동 동기화 의무가 명시돼 있으나 타입 시스템·빌드 파이프라인이 강제하지 않아, 한쪽만 변경되면 서버/클라이언트 검증 결과가 조용히 달라질 수 있음(DRY 위반, 단일 진실 원칙 위반) | `form-mode.ts` L239–262, `dynamic-form-ui.tsx` L1026–1045 | 공유 패키지(`packages/`) 또는 shared 모듈로 단일화 후 양쪽 import. 단기 불가 시 최소한 두 상수 값 동치를 강제하는 통합 테스트 추가 |
| 2 | 아키텍처 | **`validateFormSubmission` vs execution-engine 루프 이원화** — chat-channel modal 경로는 `validateFormSubmission`(scalar 전용), EIA 경로는 `assertFormSubmissionValid` 직접 루프(scalar + file). 두 "검증 조합 방식"이 공존하며, 새 검증 규칙 추가 시 두 경로 모두 수정해야 함이 명확하지 않음 | `form-mode.ts` `validateFormSubmission`, `execution-engine.service.ts` `assertFormSubmissionValid` | scalar-only 경로 전용임을 JSDoc 에 명시하거나, execution-engine 루프를 `validateAllFields` 등 별도 함수로 추출해 두 경로의 모듈 경계를 명확화 |
| 3 | 부작용 / 유지보수성 | **`validateFormSubmission` 경로(hooks.service.ts)의 file 검증 부재 — 문서화 미흡** — `hooks.service.ts` L470 이 여전히 `validateFormSubmission`(scalar 전용)을 호출하며 file 필드 검증을 하지 않는다. chat-channel modal 에서 file 미수용이라는 의도된 설계이나 코드·JSDoc 에 명시 없어 향후 유지보수자 혼동 위험 | `hooks.service.ts` L470, `form-mode.ts` `validateFormSubmission` JSDoc | JSDoc 에 "file 필드는 chat-channel modal 미수용. EIA 경로(`assertFormSubmissionValid`)만 `validateFileField` 호출" 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §1.5 코드 스니펫 `multiple={maxFiles > 1}` 이 구현과 상이 — 구현은 `typeof field.maxFiles === "number" && field.maxFiles > 1` 로 방어적 처리(undefined 시 `multiple=false`). spec 스니펫이 maxFiles 항상 유효 숫자임을 전제해 현실과 불일치. 구현이 더 안전하므로 spec 업데이트 필요 | `spec/4-nodes/6-presentation/4-form.md` §1.5, `dynamic-form-ui.tsx` L262 | spec §1.5 스니펫을 `multiple={(maxFiles ?? 1) > 1}` 또는 프로즈 보충으로 수정 (반영 주체: `project-planner`) |
| 2 | 요건 / 테스팅 | 프론트엔드 `maxTotalSize` 클라이언트 가드 테스트 누락 — `validateFilesClient` 구현은 있으나 `dynamic-form-ui.test.tsx` 에 합계 크기 초과 케이스 없음. 서버측 `form-mode.spec.ts` 에는 있어 대칭성 결여 | `dynamic-form-ui.test.tsx` `DynamicFormUI — file 클라이언트 검증` | `totalSize 초과 → reject + 에러 표시` 케이스 1개 추가 |
| 3 | 테스팅 | `validateFileField` required + 파일 있음 → 정상 통과 케이스 미검증 — `required: true` + 빈/undefined → 오류 케이스만 있고, 충족 시 `null` 반환 케이스 없어 양방향 검증 미완 | `form-mode.spec.ts` `validateFileField` describe 블록 | `required + 파일 있음 → null 반환` 케이스 추가 |
| 4 | 테스팅 | `extractFormFields` — `NaN`, `Infinity` 경계값 테스트 미포함. `Infinity > 0 === true` 로 size 검증이 항상 통과되는 동작이 의도인지 불명확 | `form-mode.spec.ts` `extractFormFields` | `maxFileSize: NaN` → 기본값, `maxFileSize: Infinity` → Infinity 저장 케이스 추가 및 Infinity 동작 의도 명시 |
| 5 | 테스팅 | 프론트엔드 `validateFilesClient` — `f.type` 빈 문자열 처리 테스트 누락. 확장자 없는 파일 선택 시 `File.type === ''` → MIME 체크 skip 의도가 테스트로 명시되지 않음 | `dynamic-form-ui.test.tsx` | `type: ''` 파일이 MIME 거부 없이 통과하는 케이스 추가 + 코드 주석 보완 |
| 6 | 문서화 | `workflow-errors.ts` JSDoc 낡은 참조 — `FormValidationError` JSDoc 에 `chat-channel \`validateFormSubmission\`` 표현 잔존. 현재 `assertFormSubmissionValid` 는 직접 `validateScalarField`/`validateFileField` 호출 | `workflow-errors.ts` L244 | JSDoc 표현을 `validateScalarField`/`validateFileField` 로 업데이트 |
| 7 | 문서화 | `validateFileField` JSDoc 에서 `§1.5` 가 단축 참조 — 다른 JSDoc 은 전체 spec 경로를 명기 | `form-mode.ts` `validateFileField` JSDoc | `spec/4-nodes/6-presentation/4-form.md §1.5` 로 전체 경로 표기 통일 |
| 8 | 문서화 | `validateFilesClient` JSDoc — i18n 키를 와일드카드(`editor.runResults.formFile*`)로 표기. 실제 4개 키(`formFileMimeRejected`, `formFileSizeExceeded`, `formFileTotalExceeded`, `formFileCountExceeded`)를 나열하지 않아 번역 담당자가 파일 직접 검색 필요 | `dynamic-form-ui.tsx` `validateFilesClient` JSDoc | 와일드카드 대신 4개 키 명시 |
| 9 | 문서화 | `dynamic-form-ui.tsx` 로컬 상수 복제 근거 미명시 — "backend 와 값 일치 필요" 주석은 있으나 공유 모듈로 추출하지 않은 이유(번들 분리 등)가 없음 | `dynamic-form-ui.tsx` L1026–1045 | JSDoc 에 "CSR 번들 의존성 분리로 backend 모듈 직접 import 불가" 등 한 줄 근거 추가 |
| 10 | 유지보수성 | `execution-engine.service.spec.ts` 에서 `1024 * 1024` 리터럴 직접 사용 — `form-mode.spec.ts` 는 `MB_IN_BYTES` import 사용. 일관성 결여 | `execution-engine.service.spec.ts` L694, L721 | `MB_IN_BYTES` import 하여 사용 |
| 11 | 유지보수성 | `fileMeta` 헬퍼가 `describe` 블록 중간에 위치 — 상단에 위치하는 관례(`form-mode.spec.ts` 패턴)와 불일치 | `execution-engine.service.spec.ts` L662–668 | 해당 `describe` 블록 또는 file 검증 테스트 묶음 상단으로 이동 |
| 12 | 유지보수성 | `dynamic-form-ui.test.tsx` 내 `const MB = 1024 * 1024` 로컬 재정의 — `MB_IN_BYTES` 미export 로 인한 중복. `form-mode.spec.ts` 와 불일치 | `dynamic-form-ui.test.tsx` L863 | `MB_IN_BYTES` export 후 테스트에서 import |
| 13 | 아키텍처 | `renderField` 파라미터 6개로 증가(`onError`, `t` 추가) — 비-file 경로는 두 파라미터 미사용. SRP 관점 책임 혼재 | `dynamic-form-ui.tsx` `renderField` | 중장기적으로 `renderFileField` 별도 컴포넌트 분리 검토 |
| 14 | 보안 (조건부) | `image/svg+xml` 기본 허용 — 현재는 metadata-only 처리라 즉각 위험 없으나, 향후 파일 서빙 경로 추가 시 XSS 벡터 가능 | `form-mode.ts` `DEFAULT_FILE_ALLOWED_MIME_TYPES`, `dynamic-form-ui.tsx` | 파일 저장·서빙 경로 구현 시 인라인 렌더링 금지·CSP·별도 origin 서빙 정책 적용 |
| 15 | 보안 | `new RegExp(def.pattern)` ReDoS — 512자 제한 있으나 catastrophic backtracking 가능. 현재 신뢰 경계(관리자 config 전용)에서 실질 위험 낮음 | `form-mode.ts` `validateScalarField` pattern 블록 | 일반 사용자 패턴 설정 허용 시 `re2`/`safe-regex` 검토 |
| 16 | 테스팅 | `assertFormSubmissionValid` — file required 미제출 → `FormValidationError` 통합 케이스 없음(단위 테스트 커버됨) | `execution-engine.service.spec.ts` | 낮은 우선순위; `§6.2 file required 미제출 → FormValidationError` 통합 케이스 추가 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 설계 방향 적절(이중 레이어). SVG 조건부 위험·ReDoS 신뢰 경계 내 관리. Critical/Warning 없음 |
| performance | NONE | 기존 `coerceFormSubmission` 제거 → 단일 패스 개선. 나머지 선형 탐색·루프·regex 재컴파일 모두 규모상 무시 가능 |
| architecture | LOW | 프론트/백 상수 중복(WARNING), 이원화된 검증 경로(WARNING). 레이어 경계 전반적으로 준수 |
| requirement | LOW | spec 기능 요건 완전 충족. `multiple` 속성 미설정 시 동작 미세 불일치(INFO SPEC-DRIFT), `maxTotalSize` 프론트 테스트 누락(INFO) |
| scope | NONE | 범위 이탈 없음. D 후속 min/max·pattern 통합 테스트 plan 사전 포함 확인 |
| side_effect | LOW | 상수 중복 동기화 편차 위험(WARNING), hooks.service.ts 경로 file 검증 부재 문서화 미흡(WARNING) |
| maintainability | LOW | 상수 중복(WARNING), 인라인 타입 캐스팅 가독성(WARNING). 테스트 내 일관성 이슈 다수(INFO) |
| testing | LOW | 핵심 경로 양호하게 커버. `maxTotalSize` 프론트 테스트·`required` 양방향·빈 타입 케이스 등 보강 권장(모두 INFO) |
| documentation | LOW | JSDoc 전반 양호. 낡은 참조·단축 spec 경로·i18n 키 와일드카드 등 가독성 개선 권장(모두 INFO) |
| api_contract | NONE | HTTP/WS API 계약 변동 없음. `FormValidationError` 예외 인터페이스 불변 |
| user_guide_sync | NONE | i18n 4개 키 ko/en 양쪽 등록 완료(parity 충족). docs MDX 이미 올바른 상태. 동반 갱신 누락 0건 |

## 발견 없는 에이전트

- **api_contract**: HTTP/WS API 변경 없음. 계약 검토 대상 없음.
- **user_guide_sync**: i18n parity 충족, docs MDX 이미 정상 상태. 동반 갱신 누락 없음.
- **scope**: 범위 이탈 없음. 모든 변경이 plan 에 명시된 A-2 범위 내.
- **performance**: 성능 이슈 없음. 단일 패스 리팩터는 오히려 개선.

## 권장 조치사항

1. **(WARNING·공유화)** `DEFAULT_FILE_ALLOWED_MIME_TYPES` 등 파일 검증 기본값 상수를 `packages/` 공유 모듈로 단일화하거나, 단기 불가 시 두 값 동치 강제 통합 테스트 추가.
2. **(WARNING·문서화)** `validateFormSubmission` JSDoc 및 `hooks.service.ts` 호출부에 "scalar 전용 / chat-channel modal file 미수용 / EIA 경로가 별도 `validateFileField` 호출" 를 명시.
3. **(WARNING·아키텍처)** `assertFormSubmissionValid` 내 execution-engine 루프를 `validateAllFields` 등 명명된 함수로 추출해 scalar-only path vs all-field path 경계를 명확화.
4. **(INFO·SPEC-DRIFT)** spec `4-form.md §1.5` 코드 스니펫 `multiple={maxFiles > 1}` 을 `(maxFiles ?? 1) > 1` 로 수정(project-planner 반영).
5. **(INFO·테스팅)** 프론트엔드 `dynamic-form-ui.test.tsx` 에 `maxTotalSize` 초과 reject 케이스 추가.
6. **(INFO·테스팅)** `form-mode.spec.ts` 에 `required + 파일 있음 → null 반환` 케이스 추가, `NaN`/`Infinity` 경계값 케이스 추가.
7. **(INFO·테스팅)** `dynamic-form-ui.test.tsx` 에 `f.type === ''` 통과 케이스 추가(의도 문서화).
8. **(INFO·문서화)** `workflow-errors.ts` `FormValidationError` JSDoc 낡은 참조 제거/갱신.
9. **(INFO·유지보수)** `execution-engine.service.spec.ts` 에서 `1024 * 1024` 리터럴을 `MB_IN_BYTES` import 로 교체; `fileMeta` 헬퍼를 describe 블록 상단으로 이동.
10. **(INFO·유지보수)** `MB_IN_BYTES` 를 `dynamic-form-ui.tsx` 에서 export 해 프론트엔드 테스트의 로컬 재정의 제거.

## 라우터 결정

라우터 선별 적용 (`routing_status=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (3명):

| 제외된 reviewer | 이유 |
|----------------|------|
| dependency | 외부 패키지 추가 없음 — 순수 내부 로직 변경 |
| database | DB 스키마·마이그레이션·쿼리 변경 없음 |
| concurrency | 동시성 관련 공유 상태·락·비동기 병렬 경로 변경 없음 |