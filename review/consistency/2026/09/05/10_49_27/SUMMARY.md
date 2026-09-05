# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL/WARNING 없음. 전문 확보 못 한 checker 없음(전원 인라인 전문 확보 및 디스크 파일 실존 확인).

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건. `plan_coherence` 가 이 세션이 만든 plan 문서 자체의 기록 정확도 이슈 2건(INFO)을 근거로 LOW 판정, 나머지 4개 checker 는 NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | 완료된 planner 턴 plan 의 `spec_impact` 가 실제 diff 3개 spec 파일 중 `spec/conventions/spec-impl-evidence.md` 를 누락(2개만 나열) — 두 checker 가 각자 발견해 일치 | `plan/complete/spec-draft-migration-rerun-and-citations.md` frontmatter `spec_impact:` | `spec_impact` 목록에 `spec/conventions/spec-impl-evidence.md` 추가 (archived 문서 사후 1줄 정정 허용 범위) |
| 2 | plan_coherence | 미해결 후속 항목이 인용한 절 번호가 실제 문서 구조와 어긋남 — "§3 의 '소급 정리 안 함'" 이라 썼지만 실제 해당 조항은 `review-citations.md` §4 | `plan/in-progress/spec-draft-nullable-notation-followups.md` "해소 불가 bare 인용 8건 채우기" 항목 | 해당 plan 항목의 "§3" 을 "§4" 로 정정 |
| 3 | convention_compliance | Rationale 문구 "각주로 등재"가 실제 반영 형태(§2.1 필드 정의 표 안 인라인 문장)와 문자 그대로는 다름 — 형식 강제 규약 아니므로 조치 불요 수준 | `spec/conventions/review-citations.md` Rationale > "code: 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유" | "각주로" → "필드 정의 설명에" 등으로 표현 정정(선택적) |
| 4 | naming_collision | "bare" 라는 일반 영단어가 `review-citations.md`(날짜 없는 세션 시각 인용)와 기존 `cafe24-api-metadata.md`/`makeshop-api-metadata.md`(MCP tool id)/`frontend-layering.md`(import 경로 형태)에서 서로 다른 의미로 반복 사용 — 정의된 식별자 충돌 아니고 문맥상 혼동 사례 없음 | `spec/conventions/review-citations.md` §2 vs 기존 3개 문서 | 조치 불요(별도 용어집 생기면 참고) |
| 5 | cross_spec | `migrations.md` §3 각주 절 번호 정정(§5→§6)이 README.md 실제 구조와 일치함을 실측 확인 (정합, 참고용) | `spec/conventions/migrations.md` §3 | 없음 |
| 6 | cross_spec | `review-citations.md` cross-spec 각주(swagger.md §3, plan-lifecycle.md) 내용 일치 확인 (정합, 참고용) | `spec/conventions/review-citations.md` §3 | 없음 |
| 7 | cross_spec | `spec-impl-evidence.md` §2.1 예외 각주와 `review-citations.md` Rationale 상호 등재 확인, SoT drift 없음 (정합, 참고용) | `spec/conventions/spec-impl-evidence.md` §2.1 | 없음 |
| 8 | cross_spec, naming_collision | 3개 파일 frontmatter `id:` 전수 대조 결과 `spec/**` 전역에서 유일 (정합, 참고용) | 3개 파일 frontmatter | 없음 |
| 9 | rationale_continuity | 이번 델타(커밋 `74d405b07`·`88d037197`·`8fc648856`)는 기존 결정을 뒤집지 않고 근거 서술을 정밀화한 것으로 확인(5개 라운드 연속 신규 발견 없음) | migrations.md §5 · review-citations.md §3 · README.md §5 | 없음 |
| 10 | plan_coherence | target 이 미해결 결정(Flyway `mixed=true`, V110 헤더 문구)을 우회하지 않고 정확히 그 경계에서 멈춘 것 확인 (정합, 참고용) | `codebase/backend/migrations/README.md` §5, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 6개 관점(데이터모델/API/요구사항ID/상태전이/RBAC/계층책임) 전수 실측, CRITICAL/WARNING 없음. plan `spec_impact` 완전성 INFO 1건 |
| rationale_continuity | NONE | 이번 델타는 5개 연속 라운드 확인 결과 전부 "실측→반증→정정→새 Rationale 보강" 패턴, 결정 번복·근거 없는 재기각 없음 |
| convention_compliance | NONE | frontmatter 스키마·3섹션 구조·명명·상호링크·수치 주장 전부 실측 통과. 서술 정확도 INFO 1건 |
| plan_coherence | LOW | target 은 미해결 결정을 우회하지 않고 정상 트랙으로 해소. 이 세션 plan 문서 자체의 spec_impact 누락·절번호 오기 INFO 2건 |
| naming_collision | NONE | 신규 id/파일경로 `spec/conventions/` 22개 문서와 전수 대조, 충돌 없음. "bare" 동음이의 INFO 1건 |

## 권장 조치사항
1. `plan/complete/spec-draft-migration-rerun-and-citations.md` frontmatter `spec_impact:` 에 `spec/conventions/spec-impl-evidence.md` 추가 (INFO #1, 2개 checker 일치 지적).
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "§3" 인용을 "§4" 로 정정 (INFO #2).
3. (선택) `review-citations.md` Rationale 의 "각주로 등재" 표현을 실제 형태(§2.1 필드 정의 인라인 문장)에 맞게 다듬는다 (INFO #3).
4. 위 3건 모두 BLOCK 사유가 아니며 차단 없이 통과 가능 — 필요 시 다음 spec 정정 턴에서 일괄 반영.
