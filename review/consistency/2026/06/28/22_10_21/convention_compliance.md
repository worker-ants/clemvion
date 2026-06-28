# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 범위: `spec/5-system/` (페이로드 기준 `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`)

---

## 발견사항

### [INFO] `spec/5-system/1-auth.md` — `Overview` 와 `## 1. 인증` 사이 중간 레이어 반복
- **target 위치**: `spec/5-system/1-auth.md` `## Overview` (49–58행) 직후 `## 1. 인증` 으로 곧바로 이동
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — Overview 와 본문 사이가 명확히 구분돼 있음
- **상세**: 현재 문서는 Overview → 본문(§1~§5) → Rationale 3섹션 구조를 잘 따르고 있어 위반은 아님. 다만 Overview 섹션이 단락 목록으로 끝난 뒤 `---` 구분선이 있고 `## 1. 인증` 이 이어지는데, 그 사이의 `>` 인용 박스 ("인증 설정(AuthConfig) 엔드포인트의 SoT 는 …") 가 Overview 끝인지 본문 도입 전 별도 callout 인지 경계가 다소 모호함.
- **제안**: 현행 유지 가능 (허용 가능한 문체 범위). 규약 갱신 불필요.

---

### [WARNING] `spec/5-system/1-auth.md §1.5.4` — 에러 코드 `invitation_not_found` 등 `lower_snake_case` 현황 서술이 규약 §3 레지스트리 항목과 미세 불일치
- **target 위치**: `spec/5-system/1-auth.md §1.5.4` (294–301행) 주석 블록
- **위반 규약**: `spec/conventions/error-codes.md §3` Historical-artifact 레지스트리
- **상세**: `§1.5.4` 주석은 "`node-output.md` Principle 3.2" 와 "`error-codes.md §1`" 의 `UPPER_SNAKE_CASE` 규약 위반이라고 자체 기술하고, `error-codes.md §3` 에 등재돼 유지한다고 적는다. 실제로 `error-codes.md §3` 레지스트리에는 `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` 6종이 등재돼 있다. 그러나 §1.5.4 주석에서 `forbidden` · `rate_limited` 를 "초대 흐름 전용" 한정이라고 기술하면서 `error-codes.md §3` 각주에 "초대 API 한정" 명시가 동일함을 확인하고 있으므로 일치한다. 문제는 `§1.5.4` 주석이 본 두 코드에 대해 "다른 영역에서는 `FORBIDDEN`·`RATE_LIMITED`(UPPER)" 를 쓴다고 기술하는데, `error-codes.md §3` 는 이 부분을 명문으로 반영하고 있어 이중 서술이 된다. 이는 엄격한 위반이 아니라 중복 서술이나, 양쪽이 불일치할 경우 어느 쪽이 SoT 인지 모호해질 수 있음.
- **제안**: `spec/5-system/1-auth.md §1.5.4` 주석의 UPPER/lower 비교 서술은 `error-codes.md §3` 에만 두고 `§1.5.4` 에서는 "`error-codes.md §3` historical-artifact 레지스트리 참조" 포인터만 남기도록 정리하면 SoT 중복을 줄일 수 있음. 단 이것은 기술 내용의 위반이 아니므로 구현 차단 사유는 아님.

---

### [INFO] `spec/5-system/1-auth.md §4.1` — 감사 액션 카탈로그에서 `audit-actions.md §3` 레지스트리와 패턴 비교 재확인 필요 없음 (일치 확인)
- **target 위치**: `spec/5-system/1-auth.md §4.1` (421–446행)
- **위반 규약**: `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리
- **상세**: 검토 결과 `1-auth.md §4.1` 의 구현 액션(`integration.*`, `user.*`, `auth_config.*`, `execution.re_run`, `workspace.transfer_ownership`)과 Planned 액션(`workspace.*`, `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `model_config.*`)은 모두 `audit-actions.md §3` 레지스트리와 일치함 (패턴·시제·언더스코어 구분자). `model_config.*` 의 `set_default` 가 §2.2 현재형으로 묶이는 것도 `§4.1 Rationale 4.1.A` 와 `audit-actions.md §3` 하단 주석이 동일하게 설명. 위반 없음.
- **제안**: 없음.

---

### [INFO] `spec/5-system/10-graph-rag.md` — Overview 섹션 안에 구현 상태 요약 (`> **구현 상태**: ✅ ...`) 배치
- **target 위치**: `spec/5-system/10-graph-rag.md §Overview (제품 정의)` (825–828행)
- **위반 규약**: CLAUDE.md "제품 정의·요구사항 → `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`"
- **상세**: Overview 섹션 내부에 구현 완료 상태를 `> **구현 상태**: ✅ **P0~P2 구현 완료**...` blockquote 로 기술. CLAUDE.md 에 구현 상태를 Overview 섹션에 두지 말라는 명시적 금지는 없음. 다만 구현 상태 추적은 frontmatter `status:` 필드와 `plan/` 문서가 주된 역할이고, Overview 인라인에 넣으면 spec 갱신 없이 코드가 변경될 경우 Overview 가 stale 해질 위험이 있음. 현재 `status: implemented` 로 frontmatter 가 설정돼 있어 이중 표시가 됨.
- **제안**: 구현 상태 서술을 frontmatter `status:` 와 plan 문서로 통일하고, Overview 에서는 "무엇을 하는가" 만 남기는 것이 단일 진실 원칙에 맞음. 단 현행 유지도 허용 가능.

---

