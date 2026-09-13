# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 신규 코드 커밋(`1a2e78519`, 라운드 7)은 직전 라운드 CRITICAL(`BACKTICK` 축 혼합-스팬 미탐지)의 정밀도 수정이며, `spec/conventions/` 델타는 이번에도 0.

## 전체 위험도
**MEDIUM** — 신규 코드 결함은 없으나, `#1330`이 세운 "허용목록 없음" 원칙을 `#1331`(본 브랜치)이 실측으로 번복하면서도 그 번복과 원 가드 등록 어느 쪽도 spec `## Rationale`/`§2` 표에 아직 승격되지 않은 상태가 7라운드째 지속 중(rationale_continuity 판정).

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — 아래 WARNING 항목들은 developer 권한 밖(spec read-only)이지만 등급이 CRITICAL이 아니므로 이 표 대상이 아니다. 단, 근본 원인과 인계 대상은 WARNING 표의 "제안" 칸에 명시한다.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance, cross_spec(INFO→상향 통합) | 가드가 자칭하는 SoT `user-guide-evidence.md §2` 표(및 frontmatter `code:` 목록)가 신규/개명된 가드 3파일(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`, `guide-sanitized-message-parity.test.ts`)을 여전히 미등재. 7라운드 연속 재확인. | `guide-identifier-scan.ts` 상단 주석, `guide-identifier-existence.test.ts` JSDoc, `PROJECT.md:300` | `spec/conventions/user-guide-evidence.md §2` 표("Build-time 가드 (3건)") + §2.1 관계표 + frontmatter `code:` 목록 | developer 권한 밖(spec read-only). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3274`에 planner 항목으로 정확히 등재됨(미체크). 다음 project-planner 턴에서 3건 처리를 **한 턴에** 묶을 것(아래 #2, #3과 동일 턴) |
| 2 | convention_compliance | `user-guide-evidence.md`는 스스로를 "`<ImplAnchor>` 컴포넌트의 단일 진실"로 선언하는데, 신규 가드(`guide-identifier-existence.test.ts`)는 `<ImplAnchor>`와 무관한 식별자 인용 검증기라 §2에 단순히 행만 추가하면 문서의 자기 선언 스코프와 어긋난다 | `user-guide-evidence.md` 상단 "SoT 역할" 문구, §2 표 제목 | 같은 문서의 Overview 스코프 선언 | planner 턴에서 (a) Overview 스코프 문구를 "가이드 진실성 가드 가족"으로 넓히거나 (b) §2와 구분된 새 절(예: §6)로 등재 — 둘 중 하나를 명시적으로 택할 것. #1과 같은 턴에 처리 |
| 3 | rationale_continuity | `#1330`이 세운 "허용목록 없음" 설계 원칙을 `#1331`이 실측 근거(문맥 게이팅이 원 결함을 못 잡는다는 표·트레이드오프 비교·은폐 방지 4강제)로 명시적으로 번복했으나, 원칙도 번복도 spec `## Rationale`에 한 번도 승격된 적 없음 | `guide-identifier-scan.ts` 44~51행 허용목록 도입부, `GUIDE_EXTERNAL_VOCABULARY` 정의(245~255행) | `spec/conventions/user-guide-evidence.md`의 `## Rationale` 섹션(해당 원칙·번복 언급 자체가 없음) | planner 턴에서 신규 Rationale 항목 추가(허용목록 채택 근거 + 은폐 방지 4강제 명문화). #1, #2와 같은 턴에 처리 — plan 자신이 "한 턴에 묶으라"고 이미 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | `cafe24-api-metadata.md §4`의 "Principle 7" 오인용(실제는 `node-output.md` Principle 0 소유) — 본 diff와 무관한 선재 결함 | `spec/conventions/cafe24-api-metadata.md §4` "용어 주의" 박스 | 이미 `spec-draft-nullable-notation-followups.md:3406-3414`에 planner 항목으로 등재됨. 추가 조치 불요 |
| 2 | plan_coherence | 라운드 7이 새로 만든 `guide-identifier-scan.ts`의 `lastIndex` 리셋 보일러플레이트 4곳 복제 | `guide-identifier-scan.ts` | 이미 `spec-draft-nullable-notation-followups.md:3416-3429`에 developer 항목(코드 리팩터, developer 소유)으로 등재됨. 추가 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, 데이터모델/API/RBAC/계층 충돌 없음. SoT 미등재는 이미 planner 위임 상태 유지(신규 아님) |
| rationale_continuity | MEDIUM | "허용목록 없음" 원칙 번복이 spec Rationale에 7라운드째 미승격(근거는 충실, 승격 채널만 미해결) |
| convention_compliance | LOW | SoT `user-guide-evidence.md §2` 미등재 + 등재 시 스코프(`<ImplAnchor>` 전용) 선언과의 카테고리 불일치 우려 |
| plan_coherence | NONE | target 델타 0, developer 권한 밖 spec 갱신 2건 모두 정확한 이름으로 planner 트래커에 등재 확인, 신규 후속 항목(lastIndex 리팩터)도 올바른 소유자로 등재됨 |
| naming_collision | NONE | 신규 식별자/파일명/허용목록 항목 전부 grep 충돌 없음(구export는 같은 커밋에서 파일째 삭제되어 교체이지 공존 충돌 아님) |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요) 다음 project-planner 턴에서 WARNING #1~#3을 **한 턴**에 묶어 `spec/conventions/user-guide-evidence.md`를 갱신: (a) §2 표에 신규 가드 3건 추가, (b) frontmatter `code:` 목록 갱신, (c) Overview 스코프 문구 조정 또는 신규 절 신설, (d) "허용목록 없음→허용목록 채택" 원칙 번복을 설명하는 `## Rationale` 항목 추가.
2. developer 세션은 현재 상태로 push 진행 가능 — 이번 라운드 신규 CRITICAL 없음, 코드 자체(정규식 정밀도 수정)는 회귀 테스트로 검증됨.