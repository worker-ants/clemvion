# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(cross_spec / rationale_continuity /
convention_compliance / plan_coherence / naming_collision) 전원 정상 실행, 전문 확보 완료.

## 전체 위험도
**LOW** — `spec/5-system/` 델타 0(코드 전용 PR), 8파일/640+줄 diff. §5.4 규약을 정확히
구현했으나 그 절의 request/response 스코프 경계가 문서에 명시돼 있지 않은 점(WARNING)과,
plan lifecycle 이동이 코드 주석 2곳에 반영되지 않은 점(WARNING)이 유일한 실질 이슈.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `2-api-convention.md` §5.4 "DTO 선언 형태" 규칙이 응답 바디 전용 절인데, 스코프 명시 문구가 없어 request DTO(PATCH tri-state: 키 생략=불변, `null`=초기화)에도 인용·적용되는 것처럼 읽힌다. 신규 가드(`swagger-dto-contract-guard.ts`)도 request/response 구분 없이 전체 스캔 | `spec/5-system/2-api-convention.md` §5.4 (라인 1122~1152) | `codebase/backend/.../update-assistant-session.dto.ts`(및 저장소 전역 `update-*.dto.ts` 20여 곳) — 동일한 optional+nullable 조합이 의도적 tri-state 패턴; `plan/in-progress/spec-draft-nullable-notation-followups.md` §5.4 drift 배치(104곳)가 이 정확한 조합을 "구형 drift" 로 분류 | §5.4 에 "본 절은 응답 바디 한정, PATCH 등 요청의 부분 업데이트 tri-state 는 적용 대상 아님" 명시 스코프 문구 추가. plan 의 "§5.4 drift 배치" 항목에 `update-*.dto.ts` 류를 구조적 예외로 명문화해 104곳 전수 수동 판단 부담 제거 |
| 2 | plan_coherence | 이동된 plan 경로(`plan/in-progress/entity-nullable-column-type-mismatch.md` → `plan/complete/...`)를 가리키는 stale 주석 2곳. 그중 1곳은 이번 diff 가 직접 편집한 파일인데도 인접 주석은 미수정 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:22`(이번 diff 편집 파일) / `codebase/backend/src/common/__test-utils__/source-scan.ts:190`(형제 파일, 미수정) | `plan/complete/entity-nullable-column-type-mismatch.md`(이미 완료 이동) 및 실질적 "다음 배치" 추적처인 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift 배치) | 두 주석의 "다음 배치 기준" 참조를 `spec-draft-nullable-notation-followups.md`(§5.4 drift 배치)로 정정. developer 턴에서 바로 고칠 수 있는 사실 정정(spec 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 신규 enforcement 가드(`swagger-dto-contract-guard.ts`)가 §5.4 를 SoT 로 인용해 정확히 구현하지만, spec 쪽(§5.4 본문 또는 Rationale)에는 "이 규약을 코드가 강제한다" 는 역참조 포인터가 없음 — `1-auth.md` 의 부트 캐너리 사례와 다소 어긋남 | `spec/5-system/2-api-convention.md` §5.4 | §5.4 또는 Rationale 에 "강제: `swagger-dto-contract.spec.ts`(AST 기반, `backend-checks.yml`)" 한 줄 추가 고려. 이번 diff 를 막을 사유 아님 |
| 2 | convention_compliance | `background-run-response.dto.ts` 가 `spec/conventions/swagger.md` §5-1 "응답 DTO 는 `dto/responses/` 하위" 관례를 따르지 않음(PR 이전부터 존재하던 위치, 이번 diff 는 위치를 바꾸지 않고 필드만 수정) | `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` | 이번 PR 책임 아님(신규 파일 아님, §5-1 은 신규 파일 위치 규약). 향후 재편집 기회에 `dto/responses/` 이동 고려 |
| 3 | convention_compliance | 신규 가드 파일이 `spec/conventions/swagger.md` frontmatter `code:` 목록에 미등재 — 단, 기존 형제 가드들(`masked-reject-callers-guard.ts` 등)도 동일 패턴(spec 본문 Rationale 내 인라인 언급, frontmatter 미등재)이라 실질 위반 아님 | `spec/conventions/swagger.md` frontmatter (line 4-8) | 조치 불요, 기록용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §5.4 응답 전용 절이 request DTO tri-state 패턴과 스코프 경계 불명확 (WARNING 1건) |
| rationale_continuity | NONE | §5.4 규칙을 재도입/번복 없이 정확히 구현. 신규 가드의 spec 역참조 부재(INFO 1건)만 |
| convention_compliance | NONE | §1-4/§5.4 규약 정확 구현, 가드 파일 배치·명명 기존 패턴 일치. INFO 2건(둘 다 PR 책임 밖 또는 기존 관행) |
| plan_coherence | LOW | §5.4 의 이미 확정된 규칙을 구현(우회 아님). plan lifecycle 이동 미반영 stale 주석 2곳(WARNING 1건) |
| naming_collision | NONE | `spec/5-system/` 델타 0, 신규 식별자 전부 리포지토리 내부 테스트/가드 유틸로 충돌 후보 없음 |

## 권장 조치사항

1. (WARNING #1) `spec/5-system/2-api-convention.md` §5.4 에 "본 절은 응답 바디 한정, PATCH 등
   요청 부분 업데이트의 tri-state 는 적용 대상 아님" 스코프 문구 추가 — planner 턴 권장(spec
   본문 수정이므로 developer 자기-반증형 소정정 예외 요건 미충족: 이 문장은 developer 가 쓴
   예고 문장이 아니라 기존 규약 본문의 스코프 불명확성).
2. (WARNING #2) `nullable-type-lie-cast.spec.ts:22` · `source-scan.ts:190` 의 stale plan 경로
   주석을 `spec-draft-nullable-notation-followups.md`(§5.4 drift 배치)로 정정 — developer 턴에서
   바로 처리 가능한 사실 정정.
3. (INFO #1) §5.4 Rationale 에 신규 가드 역참조 한 줄 추가 고려 — 선택적, 이번 PR 비차단.
4. (INFO #2, #3) 조치 불요 — 기록용.