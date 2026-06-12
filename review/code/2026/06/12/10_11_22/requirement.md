# 요구사항(Requirement) 리뷰 — PR4b KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일

**대상 커밋**: `77f9641f` `docs(spec): PR4b SPEC-DRIFT 해소 — KB legacy 컬럼 은퇴 + 에러코드 통일 반영`
**리뷰 범위**: spec 변경 9개 파일 + review/consistency 산출물 5개 파일 + plan/in-progress/spec-update-pr4b-embedding-retire.md

---

## 발견사항

### [CRITICAL] `resolveEmbedding` ws-default-absent 에러코드 — `MODEL_CONFIG_NOT_FOUND`(404) vs `MODEL_CONFIG_DEFAULT_MISSING`(400) 불일치
- **위치**: `spec/5-system/8-embedding-pipeline.md:168` vs `spec/5-system/3-error-handling.md:51`
- **상세**: `8-embedding-pipeline.md §5.5` 는 `resolveEmbedding` 에서 워크스페이스 default `kind=embedding` config 도 없는 경우 `MODEL_CONFIG_NOT_FOUND`(404) 를 발행한다고 명시한다. 그러나 `3-error-handling.md §1.3` 은 `MODEL_CONFIG_DEFAULT_MISSING`(400) 의 발행 경로를 "`resolveConfig` 의 ws default 경로(`model-config.service.ts` 발행)"로만 기술하며 `resolveEmbedding` 경로를 전혀 언급하지 않는다. 결과적으로 두 spec 문서가 "ws default config 없음" 시나리오에서 서로 다른 코드·HTTP status 를 지정하고 있다. `spec/2-navigation/5-knowledge-base.md:239` 도 default 없을 때 `MODEL_CONFIG_NOT_FOUND` 를 참조해 8-embedding 과는 일치하나 3-error-handling 의 `MODEL_CONFIG_DEFAULT_MISSING` 의도와 충돌한다.
- **가능한 해석**: (A) `resolveEmbedding` 경로는 의도적으로 `MODEL_CONFIG_NOT_FOUND`(404)를 쓰고, `MODEL_CONFIG_DEFAULT_MISSING`(400) 은 chat config `resolveConfig` 경로 전용으로 설계됐으나 `3-error-handling.md §1.3` 설명이 이 구분을 명시하지 못함. (B) `resolveEmbedding` 도 `MODEL_CONFIG_DEFAULT_MISSING`(400) 을 써야 하나 8-embedding-pipeline spec 이 잘못 기술됨.
- **제안**: `3-error-handling.md §1.3` 의 `MODEL_CONFIG_DEFAULT_MISSING` 설명을 "`resolveConfig` 및 `resolveEmbedding` 의 ws default 경로" 로 확장하거나, 아니면 `8-embedding-pipeline.md §5.5` 의 에러코드를 `MODEL_CONFIG_DEFAULT_MISSING`(400) 으로 정정한다. 두 경로가 의도적으로 다른 에러코드를 쓴다면 그 설계 근거를 Rationale 에 명시해야 한다.

---

### [WARNING] [SPEC-DRIFT] `error-codes.md §3` 에 §3-§4 목적 구분 주석 추가 — §3 기존 설명 미갱신
- **위치**: `spec/conventions/error-codes.md:62` (신규 추가 주석) vs §3 Overview 텍스트
- **상세**: 이번 변경은 §3 마지막에 `> §3 은 **부정확한 이름이나 *유지*되는 active 코드**의 예외 등록부다. *교체·은퇴된* 구 코드의 rename 이력은 §4 에 둔다 (목적 레이어가 다르다).` 주석을 추가했다. 그러나 §3 제목 아래의 Overview 설명 원문(`원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다. 신규 코드는 예외를 선례로 삼지 않는다.`)은 수정되지 않았다. `consistency/09_01_10` SUMMARY Warning #8 이 지적한 "§3 의 기존 설명과 §4 의 목적 구분 명시 필요"가 주석 추가로 부분 해소됐으나, §3 Overview 텍스트 자체가 §4 존재를 언급하지 않아 주석(blockquote)과 Overview 가 중복·혼재한다.
- **코드 유지 + spec 반영**: §3 Overview 설명을 "active 코드 예외 등록(§4 에서 구 코드 이력 분리)" 로 갱신해야 완전 해소. 대상 spec: `spec/conventions/error-codes.md §3` Overview 텍스트.

---

### [WARNING] `3-error-handling.md §1.3` `MODEL_CONFIG_DEFAULT_MISSING` 발행 경로 — `resolveConfig` 전용 기술 (resolveEmbedding 누락)
- **위치**: `spec/5-system/3-error-handling.md:51`
- **상세**: Critical 발견과 연동. `MODEL_CONFIG_DEFAULT_MISSING` 의 발행처가 "`resolveConfig` 의 ws default 경로 (`model-config.service.ts` 발행)"로만 기술돼 `resolveEmbedding` 경로를 포괄하는지 불명확하다. `8-embedding-pipeline.md §5.5` 에서 embedding 폴백 실패 시 에러가 다른 코드(`MODEL_CONFIG_NOT_FOUND`)로 기술된 것과의 설계 의도 차이를 3-error-handling.md 에서 독자가 파악할 수 없다.
- **제안**: `MODEL_CONFIG_DEFAULT_MISSING` 설명에 `resolveEmbedding` 경로 포함 여부를 명시하거나, Critical 발견 해소와 연동해 일관된 기술로 수정한다.

