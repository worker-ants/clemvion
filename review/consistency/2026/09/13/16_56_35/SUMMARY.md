# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문을 확보했고(재시도 필요 항목 없음), Critical 발견 0건.

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `rationale_continuity` 가 지적한 "허용목록 없음 원칙 번복이 spec Rationale 미승격" 항목이 6라운드 연속 WARNING 으로 유지되고 있어 개별 checker 중 최고 위험도(MEDIUM)를 그대로 반영.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 Critical 이 없으므로 인계 대상도 없음. 다만 아래 WARNING 두 건 모두 근본 처리가 `project-planner` 권한(spec/ 쓰기)에 속하며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 정식 등재돼 있어 참고용으로 §경고 표에 병기함.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance, cross_spec | "허용목록 없음" 원칙(`#1330`)을 `GUIDE_EXTERNAL_VOCABULARY` 도입으로 번복했으나, 그 근거가 spec `## Rationale` 이 아니라 code 주석·plan 에만 있음. 동시에 이 가드 가족 자체가 `user-guide-evidence.md §2` 가드 표·frontmatter `code:` 에 여전히 미등재(선행 `guide-error-code-*` 시절부터의 기존 갭, 이번 PR 이 확대) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 주석, `guide-identifier-existence.test.ts` "외부 어휘 허용목록" describe 블록 | `spec/conventions/user-guide-evidence.md §2`(가드 표 3건 고정, frontmatter `code:` 미포함) + 동 문서 `## Rationale`(원칙 번복 근거 부재) | developer 조치 완료(권한 밖, `spec/` read-only) — planner 턴에서 §2 표 3→5건 승격 + frontmatter `code:` 3파일 추가 + 신규 Rationale 항목(문맥 게이팅이 원 결함을 못 잡는다는 실측 + 4강제 은폐방지)을 **한 턴에** 반영. `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274` 에 이미 이 내용으로 등재돼 있음(미체크) |
| 2 | convention_compliance | `cafe24-api-metadata.md §4` 가 `node-output.md` Principle 7 을 인용하나 실제 5필드 불변 envelope 은 Principle 0 이며, 인용된 필드 목록도 `status` 누락 | `spec/conventions/cafe24-api-metadata.md` §4 말미 `> **용어 주의**` 박스 | `spec/conventions/node-output.md` Principle 0/7 번호 체계 | 이번 PR 의 diff 범위 밖 선재 결함(코드 변경과 무관, `spec/conventions/**` 델타 0). `plan/in-progress/spec-draft-nullable-notation-followups.md:3406-3414` 에 이미 별도 planner 항목으로 등재돼 있음 — 이번 세션에서 추가 조치 불요, planner 턴에서 인용 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | `#1331` grep 총계 안내 숫자가 "10곳"이라 적혀 있으나 실측 11곳(대상 파일 7 + 자기서술 4) | `plan/in-progress/guide-identifier-existence.md:274` | PR 번호 확정·일괄 치환 시 안내 숫자도 재실측 갱신(cosmetic, 실행 절차는 파일 지정 grep 커맨드로 고정돼 있어 영향 없음) |
| 2 | cross_spec | `spec/5-system/3-error-handling.md §1.4` 인용 정확성 대조 완료 | `guide-identifier-scan.ts` 상단 주석 | 조치 불요 — 오인용 아님을 확인함 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/conventions/**` 델타 0, 이번 커밋(`82a23bf0a`)은 주석 정리+INFO 처분뿐. 데이터모델/API/요구사항ID/상태전이/RBAC/계층책임 새 표면 없음 |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복이 spec Rationale 미승격(6라운드 연속 WARNING, 근거는 충실하나 위치가 code/plan 뿐) |
| convention_compliance | LOW | `user-guide-evidence.md §2` 미등재(기존 갭 확대) + `cafe24-api-metadata.md §4` Principle 오인용(선재, 스코프 밖) — 둘 다 planner 백로그 등재 확인 |
| plan_coherence | NONE | target 델타 0, 필요한 spec 갱신 전부 정확한 planner 트래커에 등재·일치. `#1331` 안내 숫자 drift(INFO)만 |
| naming_collision | NONE | 신규 식별자(`CitationAxis`/`IdentifierCitation`/`GUIDE_EXTERNAL_VOCABULARY`/`MESSAGE_CREATE` 등) 전수 grep 충돌 0건, 옛 `guide-error-code-*` 댕글링 참조 0건 |

## 권장 조치사항

1. (BLOCK 해소 불필요 — Critical 없음) 이번 세션의 `codebase/` 작업은 추가 조치 없이 종결 가능.
2. 다음 `project-planner` 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 미체크 항목(§3247-3274, §3406-3414)을 처리할 때 **한 턴에** 아래를 함께 반영: (a) `user-guide-evidence.md §2` 가드 표 3→5건 승격 + frontmatter `code:` 3파일 추가, (b) 동 문서에 "허용목록 없음→허용 전환" 원칙 번복의 `## Rationale` 신규 항목 추가, (c) `cafe24-api-metadata.md §4` Principle 7→0 정정 + 필드 목록에 `status` 추가.
3. PR 번호가 `#1331` 로 확정되면 plan/코드 내 placeholder 일괄 치환 시 `plan/in-progress/guide-identifier-existence.md:274` 의 grep 총계 안내 숫자도 재실측해 갱신(강제 아님).