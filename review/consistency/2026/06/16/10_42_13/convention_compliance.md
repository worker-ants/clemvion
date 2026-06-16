# 정식 규약 준수 검토 — `spec/2-navigation/6-config.md`

검토 대상: worktree `spec-fix-models-errorcode-71cc8a` 의 수정 버전 (uncommitted)  
검토 시각: 2026-06-16  
검토 모드: `--spec`

---

## 발견사항

### [INFO] frontmatter `status` 전이 — partial → implemented 반영 확인

- target 위치: frontmatter `status: implemented` (line 3), `pending_plans` 없음
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` 전이 규칙
- 상세: 기존 main 브랜치 파일은 `status: partial` + `pending_plans: plan/in-progress/spec-sync-config-gaps.md` 였으나 워크트리 버전은 `status: implemented` 로 승격되고 `pending_plans` 를 제거했다. `spec-impl-evidence §3` 에 따르면 `partial → implemented` 전이는 "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격" 해야 하며 `spec-plan-completion.test.ts`(Gate C) 가 이를 강제한다. 본 검토 범위(정식 규약 준수)에서 **문서 자체의 frontmatter 구조**는 규약을 따른다(`implemented` + `code:` ≥1 항목). 단 `plan/in-progress/spec-sync-config-gaps.md` 의 `complete/` 이동 여부는 개별 Gate C 가드가 검증할 사항이라 본 검토 외부다.
- 제안: 별도 조치 불필요. `spec-plan-completion.test.ts` 빌드 통과 여부로 최종 확인.

---

### [INFO] `§A.4 Reveal 흐름` — 감사 액션 표기 방식 (산문 vs 코드)

- target 위치: `§A.4 Reveal 흐름` 5단계 — `action='auth_config.reveal'`
- 위반 규약: `spec/conventions/audit-actions.md §1` (`<resource>.<verb>` 도트 구분자 규약)
- 상세: `auth_config.reveal` 은 audit-actions.md §3 레지스트리에 `auth_config | 현재형(§2.2) | reveal` 로 등재된 정식 액션이다. 도트 구분자 형식, resource prefix, verb 모두 규약과 일치한다. 다만 문서 내 산문에서 `action='auth_config.reveal'` 처럼 SQL 대입 형식으로 표기하는 것은 규약 위반이 아니며 참조 표현이다.
- 제안: 현행 유지. 규약 준수 완전.

---

### [INFO] `§B.6.2 Base URL` 셀 — `MODEL_CONFIG_INVALID` 코드 사용 (수정 후 상태)

- target 위치: `§B.6.2` Base URL 테이블 셀, line 238
- 위반 규약: 해당 없음 (수정 후 규약 준수 상태)
- 상세: 워크트리 수정본은 구 버전의 `RERANK_CONFIG_INVALID` 를 `MODEL_CONFIG_INVALID` 로 교체했다. `spec/5-system/3-error-handling.md §1.3` 과 `spec/5-system/9-rag-search.md §3.3 §374 note`("RERANK_CONFIG_INVALID 은 검색 실행(rerank 호출) 레이어 전용, MODEL_CONFIG_INVALID 는 설정 CRUD `/api/model-configs` 레이어 전용") 가 이 구분의 SoT 다. `MODEL_CONFIG_INVALID` (400) 는 "사설망/loopback baseUrl SSRF 가드, tei/local 외" 를 명시적으로 포함하고 있어 `/api/model-configs` Rerank CRUD SSRF 오류에 정확하다.
- 제안: 현행 유지.

---

### [INFO] `R-1` — `LLM_MODEL_NOT_FOUND` 제거 후 SoT 위임 (수정 후 상태)

- target 위치: `### R-1` 첫 문단, line 293
- 위반 규약: 해당 없음 (수정 후 규약 준수 상태)
- 상세: 구 버전은 `LLM_MODEL_NOT_FOUND` 를 인라인으로 명시했으나, 이 코드는 `spec/conventions/error-codes.md §3 Historical-artifact` 및 `spec/5-system/3-error-handling.md §1` 어디에도 정식 등재되지 않은 **"Planned" 미구현 코드** (`spec/5-system/7-llm-client.md §6` 기준)다. 수정본은 구체 코드 대신 "런타임 LLM 호출 에러로 실패한다 (… SoT: LLM Client §6)" 로 대체해 spec 이 미구현 코드를 정식 계약처럼 서술하는 오류를 제거했다. `error-codes.md §1` 의 "의미 기반 명명·신규 코드는 처음부터 의미 정확한 이름 부여" 원칙과 정합하는 처리 방식이다.
- 제안: 현행 유지.

---

### [INFO] `R-4` — `RERANK_CONFIG_INVALID` 제거 + `MODEL_CONFIG_INVALID` + 상세 맥락 추가 (수정 후 상태)

