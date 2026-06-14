# RESOLUTION — 20_22_14

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드 (Testing) | 3a409092 | assertFormSubmissionValid 5개 경로 + coerceFormValue 9개 타입 분기 단위 테스트 추가 (execution-engine.service.spec.ts) |
| W-2 | 코드 (Testing) | 3a409092 | continueExecution FormValidationError → 400 + VALIDATION_ERROR + details[] body 검증 추가 (executions.controller.spec.ts) |
| W-3 | DEFERRED-BACKLOG | — | execution-engine → chat-channel 레이어 의존 역전 해소 — 별도 계획 태스크 필요 (cross-module 리팩터) |
| W-4 | DEFERRED-BACKLOG | — | ExecutionEngineService SRP 압박 (form 검증 로직 추출) — W-3 와 묶어 별도 태스크로 처리 |
| W-5 | 코드 (Architecture) | 3a409092 | ErrorCode enum 에 VALIDATION_ERROR 추가; workflow-errors.ts / executions.controller.ts / interaction.service.ts 3개소 하드코딩 → enum 참조 교체 |
| W-6 | 코드 (Maintainability) | 3a409092 | FormValidationError.toHttpDetails() 추가; 두 진입점 모두 toHttpDetails() 재사용으로 중복 제거 |
| W-7 | 코드 (Maintainability) | 3a409092 | badRequest() details 파라미터 unknown → ReadonlyArray<ValidationDetail> 구체화 |
| W-8 | WONTFIX | — | 검토 결과 interaction.service.spec.ts 에 중복 테스트 없음 (SUMMARY 오탐) — 단일 occurrence 확인 |
| W-9 | 코드 (Documentation) | 3a409092 | dispatchContinuation JSDoc 에 FormValidationError → 400 VALIDATION_ERROR 매핑 + spec 참조 + first-error 정책 추가 |
| W-10 | 코드 (Documentation) | 3a409092 | @ApiBadRequestResponse 데코레이터 continueExecution 에 추가 (executions.controller.ts) |
| W-11 | DEFERRED-BACKLOG | — | assertFormSubmissionValid DB 쿼리 2회 → JOIN 단일화 최적화 — 별도 태스크로 처리 (성능 최적화, 기능 무관) |
| W-12 | 코드 (Requirement) | 3a409092 | WS gateway FormValidationError → ack { errorCode: 'VALIDATION_ERROR' } 회귀 가드 추가 (websocket.gateway.spec.ts) |

### INFO 항목 (선택 처리)

| INFO # | 조치 |
|--------|------|
| I-12 | 3a409092: coerceFormValue JSDoc 확장 — 모든 타입 분기 변환 규칙 문서화 |
| I-13 | 3a409092: e2e describe 커버리지 목록에 케이스 G (form validation) 추가 |
| I-14 | 3a409092: CHANGELOG.md — VALIDATION_ERROR 에러코드 + submit_form 서버 검증 추가 항목 기록 |
| I-16 | 3a409092: e2e 케이스 G — nodeId body 역할 설명 주석 추가 |

## TEST 결과

- lint  : 통과 (backend — 0 errors, 43 pre-existing warnings; frontend — eslint not installed, pre-existing infra 차단)
- unit  : 통과 (347 test suites, 6944 passed, 1 skipped — 모두 pre-existing)
- e2e   : 통과 (192/192)

## 보류·후속 항목

- W-3 (BACKLOG): execution-engine → chat-channel 레이어 의존 역전 해소 — extractFormFields / validateFormSubmission 을 shared/form/ 채널 중립 경로로 승격. cross-module 리팩터로 별도 plan 태스크 권장.
- W-4 (BACKLOG): ExecutionEngineService 의 form 검증 로직(assertFormSubmissionValid / coerceFormSubmission / coerceFormValue) 분리 — W-3 와 연동. 별도 plan 태스크.
- W-11 (BACKLOG): assertFormSubmissionValid DB 쿼리 2회 → findOne({ relations: { node: true } }) 단일 쿼리 최적화. 성능 개선 별도 태스크.
- I-4 (INFO, NOT FIXED): executions.controller + interaction.service exception 매핑 이중화 → 중앙 ExceptionFilter/ExecutionErrorMapper 유틸화 — 별도 중장기 태스크.
- I-5 (INFO, NOT FIXED): node config 재제출 시 캐싱 부재 — 중장기 최적화 태스크.
