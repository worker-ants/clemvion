# Documentation Review

## 발견사항

### [INFO] `AttentionBreakdown` 인터페이스 JSDoc 품질 양호
- 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `AttentionBreakdown` 인터페이스
- 상세: `mostUrgentId` 필드에 JSDoc이 작성되어 있으며, 단일 행 UX/복수 행 시맨틱을 명확히 설명한다. `total === 1` 가드 조건을 호출자에게 명시적으로 고지하는 점도 적절하다.
- 제안: 현 수준 유지. 다만 `expired`/`expiring`/`error` 필드에도 간략한 한 줄 JSDoc을 추가하면 자동완성 툴팁 품질이 높아진다.

---

### [INFO] `computeAttentionBreakdown` 함수 JSDoc 품질 양호
- 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `computeAttentionBreakdown` 함수 위 JSDoc 블록
- 상세: spec 섹션 번호(§2.4), `needsAttention()` 재사용 의도, "단일 진실" 유지 목적이 모두 기술되어 있다. 신규 기여자가 함수를 독립적으로 이해할 수 있는 수준이다.
- 제안: 반환 타입이 인터페이스로 분리된 만큼 `@returns {AttentionBreakdown}` 태그를 추가하면 TypeDoc/IDE 연동 시 더 완전한 문서가 생성된다.

---

### [INFO] 인라인 주석이 비즈니스 의도를 충분히 설명
- 위치:
  - `backend/src/modules/integrations/integrations.service.ts` — `attention` 분기 내 `// Virtual filter — ...` 주석
  - `frontend/src/app/(main)/integrations/page.tsx` — `AttentionBanner` 함수 상단 주석 블록
  - `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` — `// connected + expiring-soon — needsAttention guarantees this branch.` 주석
- 상세: `pending_install` 제외 근거(spec §2.4), "가상 필터(Virtual filter)" 개념, 단일 행 점프 vs. 다중 행 필터 분기 이유가 각각 해당 위치에서 설명된다. 코드와 주석이 일치한다.
- 제안: 현 수준 유지.

---

### [WARNING] `INTEGRATION_STATUSES` 상수 블록 주석에 `expiring` 정의가 `§2.3`에만 연결되고 `§9.1`은 없음
- 위치: `backend/src/modules/integrations/dto/integration.dto.ts` — 상수 위 블록 주석 (diff +35~+40행)
- 상세: 주석에 `expiring = status='connected' AND token_expires_at within 7d` 정의가 기재되어 있으나 인용 섹션이 `§2.3 + §9.1 + Rationale "Attention 가상 필터값"`으로 나열된다. 실제 spec §9.1은 API 계약(가상 필터값 규약)을 담는 섹션이며, `expiring`의 서버-측 변환 규칙은 §9.1에 있어야 한다. 주석이 틀리지는 않지만, 이 레벨에서 참조 섹션이 3개나 나열되면 유지 보수 시 정합성 깨지기 쉽다.
- 제안: 주석을 `// See spec §9.1 (virtual filter contract) and Rationale "Attention 가상 필터값"` 한 줄로 단순화하거나, 각 섹션이 무엇을 담는지 한 단어씩 부가하라 (예: `§9.1 API-contract`, `§2.3 UI`).

---

### [WARNING] `AttentionBanner` 컴포넌트에 공개 Props 타입 JSDoc 없음
- 위치: `frontend/src/app/(main)/integrations/page.tsx` — `AttentionBanner` 함수 파라미터 타입 리터럴 (diff +573~+579행)
- 상세: `AttentionBanner`는 내부(non-export) 컴포넌트이므로 엄밀한 의미의 "공개 API"는 아니다. 그러나 `breakdown`과 `onActivate`의 역할 분리가 코드를 처음 보는 사람에게 바로 명확하지 않다(특히 클릭 핸들러가 왜 부모에 있는지). 현재 함수 위 주석 블록이 이를 부분적으로 설명하지만 파라미터 인라인 설명은 없다.
- 제안: Props 타입을 named 인터페이스(`interface AttentionBannerProps`)로 분리하고, `onActivate`에 `/** 1-row → detail jump, N-row → attention filter. Owned by parent to co-locate URL logic. */` 수준의 JSDoc을 추가한다.

