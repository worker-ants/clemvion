# 아키텍처(Architecture) Review — Cafe24 HMAC raw-value fix + App URL 상세 페이지

## 발견사항

### 핵심 코드 변경 (backend/frontend + spec)

---

- **[INFO]** `buildHmacMessage` — 단일 책임 원칙 잘 준수
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1642–1654
  - 상세: `buildHmacMessage(rawQuery: string): string` 는 HMAC 메시지 생성 책임만 담당하고, `verifyHmacWithMessage` 는 암호학적 검증만 담당한다. 두 함수가 명확하게 분리되어 있으며, `tryRecoverByMallId` 가 `buildHmacMessage` 를 한 번 호출 후 후보별로 `verifyHmacWithMessage` 를 재사용하는 구조가 성능과 구조 모두 적절하다. 이번 재정정(raw value 보존)으로 `formUrlEncode` 헬퍼가 제거됨으로써 함수 계층 단순화가 이루어졌다.
  - 제안: 없음.

---

- **[INFO]** `Cafe24AppUrlCard` 컴포넌트 — 적절한 단일 책임과 모듈 경계
  - 위치: `frontend/src/app/(main)/integrations/[id]/cafe24-app-url-card.tsx`
  - 상세: UI 컴포넌트가 `appUrl: string` 프로프만 받아 화면 렌더와 클립보드 복사만 담당한다. Redirect URI 파생 로직(`appUrl.replace(/\/install\/[^/]+$/, "/callback")`)이 컴포넌트 내부에 있어 backend 의 `buildOauthCallbackUrl` 과 중복이다. 단, 이 파생 로직은 URL 패턴 치환으로 매우 단순하고 변경 가능성이 낮으므로 현재 수준의 응집도는 허용 가능하다. `t` 함수를 prop 으로 주입받아 i18n 의존성을 외부에서 주입하는 패턴은 테스트 편의성과 재사용성 모두 우수하다.
  - 제안: 향후 Redirect URI 계산 로직이 복잡해지면 공유 유틸로 추출을 고려하되 현 시점은 불필요.

---

- **[INFO]** `IntegrationDto` 에 `appUrl` 필드 미선언 — DTO 와 서비스 레이어 간 타입 불일치
  - 위치: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L5–104 (IntegrationDto 클래스), `backend/src/modules/integrations/integrations.service.ts` L134, L955, L968
  - 상세: `integrations.service.ts` 내부 타입(`PublicIntegration`)은 `appUrl: string | null` 을 포함하고 있으나, Swagger 문서화·클라이언트 계약용 `IntegrationDto` 클래스에는 `appUrl` 필드가 선언되어 있지 않다. 서비스 반환 타입(`PublicIntegration`)과 공식 DTO 클래스(`IntegrationDto`) 가 별개로 유지되는 구조이므로 Swagger 에 `appUrl` 이 문서화되지 않고, 클라이언트가 타입 추론에 `IntegrationDto` 를 사용할 경우 `appUrl` 이 보이지 않는다. 프레젠테이션/비즈니스 레이어 경계가 일부 흐려져 있다.
  - 제안: `IntegrationDto` 에 `@ApiPropertyOptional({ nullable: true, type: 'string' }) appUrl?: string | null;` 을 추가해 Swagger 문서 및 타입 계약을 일치시킨다. 또는 `IntegrationDto` 와 `PublicIntegration` 을 동일 타입으로 통합하여 DTO 계층을 단일화한다.

---

- **[WARNING]** `Cafe24AppUrlCard` 의 Redirect URI 파생이 백엔드 URL 생성 로직과 암묵적으로 결합
  - 위치: `frontend/src/app/(main)/integrations/[id]/cafe24-app-url-card.tsx` L26 (`appUrl.replace(/\/install\/[^/]+$/, "/callback")`)
  - 상세: 프런트엔드가 backend 의 App URL 경로 구조(`/api/3rd-party/cafe24/install/:token`)를 알고 있어야 Redirect URI 를 파생할 수 있다. 현재 regex 치환은 backend 의 경로 변경에 암묵적으로 의존한다. backend 의 `buildOauthCallbackUrl` / `buildCafe24InstallUrl` 이 경로 패턴을 변경하면 프런트엔드는 별도 알림 없이 잘못된 URI 를 표시하게 된다. 레이어 간 암묵적 결합(implicit coupling)이다.
  - 제안: `IntegrationDto.appUrl` 과 함께 `IntegrationDto.callbackUrl: string | null` 을 backend 에서 직접 계산해 내려주거나, App URL 카드에서 표시할 두 값 모두를 backend 가 제공하는 방식으로 경계를 명확히 한다. 현재 백엔드의 `OAuthBeginCafe24PendingResultDto` 가 이미 `appUrl` + `callbackUrl` 을 쌍으로 내려주는 패턴이 있으므로 같은 방식을 상세 페이지 DTO 에도 적용할 수 있다.

