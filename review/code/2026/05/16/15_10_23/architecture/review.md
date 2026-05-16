# 아키텍처(Architecture) 리뷰

리뷰 대상: consistency-check 세션(`review/consistency/2026/05/16/14_28_20/`) 산출물 + `spec/1-data-model.md` · `spec/2-navigation/4-integration.md` · `spec/4-nodes/4-integration/4-cafe24.md` 변경

---

## 발견사항

### 1. Spec-Code 간 단방향 의존 위반 — 상태 도메인 모델이 분산

- **[CRITICAL]** `Attention` 가상 필터 개념이 spec 에서 삭제되었으나 프론트엔드 구현체에는 그대로 잔존해, 도메인 모델의 단일 진실(Single Source of Truth) 원칙이 붕괴됨
  - 위치: `spec/2-navigation/4-integration.md` §2.3 · §2.4 · §9.1 (Attention 칩·`?status=attention` 삭제), `frontend/src/app/(main)/integrations/page.tsx`, `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`(`needsAttention` 함수), MDX 사용자 가이드
  - 상세: 아키텍처적으로 spec 은 도메인 모델의 원천(source)이고 구현은 그 파생물이어야 한다. 이번 변경은 spec 에서 `Attention` 도메인 개념을 삭제했으나 그것을 구현한 `needsAttention()` 함수·`attentionCount` 변수·MDX 안내 문구가 코드베이스에 남아 있다. 개방-폐쇄 원칙(OCP) 관점에서, 도메인 개념을 제거할 때는 그 개념에 의존하는 모든 모듈을 함께 폐쇄(close)해야 한다. 현재 코드는 폐기된 개념을 외부로 `export` 하는 상태 — `needsAttention` 이 `export function` 으로 노출되어 있어 다른 모듈이 이 유령 로직에 추가 의존할 위험이 있다.
  - 제안: (A) `Attention` 칩과 `?status=attention` 가상 필터값을 spec 에 복원하고 구현 상태를 유지한다. (B) Attention 개념 제거를 확정한다면 `page.tsx`, `status-badge.tsx`, MDX 파일을 spec 변경과 동시에 갱신하여 레이어 간 정합성을 회복한다. 어느 방향이든 spec 과 구현이 동일 시점에 일관된 상태를 가져야 한다.

### 2. API 계층의 책임 경계 모호화 — 가상 필터값 변환 규칙 삭제

- **[CRITICAL]** `GET /api/integrations` 엔드포인트의 `status=expiring` 가상 필터값 변환 규칙이 spec 에서 삭제됨으로써 프레젠테이션 레이어(상태 칩)와 데이터 레이어(DB Enum) 사이를 연결하던 비즈니스 레이어 계약이 소멸함
  - 위치: `spec/2-navigation/4-integration.md` §9.1 (status 파라미터 허용값 기술 삭제), §2.3 (`Expiring (7일 이내)` 칩 잔존)
  - 상세: 레이어 책임 분리 원칙에서 `expiring` 은 DB Enum 에 존재하지 않는 값이므로, 프레젠테이션(칩 UI)에서 발행한 `?status=expiring` 쿼리를 백엔드 비즈니스 레이어가 `status='connected' AND token_expires_at within 7d` 로 변환하는 규칙이 명시되어야 한다. 이 변환 규칙이 spec 에서 삭제되면 구현자는 두 선택지에 직면한다: (a) 변환 없이 `WHERE status='expiring'` 을 그대로 실행해 0건을 반환하거나, (b) 과거 코드를 보고 역추론해 구현한다. 두 경우 모두 spec 이 비즈니스 로직의 SoT 역할을 잃는다.
  - 제안: §9.1 에 `status` 파라미터 허용값 목록과 가상 필터값(`expiring` → WHERE 변환 규칙)을 복원한다. 가상 필터값 패턴은 `Attention` 과 동일한 아키텍처적 결정(DB Enum 비확장, 비즈니스 레이어 변환 책임)이므로 두 개념의 존폐를 함께 결정해야 한다.

### 3. DTO 설계의 레이어 책임 분리 위반 — `appUrl` 필드 암묵적 제거

