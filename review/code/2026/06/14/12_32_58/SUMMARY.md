# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 기능 구현(MessageTooLongError → HTTP 400 매핑)은 spec 과 완전히 일치하며 보안·API 계약·부작용 측면에서 문제 없음. plan 체크박스 미갱신과 e2e 테스트 미구현, 테스트 패턴 불일치가 주요 경고사항.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Plan 관리 | `be` / `be test` 체크박스가 구현 완료 상태를 반영하지 않아 `[ ]` 로 남아 있음 (프로젝트 규약: plan 체크박스 = 실제 상태) | `plan/in-progress/eia-message-length-error-mapping.md` L24-26 | 구현 완료된 `be`, `be test` 항목을 `[x]` 로 갱신 |
| 2 | Testing | plan 에 명시된 e2e 테스트(`submit_message 10000자 초과 → 400 + code MESSAGE_TOO_LONG`)가 미구현 — `external-interaction.e2e-spec.ts` 에 해당 시나리오 없음 | `plan/in-progress/eia-message-length-error-mapping.md` L27; `codebase/backend/test/external-interaction.e2e-spec.ts` | `external-interaction.e2e-spec.ts` 에 10001자 초과 body 전송 → `400 MESSAGE_TOO_LONG` 시나리오 추가 후 plan 체크 |
| 3 | Testing | 신규 I-5 테스트가 동일 파일의 기존 `rejects.toMatchObject` 패턴 대신 `try/catch + let caught` 패턴을 사용해 스타일 불일치 | `interaction.service.spec.ts` L253-272 | `await expect(service.interact(...)).rejects.toMatchObject({...})` 패턴으로 통일; `not.toContain` 단언은 별도 블록으로 분리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `MessageTooLongError` 내부 수치(한도·실제 길이)가 클라이언트 응답에 노출되지 않음 — `ExecutionError.serverDetail` 분리 설계로 구조적 보장 | `workflow-errors.ts` L217-225, `interaction.service.ts` L587-589 | 현행 유지; 테스트(`.not.toContain('123456')`, `.not.toContain('10000')`)가 회귀 방어 |
| 2 | API Contract | 500→400 상태 코드 변경 — 의미상 정확한 정정이나 기존 클라이언트가 500 핸들러로 처리하던 경우 행동 변화 | `interaction.service.ts` `dispatchContinuation()` | API 소비자에게 에러 코드 추가 및 상태 코드 변경을 문서로 통보 권장 |
| 3 | Maintainability | `badRequest('MESSAGE_TOO_LONG', error.message)` 패턴이 `MessageTooLongError.message` 의 client-safe 불변식에 의존 — 에러 클래스 수정 시 노출 위험 인지 필요 | `interaction.service.ts` L887 | `MessageTooLongError.CLIENT_MESSAGE` 같은 static 상수 참조 또는 현재처럼 주석+테스트 단언으로 불변식 문서화 유지 |
| 4 | Maintainability | 테스트에서 `MessageTooLongError(10_000, 123_456)` 수치 직접 인라인 — 한도 변경 시 세 곳 수동 수정 필요 | `interaction.service.spec.ts` L251 | `MAX_MESSAGE_LENGTH` 같은 상수 export 후 참조; 불가 시 인라인 주석으로 의미 명시 |
| 5 | Documentation | `dispatchContinuation` JSDoc 에 `MessageTooLongError → 400 MESSAGE_TOO_LONG` 매핑이 미언급 | `interaction.service.ts` `dispatchContinuation` JSDoc | JSDoc 에 해당 매핑 줄 추가 |
| 6 | Requirement | `dispatchContinuation` 의 `MessageTooLongError` catch 가 `submit_form`·`click_button` 경로에도 적용됨 (현재 문제없음) | `interaction.service.ts` `dispatchContinuation` | 주석에 "이 catch 는 continueAiConversation 경로 전용" 의도 명시 권장 |
| 7 | Testing | `MessageTooLongError.message` 가 실제로 고정 client-safe 문자열인지 `workflow-errors.ts` 생성자 단위에서 직접 검증하는 테스트 없음 | `workflow-errors.ts` | `workflow-errors.spec.ts` 에 `MessageTooLongError.message` 수치 미포함 직접 검증 추가 권장 |
| 8 | Maintainability | spec §5.1 `MESSAGE_TOO_LONG` 에러 표 행이 다른 행보다 현저히 길어 표 가독성 저하 | `spec/5-system/14-external-interaction-api.md` §5.1 | 표 셀은 핵심 조건만 남기고 상세 cross-ref 를 표 아래 별도 note 단락으로 분리 (선호도 수준) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 내부 수치 노출 없음, serverDetail 분리 설계 적절, 인젝션·인증 우회 없음 |
| requirement | LOW | plan 체크박스 미갱신(be/be test), e2e 테스트 미구현 |
| scope (fatal) | — | 재시도 필요 (output_file 없음) |
| side_effect | NONE | dispatchContinuation 내부 한정, 함수 시그니처·공개 API·전역 상태 변경 없음 |
| maintainability | LOW | plan 체크박스 미갱신, try/catch 패턴 불일치, 매직 리터럴 |
| testing | LOW | try/catch vs rejects.toMatchObject 패턴 불일치, e2e 미구현 |
| documentation | LOW | dispatchContinuation JSDoc 미갱신, plan 체크박스 미갱신 |
| api_contract | LOW | 500→400 변경은 의미상 정정, spec·구현·테스트 일치 확인 |

## 발견 없는 에이전트

- **security**: 보안 취약점 없음 (INFO 수준 확인 사항만)
- **side_effect**: 의도하지 않은 부작용 없음

## 권장 조치사항

1. **[즉시] plan 체크박스 갱신** — `plan/in-progress/eia-message-length-error-mapping.md` 에서 `be` / `be test` 항목을 `[x]` 로 갱신 (프로젝트 규약 위반, 다수 reviewer 공통 지적)
2. **[즉시] e2e 테스트 추가** — `external-interaction.e2e-spec.ts` 에 `submit_message` 10001자 초과 → `400 MESSAGE_TOO_LONG` 시나리오 추가 후 plan 체크 (plan 명시 항목)
3. **[권장] 테스트 패턴 통일** — I-5 테스트를 `rejects.toMatchObject` 패턴으로 변경해 파일 내 일관성 확보
4. **[권장] `dispatchContinuation` JSDoc 갱신** — `MessageTooLongError → 400 MESSAGE_TOO_LONG` 매핑 줄 추가
5. **[선택] 매직 리터럴 개선** — `MAX_MESSAGE_LENGTH` 상수 export 또는 인라인 주석으로 의미 명시
6. **[선택] `workflow-errors.spec.ts` 보강** — `MessageTooLongError.message` 가 수치를 포함하지 않음을 생성자 단위에서 직접 검증

## 라우터 결정

라우터 결정(`routing=done`) — 라우터가 선별 실행:

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (8명, 전원 router_safety 강제 포함)
- **제외**: 아래 표 (6명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 에러 매핑 추가로 성능 영향 없음 |
| architecture | 단일 private 메서드 내부 변경, 아키텍처 영향 없음 |
| dependency | 신규 외부 의존성 없음 |
| database | DB 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| user_guide_sync | 사용자 문서 동기화 불필요 |

---

> 재시도 필요: 1건 (`scope` — output_file 없음, fatal 상태)