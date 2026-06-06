# API 계약(API Contract) 검토 결과

**검토 범위**: PR-B1/B2 — execution-engine park/resume 구현 + EIA 클라이언트 변경
**검토 기준**: API 계약 관점 8가지 점검 항목

---

## 발견사항

### [CRITICAL] `eia-client.ts` — `unwrapEnvelope` 제거로 `{ data }` 봉투 미언랩 재발 위험

- **위치**: `codebase/channel-web-chat/src/lib/eia-client.ts` (전체 파일)
- **상세**: 이 PR의 브랜치(`exec-park-durable-resume`)는 `fix-webchat-envelope-unwrap` 핫픽스(`733721dc`, main 머지)보다 이전 커밋에서 분기됐다. 결과적으로 HEAD에 `unwrapEnvelope` 함수 및 `startConversation`/`getStatus`/`refreshToken` 내 봉투 언랩 코드가 없다. 백엔드 전역 `TransformInterceptor`는 현재도 성공 응답을 `{ data: ... }`로 래핑한다(`codebase/backend/src/common/interceptors/transform.interceptor.ts` 28번 줄 — 변경 없음). 이 PR이 main에 머지되면 origin/main이 가진 언랩 코드를 덮어써 SSE 미개시 버그가 재발한다:
  - `startConversation()` → 응답이 `{ data: { executionId, interaction: {...} } }` 인데 클라이언트가 최상위에서 `.interaction`을 읽음 → `undefined` → `openStream()` 미호출
  - `getStatus()` → `{ data: { status, seq } }` 봉투 그대로 → `r.status` 값 없음
  - `refreshToken()` → `{ data: { token, expiresAt } }` 봉투 미언랩 → `r.token` undefined
- **제안**: 머지 전에 반드시 `origin/main`(`733721dc` 이후)으로 rebase하거나, `unwrapEnvelope` 함수와 세 메서드의 언랩 호출을 복원해야 한다. 재발하면 웹챗 위젯 전체 동작 불가(SSE 미개시).

---

### [WARNING] `eia-client.ts` `getStatus()` 반환 타입 약화 — `ExecutionStatus` → `Record<string, unknown>`

- **위치**: `codebase/channel-web-chat/src/lib/eia-client.ts` `getStatus()` 메서드
- **상세**: origin/main 기준으로 `getStatus()`의 반환 타입이 `ExecutionStatus`(명시적 인터페이스: `id`, `status`, `seq`, `currentNode` 등)에서 `Record<string, unknown>`으로 약화됐다. `ExecutionStatus` 인터페이스도 `eia-types.ts`에서 삭제됐다. 호출자가 응답 필드에 타입 안전하게 접근할 수 없고, 컴파일러가 필드 오타나 누락을 잡아내지 못한다. API 응답 스키마 준수 관점에서 EIA §5.3 계약이 코드에서 사라진다.
- **제안**: `ExecutionStatus` 인터페이스를 복원하거나 EIA §5.3 스펙의 필드를 담는 구체 타입을 별도로 정의한다. `Record<string, unknown>`은 임시 타입으로 적합하지 않다.

---

### [WARNING] `eia-client.test.ts` — 오류 응답 케이스(401/403/500) 테스트 대거 삭제

- **위치**: `codebase/channel-web-chat/src/lib/eia-client.test.ts`
- **상세**: `refreshToken` 401/403/500, `getStatus` 410/500/401 에러 케이스, `startConversation` 봉투-없는 응답 하위 호환 테스트 등이 삭제됐다. API 클라이언트의 에러 응답 처리(HTTP 상태 코드 기반 분기) 계약이 테스트로 검증되지 않는다. 회귀 감지 불가 상태.
- **제안**: 삭제된 에러 케이스 테스트를 복원한다. 최소한 `refreshToken`의 401(토큰 만료)/403(권한), `getStatus`의 410(대화 종료)/비-410 에러는 API 계약의 핵심이므로 반드시 유지해야 한다.

---

### [INFO] `Execution.resumeCallStack` — API DTO 미노출 명시 근거 확인됨

- **위치**: `codebase/backend/src/modules/executions/entities/execution.entity.ts` 128-139번 줄
- **상세**: `resumeCallStack` 컬럼이 entity에 추가됐으나, entity 주석에 "API DTO 미포함(whitelist 매핑이라 자동 배제)"가 명시됐고, `execution-response.dto.ts`에 해당 필드 노출이 없음이 확인됐다. 내부 rehydration 전용 필드로 의도된 것으로 API 계약 위반 아님. `conversation_thread`/`user_variables`와 동일 패턴.
- **제안**: 해당 없음(현재 설계 적절). 다만 `ExecutionDto`/`ExecutionDetailDto`의 화이트리스트 매핑 방식이 실제로 이 필드를 배제하는지 integration 테스트 레벨 확인을 권장한다.

---

### [INFO] V087 마이그레이션 — 하위 호환성 유지

- **위치**: `codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- **상세**: `ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL` 은 nullable 추가이므로 기존 row 및 기존 INSERT 쿼리에 영향 없다. 배포 이전 row는 NULL로 처리되고 rehydration은 단일 레벨로 재개(회귀 없음). breaking change 아님.
- **제안**: 해당 없음.

---

### [INFO] 기타 API 관련 변경 파일(review/consistency/..., plan/..., spec/...) — API 계약과 무관

- 변경 파일 중 `review/`, `plan/`, `spec/`, `codebase/backend/src/modules/knowledge-base/eval/` 경로는 API 계약과 직접 무관하다(내부 문서·일관성 검토 산출물·평가 도구). 이 파일들은 본 검토 대상에서 제외한다.

---

## 요약

이 PR의 API 계약 관점 핵심 위험은 `codebase/channel-web-chat/src/lib/eia-client.ts`다. 이 PR 브랜치는 `fix-webchat-envelope-unwrap` 핫픽스(origin/main `733721dc`)보다 이전에 분기됐기 때문에, `unwrapEnvelope` 함수 및 세 메서드의 `{ data }` 봉투 언랩 코드가 없다. 백엔드 `TransformInterceptor`는 여전히 모든 성공 응답을 `{ data: ... }`로 래핑하므로, 이 PR을 현재 상태로 main에 머지하면 SSE 미개시 버그가 재발하고 웹챗 위젯 전체가 동작 불가해진다(Critical). 부가적으로 `getStatus()` 반환 타입이 `Record<string, unknown>`으로 약화돼 EIA §5.3 API 스키마 계약이 코드 레벨에서 사라지고(Warning), 에러 응답 케이스 테스트가 대거 삭제돼 회귀 감지가 불가능해졌다(Warning). 백엔드의 `resumeCallStack` 컬럼 추가는 nullable 추가로 하위 호환이며 DTO 미노출이 확인돼 API 계약 위반이 아니다.

## 위험도

HIGH

STATUS=success ISSUES=3
