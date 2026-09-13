# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문을 제출했고(재시도 필요 0건), Critical 위배는 발견되지 않았다.

## 전체 위험도
**LOW** — target(`spec/conventions/`) 자체 델타는 0이며 실질 변경(`guide-error-code-*` → `guide-identifier-*` 리네임/확장)은 codebase 쪽 harness 테스트에 국한된다. 유일한 반복 이슈는 SoT(`user-guide-evidence.md §2`) 미등재 + Rationale 미승격이며, developer 권한 밖 사안으로 이미 `project-planner` 트래커에 정식 위임돼 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 아래는 Critical 이 아니라 WARNING 이므로 이 표는 형식상 필수는 아니나, 근본 원인이 developer 권한 밖(spec/ 쓰기)이라는 점이 5개 checker 중 3개(cross_spec/rationale_continuity/convention_compliance)에서 공통 확인되어 참고용으로 남긴다. **등급은 WARNING 그대로이고 BLOCK 에도 영향 없다.**

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/conventions/**` 쓰기는 `project-planner` 전속 권한(CLAUDE.md §Skill 체계) — developer 는 자기-반증형 소정정 예외에도 해당하지 않음(제품 정의/evidence 목록 성격이라 예외 제외 대상) | project-planner | `spec/conventions/user-guide-evidence.md` — §2 "Build-time 가드" 표에 `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`)·`guide-sanitized-message-parity.test.ts` 행 추가(3건→5건, 개수 표기 갱신) + frontmatter `code:` 목록에 3파일 추가 + §2.1 "다른 가드와의 관계" 서술 갱신 + 신규 `## Rationale` 절에 "허용목록 없음"(`#1330`) 원칙의 부분 번복 근거(승격용 초안 기완비) 반영 | `plan/in-progress/guide-identifier-existence.md §D`(--impl-prep 3-checker 수렴, `review/consistency/2026/09/13/12_33_41`), `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 이하 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance (중복 통합) | SoT 로 자칭하는 `user-guide-evidence.md §2` 가 신규 가드 계열(`guide-identifier-existence`/`guide-sanitized-message-parity`)을 아직 열거하지 않음. 부수적으로 `#1330`("허용목록 없음") 원칙의 부분 번복 근거가 spec `## Rationale` 로 아직 승격되지 않음 | `guide-identifier-scan.ts` 상단 JSDoc("SoT: user-guide-evidence.md"), `PROJECT.md` 가드 카탈로그 행, `CHANGELOG.md` 신규 항목 | `spec/conventions/user-guide-evidence.md §2`(3건 표, frontmatter `code:`) · `spec/conventions/error-codes.md §Rationale`(둘 다 이 가드 언급 0건) | 다음 planner 턴에서 §2 표 갱신(3건→5건)+frontmatter+`## Rationale` 승격을 한 번에 처리(초안은 `spec-draft-nullable-notation-followups.md` 에 기완비). 6라운드 연속 동일 발견이나 developer 쪽 조치(플랜 등재·권한 준수)는 완료 상태이므로 codebase 쪽을 추가로 막을 근거 없음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `cafe24-api-metadata.md §4` Principle 7/0 오인용 — 이번 diff 와 무관한 선재 결함, 이미 별도 planner 항목으로 등재됨 | `spec-draft-nullable-notation-followups.md` | 중복 언급 불요, 기존 등재 유지 |
| 2 | rationale_continuity | 부분 재도입은 `#1330`("frontend 자기증명 오염" 기각 사유)을 여전히 보존 — 기준집합에서 frontend 소스는 계속 제외 | `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` | 조치 불요, Rationale 승격 시 "무엇을 뒤집고 무엇을 보존했는가" 한 문장 포함 권고(초안에 이미 반영) |
| 3 | convention_compliance | `review-citations.md §2`(날짜 포함 인용 형식) 준수 확인 — bare `hh_mm_ss` 0건 | diff 전역 리뷰 인용 | 조치 불요 |
| 4 | convention_compliance | 명명 규약(파일명·축 라벨 `field-table`/`code-field`/`backtick`) 기존 패턴과 일관 | 신규 파일명·`CitationAxis` | 조치 불요 |
| 5 | naming_collision | 신규 식별자(`CitationAxis`/`IdentifierCitation`/`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY`) 저장소 전수 grep 결과 충돌 없음, 옛 `guide-error-code-*` 댕글링 참조도 없음 | 신규 파일 전역 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/conventions 델타 0, 라운드6 신규 변경(정규식 경계 교정)은 spec 인용·SoT 무관. 기존 SoT 미등재 INFO 1건(이미 추적) |
| rationale_continuity | MEDIUM | `#1330` "허용목록 없음" 원칙 번복이 spec Rationale 밖에 6라운드 연속 체류 (WARNING, developer 쪽 조치 완료·planner 위임 완비) |
| convention_compliance | LOW | SoT(`user-guide-evidence.md §2`) 미등재 WARNING 1건(이미 추적된 known-deferred), 나머지 규약(리뷰 인용·명명) 준수 확인 |
| plan_coherence | NONE | 미해결 결정 우회 없음, 트래커 갱신 반영 확인, 참조처 정리 완료, 타 in-progress plan 과 충돌 없음 |
| naming_collision | NONE | 신규 식별자 전수 대조 충돌 0건, 댕글링 레퍼런스 0건 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 이번 라운드 차단 없음) 다음 `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md` §2 표(3건→5건)·frontmatter `code:` 목록·§2.1 관계 서술·신규 `## Rationale`(`#1330` 부분 번복 근거, 초안 기완비)을 한 번에 갱신 — 6라운드 연속 반복된 유일한 WARNING 을 닫는다.
2. `cafe24-api-metadata.md §4` Principle 오인용은 이번 PR 과 무관하므로 별도 planner 백로그 항목으로 계속 분리 관리(이미 등재됨, 추가 조치 불요).
3. codebase 변경분(가드 리네임·확장·허용목록)은 5개 checker 모두 CRITICAL 없이 통과했으므로 push 진행 가능.
