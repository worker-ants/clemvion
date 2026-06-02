---
worktree: fix-duplicate-user-bubble
branch: worktree-fix-duplicate-user-bubble
status: in-progress
---

# AI Agent chat user 발화 버블 중복 표시 버그 수정

## 증상
AI Agent 멀티턴 chat 미리보기에서 메시지 1개를 입력하면, AI 응답 생성 중에는
User 버블이 2개로 표시되다가, 응답 완료 후 1개로 합쳐진다. (왼쪽 노드 트리도 동일)

## Root cause
user 발화 optimistic 버블이 두 경로로 append되며 dedup 키가 절대 일치하지 않음:
- ① 로컬 전송 optimistic: `use-execution-interaction-commands.ts` `sendMessage`
  → `addConversationMessage`, timestamp = 클라이언트 `new Date().toISOString()` (기존부터 존재)
- ② WS echo: `use-execution-events.ts` `handleUserMessage` (`execution.user_message`)
  → `appendOptimisticUserMessage`, timestamp = 서버 `receivedAt` (#407에서 도입)

`appendOptimisticUserMessage`의 dedup은 `i.timestamp === receivedAt`만 검사 →
①의 클라이언트 timestamp와 절대 매칭 안 됨 → 두 버블. turn 종료 `ai_message`
REPLACE가 권위 스냅샷으로 1개로 reconcile (= 합쳐짐).

#407은 "채널 인바운드 조기 노출" 의도였으나 엔진이 `submit_message`(에디터
프리뷰 직접 입력)에도 echo를 emit하면서 기존 로컬 optimistic과 충돌 → 회귀.

## Fix (Option B — reconcile)
발신자 즉시 피드백(로컬 optimistic) 보존 + echo가 로컬 버블과 reconcile:
- `ConversationItem.optimisticPending?: boolean` 추가 (execution-store.ts)
- `sendMessage`가 optimistic user item에 `optimisticPending: true` set
- `appendOptimisticUserMessage`가 같은 content의 `optimisticPending` user item을
  찾으면 append 대신 reconcile (receivedAt 스탬프 + flag clear). 없으면(관찰자/
  채널) 기존대로 append.
- ai_message REPLACE는 snapshot에서 재구성하므로 flag 자연 소멸.

spec §9.7은 frontend 구현 식별자를 본문에 노출하지 않는 방침 → spec 변경 불필요.
관찰 가능 계약(reconcile된 단일 버블)은 그대로.

## 체크리스트
- [x] 사전 일관성 (naming collision 자가 점검 — optimisticPending 충돌 없음 확인)
- [x] 테스트 선작성 (store reconcile 3건 + sendMessage flag)
- [x] 구현 (execution-store.ts, use-execution-interaction-commands.ts)
- [x] lint (frontend 0 errors) / unit (176 파일·3266 통과) / build (frontend 통과)
- [ ] e2e (면제 판단 — 화이트리스트 확인 필요)
- [ ] /ai-review + SUMMARY
- [ ] Critical/Warning fix (있으면)
