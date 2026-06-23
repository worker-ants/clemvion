# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `triggersApi` 객체가 모듈 레벨 상수로 선언됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `export const triggersApi = { ... }`
- 상세: `triggersApi`는 모듈 임포트 시점에 한 번 평가되는 객체 상수다. 내부 함수들은 모두 stateless 순수 async 함수이며 클로저를 통해 공유 상태를 캡처하지 않는다. `apiClient`는 이미 모듈 전역으로 공유되는 인스턴스이나 이 패턴은 기존 `executions.ts` 관례와 동일하다. 의도하지 않은 전역 상태 변경 없음.
- 제안: 해당 없음 (기존 관례와 일치).

### [INFO] `page.tsx` — `apiClient` import가 `/workflows` 직접 호출용으로 잔류
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `import { apiClient } from "@/lib/api/client"` (전체 파일 컨텍스트 line 152)
- 상세: trigger 관련 3개 호출(list/update/create)은 `triggersApi`로 이전됐으나, `workflows-list` 쿼리(`apiClient.get("/workflows")`)는 여전히 `apiClient`를 직접 사용한다. 이는 커밋 메시지에서 "workflows 도메인이라 잔류" 로 의도가 명시된 결정이다. 부작용 관점에서 문제없음.
- 제안: 해당 없음.

### [INFO] `getById` — workflow 중첩 필드 평탄화 시 `workflowId` 덮어쓰기 가능성
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `getById` 함수 내부 (라인 약 1279-1284)
- 상세: `{ ...raw, workflowName: ..., workflowId: ... }` 스프레드 후 덮어쓰기 패턴은 기존 drawer 컴포넌트에서 동일하게 사용되던 코드를 그대로 이전한 것이다. `raw.workflowId`가 이미 존재할 때 `raw.workflowId ?? raw.workflow?.id ?? ""`는 기존 값을 보존하므로 덮어쓰기 안전하다. 의도치 않은 상태 변경 없음.
- 제안: 해당 없음.

### [INFO] `trigger-detail-drawer.tsx` — `apiClient` import 완전 제거
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — diff 첫 hunk
- 상세: drawer에서 `apiClient` import가 `triggersApi` import로 교체됐다. 기존 8개 직접 호출이 모두 `triggersApi` 위임으로 이전됐으므로 잔류 직접 호출 없음. public surface(`TriggerDetailDrawer` 컴포넌트 시그니처·props)는 변경 없어 호출자(테스트 포함)에게 영향 없음.
- 제안: 해당 없음.

### [INFO] `rotateNotificationSecret` / `revokeInteractionToken` 반환값 처리 변경
- 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — diff hunk @@ -748 및 @@ -761
- 상세: 기존 코드는 `res.data.data.secret` / `res.data.data.token`을 직접 구조 분해했다. 신규 코드는 `triggersApi.rotateNotificationSecret`/`revokeInteractionToken`이 내부에서 동일 경로로 추출한 `{ secret }` / `{ token }`을 반환하므로 최종 값 동일. 호출자 `setRotateResult(secret)` / `setRevokeResult(token)` 할당 동작 보존됨.
- 제안: 해당 없음.

### [INFO] `CreateTriggerBody.chatChannel` 타입이 `Record<string, unknown>`으로 느슨함
- 위치: `codebase/frontend/src/lib/api/triggers.ts` — `CreateTriggerBody` 인터페이스
- 상세: `chatChannel` 필드가 `Record<string, unknown>`으로 선언돼 있어 타입 시스템이 잘못된 키 전송을 막지 못한다. 그러나 이는 부작용(런타임 상태 변경) 이슈가 아니라 타입 안전성 이슈다. 실제 전송 데이터는 `page.tsx` `createMutation`에서 명시적으로 구성하므로 런타임 동작은 기존과 동일하다.
- 제안: 필요 시 후속 단계에서 `ChatChannelInput` 전용 타입으로 강화 가능하나 현재 부작용 범주는 아님.

---

## 요약

이 변경은 순수한 리팩터링(Extract API Layer)이다. `apiClient` 직접 호출 11곳(drawer 8 + page 3)을 `lib/api/triggers.ts`의 `triggersApi` 카탈로그로 위임했으며, 각 함수는 stateless async 래퍼로 내부 또는 전역 상태를 변경하지 않는다. 공개 컴포넌트 시그니처(`TriggerDetailDrawer` props), React Query queryKey, mutation 성공/실패 콜백, toast 발생 조건, `queryClient.invalidateQueries` 호출 경로가 모두 동일하게 유지된다. `apiClient` import가 `page.tsx`에 workflows 호출 전용으로 잔류하는 것은 의도된 결정이며 부작용이 아니다. 환경 변수·파일시스템·이벤트 발생 변경 없음.

## 위험도

NONE
