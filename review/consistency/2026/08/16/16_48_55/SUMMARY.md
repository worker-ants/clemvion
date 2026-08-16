# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 3건(교차 spec 2건 + frontmatter 완결성 1건)과 INFO 다수만 존재.

## 전체 위험도
**LOW** — 핵심 결정(내부 REST `Execution.error` 마스킹, `interaction.triggerToken` secret-store 예외)은 기존 spec·Rationale·규약과 정합. 남은 문제는 이번 변경이 실제로 건드리는 두 자매 spec 영역(WS `execution.snapshot`, `12-background.md`)과 target 자신의 `spec_impact` 완결성이 아직 planner 턴 체크리스트에 완전히 반영되지 않은 정도.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | WS 이벤트 카탈로그(`execution.snapshot`)가 이번 마스킹 결정을 반영하지 않음 — `execution.snapshot` 은 `findById` 반환값(=Execution 전체)을 그대로 실으므로 nested `error` 도 마스킹 대상이 되지만 WS 정본 문서엔 미기재 | `## 조치` 표면 전수 #6, spec 초안 ① 불릿 | `spec/5-system/6-websocket-protocol.md:182`(필드 표), §6.2(`:872`) | planner 턴 체크리스트에 ⓔ 로 "`execution.snapshot` nest 안 `error`/`nodeExecutions[].error` 는 §R17 마스킹 관문을 상속" 한 줄 추가. 최소한 `spec-sync-websocket-protocol-gaps.md` 트래커에 등재 |
| 2 | cross_spec | `12-background.md`(background-runs, 4-nodes 영역)가 이번 결정으로 바뀌는 자기 응답 스키마(`nodeExecutions[].error` 마스킹, 코드로 실측 확인됨)를 문서화하지 않음 | `## 설계` "표면 전수" 절, §R17 초안 자매 표면 불릿 | `spec/4-nodes/1-logic/12-background.md` §8.2 | §8.2 에 교차 참조 한 줄 추가를 planner 턴 항목으로 편입, `spec_impact` 에도 이 파일 추가 |
| 3 | convention_compliance / plan_coherence (중복) | frontmatter `spec_impact` 가 체크리스트가 예정한 세 번째 spec 편집(`14-execution-history.md`, planner 턴 ⓑ)을 누락 | frontmatter `spec_impact:` 블록 vs `## 조치` planner 턴 ⓑ | `.claude/docs/plan-lifecycle.md §4/§5 (Gate C)`, `spec-plan-completion.test.ts` | planner 턴에서 ⓑ 적용 시 `spec_impact` 에 `spec/2-navigation/14-execution-history.md` 지금 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec_impact` 가 `spec/2-navigation/14-execution-history.md` 를 누락(WARNING #3 과 동일 사안, 중복 집계 방지 위해 여기 재기재만) | frontmatter | WARNING #3 채택 시 함께 해소 |
| 2 | cross_spec | `Execution.error` 마스킹과 API 규약 §5.3(CWE-209 전면 비echo)의 정책 차이가 교차 인용돼 있지 않음 — 직접 모순 아님(`3-error-handling.md:126` 이 레이어 구분을 이미 명시) | §R17 교체 불릿 | 향후 보안 감사 오탐 방지용 한 줄 구분 근거 추가 권고 |
| 3 | cross_spec | `secret-store.md:13` "모든 도메인 모듈은 SecretResolver 경유" 절대 문구가 예외 2건(`AuthConfig.config`, 신규 `interaction.triggerToken`)을 안게 됨 | secret-store.md Overview | "필드 단위 명시적 예외" 뉘앙스 보강 권고(급하지 않음) |
| 4 | rationale_continuity | secret-store.md 서두 원칙 문장과 신설 예외의 표면적 불일치 — 정본 트래커가 이미 충돌로 등재했고 사용자가 명시 택일한 사안, 기존 `AuthConfig.config` 관행과 동일 패턴 | secret-store.md §1 | planner 턴 ⓒ 작업 시 서두에 "(§1 하단 비대상 예외 제외)" caveat 추가 권고 |
| 5 | convention_compliance | `pending_plans` 필드의 선언 방향이 실제 관계(target 이 트래커를 집행/갱신)와 반대(선행조건)로 읽힐 소지 — 다만 기존 plan 들도 동일 관행이라 target 이 새로 만든 문제 아님 | frontmatter `pending_plans:` | 굳이 고치려면 "역참조 — 선행조건 아님" 주석 또는 필드 생략 |
| 6 | convention_compliance | 응답 DTO 가 여전히 엔티티-spread 형태 유지 — `swagger.md §5-1` (a) 엔티티 직접 노출 금지 조항과 부분 미합치, 단 이 PR 이전부터 있던 부채이고 스코프 밖으로 명시됨 | `## 설계` 절 | 조치 불요(이번 PR 스코프 밖). 향후 별도 항목 시 `swagger.md §5-1` 근거로 등재 가능 |
| 7 | plan_coherence | planner 턴 ⓓ 의 `code:` 갱신 범위가 `14-execution-history.md` 의 `code:` 목록(이미 `executions.service.ts` 보유)을 다루지 않음 | 체크리스트 ⓓ | ⓑ·ⓓ 처리 시 `14-execution-history.md` `code:` 에 `redact-stored-error.ts` 등재 검토 |
| 8 | naming_collision | "결정 2026-08-16" 캡션이 I1(§R17)·D(secret-store) 두 결정에 동일 문자열로 붙어 향후 grep 시 혼동 소지 (실질 위험 낮음) | §R17 교체 불릿, D 항목 | 등급 매길 수준 아님, 참고만 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | WS `execution.snapshot` 및 `12-background.md` 두 자매 spec 영역이 마스킹 반영 범위 밖(WARNING 2건). 나머지 실질 충돌 없음 |
| rationale_continuity | LOW | 인용 근거 전부 원문 대조 일치. secret-store.md 서두 문장 표면적 불일치는 이미 사용자 택일된 기존 관행(INFO) |
| convention_compliance | LOW | 이전 라운드 CRITICAL 2건 모두 실물에서 정정 확인됨. `spec_impact` 완결성 WARNING 1건, 나머지 INFO |
| plan_coherence | LOW | 정본 트래커와 같은 diff 로 동기화됨, CRITICAL 급 불일치 없음. frontmatter 완결성 INFO 2건(WARNING #3 과 중복) |
| naming_collision | NONE | 신규 식별자 6종 전수 대조, 충돌 없음. 이전 라운드 `redactExecutionErrorValue` 충돌은 이미 해소 확인 |

## 권장 조치사항
1. planner 턴 체크리스트에 ⓔ 추가 — WS `execution.snapshot` 이 `findById` 마스킹 관문을 상속함을 `6-websocket-protocol.md:182`/§6.2 에 한 줄 명시 (WARNING #1)
2. `12-background.md` §8.2 에 `nodeExecutions[].error` 마스킹 교차 참조 추가 및 `spec_impact` 편입 (WARNING #2)
3. planner 턴 ⓑ 실행 시 frontmatter `spec_impact` 에 `spec/2-navigation/14-execution-history.md` 추가 (WARNING #3)
4. (선택) ⓒ 작업 시 secret-store.md 서두에 예외 caveat 추가, ⓓ 작업 시 `14-execution-history.md` `code:` 목록에 `redact-stored-error.ts` 등재 검토 (INFO #4, #7)
