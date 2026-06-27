# 정식 규약 준수 검토 — `spec/7-channel-web-chat/4-security.md`

검토 모드: `--spec`
대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md`

---

## 발견사항

### 문서 구조 규약

- **[INFO]** `id` 가 basename 과 다르나 주석으로 의도 명시됨 — 규약 준수
  - target 위치: frontmatter `id: web-chat-security` (basename `4-security`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
  - 상세: `id: web-chat-security` 는 basename `4-security` 와 다르다. 그러나 frontmatter 주석이 "타 영역의 `4-security` 슬러그와 충돌 방지 (영역 prefix `web-chat-` 로 전역 유일)" 라고 명시했고, `spec-impl-evidence.md §2.1` 의 "충돌 방지를 위한 prefix 패턴" 과 정확히 일치한다. 실제로 다른 영역에 동명 파일이 존재하지 않음을 확인(`find` 결과 유일)했으나, 규약은 **충돌 가능성**을 근거로 prefix 를 허용하므로 문서 내 주석 설명으로 충분히 정당화된다.
  - 제안: 현행 유지 OK. 다만 현재로서는 충돌 대상이 없으므로 basename 기반 `id: 4-security` 로 단순화하는 것도 가능하다 — 규약 위반이 아니라 선택의 문제.

- **[INFO]** `## Overview` → 본문 → `## Rationale` 3섹션 구조 완전 준수
  - target 위치: 문서 전체 구조
  - 위반 규약: 없음. CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 충족.
  - 상세: `## Overview`, 본문 `§1–§6`, `## Rationale (§R1–§R5)` 가 모두 존재한다.
  - 제안: 해당 없음.

### 명명 규약

- **[INFO]** 파일·식별자·API endpoint 명명 규칙 준수
  - target 위치: 문서 전체
  - 위반 규약: 해당 없음
  - 상세: 문서에서 직접 정의하는 식별자는 없다. 참조하는 API endpoint(`/api/hooks/*`, `/api/external/*`, `GET /api/hooks/:endpointPath/embed-config`)는 `spec/5-system/2-api-convention.md` 의 REST 경로 패턴을 따른다. DTO 명(`EmbedConfigDto`, `EmbedConfigService`)은 PascalCase + `Dto`/`Service` suffix 로 swagger.md §1 의 DTO 명명 패턴에 부합한다.
  - 제안: 해당 없음.

### 출력 포맷 규약

- **[INFO]** API 응답 형식 참조 정합
  - target 위치: `§3 임베드 allowlist` — `EmbedConfigDto { allowlist, enforce }`, `HTTP 200`, `Cache-Control: public, max-age=300`
  - 위반 규약: 해당 없음
  - 상세: `/embed-config` 엔드포인트의 응답 형식(평 객체 `{ allowlist, enforce }`)은 별도 페이로드 컨벤션을 적용받지 않는다. 공개(무인증) 엔드포인트이므로 `spec/5-system/2-api-convention.md` 의 표준 `{ data: ... }` 봉투를 적용하지 않는 것은 EIA 공개 webhook 패턴과 일치한다. 에러 코드 발행이 없고(fail-open HTTP 200), 오류 케이스를 의도적으로 동일 성공 응답으로 처리하는 설계가 명문화돼 있다.
  - 제안: 해당 없음.

- **[INFO]** 에러 코드 참조 — `429 TOO_MANY_CONNECTIONS`
  - target 위치: `§4 공개 webhook 남용 방어` — "SSE 동시 3/execution 은 구현됨(초과 시 `429 TOO_MANY_CONNECTIONS`)"
  - 위반 규약: `spec/conventions/error-codes.md §1` — "에러 코드 이름은 의미 기반 `UPPER_SNAKE_CASE`"
  - 상세: `TOO_MANY_CONNECTIONS` 는 HTTP 상태 코드 설명과 함께 쓰인 것으로, `UPPER_SNAKE_CASE` 형식 자체는 정식 규약에 부합한다. 이 코드가 `error-codes.md §3` 의 예외 레지스트리에 등재돼 있지는 않으나, spec 문서에서 참조만 하고 직접 신설하는 것은 아니므로 본 문서의 규약 위반이 아니다 — 실제 코드 정의는 `EIA §8.4` 및 backend 구현 SoT 에 위임.
  - 제안: 해당 없음.

### API 문서 규약 (Swagger)

- **[INFO]** 본 spec 문서는 Swagger 데코레이터·DTO 패턴을 직접 정의하지 않음
  - target 위치: 문서 전체
  - 위반 규약: 해당 없음
  - 상세: `spec/7-channel-web-chat/4-security.md` 는 보안 정책 spec 이며 Swagger/OpenAPI 데코레이터를 직접 정의하지 않는다. 구현 파일(backend DTO, guard 등)을 `code:` 로만 참조하므로 swagger.md 의 데코레이터·DTO 명명 규약 준수 여부는 해당 구현 파일(예: `embed-config.dto.ts`)의 리뷰 대상이지 본 spec 문서의 규약 위반이 아니다.
  - 제안: 해당 없음.

### 금지 항목

- **[INFO]** 금지 패턴 없음
  - target 위치: 문서 전체
  - 위반 규약: 해당 없음
  - 상세: `spec/conventions/` 각 문서가 명시적으로 금지하는 패턴(단일 진실 원칙 위반·중복 선언·인라인 에러 코드 문자열 직접 신설·`spec/` 밖 정보 저장 등)을 본 문서에서 확인할 수 없다. `interactionAllowedOrigins` 키가 CORS 와 임베드 allowlist 양쪽에서 동일 키로 사용됨을 "단일 진실 원칙"으로 명시한 것은 CLAUDE.md 의 단일 진실 원칙 요구와 정확히 정합된다.
  - 제안: 해당 없음.

---

## 요약

`spec/7-channel-web-chat/4-security.md` 는 정식 규약(`spec/conventions/`) 에 대해 실질적인 위반이 없다. frontmatter 스키마(`id`/`status`/`code:`)가 `spec-impl-evidence.md §2` 를 충족하고, `id: web-chat-security` 의 basename 이탈은 동 규약 §2.1 이 명시한 충돌 방지 prefix 패턴을 따른 의도적 선택이다. 문서 구조는 Overview / 본문 / Rationale 3섹션 권장을 완전히 준수하며, 에러 코드 참조·API endpoint 명명·DTO 참조 모두 관련 규약과 충돌하지 않는다. 발견된 모든 사항은 INFO 등급이며 채택 차단 요소가 없다.

---

## 위험도

NONE
