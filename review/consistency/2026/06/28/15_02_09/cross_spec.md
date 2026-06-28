# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat/` (6개 문서 전체)
검토 기준: 다른 spec 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·권한·계층 책임 충돌

---

## 발견사항

### 발견사항 없음 (NONE 등급 또는 명시된 의도적 설계)

아래 후보 항목들을 면밀히 검토했으나 모두 이미 양 영역 spec 에서 명시적으로 조율되어 있음이 확인됐다.

---

### [INFO] NAV-WC-06 구현 상태 표기 불일치 (미미한 문구 차이)

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `status: implemented` + §6 라이브 미리보기 본문
- **충돌 대상**: `spec/2-navigation/_product-overview.md` NAV-WC-06 행 (`🚧 (증분 2 — 위젯 co-deploy 후)`) + `spec/0-overview.md §6.2` (`라이브 미리보기는 위젯 co-deploy 후 증분 2`)
- **상세**: `5-admin-console.md` 는 `status: implemented` 로 표기되어 있지만, `2-navigation/_product-overview.md` 의 NAV-WC-06 은 여전히 `🚧 증분 2` 로 "부분 미구현"으로 표기되어 있다. `5-admin-console.md §5` 자체에도 "동봉 번들 존재 감지는 Phase 1 과 함께 도입, 그 전(증분 1)에는 라이브 미리보기를 placeholder 로 노출"이라는 단서가 있어, spec 6개 전부 `implemented` 종결 선언과 NAV-WC-06 `🚧` 표기가 표면상 긴장한다.
- **제안**: 두 문서 중 하나를 동기화할 것. 라이브 미리보기가 실제 구현 완료됐다면 `2-navigation/_product-overview.md` NAV-WC-06 을 `✅` 로 갱신하고 `0-overview.md §6.2` 의 "증분 2" 주석을 제거한다. 반대로 아직 placeholder 단계라면 `5-admin-console.md` 의 `status` 를 `partial` 또는 note 추가로 명확히 한다. 기능 동작에는 영향 없는 문서 drift 이므로 차단 불필요.

---

### [INFO] `Trigger.workflow_id` NOT NULL 전제 — 운영 콘솔 인스턴스 생성 규약과의 확인

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §3` ("워크플로우 선택 (필수 — `Trigger.workflow_id` NOT NULL, [데이터 모델 §2.8])")
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` 엔티티 (`workflow_id | UUID | FK → Workflow`)
- **상세**: `5-admin-console.md` 가 `Trigger.workflow_id` 를 NOT NULL 로 전제하고 콘솔에서 워크플로우 선택을 필수로 두는 것은 `1-data-model.md §2.8` 의 Trigger 엔티티 정의(`workflow_id UUID FK → Workflow`)와 일치한다. 단 데이터 모델에서 해당 컬럼에 "NOT NULL" 명시 문구는 없고 타입·FK 만 기재되어 있다. 실질 모순은 없으나, 데이터 모델에 NULL 허용 여부가 명시되지 않아 독자가 spec 만으로 NOT NULL 여부를 확인하기 어렵다.
- **제안**: `1-data-model.md §2.8` 의 `workflow_id` 행 설명에 "NOT NULL" 을 명시하거나 각주를 추가하면 양쪽 spec 이 상호 보강된다(비차단).

---

### [INFO] `5-admin-console.md §5` 설치 스니펫의 `widget-cdn-base` URL 형식 — 선행 슬래시 불일치

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md §5` 스니펫 코드블록 (`j.src="<widget-cdn-base>/web-chat/v1/loader.js"`)
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md §1` 스니펫 (`j.src="https://<widget-cdn-base>/web-chat/v1/loader.js"`)
- **상세**: `2-sdk.md §1` 에는 `https://` 스킴이 명시되어 있지만 `5-admin-console.md §5` 의 스니펫 코드블록에는 스킴이 없다(`<widget-cdn-base>/web-chat/v1/loader.js`). 플레이스홀더 문서이므로 실제 동작 영향은 없으나, 두 예시의 일관성이 낮다.
- **제안**: `5-admin-console.md §5` 스니펫에도 `https://` 또는 `//` 프로토콜 상대 형식으로 일치시킨다(비차단 문서 개선).

---

## 추가 검토 결과 (모순 없음 확인)

아래 항목들은 충돌 후보로 검토했으나 이미 스펙 내에서 명시적으로 정합이 확인됐다.

