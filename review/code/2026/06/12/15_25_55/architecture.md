# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** `@WorkspaceId()` 데코레이터로의 전환 — 단일 책임 원칙(SRP) 준수 강화
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts`
  - 상세: 기존 `ChatChannelController.rotateBotToken`은 (1) body validation, (2) workspace ID 헤더 수동 추출, (3) workspaceId 유효성 검증, (4) 서비스 위임이라는 4가지 책임을 혼합했다. `@WorkspaceId()` 데코레이터로 교체함으로써 컨트롤러는 (1) body validation + (4) 서비스 위임만 담당하고, workspace 컨텍스트 추출·검증 책임은 공용 데코레이터로 위임된다. 이는 SRP 준수를 개선하고, 동일 패턴을 사용하는 다른 컨트롤러와 아키텍처 일관성을 맞춘다.
  - 제안: 현 방향 유지. 향후 새 컨트롤러 엔드포인트를 추가할 때도 `@WorkspaceId()` 데코레이터를 표준 경로로 사용해야 한다.

### 발견사항 2
- **[INFO]** JWT fallback 누락 버그 해소 — 의존성 역전(DIP) 관점 보조 이득
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` (before: `@Headers('x-workspace-id')`)
  - 상세: 기존 수동 헤더 추출은 `X-Workspace-Id` 헤더에만 직접 의존하여 JWT `workspaceId` fallback 경로를 누락했다. 공용 데코레이터를 통해 추상화된 인터페이스(`WorkspaceId`)에 의존하도록 전환함으로써, 실제 workspace ID 조달 전략(헤더 우선 → JWT fallback)의 변경이 컨트롤러에 투명해졌다.
  - 제안: 이 패턴을 레이어 협약으로 명문화하는 것을 권장한다 — 컨트롤러는 원시 헤더를 직접 읽지 않고 항상 파라미터 데코레이터를 통해 추상화된 컨텍스트를 받는다.

### 발견사항 3
- **[INFO]** HTTP 상태 코드 의미론 정합 — `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED`
  - 위치: `spec/5-system/15-chat-channel.md §5.4`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 및 `.en.mdx`
  - 상세: 기존 `401 Unauthorized`는 HTTP 의미론상 인증 실패(자격증명 불일치)를 나타내지만, workspace ID 부재는 요청 컨텍스트 누락(잘못된 요청 형식)에 해당한다. `400 Bad Request`로 정정함으로써 HTTP 계층의 의미 계층(레이어 책임)이 바르게 분리된다. 공용 데코레이터(`workspace.decorator.ts`)가 이미 `BadRequestException`을 발생시키므로 구현과 명세·문서가 이제 일치한다.
  - 제안: 이상 없음. spec, user-docs(한/영 양본), 에러코드 열거 모두 동기화되어 단일 진실 원칙이 지켜졌다.

### 발견사항 4
- **[INFO]** 테스트 책임 이관 — 레이어 테스트 경계 명확화
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.spec.ts`
  - 상세: "X-Workspace-Id 미전달 시 UnauthorizedException" 케이스를 컨트롤러 단위 테스트에서 제거하고, 검증 책임을 `common/decorators/workspace.decorator.spec.ts`로 이관한 것은 테스트 레이어 책임 분리 관점에서 올바르다. NestJS param 파이프라인 없이 컨트롤러 메서드를 직접 호출하는 단위 테스트에서 데코레이터 동작을 검증하는 것은 false-positive를 유발할 수 있으며, 이를 데코레이터 자체 spec으로 격리함으로써 테스트 신뢰성이 높아진다.
  - 제안: 이상 없음. 단위 테스트 잔여 4케이스(정상 위임, body 누락, 비문자열, 서비스 예외 전파)가 컨트롤러 고유 책임을 완전히 커버한다.

### 발견사항 5
- **[INFO]** `forwardRef`를 통한 `TriggersModule ↔ ChatChannelModule` 양방향 의존성
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:10-12`
  - 상세: `ChatChannelController`가 `TriggersService`를 `forwardRef`로 주입받고 있다. 이는 두 모듈 간 순환 의존성이 현재도 존재함을 나타낸다. 이번 변경은 해당 순환 구조를 변경하지 않았으며, 기존 workaround가 그대로 유지된다. 아키텍처상 순환 의존은 잠재적 위험 요소이나 NestJS에서 `forwardRef`는 관용적 패턴이며 이번 변경 범위 밖이다.
  - 제안: 중장기적으로 `ChatChannelModule`의 관리 API 엔드포인트를 `TriggersModule`로 이동하거나, 공유 인터페이스 모듈을 도입해 순환 의존을 해소하는 것을 검토한다. 이번 PR 범위에서는 현상 유지가 적절하다.

### 발견사항 6
- **[INFO]** `plan/complete/code-node-isolated-vm.md` — 아키텍처 결정 기록(ADR) 품질
  - 위치: `plan/complete/code-node-isolated-vm.md`
  - 상세: `isolated-vm` 전환 플랜 문서가 위협 모델, 선택지 비교(옵션 A/B/C/D), 트레이드오프, spec 참조를 체계적으로 기록하고 있다. ADR(Architecture Decision Record) 역할을 충실히 수행하며, V8 Isolate 경계를 통한 host-takeover 구조적 차단, 레이어 경계(ExternalCopy를 통한 데이터 격리, Reference/Callback을 통한 함수 브리지)가 명확히 서술되어 있다.
  - 제안: 이 문서를 complete/ 폴더 이관과 함께 유지하는 것은 적절하다.

---

## 요약

이번 변경은 `ChatChannelController.rotateBotToken`에서 workspace ID 추출·검증 책임을 수동 헤더 읽기에서 공용 `@WorkspaceId()` 데코레이터로 일원화하는 소범위 아키텍처 정합(architecture consistency fix)이다. SOLID 관점에서 SRP·DIP 준수가 개선되었고, HTTP 상태 코드 의미론(`401` → `400`)이 바로잡혔으며, JWT fallback 누락 버그가 해소되었다. spec, user-docs(한/영), 에러코드 열거, 단위 테스트 책임 이관이 모두 동반되어 단일 진실 원칙이 지켜졌다. `TriggersModule ↔ ChatChannelModule` 간 기존 순환 의존(`forwardRef`)은 이번 변경 범위 밖으로 잔존하지만 아키텍처 위험 수준에는 변화가 없다. 전체적으로 레이어 책임 분리와 공용 인프라 추상화 활용을 강화하는 바람직한 방향이다.

## 위험도

NONE