---

- **[INFO]** `tryRecoverByMallId` 와 HMAC 알고리즘 공유 — 의존성 역전 잘 구현
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1419
  - 상세: `handleInstall` 과 `tryRecoverByMallId` 가 동일한 `buildHmacMessage` 모듈 레벨 함수를 공유한다. HMAC 알고리즘 변경이 두 호출 경로에 자동으로 적용되는 구조로, 알고리즘이 한 곳에서만 관리된다(단일 진실 원칙). 이번 raw-value 재정정이 두 경로에 모두 즉시 반영된 것이 이 구조의 이점을 보여준다. spec 의 self-check 에서도 이 구조가 명시적으로 확인되었다.
  - 제안: 없음.

---

- **[INFO]** 레이어 책임 분리 — `buildHmacMessage` 가 module-level private 함수로 유지
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1642
  - 상세: HMAC 메시지 빌드 로직이 NestJS 서비스 클래스 외부의 module-level 함수로 선언되어 있다. 이는 (a) 서비스 클래스의 단일 책임을 유지하고, (b) 함수를 테스트에서 독립적으로 다룰 수 있게 하며, (c) NestJS DI 컨테이너와 무관한 순수 함수로 유지한다는 장점이 있다. 단, 동일 파일 내에서만 접근 가능하여 모듈 외부에서 재사용하기 어렵다.
  - 제안: 현재 규모에서는 적합하다. 향후 Cafe24 관련 로직이 분리 모듈로 추출될 경우 유틸 파일로 이동을 고려.

---

- **[INFO]** spec ↔ 구현 ↔ 테스트의 3-layer 정합성 — 이번 변경이 완결한 패턴
  - 위치: `spec/4-nodes/4-integration/4-cafe24.md §9.8`, `backend/...integration-oauth.service.ts`, `backend/...integration-oauth.service.cafe24.spec.ts`
  - 상세: 이번 PR 은 spec 정정(§9.8 알고리즘 재기술 + Rationale 추가) → 구현 변경(`buildHmacMessage` raw 보존) → 테스트 갱신(`computeTestHmac` self-fulfilling 제거 + `%20` 실제 케이스 추가 + 구 알고리즘 거부 케이스 추가) 세 계층이 함께 갱신되었다. cross-spec checker 가 CRITICAL 로 경고했던 spec-구현 불일치가 동일 PR 에서 해소된 구조다. SDD + TDD 방법론이 의도한 대로 적용된 사례.
  - 제안: 없음.

---

