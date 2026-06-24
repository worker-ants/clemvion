# Plan 정합성 검토 결과

검토 모드: --impl-done (scope=spec/2-navigation/, diff-base=origin/main)

---

## 발견사항

### [INFO] `spec/2-navigation/10-auth-flow.md` — `/_widget` proxy 제외 경로 추가
- **target 위치**: `spec/2-navigation/10-auth-flow.md §7.1` 라우트 가드 계층 표, 1번 계층 "서버 proxy" 설명
- **관련 plan**: `plan/in-progress/spec-draft-web-chat-console.md` — 웹채팅 운영 콘솔 spec draft
- **상세**: 이번 worktree(`webchat-console-95fe1e`)가 origin/main 대비 유일하게 변경한 `spec/2-navigation/` 파일이 `10-auth-flow.md` 하나다. 변경 내용은 proxy.ts 에서 제외하는 public 경로 목록에 `` `/_widget`(동봉 웹채팅 위젯 정적 번들 — [7-channel-web-chat/0-architecture §4.1]) `` 를 추가한 것이다. 이 변경은 `spec-draft-web-chat-console.md §1.5` 의 "위젯 co-deploy + same-origin 미리보기" 결정(위젯 번들을 `/_widget/web-chat/v1/` 경로로 프론트엔드에 동봉)과 직접 연관된다. 해당 plan 은 `status: draft` 이고 spec 반영은 이미 완료(`5-admin-console.md` 신설, `_product-overview.md` 갱신, `_layout.md` 갱신)된 상태다. auth-flow.md 의 이 수정도 동일 webchat-console 범위의 spec 정합 작업이다.
- **제안**: `spec-draft-web-chat-console.md` 는 status: draft 로 in-progress 에 남아 있으나, 본 변경이 plan 의 어느 체크리스트 항목에 해당하는지 명시되어 있지 않다. 해당 plan 의 "반영할 spec 변경" 목록(§2.1~§2.3)에 `10-auth-flow.md §7.1 proxy 제외 경로 갱신` 을 기록하거나, plan 이 완료 이동 대상이라면 `plan/complete/` 로 옮기면서 체크박스에 완료 표시를 추가하는 것을 권장. 미해결 결정이나 선행 plan 미해소와는 무관하므로 추적 메모 수준.

---

## 추가 맥락 (plan 범위 전체 스캔)

target `spec/2-navigation/` 내 다른 문서들(0-dashboard, 1-workflow-list, 14-execution-history 등)은 이 worktree 에서 변경되지 않았다(diff 없음). 따라서 아래 in-progress plan 들과의 충돌 여부를 확인했다:

1. **`spec-sync-workflow-list-gaps.md`** — `spec/2-navigation/1-workflow-list.md` 의 미구현 항목(태그 필터 UI, 폴더 필터 UI, 빈 상태 마켓플레이스 링크)을 추적. target 은 이 문서를 변경하지 않으므로 충돌 없음.
2. **`spec-sync-user-profile-gaps.md`** — `spec/2-navigation/9-user-profile.md` 추적. target 변경 없음, 충돌 없음.
3. **`spec-sync-structural-followups.md` §B** — `data-flow/9-observability` cross-ref, `/docs` 단일언어 cross-ref 점검 등. target 변경 없음, 충돌 없음.
4. **`ai-agent-tool-connection-rewrite.md`** — `spec/4-nodes/3-ai/1-ai-agent.md` 관련, `spec/2-navigation/` 미포함. 충돌 없음.
5. **`spec-draft-web-chat-console.md`** — `spec/2-navigation/_layout.md` 포함이나 이번 target 범위에 `_layout.md` 변경 없음. auth-flow.md 변경만 있음 — INFO 항목으로 기록.

---

## 요약

target `spec/2-navigation/` 에서 실제로 변경된 파일은 `10-auth-flow.md` 하나이며, 변경 내용은 proxy.ts 의 공개 경로 제외 목록에 `/_widget` 경로를 추가한 단일 라인 수정이다. 이 수정은 진행 중인 `spec-draft-web-chat-console.md` 의 위젯 co-deploy 결정과 정합하며, 미해결 결정과의 충돌이나 선행 plan 미해소는 발견되지 않는다. 다만 해당 plan 의 spec 변경 체크리스트에 이 auth-flow.md 수정이 명시적으로 포함되지 않아 추적 누락 가능성이 있으므로 INFO 등급으로 기록한다.

## 위험도

NONE
