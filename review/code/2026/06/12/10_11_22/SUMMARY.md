# Code Review 통합 보고서

## 전체 위험도
**HIGH** — spec 이 구현 완료를 앞서 선언한 세 지점(에러코드 rename, MODEL_CONFIG_DEFAULT_MISSING 신설, resolveEmbedding step-3 제거)에서 spec-impl 불일치가 다수 존재하며, 클라이언트 API 계약 혼선을 유발할 수 있다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C-1 | spec-impl 불일치 | `resolveEmbedding` 의 step-3 legacy 경로가 코드베이스에 잔존하는데 `spec/5-system/8-embedding-pipeline.md §5.5` 는 2-step 완료로 선언 | `model-config.service.ts:128-174` / `spec/5-system/8-embedding-pipeline.md §5.5` | `resolveEmbedding` 에서 step-3 분기 및 `embeddingLlmConfigId`/`legacyModel` 파라미터 제거 후 spec 확정. 또는 spec 에 "(V093 이후 활성화)" 주석 명시. |
| C-2 | spec-impl 불일치 | `LLM_CONFIG_INVALID` 가 `llm-preview.service.ts:39/48/69` 에서 live 발행 중인데 `error-codes.md §4` 는 retired("코드베이스에서 완전 제거")로 등재 | `llm-preview.service.ts:39,48,69` / `spec/conventions/error-codes.md §4` | `llm-preview.service.ts` 3곳을 `MODEL_CONFIG_INVALID` 로 교체해 이 PR 에 포함하거나, §4 에서 해당 행 제거 후 코드 교체 완료 후 재등재. |
| C-3 | spec-impl 불일치 | `MODEL_CONFIG_DEFAULT_MISSING` 이 `error-codes.ts` 와 서비스 코드 어디에도 미존재하는데 `error-codes.md §4` 에 "발행 중" 코드로, `3-error-handling.md §1.3` 에 신규 코드로 등재. `llm.service.ts:356` 은 여전히 `LLM_CONFIG_NOT_FOUND` 발행 중 | `error-codes.ts` / `model-config.service.ts:121` / `llm.service.ts:356` / `spec/conventions/error-codes.md §4` / `spec/5-system/3-error-handling.md §1.3` | `error-codes.ts` 에 `MODEL_CONFIG_DEFAULT_MISSING` 추가 → 서비스 throw 경로 전환 → spec 등재 순으로 구현 선행. 또는 spec 에서 해당 행 제거. |
| C-4 | API 계약 | `MODEL_CONFIG_DEFAULT_MISSING`(400) 신규 코드가 spec 에만 등재되고 실제 미구현 상태에서 클라이언트가 해당 분기를 추가하면 실제 응답(`LLM_CONFIG_NOT_FOUND`)과 불일치 발생 | `spec/5-system/3-error-handling.md:50` / `spec/conventions/error-codes.md §4` | 구현 선행 후 spec 등재. 또는 spec 에 "(구현 pending)" 명시. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | spec 내부 불일치 | `8-embedding-pipeline.md §5.5` 는 ws-default 부재 시 `MODEL_CONFIG_NOT_FOUND`(404) 를 기술하고, `3-error-handling.md §1.3` 은 `MODEL_CONFIG_DEFAULT_MISSING`(400) 을 기술 — 두 spec 문서가 동일 시나리오에서 서로 다른 코드·HTTP status 를 지정 | `spec/5-system/8-embedding-pipeline.md:168` / `spec/5-system/3-error-handling.md:51` | `3-error-handling.md §1.3` 의 발행 경로를 resolveEmbedding 포함으로 확장하거나 `8-embedding-pipeline.md §5.5` 를 `MODEL_CONFIG_DEFAULT_MISSING`(400) 으로 정정. 설계 의도 차이라면 Rationale 에 근거 명시. |
| W-2 | API 계약 | `MODEL_CONFIG_NOT_FOUND`(404) 의 "default 해석 실패" 경로가 `MODEL_CONFIG_DEFAULT_MISSING`(400) 으로 분리됨 — HTTP status + 코드 문자열 동시 변경(이중 breaking change). 실제 throw 경로 전환 여부 미확인 | `spec/5-system/3-error-handling.md` / `model-config.service.ts resolveConfig` | `resolveConfig` default 경로 throw 전환 여부 확인. 구현 미선행 시 spec 이 허위 계약이 됨. |
| W-3 | 부작용 | `resolveEmbedding` 3-step → 2-step 축소 — V093 migration 없이 배포 시 legacy-only KB 의 임베딩·검색이 `MODEL_CONFIG_NOT_FOUND`(404) 로 전면 장애 발생 | `spec/5-system/8-embedding-pipeline.md §5.5` | `8-embedding-pipeline.md §5.5` 에 "V093 repoint 완료 이전에는 3-step 코드 유지 필요(배포 순서 의존)" 를 명시하거나 V093 적용 후 spec 변경 PR 을 분리. |
| W-4 | API 계약 | `POST /api/knowledge-bases` request body 에서 `embedding_model` 필드 제거 — NestJS ValidationPipe 의 strip/reject 동작 미명시, 실제 DTO 전환 여부 미확인 | `spec/data-flow/6-knowledge-base.md:1701` / `create-knowledge-base.dto.ts` | 컨트롤러 DTO 에서 `embedding_model` 실제 제거 확인. spec 에 "unknown 필드는 strip 처리" 또는 "deprecated, 무시됨" 명시. |
| W-5 | API 계약 | `embedding-probe` 엔드포인트 request body spec 에 legacy `llmConfigId`·`embeddingModel` 파라미터 잔존. PR4b 가 step-3 제거했다면 이 파라미터도 무효화됐을 가능성 | `spec/data-flow/6-knowledge-base.md:231` | 실제 컨트롤러 DTO 확인 후 제거됐다면 `spec/data-flow/6-knowledge-base.md §1.6` 갱신. |
| W-6 | API 계약 | `PATCH /api/knowledge-bases/:id` 에서 `embedding_dimension` NULL reset 트리거 조건이 `embedding_model` 변경에서 `embedding_model_config_id` 변경으로 바뀜. 구형 클라이언트가 `embedding_model` 전송 시 dimension reset 미트리거로 차원 불일치 가능 | `spec/data-flow/6-knowledge-base.md:1725` | PATCH 에서 `embedding_model` 필드 무시/오류 여부 spec 명시. `embedding_model_config_id` 변경 시 재임베딩 트리거 여부도 명시. |
| W-7 | DB/마이그레이션 | V094 `DROP COLUMN` 이 `AccessExclusiveLock` 획득 — 무중단 배포 시 lock 부하 완화 절차(배포 윈도우, 점진 배포 등)가 spec 에 미명시 | `spec/5-system/8-embedding-pipeline.md` Rationale / `spec/1-data-model.md` | V094 마이그레이션 SQL 작성 시 테이블 행 수 및 배포 전략 고려. lock 완화 절차를 spec Rationale 에 명시. |
| W-8 | DB/마이그레이션 | V093 fail-loud RAISE 의 트랜잭션 원자성 미기술 — DDL+DML 혼재 시 암묵적 커밋 여부가 spec 에 없어 구현자가 잘못된 패턴으로 작성 위험 | `spec/5-system/8-embedding-pipeline.md §5.5` | V093 설계 문서에 "검증 쿼리 + RAISE + repoint DML 은 단일 트랜잭션 내 수행, RAISE 시 V093 전체 롤백 보장" 명시. |
| W-9 | [SPEC-DRIFT] `error-codes.md §3` 하단 목적 구분 주석 추가 — §3 Overview 텍스트 미갱신으로 주석과 Overview 중복·혼재 | `spec/conventions/error-codes.md §3` | §3 Overview 설명을 "active 코드 예외 등록(§4 에서 구 코드 이력 분리)" 으로 갱신. |
| W-10 | 테스트 | `error-codes.spec.ts` 에 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 잔존을 CI 에서 검출하는 회귀 가드 없음 — spec §4 "완전 제거" 단언이 테스트로 미보증 | `codebase/backend/src/nodes/core/error-codes.spec.ts` | 구 코드명이 코드베이스 어디에도 발행되지 않음을 검증하는 회귀 테스트 또는 CI grep 가드 추가. |
| W-11 | 문서 | `spec/data-flow/7-llm-usage.md` 변경이 plan `## 적용 위치 요약` 표에 미등재 — 추적성 결함 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` | plan 표에 `spec/data-flow/7-llm-usage.md | embeddingLlmConfigId 참조 제거` 행 소급 추가. |
| W-12 | 문서 | CHANGELOG.md breaking change 에 응답 shape 에서 `embeddingLlmConfigId` 제거(`GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id`) 미명시 | `CHANGELOG.md:13` | CHANGELOG breaking change #3 에 응답 shape 변경 엔드포인트 명시 보완. |
| W-13 | 아키텍처 | `resolveEmbedding` step-3 legacy 경로에서 `findEntity` 호출 시 kind 파라미터 생략 — kind 검사 생략 의도가 주석 없이 이루어져 계약 일관성 저하 | `model-config.service.ts:167-169` | step-3 제거 시 해당 경로 함께 삭제. 유지 시 `// kind 무시: legacy piggyback — PR4b V094 DROP 후 제거 예정` 주석 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | V093 마이그레이션에서 `api_key` ciphertext 를 SQL 레벨 직접 복사 — row-bound IV 없는 애플리케이션 레이어 암호화 구조를 전제. 이 전제 정합성 통합 테스트 검증 권장 | `migrations/V093__kb_embedding_repoint.sql` | V093 적용 후 통합 테스트에서 새 `kind=embedding` config 의 api_key 복호화 검증 추가. |
| I-2 | 보안 | `workspaceId` 가 오류 메시지에 포함됨 — 인증된 사용자 자기 워크스페이스 컨텍스트이므로 실질 위험 제한적. 기존 패턴 유지 | `llm.service.ts:353` | 운영 환경에서 오류 응답 노출 범위 확인. 필요시 서버 로그에만 기록. |
| I-3 | 아키텍처 | `spec/1-data-model.md` 에서 legacy 컬럼 행 완전 삭제 — 마이그레이션 이력 추적성 약화. 구현 상태 주석에는 기술돼 있으나 테이블 정의에 흔적 없음 | `spec/1-data-model.md §2.11` | 마이그레이션 이력 표에 "V093/V094: `embedding_llm_config_id`, `embedding_model` 삭제" append-only 기록 추가. |
| I-4 | API 계약 | `spec/2-navigation/5-knowledge-base.md` 에 ws default 부재 시 `MODEL_CONFIG_NOT_FOUND` 로 기술됨 — `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING` 분리와 불일치. UI 에러 안내 혼선 가능 | `spec/2-navigation/5-knowledge-base.md:1415` | 해당 라인을 `MODEL_CONFIG_DEFAULT_MISSING` 으로 수정. |
| I-5 | 요구사항 | `spec/2-navigation/6-config.md` legacy 임베딩 서술 제거가 이번 커밋 변경 파일 목록에 없음 — plan §6 항목 적용 여부 미확인 | `spec/2-navigation/6-config.md` | 이번 PR4b 범위 포함 여부 확인 후 미포함 시 후속 커밋 또는 plan 에 "후속 적용" 명시. |
| I-6 | 문서 | `spec/conventions/error-codes.md §4` PR 컬럼에 실제 GitHub PR 번호 없이 `PR4b` 코드명만 기재 | `spec/conventions/error-codes.md:70-71` | PR merge 후 실제 PR 번호로 갱신. merge 전 `(PR4b, #TBD)` placeholder 추가 권장. |
| I-7 | DB/마이그레이션 | `embedding_model_config_id` FK 에 대한 인덱스가 spec 데이터 모델 표에 미명시 — V093 IS NULL 스캔 성능 및 resolveEmbedding 조회 경로 성능 우려 | `spec/1-data-model.md §2.11` / `spec/data-flow/6-knowledge-base.md` | `knowledge_base(embedding_model_config_id)` 인덱스 존재 여부 확인 후 spec 에 명시. |
| I-8 | 테스트 | V093 step-3b (ws default chat 폴백 경유 find-or-create)에 대한 통합 테스트 없음. fail-loud RAISE 자체가 운영 배포 게이트이나 staging DB 수동 검증 권장 | `migrations/V093__kb_embedding_repoint.sql` | V093 운영 실행 전 staging DB 에서 step-3b 수동 검증. |
| I-9 | 요구사항 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` 에 체크박스 없음 — plan-lifecycle §2 완료 조건 미충족 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` | spec 변경 완료 후 `plan/complete/` 이동 또는 미적용 항목 체크박스 목록 전환. |
| I-10 | 문서 | `review/consistency/.../09_01_10/_retry_state.json` 이 `agents_pending` 초기 상태로 커밋됨 — 완료 상태와 다른 파일 잔존으로 혼선 가능 | `review/consistency/2026/06/12/09_01_10/_retry_state.json` | 완료 시점 상태로 갱신하거나 `.gitignore` 처리. |
| I-11 | user_guide_sync | spec-major-change 트리거 5개 파일 모두 frontmatter 정합 확인 완료. `codebase/` 변경 없으므로 i18n/locale/docs MDX 동반 갱신 누락 없음 | 전체 변경 파일 | 없음. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | HIGH | spec 이 미완성 구현을 완료 선언 — resolveEmbedding step-3 잔존, LLM_CONFIG_INVALID/LLM_CONFIG_NOT_FOUND live 발행, MODEL_CONFIG_DEFAULT_MISSING 미구현 |
| api_contract | HIGH | 에러코드 spec-impl 불일치로 클라이언트 API 계약 위반. embedding_model 필드 제거·dimension reset 조건 변경·embedding-probe legacy 파라미터 잔존 |
| requirement | MEDIUM | resolveEmbedding ws-default 에러코드 두 spec 문서 불일치(MODEL_CONFIG_NOT_FOUND vs MODEL_CONFIG_DEFAULT_MISSING) |
| side_effect | MEDIUM | spec §4 retirement 선언이 실제 코드와 불일치로 클라이언트 계약 부작용. V093 미완료 배포 시 legacy KB 전면 장애 위험 |
| database | MEDIUM | V094 DROP COLUMN lock 부하 절차 미명시. V093 fail-loud 트랜잭션 원자성 미명시 |
| security | LOW | api_key ciphertext 복사 전제 확인 필요(INFO). SSRF 가드 보안 기능 보존 확인 완료 |
| scope | LOW | data-flow/7-llm-usage.md 변경이 plan 표에 미등재(WARNING). 나머지 범위는 plan과 1:1 대응 |
| maintainability | LOW | error-codes.md §4 PR 번호 미기재(WARNING). §3 경계 주석 섹션 귀속 모호(INFO) |
| testing | LOW | error-codes.spec.ts 에 구 코드명 잔존 검출 회귀 가드 없음(WARNING). resolveEmbedding/MODEL_CONFIG_DEFAULT_MISSING/MODEL_CONFIG_INVALID 테스트는 커버됨 |
| documentation | LOW | 7-llm-client.md 내 LLM_CONFIG_INVALID 4곳 이미 갱신 완료. 8-embedding-pipeline.md §5.5 step-2 에러코드 spec 내부 불일치(W-1 과 중복) |
| user_guide_sync | NONE | spec-major-change 5개 파일 frontmatter 정합 완료. codebase/ 변경 없으므로 동반 갱신 누락 없음 |

