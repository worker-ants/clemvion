# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=fcd1d594)

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — 문서 구조 3섹션 규약 부분 미적용

- **target 위치**: `spec/5-system/1-auth.md` 최상단 ~ 섹션 구성
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `1-auth.md` 는 `## 1. 인증 (Authentication)` 으로 바로 시작하며 명시적 `## Overview` 섹션이 없다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 섹션을 분리해 두었고 CLAUDE.md 가 권장하는 3섹션 구조(Overview / 본문 / Rationale)를 더 충실히 따른다. `1-auth.md` 에는 `## Rationale` 이 말미에 존재하므로 3섹션 중 Rationale 은 충족하나 Overview 분리가 누락돼 있다.
- **제안**: INFO 수준이며 강제 규약이 아닌 "권장"이므로 즉각 수정 필요 없음. 향후 대규모 개편 시 `## Overview` 섹션을 추가하거나 `_product-overview.md` 의 `## Overview` 링크를 첫 섹션에 명시하면 충분.

---

### [INFO] `spec/5-system/1-auth.md §1.5.4` — 에러 코드 `lower_snake_case` historical-artifact 주석의 self-referential 정확도

- **target 위치**: `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 하단 주석 (`> **명명 — historical-artifact 예외**:`)
- **위반 규약**: `spec/conventions/error-codes.md §3` Historical-artifact 예외 레지스트리
- **상세**: 주석이 `error-codes.md §3 의 "초대 API 한정" 명시와 일치한다`고 자기참조적으로 설명하는데, 실제로 `error-codes.md §3` 테이블에 해당 코드들이 등재되어 있고 "초대 API 한정" 문구가 명시되어 있으므로 정확하다. 규약 위반은 없다.
- **제안**: 현행 유지. 이중 확인 차원의 INFO.

---

### [INFO] `spec/5-system/10-graph-rag.md §2.4 Relation` — `predicate` 필드 snake_case 권장이 표와 코드 블록 사이 일관성

- **target 위치**: `spec/5-system/10-graph-rag.md §3.3 추출 LLM 응답 스키마` + `§2.4 Relation`
- **위반 규약**: 해당 내용은 LLM 응답에서의 snake_case 권장이라 정식 명명 규약(`error-codes.md`, `node-output.md`) 과는 레이어가 다름. 내부 일관성 이슈.
- **상세**: `§2.4 Relation` 표의 `predicate` 필드 설명에 "free-form 문자열"이라 하고, `§3.3` JSON Schema 의 `predicate` description 에 "동사·관계 서술어. snake_case 권장"이라 표기되어 있다. 두 절의 설명이 일치(free-form + 권장만)해 모순은 없지만, `§8 비-목표`에서 "P0 는 free-form 문자열, 정합성/검색 품질을 위해 enum 화는 P2 검토"라 재서술되어 있어 세 곳에서 동일 사실을 반복한다.
- **제안**: 기능상 문제 없음. 중복 기술의 DRY 관점에서 `§2.4` 또는 `§3.3` 에 "상세는 §8" 교차 참조 추가를 고려할 수 있음.

---

### [INFO] `spec/5-system/11-mcp-client.md` — `## Overview` 섹션 없이 `## 1. 개요` 로 시작

- **target 위치**: `spec/5-system/11-mcp-client.md` 섹션 구성
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: `11-mcp-client.md` 는 `## Rationale` 섹션이 없고 `## 1. 개요` 로 시작한다. 대부분의 정보가 섹션 1~12 안에 배치돼 있으나, 결정 배경·근거가 Rationale 섹션으로 응집되지 않고 각 섹션 내 텍스트에 흩어져 있다. `10-graph-rag.md` 와 달리 구조 권장안을 따르지 않는다. 다만 이 또한 "권장"이므로 강제 위반이 아님.
- **제안**: INFO 수준. 향후 리팩토링 시 결정 배경을 `## Rationale` 로 이관하면 규약에 더 부합.

---

### [WARNING] `spec/5-system/1-auth.md §4.1` — `auth_config.*` verb 시제 혼용이 규약 명문화와 완전히 정합하는지 검토 권장

