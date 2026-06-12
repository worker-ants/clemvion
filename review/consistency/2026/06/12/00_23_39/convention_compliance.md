# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 범위: PR4b — KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일

---

## 발견사항

### [CRITICAL] `spec/5-system/8-embedding-pipeline.md` §5.5 V092 제거 예정 기술 오류 — 버전 충돌

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §5.5 마지막 주석 (라인 177)
  ```
  > legacy 컬럼(embedding_llm_config_id·embedding_model)은 V092 에서 제거 예정 ([데이터 모델 §2.11](../1-data-model.md#211-knowledgebase)).
  ```
- **위반 규약**: `spec/conventions/migrations.md §3` (Append-only 원칙 — 이미 main 에 들어간 V<N>은 수정 불가) + `migrations.md §2` (V번호 단조 증가, gap 금지)
- **상세**: V092 는 이미 main 에 머지된 `V092__drop_rerank_config.sql` (PR4a) 이다. 이 라인은 PR4b 의 DROP 마이그레이션을 "V092" 라고 기술하지만 V092 는 이미 `rerank_config` DROP 으로 점유됐다. PR4b 의 repoint(`V093`) + DROP(`V094`)은 V093/V094 가 돼야 한다. spec 문서가 "V092 에서 제거 예정"으로 계속 기술되면 개발자가 V092 를 재사용하거나 버전 충돌을 발생시킬 수 있다. `spec/1-data-model.md` §2.11 의 동일 표현도 동일하게 stale 하다(라인 337: "데이터 마이그레이션 선행이 필요해 PR4(V092)의 `rerank_config` DROP과 달리 존치").
- **제안**: PR4b 착수 전 spec 에서 "V092 에서 제거 예정" → "V093/V094 에서 제거 예정(PR4b)"로 갱신. `spec/5-system/8-embedding-pipeline.md` §5.5 주석과 `spec/1-data-model.md` §2.11 KnowledgeBase 표의 두 legacy 필드 설명을 함께 갱신해야 한다.

---

### [CRITICAL] `spec/conventions/error-codes.md` — `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 에러코드 rename 안정성 위반 가능성

- **target 위치**: PR4b 구현 계획 (4번 항목 "에러코드 LLM_CONFIG_NOT_FOUND→MODEL_CONFIG_NOT_FOUND / LLM_CONFIG_INVALID→MODEL_CONFIG_INVALID")
- **위반 규약**: `spec/conventions/error-codes.md §2` (rename 안정성 — 에러 코드 rename 은 breaking change. 클라이언트가 코드 값으로 분기하므로 deprecated alias·이중 발행·마이그레이션 부담이 발생한다. 이름 정확성 향상만을 위한 rename 은 하지 않는다.)
- **상세**: `spec/5-system/7-llm-client.md §6` 에 `LLM_CONFIG_INVALID` 가 현재 코드에서 사용 중이다(팩토리 생성 실패/preview SSRF 차단 경로). `spec/5-system/3-error-handling.md §1.3` 에는 이미 `MODEL_CONFIG_INVALID`(400) 와 `MODEL_CONFIG_NOT_FOUND`(404) 가 **현행 카탈로그**에 등재돼 있다. 즉 `spec/5-system/3-error-handling.md` 는 이미 `MODEL_CONFIG_*` 코드를 정식으로 정의·사용 중이며, `LLM_CONFIG_INVALID`/`LLM_CONFIG_NOT_FOUND` 는 `7-llm-client.md §6` 의 **preview 전용 에러 경로**에서 계속 발행된다.

  PR4b 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` rename 을 수행하면:
  1. `7-llm-client.md §6` 에서 현재 코드가 `LLM_CONFIG_INVALID` 로 정의된 preview 경로의 에러 코드가 rename 된다 — 이 코드 값을 분기하는 프론트엔드 코드가 있다면 breaking.
  2. `error-codes.md §2` 의 명시적 금지 "이름 정확성 향상만을 위한 rename 은 하지 않는다" 에 해당할 수 있다. 단, `LLM_CONFIG_*` → `MODEL_CONFIG_*` 는 단순 이름 정확성 개선이 아니라 "LLMConfig 도메인 → ModelConfig 도메인으로의 개념 변경"이라면 신규 조건이므로 §2 예외가 될 수 있다.
  3. `unified-model-management.md §7 PR4 처리 항목 #21` 은 "클라이언트 마이그레이션 가이드 또는 alias 서비스에서 catch + 구 코드 재매핑"을 명시하고 있으므로 breaking 인식을 전제한다.

