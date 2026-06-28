# Testing Review

## 발견사항

### [WARNING] `ExecutionsService.getStatusById` 자체 단위 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/executions/executions.service.ts` — `getStatusById` 메서드 (추가된 코드 696-701 라인)
- 상세: 이번 변경에서 추가된 `getStatusById`는 `executions.service.spec.ts` 에 직접 단위 테스트가 없다. 52개 기존 테스트 중 `getStatusById`를 직접 호출하는 케이스가 0건이다. `hooks.service.spec.ts`의 mock 위임 패턴을 통해 간접 검증되지만, (1) DB 조회 성공 시 `row.status` 반환, (2) `findOne`이 null 반환 시 null 반환, (3) `findOne`이 예외 throw 시 `.catch(() => null)`로 null 흡수하는 세 경로가 `ExecutionsService` 단위에서 직접 검증되지 않는다.
- 제안: `executions.service.spec.ts`에 `getStatusById` 전용 describe 블록 추가 — 정상 조회, null 반환(미존재), DB 예외 흡수 세 케이스 최소 커버.

### [WARNING] `hooks.service.spec.ts` mock 의 `getStatusById` 구현이 실제 공개 API와 시그니처 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/hooks.service.spec.ts` — `useValue` 내 `getStatusById` jest.fn (라인 102-109)
- 상세: mock `getStatusById`는 `executionRepository.findOne()`을 인자 없이 호출하는 반면, 실제 `getStatusById(executionId)` 구현은 `findOne({ where: { id: executionId }, select: ['id', 'status'] })`로 호출한다. `findOne()`은 mock에서 항상 `mockResolvedValue(null)` 기본값을 반환하므로 동작상 회귀는 없지만, mock이 `executionId`를 인자로 전달받아 `findOne`에 위임하지 않아 "올바른 execution을 조회하는지" 단언이 불가능하다. 테스트가 동작을 오도(mislead)할 여지가 있다.
- 제안: mock `getStatusById`가 `executionId` 인자를 받아서 `executionRepository.findOne({ where: { id: executionId } })`로 위임하도록 수정하거나, 또는 mock을 `jest.fn().mockImplementation(...)`으로 명시해 실제 호출 인자를 단언할 수 있게 개선한다.

### [WARNING] `extractClientIp`(full-request 버전)가 `string | null`을 유지하면서 호출부에 `?? undefined` 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/auth.controller.ts` 라인 314, 352 / `webauthn.controller.ts` 라인 152, 349
- 상세: 이번 변경은 `extractClientIpFromHeaders`를 `string | null → string | undefined`로 통일했으나, `extractClientIp(req): string | null`는 여전히 `null`을 반환한다. 소비처(auth.controller, webauthn.controller)에서 `extractClientIp(req) ?? undefined` 패턴이 그대로 남아 있다. `extractClientIpFromHeaders`의 `undefined` 통일 목적이 "`?? undefined` 제거"였다면, `extractClientIp`도 같은 반환형으로 통일하거나 소비처 변환 코드를 제거해야 일관성이 완성된다. 테스트에서 `extractClientIp`의 `null` 반환 경로(`모든 소스가 비어 있으면 null 반환`) 단언은 `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` 라인 185에서 `toBeNull()`로 유지 중인데, `extractClientIpFromHeaders`와 반환형이 달라 두 함수 사이의 계약 불일치가 테스트에서도 명시적으로 드러나지 않는다.
- 제안: `extractClientIp`도 `string | undefined`로 통일하거나, 최소한 `client-ip.spec.ts`에 "두 함수의 반환형이 의도적으로 다르다"는 주석을 추가해 혼란을 방지한다.

