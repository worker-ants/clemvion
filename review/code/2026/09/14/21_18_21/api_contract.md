# API 계약(API Contract) 리뷰

## 검토 범위

`git diff origin/main...HEAD --stat` 로 변경 파일 전수를 확인했다. 컨트롤러(`triggers.controller.ts`,
`hooks.controller.ts`)와 DTO(`dto/`)는 **diff 0건** — 라우트·요청 검증 스키마·HTTP 메서드/경로는
전혀 건드리지 않았다. 실제 변경은 서비스/영속성 계층(`triggers.service.ts`,
`chat-channel-binder.service.ts`, 신규 `trigger-config-lock.ts`)의 lost-update 동시성 수정과,
`hooks.service.ts` 의 웹훅 hot path 저장 방식 변경, 그리고 그 회귀를 잡는 테스트·정적 가드
(`endpoint-path-conflict-wrap-guard.ts` 등)다. 나머지(CHANGELOG, plan, review/ 산출물)는 코드가
아니다.

## 발견사항

- **[INFO]** 이전 라운드가 지적한 "형제 엔드포인트 응답 불일치"가 이번 diff 에서 수정 확인됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken()` 내
    `if (!wrote) this.assertTriggerFound(null);` (관련 `update()` 의 `assertTriggerFound(fresh)`)
  - 상세: 코드 주석 자신이 인용한 `review/code/2026/09/14/20_17_16` api_contract WARNING#3 —
    "삭제 경합 시 `rotateBotToken` 은 `wrote=false` 를 무시하고 200 + 감사 row 를 남기는데,
    같은 조건에서 `update()` 는 404 를 낸다"는 지적이 정확히 이 diff 로 닫혔다. 두 엔드포인트가
    이제 같은 삭제-경합 조건에서 동일하게 `RESOURCE_NOT_FOUND` 404 를 던지고, 감사 로그도
    (거짓 "회전됨" 기록 없이) 함께 스킵된다. `binder` 의 best-effort 두 자리(setup 성공/실패
    후속)는 응답이 이미 나간 뒤의 부수 작업이라 `false` 를 조용히 삼키는 것이 문서화된 의도된
    비대칭(`trigger-config-lock.ts` JSDoc 의 표)이고, 이 셋은 "요청의 결과 vs 뒤따르는 부수
    작업"이라는 일관된 기준으로 갈려 있어 계약 관점에서 문제 없다.
  - 제안: 없음 — 재확인 목적의 기록.

- **[INFO]** 응답 구성 경로(`sanitizeForResponse` 이전 커밋-후 재조회)는 이번 트랜잭션 재구조화
  이후에도 그대로 유지됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 의
    `manager.transaction(...)` 종료 후 `chatChannel` 이 있으면 `setupChatChannel` → `relations:
    ['workflow']` 를 실은 재조회 → `sanitizeForResponse`
  - 상세: `save(trigger)` 를 `manager.transaction` 콜백 안에서 락을 잡고 재읽은 행에 대해
    수행하도록 바꿨지만, 응답 바디를 만드는 시점은 여전히 "모든 쓰기(트랜잭션 커밋 + best-effort
    `setupChatChannel`)가 끝난 뒤 최신 상태를 재조회"하는 기존 계약을 유지한다. 락 안에서
    관계(`workflow`)를 함께 읽도록 새로 추가된 부분도, "생성 응답에만 `workflow` 가 없다"는
    `TriggerDto` 의 기존 보장을 정확히 지킨다(관계 누락 회귀를 코드 주석이 스스로 인용해
    설명). 응답 스키마·필드 노출 범위에 변화 없음.
  - 제안: 없음.

- **[INFO]** `DELETE /api/triggers/:id` 에 새 지연/실패 모드가 생기지만 Swagger 문서·에러 코드
  체계에는 별도 등재되지 않음(설계상 감수된 트레이드오프로 보임)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` —
    `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`
    (5,000ms), `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-54`
    (`SET LOCAL lock_timeout`)
  - 상세: 삭제 경로가 이번에 처음으로 advisory lock 을 잡는다. 같은 트리거에 대한 PATCH/rotate
    가 락을 오래 쥐고 있으면(무한 대기 설계 — 위 관찰대로 임계 구간이 짧아 이론상 드물다) DELETE
    는 5초 뒤 Postgres `query_canceled`(57014) 로 실패한다. 이 에러는
    `isPostgresUniqueViolation`/`HttpException`/`mapHttpErrorLike` 어느 분기에도 안 걸려
    `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts:76-88`)
    의 일반 `Error` 분기로 떨어져 **500 `INTERNAL_ERROR`** 로 마스킹된다. `triggers.controller.ts`
    의 `@Delete(':id')` 는 `@ApiNoContentResponse`/`401`/`403`/`404` 만 문서화하고 있어(이 저장소
    관례상 5xx 는 통상 문서화 대상이 아니라 새 패턴은 아니다) 클라이언트 입장에서 이 특정 500 이
    "재시도하면 되는 일시적 자원 경합"인지 구분할 방법이 없다. 더 나쁜 것은, 이 경로가 실패해도
    `teardownChatChannel`·secret 삭제·listener 해제는 **이미 커밋 없이 부수효과로 실행 완료**된
    뒤라 — 코드 주석이 스스로 "반쯤 삭제된 상태" 라 부르는 상태가 클라이언트에는 그냥 평범한
    500 으로만 보인다.
  - 제안: 이번 배치를 막을 사유는 아니다(발생 조건이 좁고 이미 로그로 서버측 가시성은 확보돼
    있음). 다만 이 타임아웃이 실제로 튀는 사례가 관측되면, `QueryFailedError`(driver code
    `57014`)를 `GlobalExceptionFilter` 나 `remove()` 의 `.catch` 에서 `409 Conflict`/`503
    Service Unavailable` + 전용 에러 코드(예: `TRIGGER_DELETE_LOCK_TIMEOUT`)로 승격해, 클라이언트가
    일반 500 과 구분해 재시도 정책을 세울 수 있게 하는 것을 후속으로 고려할 만하다.

