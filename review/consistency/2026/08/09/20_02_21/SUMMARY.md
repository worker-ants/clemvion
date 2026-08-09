# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. WARNING 4건(문서 위생·spec-lags-code 성격)만 발견.

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, `plan_coherence` 가 실질적으로 조치가 필요한 WARNING 3건(dangling plan 포인터, 머지된 PR 의 spec 미반영, 감사 액션 카탈로그 선행 필요)을 발견해 향후 해당 영역 작업 착수 전 정리가 권장됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 이 발견되지 않아 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Agent Memory 리소스가 RBAC 매트릭스에서 누락 — `17-agent-memory.md` §6 의 viewer+/editor+ 권한이 `1-auth.md` §3.2 단일 RBAC 표에 행으로 반영되지 않음. 동일 클래스 drift 가 과거 실제 CRITICAL 로 처리된 전례(#71ce6c12b) 있음 | `spec/5-system/17-agent-memory.md` §6 | `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스 | §3.2 표에 `Agent Memory \| — \| — \| D(scope) \| R` 행 추가 + `17-agent-memory.md` §6 에서 §3.2 역참조 |
| 2 | plan_coherence | `pending_plans` frontmatter 가 이미 `plan/complete/` 로 이동한 항목을 여전히 in-progress 로 가리키는 dangling reference | `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` | `plan/complete/spec-sync-chat-channel-gaps.md` (커밋 `88ab25bcc` 로 이동, in-progress 경로는 더 이상 미존재) | `pending_plans` 목록에서 `spec-sync-chat-channel-gaps.md` 항목 제거(나머지 3건은 유지) |
| 3 | plan_coherence | 머지된 PR(#1108, `auth-guard-reflection-hardening`)이 구현한 동작(비-UUID 워크스페이스 헤더 → 400 VALIDATION_ERROR, 헤더/경로 UUID 검증 강도 비대칭)이 spec 에 미반영 — spec-lags-code 상태 | `spec/5-system/3-error-handling.md` §1.3 에러 코드 카탈로그, `1-auth.md` §3.3, frontmatter `code:` 글로브 | `plan/in-progress/auth-guard-reflection-hardening.md` `## 후속 (이 PR 밖)` 항목 3건(전부 `[ ]`, "planner 턴 필요" 명시) | §1.3 에 "헤더 형식 오류→VALIDATION_ERROR" 행 추가, §3.3(또는 관련 Rationale)에 헤더(loose)/경로(strict) 검증 비대칭을 의도된 설계로 명문화, frontmatter `code:` 에 `common/utils/uuid.ts` 등 신규 파일 반영 |
| 4 | plan_coherence | 트리거 시크릿/토큰 회전 3종(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`) 감사 로깅에 필요한 신규 `trigger.rotate*` 감사 액션이 카탈로그에 없음 — 착수 시 즉시 선행 planner 턴 필요 | `spec/5-system/1-auth.md` §4.1 감사 로그 카테고리, `spec/conventions/audit-actions.md` §3 | `plan/in-progress/spec-sync-auth-gaps.md` "트리거 시크릿/토큰 회전 3종 감사 — planner 선행 필요" 항목(8차 리뷰 security) | developer 가 이 3개 라우트에 감사 로깅을 추가하기 전, `1-auth.md §4.1` + `audit-actions.md §3` 에 `trigger.rotate*` 액션명·시제·범위를 먼저 확정하는 planner 턴 선행(plan 이 이미 순서를 명시 — 우회 금지) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `swagger.md` §5-4 "@Roles() 전제" 는 이미 정정 완료(2026-08-08 머지) — 재점검 불필요 | `spec/conventions/swagger.md` §5-4 | 조치 불요, 향후 라운드가 동일 항목을 재기입하지 않도록 참고 |
| 2 | rationale_continuity | 대조 커버리지 한계 고지 — 15,571줄·70+문서를 diff 없이 1회 세션에서 전수 대조하지 못함(표본 검토) | `spec/5-system/` 전 18개 파일 | 이 검토가 향후 diff-scope 없이 전체 디렉토리로 재트리거될 경우, 실제 변경 파일/섹션만으로 target 범위를 좁혀 요청 |
| 3 | rationale_continuity | 강한 Rationale 연속성 관행 확인 — 결정 번복 시 예외 없이 "번복 배경/사유" 절 동반, cross-domain 인용도 SoT 하나만 가리키고 재정의 없음 | `4-execution-engine.md`, `1-auth.md`, `14-external-interaction-api.md`, `6-websocket-protocol.md` 등 Rationale 절 | 조치 불요 — 향후 편집 시 동일 규율 유지 권장 |
| 4 | convention_compliance | 개별 파일 `## Overview` 섹션 존재 여부가 파일마다 다름(기술 프로토콜형 문서는 생략, 제품 가치형 서브시스템은 유지하는 패턴으로 보임) | `2-api-convention.md`/`5-expression-language.md`/`6-websocket-protocol.md`/`11-mcp-client.md`/`7-llm-client.md`/`16-system-status-api.md` (Overview 없음) | 의도된 설계라면 유지, 다음 `project-planner` 턴에서 구분 기준을 SKILL.md 나 `_product-overview.md` 에 한 줄 명문화 |
| 5 | convention_compliance | `spec/5-system/` 에 영역 전용 `0-overview.md` 없음(루트 `spec/0-overview.md` 를 반복 인용하는 기존 확립 패턴) | 디렉토리 전체 | 조치 불요 — 참고용 기록 |
| 6 | plan_coherence | SIGTERM/timeout abort 최종 상태 분류 (a)/(b) 미결 택일을 target 이 올바르게 선점하지 않음(충돌 없음). 다만 인접 정밀도 후속 2건(`#9`/`#11`)이 미반영 | `4-execution-engine.md` §8/§11, `6-websocket-protocol.md:375` | 새 WARNING 아님 — 해당 도메인 후속 개발 전 `#9`/`#11` 잔여 정리 권장 |
| 7 | naming_collision | graph-rag 엔드포인트 9개가 `10-graph-rag.md` §5 와 `2-navigation/5-knowledge-base.md` §3 양쪽에 내용 일치 상태로 병렬 정의 — SoT 포인터 부재 | `spec/5-system/10-graph-rag.md` §5.1~5.2 | 두 문서 중 하나에 "이 표가 단일 SoT" 포인터 한 줄 추가(이미 다른 곳에서 쓰는 SoT-포인터 컨벤션과 일치) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Agent Memory RBAC 매트릭스 누락(WARNING 1건), 그 외 광범위 표본 대조에서 모순 없음 |
| rationale_continuity | LOW | 표본 검토 범위 내 CRITICAL/WARNING 없음, 강한 Rationale 연속성 관행 확인(INFO 2건은 방법론/관찰) |
| convention_compliance | LOW | CRITICAL/WARNING 없음 — 에러 코드·감사 액션·secret URI·마이그레이션 명명·frontmatter 스키마 전수 합치, INFO 2건은 Overview 섹션 유무 관찰 |
| plan_coherence | MEDIUM | WARNING 3건 — dangling `pending_plans` 포인터, 머지 PR(#1108)의 spec-lags-code, 트리거 감사 액션 카탈로그 선행 필요 |
| naming_collision | LOW | 진짜 충돌 없음 — graph-rag 엔드포인트 SoT 포인터 부재만 INFO |

## 권장 조치사항
1. `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 에서 완료·이동된 `spec-sync-chat-channel-gaps.md` 항목 제거(비용 최소, dangling reference 정리).
2. `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스에 Agent Memory 행 추가 + `17-agent-memory.md` §6 상호 링크(§3.2 를 유일한 참조점으로 신뢰하는 향후 독자를 위해).
3. PR #1108(`auth-guard-reflection-hardening`) 반영: `3-error-handling.md` §1.3 에 헤더 UUID 형식 오류 → `VALIDATION_ERROR` 행 추가, `1-auth.md` §3.3 에 헤더(loose)/경로(strict) UUID 검증 비대칭을 의도된 설계로 명문화, frontmatter `code:` 글로브 갱신 — planner 턴.
4. `spec-sync-auth-gaps.md` 가 지목한 `trigger.rotate*` 감사 액션 3종을 `audit-actions.md` §3 + `1-auth.md` §4.1 에 확정 — 해당 감사 로깅 개발 착수 전 필수 선행.
5. (선택) `10-graph-rag.md` §5 또는 `5-knowledge-base.md` §3 중 하나에 SoT 포인터 추가, node-cancellation 관련 `#9`/`#11` 표현 정밀도 정리.
