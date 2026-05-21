---
status: complete
created: 2026-05-22
completed: 2026-05-22
owner: project-planner
priority: v1.x (격상)
worktree: chat-channel-spec-fix-5fc137
---

> 처리 결과: 우선순위 v2 → v1.x 격상하여 즉시 반영. spec/5-system/14-external-interaction-api.md §3.3.1 의 "v2 권고" 를 EIA-AU-09 정식 요구사항으로 격상. interaction.guard.ts 에 ExternalInteractionRequestContext / InternalInteractionRequestContext discriminated union + isInternalCtx narrowing helper 도입. interaction.service.ts refreshToken ctx 타입을 External 로 좁힘. hooks.service.ts 3개 in-process 호출 위치 (text_message / button_callback / submit_form) 를 InternalInteractionRequestContext 명시 타입으로 정리 (tokenFamily 제거 — Internal 에 없음). 기존 단위 테스트 fixture (`InteractionRequestContext` with tokenFamily) 는 External union branch 로 자동 추론되어 호환.


# Plan — EIA-AU-08 InteractionRequestContext union 타입 분리

## 배경

[EIA §3.3.1 Implementation Note](../../spec/5-system/14-external-interaction-api.md#331-implementation-note--in-process-trusted-caller-오염-방지-eia-au-08) 가 권고한 union 타입 분리:

```typescript
type InteractionRequestContext =
  | ExternalInteractionRequestContext  // HTTP guard, scope 없음
  | InternalInteractionRequestContext; // in-process, scope: 'in_process_trusted' 필수
```

현재 v1 은 `InteractionRequestContext { scope?: InteractionScope }` 단일 optional 필드 — invariant 가 컴파일러로 강제되지 않는다.

본 plan 은 v2 에서 union 분리 리팩토링을 추적한다.

## 범위

### Phase 1 — spec 갱신
- spec/5-system/14-external-interaction-api.md §3.3.1 권고를 v2 정식 요구사항으로 격상 (v1 단일 필드 유지 acceptable, v2 union 분리 의무)
- breaking change 영향 분석 — 외부 표면 변경 없음 (in-process only)

### Phase 2 — 타입 정의 도입
- `codebase/backend/src/modules/external-interaction/interaction.guard.ts` 의 `InteractionRequestContext` 를 union 으로 분리
- `InteractionService.interact(ctx)` 의 type narrowing 으로 `scope === 'in_process_trusted'` 분기 컴파일러 강제

### Phase 3 — 호출 위치 audit
- `grep -r "scope: 'in_process_trusted'" codebase/backend/src/` 결과를 lint rule 또는 audit 도구로 가시화
- HooksService / ChatChannelDispatcher 외 신규 호출자 도입 시 review 의무

## 의존 관계

- 관련 spec: spec/5-system/14-external-interaction-api.md §3.3 / §3.3.1
- 호출자: hooks.service.ts, chat-channel.dispatcher.ts
- breaking 영향 없음 (internal type only)

## Out of Scope

- HTTP 외부 API 호환성 (외부 표면 무변경)
- 다른 guard / DTO 의 일반화