- **[WARNING]** `GET /api/integrations/:id` 응답 스펙에서 `appUrl: string | null` 필드가 암묵적으로 삭제됨으로써 API 계층의 응답 계약(DTO)이 내부 도메인 모델(`install_token` 필드)과 단절됨
  - 위치: `spec/2-navigation/4-integration.md` §9.1 (`GET /api/integrations/:id` 설명 단순화), `spec/1-data-model.md` §2.10 (`install_token` 필드는 계속 존재), 테스트 코드 `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`
  - 상세: 클린 아키텍처 관점에서 `install_token` (내부 도메인 필드)을 `appUrl` (API 응답 DTO 필드)로 변환하는 것은 응용 레이어의 책임이다. 이 변환이 spec 에서 삭제됐지만 `install_token` 은 `spec/1-data-model.md` §2.10 에 여전히 존재하며 `spec/4-nodes/4-integration/4-cafe24.md` §9 의 에러 복구 흐름도 `appUrl` 기반 UX 를 전제한다. 내부 도메인 모델과 외부 API 계약이 불일치하게 된다.
  - 제안: (A) `IntegrationDto.appUrl` 필드를 spec 에 복원하고 변환 로직(`install_token → appUrl`)을 응용 레이어 책임으로 명시한다. (B) 제거를 확정한다면 `spec/1-data-model.md` §2.10 의 `install_token` 의 "post-install navigation 식별 키" 설명도 재검토하고, `spec/4-nodes/4-integration/4-cafe24.md` §9 의 에러 복구 안내도 갱신한다.

### 4. 상태 기계(State Machine) 계약 내부의 이중 카운트 위험

- **[WARNING]** `spec/2-navigation/4-integration.md` §2.4 배너 포함 조건이 `token_expires_at <= now() + 7d` 로 단순화되면서 `expired` 상태 행이 `expiring` 조건을 동시에 만족하는 상태 중복 집계 위험이 생김
  - 위치: `spec/2-navigation/4-integration.md` §2.4 (배너 포함 조건), §11.4 (UI 배지 조건 `status IN (expired, error) OR (token_expires_at <= now() + 7d)`)
  - 상세: `spec/5-system/4-execution-engine.md` 에 정의된 상태 전이 모델에서 `connected → expired` 전이는 `token_expires_at <= now()` 인 시점에 발생한다. 따라서 `expired` 상태인 행은 `token_expires_at <= now() <= now() + 7d` 조건을 항상 만족해 배너와 배지 카운트 양쪽에서 이중 집계될 수 있다. 상태 기계의 상태 공간(state space)이 조건식에서 명확히 분리되지 않는 것은 아키텍처적으로 상태 전이 계약과 집계 로직의 결합도가 높아지는 징후다.
  - 제안: 배너 조건에 `status NOT IN (expired, error, pending_install)` 가드를 추가하거나, `OR` 구조로 집합을 명시적으로 분리한다. §11.4 UI 배지 조건도 동일하게 정비한다. 상태 전이 계약(§6)과 집계 조건(§2.4, §11.4)이 의미상 일관성을 가져야 한다.

### 5. 라우트 설계에서 정적/동적 경로 우선순위 미명시

- **[WARNING]** 신규 `GET /api/integrations/cafe24/precheck` 라우트가 NestJS 컨트롤러의 기존 `@Get(':id')` 동적 경로와 충돌할 위험이 있으며, spec 에 라우트 선언 순서 제약이 명시되지 않음
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 1, `backend/src/modules/integrations/integrations.controller.ts:209` (`@Get(':id')`)
  - 상세: NestJS 의 라우트 매칭은 컨트롤러 내 선언 순서를 따른다. `GET /api/integrations/cafe24/precheck` 는 2개의 path segment(`cafe24`, `precheck`)를 가지므로 `@Get(':id/usages')` · `@Get(':id/activity')` 보다 먼저 선언되지 않으면 `cafe24` 가 `:id` 로 소비되어 `ParseUUIDPipe` 에서 400 오류가 발생한다. 이는 라우트 정의의 책임을 컨트롤러 내부 순서에 암묵적으로 위임하는 설계로, 확장성(새 정적 경로 추가 시마다 기존 동적 경로와의 충돌을 수동 관리)이 낮다.
  - 제안: spec §9.1 또는 §9.x 에 "정적 경로를 동적 경로보다 앞에 선언한다" 라우트 순서 규약을 명시하고, 컨트롤러 구현 시 `@Get('cafe24/precheck')` 를 `@Get('services')` 바로 아래, `@Get(':id')` 계열 모두보다 위에 위치시킨다. 장기적으로 경로 충돌이 반복될 경우 `cafe24` prefix 하위에 별도 컨트롤러(예: `Cafe24IntegrationController`)를 분리하는 방안을 검토한다.

