# 정식 규약 준수 검토 — `spec/2-navigation/4-integration.md`

검토 모드: 구현 착수 전 (--impl-prep)
검토 일자: 2026-05-16
대상 파일: `spec/2-navigation/4-integration.md`

---

## 발견사항

- **[INFO]** 문서 구조 — `## Rationale` 섹션 위치 비표준
  - target 위치: 파일 하단 `## Rationale` 섹션 (line ~928)
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 표 — "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: `N-name.md` 형식의 spec 문서는 Rationale 섹션을 본문 끝에 두는 것을 권장하며, 본 문서는 이 패턴을 따르고 있다. 그러나 Rationale 앞에 `---` 수평선 없이 바로 이어지며, CHANGELOG나 최신 항목(`## 13. 데이터 모델 영향 요약`, `## 14. 연관 동작`) 뒤에 Rationale이 오는 순서는 규약이 제시하는 "Overview → 본문 → Rationale" 3섹션 순서와 완전히 일치한다. 형식 자체에 문제는 없으나, Rationale 내 개별 항목들이 `###` 소제목으로 구분되는 방식은 문서가 매우 길어져 내비게이션에 불편함을 줄 수 있다.
  - 제안: 현재 구조는 규약 준수 범위 내. 변경 불필요.

- **[INFO]** 문서 구조 — 권장 3섹션 구성 중 명시적 `## Overview` 섹션 부재
  - target 위치: 파일 상단 (line 1~6)
  - 위반 규약: `CLAUDE.md` — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale"
  - 상세: `spec/2-navigation/4-integration.md`는 단일 spec 파일이므로 CLAUDE.md에 따르면 "본문 상단에 직접 `## Overview` 섹션을 두"는 것이 권장된다. 현재 파일은 관련 문서 링크 블록 후 바로 `## 1. 라우트 구성`으로 시작하며, 별도의 제품 정의 Overview 섹션이 없다. `_product-overview.md`가 영역 레벨에서 존재하므로 본 파일의 Overview 부재가 직접 위반은 아니나, spec 문서의 독립성·자기완결성이 약해진다.
  - 제안: 필수 수정 아님. 다만 향후 개정 시 "## Overview" 섹션(영역 내 이 spec의 목적·사용자 가치 1~2문단)을 상단에 추가하면 CLAUDE.md 권장 구조에 더 부합.

- **[INFO]** error code 표기 혼용 — `snake_case` vs `UPPER_SNAKE_CASE`
  - target 위치: §9.4 공통 응답 포맷 (line ~700–714), §10.4 에러 매핑, Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" (line ~934)
  - 위반 규약: 명시적 규약 파일 없음. 단, `spec/conventions/swagger.md §2-4` 에서 응답 코드 패턴을 정의하며, 문서 자체 Rationale (line 934)이 "DB 컬럼 = snake_case, HTTP API 응답 코드 = UPPER_SNAKE_CASE" 의도적 구분을 설명한다.
  - 상세: `status_reason` 저장값은 `snake_case` (`auth_failed`, `oauth_token_exchange_failed`), API 응답 error code는 `UPPER_SNAKE_CASE` (`OAUTH_TOKEN_EXCHANGE_FAILED`, `CAFE24_INSTALL_INVALID_TOKEN`) 로 이중 표기가 존재한다. 문서의 Rationale이 이를 의도적으로 명시하므로 규약 위반이 아니나, 구현자가 두 체계를 혼동할 여지가 있다. `spec/conventions/` 레벨의 error code 명명 규약 파일이 존재하지 않아 이 이중 표기 정책이 컨벤션으로 공식화되어 있지 않다.
  - 제안: `spec/conventions/` 에 error code 명명 규약(DB 컬럼 snake_case / HTTP 응답 UPPER_SNAKE_CASE 구분)을 별도 파일로 추출하거나, `swagger.md`에 절을 추가해 명시적 컨벤션으로 격상하면 다른 spec 문서에서도 일관성이 보장된다.

