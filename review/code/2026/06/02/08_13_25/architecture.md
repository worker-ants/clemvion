# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: channel-web-chat-followups D#3~D#7 (embed-config soft 검증, presentation 렌더, 토큰 자동갱신, BYO-UI headless, CI wiring)
리뷰 일시: 2026-06-02

---

## 발견사항

### [INFO] EmbedConfigService — HooksModule 경계 내 신규 서비스 배치 (모듈 응집도 양호)
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts`, `hooks.module.ts`
- 상세: `EmbedConfigService` 가 `HooksModule` 내에 배치되어 `HooksController` 와 동일 모듈 경계 안에 있다. 임베드 설정 조회는 hooks 엔드포인트와 결합된 관심사이므로 경계 선택은 적절하다. `providers` 에만 등록하고 `exports` 하지 않아 내부 응집이 유지된다.
- 제안: 추가 조치 불필요.

### [WARNING] EmbedConfigService 가 Workspace Repository 에 직접 의존 — 레이어 경계 경미 노출
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` (constructor `@InjectRepository(Workspace)`)
- 상세: `EmbedConfigService` 는 hooks 모듈에 속하면서 workspaces 모듈의 `Workspace` 엔티티를 직접 주입받는다. hooks 모듈이 이미 triggers 모듈의 `Trigger` 엔티티도 직접 주입받는 패턴(`PublicWebhookThrottleGuard`, `HooksService`)과 일관성은 있으나, workspace 설정 조회라는 비즈니스 로직이 workspaces 모듈에 캡슐화되지 않고 타 모듈에 분산되는 경향이 생긴다. 향후 워크스페이스 설정 구조가 변경될 때(예: `interactionAllowedOrigins` 키 이동) 변경 파급이 hooks 모듈까지 미친다.
- 제안: 현재 단순 SELECT 수준에서는 허용 가능. 장기적으로 `WorkspacesModule` 에 `getEmbedConfig(workspaceId): Promise<EmbedAllowlist>` 인터페이스를 두거나, `WorkspaceSettingsService` 를 통해 워크스페이스 설정 접근을 단일화하면 경계가 명확해진다.

