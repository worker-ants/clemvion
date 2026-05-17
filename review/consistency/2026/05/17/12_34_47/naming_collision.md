# 신규 식별자 충돌 검토 결과

> Target: `plan/in-progress/spec-draft-integration-autorefresh.md`
> 검토 일시: 2026-05-17
> 검토 모드: spec draft (--spec)

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. target draft 는 기존 요구사항 ID(`§` 섹션 번호 참조 방식)를 신규 발급하지 않는다.

---

### 엔티티/타입명 충돌

- **[INFO]** `ServiceDefinition` 인터페이스에 `supportsTokenAutoRefresh` 필드 부재
  - target 신규 식별자: `ServiceDefinition.supportsTokenAutoRefresh` (`backend/src/modules/integrations/services/service-registry.ts` 참조)
  - 기존 사용처: `spec-registry.ts` 의 `ServiceDefinition` 인터페이스 (line 43~50) — 현재 `type`, `name`, `authVariants`, `scopes`, `oauthProvider` 5개 필드만 선언되어 있고 `supportsTokenAutoRefresh` 는 존재하지 않는다.
  - 상세: target draft §9.1 패치 및 §10.5 패치가 `ServiceDefinition.supportsTokenAutoRefresh` 를 derived 계산의 원천으로 명시하고 있으나, 실제 코드의 `ServiceDefinition` 에는 해당 필드가 없다. 이는 spec-draft 가 구현 PR 로 위임한 후속 변경(`plan/in-progress/integration-token-ui-autorefresh.md`)에서 추가될 예정이므로 spec 본문 패치 단계에서 즉각 충돌은 발생하지 않는다. 다만, spec 본문이 코드에 아직 없는 필드를 "현재 구현체에서 파생된다"고 서술하므로 spec ↔ 코드 간 일시적 드리프트가 발생한다.
  - 제안: target spec 본문에 "이 필드는 후속 구현 PR(`integration-token-ui-autorefresh.md`)에서 추가 예정" 임을 명시하거나, Rationale 항목 내에 "현재 코드에는 미존재 — 구현 PR 에서 추가" 한 줄을 덧붙인다.

- **[INFO]** `IntegrationDto.autoRefresh` 와 DB 엔티티 컬럼명 충돌 없음 확인
  - target 신규 식별자: `IntegrationDto.autoRefresh: boolean` (§9.1 패치)
  - 기존 사용처: `spec/1-data-model.md §2.10` `Integration` 엔티티 — 현재 해당 컬럼 없음. 코드베이스(`backend/`)에서도 `autoRefresh` 컬럼은 존재하지 않는다.
  - 상세: target 은 이 필드를 DB 컬럼이 아닌 derived 필드로 명시하고 있어 DB 스키마 충돌은 없다. `spec/1-data-model.md` 의 `Integration` 엔티티 정의와 충돌하지 않음.
  - 제안: 해당 없음.

---

### API endpoint 충돌

충돌 없음. target 은 새 endpoint 를 추가하지 않는다. 기존 `GET /api/integrations` 와 `GET /api/integrations/:id` 의 응답 필드 정의를 보강하는 변경으로, endpoint method + path 자체는 이미 `spec/2-navigation/4-integration.md §9.1` 에 정의된 것과 동일하다.

---

### 이벤트/메시지명 충돌

충돌 없음. target 은 webhook·queue·SSE 이벤트명을 신규 도입하지 않는다. 기존 `cafe24-token-refresh` 큐명·`cafe24-background-refresh` 잡명은 target 에서 참조만 할 뿐 변경하지 않는다.

---

### 환경변수·설정키 충돌

충돌 없음. target 은 새 환경변수 또는 설정 키를 도입하지 않는다.

---

### 파일 경로 충돌

- **[INFO]** target 이 수정하는 spec 파일 경로 정합 확인
  - target 신규 식별자(경로): `spec/2-navigation/4-integration.md` (단일 파일 수정)
  - 기존 사용처: 이미 존재하는 파일. CLAUDE.md 명명 컨벤션(`N-name.md` 숫자 prefix)을 준수하고 있으며 기존 파일과 충돌 없음.
  - 상세: 신규 파일 생성이 아닌 기존 파일 패치 작업이므로 파일 경로 충돌 없음.
  - 제안: 해당 없음.

---

### 주요 식별자별 전수 검토 요약

| 신규 식별자 | 종류 | 기존 코드베이스 사용 여부 | 판정 |
|------------|------|------------------------|------|
| `autoRefresh` (DTO 필드) | JSON 응답 필드 | 미존재 | 충돌 없음 |
| `integration.autoRefresh` (SQL 술어) | 쿼리 빌더 참조명 | 미존재 | 충돌 없음 |
| `supportsTokenAutoRefresh` | 코드 필드명 | 미존재 (구현 PR 에서 추가 예정) | 충돌 없음, 드리프트 INFO |
| `autoRefresh=true` / `autoRefresh=false` (술어) | spec 표현식 | 미존재 | 충돌 없음 |
| `Auto-renews` (UI 라벨) | UI 텍스트 문자열 | 미존재 | 충돌 없음 |
| `Auto-renewing — manual reauthorization unnecessary` (hover 안내) | UI 텍스트 | 미존재 | 충돌 없음 |

---

### 추가 관찰 사항

- **[INFO]** `application.md` 카탈로그 파일 상단 주석과의 연관성
  - `spec/conventions/cafe24-api-catalog/application.md` 는 "우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록)과 **무관** — naming collision 회피 참고"라고 명시하고 있다. target 이 도입하는 `autoRefresh` 는 이 카탈로그의 Cafe24 application resource 와 이름·개념 면에서 완전히 별개이며 충돌 소지가 없다.

- **[INFO]** `EXPIRING_SOON_INTERVAL` / `EXPIRING_SOON_DAYS` 상수와의 관계
  - 기존 SUMMARY(20260516-full-review) W-32 항목에서 `EXPIRING_SOON_INTERVAL` SQL 내장 vs 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석 비동기화를 경고로 식별한 바 있다. target draft 는 이 값을 변경하는 것이 아니라 기존 7일 임계치에 `AND NOT integration.autoRefresh` 조건을 추가하는 것이므로, W-32 의 기존 문제가 target 으로 인해 더 심화되지 않는다. 그러나 구현 PR 에서 이 두 상수의 동기화 여부를 함께 확인하는 것이 권장된다.

---

## 요약

target draft(`spec-draft-integration-autorefresh.md`)가 도입하는 주요 신규 식별자 `autoRefresh`(IntegrationDto 필드), `supportsTokenAutoRefresh`(ServiceDefinition 필드), `integration.autoRefresh`(SQL 술어 참조), `Auto-renews`(UI 라벨)는 기존 spec·코드베이스·plan 어디에도 동일 이름으로 다른 의미로 사용되고 있지 않다. CRITICAL 또는 WARNING 등급의 충돌은 발견되지 않았다. 유일한 주의 사항은 spec 본문이 `ServiceDefinition.supportsTokenAutoRefresh` 필드를 파생 원천으로 명시하나 실제 코드(`backend/src/modules/integrations/services/service-registry.ts`)에는 아직 존재하지 않아 일시적인 spec-코드 드리프트가 생긴다는 점이다. 이는 target draft 가 이미 "후속 구현 PR 로 위임"이라고 명시하고 있어 의도된 분리임이 확인된다. 전반적으로 신규 식별자 충돌 관점에서 spec 본문 패치를 진행하기에 문제없는 상태다.

---

## 위험도

NONE
