# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 한다

## 전체 위험도
**HIGH** — 에러코드 rename/retire 처리에서 2건의 Critical 발견: live 코드를 retired 로 등재 시도, 존재하지 않는 대체 코드 기정사실화

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `LLM_CONFIG_INVALID` 가 live 발행 중인데 historical-artifact(retired)로 등재 | draft §3 historical-artifact `LLM_CONFIG_INVALID → MODEL_CONFIG_INVALID` 행 | `error-codes.md §2` "rename = breaking change, 안정성 유지" 원칙; `llm-preview.service.ts` line 39/48/69 에서 현재도 400 응답 발행 | `LLM_CONFIG_INVALID` 코드 교체를 코드베이스에 완전히 반영한 후 spec 등재하거나, 본 draft 에서 §3 등재를 제외하고 "코드 제거 완료 후 별도 spec 갱신"으로 분리한다 |
| 2 | Rationale Continuity | `MODEL_CONFIG_DEFAULT_MISSING` 가 spec 에도 코드베이스에도 없는 상태에서 대체 코드·신규 행으로 기정사실화 | draft §2 `3-error-handling.md §1.3` 변경 + §3 `LLM_CONFIG_NOT_FOUND → MODEL_CONFIG_DEFAULT_MISSING` 행 | `error-codes.ts` 에 미존재; `llm.service.ts` line 356 에서 `LLM_CONFIG_NOT_FOUND` 여전히 발행 중 | `error-codes.ts` 에 코드 실제 추가 + `model-config.service.ts` / `llm.service.ts` throw 경로 전환 완료 후 spec 변경 수행. 미구현이면 draft 에서 해당 항목을 "Planned (미구현)" 으로 표기하거나 제외한다 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `7-llm-client.md` 에 `LLM_CONFIG_INVALID` 4곳 미갱신 | draft §4 `spec/5-system/7-llm-client.md §5.5, §6` | `7-llm-client.md` line 235/257/327/341 구 코드명 잔존; `3-error-handling.md §1.3` `MODEL_CONFIG_INVALID` | draft §4 적용 시 4개 위치를 `MODEL_CONFIG_INVALID` 로 일괄 치환 대상으로 명시한다 |
| 2 | Cross-Spec | `3-error-handling.md §1.3` `MODEL_CONFIG_NOT_FOUND` 설명에 "default 해석 실패" 잔존, `MODEL_CONFIG_DEFAULT_MISSING` 미등재 | draft §2 | `3-error-handling.md` line 50 현행 기술 | 신규 코드 신설 + `MODEL_CONFIG_NOT_FOUND` 설명 동시 수정 (Critical #2 해소 후 연동) |
| 3 | Cross-Spec | `error-codes.md §3` historical-artifact에 `LLM_CONFIG_*` 미등재로 own 정책(§2)과 내부 불일치 | draft §3 | `error-codes.md §3` 현재 레지스트리 빈칸 | Critical #1 해소 후 draft §3 그대로 적용. PR 번호 컬럼 `PR4b (#)` 를 실제 번호로 채운다 |
| 4 | Cross-Spec | `8-embedding-pipeline.md §5.5` 3-step 폴백 + "V092 에서 제거 예정" 잔존 | draft §1 | `8-embedding-pipeline.md` line 169~177 | draft §1 제안을 `8-embedding-pipeline.md §5.5` 및 `1-data-model.md §2.11` 에 실제 반영한다 |
| 5 | Cross-Spec | `data-flow/6-knowledge-base.md §2.1` legacy 컬럼(`embedding_model`) 잔존 | draft §5 | `data-flow/6-knowledge-base.md` line 250~251 | draft §5 적용 시 `embedding_model` 컬럼 언급 제거 + NULL reset 경로 2번 설명 수정 병행 |
| 6 | Rationale Continuity | `MODEL_CONFIG_NOT_FOUND` 설명 축소에 Rationale 근거 미기재 | draft §2 `3-error-handling.md §1.3` 변경 | `7-llm-client.md Rationale` — "id 지정+cross-kind+default 실패" 통합 설계 의도 기록됨 | draft §2 에 "MODEL_CONFIG_NOT_FOUND 를 id 지정 경로로 한정하는 이유" Rationale 항 추가 |
| 7 | Rationale Continuity | `spec/5-system/7-llm-client.md §6` 갱신 시 `llm-preview.service.ts` live 코드와 spec 불일치 발생 위험 | draft §4 | `llm-preview.service.ts` `LLM_CONFIG_INVALID` 발행 경로 | 코드 교체 완료 후 spec 갱신하거나, "(구현 pending)" 주석을 spec 에 명시한다 |
| 8 | Convention Compliance | §3 historical-artifact 테이블 컬럼 스키마 불일치 (제안 4-컬럼 vs 기존 5-컬럼) | draft `### 3` 제안 추가 코드 블록 | `error-codes.md §3` 기존 테이블 (`코드 / HTTP / 이름이 부정확한 이유 / 진실(의미) / 근거`) | 제안 행을 기존 5-컬럼 스키마에 맞춰 작성하거나, §3.1 Renamed codes 서브섹션 신설을 규약 갱신으로 명시한다 |
| 9 | Convention Compliance | §3 헤딩 형식 불일치 (`## §3 Historical Artifacts (Retired Codes)` vs 기존 `## 3. ...` 한국어 패턴) | draft line 68 | `error-codes.md` 헤딩 형식 | 제안 헤딩을 `## 3. Historical-artifact 예외 레지스트리` 하위 행 추가 또는 `## 3.1 Rename 이력 (Retired codes)` 형태로 교정한다 |
| 10 | Plan Coherence | `db-host-blocked-7df9f7` (PR #553 OPEN) 과 `spec/5-system/3-error-handling.md` 병렬 편집 — merge 시 컨텍스트 충돌 가능성 | draft §2 `3-error-handling.md §1.3` 행 추가 | PR #553 가 §3.1 Database 행 편집 중 | target PR 를 PR #553 완료 후 진행하거나, merge 시 3-way merge 확인 수행 |
| 11 | Plan Coherence | `spec-update-pr2-embedding.md` 플랜이 in-progress 잔류 중 (PR #541 MERGED, stale) | target 플랜 전체 | `plan/in-progress/spec-update-pr2-embedding.md` | target 플랜 적용 완료 후 `plan/complete/` 로 이동한다 |
| 12 | Naming Collision | `LLM_CONFIG_INVALID` / `MODEL_CONFIG_INVALID` 동일 코드 이중 표기 — spec 내 혼재 | `7-llm-client.md` line 235/257/327/341 vs `3-error-handling.md §1.3` | 동일 에러코드의 구/신 이름이 spec 내 공존 | draft §4 에서 7-llm-client.md 전체 `LLM_CONFIG_INVALID` 출현을 일괄 치환 범위로 명시한다 (경고 #1 과 통합 조치) |
| 13 | Naming Collision | `spec/conventions/error-codes.md §3` 제안 제목이 기존 절 제목과 충돌 (retired vs retained 목적 혼재) | draft §3 `## §3 Historical Artifacts (Retired Codes)` | `error-codes.md` line 52 `## 3. Historical-artifact 예외 레지스트리` | 기존 §3 유지 + `### 3.1 Retained` / `### 3.2 Retired` 분리 또는 새 `## 4. Retired Codes` 절 신설 |
| 14 | Naming Collision | `MODEL_CONFIG_NOT_FOUND` 설명 정정 후 "default 해석 실패" 문구 미제거 — `MODEL_CONFIG_DEFAULT_MISSING` 신설 시 두 코드 경계 모호 | `3-error-handling.md` line 50 | `MODEL_CONFIG_DEFAULT_MISSING` 신설 후 `MODEL_CONFIG_NOT_FOUND` 설명 중복 우려 | Critical #2 해소와 연동해 동시에 수정한다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `data-flow/6-knowledge-base.md §1.6 embedding-probe` legacy `llmConfigId`·`embeddingModel` 파라미터 잔존 | `data-flow/6-knowledge-base.md` line 231 | 실제 코드에서 파라미터 제거됐다면 draft scope 에 §1.6 도 추가한다 |
| 2 | Cross-Spec | `7-llm-client.md §5.5` SSRF 가드 경로 `LLM_CONFIG_INVALID` 코드명 (경고 #1 과 중복) | `7-llm-client.md` line 327 | 경고 #1 일괄 치환에 포함한다 |
| 3 | Rationale Continuity | `8-embedding-pipeline.md §5.5` 2-step 교체는 Rationale 과 충돌 없음 — 역사 각주 추가 권장 | `8-embedding-pipeline.md ## Rationale` | "step-3 legacy 폴백은 V093/V094(PR4b)에서 제거됨" 한 줄 추가 |
| 4 | Rationale Continuity | `error-codes.md §3` 의 기존 항목(active 코드 등재)과 proposed retired 코드 등재의 목적 레이어 차이 | `error-codes.md §3` | §3 서두에 두 목적의 차이 한 줄 설명 추가 권장 |
| 5 | Convention Compliance | plan 문서에 체크박스 미사용 — 완료 추적 기계 검증 불가 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` | "적용 위치 요약" 표를 `- [ ]` 체크박스 목록으로 전환 권장 |
| 6 | Convention Compliance | §3 변경 목적과 `error-codes.md §3` 기존 설계 의도 차이 미서술 | draft `### 3` 변경 목적 | "§3 목적 범위 확장 여부" 결정을 명시하거나, `error-codes.md §3` Overview 설명 갱신을 적용 위치 표에 추가 |
| 7 | Plan Coherence | `unified-model-management.md` 157행 플랜명 예고와 실제 파일명 불일치 | `unified-model-management.md` line 157 | 예고 플랜명을 실제 파일명으로 갱신하거나 cross-ref 추가 |
| 8 | Plan Coherence | `spec-draft-unified-model-management.md` in-progress 잔류 (PR #541 MERGED, stale) | `plan/in-progress/spec-draft-unified-model-management.md` | `plan/complete/` 로 이동 권장 |
| 9 | Naming Collision | `data-flow/7-llm-usage.md` line 119 `kb.embeddingLlmConfigId` 참조 — target 적용 위치 표 누락 | `spec/data-flow/7-llm-usage.md` line 119 | target 적용 위치 표에 `spec/data-flow/7-llm-usage.md` 행 추가 |
| 10 | Naming Collision | `8-embedding-pipeline.md §5.5` Rationale 행 "V092 에서 제거 예정" 문구 잔존 (경고 #4 와 연동) | `8-embedding-pipeline.md` line 177 | draft §1 변경 범위에 Rationale line 177 갱신 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `7-llm-client.md` 4곳 구 코드명 잔존; `data-flow/6` legacy 컬럼 미정리; `8-embedding-pipeline.md §5.5` SPEC-DRIFT |
| Rationale Continuity | HIGH | live 코드 `LLM_CONFIG_INVALID`/`LLM_CONFIG_NOT_FOUND` retired 등재 (CRITICAL 2건); `MODEL_CONFIG_NOT_FOUND` 축소 근거 미기재 |
| Convention Compliance | LOW | §3 테이블 컬럼 스키마 불일치; 헤딩 형식 불일치 |
| Plan Coherence | LOW | PR #553 병렬 편집 (merge 리스크); stale plan 미정리 |
| Naming Collision | MEDIUM | spec 내 동일 코드 이중 표기 (`LLM_CONFIG_INVALID`/`MODEL_CONFIG_INVALID`); §3 절 제목 목적 충돌 |

## 권장 조치사항

1. **(BLOCK 해소 — Critical #1)** `llm-preview.service.ts` 에서 `LLM_CONFIG_INVALID` 를 `MODEL_CONFIG_INVALID` 로 교체하는 코드 변경을 이번 PR4b 에 포함하거나, 미포함 시 draft §3 의 `LLM_CONFIG_INVALID` retired 등재 항목을 제거하고 "코드 교체 완료 후 별도 spec 갱신"으로 분리한다.
2. **(BLOCK 해소 — Critical #2)** `MODEL_CONFIG_DEFAULT_MISSING` 를 `error-codes.ts` 에 실제 추가하고 `model-config.service.ts` / `llm.service.ts` 의 default-missing throw 경로를 전환한 후 spec 변경을 수행한다. 미구현이면 draft 에서 해당 항목을 "Planned (미구현)" 으로 표기하거나 제외한다.
3. **(경고 해소)** `7-llm-client.md` 의 `LLM_CONFIG_INVALID` 4개 위치(line 235/257/327/341)를 draft §4 에 일괄 치환 대상으로 명시한다.
4. **(경고 해소)** draft §2 에 "MODEL_CONFIG_NOT_FOUND 를 id 지정 경로로 한정하는 이유" Rationale 항을 추가한다.
5. **(경고 해소)** §3 테이블을 기존 5-컬럼 스키마에 맞추거나 `### 3.1 Retained` / `### 3.2 Retired` 서브섹션으로 분리한다. 헤딩을 기존 문서 형식에 맞게 교정한다.
6. **(경고 해소)** PR #553 병합 후 또는 rebase 후 target PR 진행한다.
7. **(INFO)** target 적용 위치 표에 `spec/data-flow/7-llm-usage.md` 행 추가 및 stale plan 2건(`spec-update-pr2-embedding.md`, `spec-draft-unified-model-management.md`) 을 `plan/complete/` 로 이동한다.