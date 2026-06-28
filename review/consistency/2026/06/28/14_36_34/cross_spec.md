## 발견사항

### [WARNING] `execution.message` 이벤트가 EIA 매핑 표(0-architecture §3)에 누락됨
- **target 위치**: `spec/7-channel-web-chat/0-architecture.md §3 EIA 매핑` 테이블
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.2 / R18` + `spec/7-channel-web-chat/5-admin-console.md §6`
- **상세**: EIA spec §5.2 및 R18(결정 2026-06-25)에서 `execution.message` 이벤트(표시-전용 presentation 노드 자동 진행)가 신설·정의됐다. `5-admin-console.md §6` 라이브 미리보기 절이 이 이벤트를 직접 참조("위젯이 `execution.message` SSE 이벤트로 받아 말풍선으로 렌더한다")하나, `0-architecture.md §3` EIA 매핑 테이블에는 해당 이벤트 행이 없다. 테이블에 `AI 메시지`와 `입력 대기 진입` 행은 있지만 비차단 presentation 노드의 `execution.message` 행은 누락돼 있어 위젯의 EIA 표면 커버리지가 불완전하게 기술된다.
- **제안**: `0-architecture.md §3` EIA 매핑 테이블에 `| 표시-전용 presentation 노드 출력 | SSE \`execution.message\` | EIA §5.2 |` 행을 추가한다. `1-widget-app.md §2 화면 구조` 메시지 리스트 항도 `execution.message` 소비 방침을 명시하도록 보강 권장.

---

### [WARNING] `0-architecture.md §3` EIA 매핑 표의 SSE wire 필드 vs EIA §6.2 표기 drift가 명시 "별도 backlog"으로만 처리됨
- **target 위치**: `spec/7-channel-web-chat/0-architecture.md §3` 주석 ("EIA §6.2 / WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift — 별도 backlog")
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §6.2` (`node.interactionType` → `interactionType` 매핑 노트)
- **상세**: EIA spec §6.2 는 `node.id` / `context.*` 추상 표기를 사용하면서도 동시에 "→ 최상위 `interactionType`" 매핑 노트를 갖고 있어 정합 시도가 부분적으로 있다. 반면 webchat `0-architecture.md §3` 주석은 이 불일치를 인정하고 "별도 backlog"으로 처리했다. 운영 코드 SoT(`eia-events.ts`)가 실제 wire 형식을 따르므로 기능 충돌은 없지만, spec 간 독자가 어느 쪽 필드명이 권위인지 혼동할 수 있다. EIA §6.2 의 추상 표기(`node.id` 등)가 wire 권위로 오독될 가능성이 있어 새 구현자에게 위험하다.
- **제안**: EIA §6.2 에 "wire 권위 필드명은 `waitingNodeId` / 최상위 `interactionType` / `conversationThread` 등이며, 본 섹션의 추상 표기(`node.id` 등)는 개념 설명용"임을 명시하거나, wire 형식 정규 표를 §6.2 에 추가한다. backlog 티켓으로 추적 중임을 EIA spec 에도 병기 권장.

---

### [INFO] `2-sdk.md §1` 스니펫 메서드 목록과 `§5 ChatInstance` 타입 간 `sendMessage` 노출 방식 불일치
- **target 위치**: `spec/7-channel-web-chat/2-sdk.md §1` 메서드 열거 (`sendMessage`) 및 `§5 ChatInstance` 타입 정의
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md §5` (공개 인스턴스 타입 계약 — `ChatInstance` 인터페이스)
- **상세**: §1 산문에서는 전역 함수 `ClemvionChat` 의 메서드 목록에 `sendMessage`가 열거된다. `ChatInstance` 인터페이스(§5 타입 SoT)에도 `sendMessage(text: string): void`가 포함되어 있어 계약 자체에는 충돌이 없다. 그러나 §3 postMessage 프로토콜 표(`wc:command` 목록)에는 `sendMessage(text)` 가 포함돼 있는 반면, §1 스니펫 로더 큐 진입 형태(`ClemvionChat('sendMessage', ...)`)의 페이로드 스키마가 별도로 정의되지 않았다. 사소하지만 SDK 배포 후 타입 불일치를 유발할 수 있다.
- **제안**: §3 `wc:command` 표에서 `sendMessage(text)` 페이로드 예시(`{ command: 'sendMessage', text: string }`)를 명확히 하거나, §5 계약이 우선한다는 주석을 추가한다.

---

