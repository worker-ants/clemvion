# 신규 식별자 충돌 검토 결과

대상 문서: `plan/in-progress/spec-draft-web-chat-console.md`

---

## 발견사항

### 1. 요구사항 ID 충돌

target 은 새 요구사항 ID 를 부여하지 않는다 (별도 `_product-overview.md` 수정에서 NAV-WC-* 계열 ID 가 도입될 예정이나, 본 draft 에는 미포함). 기존 `spec/2-navigation/_product-overview.md` 의 요구사항 ID 체계(`NAV-WF-*`, `NAV-TR-*`, `NAV-SC-*`, `NAV-IN-*`, `NAV-CA-*`, `NAV-CL-*`, `NAV-ST-*`, `NAV-SS-*`, `NAV-MP-*`, `NAV-UG-*`, `NAV-UP-*`, `NAV-AM-*`)에 `NAV-WC-*` 또는 유사 prefix 는 존재하지 않아 충돌 없음.

- **[INFO]** spec 반영 단계에서 웹채팅 섹션 요구사항 ID prefix 를 확정해야 한다. `NAV-WC-*` (Web Chat) 가 자연스러우나, 기존 prefix 표와의 일관성 확인이 필요하다.
  - target 신규 식별자: (미확정 — draft 에 ID 체계 미포함)
  - 기존 사용처: `spec/2-navigation/_product-overview.md` 기존 prefix 목록
  - 제안: spec 반영 단계에서 prefix 확정 및 `_product-overview.md` 에 명시

---

### 2. 엔티티/타입명 충돌

충돌 없음. 세부 확인 내역:

- **신규 frontmatter id `web-chat-admin-console`**: 기존 `spec/7-channel-web-chat/` 의 id 집합(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`)에 없으며 의미도 겹치지 않음.
- **콘솔 구성요소 "D. 운영 콘솔"**: `_product-overview.md §4` 의 기존 구성요소 표는 A·B·C 3행. D 는 신규 추가이며 충돌 없음.
- **`InteractionConfigDto`**: target 이 새로 도입하는 타입이 아님 — 기존 `codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts` 를 재사용한다고 명시하고 있어 충돌 없음.

---

### 3. API endpoint 충돌

충돌 없음. target 은 신규 백엔드 endpoint 를 추가하지 않는다 (§1.1 "신규 백엔드 트리거 유형·facade·in-process 우회를 추가하지 않는다" 명시). 기존 `POST /api/triggers`, `GET /api/triggers` 를 재사용한다고 기술.

---

### 4. 이벤트/메시지명 충돌

충돌 없음. target 은 신규 SSE 이벤트명·webhook 이벤트명·BullMQ 큐명을 도입하지 않음.

---

### 5. 환경변수·설정키 충돌

- **[INFO]** 동일 CDN origin 값의 이중 env 관리 구조
  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (프론트엔드 admin 앱 클라이언트 노출용)
  - 기존 사용처: `codebase/frontend/.env.example` 에 해당 키 없음. `spec/` 전체에서 동일 이름 미발견. **동일 이름 충돌 없음**.
  - 관련 변수와의 의미 구분: 백엔드에는 `WEB_CHAT_WIDGET_ORIGINS` (`codebase/backend/.env.example:44`, `codebase/backend/src/common/cors/web-chat-cors.ts`) 가 이미 존재한다. 두 변수는 의미가 다름 — `WEB_CHAT_WIDGET_ORIGINS` 는 백엔드 CORS 허용 origin 목록(콤마 구분 복수), `NEXT_PUBLIC_WIDGET_CDN_BASE` 는 프론트엔드 스니펫 빌더가 emit 할 단일 CDN base URL. 런타임에 같은 origin 을 가리키지만 별개 앱에서 별개 목적으로 주입된다. 충돌이 아닌 상보 관계이나 운영 시 두 값이 일치해야 함에 대한 명시 없음.
  - 제안: `spec/7-channel-web-chat/0-architecture.md §4` 의 플레이스홀더 표에 `NEXT_PUBLIC_WIDGET_CDN_BASE`(프론트엔드 admin 앱용)와 `WEB_CHAT_WIDGET_ORIGINS`(백엔드용)를 나란히 등재하고, 두 변수가 동일 CDN origin 을 각 앱에서 별도 주입하는 관계임을 명시하면 운영 혼선 방지에 도움이 된다.

---

### 6. 파일 경로 충돌

충돌 없음. 세부 확인 내역:

- **신규 spec 파일 `spec/7-channel-web-chat/5-admin-console.md`**: 기존 파일 범위는 `0-architecture.md` ~ `4-security.md`. 숫자 prefix 5 는 미사용이며 충돌 없음.
- **신규 라우트 `(main)/web-chat`**: `codebase/frontend/src/app/(main)/` 하위 기존 라우트 목록(`agent-memory`, `authentication`, `dashboard`, `docs`, `integrations`, `invitations`, `knowledge-bases`, `models`, `profile`, `schedules`, `statistics`, `system-status`, `triggers`, `workflows`, `workspace`)에 `web-chat` 없음.
- **신규 컴포넌트 경로 `codebase/frontend/src/components/web-chat/**`**: 기존 컴포넌트 디렉터리(`auth`, `docs`, `editor`, `executions`, `integrations`, `knowledge-base`, `layout`, `llm-config`, `models`, `triggers`, `ui`, `workspace`)에 `web-chat` 없음.
- **`spec/2-navigation/_layout.md` §2.2 메뉴 번호 재정렬**: 기존 메뉴 항목 1~12 중 Schedule(4) 아래 웹채팅 행을 삽입하면 이하 항목 번호가 밀린다. 현 spec 내외에서 메뉴 순서 번호를 직접 참조하는 케이스는 발견되지 않아 실질적 충돌 없음.

---

## 요약

신규 식별자 충돌 관점에서 CRITICAL 및 WARNING 수준의 충돌은 발견되지 않는다. 신규 spec 파일 id `web-chat-admin-console`, 파일 경로 `spec/7-channel-web-chat/5-admin-console.md`, 라우트 `/web-chat`, 컴포넌트 경로 `components/web-chat`, 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE` 는 모두 기존 식별자 공간과 겹치지 않는다. INFO 수준으로 두 가지를 확인했다: (1) 요구사항 ID prefix 가 draft 에 미확정으로 spec 반영 단계에서 결정 필요, (2) `NEXT_PUBLIC_WIDGET_CDN_BASE`(프론트엔드)와 기존 `WEB_CHAT_WIDGET_ORIGINS`(백엔드)가 동일 CDN origin 을 별도 env 로 관리하는 상보 구조인데 spec 에 명시가 없으므로 `0-architecture.md §4` 에 병기 권장.

## 위험도

NONE
