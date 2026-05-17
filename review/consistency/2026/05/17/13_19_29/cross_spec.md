# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation/` (구현 착수 전 --impl-prep 모드)
검토 일시: 2026-05-17

---

## 발견사항

### 1. [WARNING] `spec/2-navigation/4-integration.md` §2.2 — `autoRefresh` 파생 필드와 데이터 모델 불일치

- **target 위치**: `spec/2-navigation/4-integration.md` §2.2 항목 요소 테이블 내 `autoRefresh=true` 참조 (§2.2 상태 아이콘, §2.3 상태 칩, §2.4 배너, §4.1 헤더, §4.2 Overview 탭 여러 곳)
- **충돌 대상**: `spec/1-data-model.md` §2.10 Integration 엔티티 — "응답 DTO 전용 derived 필드" 주석
- **상세**: `spec/1-data-model.md §2.10` 는 `autoRefresh: boolean` 이 DB 컬럼이 아닌 API 응답 DTO 파생 필드이고, `ServiceDefinition.supportsTokenAutoRefresh`(backend service registry — 현재 `cafe24`/`google` 만 `true`)에서 매 응답 시점에 계산된다고 명시한다. 반면 `spec/2-navigation/4-integration.md` 의 여러 섹션은 이 값을 마치 DB에 저장된 필드처럼 참조하거나(`integration.autoRefresh`), `autoRefresh=false` 조건을 "Expires in Nd" 표시 기준으로 사용하는데, 해당 값이 DB에서 직접 조회될 수 없다는 점이 명시적으로 기술되어 있지 않아 구현자가 DB 컬럼으로 오해할 수 있다. 특히 §2.3 상태 칩 설명의 `NOT integration.autoRefresh` 조건이 SQL WHERE 절처럼 기술되어 있으나 실제로는 DTO 파생 필드라 DB 쿼리에서 직접 사용 불가하다. 데이터 모델 문서에서 이 파생 필드의 존재를 명시하고 있으므로 모순은 아니지만, navigation spec에서 이 파생 필드를 DB 레벨 필터 조건처럼 기술한 것이 구현 혼란을 야기할 수 있다.
- **제안**: `spec/2-navigation/4-integration.md` §2.3, §2.4 의 `NOT integration.autoRefresh` 조건을 "DTO 파생 필드 기반 — `ServiceDefinition.supportsTokenAutoRefresh` 참조" 임을 명시하거나, 백엔드 쿼리 빌더가 이 값을 어떻게 처리하는지 §9.1 API 절에 보완한다.

---

### 2. [WARNING] `spec/2-navigation/10-auth-flow.md` §8 — `GET /api/auth/verify-email` vs `spec/5-system/1-auth.md` 위임 방식의 일관성

