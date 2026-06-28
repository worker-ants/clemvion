# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` 구현 완료 (diff-base: origin/main)
대상 변경 파일:
- `codebase/backend/src/modules/auth/utils/client-ip.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/common/filters/http-exception.filter.spec.ts`

---

## 발견사항

### [INFO] `extractClientIpFromHeaders` 반환형 변경 (`null` → `undefined`) — spec 에 반환형 미선언이라 충돌 없음

- target 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` — `extractClientIpFromHeaders` 반환형 `string | null` → `string | undefined`
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/spec/5-system/1-auth.md` §2.3·Rationale 2.3.B (클라이언트 IP 신뢰 정책)
- 상세: spec 은 `extractClientIpFromHeaders`(헤더 기반·폴백 없음) 의 존재와 호출 경로(webhook rate-limit·`ip_whitelist`)만 선언한다. 반환형(`null` vs `undefined`)은 스칼라 타입 세부 사항으로 spec 에 명시되지 않는다. 변경된 JSDoc 코멘트도 동일 의도("헤더에서 식별 불가 시 undefined 반환")를 기술한다. `extractClientIp(req)` (세션·감사 IP, `string | null` 유지)와 `extractClientIpFromHeaders` (webhook·ip_whitelist, `string | undefined` 변경)의 의도적 비대칭이 코드 주석에 명시돼 있고, spec §2.3 의 경로 분리 원칙(헤더 기반 vs req 기반)과 부합한다.
- 제안: 추가 조치 불필요. spec 내 함수 반환형 선언 부재이므로 충돌 없음.

---

### [INFO] `GlobalExceptionFilter` 의 `QueryFailedError(23505)` → `409 RESOURCE_CONFLICT` 매핑 — spec 에 필터 레이어 미서술이나 기존 정책과 의미 일치

- target 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (기존 코드, 이번 diff 는 spec 파일만 변경) + `http-exception.filter.spec.ts` (테스트 추가)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/spec/5-system/3-error-handling.md` §1.3 (`RESOURCE_CONFLICT` 409)
- 상세: spec §1.3 은 `RESOURCE_CONFLICT`(409)를 "리소스 충돌(이름 중복 등)"로 정의하며, 발행 주체를 서비스 레이어(`nodes.service.ts`, `workflow-versions.service.ts`)로 예시한다. 추가된 테스트는 `GlobalExceptionFilter` 가 race-window DB unique violation(`23505`)을 `RESOURCE_CONFLICT`(409)로 변환함을 검증한다. spec 에 필터 레이어 매핑 자체는 미서술이나, 이미 구현(`http-exception.filter.ts` 78-83행 `isUniqueViolation` 분기)에 해당 로직이 존재하며, spec §1.3 의 "리소스 충돌" 의미 범주와 일치한다. 테스트는 기존 구현의 회귀 보호이지 새 정책 도입이 아니다.
- 제안: spec §1.3 또는 Rationale 에 "race-window DB `23505` unique violation → `GlobalExceptionFilter` 가 `RESOURCE_CONFLICT`(409)로 필터 레이어 변환" 문장을 추가하면 동작 명세 완성도가 높아진다. 충돌은 아니므로 INFO 로 분류.

---

### [INFO] `ExecutionsService.getStatusById` 공개 API 신설 — spec 미서술이나 기존 SRP 원칙과 일치

- target 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `getStatusById(executionId)` 공개 메서드 추가
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/spec/5-system/15-chat-channel.md` §CCH-CV-03 ("`HooksService.getActiveExecutionStatus` 가 비-terminal status 를 반환")
- 상세: spec CCH-CV-03 은 `HooksService.getActiveExecutionStatus` 의 동작을 정의하지만, 내부 구현이 `executionsService['executionRepository']` private 브래킷 접근을 쓰는지 공개 `getStatusById`를 쓰는지까지 규정하지 않는다. 이번 변경은 private 브래킷 접근을 캡슐화된 공개 메서드로 교체하는 리팩토링이며 동작 의미는 동일하다. spec 에 계층 책임 충돌 없음.
- 제안: 추가 조치 불필요.

---

### [INFO] `hooks.service.ts` 의 `clientIp ?? undefined` 제거 — spec 2.3 B의 헤더 기반 IP 경로와 일치

- target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `extractClientIpFromHeaders(input.headers) ?? undefined` → `extractClientIpFromHeaders(input.headers)` (3곳)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/spec/5-system/1-auth.md` §2.3 · Rationale 2.3.B; `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/spec/1-data-model.md` §2.13 (`source_ip`)
- 상세: `extractClientIpFromHeaders` 반환형이 `string | undefined` 로 통일됨에 따라 호출부의 `?? undefined` null-coalescing 이 불필요해졌다. `sourceIp: clientIp` 는 `sourceIp: string | undefined` 슬롯에 그대로 대입된다. spec 은 `source_ip` 컬럼이 nullable임을 선언하고(`NULL 허용 (V096)`), 헤더 기반(`extractClientIpFromHeaders`)임을 명시한다. 의미·동작 변화 없음.
- 제안: 추가 조치 불필요.

---

## 요약

이번 diff(webhook-maint-backlog)는 `spec/5-system/` 영역과 cross-spec 충돌을 일으키는 변경이 없다. 핵심 변경 세 가지 — `extractClientIpFromHeaders` 반환형 `null→undefined` 통일, `GlobalExceptionFilter` unique violation 테스트 추가, `ExecutionsService.getStatusById` 공개 메서드 캡슐화 — 모두 기존 spec 정책(`auth.md §2.3` IP 경로 분리, `error-handling.md §1.3` RESOURCE_CONFLICT 의미, `chat-channel.md CCH-CV-03` 상태 판정 흐름)과 방향이 일치한다. spec 에 필터 레이어의 DB unique violation 변환 동작이 명시적으로 서술돼 있지 않다는 점은 spec 보완 여지로 INFO 등록했으나 충돌은 아니다.

## 위험도

NONE
