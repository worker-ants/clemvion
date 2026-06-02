# 신규 식별자 충돌 검토 — spec/4-nodes/4-integration/ (impl-prep)

검토 대상: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24)
검토 모드: 구현 착수 전 (--impl-prep)
연관 plan: `plan/in-progress/cafe24-allowlist-ui.md`

---

## 발견사항

### 발견사항 1
- **[INFO]** `readCafe24Extras()` — 모듈-비공개 함수지만 plan에서 재사용 참조
  - target 신규 식별자: plan의 `Cafe24AllowlistEditor` 가 `readCafe24Extras()` 를 호출한다고 명시
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:296` — `function readCafe24Extras()` (export 없음, 파일 내부 비공개 함수)
  - 상세: `readCafe24Extras()` 는 현재 `integration-configs.tsx` 에서 export 없이 선언된 파일-스코프 함수다. plan 이 `cafe24-allowlist-editor.tsx`(새 파일)에서 이를 "재사용"한다고 명시하므로, 새 컴포넌트 파일에서 직접 import 하거나 공유 모듈로 추출해야 한다. 지금 그대로라면 import 경로가 없어 런타임 오류 또는 함수 복제(drift 위험)가 발생한다.
  - 제안: `readCafe24Extras()` 를 `integration-configs.tsx` 에서 export 하거나, 공유 helper 파일(예: `cafe24-extras.ts`)로 추출해 `cafe24-allowlist-editor.tsx` 가 import 하도록 한다.

### 발견사항 2
- **[INFO]** `resolveCafe24OperationLabel` — 동일하게 비공개 함수지만 재사용 참조
  - target 신규 식별자: plan의 "라벨: `cafe24Catalog` ko/en dict (`resolveCafe24OperationLabel` 패턴, 3줄 — 복제)"
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx:399` — `function resolveCafe24OperationLabel(...)` (export 없음, 비공개 함수)
  - 상세: plan 이 "3줄 복제" 를 허용하겠다는 의도이므로 의식적 선택이지만, 함수명이 동일 프로젝트 내 두 파일에 복제되면 유지보수 시 한 쪽만 수정되는 drift 가 발생할 수 있다.
  - 제안: "복제"보다 shared helper 로 추출하여 단일 진실 원칙을 유지하거나, 복제가 불가피한 경우 함수명에 `_local` 같은 suffix 를 붙여 복제임을 명시한다.

### 발견사항 3
- **[INFO]** `cafe24-allowlist-editor.tsx` 파일 경로 — 기존 컨벤션 부합 여부
  - target 신규 식별자: `components/integrations/cafe24-allowlist-editor.tsx`
  - 기존 사용처: 해당 경로에 현재 두 파일만 존재 — `approval-required-badge.tsx`, `mcp-server-selector.tsx`
  - 상세: 기존 컴포넌트 파일들이 `kebab-case.tsx` 패턴을 따르므로 `cafe24-allowlist-editor.tsx` 는 컨벤션에 부합한다. 충돌 없음. 동일 이름 파일이 현재 존재하지 않아 경로 충돌도 없다.
  - 제안: 없음. 컨벤션 부합, 경로 충돌 없음.

### 발견사항 4
- **[INFO]** `INVALID_PARAMETERS` — spec 내 이미 존재하는 코드이나 cross-spec 일관성 확인 필요
  - target 신규 식별자: `spec/4-nodes/4-integration/2-database-query.md` 의 `INVALID_PARAMETERS` 에러 코드
  - 기존 사용처: `spec/2-navigation/4-integration.md:1010` 에도 `INVALID_PARAMETERS` 로 동일하게 사용 중
  - 상세: 충돌 없음. 같은 코드가 두 spec 에서 동일 의미(DB parameters JSON parse 실패)로 사용 중이다. 의미 일관성 유지됨.
  - 제안: 없음.