- **target 위치**: `spec/5-system/1-auth.md §4.1 기록 대상 액션` 표 및 주석
- **위반 규약**: `spec/conventions/` 에 audit action 명명 규약 전용 문서 없음 — 규약 자체는 `1-auth.md §4.1` 이 단일 SoT
- **상세**: `§4.1` 의 Action naming 규약 주석은 "auth_config 은 `reveal`·`regenerate` 처럼 과거분사가 부자연스러운 동사가 섞여 CRUD 동사 현재형(`create`/`update`/`delete`/`regenerate`/`reveal`)으로 통일한다"고 명시한다. 이에 따라 `auth_config.create`/`auth_config.update` 등이 현재형으로 채택됐다. 그런데 `AUDIT_ACTIONS` 구현에서 `AUTH_CONFIG_CREATE: 'auth_config.create'`, `WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership'` 등은 실제로 그 규약을 준수한다. 단 `workspace.transfer_ownership` 은 과거분사(`transferred`)가 아닌 동사 원형+명사형이며 이 이탈도 Rationale 없이 그대로 사용된다. integration 계열은 과거분사, auth_config 계열은 현재형, workspace 는 원형 명사복합이 혼재하나, 각 도메인별 일관성 자체는 유지되고 있다.
- **제안**: 현재 규약 주석이 `auth_config` 현재형·integration 과거분사 차이를 도메인별 예외로 명시하므로 `1-auth.md §4.1` 규약 자체는 self-consistent. 다만 `workspace.transfer_ownership` 의 시제(원형 명사형)는 기존 규약 중 어느 카테고리에도 명시적으로 포함되지 않는다. `spec/conventions/` 에 감사 액션 명명 규약을 독립 문서(`audit-actions.md`)로 분리하거나, `1-auth.md §4.1` 에 `workspace.*` 도메인 시제 예외도 명시하는 것이 규약의 완결성 면에서 권장된다.

---

### [INFO] `spec/5-system/10-graph-rag.md` — `status: implemented` 인데 `## Overview` 안에 구현 상태 요약을 직접 삽입

- **target 위치**: `spec/5-system/10-graph-rag.md §Overview (제품 정의)` 내부 블록 인용
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: implemented` 일 때 `pending_plans:` 없음 기대
- **상세**: `§Overview` 에 `> **구현 상태**: ✅ **P0~P2 구현 완료**. ...` 라는 블록 인용이 삽입되어 있다. frontmatter `status: implemented` 와 동기화돼 있고 `pending_plans:` 가 없는 것과 정합한다. 별도 위반은 없으나, `spec-impl-evidence.md` 의 evidence 가드는 frontmatter 로 이미 강제하므로 문서 본문 내 구현 상태 서술은 중복이다.
- **제안**: 규약 위반은 아님. 다만 중복 서술이 최신 상태와 어긋날 경우 혼란을 줄 수 있으므로 장기적으로 Overview 본문에서 상태 서술을 제거하고 frontmatter 단일 SoT 에 맡기는 것을 권장.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — `data-flow` 참조 경로 표기 방식 확인

- **target 위치**: `spec/5-system/1-auth.md §4.1` 의 여러 교차 참조 링크, 예: `[data-flow §1.1](../data-flow/1-audit.md)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-link-integrity.test.ts` (build 차단 가드)
- **상세**: `1-auth.md` 내 `../data-flow/1-audit.md` 참조가 실제로 `spec/data-flow/1-audit.md` 경로에 존재함을 확인했다 (`/spec/data-flow/1-audit.md` 실재). `spec/5-system/` 에서 `../data-flow/` 는 상위(`spec/`) 이동 후 `data-flow/` 진입이므로 경로 논리가 맞다. build 가드 `spec-link-integrity.test.ts` 가 검증하므로 별도 수동 확인 불요.
- **제안**: 현행 유지. 링크 무결성은 자동 가드가 담당.

---

## 요약

검토 대상 `spec/5-system/` 의 세 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)는 정식 규약을 전반적으로 잘 준수하고 있다. `spec/conventions/error-codes.md §3` 의 historical-artifact 예외 레지스트리와 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 스키마는 모두 올바르게 적용됐다. 에러 코드 표기(`UPPER_SNAKE_CASE` vs `lower_snake_case` historical-artifact), 감사 액션 명명(`<resource>.<verb>`)의 구현(`AUDIT_ACTIONS` union)도 규약 SoT(`1-auth.md §4.1`, `error-codes.md`)와 정합한다. 발견된 항목은 모두 INFO/WARNING 수준이며 자동 빌드 가드를 깨는 CRITICAL 위반은 없다. 유일한 WARNING 은 `workspace.transfer_ownership` verb 시제가 기존 도메인별 시제 규약(`auth_config` 현재형, `integration` 과거분사) 중 어느 카테고리에도 명시적으로 포함되지 않아 규약 자체의 완결성 보강이 권장된다는 점이다.

## 위험도

LOW
