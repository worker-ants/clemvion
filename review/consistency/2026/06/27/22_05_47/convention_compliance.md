# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (--impl-done, diff-base=107b7617c)  
검토 문서: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md`, `/Volumes/project/private/clemvion/spec/5-system/10-graph-rag.md`  
참조 규약: `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md

---

## 발견사항

### **[WARNING]** `10-graph-rag.md` — 이중 섹션 번호 체계로 인한 `§N.M` 크로스레퍼런스 모호성

- **target 위치**: `spec/5-system/10-graph-rag.md` 전체 구조 (`## Overview (제품 정의)` 내 `### 1~8` 서브섹션, 그리고 body `## 1~8` 최상위 섹션)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"의 일관된 섹션 참조 관행
- **상세**:  
  `## Overview (제품 정의)` 내에 `### 1. 목표`, `### 2. 범위`, ..., `### 8. 미결 / 후속 검토` 가 `###` 레벨로 존재하며, 그 아래 `#### 3.1 KB 모드`, `#### 3.2 그래프 추출 파이프라인`, `#### 3.3 데이터 모델` 등 4th-level 서브섹션이 붙어 있다. 그런데 body에도 `## 3. 그래프 추출 파이프라인` 아래 `### 3.1 큐 라우팅`, `### 3.2 GraphExtractionProcessor`, `### 3.3 추출 LLM 응답 스키마`, `### 3.4 재추출` 이 독립적으로 존재한다.  
  결과적으로 `§3.2` 는 (a) Overview 요구사항의 `#### 3.2 그래프 추출 파이프라인` 과 (b) body의 `### 3.2 GraphExtractionProcessor` 두 곳을 동시에 가리킨다. 마찬가지로 `§4.1`/`§4.2`/`§4.3` 도 Overview requirements 내 `#### 4.*` (기술 결정 사항 아님 — Overview `### 4. 기술 결정 사항` 레벨) 와 body `## 4. 검색 흐름` → `### 4.1~4.3` 이 충돌한다.  
  문서 내부 크로스레퍼런스(`§3.2 / §7 처리 흐름 참조` 등)는 body 섹션을 의도하고 있어 실무상 명확하지만, 외부 spec 문서나 plan 파일이 `10-graph-rag.md §3.2` 를 참조할 경우 어느 계층인지 판별 불가다.
- **제안**:  
  Overview 내 요구사항 서브섹션의 번호를 제거하거나 `KB-GR-*` ID 체계로만 식별하고 숫자 섹션 번호를 body 의 최상위 `## N.` 에만 부여한다. 또는 Overview 내부를 `#### KB-GR-MD 요구사항`, `#### KB-GR-EX 요구사항` 식으로 비번호 heading 으로 전환한다. 어느 쪽이든 body `## N.` 번호 체계와의 충돌을 없애는 것이 핵심이다.

---

### **[INFO]** `10-graph-rag.md` — 비-목표(비-범위) 내용의 3중 중복

- **target 위치**: 
  - `## Overview (제품 정의)` > `### 2. 범위` > `#### 2.2 본 문서 범위 밖` (lines ~57–70)
  - `## 8. 비-목표` (line 578)
  - `## Rationale` > `### Graph RAG 기획 결정` > `#### 비-목표 (범위 밖)` (lines 619–624)
- **위반 규약**: CLAUDE.md "단일 진실 원칙" 정신. 정확한 conventions 조항은 없지만 CLAUDE.md 의 SoT 원칙과 상충
- **상세**:  
  동일한 비-목표 항목(Microsoft GraphRAG community detection, Apache AGE/Neo4j, 룰 기반 추출, 사후 모드 변경 등)이 세 곳에 분산 기술된다. 하나를 갱신할 때 나머지 두 곳을 함께 업데이트하지 않으면 불일치가 발생하는 유지보수 부담이 생긴다.
- **제안**:  
  `#### 2.2 본 문서 범위 밖`(Overview 내) 을 단일 SoT 로 유지하고, `## 8. 비-목표` 와 Rationale 내 `#### 비-목표 (범위 밖)` 는 삭제하거나 `§2.2 참조` 포인터로 대체한다.

---

### **[INFO]** `10-graph-rag.md` — Rationale 내 `#### 도메인 용어` 위치 부적합

- **target 위치**: `## Rationale` > `### Graph RAG 기획 결정` > `#### 도메인 용어` (lines 593–598)
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". `spec-impl-evidence.md` 의 Rationale 작성 관행
- **상세**:  
  `## Rationale` 섹션은 설계 결정의 배경·근거·기각 대안을 기술하는 곳이다. `#### 도메인 용어` 서브섹션에는 Graph RAG, Entity, Relation, ChunkEntity, KB.rag_mode 같은 용어 정의가 담겨 있는데, 이는 설계 결정 근거가 아니라 개념 정의(glossary)에 해당한다. `1-auth.md` 의 Rationale 패턴 (`### X.Y.Z — [제목]: [근거 산문]`) 과도 다르다.
