# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 모두 확보. CRITICAL 발견 없음.

## 전체 위험도
**LOW** — 새 개념·API 계약·상태 전이·RBAC 규칙을 도입하지 않는 문서-구현 동기화 draft. CRITICAL 없음, WARNING 3건(모두 "vacuous-guard 재발 방지 장치 부재" 계열 + 트래커 stale)은 구현 단계에서 닫을 수 있는 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 신설 reflection 가드(`forbidden-response-codes`)에 "스캔 모집단 0/급감" 방지 캐너리가 없음 — 같은 저장소의 원류 결정(`data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서" — "reflection 파손은 부트에서 막는다")과 하루 전 자매 가드 `http-status-advertised.spec.ts`(컨트롤러 수·핸들러 수 하한 assertion)가 이미 세운 안전장치를 언급 없이 건너뜀 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` `## 변경 (1)`·`## 변경 (3)`; 구현 plan `plan/in-progress/forbidden-desc-codes.md` §방향 | `spec/data-flow/12-workspace.md` §Rationale(2026-08-08), `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`(2026-09-26, dde7c3013) | 구현 시 `forbidden-response-codes.spec.ts` 에 스캔된 컨트롤러/핸들러 수 최소값 assertion 추가, 또는 넣지 않기로 한다면 target `## 변경 (3)` Rationale 에 이유를 명시 |
| 2 | convention_compliance | 신설 가드의 `code:` 등재에 전용 negative fixture 가 없음 — 같은 파일의 다른 reflection/repo-guard 항목 3건(`param-uuid-pipe*`, `dto-class-name-collision*`, `http-status-advertised*`) 전부 "가드 + 전용 `fixtures/**` 대조군" 을 짝으로 등재하고, 그 이유를 주석에 "없으면 술어가 죽어도 테스트가 통과한다" 로 명시해 옴 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` "변경 (1) — frontmatter `code:`" 절 | `spec/conventions/swagger.md` L18-19 기존 3개 항목 주석, `spec/conventions/review-citations.md` 동형 서술 | (a) `fixtures/forbidden-response-codes/**` 고정 위반 fixture 신설 후 `code:` 공동 등재, 또는 (b) 인라인 클래스 대조군을 뮤테이션으로 검증하고 그 이유를 swagger.md 새 주석에 명시 |
| 3 | plan_coherence | 트래커의 repo-guard `code:` census("14/5/9")가 이번 등재로 즉시 stale — 바로 하루 전 같은 트래커 항목이 `http-status-advertised` 등재 때 각주를 남긴 선례가 있는데 이번엔 각주 계획이 없음 | `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 변경 (1) (`forbidden-response-codes*.ts` 를 `code:` 에 추가) | `plan/in-progress/spec-draft-nullable-notation-followups.md` 약 4006행 "신규 repo-guard가 spec `code:`에 미등재" 항목 | 구현 plan(`forbidden-desc-codes.md`) 체크리스트의 "트래커 항목 닫기" 단계에서 «120곳» 항목은 닫고, «신규 repo-guard 미등재» 항목엔 `http-status-advertised` 때와 같은 형태의 한 줄 각주만 보탤 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 같은 주제에 근접한 두 모집단 수치("157곳 중 129곳" vs data-flow의 "88") — 모집단 정의가 달라 모순은 아니나 혼동 여지 | target "## Rationale (이 draft 의)" 신설 절 | 필수 아님. 원하면 "88(=@Roles() 라우트, 다른 모집단)과는 다름" 한 줄 각주 |
| 2 | rationale_continuity | §5-4 제목("새 엔드포인트 체크리스트")과 129곳 소급 강제 범위의 불일치를 새 Rationale이 직접 해소하지 않음 — swagger.md 자신의 "신규 변경 한정"(§1-4/§1-7/§3) 원칙과 표면적으로 반대 방향이나, 하루 전 §2-4(광고 성공 코드, #1403 계열) 선례가 "계약-정확성 규칙은 소급 강제" 라는 구분을 이미 실무로 세워 둠 | target `## 변경 (3)` 신설 Rationale | "왜 §1-4/§1-7의 '신규 한정' 이 아니라 §2-4의 '계약-정확성은 소급' 선례를 따르는가" 한 문장 추가 |
| 3 | convention_compliance | "두 문장" 표현이 실제 swagger.md L502-504 상 한 문장 | target "## 변경 (2)" 지시문 | 선택 사항, 실행에 지장 없음 — "그 뒤 문장" 등으로 정정 가능 |
| 4 | plan_coherence | integrations 4곳 403 설명 처방이 별도 plan(`integration-personal-owner-followup.md`)의 열린 RBAC 결정(Viewer 완화 여부)과 같은 라우트를 겨눔 — 신설 가드가 reflection 기반이라 나중에 역할이 바뀌면 자동으로 불일치를 RED 로 잡아 구조적으로 자기-교정됨 | `plan/in-progress/forbidden-desc-codes.md` §실측 표 | 차단 아님. `integration-personal-owner-followup.md` 해당 항목에 "가드가 설명-코드 불일치를 이미 감시한다" 포인터 한 줄 추가 시 탐색 비용 절감 |
| 5 | plan_coherence | `nestjs-v12-coordinated-upgrade.md` §C 의 reflection 회귀 체크리스트가 `@nestjs/swagger` 메타데이터에 기대는 네 번째 reflection 소비처(신설 가드)를 아직 모름 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C | 급하지 않음 — nestjs-v12 재개 시점에 §C 목록에 `forbidden-response-codes` 계열 추가 |
| 6 | naming_collision | `FORBIDDEN_NOT_A_MEMBER` 가 기존 로컬 근접 동의어 상수(`FORBIDDEN_MEMBER_ROUTE`, `FORBIDDEN_MEMBER`)와 개념이 겹치는 과도기 — 자매 구현 plan 이 "헬퍼로 흡수" 를 이미 명시했으나 target(spec draft) 자체 문구는 이관/치환을 언급하지 않음 | target "## 변경 (2)" | "기존 `FORBIDDEN_MEMBER_ROUTE`·`FORBIDDEN_MEMBER` 로컬 상수는 이 헬퍼로 흡수되어 사라진다" 한 문장 추가 |
| 7 | naming_collision | 가드명 `forbidden-response-codes` 가 "가드 거부 코드만" 검사한다는 스코프를 이름만으로 드러내지 않아 서비스 403(`FORBIDDEN`·`RERUN_PERMISSION_DENIED`)까지 검사한다고 오인될 여지 | 신설 가드 파일명 | 강제 아님. `guard-forbidden-codes` 류 접두 또는 기존 주석 유지로 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 새 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 규칙 도입 없음. 이미 채택·구현된 규칙(`data-flow/12-workspace.md` 2026-09-25)을 문서에 사후 반영하는 동기화. INFO 1건뿐 |
| rationale_continuity | LOW | 핵심 채택(비멤버는 항상 `NOT_A_MEMBER`)은 기존 결정과 정확히 일치. WARNING(population 캐너리 부재) 1건 + INFO(범위 확대 근거 미명시) 1건 |
| convention_compliance | LOW | 명명·frontmatter·문서 구성·링크 앵커·인용 상수 전부 정합. WARNING(negative fixture 부재, vacuous-guard 위험) 1건 + INFO 1건 |
| plan_coherence | LOW | 미해결 결정 우회·선점 없음. WARNING(트래커 census stale) 1건 + INFO 2건(구조적 자기-교정/비긴급) |
| naming_collision | LOW | 신규 식별자 전수 코드베이스 대조 결과 기존 충돌 0건(순수 신규). INFO 2건(과도기 동의어, 이름 자기설명력) |

## 권장 조치사항
1. (WARNING #1, #2 — 같은 "vacuous-guard 재발 방지" 계열) 구현 단계(`forbidden-response-codes.spec.ts`)에서 population 하한 assertion(컨트롤러/핸들러 수)과 전용 negative fixture 중 최소 하나를 갖추거나, 갖추지 않기로 한다면 그 이유를 target Rationale과 swagger.md 새 주석에 각각 명시한다.
2. (WARNING #3) 구현 plan 체크리스트의 트래커 정리 단계에서 `spec-draft-nullable-notation-followups.md` 의 "신규 repo-guard 미등재" 항목에 `http-status-advertised` 때와 같은 형태의 한 줄 각주를 보탠다.
3. (INFO, 선택) §5-4 소급 강제 근거 문장, 모집단 수치 각주, 동의어 상수 흡수 문장 등은 완성도를 높이지만 BLOCK 사유는 아니므로 구현자 재량으로 반영.
