# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-14
검토 범위: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (payload 내 제공된 파일 한정)

---

## 발견사항

### 1. 에러 코드 케이싱 — historical-artifact 레지스트리 등재 확인

- **[INFO]** `1-auth.md §1.5.4` 에서 초대 에러 코드(`invitation_not_found` 등)가 `lower_snake_case` 로 표기되어 있으나, 문서 내 명시 주석에서 `error-codes.md §3` historical-artifact 레지스트리 등재를 직접 인용하고 이유를 설명하고 있음.
  - target 위치: `spec/5-system/1-auth.md §1.5.4 에러 응답` 주석 블록
  - 위반 규약: `spec/conventions/error-codes.md §1` UPPER_SNAKE_CASE 원칙
  - 상세: 규약 위반이지만 `error-codes.md §3` 예외 레지스트리에 명시적으로 등재되어 있어 정당 처리된 상태. `forbidden`·`rate_limited` lowercase 표기도 "초대 API 한정" 으로 명시적으로 범위 제한됨.
  - 제안: 현행 유지(준수). 추가 조치 불필요.

---

### 2. WebAuthn availability 응답 포맷 — 동일 응답에 대한 이중 표기 불일치

- **[WARNING]** `1-auth.md §1.4.3` 에서 `GET /auth/2fa/webauthn/availability` 응답을 `{ data: { enabled: boolean } }` (래퍼 포함 형태)로 표기하는 반면, `§5 API 엔드포인트` 표에서는 `응답: { data: { enabled: boolean } }` 으로 표기해 형태는 일치하나, 다른 엔드포인트들이 내부 페이로드 형태만 표기하는 관행과 혼재됨.
  - target 위치: `spec/5-system/1-auth.md §1.4.3` 및 `§5 API 엔드포인트` 표
  - 위반 규약: `spec/conventions/swagger.md §2-5` — 응답 형태 표기의 일관성 (TransformInterceptor 래퍼 포함 여부)
  - 상세: `{ data: { enabled: boolean } }` 자체는 `TransformInterceptor` 자동 래핑과 일치하는 올바른 와이어 형태. 그러나 spec 내 API 응답 표기 일관성 측면에서, 일부 곳은 래퍼 포함, 일부는 페이로드만 표기하는 혼재가 발생하면 구현자 혼선이 생길 수 있음.
  - 제안: spec 내 응답 포맷 표기를 일관하게 정리. 모두 래퍼 포함 형태(`{ data: ... }`)로 통일하거나, 모두 DTO 내용(래퍼 없음)으로 통일하되 "TransformInterceptor 가 래핑" 임을 서두에서 단 한 번 명기. 이미 내용상 문제는 없으므로 표기 통일 수준의 수정임.

---

### 3. `10-graph-rag.md` — 3섹션 구성 규약 부분 이탈

- **[INFO]** `spec/5-system/10-graph-rag.md` 는 `## Overview (제품 정의)` 는 있으나 문서 말미에 별도 `## Rationale` 섹션이 없음. 기술 결정의 근거는 `### 4. 기술 결정 사항` 표로 본문에 흡수되어 있음.
  - target 위치: `spec/5-system/10-graph-rag.md` 전체 구조
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
  - 상세: 3섹션 구성은 권장이며 강제가 아님. 기술 결정·근거가 본문 표에 흡수되어 있어 내용상 공백은 없음. 단 외부 문서에서 Rationale 앵커(`#rationale`)를 직접 참조하는 경우 링크가 깨질 수 있음.
  - 제안: 섹션 말미에 `## Rationale` 를 추가하고 주요 설계 근거(PostgreSQL vs 전용 그래프 DB 선택, 생성 시 불변 모드, 추출 LLM 분리 등)를 이동하면 규약 정렬 및 앵커 참조 안정성이 향상됨. 필수 수정 아님.

---

### 4. 감사 액션 명명 규약 — 완전 준수 확인

- **[INFO]** `1-auth.md §4.1` 의 감사 액션 카탈로그가 `audit-actions.md §1, §2, §3` 과 완전히 정렬됨.
  - target 위치: `spec/5-system/1-auth.md §4.1`
  - 위반 규약: 없음
  - 상세: `<resource>.<verb>` 구조, 토큰 내 언더스코어, 시제 3분류(과거분사/현재형/도메인 고유) 모두 준수. Planned 액션도 `audit-actions.md §3` 레지스트리와 일치.

---

### 5. `1-auth.md` Overview 섹션 부재

- **[INFO]** `spec/5-system/1-auth.md` 는 명시적 `## Overview` 섹션 없이 관련 문서 링크 후 바로 `## 1. 인증` 으로 시작함.
  - target 위치: `spec/5-system/1-auth.md` 파일 서두
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
  - 상세: 3섹션 구성 권장의 일부. 문서 자체로 맥락이 충분히 명확하나, 입문 독자를 위한 한 줄 요약이 없음.
  - 제안: 파일 서두에 간략한 `## Overview` 추가. 강제 아님.

---

### 6. 신규 에러 코드 UPPER_SNAKE_CASE 준수 확인

- **[INFO]** `1-auth.md §5` WebAuthn 관련 신규 에러 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`) 전부 UPPER_SNAKE_CASE.
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트`
  - 위반 규약: 없음 — `spec/conventions/error-codes.md §1` 및 `spec/conventions/node-output.md §3.2` 준수

---

### 7. `1-auth.md` — SoT 분리 및 교차 참조 일관성

- **[INFO]** `§4.1` 에서 "Action naming·시제 규약의 SoT 는 `conventions/audit-actions.md`" 임을 명시하며, `§3.2` 에서 "Auth Config Reveal 권한 분리 근거"를 포함 RBAC 관련 근거를 Rationale 로 위임. 단일 진실 원칙 및 책임 분리 규약 준수.
  - target 위치: `spec/5-system/1-auth.md §4.1`, `§3.2`
  - 위반 규약: 없음

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 정식 규약을 전반적으로 충실히 준수하고 있다. 에러 코드 명명(`UPPER_SNAKE_CASE`)은 신규 코드 전체가 준수되며, `lower_snake_case` 예외는 `error-codes.md §3` 레지스트리에 명시적으로 등재·정당화되어 있다. 감사 액션 명명은 `audit-actions.md` 의 3분류 시제 체계와 완전 정렬된다. 주요 지적 사항은 경미한 WARNING 1건(WebAuthn availability 응답 포맷 이중 표기 불일치)과 INFO 수준의 문서 구조 권장 미이행 2건이다. CRITICAL 위반은 없다.

## 위험도

LOW
