# API 계약(API Contract) 리뷰

> 대상: webchat eager start (§R6) — channel-web-chat EiaClient·webhook payload 변경
> 생성일: 2026-06-06
> 세션: review/code/2026/06/06/12_47_01

---

## 발견사항

### [INFO] `EiaClient.startConversation` payload 타입에서 `firstMessage` 제거 — 하위 호환 확인됨
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` 시그니처
- **상세**: 클라이언트 측 TypeScript 타입에서 `firstMessage?: string` 필드가 제거되었다. 서버는 해당 필드를 선택적(optional)으로 처리하므로 기존 서버 API 계약에 대한 파손(breaking change)은 발생하지 않는다. 단, 이 `EiaClient` 클래스가 BYO-UI(채널 웹챗 외 다른 클라이언트)나 SDK 형태로 공유·배포되는 경우, 해당 소비자의 타입 컴파일이 깨질 수 있다.
- **제안**: 이전 리뷰(I14)에서 이미 확인됨. `EiaClient`가 채널 웹챗 내부 전용인지, 패키지/SDK 형태로 외부에 노출되는지 확인 권장. `packages/sdk` 등에 re-export 체인이 있다면 해당 소비자의 타입 충격 범위를 검토한다.

---

## 요약

이번 변경은 채널 웹챗 위젯의 **클라이언트 내부** 동작을 lazy 시작에서 eager 시작으로 전환한 것이다. 서버 측 API(`POST /api/hooks/:path`, `/api/external/executions/:id/interact` 등)의 엔드포인트 경로·HTTP 메서드·응답 스키마·에러 형식·HTTP 상태 코드는 변경 없이 유지된다. `firstMessage` 필드 제거는 클라이언트 TypeScript 타입 상의 변경이며 서버는 선택적 필드로 처리하므로 서버 API 계약 파손은 없다. 하위 호환성, 버전 관리, 응답/에러 형식, 요청 검증, URL/경로 설계, 페이지네이션, 인증/인가 모두 본 변경의 직접 영향 범위 밖이다.

---

## 위험도

NONE

이전 리뷰 세션(12_14_27)의 `api_contract` 에이전트가 동일하게 NONE / "서버 API 계약 유지, firstMessage 제거는 클라이언트 측 only"로 판정한 결론과 일치한다.
