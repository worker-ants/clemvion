# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/1-auth.md`
검토 규약 경로: `spec/conventions/`

---

## 발견사항

### 발견사항 1
- **[INFO]** 문서 구조 — Overview 섹션 부재
  - target 위치: 문서 본문 최상단 (제목 직후, `## 1. 인증` 이전)
  - 위반 규약: CLAUDE.md "정보 저장 위치" — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`. developer/consistency-checker SKILL.md 에서 권장하는 Overview / 본문 / Rationale 3섹션 구성
  - 상세: 문서 상단에 `## Overview` 섹션이 없다. 목차 역할의 소개 단락 없이 바로 `## 1. 인증` 으로 시작한다. 다른 spec 문서(예: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`)는 명시적 `## Overview` 섹션을 보유한다.
  - 제안: `# Spec: 인증/인가 시스템` 제목 아래 `## Overview` 섹션을 추가해 본 문서의 범위·책임 경계·연관 SoT 를 요약한다. 이미 인트로 blockquote(관련 문서 링크)가 있으므로 그 내용을 Overview 단락으로 승격시키는 것으로 충분하다. 단, 기존 3섹션 구성 권장이 "의무" 규약인지 "권장" 규약인지는 SKILL.md 에서만 명시되어 있어 INFO 로 분류한다.

---