- **제안**: 착수 전 반드시 확인해야 할 사항:
  1. `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 를 클라이언트(프론트엔드)가 분기하는 경로가 있는지 검색 (`codebase/frontend/` 내 `LLM_CONFIG` 리터럴 사용 여부).
  2. 만약 존재한다면 `error-codes.md §2` 의 "deprecated alias·이중 발행" 전략 또는 `§3 historical-artifact 레지스트리` 등재 후 신규 코드 병행 발행 방식으로 처리해야 한다.
  3. 클라이언트가 코드 값을 직접 분기하지 않는다면(서버 내부 전용 사용) rename 은 허용 범위이나 spec 에 그 근거를 명시해야 한다(`error-codes.md §3` 레지스트리에 "LLM_CONFIG_INVALID 는 내부 전용이었으므로 rename 허용" 기록).

---

### [WARNING] `spec/5-system/8-embedding-pipeline.md` §5.5 — resolveEmbedding step-3 제거 후 spec 갱신 계획 미명시

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §5.5 "임베딩 설정 해석 폴백 체인 (resolveEmbedding, PR2)"
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`에 기술해야 하며, spec 본문은 현행 사실을 반영해야 한다.
- **상세**: PR4b 구현 후 step-3 legacy 폴백이 제거되면 §5.5 의 3단계 폴백 체인 중 "3. **legacy 폴백**" 항목이 폐기된다. 이 spec 갱신(step-3 제거 + "PR2" 단서 제거 + legacy 컬럼 제거 반영)이 PR4b 의 spec 변경 범위임을 plan 에 명시하지 않으면 구현 완료 후 spec 이 drift 상태가 된다. `spec-impl-evidence.md §3.1` 의 `partial → implemented` 전이 규칙에 따라 plan 완료 시 spec 갱신 의무가 있다.
- **제안**: PR4b plan 문서에 spec 변경 목록으로 `spec/5-system/8-embedding-pipeline.md §5.5` step-3 제거 및 §5.5 전체 개정(또는 섹션 삭제)을 명시한다. 구현과 동일 PR 에서 spec 도 갱신해야 한다.

---

### [WARNING] `spec/5-system/7-llm-client.md §6` — `LLM_CONFIG_INVALID` 참조가 PR4b 후에도 잔존할 경우 spec 불일치

- **target 위치**: `spec/5-system/7-llm-client.md` §5.5(SSRF 가드 설명), §6 에러 처리 표 (라인 341: `LLM_CONFIG_INVALID`), §5 preview 관련 설명 (라인 235, 257)
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 — spec 은 단일 진실이어야 한다. `error-codes.md §1` 의 의미 기반 명명 원칙상 코드 rename 시 모든 참조 문서를 함께 갱신해야 한다.
- **상세**: PR4b 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` rename 이 확정된다면, `spec/5-system/7-llm-client.md §6` 의 에러 처리 표와 §5.5 SSRF 가드 설명의 `LLM_CONFIG_INVALID` 참조도 함께 갱신돼야 한다. 현재 이 spec 들은 구 코드명으로 기술되어 있다.
- **제안**: PR4b 구현 시 `7-llm-client.md` §5.5, §6 의 `LLM_CONFIG_INVALID` 참조를 `MODEL_CONFIG_INVALID` 로 일괄 갱신하거나, 해당 코드가 llm-client preview 경로 전용으로 계속 유지된다면 그 이유를 Rationale 에 명시한다.

---

### [WARNING] `spec/1-data-model.md` §2.11 — legacy 필드 설명의 V번호 기술이 stale

- **target 위치**: `spec/1-data-model.md` §2.11 KnowledgeBase 표의 `embedding_llm_config_id`·`embedding_model` 필드 설명
- **위반 규약**: `spec/conventions/migrations.md §2` (V번호 단조 증가, 재사용 금지) 준수를 위한 spec 명확성
- **상세**: 두 필드의 설명에 "PR4(V092)의 `rerank_config` DROP 과 달리 존치" 라는 표현이 있다. V092 는 이미 `rerank_config` DROP 으로 완료됐고, PR4b 의 마이그레이션은 V093/V094 여야 한다. 이 참조가 개발자에게 V092 번호 재사용을 암시할 수 있다.
- **제안**: CRITICAL 항목과 함께 처리 — "PR4(V092)" → "PR4a(V092, 완료), PR4b(V093/V094 예정)"으로 갱신.

---

### [WARNING] V093 repoint 마이그레이션 — fail-loud RAISE 정책의 spec 근거 미명시

- **target 위치**: PR4b 구현 계획 (1번 항목 — V093 repoint 마이그레이션에서 "fail-loud RAISE" 적용)
- **위반 규약**: `spec/conventions/migrations.md §3` (Append-only 원칙) + `CLAUDE.md` Rationale 3섹션 권장
- **상세**: "embedding_model_config_id IS NULL 인 모든 KB 를 creds 출처 우선순위 embedding_llm_config_id→ws default chat→ws default embedding 로 찾아 kind=embedding ModelConfig find-or-create 후 pin, fail-loud RAISE" 는 비가역 데이터 마이그레이션의 실패 전략이다. 이 fail-loud 정책(repoint 실패 시 RAISE EXCEPTION 로 전체 마이그레이션 중단)은 spec 의 어느 문서에도 정의되어 있지 않다. `migrations.md` 는 트랜잭션 모드와 실패 처리에 대한 가이드를 `migrations/README.md` 에 위임하나, **비가역 데이터 마이그레이션에서의 fail-loud 전략**은 spec 수준의 결정이다.
- **제안**: PR4b plan 또는 `spec/5-system/8-embedding-pipeline.md` Rationale 에 V093 의 fail-loud 전략과 그 근거(repoint 실패 시 일부 KB 만 마이그레이션된 채 컬럼 DROP 진행 불가 → 전체 RAISE 가 더 안전)를 명시한다.

---

### [INFO] `spec/5-system/8-embedding-pipeline.md` §5.5 — "(PR2)" 수식어가 PR4b 이후에도 남을 수 있음

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` §5.5 섹션 제목 "임베딩 설정 해석 폴백 체인 (resolveEmbedding, PR2)"
- **위반 규약**: `CLAUDE.md` 문서 구조 권장 — spec 본문은 PR 단위 메타데이터가 아닌 현행 사실을 기술해야 한다.
- **상세**: PR4b 에서 legacy 폴백이 제거되고 §5.5 자체가 불필요해지면 "(PR2)" 수식어가 더 이상 의미가 없다. spec-only 기술 이슈이나, PR4b 완료 후 섹션 삭제 또는 내용 통합(§5.2 임베딩 모델 본문에 통합)이 필요하다.
- **제안**: PR4b 구현 후 §5.5 전체를 삭제하거나 §5.2 에 "임베딩 모델 해석은 KB.embedding_model_config_id → ws default embedding 2단계로 단순화됐다" 형태로 통합한다. 현재는 INFO — 착수 전 확인 불필요하나 PR 완료 체크리스트에 포함할 것.

