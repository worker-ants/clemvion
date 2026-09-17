# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원 CRITICAL 없음. 전문 확보 못 한 checker 없음(5/5 success + 인라인 전문 확보, 디스크 파일도 이미 존재 확인됨: `cross_spec.md`·`rationale_continuity.md`·`convention_compliance.md`·`plan_coherence.md`·`naming_collision.md` 5개 모두 `review/consistency/2026/09/17/14_45_07/` 에 실재).

## 전체 위험도
**LOW** — spec(`spec/2-navigation/`) 델타 0인 순수 backend 동시성 버그 수정(PATCH 저장을 "엔티티 통째 저장"에서 "부분 객체 저장"으로 좁힘). 새로 도입된 모순·충돌은 없으나, 이 diff 자신이 반증한 spec 캐비앗의 미갱신 + plan 상호참조 순환이 WARNING 4건으로 수렴.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 판정이 없어 해당 표는 비운다. 단, 아래 WARNING #1·#2 의 근본 원인(§3 캐비앗 텍스트, `15-chat-channel.md §5.4` 표)은 developer 권한 밖(문장 작성자가 developer 본인이 아님 — `git log -S` 확인, `217fadecb` planner 커밋)이라 CLAUDE.md §자기-반증형 소정정 조건 1 미충족. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목(교체 문구까지 준비됨)으로 등재되어 있으므로 별도 인계 없이 다음 planner 턴에서 그대로 집행하면 된다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance (+plan_coherence 는 INFO 로 관측, 최강 등급인 WARNING 으로 통합) | §3 "실측되지 않은 잔여" 註(CASCADE 창 실패 방식·락 밖 컬럼 경합이 "확인되지 않았다")가 바로 이 PR 의 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)로 실측·반증됐고, §3 상단 "PATCH 의 기본 저장 경로(엔티티 통째 저장)" 서술도 이 PR 로 사실이 아니게 됐는데 spec 텍스트(scope 델타 0)가 갱신되지 않음 | `spec/2-navigation/2-trigger-list.md` §3, "⚠️ 실측되지 않은 잔여" 블록 및 바로 위 "동시 쓰기 직렬화" 문단 | `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`(신규, ①②를 실측 고정) / `codebase/backend/src/modules/triggers/triggers.service.ts`(부분 객체 `save`로 수정) | planner 턴에서 §3 註를 "① 재읽기 뒤 FK CASCADE 는 시끄러운 실패로 실측(23503/23502, 롤백·부활 없음) · ② 락 밖 컬럼 경합은 실결함이었고 부분 객체 `save`로 수정됨"으로 교체. `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 1에 문구 준비됨 |
| 2 | cross_spec | 위 §3 註의 파급 — rotate-bot-token 이 "병합 쓰기 0행 매치→404" 를 낼 수 있다는 사실이 이웃 spec 영역의 에러 계약 표에 반영 안 됨 | `spec/5-system/15-chat-channel.md §5.4` Bot Token Rotation API 404 행(`RESOURCE_NOT_FOUND`, 현재 `findById` 실패 사유만 등재) | `spec/2-navigation/2-trigger-list.md §3` 상단 "동시 쓰기 직렬화" 註(CASCADE 창에서 병합 쓰기 0행 매치 시에도 404) | planner 턴에서 `15-chat-channel.md §5.4` 404 행에 "CASCADE 창의 병합 쓰기 0행" 사유 한 줄 추가. 같은 트래커 항목 3에 등재됨 |
| 3 | convention_compliance | 신규 증거 e2e 파일(`trigger-update-save-window.e2e-spec.ts`)이 target 문서 자신의 증거-등재 관례(`code:` frontmatter 인용, 선례 `trigger-workflow-ref.e2e-spec.ts`)를 따르지 않음 — glob 은 매치해 빌드 가드는 통과하지만 문서 자체가 정한 인용 규율 미준수 | `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록 | `spec/conventions/spec-impl-evidence.md` §2.1 + 문서 자신의 인라인 주석 관례 | planner 턴에서 `code:` 에 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 추가. 같은 트래커 항목 2에 등재됨 |
| 4 | plan_coherence | `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 아직 존재하지 않는 `plan/complete/trigger-save-partial-patch.md` 경로를 두 곳에서 이미 이동된 것처럼 인용하고, `trigger-save-partial-patch.md` 자신의 체크리스트도 "plan → complete/ 이동"을 실제 이동 전에 체크함(같은 줄 바로 다음 `[ ] --impl-done spec/2-navigation/ — 진행 중` 이 미완료임을 스스로 밝힘) — 두 plan 문서가 서로 "이미 끝났다"고 가리키는 순환 참조 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 7 행 및 신설 planner 후속 도입부; `plan/in-progress/trigger-save-partial-patch.md` 체크리스트 | 프로젝트 관례 "체크와 `complete/` 이동은 한 동작" | (a) `trigger-save-partial-patch.md` 를 실제로 `plan/complete/` 로 옮기는 커밋과 이 두 참조 추가를 같은 커밋으로 묶거나, (b) 아직 이동 전이면 두 참조를 `plan/in-progress/trigger-save-partial-patch.md` 로 고치고 체크리스트의 "plan → complete/" 항목은 실제 이동 시점까지 미체크로 되돌릴 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Chat Channel `provider`/`botToken` 불변성 관련 R-12/§5.4.1.2 등 인접 註는 이번 diff 영향 범위 밖 — 확인용 negative 기록 | `spec/2-navigation/2-trigger-list.md §2.3.1`, `spec/5-system/15-chat-channel.md §5.4.1` 등 | 조치 불요 |
| 2 | naming_collision | diff 전체(5파일/484줄) 전수 확인 결과 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·설정키 없음. 유일한 신규 파일 `trigger-update-save-window.e2e-spec.ts` 는 기존 `<topic>.e2e-spec.ts` 명명 컨벤션 준수, 기존 파일과 미충돌 | `codebase/backend/test/` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §3 캐비앗 stale + chat-channel §5.4 404 표 파급 미반영 (WARNING) |
| rationale_continuity | LOW | 같은 §3 캐비앗이 이 PR 로 자기-반증됐는데 미갱신 (WARNING). 유예 자체는 실측 기반이라 정당 |
| convention_compliance | LOW | §3 캐비앗 stale (WARNING) + 신규 e2e `code:` 미등재 (WARNING) |
| plan_coherence | LOW | plan 상호참조가 아직 없는 `plan/complete/...` 경로를 선참조 + 체크리스트 조기 체크 (WARNING). §3 캐비앗 건은 이미 추적 중이라 INFO 로 관측(통합 시 WARNING 유지) |
| naming_collision | NONE | 신규 식별자 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 사유 아님 — 참고) 이번 라운드는 CRITICAL 이 없어 즉시 차단 사유 없음.
2. `trigger-save-partial-patch.md` 실제 `plan/complete/` 이동과 `spec-draft-nullable-notation-followups.md`/`trigger-save-partial-patch.md` 상호참조·체크리스트를 같은 커밋으로 동기화할 것(WARNING #4) — 커밋 전 조치 권장.
3. 다음 planner 턴에서 트래커에 이미 준비된 3건을 그대로 집행: (a) `2-trigger-list.md §3` 註 교체(WARNING #1), (b) `15-chat-channel.md §5.4` 404 행에 CASCADE 사유 추가(WARNING #2), (c) `2-trigger-list.md` frontmatter `code:` 에 신규 e2e 등재(WARNING #3).
4. developer 범위에서는 추가 조치 불요 — `spec_impact: none` 및 planner 위임 판단(자기-반증형 소정정 조건 1 미충족)은 정당.