# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `OAUTH_STATE_MISMATCH` 카탈로그 등재(§C)의 두 갈래 결함(다른 checker 3개가 각자 다른 각도로 지적)과 plan 완결성 누락(§D/§E) 5건이 실제 spec/plan 집행 시 후속 추적 유실로 이어질 수 있어 반영 전 정정을 권한다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, naming_collision | `OAUTH_STATE_MISMATCH` 카탈로그 등재가 두 번째 독립 발행처(통합 연결 OAuth, `integration_oauth_state`)를 언급 없이 `data-flow/2-auth.md` 로만 단독 상호링크한다. 통합 쪽은 이미 `2-navigation/4-integration.md §9.4` 에 등재돼 있고, 형제 코드 `OAUTH_STATE_MISSING`/`OAUTH_STATE_EXPIRED` 로 세분화된 **좁은 의미**인 반면 소셜 로그인 쪽은 missing/expired/consumed/provider-mismatch 를 전부 포괄하는 **넓은 의미**라 경계(scope)가 다르다 | §C. 카탈로그 등재 | `spec/2-navigation/4-integration.md` §9.4 (line 851) · `spec/data-flow/5-integration.md` (line 94, 392) · `integration-oauth.service.ts:581,598,619,627` | 카탈로그 행에 두 표면 모두 상호링크하거나, 좁은/넓은 의미 차이를 한 줄 각주로 명시. `spec_impact` 에 `data-flow/5-integration.md`(또는 `2-navigation/4-integration.md`) 추가 검토 |
| 2 | cross_spec, rationale_continuity | `OAUTH_STATE_MISMATCH`(400)를 §1.2 메인 표에 그대로 등재하면, 그 문서 자신의 Rationale(§1.9: "401/403/423 만 메인 §1.2, 그 밖 status 는 서브섹션")과 실측 결과(§1.2 메인 표는 현재 400 이 0건, 400 계열은 전부 §1.2.1 서브섹션)에 어긋난다 | §C. 카탈로그 등재 | `spec/5-system/3-error-handling.md` §1.2 메인 표 · §1.2.1 · §1.9 Rationale | §1.2.1 확장 또는 신규 서브섹션(예: "§1.2.2 OAuth 로그인 코드")에 배치. 메인 표 유지 시 §1.9 분리 원칙에 대한 명시적 예외 근거를 Rationale 에 기록 |
| 3 | plan_coherence | §D 가 `node-cancellation.md` 한 곳에만 `pending_plans` 를 추가하면서 자매 집결 티켓의 "5문서(frontmatter 스킴 보유 4문서) 전부 대상" 지시와 "값 동일"이라 오기술하고, 반영 후 그 지시를 소거하려 한다 — `4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md` 3곳의 `pending_plans` 등재 요구가 조용히 유실됨 | §D (node-cancellation.md frontmatter) | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "부수" 문단(약 664행) · `spec/5-system/4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md` frontmatter | §D 를 4문서(node-cancellation.md·execution-engine.md·embedding-pipeline.md·graph-rag.md, `data-flow/2-auth.md` 는 frontmatter 스킴 부재로 제외) 전부로 확장하거나, 범위를 좁게 유지할 경우 자매 티켓 "부수" 문단을 소거하지 말고 "node-cancellation.md 는 완료, 나머지 3곳은 잔존" 으로 축소만 |
| 4 | plan_coherence | §E "두 `[planner 위임]` 항목을 체크한다"가 트래커의 실제 라벨 수(397·406·457행, 3개)와 다르다 — 457행("같은 결함이 세 번 발생했는데 invariant 가 conventions 에 없다")은 §A(신규 규약 승격)와 동일 요청이라 함께 해소되는데도 미체크로 방치되면 다음 스윕이 중복 재작업할 위험 | §E (원본 트래커 갱신) | `plan/in-progress/update-returning-tuple-shape.md` 397·406·457행 | "세 `[planner 위임]` 항목을 체크한다(397·406·457행 — 457행은 397행과 동일 요청이라 §A 로 함께 해소)" 로 정정 |
| 5 | convention_compliance | 신규 `spec/conventions/raw-query-results.md` 초안(§A)에 명시적 `## Overview` 절이 없다 — 자매 conventions 문서 4/5(`migrations.md`·`audit-actions.md`·`error-codes.md`·`spec-impl-evidence.md`)가 모두 갖춘 SoT 경계 요약 헤더가 빠짐 | §A 전체 | `.claude/skills/project-planner/SKILL.md` "3섹션(Overview/본문/Rationale)" · CLAUDE.md 동일 규정 | title 아래 `## Overview` 절 추가, SoT 경계("스키마 변경 절차·노드 출력 계약과는 축이 다르다") 요약. "왜 신규 문서인가" 절은 Overview 로 흡수하거나 그 하위 세부 논거로 이동 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `node-cancellation.md` §2.4 3번째 불릿(park↔resume `SELECT FOR UPDATE` 잠금 확인)과 4번째 불릿(retry 재진입 조건부 UPDATE 0행→skip)은 문서 자신이 "극성이 반대" 라고 명시 구분한 서로 다른 메커니즘인데, target §B row 6 의 단일 caveat 문구("0행이면 skip — 항상 참")가 이 구분을 다시 뭉갤 소지가 있다 | §B 소급 각주 표 6번 행 | 두 불릿에 맞춰 caveat 문구를 분리 기술하거나, 최소한 "두 불릿 모두 `updateExecutionStatus` 반환값에 의존하는 하위 경로가 있다" 는 공통 문장으로 차이를 보존 |
| 2 | cross_spec | §B "붙일 위치" 열의 "§8 동시성 cap"·"동시 호출 표" 는 실제 정식 heading("## 8. 동시 실행 제한", "## 7. 에러 처리")을 그대로 인용한 게 아니라 paraphrase — 앵커 자체는 정확하나 나중 grep 오차 소지 | §B 표 "붙일 위치" 열 | 실제 집행 시 정식 heading 텍스트를 각주에 병기 |
| 3 | convention_compliance | §A 의 소제목("왜 신규 문서인가"·"불변식 (a)"·"불변식 (b)"·"이 규약이 없어서 난 일"·"집행")이 전부 `###`(h3) 동일 깊이라, 자매 conventions 문서들의 `## N.` numbered h2 관례와 계층이 불명확 | §A 전체 | 최종 파일 작성 시 `## 1.`~`## 4.` 식 h2 numbered section 으로 승격 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `OAUTH_STATE_MISMATCH` 카탈로그 등재가 두 번째 도메인 표면 누락 + 문서 자신의 status-code 배치 규칙과 상충 |
| rationale_continuity | LOW | 위 상태코드 배치 상충(중복 지적) + node-cancellation §2.4 caveat 문구가 두 메커니즘을 뭉갤 소지(INFO) |
| convention_compliance | LOW | 신규 conventions 문서 초안에 `## Overview` 절 부재 |
| plan_coherence | MEDIUM | §D pending_plans 등재 범위 축소를 "값 동일"로 오기술 + §E 위임 항목 카운트 누락(3개 중 2개만) |
| naming_collision | LOW | `OAUTH_STATE_MISMATCH` 두 발행처가 서로 다른 scope(넓은 의미 vs 좁은 의미)를 갖는다는 사실이 카탈로그 등재 문구에 누락 |

## 권장 조치사항
1. `OAUTH_STATE_MISMATCH` 카탈로그 등재(§C) 집행 시: (a) `2-navigation/4-integration.md`/`data-flow/5-integration.md` 쪽도 상호링크 또는 좁은/넓은 의미 차이 각주, (b) §1.2 메인 표 대신 서브섹션 배치(또는 예외 근거 명시)로 §1.9 원칙과 정합시킬 것.
2. §D 를 자매 티켓이 지시한 4개 frontmatter-스킴 문서(node-cancellation.md·execution-engine.md·embedding-pipeline.md·graph-rag.md) 전부로 확장하거나, 축소 유지 시 자매 티켓 "부수" 문단을 전량 소거하지 말고 잔존 3곳만 남길 것.
3. §E 를 "세 `[planner 위임]` 항목(397·406·457행, 457행은 §A 로 해소)" 으로 정정.
4. 신규 `spec/conventions/raw-query-results.md` 에 `## Overview` 절 추가.
5. (INFO) node-cancellation.md §2.4 caveat 문구 분리, §B "붙일 위치" 정식 heading 병기, §A numbered h2 승격 — 실제 파일 작성 단계에서 함께 반영 권장.
