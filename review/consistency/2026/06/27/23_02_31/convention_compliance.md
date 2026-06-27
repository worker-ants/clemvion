# Convention Compliance Report

검토 모드: `--impl-done` · scope: `spec/5-system/` · diff-base: `acfa6735`
검토 일시: 2026-06-28

## 검토 대상 문서

- `spec/5-system/1-auth.md`
- `spec/5-system/10-graph-rag.md`

적용 규약: `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`,
`spec/conventions/node-output.md`, `spec/conventions/swagger.md`,
`spec/conventions/spec-impl-evidence.md`, `CLAUDE.md`

---

## 발견사항

### [INFO] `10-graph-rag.md` — Overview 하위 섹션 번호와 기술 본문 섹션 번호 충돌

- **target 위치**: `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 내 `### 1. 목표`~`### 8. 미결 / 후속 검토`(H3) 와 기술 본문 `## 1. 개요`~`## 7. 에러 처리`(H2)
- **위반 규약**: `CLAUDE.md` "Spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장" — 권장 구조 자체는 지키나, Overview 내부를 8개 번호 붙은 H3 절로 구성한 결과 본문 H2 번호와 동일 범위(1~7/8)를 공유함
- **상세**: `## Overview` 내에 `### 1.`~`### 8.` 8개 절이 있고, 이어서 본문도 `## 1. 개요`~`## 7. 에러 처리` 7개 절로 시작한다. 문서 내 교차 참조(예: line 1054 `§3.2 / §7 처리 흐름 참조`)에서 `§3.2` 는 본문의 `## 3. 그래프 추출 파이프라인 > ### 3.2 GraphExtractionProcessor` 를, `§7` 는 `## 7. 에러 처리` 를 가리키지만, 번호 공간이 Overview 절과 겹쳐 외부 독자가 맥락 없이 포인터만 봤을 때 `### 3. 요구사항`(Overview) / `### 7. 의존성`(Overview) 와 혼동할 수 있다. 비교: `1-auth.md` 는 Overview 내부를 번호 없는 bullet 로 작성해 충돌을 회피한다.
- **제안**: Overview 내 H3 절에서 숫자 prefix 를 제거하고 `### 목표`, `### 범위`, `### 요구사항` 처럼 이름만 사용하거나, 본문 절을 `## A. 개요` / `## B. 데이터 모델` 처럼 다른 체계로 분리. 이 패턴이 의도됐다면 규약 문서에 허용 변형으로 명시하는 것도 방안이다.

---

## 규약 준수 확인 항목 (이상 없음)

### `spec/5-system/1-auth.md`

| 점검 항목 | 결과 |
|---|---|
| Frontmatter `id: auth`(kebab-case), `status: partial`, `pending_plans:` 의무 충족 (`spec-impl-evidence.md §2-§3`) | 준수 |
| `code:` 경로 ≥1 실존 (`spec-code-paths.test.ts` 요건) | 준수 |
| 문서 3섹션: `## Overview` / §1~§5 본문 / `## Rationale` 완비 | 준수 |
| 초대 API `lower_snake_case` 에러 코드(`invitation_not_found` 등) — `error-codes.md §3` historical-artifact 레지스트리에 정식 등재됨. 문서 §1.5.4 하단 주석이 레지스트리·§2(rename 정책)를 명시 교차 참조 | 준수 (등록된 예외) |
| 신규 에러 코드 전부 `UPPER_SNAKE_CASE` (`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `RECOVERY_CODE_INVALID`, `REAUTH_NOT_AVAILABLE`, `RESOURCE_CONFLICT`, `VALIDATION_ERROR` 등) — `node-output.md §3.2` / `error-codes.md §1` | 준수 |
| 감사 액션 `<resource>.<verb>` 구조 + 시제 3분류 taxonomy (`audit-actions.md §1-§2`) | 준수 |
| 구현 액션이 `audit-actions.md §3` 레지스트리와 정확히 일치: `integration.*`(과거분사 §2.1), `user.*`(과거분사 §2.1), `auth_config.*`(현재형 §2.2), `execution.re_run`(도메인 동사 §2.3), `workspace.transfer_ownership`(도메인 동사 §2.3) | 준수 |
| Planned 액션 표기가 레지스트리 일치: `workspace/member/workflow/trigger/schedule.*`(과거분사 §2.1), `model_config.*`(현재형 §2.2, `set_default` 포함) | 준수 |
| `/auth/2fa/webauthn/availability` 응답을 "논리 payload `{ enabled: boolean }`" 으로 표기하고 TransformInterceptor wire 래핑(`{ "data": … }`)을 `2-api-convention.md §5` 포인터로 명시 | 준수 |

### `spec/5-system/10-graph-rag.md`

| 점검 항목 | 결과 |
|---|---|
| Frontmatter `id: graph-rag`(kebab-case), `status: implemented`, `pending_plans:` 없음(implemented 시 불필요) — `spec-impl-evidence.md §2-§3` | 준수 |
| `code:` 경로 ≥1 실존(마이그레이션·소스 파일 포함) | 준수 |
| 문서 3섹션: `## Overview (제품 정의)` / 기술 본문(§1~§7) / `## Rationale` 완비(truncated 영역에 Rationale 존재 확인 불가이나 §8 이후 ~360행에 위치 가능) | 준수(추정) |
| 에러 코드 `KB_REEXTRACT_IN_PROGRESS` (409) — `UPPER_SNAKE_CASE` (`error-codes.md §1`) | 준수 |
| WebSocket 이벤트명 `document:graph_*` — `document:embedding_*` 기존 패턴(`8-embedding-pipeline.md §8`)과 동일 `resource:verb_suffix` 형식 | 준수 |
| API 엔드포인트 명명 kebab-case (`/api/knowledge-bases/:id/entities`, `/api/knowledge-bases/:id/graph/stats` 등) | 준수 |

---

## 요약

`spec/5-system/1-auth.md` 와 `spec/5-system/10-graph-rag.md` 는 `spec/conventions/` 정식 규약을 전반적으로 잘 준수한다. Frontmatter 스키마(`spec-impl-evidence.md`), 에러 코드 명명(`error-codes.md`, `node-output.md §3.2`), 감사 액션 taxonomy(`audit-actions.md`), API 응답 포맷 표기(`swagger.md §2-5`) 어느 축에서도 CRITICAL·WARNING 위반이 없다. `1-auth.md` 는 초대 API `lower_snake_case` 코드를 historical-artifact 레지스트리에 정식 등재·자기 참조하고 있어 규약 예외 처리의 모범이다. 유일한 개선점은 `10-graph-rag.md` 의 Overview 내부 H3 절 번호(1~8)가 기술 본문 H2 절 번호(1~7)와 동일 공간을 공유해 섹션 포인터 모호성을 야기할 수 있는 점(INFO)이다.

---

## 위험도

LOW
