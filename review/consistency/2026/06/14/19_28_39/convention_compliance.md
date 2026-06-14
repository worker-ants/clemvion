# 정식 규약 준수 검토 결과

**대상 문서**: `spec/5-system/3-error-handling.md`  
**검토 모드**: spec draft 검토 (--spec)  
**검토일**: 2026-06-14

---

## 발견사항

### [INFO] 문서 구조 — Overview 섹션 부재
- **target 위치**: `spec/5-system/3-error-handling.md` 라인 13~19 (제목 직후, `## 1. 에러 분류` 시작 전)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장
- **상세**: 본 문서는 제목 직후 관련 문서 blockquote 만 있고 `## Overview` 섹션이 없다. `## Rationale` 는 문서 맨 끝에 올바르게 존재한다. 권장 3섹션(Overview / 본문 / Rationale) 중 Overview 가 누락된 구조다. 컨벤션이 "권장"이고 명시적 강제 가드는 없으므로 INFO 수준이다.
- **제안**: `# Spec: 에러 처리 정책` 직후에 `## Overview` 섹션을 추가해 이 문서가 다루는 범위(에러 분류 카탈로그·응답 형식·노드 에러 처리 정책·재시도 정책·클라이언트 처리·로깅·헬스 체크)와 책임 경계(명명 규율은 `error-codes.md` SoT, HTTP status 선택은 `api-convention.md` SoT 등)를 1~3문단으로 요약한다.

---

### [INFO] §1.6 EIA 에러 코드 표 — 세 코드를 한 행에 묶음
- **target 위치**: `spec/5-system/3-error-handling.md §1.6` 표, `TOKEN_REVOKED / TOKEN_SCOPE_MISMATCH / TOKEN_AUDIENCE_MISMATCH` 행
- **위반 규약**: 명시적 금지 규약은 없으나 §1.1~§1.5 표에서 에러 코드마다 별도 행을 사용하는 내부 형식 일관성에서 벗어남
- **상세**: `§1.6` 의 EIA 에러 코드 표에서 `TOKEN_REVOKED / TOKEN_SCOPE_MISMATCH / TOKEN_AUDIENCE_MISMATCH` 세 코드가 한 행에 `/` 구분자로 묶여 있다. 다른 섹션(§1.1~§1.5)의 표는 에러 코드마다 별도 행을 사용하는 일관된 패턴이다.
- **제안**: 세 코드를 별도 행으로 분리하되, 설명 컬럼에서 "단일 401 로 처리(§8.2 정보 노출 최소화)" 를 각 행에 공유 비고로 유지한다.

---

### [INFO] §3.2 — "(CONVENTIONS §3.2)" 자기 참조 모호
- **target 위치**: `spec/5-system/3-error-handling.md §3.2` 첫 문장 "(CONVENTIONS §3.2)"
- **위반 규약**: 명시적 규약 없음. 문서 내 링크 정확성 관련 암묵적 관행
- **상세**: "Route to Error Port 상세 — 통일된 envelope 규격 (CONVENTIONS §3.2)" 라는 표현에서 "CONVENTIONS §3.2"가 자기 자신(이 문서의 §3.2)을 가리키는 것인지, `node-output.md §3.2`(별도 규약 문서)를 가리키는 것인지 모호하다. `node-output.md` 는 `NodeHandlerOutput` 5필드 구조 등 별도 규약을 소유한다.
- **제안**: "(CONVENTIONS §3.2)" 를 `[node-output.md §3.2](../conventions/node-output.md)` 처럼 명시적 링크로 교체하거나, 자기 자신(이 문서)을 가리키는 것이라면 제거한다.

---

## 요약

`spec/5-system/3-error-handling.md` 는 frontmatter 스키마(`id`/`status`/`code:`)를 `spec/conventions/spec-impl-evidence.md` 규약대로 완전히 갖추고 있으며, 에러 코드 표기(`UPPER_SNAKE_CASE` 표기 SoT 역할 수행)·에러 카탈로그·응답 봉투 구조·Rationale 섹션 위치 등 핵심 규약을 준수한다. `error-codes.md` 가 명명 SoT·카탈로그 SoT 를 분리한 설계와 정합하며, 본 문서는 카탈로그·envelope 소유 역할을 올바르게 수행한다. 발견된 사항은 모두 INFO 수준으로 채택을 차단하는 CRITICAL/WARNING 위반은 없다. 개선 권고 사항은 Overview 섹션 추가(3섹션 권장 패턴 완성), §1.6 에서 세 EIA 토큰 에러 코드를 별도 행으로 분리해 카탈로그 표 형식 일관성 확보, §3.2 내 "(CONVENTIONS §3.2)" 자기 참조 모호성 해소 세 가지다.

## 위험도

NONE
