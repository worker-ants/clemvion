# Cross-Spec 일관성 검토 결과

검토 모드: --impl-done  
scope: spec/5-system/6-websocket-protocol.md  
diff-base: origin/main

---

## 발견사항

### [INFO] spec §3.3 이 여전히 `channelAuthorizers` 를 gateway 내부 배열로 서술

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §3.3 (라인 143)
- **충돌 대상**: 구현 diff — `websocket.gateway.ts` / `websocket.module.ts` / `channel-authorizer.ts`
- **상세**: spec §3.3 은 "채널별 인가 전략(`channelAuthorizers`, OCP 구조)" 라고만 서술하고 있어, 배열이 gateway 생성자에서 인라인 초기화되는지 아니면 DI 주입되는지를 명시하지 않는다. 구현(M-7 refactor)은 각 도메인 모듈이 `ChannelAuthorizer` 를 소유·export 하고 `WebsocketModule` 의 `useFactory` 가 집계해 `CHANNEL_AUTHORIZER` 토큰으로 주입하는 **DI 역전** 구조로 변경됐다. spec 의 `channelAuthorizers` 언급은 이 내부 구조 변경과 논리적으로 모순되지는 않으나, "gateway 인라인 배열" 로 읽힐 여지가 있다.
  - Rationale §"§3.3 채널 인가 — `workflow:`·`notifications:` authorizer 추가" 에는 구조 설명이 없다.
- **제안**: 해당 없음(INFO 등급). spec 이 외부 행동(채널별 소유권 검증)을 기술하고 있어 구현 기계적 구조(DI 역전)를 반드시 spec 에 반영할 필요는 없다. 향후 spec 동기화 시 "도메인 모듈 소유 authorizer → DI 집계" 구조를 Rationale 에 간략히 기록하면 충분하다.

---

### [INFO] spec frontmatter `code:` 목록에 신규 파일 미등록

- **target 위치**: `spec/5-system/6-websocket-protocol.md` frontmatter (라인 6–13)
- **충돌 대상**: 구현 diff의 신규 파일들
- **상세**: frontmatter `code:` 글로브가 기존 gateway/service 파일들만 나열하고 있으며, M-7 에서 추가된 아래 파일들이 빠져 있다.
  - `codebase/backend/src/modules/websocket/channel-authorizer.ts`
  - `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts`
  - `codebase/backend/src/modules/executions/execution-channel-authorizer.ts`
  - `codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts`
  - `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts`
  - `codebase/backend/src/modules/workflows/workflow-channel-authorizer.ts`
  - `codebase/backend/src/common/utils/uuid.ts`
  
  이 파일들은 §3.3 에서 기술하는 채널 인가 로직의 실제 구현체이므로 `code:` 에 포함되는 것이 적절하다.
- **제안**: spec `code:` 글로브에 위 파일 경로 추가(글로브 패턴 `*-channel-authorizer.ts`로 일괄 커버 가능). 단, spec 변경은 `project-planner` 권한 범위이며 기능 충돌 없는 동기화 항목.

---

## 요약

M-7 refactor(channel authorizer inversion)의 구현 변경은 기존 `spec/5-system/6-websocket-protocol.md` 의 채널별 인가 행동 명세(§3.3 권한 검증 표, 채널 prefix, 소유권 검증 방식)와 **완전히 일치**한다. 채널 목록(`execution:`, `workflow:`, `kb:`, `background:run:`, `notifications:`)·검증 방식(workspace 소유 검증/UUID 선차단/userId 일치)·거부 응답 형태(`success: false, error: string`)가 spec 명세 그대로 유지된다. `spec/0-overview.md`, `spec/1-data-model.md` 등 관련 영역의 데이터 모델(UUID PK, workspace 격리, Document.id UUID) 과도 모순이 없다. 발견된 두 항목은 모두 INFO 등급의 동기화 권장 사항이며, 구현 채택 여부에 영향을 주는 충돌은 없다.

## 위험도

NONE