---

## 발견 없는 에이전트

- **user_guide_sync** — spec-major-change 트리거 frontmatter 정합 모두 충족. 누락 0건.

---

## 권장 조치사항

1. **(최우선 — C-2/C-3)** `llm-preview.service.ts` 3곳의 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 교체 + `error-codes.ts` 에 `MODEL_CONFIG_DEFAULT_MISSING` 추가 + `llm.service.ts:356` / `model-config.service.ts:121` throw 경로 전환을 이 PR 에 포함시켜 spec §4 "retired" 선언을 사실로 만들 것.
2. **(C-1 / W-3)** `model-config.service.ts resolveEmbedding` 에서 step-3 legacy 경로(`embeddingLlmConfigId`/`legacyModel`) 제거 또는 V093 배포 순서 의존 주석 명시. spec §5.5 2-step 선언은 코드 변경 선행 후 확정할 것.
3. **(W-1)** `8-embedding-pipeline.md §5.5` 와 `3-error-handling.md §1.3` 의 ws-default 부재 에러코드 불일치 해소 — 두 문서 중 하나를 `MODEL_CONFIG_DEFAULT_MISSING`(400) 으로 통일하거나 설계 분리 근거를 Rationale 에 명시.
4. **(W-4 / W-5 / W-6)** `POST /api/knowledge-bases` DTO `embedding_model` 필드 제거, `embedding-probe` 엔드포인트 legacy 파라미터 제거, `PATCH` dimension reset 트리거 조건 변경 — 실제 코드 전환 완료 여부 확인 후 spec 동기화.
5. **(W-7 / W-8)** V094 DROP COLUMN lock 부하 완화 절차 및 V093 fail-loud 트랜잭션 원자성 보장을 spec Rationale 에 명시.
6. **(W-10)** `error-codes.spec.ts` 에 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 잔존을 CI 에서 검출하는 회귀 가드(grep 또는 단위 테스트) 추가.
7. **(W-9 / W-11 / W-12)** `error-codes.md §3` Overview 텍스트 갱신, plan 적용 위치 표에 `7-llm-usage.md` 소급 추가, CHANGELOG breaking change 에 응답 shape 변경 엔드포인트 명시 보완.
8. **(I-4)** `spec/2-navigation/5-knowledge-base.md` 의 `MODEL_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 수정.
9. **(I-6)** PR merge 후 `error-codes.md §4` PR 컬럼에 실제 PR 번호 기입.
10. **(I-9)** spec 변경 완료 시 `plan/in-progress/spec-update-pr4b-embedding-retire.md` 를 `plan/complete/` 로 이동.

---

## 라우터 결정

routing=done (router 가 선별).

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync (11명)
- **강제 포함(router_safety)**: documentation, requirement
- **제외** (router 선별):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | performance | spec-only 변경, 성능 측정 대상 코드 없음 |
  | dependency | 외부 패키지 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
