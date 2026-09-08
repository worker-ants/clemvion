# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 미발견. WARNING 2건(등급 유지, 하향 없음)만 존재.

## 전체 위험도
**LOW** — 다른 spec 영역·규약·plan 과의 직접 모순은 발견되지 않았고, 두 건의 문서 자체 회계/대칭 결함(WARNING)만 남는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | A-1 이 harness 쓰기 권한을 developer/planner 두 축으로 나누면서 `CLAUDE.md` Skill 표에는 **개발자 행에만** 반영하고 **기획자 행은 그대로** 둔다. `project-planner/SKILL.md` 「경로별 권한」 표에는 `.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md` 를 새로 등재하지만, `CLAUDE.md` 최상위 표만 보면 기획자는 여전히 `spec/**`,`plan/**` 뿐 — A-1 스스로 경계한 "권한을 갖는 문서에 그 권한이 안 보이는" 패턴이 `CLAUDE.md` 기획자 행에서 재발 | `CLAUDE.md` Skill 체계 표 기획자 행 (61-67행 부근) | `.claude/skills/project-planner/SKILL.md` 「경로별 권한」 표(신설 행) | `CLAUDE.md` 기획자 행 쓰기 권한 셀에 거버넌스 문서(`.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md`) 추가 — 개발자 행과 대칭 맞춰 두 SKILL.md 표 + `CLAUDE.md` 표 3곳을 다시 1:1 대응시킨다 |
| 2 | plan_coherence | 체크리스트 마지막 항목이 자매 트래커(`spec-draft-nullable-notation-followups.md`)에서 플립해야 할 체크박스 수를 "5건"으로 적었으나, 실측(`## 후속` 섹션 미체크 bullet)상 이번 draft 스코프에 들어오는 항목은 최소 **9개**(A-1:1행969 · A-2:4행1121/1137/1148/1203 · A-3:1행1183 · A-4:1행901 · A-5:1행1266 · A-6:1행1841, A-6 은 이번 draft 에 신규 편입된 추가 스코프). 바로 위 줄 "A-2 4건" 서술과도 자기 모순 | `plan/in-progress/spec-draft-followups-batch-a.md` `## 체크리스트` 마지막 줄 "자매 트래커 … 체크박스 5건 플립" | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션 미체크 bullet 9개 | 체크리스트 항목을 "자매 트래커 해당 bullet 9개(A-1 1·A-2 4·A-3 1·A-4 1·A-5 1·A-6 1) 전부 플립 — 개별 열거 확인, 숫자만으로 종료 판단 금지"로 교체하거나, 실행 직전 자매 트래커를 열어 A-N별 대응 bullet 전수 대조 단계 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | A-1 신설 규칙("거버넌스 문서는 planner")이 역사적 관행(`a36395f5c`·`fed994b6b` 이 `.claude/docs/**` 를 developer 커밋으로 직접 수정)과 반대 방향임을 target 이 스스로 명시 — 허구 선례 소급 부여는 없어 결함은 아니나, 이 경계를 강제할 게이트가 없다는 점도 자인 | A-1 "왜 '거버넌스 문서는 planner' 로 가르나" 절 | 후속 PR 에서 harness 커밋이 다시 `.claude/docs/**` 를 함께 건드리면 신설 규칙 유지/변경 여부를 재확인한다는 문구를 plan 체크리스트에 한 줄 추가 |
| 2 | rationale_continuity | A-2-1 R-2 폐기 처리는 원문 취소선 보존 + R-14 대체 명시 + `15-chat-channel.md` R-CC-10 인용 앵커 동반 갱신으로 방법론적으로 건전. 다만 앵커 slug 변경(`#r-2-…` → `#r-2-…-폐기`) 적용 후 사후 검증 필요 | A-2-1 변경안 블록 | 적용 후 `--impl-done` 또는 링크 무결성 가드로 앵커 1회 재확인(이미 target 체크리스트에 포함 — 추가 조치 불요) |
| 3 | convention_compliance | A-5(a) 규범 블록이 `§2.1 User` 표 아래 번호 없는 blockquote 로 삽입되어, 자매 섹션 `§2.17.2`(번호 있는 하위 절, 다른 문서가 앵커로 직접 인용)와 구조가 다름 | A-5(a) 변경안 | `#### 2.1.1 응답 노출 금지` 같은 번호 하위 절로 승격하면 `secret-store.md` 등의 상호 참조 앵커가 더 명시적(필수 아님) |
| 4 | convention_compliance | `review-citations.md §3` 의 날짜 없는 bare `hh_mm_ss` 인용 금지가 `plan/**` 문서엔 적용 안 됨을 target 이 정확히 이해하고, 삽입될 spec 본문 텍스트에는 날짜 포함 인용만 사용(펜스 밖 plan 근거 설명에만 bare 인용) | A-3·A-5 등 다수 인용 | 조치 불요 — 준수 사례로 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 다른 영역 spec 과의 직접 모순 없음. `CLAUDE.md` Skill 표 기획자 행 미갱신(WARNING) 1건만 발견, 나머지 ~20개 인용·라인·앵커·코드 실측 전부 원문과 일치 |
| rationale_continuity | LOW | 인용한 모든 과거 Rationale(R-2/R-14/R-CC-10/§7.1/§1.1/AuthConfig 마스킹 SoT 배치)이 실제 spec·git 이력과 일치. 결정 번복 자리(A-2-1, A-6)마다 원문 보존 + 새 근거/대체 Rationale 명시. 허구 선례 없음(INFO 2건만) |
| convention_compliance | LOW | 정식 규약(`spec/conventions/**`) 위반 없음. 명명·포맷·앵커 규칙 정합, `review-citations.md §3` 면제 조항 정확히 활용. 스타일 수준 INFO 1건 |
| plan_coherence | LOW | 이전 라운드(`11_14_39`) WARNING·INFO 모두 A-6 신설/A-2-2 문구로 반영 확인. baseline 문구·코드 실측 전부 최신 저장소 상태와 일치. 체크리스트 개수 오류(WARNING) 1건 |
| naming_collision | NONE | 신규 식별자(§1.10, Skill 권한표 행, `code:` glob 2쌍, R-2 anchor 변경) 전수 대조 결과 기존 식별자와의 충돌·glob 오포섭·미처리 인입 링크 없음 |

## 권장 조치사항
1. `CLAUDE.md` Skill 체계 표 기획자 행 쓰기 권한 셀에 거버넌스 문서(`.claude/docs/**`·`.claude/skills/**/SKILL.md`·`CLAUDE.md`) 추가 — 개발자 행과 대칭 맞춤 (WARNING #1 해소)
2. `plan/in-progress/spec-draft-followups-batch-a.md` 체크리스트의 "자매 트래커 체크박스 5건 플립"을 실제 개수(9개, A-N별 열거)로 교정 (WARNING #2 해소)
3. (선택) A-5(a) 규범 블록을 번호 있는 하위 절(`#### 2.1.1`)로 승격해 `§2.17.2` 와 구조 대칭 맞춤
4. (선택) A-1 의 harness 소유권 분리 규칙이 강제 게이트 없이 신설되는 점을 plan 체크리스트에 재확인 조건으로 한 줄 명시
