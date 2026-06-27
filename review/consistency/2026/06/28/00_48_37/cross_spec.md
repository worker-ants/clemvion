# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/` (전 6문서)
검토 기준 브랜치: `main`

---

## 발견사항

### 발견사항 없음 (CRITICAL/WARNING 0건)

이번 변경 세트에서 다른 `spec/**` 영역과의 직접 모순 또는 잠재 충돌은 발견되지 않았다. 아래는 검토 과정에서 확인된 정합 항목 및 INFO 수준 사항이다.

---

### [INFO] `sessionStorage` 결정이 1-data-model / 5-system 과 무관 — 격리 완전
- target 위치: `spec/7-channel-web-chat/3-auth-session.md §R6`(신규 추가) + `1-widget-app.md §3.1` + `2-sdk.md §3` + `4-security.md §1 보안 정책 표`
- 충돌 대상: `spec/1-data-model.md §2.2 Workspace.settings`, `spec/5-system/14-external-interaction-api.md §8.3·EIA-AU-04`
- 상세: `spec/3-auth-session.md` 가 "iframe-origin storage" 에서 "sessionStorage" 로 구체화되고 R6 Rationale 이 신설됐다. 기존 EIA §EIA-AU-04 는 "execution 종료 시 토큰 invalidate"를 정의하며 클라이언트 저장 방식을 규정하지 않는다. `1-data-model.md` 의 `Workspace.settings.interactionAllowedOrigins` 정의도 저장 방식과 무관하다. 다른 영역(`spec/2-navigation/9-user-profile.md`, `spec/3-workflow-editor/3-execution.md`)의 `localStorage` 사용은 별개 도메인(워크스페이스 선택, 에디터 UI 상태)이므로 충돌이 없다.
- 제안: 현 상태 유지. 다른 영역에 동기화 불필요.

### [INFO] `execution.end_conversation` SSE 이벤트 — `TERMINAL_EVENTS` 미포함 (의도 확인됨)
- target 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1` 및 구현 `use-widget.ts:61-65 TERMINAL_EVENTS`
- 충돌 대상: `spec/5-system/14-external-interaction-api.md §5.2·EIA-IN-03·표 §6.2`
- 상세: EIA §5.2 / EIA-IN-03 은 terminal 이벤트를 `execution.completed` / `execution.failed` / `execution.cancelled` 세 가지로 명시한다. `execution.end_conversation` (EIA §5.2 표 Line 870)은 `end_conversation` 명령 완료 확인 이벤트이며 terminal 이벤트가 아니다 — 이후 `execution.completed`/`failed`/`cancelled` 가 따라온다. 위젯의 `TERMINAL_EVENTS`(3항목)는 EIA 정의와 정확히 일치한다. 충돌 없음; 단 이 점이 팀 내 명시적으로 문서화되지 않아 오해 여지가 있다.
- 제안: 문서 명시 불필요(EIA §EIA-IN-03 이 SoT). 이해 보조가 필요하면 `1-widget-app.md §3.1` 에 주석 1줄 추가 가능 — 비차단.

### [INFO] `use-widget.ts` code 참조가 `3-auth-session.md` frontmatter 에만 — `4-security.md` 미포함
- target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 목록
- 충돌 대상: `spec/7-channel-web-chat/3-auth-session.md` frontmatter
- 상세: `3-auth-session.md` frontmatter 에 `codebase/channel-web-chat/src/widget/use-widget.ts` 가 포함돼 있고, `4-security.md` frontmatter 에는 `host-bridge.ts`·`safe-html.ts` 등이 있지만 `use-widget.ts` 는 없다. `use-widget.ts` 는 `isEmbedAllowed()` (4-security §3-①)를 직접 구현하므로 `4-security.md` 가 SoT 인 임베드 soft 검증의 코드 증거이기도 하다. 두 spec 이 동일 파일을 각자 다른 관점으로 참조하는 것은 허용되나(3-auth-session 은 세션 흐름 SoT, 4-security 는 검증 정책 SoT), 현재는 `4-security.md` frontmatter 에 누락.
- 제안: `4-security.md` frontmatter `code:` 목록에 `codebase/channel-web-chat/src/widget/use-widget.ts` 추가 — spec-impl-evidence 동기화 권장. 비차단.

---

## 요약

`spec/7-channel-web-chat/` 6문서 전체와 `codebase/channel-web-chat/src/widget/use-widget.ts` 분할 구현을 다른 `spec/**` 영역(data-model, EIA, webhook, RBAC, 시스템 아키텍처, navigation)과 교차 검토한 결과, CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. 데이터 모델(`Workspace.settings.interactionAllowedOrigins`)·API 계약(EIA endpoint·terminal 이벤트 정의)·RBAC(`viewer`+/`editor`+ — Trigger 규약과 일치)·계층 책임(위젯 = EIA client-side consumer, 신규 백엔드 facade 없음) 모두 기존 spec과 정합한다. 이번 변경의 핵심인 `sessionStorage` 구체화는 클라이언트 측 impl 결정이며 다른 영역에 영향을 주지 않는다. INFO 2건(terminal 이벤트 이해 보조 가능, `4-security.md` frontmatter 동기화 권장)은 비차단이다.

## 위험도

NONE