- **제안**:  
  용어 정의를 `## 1. 개요` 또는 별도 글로서리 섹션으로 이동하고, Rationale 에는 실제 설계 결정의 이유(왜 vector+graph hybrid, 왜 생성 시 불변, 왜 PostgreSQL 선택 등)만 남긴다.

---

### 확인 사항 (위반 없음)

다음 항목은 규약 준수를 명시적으로 확인했다.

| 항목 | 문서 | 결과 |
|------|------|------|
| Frontmatter `id`/`status`/`code`/`pending_plans` | 두 문서 모두 | ✓ `spec-impl-evidence.md §2` 준수. `1-auth.md`: `status: partial` + `pending_plans` 올바름. `10-graph-rag.md`: `status: implemented` + `pending_plans` 없음 정상 |
| `## Overview` / 본문 / `## Rationale` 3섹션 | 두 문서 모두 | ✓ 모두 존재 (`1-auth.md` line 47/61/521, `10-graph-rag.md` line 29/206/587) |
| 에러 코드 `UPPER_SNAKE_CASE` | `1-auth.md` | ✓ `REAUTH_NOT_AVAILABLE`, `RESOURCE_CONFLICT`, `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID` 등 모두 `UPPER_SNAKE_CASE` |
| §1.5.4 `lower_snake_case` 에러 코드 예외 등재 | `1-auth.md §1.5.4` | ✓ `invitation_not_found` 외 5종은 `error-codes.md §3` historical-artifact 레지스트리에 명시 등재. 문서가 직접 그 사실을 인라인 주석으로 명기 |
| 에러 코드 `UPPER_SNAKE_CASE` | `10-graph-rag.md` | ✓ `KB_REEXTRACT_IN_PROGRESS` 단일 신규 코드, `UPPER_SNAKE_CASE` 준수. `error-codes.md §1` 의미 기반 명명(re-extract 중인 상태를 조건으로 기술) 충족 |
| 감사 액션 `<resource>.<verb>` 구조 | `1-auth.md §4.1` | ✓ `audit-actions.md §1` 준수. `user.*` 과거분사, `auth_config.*` 현재형 예외, `execution.re_run`/`workspace.transfer_ownership` 도메인 동사, `model_config.*` 현재형 예외 전부 `audit-actions.md §3` 레지스트리와 일치 |
| 감사 액션 토큰 구분자 언더스코어 | `1-auth.md §4.1` | ✓ `password_changed`, `scope_changed`, `re_run`, `transfer_ownership` 등 모두 언더스코어. 하이픈/camelCase 없음 |
| Planned 감사 액션 시제 | `1-auth.md §4.1` | ✓ `workspace.created/updated/deleted`, `member.invited/role_changed/removed`, `workflow.created/updated/deleted/executed`, `trigger.*`, `schedule.*` 모두 과거분사. `model_config.*` 현재형 예외 — 모두 `audit-actions.md §3` 미구현 레지스트리와 동일 |

---

## 요약

`spec/5-system/1-auth.md` 는 모든 정식 규약을 준수한다. `UPPER_SNAKE_CASE` 에러 코드, `audit-actions.md` 감사 액션 명명 규약, `spec-impl-evidence.md` frontmatter, 3섹션 문서 구조가 전부 올바르다. §1.5.4 의 `lower_snake_case` 초대 에러 코드는 `error-codes.md §3` 에 historical-artifact 로 적절히 등재되어 있다.

`spec/5-system/10-graph-rag.md` 는 frontmatter·에러 코드·3섹션 구조 측면에서는 규약을 따르지만, `## Overview (제품 정의)` 내 `### 1~8` 서브섹션과 body `## 1~8` 섹션이 동일한 번호 체계를 공유해 `§3.2`, `§4.1` 등의 참조가 모호해지는 구조적 문제가 있다. 이는 다른 문서에서 이 spec 을 참조할 때 invariant 가 깨질 가능성이 있는 WARNING 수준의 이슈다. 비-목표 내용의 3중 중복과 Rationale 내 용어 정의 배치는 유지보수 부담을 높이는 INFO 수준이다.

---

## 위험도

**LOW**

주요 기술 규약(에러 코드 명명, 감사 액션 구조, frontmatter lifecycle) 은 모두 준수되어 자동화 가드나 다른 시스템의 invariant 를 현재 깨뜨리지 않는다. 다만 `10-graph-rag.md` 의 이중 섹션 번호 체계는 문서 참조 무결성(`spec-link-integrity.test.ts` 앵커 검사) 측면에서 잠재적 위험이 있어 LOW 상단으로 판정한다.
