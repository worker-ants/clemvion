# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `waiting_for_input` presentations 렌더 미구현 — spec 1-widget-app §2 갭

- **위치**: `/codebase/channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent` 함수 (name === "execution.waiting_for_input" 분기), `/codebase/channel-web-chat/src/lib/eia-types.ts` `WaitingForInputEvent` 인터페이스
- **상세**: `spec/7-channel-web-chat/1-widget-app.md §2` 테이블 행 41은 presentation 출처를 `"ai_message.presentations[] / waiting_for_input"` 두 이벤트로 명시한다. 그러나 현재 `WaitingForInputEvent` 인터페이스에 `presentations` 필드가 없고, `handleEiaEvent` 의 `waiting_for_input` 분기도 presentations 를 추출·dispatch 하지 않는다. `ai_message` 경로만 구현되어 있어 `waiting_for_input` 시점에 서버가 presentations 를 동봉하면 위젯 렌더가 누락된다.
- **참고**: `threadToMessages` 가 `conversationThread.turns[].presentations` 를 포함하도록 업데이트됐으므로 thread snapshot 경유로는 일부 보완되나, `waiting_for_input` 이벤트 페이로드 레벨의 직접 처리 경로가 없다. 스펙의 "/ waiting_for_input" 표기가 thread snapshot 경유를 의미하는지 이벤트 페이로드 직접 노출을 의미하는지 모호하다.
- **제안**: spec 1-widget-app §2 의 `waiting_for_input` 출처 의미를 명확히 한다. 이벤트 페이로드 직접을 의미하면 `WaitingForInputEvent` 에 `presentations` 필드 추가 및 `handleEiaEvent` waiting_for_input 분기에 추출·dispatch 로직 추가. 모호하면 project-planner 위임 권장.

---

### [WARNING] `EmbedConfigService.resolve` — `authConfigId IS NULL` 공개 webhook 필터 부재

- **위치**: `/codebase/backend/src/modules/hooks/embed-config.service.ts` L38: `where: { endpointPath, type: 'webhook' }`
- **상세**: `spec/7-channel-web-chat/3-auth-session.md §1` 및 `spec/5-system/12-webhook.md WH-SC-01` 은 공개 챗봇 트리거를 `auth_config_id IS NULL` 로 정의한다. `embed-config` 엔드포인트는 공개 위젯 soft 검증 전용이므로 인증 webhook 트리거에 대한 allowlist 노출이 불필요하다. 현재 `type: 'webhook'` 만 필터링하고 `authConfigId: IsNull()` 조건이 없어, 인증 webhook 의 `triggerEndpointPath` 로도 조회가 성공해 해당 워크스페이스의 `interactionAllowedOrigins` 정보가 인증 없이 공개된다. trigger 미존재 시 allow-all 을 반환하는 "존재 노출 회피" 로직은 구현됐으나, 인증 webhook 이 실존하는 경우 이 보호가 작동하지 않는다.
- **제안**: `where: { endpointPath, type: 'webhook', authConfigId: IsNull() }` 조건을 추가하거나, 인증 webhook 의 allowlist 노출이 의도적이라면 서비스 주석에 근거 명시. spec 이 이 경계를 침묵하므로 project-planner 위임 검토.

---

### [INFO] `PieSlices` — 단일 슬라이스(100%) 시 SVG arc 렌더 실패 엣지케이스

- **위치**: `/codebase/channel-web-chat/src/widget/components/presentations.tsx` L286-299 `PieSlices`
- **상세**: 데이터 포인트가 1개(또는 유효 값이 하나뿐)일 때 `start=0, end=2π` 로 시작점과 끝점이 동일해 SVG arc 경로가 브라우저에서 렌더링되지 않는다(동점 arc 는 길이가 0). 단일 슬라이스 pie/donut 에서 차트가 아예 사라진다. 해당 케이스 테스트가 없다.
- **제안**: 단일 슬라이스 예외 처리(예: `frac >= 1 ? <circle cx cy r />` 로 대체) 또는 `pts.length === 1` 케이스 단위 테스트 추가.

---

### [INFO] `Cache-Control: public, max-age=300` 수치가 spec 에 미명시