### 발견사항 2
- **[INFO]** 문서 구조 — Rationale 섹션 번호 정렬 순서
  - target 위치: `## Rationale` 섹션 (§1.5.A ~ §Production fail-closed 가드)
  - 위반 규약: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`"
  - 상세: Rationale 섹션 자체는 정상적으로 문서 끝에 위치한다. 단 내부 subsection 번호 순서가 비선형 (`1.5.A, 1.5.B, 1.5.C, 1.4.A, 1.4.B, ... 4.1.A`) — 본문의 섹션 번호와 역순 배치다. 이는 가독성 문제이고 규약의 명시적 순서 요구사항은 없으므로 INFO 수준이다.
  - 제안: Rationale 내부 항목을 본문 섹션 번호 순으로 재정렬(`1.4.*` 먼저, `1.5.*` 후, `2.3.A`, `4.1.A` 순) 하면 독자가 본문과 연결해 읽기 쉬워진다. 의무 아님 — 편의성 제안.

---

### 발견사항 3
- **[WARNING]** 에러 코드 표기 — `§1.5.4` 표의 `lower_snake_case` 코드와 historical-artifact 레지스트리 참조 일관성
  - target 위치: `§1.5.4 에러 응답` 표 및 그 아래 주석 블록
  - 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 `UPPER_SNAKE_CASE` 원칙), `§3` (historical-artifact 예외 레지스트리)
  - 상세: 대상 문서 §1.5.4 표는 `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch`, `forbidden`, `rate_limited` 를 `lower_snake_case` 로 표기하고, 해당 주석에서 `error-codes.md §3 historical-artifact 레지스트리`에 등재한다고 명시한다. `error-codes.md §3` 테이블을 확인하면 이 6개 코드가 실제로 등재되어 있다. 따라서 위반 자체는 이미 인지·허용된 상태이며, 레지스트리도 동기화되어 있다.
  - 그러나 주석 내 "신규 코드는 본 예외를 선례로 삼지 않고 처음부터 `UPPER_SNAKE_CASE` 를 쓴다" 라는 안내는 규약과 완전히 일치한다. **문제 없음** — 단 WARNING 으로 기록하는 이유는, `forbidden`·`rate_limited` 처럼 `domain-prefix` 없는 일반 명칭이 lowercase 로 허용된 초대 흐름 전용 예외임을 코드베이스 신규 기여자가 오해할 소지가 있기 때문이다. 주석이 충분히 설명하므로 규약 위반은 아니지만, 해당 주석 문구("초대 흐름 전용 한정 예외")가 `error-codes.md §3` 테이블의 "초대 API 한정" 명시와 완전히 일치함을 확인.
  - 제안: 현재 상태 유지. 이미 레지스트리에 등재되어 있으므로 추가 조치 불필요.

---

### 발견사항 4
- **[INFO]** API 응답 포맷 — `GET /api/auth/2fa/webauthn/availability` 응답 형식
  - target 위치: `§1.4.3` 표 하단 설명 및 `§5 API 엔드포인트` 표 해당 행
  - 위반 규약: `spec/conventions/swagger.md §2-5` (응답 wrapping 규약), `spec/5-system/2-api-convention.md §5.1` (단일 리소스 응답 형식 `{ data: {...} }`)
  - 상세: §1.4.3 에 "응답 `{ data: { enabled: boolean } }`" 로 올바르게 표기되어 있다. 그러나 §5 API 엔드포인트 표에서는 같은 엔드포인트의 응답을 `{ enabled: boolean }` (data 래퍼 없음) 로 표기한다. 두 곳이 불일치한다.
  - `spec/5-system/2-api-convention.md §5.1` 과 `swagger.md §2-5` 는 모든 성공 응답이 `TransformInterceptor` 에 의해 `{ data: ... }` 로 래핑됨을 규약으로 명시한다.
  - 제안: `§5 API 엔드포인트` 표의 해당 행 설명을 `응답: { data: { enabled: boolean } }` 으로 수정해 §1.4.3 과 일치시킨다. 또는 §1.4.3 의 표기가 이미 올바르므로, §5 는 설명 약식 표기로 허용할 수도 있으나 일관성을 위해 통일 권장.

---

### 발견사항 5
- **[INFO]** API 엔드포인트 표 — `GET /api/auth/2fa/webauthn/credentials` 응답 raw 배열 표기
  - target 위치: `§5 API 엔드포인트` 표, `GET /api/auth/2fa/webauthn/credentials` 행
  - 위반 규약: `spec/5-system/2-api-convention.md §5.1` (단일 리소스), `§5.2` (목록 응답 `{ data: [...] }` 래퍼)
  - 상세: 응답 표기가 `[{id, deviceName, transports, lastUsedAt, createdAt}]` — 배열 직접 표기다. `api-convention §5.2` 에 따르면 목록 응답은 `{ data: [...] }` 래퍼 형식이어야 한다. `TransformInterceptor` 가 자동 래핑하므로 실제 응답은 `{ data: [...] }` 이지만 spec 문서 표기는 raw 배열이다.
  - 제안: `응답: { data: [{id, deviceName, transports, lastUsedAt, createdAt}] }` 로 수정해 API convention 과 일치시킨다.

---

### 발견사항 6
- **[INFO]** frontmatter `code:` 경로 범위 — `auth-configs.service.ts` 단일 파일 참조
  - target 위치: frontmatter `code:` 필드, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"이며 글로브 사용 권장
  - 상세: `auth-configs` 모듈은 `auth-configs.service.ts` 단일 파일로만 참조되어 있다. 동 모듈의 컨트롤러·DTO·엔티티(`auth-configs.controller.ts`, `dto/`, `entities/` 등)는 `§3.2` 권한 매트릭스와 `§4.1` 감사 로그가 직접 언급하는 surface 다. spec §1 적용 대상 글로브 허용 패턴(`spec/conventions/spec-impl-evidence.md §R-1`)상 `codebase/backend/src/modules/auth-configs/**/*.ts` 글로브가 더 정확하다.
  - 제안: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` → `codebase/backend/src/modules/auth-configs/**/*.ts` 로 교체. 단 이는 권장 사항이며 빌드 가드(`spec-code-paths.test.ts`)는 `≥1 매치` 만 검증하므로 현재도 가드 통과에는 문제 없다.

---

