# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 호출자 차단 불요.

## 전체 위험도
**LOW** — 5개 checker 모두 위험도 LOW. Critical 0건, WARNING 5건(중복 제거 후 6건), INFO 다수.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `8-embedding-pipeline.md §5.4` 의 SoT 링크가 §3.3(LLMClient 인터페이스)을 가리키지만 실제 SoT 는 §8.3(LlmService)이어야 함 | `spec/5-system/8-embedding-pipeline.md §5.4` After 텍스트 | `spec/5-system/7-llm-client.md §3.3` vs §8.3 | "시그니처 정의는 `7-llm-client.md §3.3`" → `§8.3` 으로 링크 교정을 target draft After 텍스트에 포함 |
| 2 | Cross-Spec | `17-agent-memory.md §87` 의 `LlmService.embed(...)` 생략 표기가 필수 `config` 인자를 가려 오용 위험 | `spec/5-system/17-agent-memory.md` L87 | target draft 적용 후 `(config, texts, model?, opts?, inputType)` 명문화 시 `...` 표기와 불일치 | `LlmService.embed(config, texts, ..., inputType:'query')` 로 갱신하거나 "완전한 시그니처는 §8.3 참조" 주석 추가 |
| 3 | Convention Compliance | 완료 이동 시 `spec_impact` 미선언 시 Gate C 위반 예정 — in-progress 단계 예고 | `plan/in-progress/spec-update-llm-embed-signature.md` frontmatter | `plan-lifecycle.md §4·§5 Gate C` + `spec-impl-evidence.md §4.2` | 완료 이동 전 frontmatter 에 `spec_impact: [spec/5-system/7-llm-client.md, spec/5-system/8-embedding-pipeline.md]` 반드시 선언 |
| 4 | Convention Compliance | 원본 발견사항 섹션의 §3.3 오기(本 plan 내 `## 제안 변경` NOTE 에서 교정됐으나 `## 원본 발견사항` 섹션에는 반영 안 됨) | `plan/in-progress/spec-update-llm-embed-signature.md §원본 발견사항` SUMMARY#8 | `## 제안 변경` NOTE 의 "§3.3 은 오기 — 실제 대상 §8.3" 교정 | `## 원본 발견사항` SUMMARY#8 기술을 "(§3.3 은 오기 — 실제 대상은 §8.3)" 인라인 주석으로 정정 |
| 5 | Plan Coherence | `§3.3 LLMClient` 인터페이스에 `opts` 를 배제하는 설계 의도가 plan 에 미명시 — 후속 개발자 혼동 위험 | `plan/in-progress/spec-update-llm-embed-signature.md §제안 변경 / 7-llm-client.md §8.3` | `spec/5-system/7-llm-client.md §3.3` LLMClient 인터페이스 (`embed(texts, model?)`) | plan 에 "§3.3 LLMClient 인터페이스는 opts 추가 대상 아님 — timeoutMs/disableInnerRetry 는 서비스 래퍼 전용" 한 줄 명시 |
| 6 | Naming Collision | `spec/5-system/8-embedding-pipeline.md §5.4` 가 현재 존재하지 않는 섹션 — "Before/After" 형식이 신설을 기존 수정처럼 오기 | `plan/in-progress/spec-update-llm-embed-signature.md §제안 변경 / 8-embedding-pipeline.md §5.4` Before 절 | `spec/5-system/8-embedding-pipeline.md` (§5.1~§5.3 만 존재, §5.4 없음) | "Before" 를 "(현재 §5.4 없음 — 신설)" 로 명확히 기재하거나, 섹션 제목 포함 완전한 After 텍스트 제시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `7-llm-client.md §8.3` 변경 범위 판단(§3.3 배제)은 정확 — LLMClient 인터페이스와 LlmService 계층 분리 의도 확인 | `spec/5-system/7-llm-client.md §3.3·§8.3` | §3.3 제목을 "embed 시그니처 (LLMClient 인터페이스)" 로 보강해 계층 구분 명확화 권장 |
| 2 | Rationale Continuity | plan 이 수정 대상 `§5.4` 기술이 spec 에 부재 — 신설임을 명시 필요 | `spec/5-system/8-embedding-pipeline.md §5` | plan 에 "§5.4 신설" 형태로 After 기술 |
| 3 | Rationale Continuity | `inputType` 파라미터가 코드·`LLMClient` 양쪽 모두 없음 — SPEC-DRIFT 분류와 모순, 별도 신규 기능으로 분리 권장 | `plan/in-progress/spec-update-llm-embed-signature.md` + `codebase/backend/src/modules/llm/llm.service.ts:194` | `inputType` 을 이번 SPEC-DRIFT 변경에서 제외하고 별도 Planned 항목으로 분리 |
| 4 | Convention Compliance | 체크박스 미사용 — 완료 이동 판단 불명확 | `plan/in-progress/spec-update-llm-embed-signature.md` 전체 | 적용 spec 파일·변경 항목을 체크박스로 열거 권장 (강제 아님) |
| 5 | Plan Coherence | `rag-rerank-followup.md` 가 `7-llm-client.md` SoT 선언 — target 변경과 경합 없음 | `plan/in-progress/rag-rerank-followup.md` | 조치 불요 |
| 6 | Plan Coherence | `rag-quality-improvement.md` 가 `8-embedding-pipeline.md` 갱신 예정 — §5.4 수정 범위와 미경합 | `plan/in-progress/rag-quality-improvement.md` | 조치 불요 |
| 7 | Plan Coherence | stale worktree 2건(PR #488, #489 MERGED) 물리 디렉터리 잔존 | `.claude/worktrees/rag-eval-harness-b8cc46`, `.claude/worktrees/rag-eval-plan-hygiene-279c3e` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 8 | Naming Collision | `LlmCallOptions` — spec 최초 도입, 코드와 의미 일치. 충돌 없음 | `spec/5-system/7-llm-client.md §8.3` | spec 에 `LlmCallOptions` 인터페이스 스텁 또는 "코드 SoT" 각주 추가 권장 |
| 9 | Naming Collision | `inputType?: 'query'\|'document'` — 코드에 아직 없음, spec 선행 기술. snake_case `input_type`(Cafe24) 과 충돌 없음 | `spec/5-system/7-llm-client.md §8.3` | spec 에 "구현 예정(Planned)" 또는 "코드 반영 전" 표기 추가 권장 |
| 10 | Naming Collision | §8.3 에 `LlmService.embed` 추가 시 §3.3 과 동일 문서에 두 계층 시그니처 공존 — 충돌 아님 | `spec/5-system/7-llm-client.md §3.3·§8.3` | §8.3 서문에 "§3.3 의 LLMClient.embed 래퍼" 설명 한 줄 추가 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | SoT 링크 §3.3→§8.3 교정 누락(WARNING), `17-agent-memory.md` `config` 인자 생략 오용 위험(WARNING) |
| Rationale Continuity | LOW | §5.4 부재(plan 착지점 오류 위험), `inputType` SPEC-DRIFT 분류 모순(INFO) |
| Convention Compliance | LOW | 완료 이동 시 `spec_impact` 미선언 Gate C 위반 예고(WARNING), 원본 발견사항 §3.3 오기 잔존(WARNING) |
| Plan Coherence | LOW | LLMClient `opts` 배제 설계 의도 미명시(WARNING), stale worktree 2건 잔존(INFO) |
| Naming Collision | LOW | §5.4 신설/수정 혼동(WARNING), `inputType` spec 선행 기술(INFO), `LlmCallOptions` spec 최초 도입(INFO) |

## 권장 조치사항

1. **(WARNING 즉시 해소)** `plan/in-progress/spec-update-llm-embed-signature.md` 의 `## 제안 변경 / 8-embedding-pipeline.md §5.4` After 텍스트에 두 가지를 함께 포함: (a) `"시그니처 정의는 §3.3"` → `"시그니처 정의는 §8.3"` 링크 교정, (b) Before 절에 "(현재 §5.4 없음 — 신설)" 명시.
2. **(WARNING)** 같은 plan 에 `§3.3 LLMClient 인터페이스는 opts 추가 대상이 아닌 이유` 한 줄 추가 (timeoutMs/disableInnerRetry 는 서비스 래퍼 전용).
3. **(WARNING — 완료 이동 전 필수)** plan 완료 이동 시 frontmatter 에 `spec_impact: [spec/5-system/7-llm-client.md, spec/5-system/8-embedding-pipeline.md]` 선언.
4. **(WARNING)** `plan/in-progress/spec-update-llm-embed-signature.md §원본 발견사항` SUMMARY#8 에 "(§3.3 은 오기 — 실제 대상은 §8.3)" 인라인 주석 추가.
5. **(WARNING)** `spec/5-system/17-agent-memory.md` L87 의 `LlmService.embed(...)` 생략 표기를 `LlmService.embed(config, texts, ..., inputType:'query')` 또는 "완전한 시그니처는 §8.3 참조" 주석으로 갱신.
6. **(INFO — 권장)** `inputType` 을 이번 SPEC-DRIFT 변경 범위에서 제외하고 별도 "신규 기능(Planned)" 항목으로 분리.
7. **(INFO — 권장)** stale worktree 정리: `./cleanup-worktree-all.sh --yes --force` 실행.