### 6. 에러 코드 네이밍이 Public/Private 도메인 경계를 혼재

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드를 Public(`app_type='public'`) 흐름에도 재사용하면 에러 코드의 의미적 응집도(semantic cohesion)가 깨짐
  - 위치: `review/consistency/2026/05/16/14_28_20/naming_collision/review.md` 발견 2, `backend/src/modules/integrations/integration-oauth.service.ts:1068`, `spec/2-navigation/4-integration.md:684`·`:713`
  - 상세: 에러 코드는 API 계약의 일부이며 클라이언트(프론트엔드)가 분기 처리의 키로 사용한다. 코드 이름에 `PRIVATE` 이 명시되어 있으면 API 클라이언트는 해당 코드를 Private 흐름 전용으로 해석할 합리적 이유가 있다. Public 흐름에서도 동일 코드를 반환하면 클라이언트 분기 로직이 Public 경로의 409 응답을 누락할 수 있다. 이는 인터페이스 분리 원칙(ISP) 과도 연관된다 — 두 흐름이 실제로 다른 의미를 가진다면 다른 계약을 가져야 한다.
  - 제안: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 로 일반화(rename)한다. backend, spec, Swagger doc, 프론트엔드 toast/banner 메시지 키를 함께 변경하며, 기존 코드는 deprecated 처리 후 한 버전 이후 제거한다. 이 결정은 구현 착수 전에 확정되어야 한다.

### 7. `install_token` 라이프사이클 계약이 두 spec 문서 간 불일치

- **[WARNING]** `spec/1-data-model.md` §2.10 과 `spec/2-navigation/4-integration.md` Rationale 의 `install_token_issued_at` callback 성공 시 처리 방향이 서로 다름
  - 위치: `spec/1-data-model.md` §2.10 (`install_token_issued_at`: "callback 성공 시 NULL"), `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" (이번 변경 전 main: "callback 성공 시 보존")
  - 상세: 이번 diff 에서 `spec/1-data-model.md` 는 "callback 성공 시 `install_token_issued_at` 도 NULL 로 비워진다"고 기술하고, 동시에 `spec/2-navigation/4-integration.md` Rationale 의 TTL 24h 항도 "callback 성공 시 install_token 과 함께 NULL" 로 갱신했다. 그런데 변경된 `spec/2-navigation/4-integration.md` §4.2 에서 삭제된 App URL 카드의 근거(`install_token` 을 post-install navigation 식별 키로 보존)가 제거됨에 따라, `install_token` 의 보존 vs. NULL 처리 결정이 두 방향 중 어느 것을 정식으로 채택했는지 Rationale 에서 명확하지 않다. 데이터 모델과 상태 전이 계약이 동일 개념에 대해 다른 기술을 가지면 구현자 혼란이 발생한다.
  - 제안: `spec/1-data-model.md` §2.10 과 `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 항이 `install_token`·`install_token_issued_at` 의 callback 성공 시 처리를 동일하게 기술하도록 정합한다. 선택된 방향을 Rationale 에 단일 결정으로 명시한다.

