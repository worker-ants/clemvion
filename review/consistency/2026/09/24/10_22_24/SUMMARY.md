# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**MEDIUM** — Critical 없이 착수 가능하나, 이 저장소가 이미 두 번 근거를 남기며 기각한 "opt-in/수동 체크" 실패 계열을 처방이 인지·반박 없이 반복하는 WARNING 1건이 있어 반영 후 진행 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 처방(개별 메서드에 수동 멤버십 체크 삽입)이 이 저장소가 이미 2회 명시적으로 근거를 남기며 "재발한다"고 기각한 opt-in/수동-체크 패턴과 같은 계열인데, plan 이 두 Rationale 을 인용·반박하지 않는다 | `plan/in-progress/member-auth-order.md` §B(38~64행)·§E(88~100행) | `spec/data-flow/12-workspace.md` `## Rationale`("멤버십 검증은 가드 1곳에서", 73-라우트 opt-in 대안 기각) / `spec/5-system/1-auth.md` `## Rationale`("부트 캐너리", opt-in 마커 재기각) | §B 또는 §E 에 두 Rationale 을 명시 인용하고 "왜 이번엔 수동 패치가 맞는가"(기존 `/switch`·`leaveWorkspace` 관행의 확장) 논증 한 문단 추가. "13-라우트 축" 후속 항목 스코프에 "구조적 해법(가드/reflection 확장) 우선 검토, 불가 시에만 라우트별 수동 체크를 표준 패턴으로 승인" 조건 명시 |
| 2 | plan_coherence | 트래커의 "에러 코드 계약 변경 → 3-error-handling.md consistency 라운드 필요" 캐비트가 실제 채택 설계(§C 관측표: 비-admin 은 "세 갈래 그대로")에서는 발생하지 않는데, 종결 체크리스트가 이를 정정하도록 요구하지 않음 | `plan/in-progress/member-auth-order.md` 종결 체크리스트 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4911-4915`(닫힐 항목의 잘못된 캐비트) | 트래커 항목을 닫는 커밋에서 "이번 설계에서는 에러 코드 계약 변경이 발생하지 않는다"는 한 줄 정정을 남길 것 (선례: 같은 파일 4965-4968행 owner TOCTOU 항목의 정정 관례) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, naming_collision | `NOT_A_MEMBER` 카탈로그의 발행 경로 열거("전환·탈퇴·멤버십 확인 경로")에 `removeMember` 신규 발행처가 아직 없음 — plan §E 가 이미 planner 항목 등재를 예고, 의미 모순은 아님 | `spec/5-system/3-error-handling.md:49, 230` | planner 항목 생성 시 §A 실측표(현재 emission site 3종: 전환·탈퇴·removeMember)를 그대로 인용해 §1.2 갱신 근거로 사용 |
| 2 | cross_spec | 처방의 서비스 레이어 멤버십 체크가 "가드 1곳" 결정의 적용 범위(`@WorkspaceId()` 헤더 컨텍스트 라우트) 밖(`@Param('id')` 라우트)임을 확인 — 모순 아님, 오히려 잔여 표면(13-라우트 축)의 존재를 재확인 | `spec/data-flow/12-workspace.md` §Rationale | 후속 "13-라우트 축" 항목이 이 Rationale 을 인용하며 스코프를 정의하도록 연결 |
| 3 | cross_spec | RBAC 매트릭스·`CANNOT_REMOVE_OWNER` 각주·`removeMember` 처방 간 대조 결과 정합 확인(참고용, 문제 아님) | `spec/5-system/1-auth.md` §3.2 vs `spec/data-flow/12-workspace.md` §1.6 | 없음 |
| 4 | rationale_continuity | 처방이 신규 패턴이 아니라 기존 관행(`/switch`·`leaveWorkspace` 의 `NOT_A_MEMBER` 처리)의 확장이라는 선례가 plan 에 근거로 인용되지 않음 | `plan/in-progress/member-auth-order.md` §B(51~64행) | §B 에 "이 패턴은 `/switch`·`leaveWorkspace` 가 이미 쓰는 `NOT_A_MEMBER`(§1.2) 처리와 동형" 한 문장 추가 — WARNING #1 의 논증 근거로 겸용 |
| 5 | convention_compliance | `spec/5-system` 17개 중 4개 파일이 `## Overview` 표제를 쓰지 않음(번호형 개요로 대체하거나 아예 생략) — 연성 규약(권장) 위반, 차단 사유 아님 | `11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md`·`16-system-status-api.md` | 4개 파일에 `## Overview` 표제 추가로 나머지 13개와 형태 통일, 또는 로컬 예외로 SKILL.md 에 명시 |
| 6 | convention_compliance | `## Overview` 표제 문구가 파일마다 다름(`## Overview` vs `## Overview (제품 정의)`) — 기계적 grep 점검 시 거짓 음성 유발 가능 | `1-auth.md:27` 등 4개 vs `2-api-convention.md:32` 등 9개 | 표제 문구를 `## Overview (제품 정의)` 로 통일하거나 접미사 비필수임을 SKILL.md 에 명시 |
| 7 | plan_coherence | "13-라우트 축"·`NOT_A_MEMBER` 카탈로그 갱신 두 planner 후속 항목이 아직 독립 plan 으로 미등재 — plan §E 계획대로라 impl-prep 시점 결함 아님 | `plan/in-progress/member-auth-order.md` §E 체크리스트 | `--impl-done` 이후 두 항목이 실제로 새 plan/planner 산출물로 만들어졌는지 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 로드된 5개 spec 파일 범위 내 직접 모순 없음. 번들 예산 초과로 108개 중 2개만 전문 로드돼 생략분과의 무충돌은 미보증 |
| rationale_continuity | MEDIUM | 처방이 이 저장소가 2회 기각한 opt-in/수동-체크 실패 계열을 인지·반박 없이 반복(WARNING). 기존 선례 미인용(INFO) |
| convention_compliance | LOW | `error-codes.md`·`swagger.md` 등 정식 규약 위반 0건. `## Overview` 표제 형식의 연성 비일관성만 존재 |
| plan_coherence | LOW | 실측 기반 착수 검증 촘촘. 트래커의 stale 캐비트 정정 누락(WARNING), 후속 항목 미등재는 계획대로(INFO) |
| naming_collision | NONE | 신규 식별자·에러코드·엔드포인트·이벤트명 충돌 0건. 재사용 에러 코드는 기존 의미와 동일 |

## 권장 조치사항
1. `plan/in-progress/member-auth-order.md` §B 또는 §E 에 `spec/data-flow/12-workspace.md`·`spec/5-system/1-auth.md` 의 opt-in 기각 Rationale 을 인용하고, `/switch`·`leaveWorkspace` 선례를 근거로 "왜 이번 수동 패치가 기존 관행의 확장인가" 논증 추가 (WARNING #1 해소).
2. "13-라우트 축" 후속 항목 스코프에 "구조적 해법(가드/reflection 확장) 우선 검토 → 불가 시에만 라우트별 수동 체크 승인" 조건을 명시 (WARNING #1 연계).
3. `member-auth-order.md` 종결 커밋에서 `spec-draft-nullable-notation-followups.md` 트래커의 "에러 코드 계약 변경" 캐비트를 실제 설계에 맞게 한 줄 정정 (WARNING #2 해소).
4. (선택) `NOT_A_MEMBER` 카탈로그 planner 항목 생성 시 cross_spec/rationale_continuity 의 §A 실측표를 그대로 인용.
5. (선택, 별도 정리) `spec/5-system` 4개 파일의 `## Overview` 표제 누락·문구 불일치를 harness 정리 작업으로 통일.