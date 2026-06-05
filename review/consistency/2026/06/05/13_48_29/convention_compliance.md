# Convention Compliance Review

검토 모드: 구현 완료 후 (--impl-done)
Target: `spec/5-system/` (scope 내 문서 전체)
Diff base: `origin/main`

---

## 발견사항

### [INFO] `9-rag-search.md` — KB tool 결과의 `error` 코드가 `lower_snake_case`
- target 위치: `spec/5-system/9-rag-search.md` §2.2 검색 실패 응답
- 위반 규약: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`
- 상세: 검색 실패 시 tool_result 의 `error` 필드에 `"search_failed"` (소문자 스네이크) 를 사용한다. `node-output.md §3.2` 는 `code` 값을 `UPPER_SNAKE_CASE` 로 명시하며, `error-codes.md §1` 도 동일 원칙을 재선언한다. 단, 이 `error` 키는 `output.error.code` 가 아닌 KB tool_result 내부 진단 필드라 엄밀한 `output.error` 봉투와 완전히 동일 도메인은 아니다. LLM 이 직접 읽는 필드이므로 소문자가 의도일 수도 있으나, 규약과 표기 형식이 다르다는 점에서 INFO 수준 지적.
- 제안: 규약과 완전히 맞추려면 `"SEARCH_FAILED"` 로 변경 권장. 또는 "LLM 가독성 우선의 tool_result 내부 필드"임을 Rationale 에 명시해 historical-artifact 유사 예외 근거를 문서화한다. `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 등재하는 것은 불필요하지만 spec 본문에 주석 형태로 예외 이유를 달면 충분하다.

---

### [INFO] `1-auth.md` — `_product-overview.md` 섹션 구조 누락 (Overview 섹션 없음)
- target 위치: `spec/5-system/1-auth.md` — 파일 전체 구조
- 위반 규약: `CLAUDE.md §정보 저장 위치` — 제품 정의는 `_product-overview.md` 또는 진입 문서의 `## Overview`; 3섹션 구조 권장 (Overview / 본문 / Rationale)
- 상세: `1-auth.md` 는 `## Overview` 섹션 없이 바로 `## 1. 인증` 본문으로 시작한다. `10-graph-rag.md` 는 `## Overview (제품 정의)` 를 가지고 있으며, `9-rag-search.md` 도 `## Overview (제품 정의)` 를 가진다. 3섹션 패턴(Overview / 본문 / Rationale)이 "권장" 수준이고 의무는 아니나, 동일 영역 내 다른 파일들과 일관성이 낮다.
- 제안: INFO 수준이므로 강제 필요 없음. `1-auth.md` 에도 `## Overview` 섹션을 추가해 제품 맥락과 구현 상태를 간략히 기술하면 동일 영역 내 문서 구조 일관성이 향상된다. Rationale 섹션은 이미 존재하므로 Overview 만 추가하면 된다.

---

### [INFO] `11-mcp-client.md` — `skipReason` vocabulary 표기 규약 명시 필요
- target 위치: `spec/5-system/11-mcp-client.md` §6.2 `skipReason` vocabulary 주석
- 위반 규약: `spec/conventions/node-output.md §3.2` · `spec/conventions/error-codes.md §1`
- 상세: `skipReason` 값이 `lower_snake_case` 인 이유를 해당 절에 직접 명시하고 있어 (`"skipReason 값은 모두 lower_snake_case 다. 본 필드는 에러 코드가 아닌 운영 진단용 enum"`) 규약 예외 근거가 문서화되어 있다. 형식적으로 규약 준수 여부는 경계 사례다. 다만 이 설명이 spec 본문에만 있고 `error-codes.md §3` 레지스트리에는 등재되지 않았다. historical-artifact 는 아니므로 레지스트리 등재 대상은 아니지만, `skipReason` 이 진단 enum(에러 코드 아님)임을 규약 문서 어딘가에서 참조할 수 있으면 좋다.
- 제안: 현재 상태로 충분. 추가 조치 불필요. 단, 향후 `skipReason` 을 에러 코드 표면에 노출하는 형태로 변경할 경우 `UPPER_SNAKE_CASE` 로 마이그레이션이 필요함을 인지한다.

---

### [INFO] `9-rag-search.md` frontmatter `status: partial` — `pending_plans` 경로 갱신 필요 확인
- target 위치: `spec/5-system/9-rag-search.md` frontmatter `pending_plans: plan/in-progress/rag-rerank-followup.md`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` 의 `pending_plans` 는 `plan/in-progress/` 또는 `plan/complete/` 에 실존 의무; `spec-pending-plan-existence.test.ts` 가드
- 상세: 검토 모드가 "구현 완료 후(--impl-done)" 이고 타이틀에서 rerank 구현이 완료됐다고 기술됨. 만약 `plan/in-progress/rag-rerank-followup.md` 가 `plan/complete/` 로 이동했다면 `spec-impl-evidence.md §3` 전이 규칙상 `status` 를 `partial → implemented` 로 승격해야 한다. 현재 `status: partial` 인 채로 남아 있으면 가드(`spec-status-lifecycle.test.ts`)에서 fail 할 수 있다.
- 제안: plan 파일의 현재 위치를 확인(`plan/in-progress/rag-rerank-followup.md` 존재 여부). 파일이 `plan/complete/` 로 이동했다면 `9-rag-search.md` frontmatter 를 `status: implemented` 로 승격하고 `pending_plans:` 를 제거하거나 complete 경로로 갱신한다. `spec-code-paths.test.ts` 가드도 `code:` 글로브 최신화가 필요할 수 있다.

---

## 요약

`spec/5-system/` 영역은 전반적으로 정식 규약(`spec/conventions/`)을 잘 준수한다. `1-auth.md §1.5.4` 의 `lower_snake_case` 에러 코드는 `error-codes.md §3` historical-artifact 레지스트리에 명시적으로 등재되어 있어 규약 위반이 아닌 관리된 예외 상태다. `11-mcp-client.md §6.2` 의 `skipReason` lower_snake_case 도 문서 내 명시 근거가 있다. 주요 유의 사항은 (a) `9-rag-search.md` 의 KB tool_result `"search_failed"` 표기(INFO — LLM 가독성 우선 의도라면 주석으로 예외 근거 명시 권장), (b) 구현 완료 후 `9-rag-search.md` 의 `status: partial` / `pending_plans:` 갱신 여부 확인(plan 파일 이동 완료 시 `implemented` 승격 필요), (c) `1-auth.md` 의 Overview 섹션 누락(권장 수준, 강제 아님) 세 가지다. CRITICAL 또는 WARNING 수준의 직접적인 규약 위반은 발견되지 않았다.

## 위험도

LOW