### 8. Spec 문서 간 단방향 참조가 삭제된 UI 요소를 가리킴 — 크로스-모듈 의존성 단절

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md` §9 의 에러 복구 안내가 이번 변경으로 삭제된 Overview 탭 App URL 카드를 참조함
  - 위치: `spec/2-navigation/4-integration.md` §4.2 (App URL 카드 제거), `spec/4-nodes/4-integration/4-cafe24.md` §9 (에러 복구 안내 "통합 상세 페이지에서 현재 App URL 확인")
  - 상세: 모듈 경계 관점에서 `4-cafe24.md` 는 `4-integration.md` 에 정의된 UI 요소(App URL 카드)에 단방향 의존하고 있다. 의존 대상이 삭제되면 이 참조는 죽은 링크(dead reference)가 된다. 사용자가 에러 복구 안내를 따를 때 안내가 가리키는 UI 요소를 찾을 수 없게 되어 UX 흐름이 단절된다. 이는 모듈 간 결합도 관리가 필요한 아키텍처 문제다.
  - 제안: App URL 카드 삭제가 확정이라면 `4-cafe24.md` §9 의 에러 복구 안내 문구를 대체 접근 경로(예: 다른 탭이나 URL 직접 입력)로 갱신한다. 또는 App URL 카드를 Overview 탭 대신 Security 탭으로 이동하는 방안을 검토한다.

### 9. Worktree 간 공유 리소스 직렬화 미적용 — 동시 Rationale 수정 경합

- **[WARNING]** `cafe24-hmac-raw-fix-b8e2d1` worktree 가 `spec/2-navigation/4-integration.md` Rationale 섹션 말미를 이미 commit 한 상태에서 현재 worktree 도 같은 위치를 수정해 병합 시 텍스트 충돌이 확정됨
  - 위치: `review/consistency/2026/05/16/14_28_20/plan_coherence/review.md` CRITICAL 1, `spec/2-navigation/4-integration.md` ## Rationale (commit `30be2f94`)
  - 상세: 프로젝트 CLAUDE.md 규약("같은 spec 파일을 두 worktree 가 동시에 수정 중이면 직렬화한다")이 준수되지 않은 상태다. 아키텍처적으로 단일 진실 원칙을 spec 으로 구현할 때 동시 수정을 허용하면 merge 비용이 선형으로 증가한다. 이 문제는 consistency-checker 가 이미 CRITICAL 로 검출했으나 구현 착수 전 차단이 이루어지지 않은 상태로 리뷰 대상 diff 가 생성됐다.
  - 제안: `cafe24-hmac-raw-fix-b8e2d1` PR 을 먼저 main 에 병합한 뒤 현재 worktree 를 `git rebase main` 으로 갱신하고 Rationale 추가를 진행한다. 두 PR 의 병렬 merge 가 불가피하면 `merge-coordinator` 를 경유한다.

### 10. Fields 편집 버퍼 패턴의 범위 재정의 — 추상화 수준 불일치

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §2 · §9.9 가 Fields 편집 버퍼 패턴을 "object-shaped backend contract 를 가진 통합 노드에 한정"으로 재정의했으나, 이전 버전의 "cafe24 노드 전용" 결정(Phase 3 KeyValueEditor 완전 제거)과 범위가 불일치함
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 (변경 전: "Phase 3 동적 폼 채택으로 cafe24 노드에서 KeyValueEditor 의존 완전 제거 → 옛 A→B 분리 버퍼 패턴은 본 프로젝트에서 더 이상 사용되지 않음", 변경 후: "object-shaped backend contract 를 가진 통합 노드에 한정")
  - 상세: 이번 변경에서 §2 에 "편집 버퍼" 줄을 다시 추가하면서 §9.9 의 적용 범위를 일반화했다. 이전 결정("더 이상 사용되지 않음")과 이번 결정("object-shaped 노드에 적용")이 어느 것이 최신인지 CHANGELOG 에서만 알 수 있다. 추상화 수준이 결정마다 바뀌는 것은 설계 안정성을 낮춘다.
  - 제안: §9.9 의 "적용 범위" 항에 이전 결정과의 관계를 한 줄로 명시한다("Phase 3 이전 KeyValueEditor 패턴과 달리, 현재 버퍼 분리는 메타데이터 기반 동적 폼과 공존하며 object-shaped contract 노드에만 적용"). 추상화 레벨이 달라진 경우 CHANGELOG 에 그 배경을 기술한다.

### 11. 의존성 역전 원칙 준수 — `Cafe24McpBridge` 의 인터페이스 계약

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md` §이중 활용 절에서 `Cafe24McpBridge` 가 `IMcpClient` 인터페이스를 구현하는 구조가 기술되어 있으나, 이번 변경이 `fields` 편집 버퍼 범위를 재정의함에 따라 MCP Bridge 도 동일 메타데이터 테이블을 사용한다는 점에서 변경 전파 경로를 spec 이 명시하지 않음
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md` Overview ("같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출"), §9.9 변경
  - 상세: DIP(의존성 역전 원칙) 관점에서 `Cafe24McpBridge` 와 Cafe24 노드 핸들러가 동일 메타데이터 테이블을 공유하는 구조는 적절하다. 그러나 fields 편집 규칙(버퍼 분리, 호환 키 보존 등)이 변경될 때 MCP Bridge 측에도 동일한 변경이 필요한지 spec 이 명시하지 않는다. 이 부분이 암묵적 의존이 되면 향후 MCP Bridge 구현이 노드 핸들러와 drift 할 수 있다.
  - 제안: §9.9 또는 §이중 활용 절에 "fields 직렬화 계약(`Record<string, unknown>`)이 변경될 경우 `Cafe24McpBridge` 의 tool input schema 도 동기화 필요"를 한 줄 명시한다.

---

## 요약

이번 변경 세트(`cafe24-mall-dup-ux-a7f2c8` worktree)의 핵심 아키텍처 문제는 **spec 에서 도메인 개념을 삭제하면서 그 개념에 의존하는 구현 레이어를 동시에 갱신하지 않은 것**이다. `Attention` 가상 필터 칩 삭제(CRITICAL-1)와 `appUrl` DTO 필드 제거(WARNING-3)는 모두 spec-code 단방향 의존 원칙을 위반하며, 프론트엔드 코드·테스트·MDX 문서에 유령 로직을 남긴다. 비즈니스 레이어의 가상 필터값 변환 규칙 삭제(CRITICAL-2)는 API 계약의 레이어 책임 경계를 모호하게 만든다. 상태 기계 조건식의 이중 카운트 위험(WARNING-4), 에러 코드 네이밍의 의미 혼재(WARNING-6), 삭제된 UI 요소에 대한 크로스-스펙 참조 유지(WARNING-8)도 모듈 경계와 결합도 관리 측면에서 개선이 필요하다. worktree 간 동시 Rationale 수정(WARNING-9)은 프로젝트 규약상 직렬화가 선행되어야 한다. 전반적으로 도메인 개념 제거 시 spec-구현-문서 세 레이어를 원자적으로 갱신하는 프로세스가 이번 변경에서 누락되어 있으며, 구현 착수 전 방향 결정과 동시 갱신이 필수적이다.

---

## 위험도

**HIGH**
