# 정식 규약 준수 검토 결과

**대상 문서**: `plan/in-progress/spec-draft-rag-reranking.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-04

---

## 발견사항

### [INFO] ragDiagnostics.rerank.error 에러 코드 값 미정의

- **target 위치**: `plan/in-progress/spec-draft-rag-reranking.md` §7 에러 처리 표, §8 출력 메타데이터 JSON
- **위반 규약**: `spec/conventions/error-codes.md §1` — 신규 에러 코드는 `UPPER_SNAKE_CASE` + 의미 기반 명명 원칙. spec 반영 시 각 에러 케이스에 코드를 명시해야 함
- **상세**: `ragDiagnostics.rerank.error` 필드가 담을 에러 코드 문자열 값이 정의되지 않았다. `LLM_CONFIG_INVALID` 는 §6에서 언급되나, §7의 케이스(RerankConfig 미구성/조회 실패, 리랭커 endpoint 호출 실패/타임아웃, grading LLM 실패)에 대응하는 코드가 신규 정의가 필요한지 기존 코드 재사용인지 불명확하다.
- **제안**: spec 파일 반영 시 각 에러 케이스에 `UPPER_SNAKE_CASE` 에러 코드를 명시하고, 신규 코드라면 `spec/conventions/error-codes.md §3` 레지스트리 등재 여부를 결정한다.

---

### [INFO] RerankConfig DTO swagger 패턴 체크리스트 미포함

- **target 위치**: `plan/in-progress/spec-draft-rag-reranking.md` §10 반영 대상 spec 목록
- **위반 규약**: `spec/conventions/swagger.md §1` — DTO 파일의 모든 필드에 JSDoc 한국어 주석 의무 (`@nestjs/swagger` CLI 플러그인 + `introspectComments` 활성화 환경 전제)
- **상세**: §10에서 구현 spec 파일 목록을 열거하지만, 신규 DTO(`RerankConfig`, `knowledge_base` 컬럼 확장)의 swagger 패턴 준수는 별도 언급 없다. spec → 구현 단계에서 누락될 수 있다.
- **제안**: plan 또는 §10에 "RerankConfig DTO 및 KB 컬럼 확장 마이그레이션 DTO에 `swagger.md §1` 패턴(JSDoc 한국어 주석 + class-validator 데코레이터) 적용" 항목 추가 권장.

---

### [INFO] Overview 헤더 부제 비표준

- **target 위치**: `plan/in-progress/spec-draft-rag-reranking.md` 라인 36 — `## 1. Overview (제품 정의)`
- **위반 규약**: CLAUDE.md 3섹션 권장 — "Overview / 본문 / Rationale". 헤더를 `## Overview` 로 명시하며 번호나 부제를 정의하지 않음
- **상세**: `## 1. Overview (제품 정의)` 는 번호가 붙고 부제가 있어 비표준 패턴이다. plan 초안 단계에서는 허용 가능하나, 실제 spec 파일 반영 시 다른 spec 파일들과 헤더 패턴을 맞춰야 한다.
- **제안**: 실제 spec 파일 작성 시 `## Overview` 헤더 사용.

---

## 준수 확인 사항

다음 규약 항목들은 정식 규약과 일치한다고 판단됨:

1. **plan frontmatter**: `worktree`, `started`, `owner` 3개 의무 필드 모두 충족 (`.claude/docs/plan-lifecycle.md §4`).
2. **3섹션 구조**: `## 1. Overview` → 본문(§2~§9) → `## Rationale` 가 문서 맨 끝에 위치. CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 준수.
3. **DB 컬럼 명명**: `rerank_mode`, `rerank_config_id`, `rerank_candidate_k`, `rerank_score_threshold`, `rerank_llm_config_id` 모두 `snake_case`. 규약과 일치.
4. **TypeScript 메서드/타입 명명**: `rerank?()` 메서드 `camelCase`, `RerankConfig` 리소스 `PascalCase`. 규약과 일치.
5. **에러 코드 표기 (`LLM_CONFIG_INVALID`)**: `UPPER_SNAKE_CASE` 준수 (`spec/conventions/error-codes.md §1`, `spec/conventions/node-output.md §3.2`).
6. **node-output.md Principle 0 (5필드 invariant)**: `ragDiagnostics` 는 `meta` 하위에 배치됨 (§8 — `meta.ragDiagnostics`). Principle 2 "meta 는 실행 메트릭만" 에 따른 올바른 위치.
7. **ragSources[].score 의미 보강**: rerank 적용 시 cosine → rerank 점수로 교체 명시. `spec/conventions/node-output.md Principle 1` "output은 비즈니스 결과물" 원칙에 부합.
8. **금지 항목 점검**: conventions에서 명시적으로 금지된 패턴(credential echo, spread config echo, output.metadata 사용 등)은 본 초안에서 나타나지 않음.

---

## 요약

`plan/in-progress/spec-draft-rag-reranking.md` 는 plan frontmatter 스키마, 3섹션 구조(Overview/본문/Rationale), 명명 규약(snake_case 컬럼·PascalCase DTO·camelCase 메서드), node-output 메타데이터 위치, 에러 코드 표기 등 핵심 정식 규약을 준수하고 있다. CRITICAL 또는 WARNING 수준의 규약 위반은 발견되지 않았다. spec 초안 단계에서 에러 코드 구체 값 미정의, swagger DTO 체크리스트 미포함, Overview 헤더 부제 비표준의 3개 INFO 사항이 있으며, 실제 spec 파일 반영 단계에서 해소가 권장된다.

---

## 위험도

LOW