### [INFO] EmbedAllowlist 인터페이스와 EmbedConfigDto 의 이중 정의 — 경미한 중복
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` (`EmbedAllowlist`), `dto/responses/embed-config.dto.ts` (`EmbedConfigDto`)
- 상세: `EmbedAllowlist { allowlist, enforce }` 와 `EmbedConfigDto { allowlist, enforce }` 가 동일한 형태를 서로 다른 타입으로 선언한다. 서비스 반환 타입과 DTO 가 구조적으로 동일할 때 한쪽이 다른 쪽을 extend 하거나 단일화하면 변경 추적성이 향상된다. 현재는 `TransformInterceptor` 가 래핑하므로 controller 가 서비스 반환값을 그대로 반환해도 동작하지만, 타입 계약이 두 곳에 존재한다.
- 제안: `EmbedConfigDto` 를 `EmbedAllowlist` 로 대체하거나 `EmbedConfigDto extends EmbedAllowlist` 패턴을 사용해 단일 진실을 유지한다.

### [INFO] presentation.ts 의 shape 기반 분류(classifyPresentation) — 취약한 추상화 경계
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (`classifyPresentation`)
- 상세: presentation 종류 판별이 `config.chartType`, `output.data`, `output.rendered` 등 구체적 필드 이름에 의존하는 shape 매칭으로 구현된다. 판별 규칙이 코드에만 존재하며 spec SoT(`spec/4-nodes/6-presentation/*`)의 zod schema 와 직접 연결되지 않는다. 백엔드 presentation payload 구조가 변경될 경우 `classifyPresentation` 내부 조건식을 별도로 갱신해야 하며, 누락 시 silent 분류 실패(null 반환 → 렌더 skip)로만 드러난다. `type` 필드가 없는 flat envelope 설계 자체는 spec에서 의도된 것으로 보이나, 분류 로직의 테스트 커버리지가 충분한 것이 위험을 완화한다.
- 제안: 현재 테스트 커버리지 수준에서 허용 가능. 백엔드가 `type` 필드를 추가할 수 있다면 shape 추론보다 명시 필드 우선 분기를 추가해 향후 확장성을 높인다.

### [INFO] presentation.ts — 순수 변환 함수 + 헬퍼 분리 (응집도 양호, 긍정적 패턴)
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts`
- 상세: `asArray`, `asRecord`, `asButtons` 헬퍼가 파일 내 모듈 스코프 함수로 분리되고, `classifyPresentation`, `toCarousel`, `toTable`, `toChart`, `toTemplate` 이 순수 변환 함수로 export 된다. 상태·사이드이펙트가 없고 input/output 타입이 명시적이며 단위 테스트가 가능한 구조로, 단일 책임 원칙을 잘 따른다.
- 제안: 추가 조치 불필요.

### [INFO] presentations.tsx — chart type 분기 OCP 잠재 약점
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`
- 상세: chart type 별 렌더 분기가 `PresentationBlock` 내부에서 이루어지는 구조는 chart type 추가 시 `PresentationBlock` 를 수정해야 하므로 OCP 측면에서 약점이 있다. 단, 현재 chart type 집합이 고정적(5종)이고 확장 빈도가 낮으며, 외부 라이브러리 없이 inline SVG 로 구현한 것은 위젯 번들 크기 제약에서 합리적 선택이다.
- 제안: chart type 이 추가될 경우 `chartRenderers: Record<ChartType, React.FC<ChartData>>` 맵 패턴으로 전환해 OCP 를 강화할 수 있다.

### [INFO] widget-state.ts — BLOCKED phase 추가 (상태기계 확장, 레이어 책임 명확)
- 위치: `codebase/channel-web-chat/src/lib/widget-state.ts`
- 상세: `WidgetPhase` 에 `"blocked"` 가 추가되고 `widgetReducer` 에 `BLOCKED` 액션이 구현된다. 비즈니스 로직(임베드 허용 검사)은 `use-widget.ts` 에서 처리되고 상태 변이는 reducer 에서 순수하게 처리되어 레이어 책임 분리가 명확하다. `widget-app.tsx` 에서 `state.phase === "blocked"` 시 `null` 반환하는 패턴은 렌더 거부를 프레젠테이션 레이어에서 처리하는 적절한 설계다.
- 제안: 추가 조치 불필요.

### [INFO] use-widget.ts — 임베드 검증과 토큰 자동갱신 로직의 단일 훅 집중 — 복잡도 증가 주의
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
- 상세: `use-widget.ts` 가 임베드 설정 fetch/검증, 토큰 자동갱신 스케줄링(`refreshDelayMs`, `setTimeout`), EIA 이벤트 구독 등 여러 비즈니스 로직을 단일 custom hook 에 집중시킨다. 현재는 각 관심사가 명시적으로 분리된 함수(`refreshDelayMs` 순수 함수 추출 등)로 구조화되어 있어 허용 수준이다. 그러나 훅이 더 성장하면 SRP 위반이 심화된다.
- 제안: 현재 복잡도에서 수용 가능. 기능 추가 시 `useEmbedCheck`, `useTokenRefresh` 등 관심사별 custom hook 분리를 검토한다.

### [INFO] _ensure_web_chat_deps 헬퍼 — 공유 harness 와 독립 패키지 의존성 관리 분리 (설계 적절)
- 위치: `.claude/test-stages.sh`
- 상세: `_ensure_web_chat_deps` 가 `channel-web-chat` 과 `web-chat-sdk` 를 독립적으로 install 하는 책임을 단일 함수로 캡슐화하고, `cmd_lint`/`cmd_unit`/`cmd_build` 에서 공유 호출한다. 독립 패키지의 설치 책임이 명확히 분리되어 있고 중복 없이 재사용된다. `node_modules` 존재 여부를 체크해 불필요한 재설치를 방지하는 idempotent 설계도 적절하다.
- 제안: 추가 조치 불필요.

### [INFO] startHeadlessChat — 단일 책임 + 인터페이스 분리 원칙 준수 (긍정적 패턴)
- 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`
- 상세: `HeadlessChat { send, end, close }` 인터페이스가 사용자 조작(send/end)과 리소스 정리(close)로 명확히 분리된다. `handlers` 객체로 이벤트 콜백을 주입받는 패턴은 의존성 역전 원칙을 준수하며, 렌더링 책임을 호출자에게 위임하는 BYO-UI 패턴의 올바른 구현이다. `ClemvionClient` 를 직접 사용하여 별도 headless 패키지 신설 없이 기존 SDK 재사용 결정은 단일 진실 원칙과 의존 방향 명확성 측면에서 올바른 아키텍처 결정이다.
- 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 D#3(임베드 soft 검증), D#4(presentation 렌더), D#5(토큰 자동갱신), D#6(BYO-UI headless), D#7(CI wiring) 다섯 독립 기능을 추가한다. 전체적으로 레이어 책임 분리가 명확하다: 임베드 검증·토큰갱신은 `use-widget` 에, 상태 변이는 `widgetReducer` 에, 렌더 거부는 `widget-app` 에 각각 위치하며, 백엔드 `EmbedConfigService` 는 단일 책임 서비스로 독립 배치된다. 순환 의존성은 없으며 모듈 경계(HooksModule, channel-web-chat, web-chat-sdk)가 명확하다. 주요 아키텍처 주의사항은 `EmbedConfigService` 가 `Workspace` 엔티티를 직접 주입받아 workspaces 모듈 경계를 우회하는 점(WARNING, 현재 복잡도에서 허용 가능)과, `EmbedAllowlist`·`EmbedConfigDto` 이중 정의로 인한 단일 진실 원칙 경미 위반(INFO), `classifyPresentation` 의 shape 기반 분류 로직이 spec zod schema 와 직접 연결되지 않는 추상화 경계 취약점(INFO)이다. `presentation.ts` 의 순수 함수 설계, `widget-state` 의 상태기계 확장, `HeadlessChat` 의 인터페이스 분리, CI wiring 의 독립 패키지 설치 분리 모두 아키텍처 관점에서 긍정적 패턴이다.

---

## 위험도

LOW

---

STATUS=success ISSUES=2