- **target 위치**: `spec/2-navigation/10-auth-flow.md` §8 API 엔드포인트 표 — `POST /api/auth/verify-email` (설명: "이메일 인증 확인 (쿼리: token)")
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md` §2.5 이메일 인증 안내 화면 본문 — `GET /api/auth/verify-email?token={token}`
- **상세**: §2.5 본문에서는 이메일 인증 링크 클릭 시 `GET /api/auth/verify-email?token={token}` 으로 기술되어 있다. 그러나 §8 API 엔드포인트 표에는 동일 엔드포인트가 `POST /api/auth/verify-email` 로 기재되어 있어 HTTP 메서드가 불일치한다. 이메일 링크는 사용자가 브라우저에서 직접 클릭하는 링크이므로 GET이 적합하나 API 표에서는 POST로 기재되어 있다.
- **제안**: 두 위치 중 하나를 정정한다. 이메일 검증 링크(브라우저 직접 접근)이면 `GET`이 맞으며, 일관성을 위해 §8 엔드포인트 표를 `GET /api/auth/verify-email` 로 수정하거나, §2.5 의 설명을 `POST` 흐름(프론트엔드가 토큰을 추출 후 API 호출)으로 재기술한다.

---

### 3. [INFO] `spec/2-navigation/4-integration.md` §9.1 — `status=expiring` 가상 필터값 및 attention 가상 필터값이 `spec/1-data-model.md` Integration.status Enum에 부재

- **target 위치**: `spec/2-navigation/4-integration.md` §2.3 상태 칩, §2.4 배너, §9.1 API
- **충돌 대상**: `spec/1-data-model.md` §2.10 Integration — `status | Enum | connected / expired / error / pending_install`
- **상세**: navigation spec은 `expiring` 과 `attention` 이 "가상 필터값(virtual filter)"임을 명시하고 있어 직접 충돌은 아니다. 그러나 데이터 모델 문서의 Integration.status Enum에는 이 두 가상값에 대한 언급이 없다. 이를 모르는 개발자가 DB 마이그레이션에 이 값을 추가하려 할 수 있다.
- **제안**: `spec/1-data-model.md` §2.10 의 Integration.status Enum 정의 다음에 "쿼리 파라미터 전용 가상 필터값(`expiring`, `attention`)은 [Spec 통합 화면 §9.1](./2-navigation/4-integration.md#9-api) 참조 — DB Enum 확장 금지" 주석을 추가하여 단방향 참조를 확립한다.

---

### 4. [INFO] `spec/2-navigation/14-execution-history.md` §5 API — `GET /api/executions/workflow/:workflowId` vs 다른 영역의 리소스 경로 컨벤션

- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 API 엔드포인트 표 — `GET /api/executions/workflow/:workflowId`
- **충돌 대상**: `spec/5-system/2-api-convention.md` (API 규약 §5.2 목록 응답 참조됨) 및 RESTful 계층 구조 관례
- **상세**: `GET /api/executions/workflow/:workflowId` 는 workflowId 기반 중첩 경로를 `executions` 루트 아래 `workflow` 서브 세그먼트로 처리하는 방식이다. 반면 실행 상세는 `GET /api/executions/:id` 로 동일 루트에 위치한다. 일반적인 RESTful 컨벤션 및 본 시스템의 다른 리소스 경로(`/api/workflows/:id/versions`, `/api/triggers/:id`)와 비교할 때, `/api/workflows/:workflowId/executions` 가 더 일관된 계층 구조다. 현재 spec 내에서도 라우트 정의(`/workflows/:id/executions`)와 API 경로(`/api/executions/workflow/:workflowId`)가 다른 패턴을 사용한다.
- **제안**: API 경로를 `/api/workflows/:workflowId/executions` 로 통일하거나, 기존 경로 선택의 근거(기술적 이유)를 Rationale에 명시한다. spec/5-system/2-api-convention.md 를 확인해 경로 컨벤션 규칙이 있으면 준수 여부를 검토한다.

---

### 5. [INFO] `spec/2-navigation/3-schedule.md` §5 실행 출처 기록 — "지금 실행" 분류가 `spec/2-navigation/14-execution-history.md` §2.4 Trigger 출처 분류와 부분 불일치

- **target 위치**: `spec/2-navigation/3-schedule.md` §5 실행 출처 기록 규약 — "지금 실행" 버튼은 `executed_by = userId` → `manual` 분류
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` §2.4 Trigger 출처 분류 판정 표
- **상세**: `spec/3-schedule.md §5` 에서 "지금 실행(runNow)" 은 `executed_by = userId`를 채우고 `trigger_id`는 비워 두는 방식으로 `manual` 로 분류됨을 명시한다. 이는 `spec/14-execution-history.md §2.4` 의 판정 규칙(subworkflow 해당 없음 + `executed_by != null` → `manual`)과 논리적으로 일치한다. 그러나 실제 실행에서 schedule의 runNow가 `manual`로 표시되면 UI 상에서 스케줄에 의한 "즉시 실행"과 사용자의 일반 "수동 실행"이 동일하게 보여 출처 파악이 어려울 수 있다는 UX 모호성이 잠재적으로 존재한다. 현재 spec 내에서 직접 충돌은 없으나, 이 동작이 의도된 것임을 명시하는 Rationale이 없다.
- **제안**: `spec/2-navigation/3-schedule.md §5` 또는 `spec/2-navigation/14-execution-history.md §2.4` Rationale에 "스케줄 runNow는 `executed_by`를 채우므로 `manual`로 표시되며, 이는 의도된 동작"임을 명시한다.

---

### 6. [INFO] `spec/2-navigation/12-workflow-version-history.md` §7 API 경로 — `/workflows/:wfId/versions` vs `/workflows/:id/versions`

- **target 위치**: `spec/2-navigation/12-workflow-version-history.md` §7.1, §7.2, §7.3
- **충돌 대상**: 동일 문서 내 §7.3 (`POST /workflows/:id/versions/:versionId/restore`)
- **상세**: §7.1, §7.2에서는 `:wfId` 파라미터명을 사용하고, §7.3에서는 `:id` 파라미터명을 사용한다. 동일 리소스를 가리키는 경로 파라미터명이 섹션마다 다르다. 기능 충돌은 없으나 구현 시 혼란을 줄 수 있다.
- **제안**: 동일 문서 내에서 워크플로우 ID 파라미터명을 `:workflowId` 또는 `:id` 중 하나로 통일한다.

---

## 요약

`spec/2-navigation/` 의 구현 착수 전 Cross-Spec 일관성 검토 결과, 직접 구현을 차단하는 CRITICAL 충돌은 발견되지 않았다. 가장 주의가 필요한 항목은 WARNING 2건으로: (1) Integration `autoRefresh` 파생 필드가 여러 곳에서 DB 컬럼처럼 기술되어 있어 백엔드 쿼리 구현 시 오해 가능성이 있으며, (2) 이메일 인증 엔드포인트의 HTTP 메서드가 같은 문서 내에서 GET/POST로 불일치한다. INFO 4건은 명명 불일치, 경로 컨벤션 편차, 가상 필터값 미참조, 출처 분류 의도 미명시로 구현에 직접 영향은 없으나 동기화 권장 사항이다.

---

## 위험도

LOW