---

### [WARNING] 삭제된 i18n 키(`attentionPrefix`, `attentionSuffix`, `attentionSingle`)에 대한 마이그레이션 주석 없음
- 위치:
  - `frontend/src/lib/i18n/dict/en/integrations.ts` (diff -691, -692, -707)
  - `frontend/src/lib/i18n/dict/ko/integrations.ts` (diff -731, -732, -747)
- 상세: 세 개의 i18n 키가 삭제되었다. 해당 키를 외부 번역 시스템(TMS, Phrase, Crowdin 등)에서 관리 중이라면 키 삭제 시 별도 프로세스가 필요할 수 있다. 코드 자체에 "삭제 이유" 또는 "대체 키" 정보가 남아 있지 않다.
- 제안: 삭제 커밋 메시지 또는 plan 문서에 "대체 키: `attentionTitlePlural`, `attentionTitleSingle`, `attentionBreakdownExpired/Expiring/Error`"를 명시한다. plan/in-progress/integration-attention-filter.md §i18n 항목이 이미 이를 설명하고 있으나, plan 문서는 코드 리포지터리 기여자가 코드 파일만 보는 경우에는 보이지 않는다.

---

### [WARNING] plan 체크리스트 항목이 아직 미완료 상태
- 위치: `plan/in-progress/integration-attention-filter.md` — 작업 체크리스트 (diff +849~+856)
- 상세: 다음 항목들이 `[ ]`(미완료)로 남아 있다:
  - i18n dict 갱신
  - backend status='attention' 분기 + 단위 테스트
  - frontend banner/filter/jump 구현 + 단위 테스트
  - TEST WORKFLOW (lint·unit·build·e2e)
  - /ai-review + RESOLUTION
  실제 diff에서 이 모든 구현이 이미 완료된 것처럼 보이는데, plan 문서와 코드 상태가 불일치한다.
- 제안: 리뷰 제출 전에 완료된 항목을 `[x]`로 표시하고 plan을 최신 상태로 동기화한다. CLAUDE.md 규약상 "작업 이후: 결과를 해당 위치의 살아있는 문서에 반영"이 필수 절차다.

---

### [WARNING] `ListStatusFilter` 타입 주석이 `IntegrationStatus` 타입과의 관계를 설명하지 않음
- 위치: `frontend/src/lib/api/integrations.ts` — `ListStatusFilter` 타입 정의 위 주석 (diff +660~+664)
- 상세: 추가된 주석이 `attention`/`expiring`이 가상 필터값임을 잘 설명한다. 그러나 `IntegrationStatus`(DB enum: `connected`/`expired`/`error`/`pending_install`)와 `ListStatusFilter`(API 쿼리 파라미터: 가상값 포함)의 의도적 분리에 대한 언급이 없다. 두 타입이 왜 다른지 파악하는 데 시간이 걸린다.
- 제안: 주석에 `// Superset of IntegrationStatus — includes virtual values that the backend expands into compound WHERE clauses.` 한 줄을 추가한다.

---

### [INFO] 테스트 파일 내 spec 섹션 참조 주석이 일관되고 유용함
- 위치:
  - `backend/src/modules/integrations/integrations.service.spec.ts` — `// attention is a virtual filter value (spec/2-navigation/4-integration.md §2.4 + §9.1 ...)` 블록
  - `frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx` — `// spec/2-navigation/4-integration.md §2.4 — "Need attention" banner`
  - `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` — `// spec/2-navigation/4-integration.md §2.4 + Rationale "Attention 가상 필터값"`
