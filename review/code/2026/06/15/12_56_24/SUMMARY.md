# Code Review 통합 보고서

## 전체 위험도
**LOW** — spec 동기화 PR 전반의 품질은 양호. Critical 발견 없음. 두 건의 WARNING(요구사항·문서화 각 1건)이 사람의 확인/결정을 필요로 하며, 나머지는 INFO 수준 보완 권장 사항.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `validation.message` override — spec §6.2 표는 `minLength`/`maxLength` 위반 시 `validation.message` 를 사용한다고 명시하나, `validateScalarField` 구현은 항상 하드코딩된 기본 메시지를 반환하며 `FormModalField` 에 `message` 필드 자체가 없음. spec §1.5 callout 은 "현 scalar도 기본 메시지 사용" 이라 부연해 spec 내부 모순이 발생. 의도적 v1 축소인지 미구현 버그인지 사람이 판단해야 함. | `spec/4-nodes/6-presentation/4-form.md` §6.2 line 333; `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateScalarField` | (A) `FormModalField`에 `message?: string` 추가 + `extractFormFields`에서 복사 + `validateScalarField`에서 적용해 spec §6.2 충족. 또는 (B) v1 의도적 제외로 결정 시 spec §6.2 해당 행을 "기본 메시지 사용 (override 는 향후 과제)"으로 갱신해 spec 내부 모순 해소. |
| 2 | 문서화 | `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 설명에 `type:'file'` 항목 미반영. EIA spec(`14-external-interaction-api.md`) §5.1 은 이번 diff 에서 갱신됐으나 WS spec §4.2 는 scalar 목록만 유지. WS 클라이언트 구현자가 file 검증 실패가 `VALIDATION_ERROR` ack 로 표면된다는 사실을 spec 에서 알 수 없음. consistency check cross_spec.md WARNING #2 에서도 이미 지적된 사항. | `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행 | §4.2 `VALIDATION_ERROR` 행 끝에 `·type:'file' MIME/크기/개수` 항목 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `multiple` 속성 표현식 — 코드는 `typeof field.maxFiles === "number" && field.maxFiles > 1` 이나 spec §1.5 literal 은 `(maxFiles ?? 1) > 1`. 모든 입력값(undefined/null/0/양수)에 대해 결과가 동일한 기능적 동치이므로 버그 없음. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` line 159 | spec §1.5 literal 표현식과 정렬하려면 `(field.maxFiles ?? 1) > 1` 로 변경 권장(선택). |
| 2 | 요구사항 | `validateFilesClient` 에서 `required` + 빈 배열 체크 없음 — 빈 파일 제출 시 클라이언트 가드를 통과하고 서버 왕복 후 에러 표시. spec 이 명시하지 않은 영역이므로 spec 위반 아님. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` line 86-118 | `validateFilesClient` 에서 `required && files.length === 0` 처리를 추가하면 UX 개선 가능(선택). |
| 3 | 문서화 | spec §1.5 본문에 i18n 키 경로(`editor.runResults.formFile*`) 미명시. 독자가 키를 알려면 코드 탐색 필요. | `spec/4-nodes/6-presentation/4-form.md` §1.5 | §1.5 "실시간 검증" 절 끝에 `(i18n 키: \`editor.runResults.formFile*\`)` 한 줄 추가(선택). |
| 4 | 문서화 | spec §1 callout "기본값 상수 SoT" 에 아키텍처 백로그 B-1(런타임 공유 패키지 추출) 참조 없음. frontend/backend 상수 미러 구조가 임시 상태임을 spec 독자가 파악하기 어려움. | `spec/4-nodes/6-presentation/4-form.md` §1 callout | §1 callout 끝에 `(런타임 공유 패키지 추출은 아키텍처 백로그 B-1)` 추가(선택). |
| 5 | 문서화 | `validateFilesClient` (frontend) 신규 공개 헬퍼에 JSDoc(파라미터·반환·에러 조건) 존재 여부 미확인. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `validateFilesClient` 함수 정의부 | `@param`, `@returns`, 에러 반환 조건을 포함하는 JSDoc 추가 확인. |
| 6 | 문서화 | `validateFileField` (backend) spec §6.2 핵심 계약 구현 함수에 JSDoc(검증 순서·상수 의존) 존재 여부 미확인. | `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateFileField` 함수 정의부 | spec §6.2 검증 순서와 `DEFAULT_FILE_*` 상수 의존 관계를 JSDoc 에 명시 권장. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | `validation.message` override 미구현(spec §6.2 vs 구현 불일치, spec 내부 모순); `multiple` 표현식 기능적 동치이나 형식 불일치 |
| scope | NONE | 모든 변경이 의도된 범위에 정확히 국한, 범위 이탈 없음 |
| documentation | LOW | WS spec §4.2 `VALIDATION_ERROR`에 `type:'file'` 항목 누락; 나머지는 선택적 보완 |
| api_contract | NONE | API 구현 코드 변경 없음, spec 문서 동기화만 — breaking change 없음 |

## 발견 없는 에이전트

- **scope** — 범위 이탈 없음, 전 파일 의도된 변경에 국한.
- **api_contract** — 이번 diff 에 API 구현 코드 변경 없음. 기존 에러 형식·엔드포인트 변경 없음.

## 권장 조치사항

1. **(WARNING-1) `validation.message` override 방향 결정** — 의도적 v1 축소라면 spec §6.2 해당 행을 "기본 메시지 사용(override 향후 과제)"으로 갱신해 spec 내 모순 해소. 구현 완료가 목표라면 `FormModalField.message`, `extractFormFields` 복사, `validateScalarField` 적용으로 충족.
2. **(WARNING-2) WS spec §4.2 보완** — `spec/5-system/6-websocket-protocol.md` §4.2 `VALIDATION_ERROR` 행에 `·type:'file' MIME/크기/개수` 추가. EIA spec 과의 대칭성을 맞추고 WS 클라이언트 구현자에게 계약 전달.
3. **(INFO-1) `multiple` 표현식 정렬** — 기능적 영향 없으나 spec §1.5 literal `(field.maxFiles ?? 1) > 1` 로 정렬해 미래 spec drift 예방(선택).
4. **(INFO-2~4) 문서화 보완** — i18n 키 경로, B-1 백로그 참조, `validateFilesClient`/`validateFileField` JSDoc 추가는 선택적 보완.

## 라우터 결정

라우터 상태: `done` — 라우터가 reviewer 를 선별함.

- **실행** (4명): `requirement`, `scope`, `documentation`, `api_contract`
- **강제 포함 (router_safety)**: `documentation`, `requirement`
- **제외** (10명):

| 제외된 reviewer | 이유 |
|------------------|------|
| security | 이번 diff 가 spec 문서·review 산출물로만 구성, 인증·인가·입력 소독 코드 변경 없음 |
| performance | 런타임 코드 변경 없음, 성능 회귀 위험 없음 |
| architecture | 아키텍처 변경 없음, spec 동기화 전용 PR |
| side_effect | 구현 코드 변경 없음, 부작용 분석 불필요 |
| maintainability | 코드 유지보수성 분석 대상 코드 변경 없음 |
| testing | 테스트 코드 변경 없음 |
| dependency | 의존성 변경 없음 |
| database | DB 스키마·마이그레이션 변경 없음 |
| concurrency | 동시성 관련 코드 변경 없음 |
| user_guide_sync | 사용자 가이드 동기화 대상 변경 없음 |