### 발견사항 5
- **[INFO]** `CAFE24_INVALID_MALL_ID` — 다른 spec 파일에서 맥락이 다른 용법 확인
  - target 신규 식별자: `spec/4-nodes/4-integration/4-cafe24.md §5.8` 의 `CAFE24_INVALID_MALL_ID`
  - 기존 사용처: `spec/2-navigation/4-integration.md:1235` — OAuth begin 흐름의 Private app 거부 분기 설명에서 noise 원인으로 언급됨 (`CAFE24_INVALID_MALL_ID` 가 노출되었으나 실제 본질 원인이 아니었다는 맥락)
  - 상세: 두 spec 이 같은 코드를 다른 맥락에서 언급하고 있으나, 의미(mall_id 형식 위반)는 동일하다. 충돌 없음.
  - 제안: 없음.

### 발견사항 6
- **[INFO]** `EMAIL_HOST_BLOCKED` — `send-email` spec 과 navigation spec 간 의미 일관성
  - target 신규 식별자: `spec/4-nodes/4-integration/3-send-email.md` 의 `EMAIL_HOST_BLOCKED` 에러 코드
  - 기존 사용처: `spec/2-navigation/4-integration.md:491,1007,1050` 및 `spec/5-system/3-error-handling.md:70` — 동일 코드, 동일 의미(SMTP host SSRF 차단)로 사용 중
  - 상세: 충돌 없음. 의미와 용법이 일관되며, spec 에도 별개 namespace 임을 명시(`IntegrationTestResult.code` vs `output.error.code`)했다.
  - 제안: 없음.

### 발견사항 7
- **[INFO]** `INTEGRATION_SERVICE_UNAVAILABLE` — `1-http-request`, `2-database-query`, `3-send-email`, `4-cafe24` 모두 사용
  - target 신규 식별자: 네 통합 노드 spec 전반에 걸쳐 사용되는 공통 에러 코드
  - 기존 사용처: `spec/4-nodes/4-integration/0-common.md §4.2` 에는 목록 없고, 각 노드 spec 에서 개별 등장. `spec/2-navigation/4-integration.md` 에는 명시적 참조 없음.
  - 상세: target 의 각 노드 spec 이 동일 코드를 같은 의미(IntegrationsService 미주입/워크스페이스 컨텍스트 누락)로 사용. 충돌 없음. 다만 `0-common.md §4.2` 공통 에러 코드 표에 `INTEGRATION_SERVICE_UNAVAILABLE` 이 없고 각 노드 spec 에서 따로 열거한다 — 공통 표가 누락된 상태다.
  - 제안: `0-common.md §4.2` 공통 에러 코드 표에 `INTEGRATION_SERVICE_UNAVAILABLE` 을 추가하면 단일 진실 원칙에 부합하지만, 이는 spec 수정 사항이므로 developer 가 직접 변경하지 않는다. project-planner 로 위임 대상.

---

## 요약

`spec/4-nodes/4-integration/` 영역이 도입하는 신규 식별자(에러 코드, 설정 키, 환경변수, spec ID, API 식별자 등)는 기존 사용처와 의미적으로 충돌하지 않는다. 에러 코드들(`INVALID_PARAMETERS`, `EMAIL_HOST_BLOCKED`, `CAFE24_INVALID_MALL_ID` 등)은 `spec/2-navigation/4-integration.md`, `spec/5-system/3-error-handling.md` 등에서 이미 동일 의미로 참조되어 일관성이 유지된다. 환경변수 `ALLOW_PRIVATE_HOST_TARGETS` 역시 세 노드에서 공유하는 의도가 spec 과 `.env.example` 모두에서 일치한다. 주목할 점은 plan 이 신설 예정인 `Cafe24AllowlistEditor` 컴포넌트가 `readCafe24Extras()` 와 `resolveCafe24OperationLabel()` 을 재사용하겠다고 명시했는데, 두 함수 모두 현재 `integration-configs.tsx` 에서 비공개(export 없음) 상태여서 신규 파일에서 직접 import 가 불가능하다. 이를 해결하지 않으면 함수 복제(drift 위험) 또는 빌드 오류가 발생하므로 구현 착수 전 export 또는 공유 helper 추출 전략을 결정해야 한다.

## 위험도

LOW

---

_검토 기준: 신규 식별자 충돌 6개 관점 (요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로)_