### [INFO] `http-exception.filter.spec.ts` — `QueryFailedError` 외 다른 TypeORM 오류 코드 테스트 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/common/filters/http-exception.filter.spec.ts` — 추가된 23505 테스트 케이스
- 상세: 고유키 위반(23505)만 테스트하고, PostgreSQL FK 위반(23503), NULL 제약(23502), 기타 QueryFailedError(예: 23000 일반 정합성 오류)는 필터가 어떻게 처리하는지 테스트가 없다. 23505 외 코드에 대해 필터가 500 INTERNAL_ERROR로 처리하는지, 아니면 다른 매핑이 있는지 알 수 없다.
- 제안: 최소한 23505가 아닌 `QueryFailedError`(예: code='23503')가 500 INTERNAL_ERROR로 처리되는지 회귀 케이스 추가.

### [INFO] `hooks.service.spec.ts` — mock 내 IIFE(즉시 실행 함수)로 `executionRepository`를 클로저 캡처하는 패턴이 테스트 격리를 약화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/hooks.service.spec.ts` 라인 118-133
- 상세: `ExecutionsService` 제공자를 IIFE로 생성해 `executionRepository`와 `getStatusById`를 클로저로 연결한다. `executionRepository.findOne`은 `beforeEach`에서 module을 재컴파일하면 새 mock이 생성되어 격리되지만, `getStatusById` 내부의 `executionRepository`가 IIFE 내 클로저 참조이므로 `moduleRef.get(ExecutionsService).executionRepository`와 동일 참조임을 사람이 추적해야 한다. 기존 `execRepo` 취득 패턴(라인 2346, 2481 등의 `moduleRef.get(ExecutionsService).executionRepository`)과 실제 mock 연결이 암묵적 클로저 의존이어서 가독성이 낮다.
- 제안: IIFE 대신 `executionRepository`를 별도 변수로 선언하고 `useValue`에 직접 할당하는 방식이 더 명확하다. 또는 `getStatusById`를 단순 `jest.fn().mockResolvedValue(null)` 기본값으로 두고 테스트별로 `mockResolvedValueOnce`를 사용하면 클로저 복잡성을 제거할 수 있다.

### [INFO] `http-exception.filter.spec.ts` — 중첩 `error` 봉투 테스트에서 `requestId` 검증만 있고 `details` 없는 경우 미검증
- 위치: `http-exception.filter.spec.ts` — "recognizes nested error envelope" 테스트 (라인 68-91)
- 상세: 중첩 봉투에 `details` 배열이 있을 때만 테스트한다. `details`가 없는 중첩 봉투(`{ error: { code, message } }`)가 올바르게 처리되는지, 또한 중첩 봉투의 `code`/`message`가 없을 때 fallback 처리가 어떻게 되는지 테스트가 없다.
- 제안: `details` 없는 중첩 봉투 케이스 추가 (커버리지는 낮지만 API 계약 완전성 관점에서 유용).

### [INFO] `client-ip.spec.ts` — `extractClientIp` 함수의 IPv6 순수 주소(non-mapped) 처리 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/utils/client-ip.spec.ts`
- 상세: `::ffff:1.2.3.4`(mapped) 정규화는 테스트하지만, `2001:db8::1` 같은 순수 IPv6 주소가 normalize 함수에서 변환 없이 통과하는지 테스트가 없다. 현재 구현은 통과하지만 테스트로 보장되지 않는다.
- 제안: 순수 IPv6 주소가 그대로 반환됨을 단언하는 케이스 추가.

## 요약

핵심 변경(private repo 브래킷 접근 → `getStatusById` 공개 API 캡슐화, `extractClientIpFromHeaders` null→undefined 반환형 통일)은 방향이 옳고 테스트 커버리지도 전반적으로 잘 갖추어져 있다. 그러나 `getStatusById` 자체에 대한 `ExecutionsService` 단위 테스트가 완전히 누락되어 세 가지 DB 경로(정상·null·예외 흡수)가 직접 검증되지 않으며, hooks.service.spec의 mock `getStatusById` 구현이 실제 메서드와 인자 위임 측면에서 불일치해 테스트가 오도적 구조를 가진다. 또한 `extractClientIp`(full-req 버전)가 여전히 `null`을 반환하면서 `extractClientIpFromHeaders`와 반환형이 달라 소비처 `?? undefined` 잔류 패턴이 제거되지 않는 불완전한 통일이 눈에 띈다.

## 위험도
MEDIUM
