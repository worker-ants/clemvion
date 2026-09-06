# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전부 Critical/Warning 없음 (NONE/LOW 등급, INFO 만 존재)

## 전체 위험도
**NONE** — `spec-draft-review-citations-enforcement.md` 는 두 conventions 문서(`review-citations.md`, `spec-impl-evidence.md`)의 반증된 서술을 취소선+정정 블록으로 좁히는 planner 턴 정정이며, 5개 관점 모두에서 실질적 충돌·회귀가 발견되지 않았다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 이 발견되지 않아 인계할 항목이 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | — | — | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 검토 대상 파일(`review-citations.md`, `spec-impl-evidence.md`)이 cross-spec 번들에서 예산 초과로 절단됨 — harness 갭, target 결함 아님 (직접 파일 대조로 우회, 실질 충돌 없음 확인) | `_prompts/cross_spec.md` 조립 로직 | target 처럼 `spec/conventions/**` 를 직접 고치는 draft 는 해당 conventions 파일을 번들 조립 시 우선 포함하도록 조정 검토 |
| 2 | Rationale Continuity | `code:` frontmatter 리스트가 "준수 예시"(기존 2건)와 "시행 코드"(신규 `dto-jsdoc-citation*.ts`)를 인라인 구분 없이 나열 | `review-citations.md` frontmatter `code:` (변경안 B) | YAML 항목에 `# 시행 코드 (§3 DTO 축)` 인라인 주석 추가 또는 `spec-impl-evidence.md §2.1` 에 "혼합 리스트 허용" 문구 명시 |
| 3 | Rationale Continuity | 정정 블록 아래 "10개 중 backend·frontend 하나씩" 문장이 `code:` entry 개수(2→3)와 무관함에도 나란히 읽혀 오독 소지 | Rationale 정정 블록 하단, 손대지 않은 인접 문장 | 필요시 "이 수치는 `code:` entry 수가 아니라 저장소 전체 준수 예시 파일 수"라는 각주 추가 (종결 조건 아님) |
| 4 | Convention Compliance | 변경안 (C)만 취소선+`> 정정 (날짜)` 서식을 쓰지 않아 같은 문서 내 정정 표기 방식이 (A)와 갈림 | `## 변경안 (C)` (105~108행) | (C)의 괄호 선례 인용문도 (A)와 동일하게 `~~원문~~ > **정정 (2026-09-06)**: …` 형태로 통일 (스타일 제안, 종결 조건 추가 불필요) |
| 5 | Plan Coherence | 종결 조건 4번째 항목("자매 plan 동기화")이 요구하는 내용이 `spec-draft-nullable-notation-followups.md` 에 이미 워킹트리 반영(M) 상태 — 실질 충돌은 없으나 체크박스만 미체크 | target `## 종결 조건` 4번째 항목 | 커밋 시점에 실제 diff 와 맞춰 체크 여부 정리 |
| 6 | Plan Coherence | "함께 처리할 것" 3번(`spec-draft-api-convention-verifier-registration.md` → `complete/` 이동) 전제(열린 체크박스 0건)를 실측 확인 — target 도 비구속 권고로 명시 | `## 함께 처리할 것` 3번 | 없음 (그대로 두어도 무방, 별도 정리 커밋에서 이동) |
| 7 | Naming Collision | `code:` 신규 등재 대상(`dto-jsdoc-citation*.ts`)이 실제 저장소에 존재하며 다른 spec 의 `code:` 슬롯과 의미 충돌 없음 | 변경안 (B) | 없음 (확인 완료 기록) |
| 8 | Naming Collision | glob 폭(`dto-jsdoc-citation*.ts`)에 대한 target 경고가 자매 plan 서술과 이미 일치 — "충돌 해소"가 아니라 "이미 일치 상태의 문서화" | 종결 조건 4번째 항목 | 해당 없음 (plan 진행상태 동기화는 Plan Coherence 소관) |
| 9 | Naming Collision | heading·`id:`·선례 인용 텍스트에 신규/중복 식별자 없음 (기존 heading in-place 편집, `id:` 값 미변경) | 변경안 (A)/(C) | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 대상 conventions 파일 2개가 번들에서 절단됐으나 직접 대조로 실질 충돌 없음 확인. `dto-jsdoc-citation-guard.ts` 소유 경계(§5.4 두 검증자와 다른 축)도 확인됨. 유일 이슈는 target 결함이 아닌 harness(번들 조립) 갭 |
| Rationale Continuity | LOW | 반증된 전제를 취소선+정정 블록으로 누적하는 모범적 패턴. 기각된 대안(PR/SHA 전환, 소급 정리, 넓은 트리 glob) 재도입 없음. `git blame`·guard 소스로 핵심 사실 주장 실측 검증. INFO 2건은 문서 명료성 제안 |
| Convention Compliance | NONE | `git blame` 으로 저작자(planner, 90c1751e8) 확인 — 자기-반증형 소정정 조건 1 미충족 판단이 근거 있음. 기술 근거(가드 스코프, glob 매치, frontmatter 스키마) 전부 실측 일치. INFO 1건은 변경안(C) 서식 통일 제안 |
| Plan Coherence | NONE | target 의 반증 전제(두 낡은 문구)가 여전히 저장소에 남아 유효함을 재확인. 자매 plan·기존 in-progress plan 과 역할 분담·glob 폭 충돌 없음. 저장소 전체 grep 으로 번들 절단분 보완 |
| Naming Collision | NONE | 신규 제품 표면(ID·엔티티·endpoint·이벤트·ENV) 도입 없음. `code:` 신규 파일 경로는 실존하며 다른 spec 슬롯과 미충돌. heading/`id:` 신규 생성 없음 |

## 권장 조치사항
1. (선택) cross-spec 번들 조립 로직이 target 이 직접 수정하는 `spec/conventions/**` 파일을 예산 우선순위로 포함하도록 개선 검토 — 이번 라운드는 직접 대조로 우회했으나 반복되면 다음 라운드가 "확인 안 함"을 "충돌 없음"으로 오판할 위험.
2. (선택) `review-citations.md` `code:` YAML 에 "시행 코드 vs 준수 예시" 구분 인라인 주석 추가.
3. (선택) 변경안 (C) 도 (A)와 동일한 취소선+정정 블록 서식으로 통일.
4. 커밋 시점에 종결 조건 4번째 항목(자매 plan 동기화) 체크박스를 실제 diff 상태와 맞춰 정리.

BLOCK 사유가 없으므로 위 조치는 모두 선택 사항이며 target 진행을 막지 않는다.

참고: 5개 checker 산출물(`cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`)은 모두 `/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense/review/consistency/2026/09/06/13_18_59/`에 이미 디스크에 존재함을 확인했다(영속화 불필요). `SUMMARY.md` Write는 하네스 정책상 차단되었으므로(비-terminal 여부와 무관, basename 일치 차단), 호출자가 위 전문을 동일 경로에 멱등 Write해야 한다.