### [INFO] `1-widget-app.md §3.1` 재로드 복원 시퀀스의 SSE 재연결 참조 방향 불일치
- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §3.1` 표 페이지 새로고침 행 ("§3.1 의 세션 복원(`executionId`+토큰)으로 기존 대화를 잇는다")
- **충돌 대상**: `spec/7-channel-web-chat/3-auth-session.md §3.1` (재로드 복원 시퀀스 상세)
- **상세**: `1-widget-app.md` 본문에서 "재open 시 세션 복원(executionId+토큰)"을 §3.1 로 참조하는데, `1-widget-app.md §3.1` 은 "채팅 종료 / 새로 시작 / 세션 지속" 절이다. 실제 복원 절차 상세는 `3-auth-session.md §3.1`에 있다. 내부 spec 교차 참조가 올바른 파일을 가리키지 않아 문서 가독성을 해친다.
- **제안**: `1-widget-app.md §3.1` 및 재open 설명에서 "세션 복원" 참조 링크를 `[3-auth-session §3.1](./3-auth-session.md#31-재로드-복원-시퀀스-per_execution)` 으로 수정.

---

### [INFO] `4-security.md §1 보안 정책 요약` 표의 `rate-limit / abuse` 행 EIA §8.4 현황 기술이 실제 구현 상태와 미미하게 diverge
- **target 위치**: `spec/7-channel-web-chat/4-security.md §4` 및 `§1` 표의 `rate-limit / abuse` 행
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.4`
- **상세**: `4-security.md §4` 는 "EIA §8.4 유지 — SSE 동시 3/execution 은 구현됨(초과 시 `429 TOO_MANY_CONNECTIONS`), interact 분당 60/execution 은 Planned(미구현)"이라고 정확하게 구현 상태를 분리 기재한다. EIA §8.4 본문도 동일 구분을 보유할 가능성이 높지만, webchat spec 이 이를 중복 기술하고 있어 EIA §8.4 와 sync 관리가 필요한 이중 진실 후보다. 충돌은 아니나 향후 EIA §8.4 구현 완료 시 양쪽을 동시 업데이트해야 한다.
- **제안**: `4-security.md §4` 의 EIA §8.4 구현 상태 기술을 "상세 및 최신 구현 상태는 EIA §8.4 참조" 로 위임 처리해 이중 진실을 제거 권장.

---

### [INFO] `NAV-WC-06` 요구사항 상태가 `_product-overview.md`(2-navigation)에서 `🚧`로 표기되나 `spec/0-overview.md §6.1`의 완료 기술과 미묘하게 다름
- **target 위치**: `spec/2-navigation/_product-overview.md NAV-WC-06` (라이브 미리보기 — 🚧 증분 2)
- **충돌 대상**: `spec/0-overview.md §6.1` ("임베드형 웹채팅 위젯 + SDK (채널)" ✅ 기재)
- **상세**: `spec/0-overview.md §6.1` 은 웹채팅 전체 영역을 ✅(구현 완료)로 기재하고 "영역 spec 6문서 전부 `implemented`(영역 종결)"로 기술한다. 반면 `spec/2-navigation/_product-overview.md` 의 NAV-WC-06(라이브 미리보기)는 `🚧 (증분 2 — 위젯 co-deploy 후)`로 표기된다. 라이브 미리보기가 실제 구현 완료됐다면 NAV-WC-06 도 ✅로 갱신돼야 한다. 현재 상태가 implemented 인지 아닌지에 따라 두 spec 중 하나가 stale하다.
- **제안**: 라이브 미리보기 구현 완료 여부를 확인하고, 완료됐다면 `spec/2-navigation/_product-overview.md NAV-WC-06` 을 `✅`로 갱신; 미완료라면 `spec/0-overview.md §6.1` 의 "영역 종결" 설명을 보정(라이브 미리보기 잔여 명시).

---

## 요약

`spec/7-channel-web-chat/` 전체 6문서(0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, 5-admin-console)는 다른 영역 spec(`spec/5-system/14-external-interaction-api.md`, `spec/1-data-model.md §2.2·§2.8 Trigger`, `spec/2-navigation/`, `spec/conventions/interaction-type-registry.md`)과 전반적으로 정합하며 CRITICAL 충돌은 없다. 데이터 모델(`Trigger.config.interaction.appearance`, `Workspace.settings.interactionAllowedOrigins`), API 계약(EIA 엔드포인트·명령·SSE 이벤트 형식), RBAC(editor+/viewer+ 기준, trigger 규약 일치), 상태기계(EIA 3값 interactionType, sessionStorage 복원), 계층 책임(client-only consumer 원칙)이 모두 기존 정의와 일치한다. 주요 주의 사항은 두 가지다: (1) 2026-06-25 신설된 `execution.message` 이벤트가 `0-architecture.md §3` EIA 매핑 테이블에 반영되지 않은 WARNING, (2) EIA §6.2 추상 표기와 실제 SSE wire 필드명 drift를 "별도 backlog"으로만 처리해 신규 구현자가 혼동할 수 있는 WARNING. 나머지는 내부 참조 링크 오류 및 이중 진실 후보 수준의 INFO다.

## 위험도

LOW
