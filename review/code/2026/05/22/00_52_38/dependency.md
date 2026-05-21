# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] 외부 패키지 의존성 변경 없음

- 위치: 전체 변경 파일 35개 (spec/*, plan/*, review/*)
- 상세: 이번 PR 의 변경 대상은 전부 `spec/`, `plan/`, `review/` 하위의 마크다운 문서 및 JSON 메타 파일이다. `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `pyproject.toml`, `Cargo.toml` 등 어떤 패키지 매니페스트·락 파일도 수정되지 않았다. 외부 라이브러리 추가·제거·버전 변경이 전혀 없다.
- 제안: 없음.

### [INFO] 내부 모듈 의존 관계 — 참조만 존재, 실제 import 변경 없음

- 위치: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`
- 상세: Chat Channel 스펙이 참조하는 내부 코드 경로(`codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/modules/hooks/` 등)는 명세 문서의 cross-link 형태로만 등장한다. 실제 소스 파일의 import 구조를 바꾸는 변경은 없다. 향후 구현 PR(PR-A~PR-E)에서 추가될 새 모듈(`chat-channel.module.ts`, `ChannelAdapterRegistry`, `ChatChannelDispatcher` 등)이 기존 `InteractionService`, `NotificationDispatcher`, `ExecutionEngineService`에 의존하게 된다는 설계 의도가 스펙에 기술되어 있다.
- 제안: 구현 착수 시 `ChannelAdapterRegistry` 및 `ChatChannelDispatcher`를 기존 `ExternalInteractionModule`과의 순환 의존 없이 별도 NestJS 모듈로 격리할 수 있는지 확인할 것. 특히 `InteractionService`를 in-process 직접 호출하는 구조(EIA-AU-08)에서 `chat-channel.module.ts` → `external-interaction.module.ts` 방향의 단방향 의존이 되어야 한다.

### [INFO] Telegram Bot API — 현재 스펙 단계에서 클라이언트 라이브러리 선택 미결

- 위치: `spec/4-nodes/7-trigger/providers/telegram.md`
- 상세: 스펙은 Telegram Bot API와의 통신 방식(setWebhook 등록, sendMessage, sendPhoto 등)을 정의하지만, 구현에 사용할 HTTP 클라이언트 라이브러리(예: `node-telegram-bot-api`, `grammy`, `telegraf`, 또는 raw `axios`/`fetch` 직접 호출)가 명시되어 있지 않다. 어떤 라이브러리를 선택하느냐에 따라 번들 크기·라이선스·취약점 노출이 달라진다.
- 제안: PR-A(백엔드 어댑터 구현) 착수 시 다음 기준으로 라이브러리를 선택하고 plan에 기록할 것:
  1. **최소 의존**: `node-telegram-bot-api`(MIT, ~50KB) 또는 raw HTTP 호출이 번들 크기 측면에서 유리. `grammy`/`telegraf`는 풍부한 기능을 제공하지만 server-side adapter에서 불필요한 추상화가 포함될 수 있음.
  2. **라이선스**: 프로젝트가 상업적 이용 시 MIT/Apache-2.0 라이선스 라이브러리를 우선 선택.
  3. **취약점**: 선택 시점에 `npm audit` 또는 `pnpm audit` 결과를 확인.
  4. **버전 고정**: 라이브러리 추가 시 `package.json`에 정확한 버전 범위(`^`보다 고정 버전 또는 좁은 범위 권장)를 명시.

### [INFO] plan-level 참조 — gRPC 내부 타입 `ChannelMessage` 와의 네임스페이스 주의

- 위치: `review/consistency/2026/05/21/18_10_33/naming_collision.md` §2 발견사항
- 상세: consistency 검토에서 `ChannelMessage` 타입명이 `@grpc/grpc-js` 의 `node_modules` 내부 타입과 동일함을 이미 확인하고 "node_modules 내 타입이므로 실질적 충돌 없음"으로 판정했다. 현 스펙 단계에서는 문제없으나, 구현 PR에서 `ChannelMessage`를 export할 경우 IDE 자동완성에서 혼동이 생길 수 있다.
- 제안: 구현 단계에서 `ChannelMessage`를 명확한 모듈 경계(`src/modules/chat-channel/`) 내에서만 export하고, 공유 타입 패키지(`codebase/packages/`)로 올리지 않으면 실질적 충돌은 없다.

## 요약

이번 PR에서 변경된 35개 파일은 모두 `spec/`, `plan/`, `review/` 하위의 문서·메타 파일로 구성되어 있으며 외부 패키지 의존성에 대한 변경이 전혀 없다. 의존성 관점에서 직접적인 위험 사항은 존재하지 않는다. 다만 향후 구현 PR(PR-A~PR-E)에서 Telegram Bot API 클라이언트 라이브러리 선택, `ChannelAdapterRegistry`와 기존 EIA 모듈 간 단방향 의존 관계 설계, in-process 호출 경로(`InteractionService`)의 순환 의존 방지가 실질적인 의존성 검토 시점이 될 것이므로, 이를 구현 plan에 명시적 체크리스트로 선기록하는 것을 권장한다.

## 위험도

NONE

---

STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-telegram-0c106c/review/code/2026/05/22/00_52_38/dependency.md RESET_HINT=
