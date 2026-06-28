# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` (--impl-done, diff-base=origin/main)
변경 파일: 7개 (codebase only, spec 변경 없음)

---

## 발견사항

### 요약 — 신규 식별자 목록

이번 PR 이 도입하는 신규/변경 식별자:

| 식별자 | 종류 | 위치 |
|--------|------|------|
| `getStatusById` | 공개 메서드 (신규) | `ExecutionsService` |
| `extractClientIpFromHeaders` 반환형 `string \| null` → `string \| undefined` | 함수 시그니처 변경 | `auth/utils/client-ip.ts` |
| `RESOURCE_CONFLICT` (23505 → 409 매핑 추가) | 에러 코드 확장 | `GlobalExceptionFilter` |
| `STATE_MISMATCH` | 에러 코드 (테스트 내 passthrough) | `http-exception.filter.spec.ts` |

---

- **[INFO]** `getStatusById` — 신규 공개 메서드, 충돌 없음
  - target 신규 식별자: `ExecutionsService.getStatusById(executionId: string): Promise<ExecutionStatus | null>`
  - 기존 사용처: 기존 코드베이스에 동일 이름의 메서드 없음. `HooksService.getActiveExecutionStatus`가 내부적으로 `executionsService['executionRepository']` 브래킷 접근으로 동일 동작을 수행하던 것을 캡슐화한 것
  - 상세: 이전에는 `HooksService`가 `this.executionsService['executionRepository']` private 브래킷 접근으로 `findOne`을 직접 호출했다. 이번 PR에서 공개 API `getStatusById`로 캡슐화했으며, `ExecutionsService`의 다른 메서드(`getActiveExecutions`, `getExecutionMap` 등)와 네이밍 충돌이 없다. `spec/5-system/` 영역의 어떤 문서도 이 이름을 다른 의미로 정의하지 않는다.
  - 제안: 없음. 도입 적합.

- **[INFO]** `extractClientIpFromHeaders` 반환형 변경 (`null` → `undefined`)
  - target 신규 식별자: `extractClientIpFromHeaders(...): string | undefined` (과거 `string | null`)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L104: `if (!ip) return true;` — falsy 검사, `undefined`와 `null` 동작 동일
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/hooks.service.ts` L152/L262: `const clientIp = extractClientIpFromHeaders(...)` → `sourceIp: clientIp` — `sourceIp?` 는 `string | undefined` 타입이므로 호환
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L350: `if (!ctx.clientIp || ...)` — falsy 검사, 호환
    - 구 코드의 `?? undefined` 패턴 두 곳이 이번 PR에서 제거됨(hooks.service.ts L149, L259)
  - 상세: 식별자 이름이 아닌 반환형의 변경이다. 모든 기존 소비처가 falsy 분기(`if (!ip)`)나 optional `sourceIp?`(`string | undefined`) 수신으로 처리하므로 런타임 동작 변경 없다. `extractClientIp(req)`(세션·감사 IP 경로)는 여전히 `string | null`을 반환하며 이번 변경 대상이 아니다 — spec/5-system/1-auth.md §2.3의 "두 함수는 의도적으로 반환형이 다르다" 설계 의도와 일치하고, 코드 JSDoc도 이를 명시한다.
  - 제안: 없음. 기존 소비처 전수 확인 완료, 충돌 없음.

- **[INFO]** `RESOURCE_CONFLICT` — 23505 unique 위반 → 409 자동 매핑 추가
  - target 신규 식별자: `GlobalExceptionFilter`의 `QueryFailedError` code 23505 → HTTP 409 / `RESOURCE_CONFLICT` 분기 (신규 분기)
  - 기존 사용처: `RESOURCE_CONFLICT`는 이미 기존에 정의된 에러 코드다.
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/common/filters/http-exception.filter.ts` L151: 409 → `RESOURCE_CONFLICT` 기존 매핑
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/main.ts` L70: Swagger 문서에 `RESOURCE_CONFLICT` 열거
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/auth.service.ts` 다수: 이미 `RESOURCE_CONFLICT`로 409 throw
  - 상세: 식별자 자체는 기존 코드베이스에 이미 존재하며 동일한 의미(409 리소스 충돌)로 사용 중이다. 이번 변경은 `QueryFailedError` 23505(PostgreSQL unique violation)도 동일 코드로 매핑하는 경로를 추가한 것으로, 의미 확장이지 충돌이 아니다.
  - 제안: 없음.

- **[INFO]** `STATE_MISMATCH` — 테스트 내 passthrough 코드, 기존 정의와 동일
  - target 신규 식별자: `http-exception.filter.spec.ts` 에서 `HttpException`의 nested body에 `code: 'STATE_MISMATCH'`를 주입해 filter가 그대로 통과시키는지 검증
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/execution-engine/workflow-errors.ts` L107: `STATE_MISMATCH` 409로 정의
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/external-interaction/interaction.service.ts` L372, L400: `STATE_MISMATCH` 사용
    - `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/auth.controller.ts` L589: `OAUTH_STATE_MISMATCH` (별개 코드, `STATE_MISMATCH`와 다름)
  - 상세: 테스트는 이미 존재하는 `STATE_MISMATCH` 에러 코드를 새로 정의하는 것이 아니라 filter의 nested body passthrough를 검증하는 데 사용한다. 의미 충돌 없음.
  - 제안: 없음.

---

## 요약

이번 PR (`webhook-maint-backlog-f14768`)은 spec 변경 없이 codebase 7개 파일만 수정했다. 도입되는 신규 식별자는 `ExecutionsService.getStatusById` 공개 메서드 하나이며, 기존 코드베이스 어디에도 동일 이름이 다른 의미로 사용되지 않는다. `extractClientIpFromHeaders`의 반환형 변경(`null` → `undefined`)은 모든 소비처가 falsy 분기를 사용하므로 런타임 충돌이 없고, 에러 코드 `RESOURCE_CONFLICT` · `STATE_MISMATCH`는 이미 기존 코드베이스에 동일 의미로 정의된 식별자다. 신규 식별자 충돌 관점에서 차단이 필요한 문제는 없다.

---

## 위험도

NONE
