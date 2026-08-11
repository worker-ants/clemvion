# 신규 식별자 충돌 검토 — `spec/7-channel-web-chat/2-sdk.md`

## 스코프 확인

target 으로 전달된 본문은 `spec/7-channel-web-chat/2-sdk.md` 의 **현재 working-tree 전체 본문**이지만,
`git diff origin/main -- spec/7-channel-web-chat/2-sdk.md spec/7-channel-web-chat/3-auth-session.md` 로
실측한 결과 이 세션이 실제로 도입하는 변경분은 다음 두 파일의 **frontmatter `code:` 목록 + 인라인 주석**뿐이다:

- `2-sdk.md`: `code:` 에 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 추가 + 세 파일
  역할을 설명하는 주석 블록 추가.
- `3-auth-session.md`: 동일 경로 추가 + 설명 주석 1줄.

본문(Overview, §1~§5, Rationale)은 `origin/main` 과 **바이트 단위로 동일**하다 — 문서가 새로 도입하는
요구사항 ID·엔티티·endpoint·이벤트·ENV·spec 파일 경로는 없다. 이는 `plan/in-progress/spec-update-webchat-evidence-pointers.md`
의 "지금 고친다" 결정(체크리스트 전항 `[x]`)을 그대로 반영한 diff다 — evidence pointer 정정이 목적이고
신규 제품 표면 도입이 아니다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음. frontmatter `id: web-chat-sdk` 도 기존값 그대로(변경 없음),
   저장소 전체에서 유일하게 이 문서만 사용 — 충돌 없음.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. diff 에 추가된 것은 코드 심볼명(`beginBootAttempt`/
   `cannotApplyConfig`/`isAttemptStale`/`applyConfig`)을 **가리키는 frontmatter 주석**뿐이며, 이 심볼들은
   이미 코드베이스(`use-session-generations.ts`, `use-widget.ts`)에 존재하는 기존 함수다. 새로 명명된 것이 없다.
3. **API endpoint 충돌** — 없음. diff 대상 라인에 endpoint 정의 없음.
4. **이벤트/메시지명 충돌** — 없음. `wc:*` 이벤트 namespace 는 기존 그대로이며 diff 범위 밖.
5. **환경변수·설정키 충돌** — 없음.
6. **파일 경로 충돌** — 추가된 경로 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 는
   실측(`ls`) 결과 실제로 존재하는 기존 코드 파일이다(2026-07-24 1차 slice 커밋에서 이미 생성됨,
   `plan/in-progress/webchat-usewidget-extraction.md` §1차 slice 참고). `3-auth-session.md` 의 기존
   `code:` 목록에도 동일 경로가 이미 없었을 뿐 — 이번 추가로 두 문서가 같은 코드 파일을 **증거로 공유**하게
   되는데, 이는 정확히 spec-code-paths 검사가 "1개 이상 매치" 만 보고 정본 이동을 못 따라가는 문제를 고치려는
   의도된 조치이지 경로 명명 충돌이 아니다. 신규 spec 파일 경로 생성도 없다(기존 두 문서만 편집).

## 보조 스윗 (전체 본문 기준, 참고용)

diff 범위 밖이지만 전체 문서에 등장하는 주요 식별자도 저장소 전역에서 재확인했다 — 전부 기존에 확립된
동일 의미 재사용이며 충돌 없음:

- `ChatInstance`, `BootConfig` — `1-widget-app.md`/`5-admin-console.md`/`_product-overview.md` 등에서
  동일 의미로 일관 참조(교차 문서 정합, 충돌 아님).
- `data-global` — `2-sdk.md` 내부에서만 등장, 다른 spec 문서에 동명 키 없음.
- `WebChatIdleReaperService` — EIA·data-flow·1-widget-app·3-auth-session 에서 동일 의미로 cross-ref, 충돌 없음.
- `conversationEnded.data.reason` 값(`user_ended`/`gone`) — 다른 spec 문서에서 재정의된 동명 enum 없음.

## 요약

이번 target 변경은 두 spec 문서의 frontmatter `code:` 증거 경로에 기존 코드 파일 하나를 추가하고 설명 주석을
보강하는 것이 전부다 — 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중
어느 것도 새로 도입되지 않았다. 추가된 코드 경로는 실존 파일이며 명명 충돌·의미 중복이 없다. 전체 본문 기준
보조 스윗에서도 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