- 상세: 테스트 파일 상단/describe 블록에 spec 섹션을 인용하는 패턴이 전 파일에 걸쳐 일관되게 적용되어 있다. 테스트가 왜 존재하는지, 어느 요구사항을 검증하는지가 즉시 파악된다.
- 제안: 현 수준 유지. 이 패턴을 프로젝트 전반의 테스트 작성 규약으로 명문화할 것을 권장한다.

---

### [INFO] Swagger `description` 필드 업데이트로 API 문서 자동 반영
- 위치: `backend/src/modules/integrations/dto/integration.dto.ts` — `@ApiPropertyOptional` `description` 필드 (diff +54~+55)
- 상세: `attention=주의 필요(가상 — expired ∪ expiring ∪ error). expiring/attention 은 DB Enum 에 없는 가상 필터값으로 서버에서 합집합 WHERE 절로 변환된다 (spec §9.1).`로 갱신되어 Swagger UI에 변경된 동작이 자동으로 노출된다. `example`도 `'attention'`으로 변경되어 가상 필터를 대표 예시로 보여준다.
- 제안: 현 수준 유지.

---

### [INFO] README 업데이트 필요성 없음
- 위치: 루트 `README.md`
- 상세: 이번 변경은 통합 목록 페이지의 UX 개선(배너 상세화 + 가상 필터 추가)이며, 서비스 실행 방법이나 환경변수 구성에 영향을 주지 않는다. README 갱신 불필요.
- 제안: 해당 없음.

---

### [INFO] 신규 환경변수·설정 옵션 없음
- 위치: 전체 diff
- 상세: 이번 변경에서 신규 환경변수나 서버 설정 옵션이 추가되지 않았다. `7 days` 만료 임박 기준이 하드코딩되어 있으나(service.ts SQL 내), 이 값은 spec에 명시된 상수이며 환경별로 달라지는 설정이 아니다.
- 제안: 향후 이 기준을 환경 설정으로 외부화할 경우 `.env.example` 및 README에 문서화가 필요하다.

---

### [INFO] CHANGELOG 업데이트 필요성
- 위치: 루트 또는 패키지별 `CHANGELOG.md`
- 상세: 프로젝트 내에 공식 CHANGELOG 파일이 사용되는지 diff에서 확인되지 않는다. 다만 `plan/in-progress/integration-attention-filter.md`가 변경 이력의 역할을 겸하고 있으며, 본 변경은 사용자 가시 기능 추가(배너 상세화, 가상 필터 칩 추가)에 해당하므로 CHANGELOG가 운영 중이라면 항목 추가가 필요하다.
- 제안: 프로젝트에서 CHANGELOG를 운영 중이라면 `## [Unreleased]` 섹션에 "Integrations 페이지 Attention 배너 분해 카운트 표시 및 `?status=attention` 가상 필터 추가" 항목을 추가한다.

---

## 요약

이번 변경은 "주의 필요" 배너의 분해 카운트 표시와 `attention` 가상 필터 도입을 다루며, 문서화 측면에서 전반적으로 높은 수준을 보인다. `computeAttentionBreakdown` JSDoc, 인라인 `// Virtual filter` 주석, 테스트 파일의 spec 섹션 인용, Swagger `description` 갱신 등 핵심 변경 지점의 문서화가 충실하다. 주요 지적 사항은 plan 체크리스트가 코드 완료 상태를 반영하지 못해 `[x]` 갱신이 필요한 것(CLAUDE.md 규약 위반), 삭제된 i18n 키에 대한 대체 키 명시가 코드 파일 수준에서 없는 것, 그리고 `ListStatusFilter`와 `IntegrationStatus` 두 타입의 의도적 분리에 대한 설명이 한 문장 보강되면 더 명확해진다는 점이다. `AttentionBanner` 내부 컴포넌트의 Props 분리 및 JSDoc 추가는 선택적 개선 사항이다.

## 위험도

LOW