- **[WARNING]** API endpoint 명명 — `/api/3rd-party/` 경로가 spec 내 다른 곳에 정의된 컨벤션과 미정합
  - target 위치: §9.2 (line ~684–691), §10.1 (line ~722–724), Rationale "Cafe24 App URL 100자 한도 대응" (line ~986–1001)
  - 위반 규약: `spec/conventions/swagger.md` — API endpoint 명명에 관한 상위 규약 없음. 단, `spec/conventions/` 에 API prefix 규약 파일 자체가 부재하며, 본 문서 내 Rationale이 이 경로 도입을 자체 정당화한다.
  - 상세: `/api/3rd-party/:provider/callback`, `/api/3rd-party/cafe24/install/:installToken` 경로는 Rationale에서 충분히 근거가 설명되어 있으나, "3rd-party"라는 kebab-case 세그먼트가 다른 API endpoint의 camelCase/snake_case 패턴(`/api/integrations`, `/api/integrations/oauth/begin`)과 혼용된다. spec 전반에 API path segment 표기 컨벤션(`kebab-case` 강제 여부)이 공식 문서화되어 있지 않다.
  - 제안: `spec/conventions/swagger.md` 또는 별도 API 명명 컨벤션 파일에 "path segment는 kebab-case" 또는 "소문자 알파벳과 하이픈만 사용" 규칙을 명시. 현재 endpoint 자체는 일관된 kebab-case를 따르므로 즉시 수정 불요, 컨벤션 문서 갱신이 적절.

- **[WARNING]** `spec/conventions/` 참조 방식 — 내부 cross-reference 경로 표기 불일치
  - target 위치: §14.2 (line 917) — `../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계`
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 표 — `spec/conventions/*.md` (평문)
  - 상세: 문서 내 다른 cross-reference는 `[Spec Cafe24 API 메타데이터 §6](../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계)` 형식으로 한국어 앵커를 포함한다. 이 방식 자체는 문서 구조상 문제가 없으나, 앵커 `#6-allowlist-와의-관계`가 실제 `cafe24-api-metadata.md`의 섹션 `## 6. allowlist 와의 관계`와 일치하는지 렌더링 환경에 따라 달라질 수 있다(GitHub Markdown의 한국어 앵커 처리). 이는 명명 규약 위반이 아닌 링크 유효성 문제다.
  - 제안: 앵커 표기를 GitHub Markdown 스펙(`#6-allowlist-와의-관계`는 정상 — 공백→하이픈, 소문자)에 맞게 유지. 별도 수정 불필요.

- **[INFO]** 금지 항목 — 옛 경로 참조 없음 (양호)
  - target 위치: 전체 문서
  - 위반 규약: `CLAUDE.md` — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 신규 문서를 옛 경로 컨벤션으로 만들지 않는다"
  - 상세: 문서 내에 `prd/`, `memory/`, `user_memo/` 경로에 대한 참조나 신규 생성이 없다. 모든 cross-reference가 `spec/`, `plan/`, `review/` 경로를 사용한다.
  - 제안: 해당 없음. 양호.

- **[INFO]** API 문서 규약 — 응답 DTO 명명 패턴 spec 문서에서 확인 불가
  - target 위치: §9.1–§9.3 API 표 (line ~669–698)
  - 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 위치: `backend/src/modules/<module>/dto/responses/*-response.dto.ts`
  - 상세: spec 문서는 API endpoint와 응답 형태를 개략적으로 정의하지만, DTO 클래스명을 직접 명시하지 않는다. 이는 spec 문서의 역할(명세)과 구현 파일(코드)의 역할이 분리된 것으로 정상적인 패턴이다. swagger.md의 DTO 명명 규약은 구현 단계에서 적용되는 것이므로 spec 문서 단계에서 위반이라고 할 수 없다.
  - 제안: 해당 없음. 구현 단계에서 swagger.md §5-1의 `*-response.dto.ts` 패턴을 준수하면 된다.

---

## 요약

`spec/2-navigation/4-integration.md`는 정식 규약(`spec/conventions/**`, `CLAUDE.md` 명명 컨벤션)을 대체로 준수하고 있다. 파일 위치(`spec/<영역>/N-name.md`), 숫자 prefix, `## Rationale` 섹션 포함, cross-reference 형식, 금지 경로 미사용 모두 규약을 따른다. 주요 관찰 사항은 두 가지다: (1) `spec/conventions/` 레벨에 API path segment 명명 규약과 error code 이중 표기(DB snake_case / HTTP UPPER_SNAKE_CASE) 정책을 공식 컨벤션 문서로 격상하면 다른 영역의 spec 개발 시 일관성이 높아진다. (2) 명시적 `## Overview` 섹션이 없어 단일 spec 파일 권장 구조와 약간의 차이가 있으나, 영역 레벨 `_product-overview.md`가 존재하므로 직접적인 위반은 아니다. CRITICAL 또는 채택 차단 수준의 위반 사항은 없다.

---

## 위험도

LOW