### 발견사항 7
- **[WARNING]** 감사 로그 액션 표기 일관성 — `auth_config.*` 동사 시제
  - target 위치: `§4.1 기록 대상 액션` 표 및 §4.1 본문 Action naming 규약 설명
  - 위반 규약: `spec/conventions/error-codes.md` 와 직접 관련은 없으나, §4.1 자체가 정의한 naming 규약 내부 일관성 문제
  - 상세: §4.1 첫 단락에서 "integration 은 과거분사(`created`/`updated`/`deleted`)를, auth_config 은 CRUD 동사 현재형(`create`/`update`/`delete`/`regenerate`/`reveal`)으로 통일한다" 고 명시한다. 실제 표에도 `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal` 로 현재형이 사용되어 있다. 이 자체는 내부적으로 일관된다.
  - 그러나 §4.1.A Rationale 에서 "나머지 Planned 액션의 시제도 정규화한다 ... `model_config.*` 는 resource 단위 현재형 예외를 유지한다" 로 설명하며, `auth_config` 과 `model_config` 가 같은 예외 그룹임을 선언한다. 이 내용이 §4.1 본문의 naming 규약 단락에서도 한번 더 설명되어 있어 **중복 설명**이 존재한다 (본문 정의 + Rationale 재설명). 중복 자체가 위반은 아니지만 단일 진실 원칙(CLAUDE.md "단일 진실 원칙") 관점에서 한 곳이 SoT 임을 명확히 하는 것이 좋다.
  - 제안: §4.1 본문의 naming 규약 단락이 SoT 이고 Rationale §4.1.A 는 결정 근거라는 역할 분리가 이미 되어 있으므로 현재 구조는 수용 가능하다. 단, Rationale §4.1.A 의 표기가 본문 표와 완전히 일치하는지 확인 권장 — 특히 Rationale 에서 "현재형 create·invite 이탈 정정" 이라고 Planned 표를 정규화하는 내용이 §4.1 Planned 표에도 반영되어 있는지 검토. 확인 결과 §4.1 Planned 표의 `member` 액션이 `member.invited` 로 표기되어 있어 Rationale §4.1.A 의 "과거분사로 정규화 = `invited`" 와 일치한다. **일관성 문제 없음**.

---

### 발견사항 8
- **[INFO]** 문서 제목 스타일 — `# Spec: 인증/인가 시스템`
  - target 위치: 문서 최상단 H1 제목 (`line 16`)
  - 위반 규약: 명시적 규약 없음. `spec/conventions/` 내 다른 문서들의 패턴 비교
  - 상세: `spec/conventions/` 의 문서들(`error-codes.md`, `node-output.md`, `swagger.md`, `spec-impl-evidence.md`)은 `# <제목>` 형태를 사용한다. `spec/5-system/` 의 이 문서는 `# Spec: 인증/인가 시스템` — "Spec:" prefix 가 있다. 다른 5-system 문서들도 `# Spec: API 설계 규칙`, `# Spec: 에러 처리` 등 동일 패턴을 사용한다. 즉 `5-system/` 폴더 내에서는 "Spec:" prefix 가 일관되게 사용되어 있다. 규약 위반 아님. INFO 로 기록 — 폴더 전체가 같은 패턴을 사용하므로 문제 없다.
  - 제안: 현재 상태 유지.

---

## 요약

`spec/5-system/1-auth.md` 는 전반적으로 정식 규약을 준수하고 있다. 가장 주목할 점은 §1.5.4 의 `lower_snake_case` 에러 코드가 `error-codes.md §3 historical-artifact 레지스트리` 에 이미 등재되어 있고, 문서 내 주석도 이를 명시적으로 설명하는 자기 문서화가 잘 되어 있다는 점이다. `spec-impl-evidence.md §2` 의 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)도 모두 올바르게 작성되어 있다. 발견된 이슈는 대부분 API 응답 표기의 미세한 불일치(§5 표에서 `data` 래퍼 누락)와 문서 구조 권장사항(Overview 섹션 부재) 수준이다. 규약의 invariant 를 직접 깨는 CRITICAL 수준 위반은 없다.

## 위험도

LOW