- target 위치: `### R-4` 단락, line 325
- 위반 규약: 해당 없음 (수정 후 규약 준수 상태)
- 상세: 구 R-4 는 "`tei`/local 만 예외" 로만 기술했으나, `local` 리랭커 provider 가 Dropped 됐다는 결정 맥락이 없어 일관성 결여였다. 수정본은 `MODEL_CONFIG_INVALID` 코드 사용 + `local` provider Dropped 사유 링크(`LLM Client §2.1`) + SSRF 가드 재사용 근거(`LLM Client §5.5`)를 명시해 Rationale 로서 자립도를 높였다. 코드명 자체는 `MODEL_CONFIG_INVALID` 로 `error-codes.md §1` 의미 기반 원칙 및 `3-error-handling.md §1.3` 카탈로그와 일치한다.
- 제안: 현행 유지.

---

### [WARNING] `§3. API — Authentication API` 테이블 내 권한 표기 — 일부 엔드포인트 누락

- target 위치: `§3. API — Authentication API` 테이블, lines 261–267
- 위반 규약: `spec/conventions/swagger.md §2-4` "보호된 엔드포인트는 `@ApiForbiddenResponse` 포함" / API 문서 규약 (Swagger 데코레이터 패턴 준수); 더 직접적으로는 본 spec 내부 일관성
- 상세: 표 상단 산문에 "mutation(POST/PATCH/DELETE/regenerate/reveal)은 Admin+" 가 명시됐으나, 테이블 `설명` 컬럼에서 `POST /api/auth-configs` 는 `**(Admin+)**` 가 달려 있고 `PATCH /:id` 도 달려 있지만, `POST /:id/regenerate` 에는 `**(Admin+)**` 가 있는 반면 `GET /api/auth-configs/:id` 상세조회 행은 권한 표기가 없다(설계상 Viewer+ 이므로 의도적일 수 있음). 테이블에서 Viewer+ 허용 행과 Admin+ 제한 행을 권한 레이블로 구분하는 현행 방식 자체는 허용되나, `POST /api/auth-configs/:id/reveal` 의 경우 본문에서 `**Admin+**` 로 강조 표기되어 있어 누락이 없다. 전반적으로 내부 일관성은 유지된다.
- 제안: 정식 규약(`swagger.md`) 측면에서는 spec 문서 레벨이라 컨트롤러 데코레이터와 직접 관련없다. 단 spec 테이블 권한 표기의 일관성을 위해 GET 조회 행들에도 "(Viewer+)" 를 명시적으로 달면 가독성이 높아진다(의무 수준 아님).

---

### [INFO] 문서 3섹션 구조 — Overview / 본문 / Rationale 준수

- target 위치: 전체 문서 구조
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- 상세: `## Overview (제품 정의)` → `## Part A / Part B` (본문) → `## Rationale` (R-1 ~ R-6) 3섹션 구조를 갖추고 있어 권장 패턴을 따른다. 다만 `## 3. API` 섹션이 Part B 와 Rationale 사이에 위치해 본문부가 둘로 나뉜 형태다. 이는 Navigation spec 패턴상 API 표를 별도 섹션으로 두는 기존 관행으로, 규약 위반이 아닌 확립된 구조다.
- 제안: 현행 유지.

---

### [INFO] 파일 명명 및 frontmatter `id`

- target 위치: 파일명 `6-config.md`, frontmatter `id: config`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` "id 는 파일 basename 기반 권장"
- 상세: basename `6-config` 에서 숫자 prefix 제거 후 `config` = `id: config`. 일치. `spec/2-navigation/` 영역 내 다른 `config` id 와 충돌하지 않는다.
- 제안: 현행 유지.

---

## 요약

`spec/2-navigation/6-config.md` 워크트리 수정본은 정식 규약 준수 관점에서 양호하다. 핵심 수정 3건(①`§B.6.2` `RERANK_CONFIG_INVALID`→`MODEL_CONFIG_INVALID`, ② `R-1` 미구현 코드 `LLM_MODEL_NOT_FOUND` 인라인 제거 + SoT 위임, ③ `R-4` 동일 코드 교정 + Dropped 맥락 추가)은 모두 `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙, `spec/5-system/3-error-handling.md §1.3` 카탈로그, `spec/5-system/9-rag-search.md §374` 레이어 구분 SoT 와 정합한다. 감사 액션 표기(`auth_config.reveal`)는 `spec/conventions/audit-actions.md §1·§3` 규약을 따르고, 문서 구조(3섹션)·frontmatter(`implemented` + `code:` 다수 항목) 모두 규약 적합이다. WARNING 1건(API 테이블 내 조회 행 권한 레이블 미표기)은 spec 내부 가독성 개선 사항이며 규약 직접 위반은 아니다.

---

## 위험도

LOW
