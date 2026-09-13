# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — `spec/5-system/` 델타 0(코드·유저가이드·harness 전용 PR)에서 cross_spec·plan_coherence 가 각 LOW 를 냈으나 전부 기존 planner 백로그(`spec-draft-nullable-notation-followups.md`)에 이미 등재된 pre-existing gap 의 재확인이며, 이번 라운드(`de99def86`)가 새로 만든 결함은 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `3-error-handling.md §1` 카탈로그가 Integration(Cafe24/Makeshop)·OAuth 코드 계열 누락 — 미해소 잔존, 이번 라운드가 만든 결함 아님 | `spec/5-system/3-error-handling.md §1.1~§1.12` | `spec/conventions/error-codes.md`, `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`, `spec/2-navigation/4-integration.md` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 항목이 3개 plan 을 한 턴에 통합 처리하면 자동 해소 |
| 2 | cross_spec | `testConnection` 실패 응답 shape 이 `7-llm-client.md`·`6-config.md` 어느 표에도 없음 — 이번 라운드에서 HTTP 와이어 계약이 더 확정됐는데도 spec 앵커는 여전히 부재 | `spec/5-system/7-llm-client.md §8.3` | `spec/2-navigation/6-config.md §B.3`, `spec/2-navigation/4-integration.md §9.1`(형제 엔드포인트는 이미 문서화) | 조치 불요 — 동일 planner 항목에 이미 등재. 처리 시 `{ success:false, message }`(코드 없음, 형제와 다른 이유 병기)를 두 표에 추가 |
| 3 | plan_coherence | `user-guide-evidence.md` 후속 등재가 §2.1 관계표(산문 "3건→5건")만 겨냥, 같은 파일 frontmatter `code:` 목록(신규 가드 2파일 미추가)은 안 겨냥 | `spec/conventions/user-guide-evidence.md` frontmatter `code:` (target `spec/5-system/**` 밖) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 해당 항목 | planner 집행 시 frontmatter `code:` 에 `guide-error-code-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 경로 추가를 등재 문구에 한 줄 보완 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `/api/integrations/:id/test` 성공 경로(MCP 전용 `capabilities`/`serverInfo`/`preview`)는 여전히 계약 검사 미배선 — 의도적 부분 배선, 이번 라운드가 스스로 developer 백로그에 등재 | `integrations.service.spec.ts` (실패 케이스만 `assertMatchesContract` 부착) | DTO 신설(developer 항목) 완료 시 `spec/2-navigation/4-integration.md` MCP 성공 shape 등재 필요 여부 같은 턴에서 판단 |
| 2 | rationale_continuity | "결과 객체 필드는 에러 봉투 필드명과 겹치면 안 된다" 원칙이 JSDoc 한 곳에만 존재, spec Rationale 미명문화 | `llm.service.ts` `testConnection` JSDoc | `testConnection` 실패 shape 문서화 항목 처리 시 이 명명 원칙도 `7-llm-client.md`/`2-api-convention.md` Rationale 에 함께 명문화 제안 (BLOCK 대상 아님) |
| 3 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md` §1.2 인접 캐비어트(2026-08-30 실측: §1.2 메인 표는 400 을 안 받음)를 신규 항목이 줄 포인터로만 인용, 재서술 안 함 — 실질 위험 낮음 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:632-645` | planner 턴에서 3개 plan 통합 재설계 시 원본 캐비어트 반드시 함께 읽을 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/5-system/` 델타 0, 이번 라운드(`de99def86`) 변경분은 기존 SoT 와 충돌 없음. WARNING 2건은 3~4라운드째 반복 확인된 pre-existing gap(모두 planner 등재 완료) |
| rationale_continuity | NONE | 은퇴 코드 재도입·CWE-209 원칙·처분 번복 등 전부 문제 없음 확인. `error`→`message` rename 은 기존 §9.1 패턴을 올바르게 따른 정합화 |
| convention_compliance | NONE | 직전 라운드 WARNING 2건(swagger.md §3 JSDoc/`//` 분리, user-guide-evidence 등재 범위) 모두 규약대로 정정 확인. 신규 위반 없음 |
| plan_coherence | LOW | spec 신규 결정 없음. developer→planner 5건 후속 등재 중 4건 정합, 1건(frontmatter `code:` 목록 누락)이 완결성 갭 |
| naming_collision | NONE | 신규 식별자(`TestConnectionResultDto.code`, `CitationAxis` 등)는 전부 기존 값의 뒤늦은 선언이거나 기존 관례를 따르는 신규 모듈. 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) 이 PR 은 병합 가능.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `user-guide-evidence.md` 후속 등재 항목에 frontmatter `code:` 목록 갱신 한 줄을 보태 (WARNING #3), planner 턴에서 §2.1 관계표와 함께 처리.
3. planner 턴에서 3개 plan(`spec-draft-nullable-notation-followups.md`·`spec-update-node-cancellation-shutdown-classification.md`·`keyset-cursor-uuid-validation.md`)을 묶어 `3-error-handling.md §1` 하위 구조·`testConnection` 실패 shape·명명 원칙 명문화를 한 턴에 처리 (WARNING #1·#2, INFO #2).
4. DTO 완결(MCP 성공 필드 3종 신설, developer 항목) 시 `spec/2-navigation/4-integration.md` 갱신 필요 여부 같은 턴에서 판단 (INFO #1).