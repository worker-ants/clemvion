# API 계약(API Contract) 리뷰 결과

## 발견사항

변경 대상은 프론트엔드 API 카탈로그 추출 리팩터(`lib/api/triggers.ts` 신설, `triggers/page.tsx` · `trigger-detail-drawer.tsx` 호출 위임)이며, 백엔드 엔드포인트 자체의 변경은 없다. API 계약 관점에서 검토한 결과는 아래와 같다.

### [INFO] `getById` 응답 정규화: `res.data.data ?? res.data` 이중 shape 허용

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `getById` 함수 (라인 1273–1284)
- 상세: `body?.data ?? body` 패턴으로 `{ data: { ... } }` 래핑 shape와 flat shape 양쪽을 모두 수용한다. 이는 backend 응답 일관성 이슈를 클라이언트가 흡수하는 형태다. 현재는 의도적 편차 흡수(주석에도 명시)이나, backend 응답이 한 형식으로 정규화되지 않는 상태가 장기 지속되면 계약 불명확성이 남는다.
- 제안: backend `GET /triggers/:id` 응답 shape를 spec에서 단일 형식으로 확정하고, 추후 리팩터 기회에 이중 분기를 제거하는 것을 권장한다. 현 변경 범위에서 즉시 수정 요구 수준은 아님.

### [INFO] `CreateTriggerBody.chatChannel` 타입이 `Record<string, unknown>`으로 느슨함

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `CreateTriggerBody` 인터페이스 (라인 1235–1243)
- 상세: `chatChannel` 필드가 `Record<string, unknown>`으로 선언되어 타입 안전성이 낮다. `TriggerUpdateBody.notification`, `TriggerUpdateBody.interaction`도 동일하게 느슨하다. backend DTO 계약이 코드 레벨에서 명시되지 않아, 잘못된 키·값이 runtime까지 전달될 수 있다.
- 제안: `ChatChannelConfigView` 또는 별도 `CreateChatChannelBody` 인터페이스를 chatChannel 필드 타입으로 사용하면 계약이 강화된다. 단, backend가 이미 400으로 차단하므로 계약 위반이 사용자에게 노출될 가능성은 낮다.

### [INFO] `TriggerListParams.type` / `status`가 `string`으로 느슨함

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `TriggerListParams` (라인 1227–1232)
- 상세: `type` 파라미터 허용값은 실제로 `"webhook" | "schedule" | "manual"` 세 값이고, `status`는 `"active" | "inactive"` 두 값이다. `string`으로 선언하면 잘못된 필터값이 API로 전송될 수 있다.
- 제안: union literal 타입으로 좁히면 호출부 컴파일 타임에 잘못된 값을 차단할 수 있다.

## 요약

이번 변경은 프론트엔드 컴포넌트 내부의 `apiClient` 직접 호출 11곳을 `triggersApi` typed 카탈로그로 위임하는 순수 리팩터다. 백엔드 엔드포인트·HTTP 메서드·URL 경로·인증/인가 게이트(RoleGate/useHasRole)는 그대로 보존되므로 하위 호환성 위반·breaking change는 없다. 페이지네이션(`normalizePagedResponse`)·에러 처리(toast)·요청 검증(client-side regex + backend 400 위임) 모두 이전 동작과 동일하게 유지된다. 타입 정의 수준에서 일부 필드가 느슨하게 선언된 점(INFO 3건)은 향후 계약 명확성 개선 기회이나 즉시 차단 수준은 아니다.

## 위험도

NONE
