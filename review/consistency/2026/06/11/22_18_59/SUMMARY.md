# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Critical 1건(상대 링크 오류, spec-link-integrity build 가드 직접 트리거)과 Warning 3건(cross-spec 단방향 참조·개념 경계 긴장, path 파라미터 표기 혼재, active PR #545 파일 경합)이 존재. 내용·개념 수준의 모순은 없으며 BLOCK 사유는 단일 경로 오탈자.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/1-data-model.md` 에 삽입 예정인 상대 링크 `../2-navigation/6-config.md` 가 해당 파일 위치(`spec/` 루트)에서 프로젝트 루트 바깥을 가리켜 존재하지 않는 경로를 참조함. `spec-link-integrity.test.ts` build 가드 트리거 | 제안 변경 §6 — `spec/1-data-model.md §2.16` 주석 링크 | `spec/conventions/spec-impl-evidence.md §4.2` (spec 내 링크 타깃 실존 의무) | 링크를 `[Config §B.3](./2-navigation/6-config.md)` 로 수정 — 기존 `spec/1-data-model.md` 내 다른 링크 패턴(`[Spec 설정 §Part B](./2-navigation/6-config.md)`)과 동일한 형식 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | API 표 path 파라미터 표기 `{id}` 가 `spec/2-navigation/6-config.md` 기존 표의 `:id` 표기와 혼재 | 제안 변경 §3 (`PATCH /api/model-configs/{id}`) 및 §5 (표 행 `{id}`) | `spec/2-navigation/6-config.md` L263–L283 전체 `:id` 일관 표기 | 제안 변경 §3·§5 모두 `:id` 로 통일. 표기 규약을 `{id}` 로 공식화하려면 `spec/5-system/2-api-convention.md` 를 먼저 갱신 |
| 2 | Cross-Spec | `9-rag-search` Rationale 의 "probe 는 read-only 검증으로 유지한다" 문구가 `KnowledgeBase.embedding_dimension` 에 한정됨을 9-rag-search 쪽에서 명시하지 않아 단방향 참조 및 문면 혼동 위험 | draft §1 "핵심 구분" 표 / §3 (`6-config §B.3`) | `spec/5-system/9-rag-search.md §5` + Rationale | 9-rag-search Rationale 에 "(여기서 '저장하지 않는다'는 `KnowledgeBase.embedding_dimension` 에 한정 — `ModelConfig.dimension` 자동 저장과 별개)" 한 줄 추가. 또는 draft §B.3 에 9-rag-search 금지 대상과 본 변경 대상이 다름을 재강조하는 cross-reference 보강 |
| 3 | Plan Coherence | `spec/2-navigation/6-config.md` 및 `spec/1-data-model.md` 가 active PR #545(`claude/unified-model-mgmt-pr4`) 의 변경 파일과 겹쳐 spec 반영 시 git merge conflict 발생 위험. (단, target plan 이 §우선순위 및 연동에서 `6-config.md` 경합은 인지하고 있으나 `1-data-model.md` 경합은 미언급) | 제안 변경 §3·§4·§5 (`6-config.md`) 및 §6 (`1-data-model.md`) | `plan/in-progress/unified-model-management.md` / PR #545 OPEN | spec 파일 반영 전 PR #545 merge 선행. target plan §우선순위 및 연동에 `1-data-model.md` 도 PR #545 경합 파일임을 추가 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `6-config §B.5` 차원 변경 가드가 `ModelConfig.dimension` 자동 저장 경로에서도 적용 여부가 spec 에 미명시 | 제안 변경 §4 (`6-config §B.5` dimension 행 교체) | draft §4 교체 행에 "이미 적재된 KB 를 참조하는 embedding 모델의 차원 변경 가드(§B.5)는 `ModelConfig.dimension` 자동 저장과 독립적으로 적용된다" 한 줄 보강 또는 §B.5 가드 단락 함께 갱신 |
| 2 | Cross-Spec | `7-llm-client §7.1` StubLlmClient stub 환경에서 embedding testConnection 이 zero 벡터를 반환해 `dimension` 자동 저장 side-effect 발생 가능 | 제안 변경 §1 (7-llm-client §8.3) | §7.1 stub 계약에 "LLM_STUB_MODE 에서 embedding testConnection dimension 자동 저장이 발생할 수 있다 — e2e 에서 skip 처리 고려" 주석 추가 검토 |
| 3 | Cross-Spec | `6-config §3` API 표 `{ success, dimension? }` 응답 shape 가 `spec/5-system/2-api-convention.md` 표준 응답 봉투와 일치하는지 미확인 | 제안 변경 §5 (§3 API 표) | 응답 shape 표기에 API 규약 봉투 여부(`{ data: { success, dimension? } }` vs flat) 명시 또는 2-api-convention.md cross-reference |
| 4 | Cross-Spec | `spec/1-data-model.md §2.16` 의 차원 값 목록(384/512/768/1024/1536/3072)이 probe 반환 가능 차원을 모두 커버하는지 exhaustive 해석 위험 | 제안 변경 §6 | 목록을 "예: 384/512/768/1024/1536/3072" 로 표현하거나 소개문을 "provider 별 벡터 차원 — 자동 감지 또는 수동 입력" 으로 보강 |
| 5 | Rationale Continuity | `spec/5-system/7-llm-client.md §8.3` 코드 블록 주석 `// 기존 chat / testConnection / resolveConfig 유지` 가 embedding 분기 추가 후 오독 가능 | 제안 변경 §1 | 주석을 `// 기존 chat / embed / testConnection / resolveConfig 유지 (testConnection은 kind별 probe 분기 — 아래 표)` 로 보강 |
| 6 | Naming Collision | `dimension` (단수, 서비스 계층 testConnection 반환) vs `dimensions` (복수, Planned EmbedResponse 인터페이스) 명명 차이가 의도적임을 spec 에 미명시 | 제안 변경 §1·§2 | 향후 `EmbedResponse` 도입 시 두 명칭의 의도적 차이를 spec Rationale 에 한 줄 명시 |
| 7 | Convention Compliance | `plan/in-progress/` 내 `../../spec/` 상대 링크 — spec-link-integrity.test.ts 대상 외, 경로 실존 확인됨 | draft §핵심 구분 참조 링크 | 해당 없음 (현행 유지) |
| 8 | Plan Coherence | `unified-model-management.md §7 W4` 백로그(forwardRef 순환) 참조가 현황과 부합 — PR #545 미머지로 W4 미해소 상태 정확히 반영 | 제안 변경 §1·§2 | spec 본문 반영 시 W4 해소 여부에 따라 관련 Rationale 주석 업데이트 메모 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | 9-rag-search Rationale 단방향 참조, §B.5 가드 자동저장 경로 미명시, stub 환경 side-effect — 모두 WARNING/INFO |
| Rationale Continuity | NONE | 기존 3대 핵심 원칙 모두 인식·준수. INFO 1건(주석 표현 개선) |
| Convention Compliance | MEDIUM | CRITICAL 1건(상대 링크 오탈자, build 가드 직접 트리거), WARNING 1건(path 파라미터 표기 혼재) |
| Plan Coherence | LOW | WARNING 2건(active PR #545 파일 경합 — `6-config.md`·`1-data-model.md`), 내용 충돌 없음 |
| Naming Collision | NONE | 식별자 충돌 없음. INFO 4건(의미 확장·보강 수준) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/1-data-model.md §2.16` 주석 삽입 시 링크를 `../2-navigation/6-config.md` → `./2-navigation/6-config.md` 로 수정. (`plan/in-progress/spec-update-embedding-testconnection.md` 제안 변경 §6 텍스트 편집)
2. **(WARNING 해소 권장)** 제안 변경 §3·§5 의 `{id}` 표기를 `spec/2-navigation/6-config.md` 기존 관용인 `:id` 로 통일.
3. **(WARNING 해소 권장)** spec 반영 착수 전 PR #545 merge 여부 확인 — merge 후 main base rebase. target plan §우선순위 및 연동에 `1-data-model.md` 경합 명시 보강.
4. **(INFO 선택)** `spec/5-system/9-rag-search.md` Rationale 에 "probe 는 read-only" 원칙이 `KnowledgeBase.embedding_dimension` 에 한정됨을 명시해 단방향 참조 해소.
5. **(INFO 선택)** `6-config §B.5` 차원 변경 가드 단락에 자동 저장 경로 적용 여부 한 줄 명시.
6. **(INFO 선택)** `7-llm-client §8.3` 코드 블록 주석을 `// 기존 chat / embed / testConnection / resolveConfig 유지` 로 보강.