- **[INFO]** `logHmacFailure` — 관심사 분리가 잘 된 진단 로깅 패턴
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` L1456–1471
  - 상세: HMAC 검증 실패의 세 분기(mall_id_mismatch, no_client_secret, hmac_verify_failed)가 공통 `logHmacFailure` 메서드로 집약되어 있다. 보안 정책(`client_secret` 미로깅)을 한 곳에서 관리하고, 진단 context(reason, urlMallId, dbMallId, dbAppType, status, statusReason, tokenPreview)를 구조화된 로그 문자열로 일관되게 출력한다. 진단 로깅의 단일 책임 패턴이 잘 적용되어 있다.
  - 제안: 없음.

---

- **[INFO]** `spec/data-flow/5-integration.md` 다이어그램 동기화 — 아키텍처 문서 일관성 회복
  - 위치: `spec/data-flow/5-integration.md` L87–127
  - 상세: callback 성공 시 `install_token=NULL` 을 제거하고 `(install_token + install_token_issued_at 보존 — post-install navigation 식별 키)` 로 정정한 것은 데이터 흐름 레이어 문서와 데이터 모델 레이어 문서 간의 불일치를 해소한다. 이는 아키텍처 설계 문서의 단일 진실 원칙(single source of truth) 적용이다.
  - 제안: 없음.

---

### consistency-checker / review 문서 변경 분석

---

- **[INFO]** consistency-checker 결과물의 구조화된 아키텍처 — checker-per-concern 패턴
  - 위치: `review/consistency/2026/05/16/14_06_49/` 전체 세션
  - 상세: 5개 checker(cross_spec, naming_collision, rationale_continuity, plan_coherence, convention_compliance)가 각자의 관심사(concern)를 독립적으로 검토하고 SUMMARY 가 통합하는 패턴은 관심사 분리(Separation of Concerns) 원칙을 리뷰 프로세스에 적용한 것이다. 각 checker 가 독립 output_file 에 결과를 기록하고 STATUS 한 줄만 반환하는 인터페이스 계약이 명확하다.
  - 제안: 없음.

---

- **[WARNING]** plan frontmatter `worktree` 필드 반복적 미갱신 — 프로세스 아키텍처의 구조적 취약점
  - 위치: `review/consistency/2026/05/16/13_09_46/plan_coherence/review.md`, `review/consistency/2026/05/16/13_29_47/plan_coherence/review.md`, `review/consistency/2026/05/16/13_29_47/convention_compliance/review.md`
  - 상세: Phase 1 → 2 → 3 → 4 로 plan 이 진행되면서 매 Phase 마다 frontmatter 의 `worktree` 필드가 자동 갱신되지 않아 consistency-checker 가 반복적으로 경고를 발생시키고 있다. 이 패턴이 3회의 다른 세션에서 반복 발견된 것은 구조적 문제다 — plan 라이프사이클과 worktree 전환이 자동으로 동기화되지 않는 아키텍처 gap이다. plan 의 Phase 전환 시 frontmatter 갱신이 manual 작업으로 남아 있어 누락이 반복된다.
  - 제안: Phase 전환 시 `worktree` 필드 갱신을 plan 완료 조건(체크박스)으로 명시적으로 포함시키거나, worktree 간 plan 이관 시 갱신을 강제하는 규약을 `CLAUDE.md` 에 추가한다. 또는 Phase 를 동반하는 long-running plan 은 처음부터 Phase 별 별도 plan 문서로 분리하는 것을 고려한다.

---

- **[INFO]** stale worktree 누적 — 관리 정책의 실행 gap
  - 위치: `review/consistency/2026/05/16/13_29_47/SUMMARY.md` "stale worktree 7개"
  - 상세: "PR 머지 즉시 `git worktree remove`" 정책이 있음에도 7개의 stale worktree 가 누적되어 있다. 이는 정책(아키텍처 규약)과 실행 사이의 gap이다. stale worktree 가 `plan_coherence` checker 의 false positive CRITICAL 을 유발하는 노이즈 원인이 되고 있다.
  - 제안: PR merge 완료 후 worktree remove 를 자동화하거나(CI hook 등), plan의 마지막 체크박스로 `[ ] worktree remove 확인` 을 의무화한다.

---

## 요약

이번 변경 세트는 크게 두 축으로 구성된다. 첫째, Cafe24 HMAC raw-value 재정정: `buildHmacMessage` 의 단일 책임 분리, `verifyHmacWithMessage` 와의 명확한 역할 분담, `tryRecoverByMallId` 와의 함수 공유 구조가 모두 적절하다. spec → 구현 → 테스트 세 레이어가 동일 PR 에서 동기화된 점은 SDD/TDD 원칙의 올바른 적용이다. 둘째, Cafe24 App URL 상세 페이지: `Cafe24AppUrlCard` 의 단일 책임은 적절하나, Redirect URI 파생 로직이 frontend 에서 backend URL 경로 패턴을 알아야 하는 암묵적 레이어 결합이 발견된다. `IntegrationDto` 에 `appUrl` 필드가 미선언된 점도 프레젠테이션/비즈니스 레이어 경계의 불완전한 정의다. 프로세스 아키텍처 관점에서 plan frontmatter `worktree` 필드 반복 미갱신과 stale worktree 누적이 구조적 gap 으로 확인되었다.

## 위험도

LOW
