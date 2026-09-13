# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 성공, Critical 발견 0건. WARNING 6건·INFO 4건은 착수를 막지 않으나 이번 배치(§A/§D) 구현과 함께 처리할 것을 권고.

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, `testConnection` 실패 응답 필드 미문서화(3개 checker 중복 지적)와 에러 코드 카탈로그(§1) 도메인 누락(2개 checker 지적)이라는 두 구조적 갭이 이번 plan 의 근본 원인과 직결돼 있어 방치 시 동일 클래스 결함이 재발한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec, Convention Compliance | 중앙 에러 코드 카탈로그(§1.4)가 Cafe24/Makeshop(`CAFE24_*`/`MAKESHOP_*`)·OAuth 연결 흐름(`OAUTH_*`) 코드를 완전 누락 — 이번 plan 항목 C(`MAKESHOP_API_ERROR` 지어냄)가 정확히 이 사각지대에서 발생 | `spec/5-system/3-error-handling.md` §1.4 | `spec/conventions/error-codes.md` "적용 범위" 선언, `2-api-convention.md §5.3`, `4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`, `2-navigation/4-integration.md` | §1.13(가칭) 신설해 도메인-spec-참조 패턴으로 최소 등재 |
| 2 | Convention Compliance | LLM 도메인 HTTP 에러 코드 2종(`LLM_CREDENTIALS_REQUIRED`, `LLM_MODEL_LIST_FAILED`)이 §1 카탈로그에 미등재 — 다른 모든 도메인은 이미 스윕 완료 | `spec/5-system/7-llm-client.md §6`/`§5.5` | `spec/5-system/3-error-handling.md §1`(카탈로그 SoT) | §1 에 LLM/Model Config 절 신설·해당 2코드 등재 |
| 3 | Cross-Spec, Convention Compliance, Rationale Continuity, Plan Coherence, Naming Collision | `LlmService.testConnection` 실패 응답 필드명이 어느 spec 표에도 문서화돼 있지 않음(성공 케이스만 기술) — 이번 plan §A 가 확정할 `message` 필드의 SoT 앵커 부재, `7-llm-client.md` 는 spec-linked 파일이라 `--impl-done` 게이트에서 재조우 가능 | `spec/5-system/7-llm-client.md §8.3`, `spec/2-navigation/6-config.md`(§B.3) | `2-api-convention.md` Overview(wire 정직성 원칙), `swagger.md §5-5`, 형제 엔드포인트 `2-navigation/4-integration.md §9.1`(이미 `{success,code,message}` 문서화) | §A 구현과 동시에 두 표에 실패 shape(`{success:false, message}`) 행 추가, `spec_impact` 에 두 파일 명시 |
| 4 | Naming Collision | 신규 "가이드 에러코드 실재성 가드"(plan §D)가 `spec/conventions/user-guide-evidence.md`(`<ImplAnchor>`)와 같은 문제 영역("가이드가 거짓을 말하지 않는가")을 다루는데 plan 에 상호 참조 없음 | plan §D 신규 가드(이름 미확정) | `spec/conventions/user-guide-evidence.md §2.1`(기존 4개 가드 관계표) | §2.1 표에 관계 명시 또는 `<ImplAnchor kind>` 에 `error-code` 확장 검토 후 Rationale 기록 |
| 5 | Naming Collision | 신규 가드를 `error-codes.md` 본문에 문서화하면 그 문서가 스스로 선언한 "유일 소유 범위"(명명원칙/rename/historical-artifact)를 벗어남 | plan §D 가드의 spec 문서화 위치(미정) | `spec/conventions/error-codes.md` Overview | `user-guide-evidence.md` 계열에 문서화, `error-codes.md` 에는 1줄 포인터만 |
| 6 | Plan Coherence | 상위 트래커(`spec-draft-nullable-notation-followups.md`)의 기존 "처분 제안" 문구(수렴 코드 `LLM_CONNECTION_ERROR` 를 적으라는 지시)가 이번 실측(§A: 어떤 `LLM_*` 코드도 이 경로엔 존재하지 않음)으로 반증됐는데, plan 체크리스트가 그 정정을 명시하지 않음 — 체크박스만 바뀌고 근거 문장이 낡은 채 남을 위험(이 저장소 상습 결함 패턴) | `plan/in-progress/spec-draft-nullable-notation-followups.md` L3162-3163 | `plan/in-progress/guide-error-code-truth.md` §A(정확한 실측 보유) | 구현 완료 시 L3162-3163 을 체크박스 전환과 **함께** 취소선+정정 문구로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `/api/model-configs/:id/test`(코드 없이 문장만) vs `/api/integrations/:id/test`(코드+문장) 실패 표현력 비대칭 — 의도적이면 근거 미기재 | `spec/5-system/7-llm-client.md §8.3` vs `spec/2-navigation/4-integration.md §9.1` | `7-llm-client.md` Rationale 에 "왜 코드 없이 문장만인가" 한 줄 추가 |
| 2 | Rationale Continuity | 가이드가 적던 `LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND` 는 §6 에 **Planned** 로드맵 이름으로 실재 — 신규 가드(§D)가 "카탈로그 등재 여부"만으로 판정하면 향후 Planned 서술을 오탐할 수 있음 | `spec/5-system/7-llm-client.md §6` | §D 설계 또는 plan 본문에 "Planned 로드맵 코드명 처리 방침" 한 줄 명시 |
| 3 | Convention Compliance | `spec/5-system/` 4개 파일이 `## Overview` 표준 헤딩 미사용, `16-system-status-api.md` 는 개요 섹션 자체 부재 | `11-mcp-client.md`, `5-expression-language.md`, `7-llm-client.md`(`## 1. 개요`), `16-system-status-api.md`(개요 없음) | `16-system-status-api.md` 에 짧은 `## Overview` 절 승격(나머지 3개는 별도 항목으로 defer 가능) |
| 4 | Naming Collision, Rationale Continuity | 제거 대상 식별자(`MAKESHOP_API_ERROR`·`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·`LLM_ERROR`)는 신규 도입이 아닌 삭제이며 실재 코드와 충돌 없음, `NODE_EXECUTION_FAILED` 등 은퇴는 §1.4 에 이미 정착 — 추가 조치 불요 | `spec/5-system/3-error-handling.md §1.4` | 없음(확인용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | §1.4 카탈로그의 Cafe24/Makeshop/OAuth 누락 + testConnection 실패 필드 SoT 부재 |
| Rationale Continuity | LOW | spec 위반 없음. testConnection 실패 계약 미문서화(INFO), Planned 로드맵 코드 판정 기준 불명확(INFO) |
| Convention Compliance | LOW | LLM 도메인 코드 2종 카탈로그 미등재(WARNING), testConnection 실패 필드 미문서화(WARNING), 3섹션 헤딩 격차 1건(INFO) |
| Plan Coherence | LOW | 트래커 처분 제안 문구가 실측으로 반증됐으나 정정 미명시(WARNING) |
| Naming Collision | LOW | 신규 가드가 `user-guide-evidence.md`/`<ImplAnchor>` 와 상호참조 없음(WARNING), `error-codes.md` 소유범위 위반 소지(WARNING) |

## 권장 조치사항
1. `spec/5-system/7-llm-client.md §8.3` 및 `spec/2-navigation/6-config.md §B.3` 에 `testConnection` 실패 shape(`{success:false, message}`) 추가 — plan §A 구현과 동시 진행, `spec_impact` 에 두 파일 명시.
2. `spec/5-system/3-error-handling.md` 에 §1.13(가칭) 신설 — Cafe24/Makeshop/OAuth 코드 및 `LLM_CREDENTIALS_REQUIRED`/`LLM_MODEL_LIST_FAILED` 등재.
3. plan §D 신규 가드 설계 확정 시 `spec/conventions/user-guide-evidence.md §2.1` 표에 관계 명시(또는 `<ImplAnchor kind>` 확장 검토), 문서화 위치는 `error-codes.md` 가 아닌 `user-guide-evidence.md` 계열.
4. `plan/in-progress/spec-draft-nullable-notation-followups.md` L3162-3163 을 체크박스 전환과 함께 취소선+정정.
5. (선택, 낮은 우선순위) `spec/5-system/16-system-status-api.md` 에 `## Overview` 절 추가, `7-llm-client.md` Rationale 에 코드-없는-실패-응답 근거 한 줄 추가.