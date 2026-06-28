# 문서화(Documentation) 리뷰 — webhook 인증 1MB body 게이트 + 공개 webhook 보호 fix (resolution 후 fresh 검증)

## 발견사항

### [INFO] hooks-body-parser.ts — captureRawBody 빈 Buffer 방어 조건 이유 미명시
- 위치: `/codebase/backend/src/bootstrap/hooks-body-parser.ts` — `captureRawBody` 함수 JSDoc
- 상세: resolution W3 fix 이후 조건이 `if (buf && buf.length)` → `if (buf)`로 단순화되었고 JSDoc에 빈 Buffer도 세팅하는 이유(HMAC 검증 보존)가 명시되어 있다. 그러나 body-parser가 빈 본문에도 verify 콜백을 호출하는 동작 자체에 대한 설명이 JSDoc 본문에 없어, 미래 독자가 조건의 근거를 유추해야 한다. 이 항목은 이전 리뷰 세션(15_00_36)의 INFO 30에서도 지적됐으며 미조치 상태다.
- 제안: `captureRawBody` JSDoc 또는 인라인에 한 줄 추가. 예: `// body-parser 는 빈 본문에도 verify 를 호출하므로 buf 가 있으면(length === 0 포함) 항상 세팅한다.`

### [INFO] main.ts — Swagger 에러 코드 목록 PAYLOAD_TOO_LARGE 추가 확인 (FIXED)
- 위치: `/codebase/backend/src/main.ts` — `setupSwagger` 함수 내 `setDescription()` 블록
- 상세: 이전 리뷰(15_00_36) INFO 16·RESOLUTION INFO 16에서 지적된 Swagger 에러 코드 목록 누락이 이번 diff에서 수정되었다. diff 라인에 `PAYLOAD_TOO_LARGE` 가 목록에 추가된 것이 확인된다. 추가 조치 불필요.
- 제안: 없음.

### [INFO] e2e 테스트 파일 — 상단 JSDoc 범위 설명에 새 케이스(J/K/L/M) 미반영
- 위치: `/codebase/backend/test/webhook-trigger.e2e-spec.ts` — 파일 상단 JSDoc 블록
- 상세: e2e J/K/L은 이전 리뷰(15_00_36) INFO 29에서 지적됐으나, RESOLUTION에서 이 항목은 명시적으로 조치 완료 처리되지 않았다. 이번 diff에는 파일 상단 JSDoc 갱신이 포함되어 있지 않다. 또한 resolution에서 추가된 e2e M(인증 webhook 1MB 초과)도 파일 상단 JSDoc에 반영되지 않았다. 테스트 `it` 설명이 상세하므로 기능 이해에는 지장이 없지만 파일 레벨 개요와 실제 커버 범위 사이의 불일치가 누적된다.
- 제안: 파일 상단 JSDoc에 한 줄 추가. 예:
  ```
  *   - 본문 크기 경계(WH-NF-02 옵션 C): 인증 512KB 통과(J) / 1MB 초과 413(K/M) / 공개 32KB 초과 413(L)
  ```

### [INFO] hooks.service.ts — preloadedTrigger 파라미터 JSDoc 없음
- 위치: `/codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` 메서드 신규 파라미터 `preloadedTrigger?: Trigger | null`
- 상세: resolution W1 fix로 `preloadedTrigger` 파라미터가 추가되었고, 인라인 주석(W14 캐시 의도, 폴백 로직)이 있어 맥락 파악이 가능하다. 그러나 메서드 시그니처 레벨의 JSDoc(`@param preloadedTrigger`)이 없어, IDE hover 또는 생성 문서에서 이 파라미터의 의미와 `undefined` vs `null` 구분 의미를 알 수 없다.
- 제안: 메서드 JSDoc에 `@param preloadedTrigger Guard가 이미 조회해 req에 첨부한 trigger(W14). undefined이면 직접 조회로 폴백, null이면 "존재하지 않음"으로 처리.` 추가를 권장. 차단 수준 아님.

### [INFO] hooks.controller.ts — req.__publicWebhookTrigger 전달 이유 주석 있음 (양호)
- 위치: `/codebase/backend/src/modules/hooks/hooks.controller.ts`
- 상세: resolution W1 fix에서 `req.__publicWebhookTrigger` 전달 이유를 인라인 주석 `// Guard 가 이미 조회해 첨부한 trigger 재사용 — 중복 DB 왕복 제거 (W14).`로 명시했다. 공개 API가 아닌 내부 연결 지점에 적절한 맥락 주석이 있어 문서화 관점에서 양호하다.
- 제안: 없음.

### [INFO] spec/5-system/3-error-handling.md 및 2-api-convention.md — hooks-body-parser.ts 미등재
- 위치: `spec/5-system/3-error-handling.md`, `spec/5-system/2-api-convention.md` — frontmatter `code:` 목록
- 상세: 이전 리뷰(15_00_36) INFO 32에서 지적된 항목. `PAYLOAD_TOO_LARGE` 의 발원지인 `src/bootstrap/hooks-body-parser.ts`가 두 spec 파일의 `code:` frontmatter에 등재되지 않았다. spec-impl coverage 추적 도구(spec-coverage skill)가 이 파일을 구현 근거로 삼을 때 갭이 생긴다. RESOLUTION에서 명시적으로 조치되지 않은 항목이다.
- 제안: 선택적. `3-error-handling.md`와 `2-api-convention.md` frontmatter `code:` 에 `codebase/backend/src/bootstrap/hooks-body-parser.ts` 추가. 즉각 필수는 아니지만 spec-coverage 도구 정확도를 위해 후속 반영 권장.

### [INFO] CHANGELOG.md — 두 개의 Unreleased 블록 날짜 없음
- 위치: `/CHANGELOG.md` — 최상단 신규 블록 및 기존 "Unreleased — webhook/manual 400 검증 실패..." 블록
- 상세: 두 "Unreleased" 블록 모두 날짜가 없어 배포 후 정리 시 순서 식별이 어렵다. 이는 기존 프로젝트 스타일과 일관적이고 이번 변경의 문서화 내용 자체는 상세하고 정확하다. 이전 리뷰(15_00_36) INFO에서도 동일하게 지적됐으나 "현 상태 유지" 결론이었다.
- 제안: 현 상태 유지. 향후 배포 시 날짜 붙이는 관행 도입은 이번 범위 밖.

## 요약

이번 변경 세트(인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 버그 수정 + resolution fix 적용 후 fresh 검증)의 문서화 품질은 전반적으로 우수하다. CHANGELOG 업데이트, spec 동기화(12-webhook, 2-api-convention, 3-error-handling), plan 항목 완료 처리, 코드 JSDoc/인라인 주석이 모두 일관되게 갱신되었다. 이전 리뷰(15_00_36)에서 지적된 핵심 문서 누락 — Swagger 에러 코드 목록 `PAYLOAD_TOO_LARGE` — 은 이번 diff에서 수정 확인되었다. 잔여 항목은 모두 INFO 수준으로, `captureRawBody` JSDoc에 빈 Buffer 체크 근거 미명시, e2e 파일 상단 JSDoc의 새 케이스(J/K/L/M) 미반영, `handleWebhook` 신규 파라미터 `@param` JSDoc 부재, spec frontmatter `code:` 선택적 추가 등이다. WARNING 이상의 문서화 문제는 없으며 차단 항목이 존재하지 않는다.

## 위험도

LOW

STATUS: SUCCESS
