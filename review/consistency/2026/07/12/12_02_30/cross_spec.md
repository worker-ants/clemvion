### 발견사항

없음 — Cross-Spec 충돌 미발견.

검토 근거:
- 실제 코드 변경(`origin/main` 대비)은 `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` →
  `embed-config-response.dto.ts` 파일명 rename + import 경로 갱신 + `spec/7-channel-web-chat/4-security.md`
  frontmatter `code:` 경로 1줄 갱신뿐이다(`git diff origin/main --stat` 확인). 클래스명(`EmbedConfigDto`)·엔드포인트·
  응답 shape·데이터 모델·상태 전이·RBAC 은 전부 무변경 — cross-spec 충돌을 유발할 표면적 자체가 없다.
- 구 파일명(`embed-config.dto.ts`) 참조는 `spec/**`·`codebase/**` 전체에서 잔존 0건(grep 확인) — dangling reference 없음.
- target(`spec/7-channel-web-chat/*.md` 6문서) 이 인용하는 타 영역 계약을 실제 SoT 문서와 대조 검증:
  - `Workspace.settings.interactionAllowedOrigins` — [`spec/1-data-model.md §2.2`](../../../../../spec/1-data-model.md) 에
    동일 키·의미(EIA `/api/external/*` CORS allowlist + 임베드 origin allowlist, 편집 `PATCH /api/workspaces/:id/settings`
    Admin+)로 정확히 정의됨. target 의 인용과 완전 일치.
  - 트리거 RBAC(이름변경/토글/삭제=`editor`+, 호출이력=`viewer`+) — [`spec/2-navigation/2-trigger-list.md §2.3.1·§4.1`](../../../../../spec/2-navigation/2-trigger-list.md)
    의 기존 트리거 RBAC 매트릭스와 정확히 일치(동일 API 재사용이므로 당연 정합).
  - EIA 참조(`EIA-RL-07` idle-wait reaper, `EIA-IN-02` cancel/end_conversation 명령셋, §5.4 `POST .../cancel`,
    §8.5 CORS) — [`spec/5-system/14-external-interaction-api.md`](../../../../../spec/5-system/14-external-interaction-api.md)
    원문과 대조해 문구·의미 일치 확인.
  - conversation-thread `source` 5값(`presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`) — target 의
    "→user/→assistant" 매핑이 [`spec/conventions/conversation-thread.md §1.1`](../../../../../spec/conventions/conversation-thread.md)
    의 backend enum 정의와 일치.
  - frontmatter `id:` 6개(`web-chat-architecture`/`web-chat-widget-app`/`web-chat-sdk`/`web-chat-auth-session`/
    `web-chat-security`/`web-chat-admin-console`) — `spec/**` 전역에서 중복 없음. `web-chat-security` 는 문서 자체가
    "`4-security` 슬러그 충돌 방지 목적으로 의도적으로 다름"이라 명시해 둔 상태.
  - `NAV-WC-01..06` 요구사항 ID — SoT 는 `spec/2-navigation/_product-overview.md` 단일 위치, target 문서는 참조만
    하고 재정의하지 않음(중복 정의 없음).

### 요약
검토 대상 변경은 DTO 파일명을 `spec/conventions/swagger.md §5-1` 컨벤션에 맞추는 순수 rename 이며 데이터 모델·API
계약·상태 머신·RBAC·요구사항 ID 어느 것도 건드리지 않는다. target spec 영역(`spec/7-channel-web-chat/**`) 이 인용하는
타 영역(데이터 모델의 `Workspace.settings`, 트리거 RBAC, EIA 명령/이벤트 계약, conversation-thread source enum,
요구사항 ID `NAV-WC-*`)과 실제 SoT 문서를 대조한 결과 모두 정합했고, frontmatter `id:` 도 전역 유일함을 확인했다.
Cross-Spec 관점에서 반영해야 할 충돌·중복·비일관성이 없다.

### 위험도
NONE
