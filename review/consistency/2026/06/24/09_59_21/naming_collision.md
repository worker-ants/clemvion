# 신규 식별자 충돌 검토 — spec/2-navigation/ (impl-done)

## 검토 범위

- 검토 모드: `--impl-done`, diff-base=origin/main
- 실제 변경 파일: `spec/2-navigation/10-auth-flow.md`, `spec/7-channel-web-chat/0-architecture.md`
- 코퍼스: `spec/` 전체, `plan/in-progress/`

---

## 발견사항

변경 diff 가 도입하는 신규 식별자는 두 가지다.

### 발견사항 1

- **[INFO]** `/_widget` 경로 prefix — proxy.ts 공개 경로 예외 목록에 신규 추가
  - target 신규 식별자: `/_widget` (path prefix, `spec/2-navigation/10-auth-flow.md` §7.1 proxy 계층 설명)
  - 기존 사용처: `spec/7-channel-web-chat/0-architecture.md` §4.1 (동봉 서빙 경로로 이미 정의), `spec/7-channel-web-chat/5-admin-console.md` §5 (위젯 base 경로로 동일 의미 사용)
  - 상세: 의미 일치 확인. auth-flow spec 이 인증 미들웨어 제외 목록에 `/_widget`을 추가하면서 web-chat 아키텍처 spec 의 §4.1 을 cross-reference 한 것이므로 충돌 없음. plan/complete/web-chat-console.md, plan/in-progress/spec-draft-web-chat-console.md 에서도 동일 경로로 일관 사용 중.
  - 제안: 현행 유지. 참조 대상 spec 과 의미가 일치하므로 변경 불필요.

### 발견사항 2

- **[INFO]** `next.config rewrites` 설정 메커니즘 — 신규 단락에서 도입
  - target 신규 식별자: `next.config rewrites` (구성 파일 키 — `spec/7-channel-web-chat/0-architecture.md` 신규 단락)
  - 기존 사용처: 다른 spec 파일에서 동일 식별자로 쓰인 사례 없음 (`spec/` 전수 검색 결과 0건)
  - 상세: Next.js 프레임워크 표준 설정 키라 제품 식별자 충돌 범주가 아니다. 다른 spec 이 정의한 `rewrites` 규칙과 겹치는 경로 정의도 없다.
  - 제안: 현행 유지.

---

## 기존 식별자 검증 (spec/2-navigation/ 전체)

변경 외 기존 파일에 대해서도 주요 충돌 지점을 교차 확인했다.

### 요구사항 ID

- `EH-LIST-*`, `EH-DETAIL-*`, `EH-NAV-*` — spec/2-navigation/ 내부에서만 사용. 타 영역에서 동일 prefix 로 다른 의미로 쓰인 사례 없음.
- `NAV-AM-*` — spec/2-navigation/_product-overview.md 가 SoT 로 선언, 14-execution-history.md 가 cross-ref. 충돌 없음.

### 엔티티/타입명

- `DashboardSummaryDto` — 0-dashboard.md 에서만 정의. 타 spec 미사용. 충돌 없음.
- `triggerSource` (5종 enum, DTO 응답 필드) — 14-execution-history.md 에서 정의. 4-nodes/7-trigger/0-common.md 의 `__triggerSource` (엔진 내부 3종 마커) 와는 값 집합·레이어 모두 다른 별개 식별자임을 spec 본문(§R-2) 이 명시하므로 충돌 아님.
- `triggerLabel` — 14-execution-history.md 에서만 사용. 충돌 없음.
- `chainId` / `reRunOf` — 5-system/13-replay-rerun.md 가 SoT. 14-execution-history.md 는 ref-only. 충돌 없음.
- `nav-agent-memory` (spec id) — 16-agent-memory.md 고유. 5-system/17-agent-memory.md 는 `agent-memory` id 를 사용해 이미 분리됨. conventions/spec-impl-evidence.md 에 의도적 패턴으로 명문화. 충돌 없음.
- `ImplAnchor` MDX 컴포넌트 — 13-user-guide.md + conventions/user-guide-evidence.md + conventions/i18n-userguide.md 에서 동일 의미로 일관 사용. 충돌 없음.

### API endpoint

- `GET /api/dashboard/summary`, `/api/dashboard/recent-workflows`, `/api/dashboard/recent-executions` — 0-dashboard.md 에서만 정의. 타 spec 에 동일 경로 없음.
- `GET /api/executions/workflow/:workflowId`, `POST /api/executions/:executionId/re-run`, `GET /api/executions/:executionId/chain` — 14-execution-history.md 정의. 5-system/13-replay-rerun.md 가 re-run / chain endpoint 의 상세 명세를 보유하며 14-execution-history.md 는 참조만 하는 구조. 중복 정의 아님.

### 이벤트/메시지명

신규 도입된 이벤트/메시지명 없음. 해당 없음.

### 환경변수·설정키

- `OAUTH_STUB_MODE` — 5-system/1-auth.md 와 5-system/7-llm-client.md 에 이미 정의된 공유 상수. 10-auth-flow.md 가 동일 의미로 언급만 함. 충돌 없음.
- `NEXT_PUBLIC_WIDGET_CDN_BASE` — 7-channel-web-chat/0-architecture.md 가 SoT. 10-auth-flow.md 가 `/_widget` 경로 예외를 설명할 때 간접 연관. 충돌 없음.
- `RESEND_COOLDOWN_SECONDS` — 10-auth-flow.md §2.5 에서 프론트엔드 상수로 언급. spec 전체에서 단 1건 사용. 충돌 없음.

### 파일 경로

spec/2-navigation/ 파일 목록 (`0-dashboard.md` … `16-agent-memory.md`)은 숫자 prefix 정렬 컨벤션을 준수하며 기존 파일과 이름 겹침 없음. 10-auth-flow.md 와 7-channel-web-chat/0-architecture.md 의 경로도 기존 명명 컨벤션과 충돌하지 않는다.

---

## 요약

이번 변경(diff from origin/main)이 도입하는 신규 식별자는 `/_widget` path prefix 와 `next.config rewrites` 두 가지뿐이다. `/_widget` 은 7-channel-web-chat 영역에서 동일 의미로 이미 정의·사용 중이고, auth-flow spec 의 추가는 기존 정의를 cross-reference 하는 참조 추가라 의미 충돌이 없다. `next.config rewrites` 는 프레임워크 표준 설정 키이며 타 spec 과 겹치는 경로 정의 없음. spec/2-navigation/ 전체의 기존 식별자(요구사항 ID, DTO, API endpoint, spec id, 환경변수) 역시 타 영역과 의미 충돌을 발생시키는 사례를 발견하지 못했다.

## 위험도

NONE

STATUS: OK
