# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat` (impl-done)

## 검토 방법
target 6개 문서(`0-architecture.md`~`5-admin-console.md`, `_product-overview.md`)가 인용하는 타 영역 spec 을 실제
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/happy-tesla-906461/spec/**`)에서 직접 대조했다 — EIA
(`5-system/14-external-interaction-api.md`), Webhook(`5-system/12-webhook.md`), Execution Engine
(`5-system/4-execution-engine.md`), Conversation Thread convention, Interaction Type Registry convention,
`1-data-model.md`(Trigger/Workspace), `2-navigation/9-user-profile.md`(RBAC 매트릭스·워크스페이스 설정 API),
`2-navigation/2-trigger-list.md`(Trigger RBAC·API), `2-navigation/_layout.md`/`_product-overview.md`(메뉴·NAV-WC
요구사항 ID), `conventions/i18n-userguide.md`(스코프 carve-out), `4-nodes/6-presentation/0-common.md`(§10.4/§10.6),
`4-nodes/3-ai/1-ai-agent.md`(§7.10/§12.5). 요구사항 ID(EIA-RL-07/IN-02/IN-12/AU-04/NF-03, WH-SC-01/05/09, WH-NF-02,
NAV-WC-01~06), API 계약(`interactionAllowedOrigins`, `config.interaction`, `{data}` 래핑), RBAC(Admin+/Editor+/Viewer+),
상태 전이(`WaitingInteractionType` 4↔3값 매핑, `waiting_for_input → cancelled` 사유) 를 각 SoT 문서와 1:1 대조.

## 발견사항

- **[INFO]** `endpointPath` 의 "비밀성" 서술이 문서마다 다른 프레이밍 사용
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §1 ("webhook path(UUID)가 **사실상 비밀 키**이며 스니펫에
    노출돼도 무방") vs `spec/7-channel-web-chat/5-admin-console.md` §7 권한 표 ("`endpointPath` 는 외부 사이트에
    그대로 박히는 **공개 UUID**(비밀 아님 — trigger-list R-15). 따라서 스니펫 전체를 viewer 에게 노출해도 비밀 누출 아님")
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` R-15("`endpointPath` 의 UUID 가 사실상 **capability token**
    역할을 겸한다")
  - 상세: 세 서술 모두 실질 내용(높은 엔트로피 UUID 로 방어하되 워크스페이스 내부 인가는 걸지 않는다)은 동일하고
    행동 결론도 일치(콘솔이 viewer 에게도 스니펫 전체 노출)한다 — API 계약·RBAC 실제 모순은 아니다. 다만 같은 target
    번들 안에서 "사실상 비밀 키"(3-auth-session)와 "비밀 아님"(5-admin-console)이라는 정반대 형용사가 서로 다른 문서에
    교차 링크 없이 쓰여, 독자가 "이 UUID 를 뷰어에게 보여줘도 되는가"를 판단할 때 순간적으로 상충한다고 오독할 수 있다.
    trigger-list R-15 의 "capability token" 프레이밍이 두 의미(외부 공격자 대비 unguessability / 워크스페이스 내부
    RBAC 상 비공개 아님)를 정확히 분리하는데, target 문서 두 곳은 이를 요약하며 서로 다른 극단 형용사만 남겼다.
  - 제안: `3-auth-session.md` §1 의 "사실상 비밀 키" 옆에 5-admin-console §7 / trigger-list R-15 를 상호 링크해
    "엔트로피 방어 대상(비밀 키) ≠ 워크스페이스 내부 가시성 통제 대상(비밀 아님)"이라는 두 축을 명시하면 향후 재수정
    시 drift 를 막을 수 있다. 비차단.

## 검증 완료 항목 (충돌 없음 확인)
아래는 target 이 타 영역과 접하는 주요 표면이며, 실제 SoT 문서와 대조해 완전 정합을 확인했다:

- **요구사항 ID**: `EIA-RL-07`/`EIA-IN-02`/`EIA-IN-12`/`EIA-AU-04`/`EIA-NF-03`(EIA), `WH-SC-01`/`WH-SC-05`/`WH-SC-09`/
  `WH-NF-02`(Webhook), `NAV-WC-01~06`(navigation) 모두 인용 문구·상태·구현 여부가 원본과 정확히 일치. 신규 ID 재사용
  충돌 없음.
- **데이터 모델**: `Trigger.config.interaction`(EIA §7.1 원본), `Workspace.settings.interactionAllowedOrigins`
  (`1-data-model.md §2.2`) 필드 정의·편집 API(`PATCH /api/workspaces/:id/settings`, Admin+)가 `4-security.md`·
  `5-admin-console.md`·`9-user-profile.md §4.3` 전체에서 동일 키·동일 권한으로 일치.
- **API 계약**: `{data}` TransformInterceptor 래핑, `embed-config` 응답 shape, `interact`/`cancel` 202+ack body
  (EIA §R16), `getStatus` 의 `conversationThread` 동봉 조건(EIA §R17) 모두 EIA 원본과 target 서술이 일치.
- **상태 전이**: `WaitingInteractionType` 내부 4값(`form`/`buttons`/`ai_conversation`/`ai_form_render`) ↔ EIA 외부
  3값 통합이 `interaction-type-registry.md §1.1`과 target `0-architecture.md §3`이 동일하게 서술. `waiting_for_input
  → cancelled` "타임아웃" 사유 예약(`execution-engine §1.1`)과 EIA-RL-07 구현이 정확히 대응.
- **RBAC**: `5-admin-console.md §2.1/§7`의 editor+/viewer+ 매핑이 `2-trigger-list.md`의 동일 Trigger API RBAC(editor+
  토글/삭제, viewer read-only)과 완전 일치. `4-security.md`의 워크스페이스 설정 Admin+ 도 `9-user-profile.md §4.2`
  역할 매트릭스("워크스페이스 설정" = Owner/Admin 만)와 정합.
- **계층 책임**: "위젯 = EIA client-side consumer, 신규 트리거 유형·facade 미신설"(0-architecture §R2) 이 EIA §R10
  (WebsocketService 단일 sink) 및 `_product-overview.md §1`("Chat Channel = server-side consumer 대칭")과 상충 없음.
  콘솔은 신규 엔티티 없이 기존 Trigger API 만 재사용(§R1) — Trigger 데이터 모델·EIA 등록 페이로드와 필드명까지 일치.
- **i18n 스코프**: `2-sdk.md §R6`/`_product-overview.md §2`의 "위젯 Korean-only, locale reserved" carve-out 이
  `conventions/i18n-userguide.md §적용 범위`의 명시 제외 목록과 정확히 대응(최근 커밋 79f50cf54 로 도입된 문구와 일치).
- **Presentation truncation 메타**: `1-widget-app.md §R8`의 `{itemsTotalCount|rowsTotalCount}` 흡수 서술이
  `4-nodes/6-presentation/0-common.md §10.4` 원본 필드명과 정확히 일치.

## 요약
`spec/7-channel-web-chat` 전 영역은 EIA·Webhook·Execution Engine·Conversation Thread·Interaction Type Registry·
데이터 모델·Navigation·i18n·Presentation 공통 규약 등 접하는 모든 타 영역과 요구사항 ID·API 계약·상태 전이·RBAC·계층
책임 축에서 실측 대조 결과 모순을 발견하지 못했다. 유일한 관찰 사항은 `endpointPath` 비밀성에 대한 형용사가 문서마다
"사실상 비밀 키" vs "비밀 아님"으로 다르게 쓰인 표현상 nuance(INFO)이며, 실제 API 동작·RBAC 결론은 동일해 차단 사유가
아니다.

## 위험도
LOW
