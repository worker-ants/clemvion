# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (구현 착수 전 --impl-prep) + 관련 `spec/conventions/`  
검토 일시: 2026-05-25  
검토 범위: 1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md (일부),  
           spec/conventions/cafe24-api-catalog/{application,category,collection}.md,  
           spec/conventions/cafe24-api-catalog/_overview.md

---

## 발견사항

### 발견 1

- **[CRITICAL]** `spec/5-system/10-graph-rag.md` — `status: spec-only` 와 `code: []` 인데 본문 Overview 에서 구현 완료 선언 불일치
  - target 위치: `spec/5-system/10-graph-rag.md` frontmatter (line 3–4) + Overview 섹션 (line 13–16)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` — `status: implemented` 는 `code: ≥1 매치 의무`. 본문 Overview 에 `> **구현 상태**: ✅ **P0~P2 구현 완료** (검증 일자: 2026-05-11)` 라고 명시돼 있고, 마이그레이션 파일(`V025__graph_rag.sql` ~ `V027__relation_head_tail_index.sql`), BullMQ 큐(`graph-extraction`), 컴포넌트(`graph-3d-renderer.tsx`, `entity-list.tsx`, `relation-list.tsx`) 등 구체적 구현 경로까지 언급하면서 frontmatter 의 `status`는 `spec-only`, `code`는 빈 배열로 남아 있다.
  - 상세: `spec-impl-evidence` 컨벤션은 `status: spec-only` 에 90일 TTL 을 두고, 구현이 완료된 spec 은 `status: implemented` + `code: [...]` 에 실제 파일 경로를 채우도록 의무화한다. 본 spec 은 PR #294(2026-05-23) 에서 일괄 frontmatter 가 붙을 때 초기값 `spec-only`/`code: []` 그대로 남겨진 것으로 보이나, 본문이 스스로 "구현 완료"를 선언하고 있어 이미 invariant 가 깨진 상태다. `spec-code-paths.test.ts` 가 `status: implemented` 또는 `partial` 일 때만 `code:` 매치를 강제하므로, `spec-only`로 두는 한 빌드 가드에는 잡히지 않지만 단일 진실 원칙을 위반한다.
  - 제안: frontmatter 를 `status: implemented` 로 변경하고, `code:` 에 구현 경로를 채운다.
    ```yaml
    status: implemented
    code:
      - codebase/backend/src/modules/knowledge-base/graph/**
      - codebase/frontend/src/components/knowledge-base/graph-3d-renderer.tsx
    ```
    P2 이후 미구현 항목이 있다면 `status: partial` + `pending_plans:` 로 처리.

---

### 발견 2

- **[WARNING]** `spec/5-system/1-auth.md` — 구현 완료된 spec 인데 `status: spec-only`, `code: []`
  - target 위치: `spec/5-system/1-auth.md` frontmatter (line 3–4)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` — 인증 시스템(JWT, OAuth, WebAuthn, TOTP 등)은 이미 여러 PR 에서 구현됐으나 frontmatter 가 이를 반영하지 않는다.
  - 상세: `spec-impl-evidence` §6 롤아웃 정책에 따르면 PR #294 에서 "기존 머지된 PR 로 구현 완료된 spec → `implemented` + `code:` 채움" 이 원칙이다. auth spec 은 `codebase/backend/src/modules/auth/` 디렉토리 전체가 구현돼 있고, WebAuthn(PR #225/#226), TOTP, OAuth 등 다수의 구현 PR 이 존재한다. 90일 TTL 내에 있어 빌드 가드에는 잡히지 않지만, 롤아웃 원칙에서 벗어난다.
  - 제안: `status: implemented` + `code: [codebase/backend/src/modules/auth/**]` 로 갱신. 미구현 부분(LDAP §1.3, SAML §1.3 등)이 있다면 `status: partial` + `pending_plans:` 로 처리.

---

### 발견 3

- **[WARNING]** `spec/5-system/1-auth.md §1.5.4` — invitation 에러 코드가 `lower_snake_case` 로 표기돼 API 에러 코드 규약과 불일치
  - target 위치: `spec/5-system/1-auth.md` §1.5.4 에러 응답 표 (line 240–245)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.3 에러 응답` — 에러 `code` 필드 예시가 `"VALIDATION_ERROR"` (UPPER_SNAKE_CASE). `spec/5-system/3-error-handling.md §` — `code: UPPER_SNAKE_CASE 에러 코드` 명시.
  - 상세: §1.5.4 의 invitation 에러 코드(`invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited`)는 모두 `lower_snake_case` 다. 반면 같은 spec 내 §1.4 WebAuthn 에러 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`)는 `UPPER_SNAKE_CASE` 를 사용해 동일 문서 안에서 이중 표기가 혼재한다. API 에러 응답 컨벤션은 `UPPER_SNAKE_CASE` 를 사용한다.
  - 제안: §1.5.4 의 에러 코드를 `UPPER_SNAKE_CASE` 로 통일한다.
    ```
    invitation_not_found      → INVITATION_NOT_FOUND
    invitation_expired        → INVITATION_EXPIRED
    invitation_already_used   → INVITATION_ALREADY_USED
    invitation_email_mismatch → INVITATION_EMAIL_MISMATCH
    forbidden                 → FORBIDDEN (또는 기존 API 전역 코드와 맞춤)
    rate_limited              → RATE_LIMITED
    ```
    단, 이미 구현 코드와 e2e 테스트가 `lower_snake_case` 를 사용하고 있다면 규약 자체를 갱신하거나, 구현과 spec 을 동시에 정렬해야 한다.

---

### 발견 4

- **[WARNING]** `spec/5-system/10-graph-rag.md` — 문서 구조에 `## Overview (제품 정의)` 섹션과 `## 1. 개요` 섹션이 중복 존재
  - target 위치: `spec/5-system/10-graph-rag.md` line 13 (`## Overview`) + line 190 (`## 1. 개요`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장". 상단 `## Overview` 가 product-definition 역할을 하면 기술 명세 본문은 그 아래에 바로 와야 하는데, 본문 부분(`## 1. 개요`)이 별도 H2 절로 반복 등장해 위계가 모호하다.
  - 상세: `## Overview (제품 정의)` 내부에서 `### 1. 목표`, `### 2. 범위`, `### 3. 요구사항`, `### 4. 기술 결정 사항`, `### 5. 비기능 요구사항`, `### 6. 단계별 도입`이 H3 으로 나열된 뒤, 다시 `## 1. 개요`, `## 2. 데이터 모델`, `## 3. 그래프 추출 파이프라인` 등 H2 가 시작된다. 사실상 PRD(Overview 구간)와 기술 명세(1. 개요 이후)가 한 파일에 혼재하는 2-part 구조인데, 양쪽 모두 H2 레벨로 선언돼 구조 위계가 흐려진다.
  - 제안: `## 1. 개요` 를 `## Overview` 내부 마지막 H3 (`### 7. 기술 구현 개요`) 로 흡수하거나, Overview 구간을 `_product-overview.md` 로 분리하고 본 파일을 기술 명세만 남기는 방향으로 정리. 또는 기존 Overview 구간을 H3 으로 강등(`### Overview`)해 기술 명세 본문 H2 과 위계를 분리.

---

### 발견 5

- **[WARNING]** `spec/5-system/11-mcp-client.md` — `## Overview` 섹션과 `## Rationale` 섹션이 모두 없음
  - target 위치: `spec/5-system/11-mcp-client.md` — H2 레벨 섹션 전체
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: `11-mcp-client.md` 는 `## 1. 개요`, `## 2. Transport`, ..., `## 12. 확장 포인트` 로 구성돼 있다. `## Overview` (제품 정의 위치) 도 없고 `## Rationale` (결정 배경) 도 없다. `## 2.2 stdio 미지원 사유` 처럼 개별 결정 근거가 본문 안에 인라인으로 흩어져 있어 권장 3섹션 구조를 따르지 않는다.
  - 제안: 파일 상단에 `## Overview` 를 추가해 목표·범위·제품 맥락을 요약하고, 파일 하단에 `## Rationale` 섹션을 추가해 주요 설계 결정(stdio 미지원, Internal Bridge 패턴 채택, 도구 평탄화 모델 선택 등)의 근거를 모은다. 이 변경이 과도하다고 판단하면 규약 갱신이 필요함.

---

### 발견 6

- **[WARNING]** `spec/conventions/cafe24-api-catalog/{application,category,collection}.md` — `status: spec-only`, `code: []` 인데 카탈로그-동기 테스트와 backend 메타데이터가 이미 존재
  - target 위치: 세 파일 모두 frontmatter (line 3–4)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 시 `code: ≥1 매치 의무`. 카탈로그 파일이 규약(Convention)을 정의하고 해당 규약의 구현 증거(`catalog-sync.spec.ts`, `codebase/backend/src/nodes/integration/cafe24/metadata/*.ts`)가 이미 존재한다면 `status: implemented` 가 맞다.
  - 상세: `spec/conventions/cafe24-api-catalog/_overview.md §4` 에서 `catalog-sync.spec.ts` 가 이 카탈로그 파일들과 backend 메타데이터를 양방향 동기 검증한다고 명시하고, 세 파일 모두 `status: supported` 행만 있고 `planned: 0` 이다. 즉 이미 `implemented` 상태다. PR #294 일괄 롤아웃 시 초기값으로 `spec-only` 를 썼지만 사실과 다르다.
  - 제안: 세 파일 모두 아래와 같이 갱신한다.
    ```yaml
    status: implemented
    code:
      - codebase/backend/src/nodes/integration/cafe24/metadata/<resource>.ts
      - codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts
    ```

---

### 발견 7

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` — frontmatter 없음 (규약 적용 제외 대상이나 명시적 확인 필요)
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` 파일 상단
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — `_*.md` (밑줄 prefix) 는 frontmatter 의무 제외 대상으로 명시.
  - 상세: `_overview.md` 는 `_` prefix 이므로 규약상 frontmatter 가 없어도 정상이다. 다만 다른 카탈로그 파일(`application.md`, `category.md` 등)은 frontmatter 를 갖는데 `_overview.md` 만 없어서 읽는 측에서 규약 적용 경계가 불명확하게 보일 수 있다. 현재 규약은 올바르게 설계돼 있으며 변경 불필요.
  - 제안: 변경 필요 없음. 규약 문서(`spec-impl-evidence.md §1`)의 "제외" 목록 설명이 이미 명확하므로 현 상태 유지.

---

### 발견 8

- **[INFO]** `spec/5-system/11-mcp-client.md §6.2` — `skipReason` 값이 `lower_snake_case` 이고 본문에서 `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 와 구분됨을 직접 명시하고 있음 — 규약 충돌이 아니라 의도적 예외이나 spec 자체에 이 결정의 위치가 아닌 곳에 있다
  - target 위치: `spec/5-system/11-mcp-client.md §6.2 skipReason vocabulary` 주석 블록
  - 위반 규약: 해당 없음 — spec 이 `node-output.md §3.2` 와의 차이를 인라인으로 명시함.
  - 상세: `skipReason` 값은 `lower_snake_case` (예: `expired_install_timeout`, `error`, `pending_install`) 이고 에러 코드 `code` 는 `UPPER_SNAKE_CASE` (예: `MCP_CONNECT_FAILED`) 로 두 가지가 혼용된다. spec 이 이를 "운영 진단용 enum 이라 구분된다"고 직접 설명하므로 규약 위반은 아니다. 다만 해당 설명이 인라인 주석에 있어 `Rationale` 섹션이 없는 본 파일의 결정 근거 추적성이 낮다는 점은 발견 5(Rationale 부재)와 연결된다.
  - 제안: 발견 5 에서 `## Rationale` 섹션을 추가할 때 이 설계 결정도 함께 이동.

---

## 요약

`spec/5-system/` 검토 범위 내에서 정식 규약 직접 위반은 1건(CRITICAL), 규약과 거리감이 있는 패턴은 5건(WARNING), 참고 사항은 2건(INFO) 발견됐다. 가장 심각한 것은 `10-graph-rag.md` 의 frontmatter 와 본문이 서로 상반된 구현 상태를 주장하는 것으로(`status: spec-only` vs 본문 `P0~P2 구현 완료`), `spec-impl-evidence` 컨벤션의 invariant 를 직접 위반한다. 그 외 `1-auth.md` 의 invitation 에러 코드 케이스 불일치(lower vs UPPER), `10-graph-rag.md` 의 이중 Overview 구조, `11-mcp-client.md` 의 3섹션 누락, cafe24 카탈로그 파일들의 stale frontmatter status 가 WARNING 수준으로 발견됐다. 발견 1(CRITICAL) 은 구현 착수 전 정정이 필요하며, 발견 3(WARNING, 에러 코드 케이스)은 구현 코드와 정렬이 필요하므로 착수 전 확인이 권장된다.

---

## 위험도

**MEDIUM**
