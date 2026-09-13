# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 결과에 `[CRITICAL]` 항목 0건. 모든 checker 전문을 인라인으로 확보했으며(전원 status=success, 재시도 필요 항목 없음), 5개 checker output 파일은 이미 디스크에 존재함을 확인(추가 영속화 불요).

## 전체 위험도
**MEDIUM** — Critical 없음. 가장 강한 개별 신호는 rationale_continuity 의 MEDIUM(설계 원칙 번복의 spec Rationale 미승격). 나머지는 LOW/NONE. 실질 조치는 모두 developer 권한 밖(`spec/`)이며 planner 백로그에 이미 정확히 등재돼 차단 사유는 아님.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 Critical 0건)

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 이 표는 형식상 공란. 다만 아래 WARNING 3건 모두 근본 원인이 `spec/conventions/**` 쓰기(developer 권한 밖)이며, 이미 developer 가 스스로 planner 백로그로 위임 완료한 상태임을 참고용으로 남긴다(BLOCK 과 무관).

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 신규 가드(`guide-identifier-existence.test.ts`+`guide-identifier-scan.ts`)와 자매 파일(`guide-sanitized-message-parity.test.ts`)이 자칭 SoT `user-guide-evidence.md §2` 표·frontmatter `code:` 목록에 여전히 미등재("가드 3건" 그대로) | `spec/conventions/user-guide-evidence.md` §2 표, frontmatter `code:` | `PROJECT.md`/`CHANGELOG.md` 의 "SoT: user-guide-evidence.md §2" 인용 | (developer 조치 불요) planner 턴에서 §2 표에 2행(또는 3행) 추가 + frontmatter `code:` 목록에 3경로 추가. `#1330` 부터의 선재 gap 이며 이번 PR 이 새로 만들지 않음. `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 및 `plan/in-progress/guide-identifier-existence.md §D #1·#2` 에 이미 등재 확인됨 |
| 2 | rationale_continuity | `#1330`(`plan/complete/guide-error-code-truth.md §D`)이 채택한 "허용목록 없음" 설계 원칙을 이번 PR(`GUIDE_EXTERNAL_VOCABULARY`)이 실측 근거로 명시적으로 번복했으나, 그 근거가 spec `## Rationale` 로 아직 승격되지 않음 | `spec/conventions/user-guide-evidence.md` (신규 `## Rationale` 항목 부재), 근거는 `guide-identifier-scan.ts` 상단 주석 · `plan/in-progress/guide-identifier-existence.md §C` 에만 존재 | `plan/complete/guide-error-code-truth.md §D`("허용목록도 검토했고 기각했다") | (developer 조치 불요) planner 턴에서 `## Rationale` 신설 — ① 문맥 게이팅이 실제 결함(`MCP_INSECURE_URL_ALLOWED`)을 못 잡았다는 실측, ② 이번 허용목록이 `#1330` 기각 사유(전수 열거 요구가 부른 frontend 자기증명 오염)를 재현하지 않는 이유(4강제+뮤테이션 검증). 초안이 `spec-draft-nullable-notation-followups.md` 에 이미 있어 복붙 수준. 3라운드 연속(14:41→15:03→15:23) 동일하게 열려 있는 항목이나 developer 쪽 조치는 완료 상태 |
| 3 | convention_compliance (WARNING), cross_spec (INFO) — 상향 반영 | `cafe24-api-metadata.md §4` "용어 주의" 박스가 node-output envelope 정의처를 "Principle 7" 로 오인용(실제는 Principle 0)하고 `status` 필드 누락 | `spec/conventions/cafe24-api-metadata.md §4` | `spec/conventions/node-output.md` (`## Principle 0 — NodeHandlerOutput의 5필드는 불변`) | 이번 PR 과 완전 무관한 선재 결함(2026-05-16 작성 시점부터). `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 별도 planner 항목으로 등재 확인됨. 추가 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 이번 번복은 `#1330` 기각 사유 중 "frontend 자기증명 오염" 축은 그대로 보존(기준집합에 frontend 미포함 유지) — 완전 재도입이 아니라 부분 선택적 번복 | `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` | 위 WARNING#2 Rationale 신설 시 "무엇을 뒤집고 무엇을 보존했는가" 한 문장 포함 |
| 2 | naming_collision | 신규 식별자(`CitationAxis`/`IdentifierCitation`/`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY`) 전수 grep — codebase 전역 충돌 0건. `GUIDE_EXTERNAL_VOCABULARY` vs 무관 도메인 `KNOWN_DOCS_ABSENT` 는 impl-prep 단계에서 이미 의도적으로 접두 분리해 회피 확인 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` | 조치 불요 |
| 3 | convention_compliance | `review-citations.md §2` bare `hh_mm_ss` 위반(직전 라운드 15_03_36 CRITICAL) 이 이번 커밋에서 전체 경로 형태로 정정됨 — 전수 grep 재확인, 신규 위반 0건 | `guide-identifier-existence.test.ts:100`, `guide-identifier-scan.ts:73` | 조치 불요(해소 확인) |
| 4 | plan_coherence | 리네임 전방 참조(`guide-error-code-*`) 전수 확인 결과 orphan 없음 — 남은 참조는 전부 각주·역사 서술로 리네임 명시. `plan/complete/guide-error-code-truth.md` 는 완료 plan 이라 소급 정정 대상 아님(관례 일치) | 저장소 전역 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0(정상). SoT 미등재(WARNING, 선재)·cafe24 오인용(INFO, 무관) 모두 이미 planner 트래커 등재 확인 |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복이 근거는 충분하나 spec `## Rationale` 미승격(WARNING). 부분 보존 측면은 INFO |
| convention_compliance | LOW | `review-citations.md §2` bare 시각 위반 해소 확인. SoT 미등재(WARNING)·cafe24 오인용(WARNING) 둘 다 선재·developer 권한 밖, 정확히 위임됨 |
| plan_coherence | NONE | 주도 plan 이 자체 impl-prep 지적 4건을 전부 실제로 처분(diff 대조 확인). 리네임 orphan 참조 0건 |
| naming_collision | NONE | 신규 식별자 codebase 전역 충돌 0건. 파일 리네임은 기존 관례와 정합 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 이번 PR 은 차단 대상 아님)
2. 다음 `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신: (a) §2 표에 신규 가드 2~3행 추가, (b) frontmatter `code:` 목록에 3경로 추가, (c) 신규 `## Rationale` 항목(허용목록 원칙 번복 근거 — 초안은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 준비돼 있음).
3. 같은 planner 턴에 `spec/conventions/cafe24-api-metadata.md §4` 의 Principle 7→0 오인용·`status` 필드 누락도 함께 정정(무관 선재 결함이나 동일 백로그 파일에 등재돼 있어 배치 처리 효율적).
4. developer 쪽 추가 조치 없음 — 이번 PR 은 권한 경계를 지키며 필요한 모든 spec 갱신을 planner 백로그에 완결된 형태로 위임 완료했음을 확인.