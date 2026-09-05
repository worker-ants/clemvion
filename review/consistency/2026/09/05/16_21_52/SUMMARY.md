# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 Critical 을 보고하지 않았다 (모두 WARNING/INFO/NONE).

## 전체 위험도
**MEDIUM** — Critical 없음. WARNING 3건(등재 사각지대 1건 + plan 레이어 정합 2건)이 실행 단계에서 문서 보강을 요구.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 등재하려는 검증자(`response-contract.ts`)가 실제로는 두 spec 이 나눠 가진 규칙 두 개(§5.4 부재표현 축 + `swagger.md §5-1` 엔티티 패스스루 축)를 판정하는데, `code:` 등재는 §5.4 소유자(`2-api-convention.md`)에만 붙는다. 검증자 자신의 JSDoc 이 "undeclared-key" 축을 "§5.4 아님"이라 명시하는데도 이 축이 `swagger.md` 어디에도 연결되지 않아, 이 draft 가 닫으려던 게이트 사각지대(§5-1 축)가 그대로 재발한다 | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ 변경안 1(`2-api-convention.md`) 및 `## Rationale` "기각한 대안 — swagger.md 에만 등재" | `codebase/backend/src/shared/testing/response-contract.ts` JSDoc 판정 규칙 표(5행 중 4행 §5.4, 1행 undeclared-key) vs `spec/conventions/swagger.md §5-1` | (a) `response-contract.ts` 를 `swagger.md` `code:` 에도 추가(선례: `error-response.dto.ts` 양쪽 등재), 또는 최소 (b) "undeclared-key 축은 §5.4 가 아니라 swagger.md §5-1 을 시행한다"는 한 문장을 양쪽 문서에 명시 |
| 2 | plan_coherence | `## Overview` 유무 불일치 처분이 parent plan(`spec-draft-nullable-notation-followups.md`)이 명시한 "(a) 6개 전부 추가 / (b) SKILL.md 로 현상 인정 — 단독 결정 금지" 이분법 중 어느 쪽도 아닌 제3의 처분(부분 적용 + 잔여 추적)을 내리면서, parent 체크박스를 어떻게 갱신할지가 target 안에 없다. 반증된 전제("6개 대칭적으로 없음")가 parent 문면에 그대로 남을 위험 | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §④ 및 "'## Overview' 를 6개에 일괄 추가하지 않는 이유" | `plan/in-progress/spec-draft-nullable-notation-followups.md` §후속 — `## Overview` 유무 불일치 체크박스 | target 적용 시 parent 체크박스를 `[x]` 로 닫으며 (1) 원 전제가 반증됐음(4/6은 형태차이일 뿐), (2) 실제 처분은 부분 적용(`2-api-convention.md`만)+`6-websocket-protocol.md` 잔여 추적이라는 것을 명시. `6-websocket-protocol.md` 건은 별도 열린 항목으로 명시적 재등재 |
| 3 | plan_coherence | `code:` 에 검증자/헬퍼 파일을 등재하는 핵심 근거("40건 선례")가, 같은 `spec-impl-evidence.md` 정의 문장을 인용하며 정반대 결론(won't-do)을 낸 12일 전(2026-08-24) 판정을 다루지 않는다. `2-api-convention.md` 의 현재 `code:` 16항목이 그 won't-do 판정의 우려("전부 도메인 파일" 이라 신호가 흐려짐)가 문면 그대로 적용되는 대상인데, 이번이 그 목록의 첫 non-도메인(`shared/testing/*`) 등재라 긴장이 더 크다 | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §① "code: 정의에 맞나 — 맞는다, 선례가 40건이다" | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `websocket.service.ts`/`conversation-thread.md` won't-do 판정(2026-08-24) | Rationale 에 그 won't-do 판정을 인용하고, "시행 코드 등재"(이번 건) vs "인용 추적용 도메인 파일 등재"(반려된 건)를 구분하는 문장 추가. `2-api-convention.md` 의 `code:` 가 이번에 처음 순수 도메인 파일 집합을 벗어난다는 사실도 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "검증 층" 문단이 아직 미확정 — 실행 시 코드 JSDoc 판정 규칙 표와 중복 서술될 위험 (drift 소스 신규 생성) | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ 2번 항목 | 문단은 "두 검증자의 경계"(정적 vs 런타임, 각각의 사각지대)만 한 단락 요약하고, 판정 규칙 표 자체의 SoT 는 코드 JSDoc 으로 위임 유지 |
| 2 | rationale_continuity | 입력 번들이 `spec/conventions/` 트리(target 이 직접 수정하는 `swagger.md` 포함)를 통째로 빠뜨려 이 checker 가 자동으로 `swagger.md` 자신의 Rationale 과 대조하지 못했다 (직접 조회로 보완 — 충돌 없음 확인) | orchestrator `--spec` 번들링 필터 | `spec_impact` 목록에 있는 파일은 영역 트리와 무관하게 반드시 번들에 포함하도록 스크립트 점검 (기존 교훈과 동일 클래스: "consistency --spec 기본 예산이 conventions 를 통째로 떨군다") |
| 3 | rationale_continuity | 기각 근거 인용(`review-citations.md`)이 축자 인용이 아니라 재서술인데 인용부호로 표기됨. 의미 왜곡은 없음 | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` `## ①` 문단 | 조치 불필요 — 후속 편집 때 인용부호를 걷어내거나 "요지" 로 명시하면 더 정확 |
| 4 | convention_compliance | 신설 `## Overview (제품 정의)` 헤딩이 `5-system/` 폴더 내 로컬 개요 보유 3문서(`5-expression-language`·`7-llm-client`·`11-mcp-client`)의 실제 관행(`## 1. 개요`, 번호매김 한국어)과 형태가 다시 갈릴 수 있음. 규약 위반은 아님(SKILL.md 예시 형태 그대로이고, 비번호 `## Overview` 선례도 다수 존재) | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ `2-api-convention.md` 3번 항목 | 실행 시 `5-system/` 로컬 관행을 따르거나, SKILL.md 형태를 유지한다면 "이 섹션은 §1 기술 요약이 아니라 진짜 제품 정의라 별도 헤딩"이라는 한 줄 근거를 Rationale 에 남길 것 |
| 5 | convention_compliance | `swagger-probe.ts` 등재가 `2-api-convention.md` 재검토 트리거 범위를 그 파일의 §5.4 무관한 3개 소비처(DTO 스펙) 변경까지 넓힘. 저장소 전역에 이미 넓게 선례된 패턴(예: `hooks.controller.ts` 6개 spec 동시 등재)이라 위반 아님 | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` §③ `2-api-convention.md` 1번 항목 | "검증 층" 문단에 "`swagger-probe.ts` 변경은 §5.4 와 무관한 이유로도 일어날 수 있다"는 한 문장 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | 등재 대상 검증자가 두 축(§5.4/§5-1)을 판정하나 swagger.md 축이 미연결 — 게이트 사각지대 부분 재발 |
| rationale_continuity | NONE | 과거 Rationale 과 충돌 없음(입력 번들이 conventions 트리를 빠뜨려 직접 보완 확인). 인용은 재서술이나 왜곡 없음 |
| convention_compliance | LOW | 정식 규약 위반 없음. Overview 헤딩 형태·재검토 트리거 확대는 실행 단계 문서 보강으로 해소 가능 |
| plan_coherence | MEDIUM | parent plan 체크박스 갱신 경로 누락 + code: 확장 근거가 상충하는 최근 판정(won't-do)을 미언급 |
| naming_collision | NONE | 신규 식별자 발명 없음. 6개 관점 전부 충돌 없음(실측 grep 로 교차검증 완료) |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — BLOCK:NO) target 병합 전 WARNING #1 을 반영: `response-contract.ts` 를 `swagger.md` `code:` 에도 추가하거나, 최소한 undeclared-key 축이 `swagger.md §5-1` 을 시행한다는 문장을 `2-api-convention.md`/`swagger.md` 양쪽에 명시.
2. WARNING #2: `spec-draft-nullable-notation-followups.md` 의 `## Overview` 불일치 체크박스를 target 적용과 같은 커밋에서 갱신 — 반증된 전제와 실제 처분(부분 적용+잔여 추적)을 명시.
3. WARNING #3: target Rationale 에 `spec-sync-external-interaction-api-gaps.md` 의 2026-08-24 won't-do 판정을 인용하고 "시행 코드" vs "인용 추적용 도메인 파일" 구분 문장 추가.
4. INFO #1·#4·#5: 실행(spec 편집) 단계에서 한 문장씩 보강 — "검증 층" 문단 범위 절제, Overview 헤딩 근거, swagger-probe.ts 재검토 트리거 범위 명시.
5. INFO #2: orchestrator `--spec` 번들링 필터가 `spec_impact` 대상 `spec/conventions/*.md` 파일을 계통적으로 누락하는 문제 — 별도 harness 이슈로 추적 권장(이번 target 판정에는 영향 없음, 직접 조회로 보완 완료).
