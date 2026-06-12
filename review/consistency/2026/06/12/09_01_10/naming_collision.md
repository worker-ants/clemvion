# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-update-pr4b-embedding-retire.md`

---

## 발견사항

### 1. [WARNING] `LLM_CONFIG_INVALID` 와 `MODEL_CONFIG_INVALID` 의 이중 표기 — spec 내 동일 코드가 다른 이름으로 기재

- **target 신규 식별자**: `spec/5-system/7-llm-client.md §5.5, §6` 에서 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 표기 갱신 제안
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/7-llm-client.md` line 235, 257, 327, 341: 아직 `LLM_CONFIG_INVALID` 로 기재 중
  - `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/3-error-handling.md` line 48: `MODEL_CONFIG_INVALID` 로 이미 기재 (코드베이스도 동일)
- **상세**: 코드베이스(`model-config.service.ts`, `llm-preview.service.ts` 등)는 이미 `MODEL_CONFIG_INVALID` 를 사용한다. spec §1.3(error-handling)도 `MODEL_CONFIG_INVALID` 로 최신화돼 있다. 그러나 `7-llm-client.md` §6 에러 표 및 §5.5 SSRF 가드 서술은 여전히 구 이름 `LLM_CONFIG_INVALID` 를 사용해 동일 에러코드가 spec 내에서 두 이름으로 동시에 표기되는 상태다. target draft 의 갱신 방향은 옳으나, 갱신 범위가 §5.5·§6 만으로 명시된 반면 line 235·257·341 등 §6 내 여러 행이 모두 교체 대상임을 명시적으로 다뤄야 한다.
- **제안**: target draft 의 §4 변경 계획에 7-llm-client.md 의 모든 `LLM_CONFIG_INVALID` 출현(line 235, 257, 327, 341)을 `MODEL_CONFIG_INVALID` 로 일괄 치환함을 명시한다. 누락 치환 시 spec 독자가 두 이름을 별개 코드로 오해할 수 있다.

---

### 2. [WARNING] `§3 Historical Artifacts (Retired Codes)` 절 — 기존 `## 3. Historical-artifact 예외 레지스트리` 와 섹션 제목·목적이 충돌

- **target 신규 식별자**: `spec/conventions/error-codes.md §3 historical-artifact` 에 `## §3 Historical Artifacts (Retired Codes)` 제목으로 새 서브섹션 추가 제안
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/conventions/error-codes.md` line 52: `## 3. Historical-artifact 예외 레지스트리` 가 이미 존재하며, 원칙(§1)을 따르지 않는 *기존 코드*를 등록하는 테이블을 보유한다.
- **상세**: target 이 제안하는 "Retired Codes" 표는 **rename 이행된 구 코드**를 등재하는 목적인 반면, 기존 `## 3` 은 **명명 부정확하지만 안정성을 위해 유지되는 코드**를 등재하는 목적이다. 두 목적은 다르므로(retired vs retained) 섹션 제목을 달리해야 한다. target draft 가 제안하는 제목 `## §3 Historical Artifacts (Retired Codes)` 는 기존 `## 3` 절을 덮어쓰는 것처럼 읽히나, 실제 의도는 *동일 섹션에 새 서브절 또는 별도 테이블 추가*인 것으로 보인다. 제목이 기존 절과 충돌한다.
- **제안**: 기존 `## 3. Historical-artifact 예외 레지스트리` 를 유지하고, retired 코드는 동일 섹션 내 별도 테이블(`### 3.1 Retained (명명 부정확, 유지)` / `### 3.2 Retired (rename 이행, 폐기)` 분리)로 추가하거나, 명확히 다른 제목(`## 4. Retired Codes (rename 이행 코드)`)의 새 절로 신설한다. target draft 의 표 내용 자체(LLM_CONFIG_NOT_FOUND, LLM_CONFIG_INVALID 등재)는 충돌 없이 유효하다.

---

### 3. [WARNING] `MODEL_CONFIG_NOT_FOUND` 설명 정정 — 기존 spec §1.3 의 "default 해석 실패" 서술이 target 제안과 의미 불일치