**1. 데이터 모델 — `Workspace.settings.interactionAllowedOrigins`**
`spec/7-channel-web-chat/4-security.md §2·§3` 와 `spec/1-data-model.md §2.2` 및 `spec/5-system/14-external-interaction-api.md §8.5`, `spec/2-navigation/9-user-profile.md §6.1` 가 동일 키(`interactionAllowedOrigins`)를 참조하며 역할(CORS allowlist / 임베드 soft 검증)·편집 경로(`PATCH /api/workspaces/:id/settings`, Admin+)를 동일하게 기술한다. 단일 진실 원칙 준수 확인.

**2. API 계약 — EIA 외부 표면 `interactionType` 3값**
`spec/7-channel-web-chat/0-architecture.md §3` 가 EIA 외부 표면 `interactionType` 을 `form`/`buttons`/`ai_conversation` 3값으로, 내부 `WaitingInteractionType` 의 `ai_form_render` 는 외부에서 `ai_conversation` 으로 통합된다고 명시한다. `spec/conventions/interaction-type-registry.md §1` 의 "내부 4값 ↔ EIA 외부 3값 매핑" 섹션과 정합 확인.

**3. 상태 전이 — 위젯 `blocked` 상태**
`spec/7-channel-web-chat/1-widget-app.md §3.2` 가 `blocked` 의 **정의·SoT** 임을 선언하고 `4-security.md §3-①` 은 그 상태를 발동하는 정책 trigger 로서 참조한다. 두 문서가 역할을 명시적으로 분리하여 충돌 없음 확인.

**4. 권한·RBAC — 인스턴스 관리 (editor+) vs 목록 조회 (viewer+)**
`spec/7-channel-web-chat/5-admin-console.md §7` 의 RBAC 표가 `spec/2-navigation/2-trigger-list.md` 의 Trigger 생성/삭제 규약 및 `spec/2-navigation/_product-overview.md` NAV-WC-* 권한 기술과 동일 패턴(생성·편집·삭제 editor+, 조회 viewer+)을 따른다. 충돌 없음.

**5. 계층 책임 — 위젯은 EIA 순수 HTTP consumer, 신규 facade 없음**
`spec/7-channel-web-chat/0-architecture.md §R2` 와 `_product-overview.md §1` 이 "신규 백엔드 트리거 유형·facade 미신설, EIA §R10 단일 sink 정책 불변" 을 명시하며, `spec/5-system/14-external-interaction-api.md` 의 EIA §2 표 4행("외부 SaaS 가 내장 chat 위젯 호스팅 — Inbound only")과 정합 확인.

**6. 요구사항 ID 충돌 — `web-chat-*` 접두어**
6개 spec 의 frontmatter id(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`)는 타 영역에서 미사용이며 전역 유일. `4-security.md` 의 id comment("basename `4-security` 와 의도적으로 다름 — 타 영역의 `4-security` 슬러그와 충돌 방지")에서 의도 명시 확인.

**7. SSE wire 필드명 (`waitingNodeId`, `message`) drift — 기존 backlog**
`spec/7-channel-web-chat/0-architecture.md §3 SSE wire 필드명` 주석이 WS §4.4 의 `nodeId`/`node.id` 표기와의 drift 를 "별도 backlog" 로 명시적으로 인식하고 있다. 이는 기존에 파악된 기술 부채이며 `7-channel-web-chat` 영역이 의도적으로 wire SoT 를 자체 `eia-events.ts` 로 고정한 것이므로 cross-spec 충돌 아님.

**8. `replay_unavailable` — 계획·미구현, 위젯 로컬 타이머 폴백**
`spec/5-system/14-external-interaction-api.md §5.2` 가 `replay_unavailable` 미구현임을 명시하고 위젯이 로컬 시간(>5분) 기준으로 폴백함을 `spec/7-channel-web-chat/1-widget-app.md §3.1` 과 교차 기술한다. 두 문서가 서로를 참조하여 일관성 확보.

---

## 요약

`spec/7-channel-web-chat/` 6개 문서는 관련 다른 영역(`spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/interaction-type-registry.md`, `spec/2-navigation/_product-overview.md`, `spec/2-navigation/9-user-profile.md`, `spec/0-overview.md`)과 데이터 모델·API 계약·RBAC·계층 책임 전 관점에서 실질적 모순이 없다. 발견된 항목 3건은 모두 INFO 등급(문서 문구 drift 또는 표기 불일치)이며 제품 동작에 영향을 주지 않는다. NAV-WC-06 라이브 미리보기의 구현 완료 여부 표기(증분 2 🚧 vs `status: implemented`)가 가장 주목할 만한 동기화 포인트이나, `5-admin-console.md §5` 자체에 "증분 단계 주의" 설명이 포함되어 있어 모순이 아닌 문서 drift 수준이다.

## 위험도

LOW