- **[정보/비-이슈]** 요청 검증·URL 설계·페이지네이션·버전 관리 — 해당 변경 없음
  - `UpdateTriggerDto`/`CreateTriggerDto`, `@Roles`/`@WorkspaceId` 가드, 목록 API
    (`PaginatedResponseDto.create`), API 버전 분기 모두 diff 대상이 아니다. 이번 변경은 서비스
    계층의 동시성 버그 수정에 한정된다.

## 요약

이 변경은 컨트롤러·DTO·라우트·인증 미들웨어·페이지네이션 등 API 계약의 외부 표면을 전혀
건드리지 않는 서비스/영속성 계층 lost-update 수정이다. 오히려 이전 라운드(`20_17_16`)가
API 계약 관점에서 지적한 "삭제 경합 시 형제 엔드포인트(`update`/`rotateBotToken`)의 응답이
갈린다"는 WARNING 이 이번 diff 로 정확히 닫혀(`rotateBotToken` 도 이제 404 로 통일), 계약
일관성이 오히려 개선됐다. 응답 바디 구성 방식(커밋 후 관계 포함 재조회 → 정화)도 기존 계약을
그대로 유지한다. 유일하게 눈에 띄는 새 표면은 `DELETE /api/triggers/:id` 가 삭제 락 타임아웃
(5초) 시 일반 500 으로 떨어지는 좁은 엣지 케이스인데, 발생 조건이 드물고 서버측 로깅으로
가시성이 확보돼 있어 차단 사유는 아니다(INFO). 나머지 관점(하위 호환성·버전 관리·요청 검증·
URL 설계·페이지네이션·인가)은 전부 변경 없음.

## 위험도

NONE