- **target 신규 식별자**: `spec/5-system/3-error-handling.md §1.3` 의 `MODEL_CONFIG_NOT_FOUND` 설명을 "id 지정 경로 전용. cross-kind access 도 동일 코드" 로 정정 제안
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/3-error-handling.md` line 50: `"지정 id 의 ModelConfig 부재 또는 cross-kind 접근 차단(존재 누설 방지), default 해석 실패"` 로 기재 중. "default 해석 실패" 가 명시적으로 포함돼 있다.
- **상세**: target 은 `MODEL_CONFIG_DEFAULT_MISSING(400)` 을 신설하고 "id 미지정 시 워크스페이스 default config 없음" 경로를 분리하므로, 기존 `MODEL_CONFIG_NOT_FOUND` 의 "default 해석 실패" 서술은 삭제·정정이 필요하다. 현재 spec 을 보면 `MODEL_CONFIG_NOT_FOUND` 에 "default 해석 실패" 가 여전히 남아 있어 `MODEL_CONFIG_DEFAULT_MISSING` 신설 후에도 두 코드의 용도 경계가 spec 상 모호하게 남는다. 코드베이스(`model-config.service.ts`, `llm.service.ts`)는 이미 두 코드를 분리 발행하므로 spec 이 뒤따라야 한다.
- **제안**: target draft 의 §2 변경 제안("After" 표)이 올바르다. 적용 시 `MODEL_CONFIG_NOT_FOUND` 설명의 "default 해석 실패" 문구를 제거하고, `MODEL_CONFIG_DEFAULT_MISSING` 신설 행을 추가한다.

---

### 4. [INFO] `data-flow/7-llm-usage.md` 의 `kb.embeddingLlmConfigId` 참조 — target 범위에서 누락

- **target 신규 식별자**: (직접 신설이 아니라 누락 지적)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/data-flow/7-llm-usage.md` line 119: `kb.embeddingLlmConfigId (V029)` 로 기재 중
- **상세**: target draft 의 적용 위치 요약 테이블에 `spec/data-flow/7-llm-usage.md` 가 포함되지 않았다. legacy 컬럼 제거를 반영해야 하는 파일이 추가로 존재한다. 충돌이 아니라 누락 위험이다.
- **제안**: target 적용 위치 표에 `spec/data-flow/7-llm-usage.md` 행을 추가해 `embeddingLlmConfigId` 참조 제거·갱신을 명시한다.

---

### 5. [INFO] `spec/5-system/8-embedding-pipeline.md §5.5` 의 step-3 레거시 서술 — "V092 에서 제거 예정" 잔존

- **target 신규 식별자**: 신규 식별자 신설 아님 — 기존 서술 갱신 제안
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/spec/5-system/8-embedding-pipeline.md` line 177: `"legacy 컬럼(embedding_llm_config_id·embedding_model)은 V092 에서 제거 예정"` 서술 잔존
- **상세**: 동일 파일 §5.5 본문(line 169–170)에도 step-3 legacy 폴백 서술이 남아 있어 target 이 "After" 로 제안한 2-step 서술과 충돌한다. target 의 갱신 방향은 올바르다. 적용 후 Rationale 섹션(line 177)의 "V092 에서 제거 예정" 문구도 함께 "PR4b(V093/V094)에서 제거됨" 으로 갱신해야 한다.
- **제안**: target draft 가 §1 변경에서 이미 다루고 있으나, Rationale 섹션 line 177 의 잔존 문구도 함께 업데이트 범위에 포함함을 명시한다.

---

## 요약

target draft 가 도입하는 신규 식별자(`MODEL_CONFIG_DEFAULT_MISSING`, `LLM_CONFIG_NOT_FOUND` retired 등재, 에러코드 rename 정비)는 기존 다른 의미의 식별자와 직접 충돌하지 않는다. 주요 위험은 두 가지다. 첫째, `LLM_CONFIG_INVALID` 가 `spec/5-system/7-llm-client.md` 4개 위치에 여전히 구 이름으로 남아 있어 `MODEL_CONFIG_INVALID` 와 동시에 spec 내 공존하며 독자 혼선을 유발한다(동일 코드의 이중 표기). 둘째, `spec/conventions/error-codes.md §3` 에 제안된 `## §3 Historical Artifacts (Retired Codes)` 제목이 기존 `## 3. Historical-artifact 예외 레지스트리` 절과 충돌해, retired 코드와 retained 코드의 구분이 흐려질 수 있다. 두 사항 모두 target draft 를 적용하기 전에 갱신 범위와 섹션 제목을 명확히 해야 한다.

---

## 위험도

MEDIUM
