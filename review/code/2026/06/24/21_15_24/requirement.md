# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** `useUpdateWebChatMeta` — 빈 바디 PATCH 엣지 케이스 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/use-web-chat.ts` L199–202
- 상세: `name`·`isActive` 둘 다 `undefined`인 채로 `mutateAsync({ instanceId })` 를 호출하면 빈 `{}` 바디로 PATCH 가 전송된다. 서버가 빈 바디를 idempotent 로 처리하면 문제 없지만, 이 경로가 테스트 커버리지에 없다. spec §2.1 표는 이름 변경과 활성 토글을 별도 행으로 정의했고 "동시 전달" 케이스도 테스트에 추가됐으나 아무 필드도 없는 케이스는 다루지 않는다. 실운용 코드 경로(호출 측)는 항상 name 또는 isActive 를 포함하므로 현재 기능 버그는 아니지만, 인터페이스 계약으로 인지해 두는 것이 좋다.
- 제안: 낮은 우선순위. 필요시 "빈 바디 PATCH 는 서버 에러를 내지 않는다"는 테스트를 추가하거나, TypeScript 레벨에서 `name | isActive 중 하나 이상 필수` 제약을 `UpdateWebChatMetaInput` 에 추가할 수 있다.

### **[INFO]** 테스트 공유 wrapper — `mutations.retry` 미명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts` L27
- 상세: 공유 `wrapper` 의 `defaultOptions` 에 `queries: { retry: false }` 만 있고 `mutations: { retry: 0 }` 는 명시되지 않았다. TanStack Query v5(`^5.95.2`) 뮤테이션은 기본값 `retry: 0` 이므로 실제 동작에는 영향 없다. 그러나 공유 `wrapper` 와 두 개의 `customWrapper`(L111, L220) 모두 동일하게 queries-only 명시이므로 의도가 불명확하게 읽힐 수 있다.
- 제안: 무시해도 무방. 문서 목적이라면 `mutations: { retry: 0 }` 를 병기해 명시성을 높일 수 있다.

### **[INFO]** `[SPEC-DRIFT]` spec §2.1 — `useUpdateWebChatMeta` onError 미처리 근거 미기재
- 위치: spec `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-console-mgmt/spec/7-channel-web-chat/5-admin-console.md` §2.1 표
- 상세: 코드(`use-web-chat.ts` L191–193)와 테스트(L326 새 케이스)에 "PATCH 실패 시 서버 미변경 → stale 아님 → onError invalidate 불필요" 근거가 추가됐다. 이는 합리적이고 의도적인 설계 선택이며 코드가 옳다. 그러나 spec §2.1 이름 변경·활성 토글 행에는 onError 처리 정책이 명시되어 있지 않다. 코드 버그가 아니라 spec 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. spec §2.1 표의 이름 변경/활성 토글 행 "비고" 셀, 또는 §2.1 아래 별도 불릿으로 "PATCH 실패 시 onError invalidate 불필요 — 서버 미변경으로 stale 발생 없음(onSuccess 만 invalidate)" 을 추가.

### **[INFO]** `[SPEC-DRIFT]` spec §2.1 — `useUpdateWebChatMeta` 이름·활성 동시 PATCH 미언급
- 위치: spec §2.1 표 (이름 변경 행: `{ name }`, 활성 토글 행: `{ isActive }` 각각 별도 행)
- 상세: `useUpdateWebChatMeta` 는 `{ name, isActive }` 동시 전달도 지원하며, 테스트(L267–283)가 이 경로를 명시적으로 검증한다. 코드 구현이 더 범용적이고 의도적이다. spec §2.1 표는 단일 필드 경로만 예시로 들어 동시 PATCH 가 허용되는지 모호하다.
- 제안: 코드 유지 + spec 반영. spec §2.1 이름 변경 행 비고에 "name·isActive 동시 전달도 허용(부분 바디 — 지정 필드만 반영)" 을 추가.

---

## 요약

이번 변경의 핵심인 `useUpdateWebChatMeta` onError JSDoc 추가(파일 2), 해당 reject 테스트 케이스(파일 1), 내부 함수명 `Inner → WebChatRenameDialogInner` 리팩터(파일 3), user-guide §6 인스턴스 관리 절 신규 추가(파일 4·5)는 모두 기능 완전성을 충족한다. spec §2.1 과 코드 구현 사이에서 코드가 틀린 불일치는 발견되지 않았다. `ImplAnchor` 심볼(`WebChatRenameDialog`, `TriggerHistoryDialog`, `TriggerDeleteDialog`)은 page.tsx 에서 실제 사용·임포트되며 파일 경로도 정확하다. user-guide 텍스트(더보기 메뉴 흐름, 삭제 불복구 경고, 권한 editor+ 명시)는 spec §2.1 행위 명세와 일치한다. 지적 사항은 전부 INFO 수준이며, 그중 두 건은 spec 이 코드를 따라잡지 못한 SPEC-DRIFT 이다.

## 위험도

NONE
