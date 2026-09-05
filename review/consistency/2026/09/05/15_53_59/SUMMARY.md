# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 실행·전문 확보, CRITICAL 0건)

## 전체 위험도
**LOW** — spec/5-system/ 델타 0(코드 전용 PR). 감사 로그 응답 필드 과다노출 보안수정 + §5.4 응답계약 런타임 검증기(response-contract.ts) 신설. 신규 위반 없음. 유일한 WARNING 은 신규 검증기 이름이 기존 정적 가드와 근접해 혼동 소지가 있다는 명명 지적.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 신규 `response-contract.ts`/`ContractViolation`(런타임 응답-대-OpenAPI 대조)이 기존 `swagger-dto-contract-guard.ts`/`ContractMismatch`(정적 데코레이터-대-TS타입 대조)와 이름·주제가 근접해 "Contract" 검색 시 어느 쪽인지 즉시 판별 어려움 | `codebase/backend/src/shared/testing/response-contract.ts` | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`ContractMismatch`, `findSwaggerContractMismatches`) | 리네임은 4개 e2e 배선을 건드리므로 강제하지 않음. 문서·커밋 메시지에서 "선언-정적 계약" vs "응답-런타임 계약"으로 상시 구분 명시. 다음 planner 턴(§5.4 검증자 frontmatter `code:` 등재 시)에 두 검증자 역할 경계를 spec 본문 한 문장으로 명문화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §5.4 신규 검증 인프라(`response-contract.ts`, `swagger-probe.ts`)가 spec `code:` frontmatter 미등재 — 기존 추적 항목 재확인, 지속(신규 아님) | `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md` frontmatter `code:` | 새 조치 불요. 다음 planner 턴에서 `spec-draft-nullable-notation-followups.md:297` 체크박스 처리 시 함께 등재 |
| 2 | convention_compliance | `spec/5-system/*.md` 16개 중 6개(`2-api-convention.md` 등)에 `## Overview` 섹션 없음 — 3섹션(Overview/본문/Rationale) 관례 중 Overview 만 비대칭 결여. 이 PR 이전부터 존재(신규 위반 아님), 규약 자체가 "권장"이라 INFO | `spec/5-system/2-api-convention.md` 등 6개 | 다음 편집 시 `## Overview` 절 추가 또는 SKILL.md 에 "규칙 카탈로그형 문서는 Overview 생략 가능" 예외 명문화 |
| 3 | convention_compliance | 신규 코드의 리뷰 인용 형식(§2)·swagger §5-1(엔티티 패스스루 금지) 준수 확인 — 오히려 기존 위반(`leftJoinAndSelect` 로 `passwordHash` 등 26개 컬럼 노출)을 이 diff 가 수정함 | `audit-logs.service.ts` | 조치 불요(긍정 확인) |
| 4 | plan_coherence | §5.4 검증자가 여전히 어떤 spec `code:` glob 에도 안 걸림 — plan 이 이미 planner 트랙으로 분리한 기존 갭, 이번 PR 로 시행 지점(4개 DTO 배선)이 늘어 등재 근거가 더 분명해짐 | `spec/5-system/2-api-convention.md` frontmatter | 다음 planner 턴에서 등재 시 이번 배선 4곳 참조 |
| 5 | naming_collision | 테스트 전용 stub 컨트롤러 경로 `'stub'` 재사용 — 기존 관행과 일치, 격리된 테스트 모듈이라 라우팅 충돌 아님 | `execution-response.dto.spec.ts:167` | 없음(현행 유지) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, 구현은 §5.4·감사로그 계약과 정확히 부합. §5.4 검증기 frontmatter 미등재는 기존 추적 항목(지속) |
| rationale_continuity | NONE | §5.4 규칙을 그대로 코드화, 기각된 대안(반환타입 명시) 되살리지 않음, 기존 drift 10개 필드는 "고정+추적"만 하고 결정 번복 없음 |
| convention_compliance | LOW | 신규 위반 없음, 오히려 기존 엔티티 패스스루 위반 수정. Overview 섹션 6개 문서 결여는 기존 상태(INFO) |
| plan_coherence | NONE | 구현 diff 가 plan 의 open 항목과 정확히 대응, 두 plan 파일 체크박스·서술도 동시 갱신됨. 미해결 결정 우회 없음 |
| naming_collision | LOW | `AuditLogListItem` 등 신규 식별자 충돌 없음. `ContractViolation`/`ContractMismatch` 명명 근접 WARNING 1건 |

## 권장 조치사항
1. (선택) 다음 project-planner 턴에서 `spec-draft-nullable-notation-followups.md:297` 체크박스 집행 시 `spec/5-system/2-api-convention.md` 및 `spec/conventions/swagger.md` frontmatter `code:` 에 `response-contract.ts`/`swagger-probe.ts` 등재하고, 그 문서 안에 `response-contract`(런타임 응답 계약) vs `swagger-dto-contract-guard`(정적 선언 계약) 역할 경계를 한 문장으로 명문화 (WARNING #1 + INFO #1/#4 동시 해소).
2. (선택, 낮은 우선순위) `spec/5-system/` 중 Overview 없는 6개 문서에 짧은 `## Overview` 절 추가, 또는 SKILL.md 예외 조항 추가로 규약-실태 정합.
3. 이번 PR 자체는 차단 사유 없음 — push 진행 가능.