---

### [WARNING] `data-flow/6-knowledge-base.md §1.6 embedding-probe` legacy 파라미터 잔존 — 미확인 처리
- **위치**: `spec/data-flow/6-knowledge-base.md:231`
- **상세**: `cross_spec` 검토 발견사항 6 (INFO) 에서 `§1.6 embedding-probe` API 의 `llmConfigId`·`embeddingModel` 파라미터 잔존을 지적했다. 이번 spec 변경은 `§2.1` 의 `embedding_model` 컬럼은 제거했으나 `§1.6` probe API shape 에서 legacy 파라미터를 제거하지 않았다. 실제 코드에서 해당 파라미터가 이미 제거됐다면 spec 과 코드가 불일치하고, 코드에 남아 있다면 PR4b 범위 누락이다. `plan/in-progress/spec-update-pr4b-embedding-retire.md` 적용 위치 표에도 `data-flow/6 §1.6` 항목이 없다.
- **제안**: 실제 `embedding-probe` 엔드포인트 코드에서 `llmConfigId`·`embeddingModel` 파라미터 존재 여부를 확인하고: (a) 코드에서 제거됐다면 `spec/data-flow/6-knowledge-base.md §1.6` 의 request body shape 를 갱신하고 plan 적용 위치 표에 추가한다. (b) 코드에 남아 있다면 INFO 수준 후속 정리 항목으로 plan 에 명시한다.

---

### [INFO] `spec-update-pr4b-embedding-retire.md` 체크박스 없음 — plan lifecycle 완료 추적 미비
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/plan/in-progress/spec-update-pr4b-embedding-retire.md`
- **상세**: plan 문서에 적용 위치 요약 표가 있으나 체크박스(`- [ ]`) 형태가 없다. `plan-lifecycle §2` 는 "미체크 체크박스가 0건"을 완료 조건으로 본다. `convention_compliance` 검토에서 INFO 로 지적됐으나 `spec/2-navigation/6-config.md` legacy 임베딩 서술 제거(§6 항목)가 이번 커밋에서 누락됐는지 확인이 어렵다.
- **제안**: spec 변경 완료 후 plan 을 `plan/complete/` 로 이동하거나, 미적용 항목이 있다면 체크박스 목록으로 전환해 잔여 작업을 명시한다.

---

### [INFO] `spec/2-navigation/6-config.md` legacy 임베딩 서술 — 이번 커밋 적용 여부 미확인
- **위치**: `spec/2-navigation/6-config.md`
- **상세**: `plan/in-progress/spec-update-pr4b-embedding-retire.md §6` 에는 `spec/2-navigation/6-config.md` 의 legacy 임베딩 서술 제거가 적용 위치 표에 포함돼 있다. 그러나 이번 커밋 `77f9641f` 의 변경 파일 목록에 `spec/2-navigation/6-config.md` 가 없다. 이 파일 변경이 의도적으로 scope 밖으로 분리됐거나 누락됐을 수 있다.
- **제안**: `spec/2-navigation/6-config.md` 변경이 이번 PR4b spec 적용 범위에 포함되는지 확인하고, 포함 시 추가 커밋으로 반영하거나 plan 에 "후속 적용" 항목으로 명시한다.

---

### [INFO] `CHANGELOG.md` PR4b 항목 — PR 번호 미기재 (`PR4b (#)`)
- **위치**: `CHANGELOG.md` (이번 커밋 추가 항목)
- **상세**: `spec/conventions/error-codes.md §4` Rename 이력 테이블의 PR 컬럼도 `PR4b` 이고 CHANGELOG 에도 실제 GitHub PR 번호가 없다. 외부 소비자 없음이 확인됐으나 내부 추적용으로도 PR 번호가 있으면 이력 탐색이 용이하다.
- **제안**: PR merge 후 실제 PR 번호로 `PR4b (#숫자)` 를 업데이트한다.

---

## 요약

이번 spec 변경은 PR4b 에서 코드로 구현된 KB legacy 임베딩 컬럼 은퇴(V093/V094)와 에러코드 통일(`LLM_CONFIG_*` → `MODEL_CONFIG_*`)을 spec 에 소급하는 SPEC-DRIFT 해소 작업이다. 대부분의 변경은 `8-embedding-pipeline.md §5.5` 2-step 교체, `1-data-model.md` legacy 컬럼 행 제거, `7-llm-client.md` 4곳 에러코드 갱신, `error-codes.md §4` Rename 이력 신설 등 의도한 요구사항을 충실히 반영했다. 그러나 `resolveEmbedding` 의 ws-default-absent 시 발행 에러코드가 `8-embedding-pipeline.md`(→ `MODEL_CONFIG_NOT_FOUND`/404)와 `3-error-handling.md`(→ `MODEL_CONFIG_DEFAULT_MISSING`/400) 사이에서 불일치하며, 이는 두 spec 문서 중 하나가 틀렸거나 설계 의도가 명시적으로 문서화되지 않은 상태다. 이 불일치는 클라이언트 분기 로직에 직접 영향을 주므로 반드시 해소가 필요하다.

---

## 위험도

**MEDIUM**

(Critical 발견 1건: `resolveEmbedding` 에러코드 spec 내부 불일치 — 두 spec 문서 간 서로 다른 에러코드·HTTP status 기술. 클라이언트 분기 계약 혼선 가능성. 나머지 Warning 2건은 spec 설명 정확성 개선 수준이며 기능 계약에 직접 위반은 아님.)