---

### [INFO] `spec/conventions/migrations.md §5` — V093/V094 두 파일 절차 확인 필요

- **target 위치**: PR4b 구현 계획 — V093 repoint + V094 DROP 두 마이그레이션
- **위반 규약**: `spec/conventions/migrations.md §2` (gap 금지: 두 개를 추가하면 +1, +2 가 돼야 한다)
- **상세**: 현재 main max V는 V092. PR4b 는 V093(repoint) + V094(DROP) 두 마이그레이션을 추가해야 한다. `migrations.md §2` 에 따라 gap 없이 V093·V094 순서대로 추가해야 하며, PR4b 브랜치 착수 전 `git rebase origin/main` + `python3 scripts/check-migration-versions.py --base origin/main` 로 V번호 충돌 여부 확인이 필수다. V094(비가역 DROP)는 V093 repoint 데이터 마이그레이션이 성공적으로 운영 적용된 이후에만 실행돼야 하므로, 두 마이그레이션을 동일 PR 에 넣을 경우 V093 + V094 가 atomic 하게 적용되는 리스크를 plan 에서 명시적으로 수용(또는 별 PR 로 분리)해야 한다.
- **제안**: V094 DROP 마이그레이션을 V093 과 동일 PR 에 포함할 경우, V093 검증 단계("V093 만 적용된 상태에서 일정 기간 운영 후 V094 적용" 같은 단계적 배포)가 불가능하다. plan 에 이 trade-off 를 명시한다. 착수 전 `ls codebase/backend/migrations | tail -2` 로 현재 max V 재확인 필수.

---

## 요약

PR4b 구현 착수 전 주요 정식 규약 준수 이슈는 두 가지다. (1) `spec/5-system/8-embedding-pipeline.md §5.5` 와 `spec/1-data-model.md §2.11` 이 PR4b 의 마이그레이션을 "V092 에서 제거 예정"으로 기술하고 있는데 V092 는 이미 PR4a 에서 `rerank_config` DROP 으로 점유됐다 — 실제 버전 번호는 V093/V094 이어야 하며, 개발자가 V092 를 재사용하거나 충돌을 유발할 수 있어 CRITICAL 수준이다. (2) `error-codes.md §2` 의 rename 안정성 정책상 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` rename 이 breaking change 인지 여부를 착수 전 검증해야 한다 — 프론트엔드가 이 코드 값을 직접 분기하는지 확인 후, 분기 경로가 없으면 rename 허용(근거 Rationale 명시), 있으면 alias·이중발행·historical-artifact 레지스트리 등재 전략이 필요하다. WARNING 항목들은 spec drift 방지 관련이며 구현 완료 시 spec 동반 갱신으로 해소해야 한다.

## 위험도

HIGH