- **위치**: `/codebase/backend/src/modules/hooks/hooks.controller.ts` L511
- **상세**: `spec/7-channel-web-chat/4-security.md §3-①` 은 allowlist 를 "캐시 가능한 워크스페이스 allowlist" 라고만 기술하고 max-age=300 (5분) 수치를 규정하지 않는다. 5분 캐시로 인해 allowlist 변경 후 최대 5분의 반영 지연이 발생하는데, 이 지연 허용치가 spec 의 회색지대다.
- **제안**: spec §3-① 에 "캐시 가능(예: max-age ≤ 5분)" 수치 기준 또는 운영 튜닝 지침을 명시하도록 project-planner 위임.

---

### [INFO] `classifyPresentation` — `output.data` 배열 존재로 chart 판별 시 false-positive 가능성

- **위치**: `/codebase/channel-web-chat/src/lib/presentation.ts` L89: `Array.isArray(output.data) → "chart"`
- **상세**: `output.data` 가 배열이면 무조건 chart 로 판별한다. 현재 4종 타입 범위 내에서는 문제없으나, spec `4-nodes/6-presentation/0-common.md` 이 presentation 타입 확장을 열어둔 구조에서 미래 신규 타입 envelope 이 `output.data` 배열 필드를 가지면 오분류된다.
- **제안**: 장기적으로 envelope 에 명시적 `type` 필드 추가 또는 chart 판별 조건 강화(예: x/y 키 검사). 현재 v1 범위에서는 INFO 수준.

---

### [INFO] `_ensure_web_chat_deps` — `node_modules` 존재 확인이 lock 파일 정합성을 보증하지 않음

- **위치**: `/.claude/test-stages.sh` L40-41 `_ensure_web_chat_deps`
- **상세**: `[ -d node_modules ] || npm ci` 패턴에서 `node_modules` 가 존재하지만 `package-lock.json` 과 정합하지 않는 경우(예: lock 파일 업데이트 후 재설치 없이 실행) 오래된 의존성으로 테스트가 통과될 수 있다. CI(`web-chat-checks.yml`)는 항상 `npm ci` 를 실행하므로 CI 에서는 문제없다.
- **제안**: 로컬 개발 트레이드오프로 수용 가능. 스크립트 주석에 "CI 는 항상 npm ci 실행, 로컬은 존재 확인만" 을 명시 권장.

---

### [INFO] `web-chat-checks.yml` push 트리거에 workflow 파일 자체 경로 누락

- **위치**: `/.github/workflows/web-chat-checks.yml` L103-107 (push paths)
- **상세**: `pull_request` 트리거는 `.github/workflows/web-chat-checks.yml` 경로를 포함하지만 `push.branches[main]` 트리거는 포함하지 않는다. 워크플로우 파일 변경이 main 에 머지될 때 push 트리거가 발동하지 않아 신규 워크플로우 설정의 정합성 검증이 한 번 누락된다.
- **제안**: push paths 에 `.github/workflows/web-chat-checks.yml` 추가 검토. 경미한 비대칭.

---

## 요약

이번 변경은 임베드 allowlist soft 검증, rich presentation inline 렌더, per_execution 토큰 자동 갱신, M2 BYO-UI 예제 정식화, CI wiring 의 5개 followup 항목을 구현한다. 핵심 기능 흐름(embed-config 조회 → BLOCKED phase → 렌더 거부, ai_message.presentations → inline 렌더, 토큰 자동 갱신 스케줄)의 구현은 스펙 의도와 대체로 일치한다. 다만 `spec/7-channel-web-chat/1-widget-app.md §2` 가 presentation 출처로 `waiting_for_input` 도 명시했는데 `WaitingForInputEvent` 에 `presentations` 필드와 handler 가 없어 spec-impl 갭이 존재하며(WARNING), `EmbedConfigService` 가 `authConfigId IS NULL` 공개 트리거 필터 없이 인증 webhook 의 워크스페이스 allowlist 를 공개 노출하는 점은 보안 전용 엔드포인트의 취지와 어긋난다(WARNING). Cache-Control 수치 미명시, 단일 슬라이스 pie 엣지케이스, classifyPresentation false-positive 가능성은 INFO 수준이다.

## 위험도

MEDIUM