### [INFO] `spec/5-system/10-graph-rag.md §Overview (제품 정의)` — `## Overview` 섹션 제목이 `## Overview (제품 정의)` 로 변형됨
- **target 위치**: `spec/5-system/10-graph-rag.md` 825행 `## Overview (제품 정의)`
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: 표준 섹션 헤더는 `## Overview` 인데 `(제품 정의)` 라는 부연이 붙어 있음. 하위에 `## 1. 개요` 가 별도 본문 진입점으로 다시 등장함 (1002행). 즉 `## Overview (제품 정의)` 와 `## 1. 개요` 두 섹션이 Overview 역할을 나눠 갖는 구조로, 3섹션 규칙에서 본문이 Overview 와 일부 중복됨.
- **제안**: `## Overview (제품 정의)` 는 제품 정의/요구사항 블록(§1~§6)을 포함하는 상위 섹션이고, `## 1. 개요` 는 기술 상세 본문 진입이므로 현행 구조가 기능상 명확함. 섹션 이름 부연 `(제품 정의)` 는 사소한 형식 일관성 문제. 단 규약 위반 수준은 아님.

---

### [INFO] `spec/5-system/10-graph-rag.md §7` 에러 처리 표 — 에러 코드 표기 방식이 혼재
- **target 위치**: `spec/5-system/10-graph-rag.md §7` 에러 처리 표 (1352–1362행)
- **위반 규약**: `spec/conventions/error-codes.md §1` 의미 기반 명명 / `spec/conventions/node-output.md §3.2` `UPPER_SNAKE_CASE`
- **상세**: 에러 처리 표의 마지막 행 `409 KB_REEXTRACT_IN_PROGRESS` 는 `UPPER_SNAKE_CASE` 로 규약에 일치함. 그러나 다른 행들("LLM 호출 일시 실패", "LLM 호출 영구 실패" 등)은 에러 코드 문자열 없이 동작 설명만 기술함 — 이들이 API 에러 코드로 클라이언트에 노출되는지 아니면 내부 상태(document status) 전환인지 spec 에서 명확하지 않음. `KB_REEXTRACT_IN_PROGRESS` 만 명시적 에러 코드인 것은 일관성 문제라기보다 설계 의도가 다른 것으로 보이나, 향후 에러 코드 추가 시 동일 `UPPER_SNAKE_CASE` 규약 적용을 확인해야 함.
- **제안**: 내부 상태 전환과 API 에러 코드를 명확히 구분하는 주석을 추가하거나, 클라이언트에 노출되는 코드는 모두 명시하는 것을 권장. 현행 수준에서 구현 차단 사유 없음.

---

### [INFO] `spec/5-system/10-graph-rag.md §1.4.3` 표기 vs `spec/5-system/10-graph-rag.md §1.4.3 API 응답 논리 payload` — `node-output.md §3.2` 규약과의 관계
- **target 위치**: `spec/5-system/1-auth.md §1.4.3` (198–199행) — "전역 `TransformInterceptor` 가 wire 에서 `{ "data": { "enabled": … } }` 로 래핑" 표기
- **위반 규약**: `spec/conventions/swagger.md §2-5` 응답 wrapping / `spec/conventions/node-output.md §3.2`
- **상세**: 논리 payload 는 `{ enabled: boolean }` 이고 wire shape 는 `{ "data": { "enabled": … } }` 라고 명확하게 분리 기술하고 있으며, `swagger.md §2-5` 의 TransformInterceptor 래핑 규칙과 일치함. 위반 없음.
- **제안**: 없음.

---

### [INFO] `spec/5-system/1-auth.md §5` API 엔드포인트 표 — 경로에 `/api/` prefix 포함
- **target 위치**: `spec/5-system/1-auth.md §5` (478–508행)
- **위반 규약**: 명시적 API 경로 명명 규약 문서 없음
- **상세**: API 엔드포인트 표에서 경로를 `/api/auth/...` 형식으로 표기 (prefix 포함). `spec/5-system/10-graph-rag.md §5` 의 표도 `/api/knowledge-bases/:id/...` 형식으로 일치. 두 문서 간 일관됨. 별도 API path 명명 규약이 `spec/conventions/` 에 없어 점검 범위 밖이나, 일관성 측면에서 무방.

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 정식 규약(`spec/conventions/`) 에 대한 직접적 위반(CRITICAL)이 발견되지 않았다.

`1-auth.md` 는 에러 코드 `lower_snake_case` 예외를 `error-codes.md §3` 레지스트리에 명시적으로 등재하고, 감사 액션 명명을 `audit-actions.md §3` 레지스트리와 일치하는 방식으로 기술하고 있다. `§1.5.4` 의 `invitation_*` / `forbidden` / `rate_limited` 코드에 대한 역사적 예외 서술이 규약 SoT 와 이중 서술을 만드는 WARNING 이 한 건 있으나 구현 착수를 차단할 수준은 아니다.

`10-graph-rag.md` 는 Overview 섹션 명칭 변형과 구현 상태 인라인 기술이 사소한 형식 일관성 이슈로 INFO 등재됐으나, 에러 코드·API 응답 포맷·감사 관련 규약은 현재 docs scope 에 해당 내용이 없어 점검 대상 외다. 두 문서 모두 문서 구조 3섹션(Overview / 본문 / Rationale) 과 `spec/conventions/` 의 명시 금지 항목을 준수하고 있다.

---

## 위험도

LOW

STATUS: SUCCESS
