# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 Critical 0 · Warning 0, INFO 4건뿐.

## 전체 위험도
**NONE** — `deps-peer-gating-and-eslint10` plan 의 잔여 마무리(미사용 `@eslint/eslintrc` devDependency 제거 + 기존 `cause: err` 보존 동작을 잠그는 회귀 테스트 2건)로, `spec/5-system/**.md` 본문은 전혀 수정되지 않았고 5개 관점(cross-spec/rationale/convention/plan/naming) 모두 충돌 표면 없음을 실측으로 확인.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 검토 스코프(`spec/5-system/`)와 실제 diff(devDependency 제거 + 테스트 2건)가 `code:` frontmatter 경유로만 간접 연결 — spec 본문 자체는 무변경 | 프롬프트 target 섹션 / 실제 diff (`package.json`, `expression-resolver.service.spec.ts`, `code.handler.spec.ts`) | 조치 불요. diff 가 순수 devDependency/테스트-only 인 경우 cross-spec 체크 사전 필터링을 차기 라운드에서 고려 |
| 2 | cross_spec | `Error.cause` 부착이 `3-error-handling.md` CWE-209 마스킹 원칙(HTTP 응답 `message` 대상)과 대상이 달라 상충하지 않음을 실측 확인 (`.cause` 는 응답/로그 어디에도 미직렬화) | `expression-resolver.service.ts:317`, `code.handler.ts:454` (사전 존재 코드, 이번 diff 는 테스트만 추가) | 조치 불요. 향후 `.cause` 를 응답/로그에 직렬화하는 변경이 생기면 그때 §6.3 재검토 |
| 3 | convention_compliance | `spec/conventions/**` 대부분(`error-codes.md`, `node-output.md`, `execution-context.md` 등)이 컨텍스트 예산으로 절단되어 본문 대조 불가 — 기존에 알려진 harness 예산 한계의 재발 | 본 checker 입력 bundle 조립 | orchestrator 측에서 이 checker 호출에 한해 conventions 청크 예산 상향 또는 관련 파일 강제 포함 검토(harness 조정 사안, 규약 결함 아님) |
| 4 | convention_compliance | `spec/5-system/5-expression-language.md` 가 형제 문서(`1-auth.md` 등)와 달리 `## Overview` 대신 `## 1. 개요` 사용 (pre-existing, 이번 diff 와 무관) | `spec/5-system/5-expression-language.md:18` | 이번 PR 범위 밖. 추후 해당 파일 편집 시 헤딩 통일 또는 규약 문서에 한국어 동의어 허용 명문화 검토 |
| 5 | plan_coherence | `plan/in-progress/node-output-redesign/code.md` 의 `code.handler.spec.ts` 줄번호 인용이 이번 diff(28줄 삽입)로 인해 어긋남 (예: `:198`→실제 `:226` 근방) | `plan/in-progress/node-output-redesign/code.md` §"6차 갱신"/§6 vs 실제 `codebase/backend/src/nodes/data/code/code.handler.spec.ts` | 즉시 조치 불요(해당 문서는 이미 "잔여 갭 0" 선언 상태, 인용은 과거 감사 스냅샷). 다음에 이 폴더를 다시 만질 때 줄번호 현행화 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 본문 무변경, `Error.cause` 는 CWE-209 마스킹 대상(HTTP 응답)과 무관함을 실측 확인 |
| rationale_continuity | NONE | `cause` 보존 동작은 이미 `origin/main`(1b17701aa)에 존재 — 이번 PR 은 회귀 테스트만 추가, 결정 번복/재도입 없음 |
| convention_compliance | NONE | 신규 API/엔티티/출력포맷 없음. conventions 컨텍스트 절단이라는 harness 한계만 caveat |
| plan_coherence | LOW | 대상 plan(`deps-peer-gating-and-eslint10.md`) 체크리스트와 정확히 일치. 별도 plan(`node-output-redesign/code.md`)의 줄번호 인용만 부수적으로 stale |
| naming_collision | NONE | `spec/5-system/` 무변경, 신규 식별자(요구사항 ID/엔티티/endpoint/이벤트/ENV/경로) 도입 없음 |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요)
2. 다음에 `plan/in-progress/node-output-redesign/code.md` 를 편집할 기회에 `code.handler.spec.ts` 줄번호 인용을 현행화한다(위생 항목, 별도 세션 불필요).
3. `spec/5-system/5-expression-language.md` 를 다음에 편집할 때 `## 1. 개요` → `## Overview` 헤딩 통일을 함께 처리한다(선택, 이번 PR 범위 밖).
4. orchestrator 측에서 convention_compliance checker 호출 시 `spec/conventions/error-codes.md`·`node-output.md`·`execution-context.md` 를 우선 포함하도록 청크 예산 조정을 검토한다(harness 개선 사안).