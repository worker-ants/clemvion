# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** `conversation-inspector.tsx` 의 lucide-react 임포트 블록 멀티라인 재포맷
  - 위치: 파일 2, diff hunk 1 (`-import { Loader2, Send, ... }` → `+import { Loader2, Send, ... Info, }` 멀티라인)
  - 상세: `Info` 아이콘 추가 자체는 `SystemDetail` 컴포넌트 구현에 필요한 변경이므로 기능적으로 정당하다. 그러나 기존 단일 라인 임포트를 멀티라인으로 재포맷한 것은 `Info` 추가를 위한 필요 최소 변경이 아닌 스타일 정리를 겸한 포맷팅 변경이다. 실질 변경(Info 추가)과 포맷팅 변경이 혼재되어 있으나, 해당 파일의 기존 코드 스타일(긴 임포트를 한 줄에 두지 않는 관행)을 맞추기 위한 의도적 선택으로 볼 여지도 있어 INFO로 분류한다.
  - 제안: 포맷팅 변경 자체가 가독성을 개선하므로 유지하되, 향후 리뷰 시 포맷팅과 기능 변경을 별도 커밋으로 분리하면 diff 추적이 용이해진다.

- **[INFO]** `review/consistency/2026/05/18/12_04_05/` 하위 파일 5종 + `_retry_state.json` 포함
  - 위치: 파일 11~18 (consistency 리뷰 산출물 전체)
  - 상세: 이 파일들은 이번 구현 착수 직전에 실행된 `/consistency-check` 산출물로, CLAUDE.md의 "developer는 구현 착수 직전에 `consistency-checker --impl-prep` 를 의무 호출" 규약에 따른 정상적인 부산물이다. 변경 범위 면에서 보면, 이 파일들은 실제 코드 변경(파일 1~8)과 직접 연관된 선행 검토 결과물이므로 같은 PR에 포함되는 것이 프로젝트 규약에 부합한다. 단, `_retry_state.json`은 orchestrator 내부 상태 파일로 리뷰 산출물이 아닌 일시적 운영 파일이다.
  - 제안: `_retry_state.json`은 리뷰 완료 후 `.gitignore` 처리 또는 리뷰 산출물 정리 시점에 제거 검토.

- **[INFO]** `plan/in-progress/ai-thread-source-mark.md` frontmatter의 `worktree` 필드 수정
  - 위치: 파일 9
  - 상세: 해당 plan의 Phase 2/3 흡수 이관을 기록하는 필드 갱신이다. 단순한 이관 메모이며, 본 PR의 코드 변경과 직접 연결된 plan 관리 작업으로 정상 범위이다. 내용적으로도 이 PR이 ai-thread-source-mark의 frontend Phase를 흡수하는 것을 명시하므로 추적성 확보 목적이 명확하다.
  - 제안: 변경 불필요.

- **[INFO]** `SummaryView` 내 `content: m.content` → `content: stripInlineMarkers(m.content)` 두 군데 적용 (파일 2, diff hunk 3·4)
  - 위치: 파일 2, `SummaryView` 함수 내 user/assistant 콘텐츠 처리 경로
  - 상세: `stripInlineMarkers`를 `SummaryView` 안에서도 적용한 것이 spec §9.5 호환 목적이므로 이번 작업 범위(presentation_user 렌더링 + 인라인 마커 제거)에 포함된다. 그러나 이 경로는 emit messages fallback 경로이며, 1차 소스를 `conversationThread.turns`로 교체한 이후 대부분의 경우 이 경로가 호출되지 않는다. spec §9.5 명시 대로 best-effort strip이므로 의도적으로 포함된 변경임은 확인된다.
  - 제안: 변경 불필요. fallback 경로에도 strip을 적용한 것은 방어적 처리로 적절하다.

## 요약

변경 범위 전반은 spec/conventions/conversation-thread.md §9 (source별 시각 분기 렌더링)과 §9.5 (인라인 마커 제거)를 구현하는 단일 목적에 충실하다. 신규 타입(`ConversationTurn`, `ConversationTurnSource`), 변환 함수(`threadTurnsToConversationItems`, `stripInlineMarkers`), 렌더 컴포넌트(`PresentationDetail`, `SystemDetail`, `PresentationCardBody`), i18n 키 추가, WebSocket 이벤트 처리 경로 교체, 스토어 타입 확장이 모두 spec §9 구현을 위한 직접적인 변경이다. 불필요한 리팩토링이나 무관한 파일 수정은 식별되지 않았으며, 임포트 재포맷 1건과 일시적 운영 파일(`_retry_state.json`) 포함이 INFO 수준으로 발견되었다. consistency 리뷰 산출물(파일 11~18)은 프로젝트 규약에 따른 정상 부산물이다.

## 위험도

NONE
