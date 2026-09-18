# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보, Critical 0건.

## 전체 위험도
**LOW** — Critical 없음. Convention Compliance 가 `spec/conventions/` 코퍼스 전반(이번 작업과 직접 관련 없는 기존 상태)에 WARNING 2건을 제기했고, 나머지는 INFO(모범 사례 확인·체크리스트 항목·오탐 배제).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `migrations.md`의 Rationale 섹션이 corpus 전역 관례(bare `## Rationale`, 문서 종결 섹션)에서 유일하게 벗어남 — 번호 붙은 절 제목(`## 7. 폐기 대안 (Rationale)`) 뒤에 `## 참고` 섹션이 이어져 Rationale 이 종결 섹션이 아님 | `spec/conventions/migrations.md` §7 (line 155), `## 참고` (line 198) | `.claude/skills/project-planner/SKILL.md` 3섹션 구성 표(Overview/본문/Rationale), 나머지 conventions 22개 문서의 실제 관행 | 헤딩을 `## Rationale`(bare)로 바꾸고 "폐기 대안"은 하위 `###`로 두거나 `## 참고`를 Rationale 앞으로 이동. 의도된 예외라면 SKILL.md에 "레퍼런스 섹션은 Rationale 뒤에 올 수 있다" 명시 |
| 2 | Convention Compliance | `spec/conventions/` 최상위 23개 문서 중 13개가 `## Overview` 섹션을 생략(과반) — `node-output.md`는 Rationale 섹션도 없어 3섹션 중 2개 결여 | `spec/conventions/{chat-channel-adapter,conversation-thread,cross-node-warning-rules,data-hydration-surfaces,i18n-userguide,interaction-type-registry,cafe24-api-metadata,makeshop-api-metadata,node-cancellation,node-output,secret-store,swagger}.md` | `.claude/skills/project-planner/SKILL.md`의 3섹션 구성 표 — `## Overview (제품 정의)` | 신규 conventions 작성 시 최소 Overview 1단락 의무화, 기존 문서는 다음 편집 기회에 점진 보강. 자동 가드 부재 · 이번 FK 인덱스 작업과 무관한 기존 상태 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | 신규 처분 기준("자식 테이블 크기 × 연쇄 삭제 부모 행 수")이 이전 절의 "ms 단일 문턱"을 대체하며 원문 옆에 정정 각주를 남겨 번복을 명시적으로 처리함 — 모범 사례 | `spec/1-data-model.md` `## Rationale` "쓸 인덱스가 없는 FK 서른하나의 처분 (2026-09-18)" 절 | 조치 불요. 스타일 통일을 원하면 취소선 표기(`6-knowledge-base.md` 선례)로 맞출 것 고려 |
| 2 | Rationale Continuity | Rationale 문장이 아직 존재하지 않는 `plan/complete/spec-draft-fk-remaining-dispositions.md` 경로를 순방향 인용(현재 `plan/in-progress/`, status: in-progress) | `spec/1-data-model.md` Rationale 신규 절 말미 | `--impl-done` 검토 시 V121~V130 구현 완료 + plan 이동(→ `complete/`) 여부를 체크리스트로 확인 |
| 3 | Rationale Continuity | `migrations.md` §5 의 CONCURRENTLY DROP-선행 불변식이 이번 target 문서(신규 Rationale 절·plan)에 재언급되지 않음 — 선례(V111~V120)가 강해 위반은 아님 | 신규 절 전체(SQL 미작성) vs `spec/conventions/migrations.md` §5 각주 | 조치 불요. `--impl-done` 게이트에서 V121~V130 10개 파일 전부가 이 패턴을 지키는지 기계적으로 대조 권고 |
| 4 | Convention Compliance | `migrations.md` §1의 가드 정규식 서술(`SQL_NAME_RE` vs `SQL_RE` 차이)이 실제 코드와 정확히 일치 — drift 없음 확인 | `spec/conventions/migrations.md` §1 (line 62) | 조치 불요(긍정 확인) |
| 5 | Convention Compliance | `cafe24-api-catalog/_overview.md`의 frontmatter 부재는 `spec-impl-evidence.md §1`의 `_*.md` 면제 대상 — 오탐 배제 | `spec/conventions/cafe24-api-catalog/_overview.md` | 조치 불요 |
| 6 | Plan Coherence | 트래커(`spec-draft-nullable-notation-followups.md`) 반영·draft `complete/` 이동은 구현 완료 후로 미룸 — draft 자체 체크리스트가 이미 이 순서를 관리 | `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 체크리스트 마지막 항목 | 조치 불요 |
| 7 | Naming Collision | `cafe24-api-catalog/_overview.md`에 이미 기록된 `privacy_*` prefix 혼동 우려(별 트랙 유예) — 실제 ID 충돌 0건, 이번 세션 신규 아님 | `spec/conventions/cafe24-api-catalog/_overview.md` §5 | 재론 대상 아님, 정보 제공용 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `migrations.md` 번호/CONCURRENTLY 절차 규약과 V121~V130 계획이 형태·순서 일치. `spec/1-data-model.md` §3 10개 인덱스 정의가 6개 data-flow 문서·plan 과 컬럼 단위로 완전 일치. V130 신규 인덱스와 기존 partial unique(V089) 는 이름·조건절이 달라 공존(충돌 아님) |
| Rationale Continuity | LOW | 신규 Rationale 절의 기준 교체가 정정 각주 동반(모범 사례). `plan/complete/` 순방향 인용과 CONCURRENTLY 불변식 재언급 부재는 --impl-prep→구현→--impl-done 흐름에서 통상 해소되는 미래 상태, 후속 게이트 체크리스트로 남김 |
| Convention Compliance | LOW | 실제 구현 직결 `migrations.md`는 코드(가드 정규식, V111~V120 선례)와 정확히 일치 — impl-prep 통과 가능. 다만 `migrations.md` Rationale 헤딩 위치가 corpus 유일 예외, conventions 절반가량 Overview 섹션 생략(기존 상태, 이번 작업과 무관) |
| Plan Coherence | NONE | V번호 할당·CONCURRENTLY 재실행 패턴·`mixed=true` 미도입 결정 모두 상위 트래커에 이미 확정·성문화. 동시 작업 충돌·미해결 결정 우회·후속 항목 누락 없음 |
| Naming Collision | NONE | 신규 식별자(V121~V130, 인덱스 이름 10개) 전수 grep — 기존 사용처 0건(draft 자기인용 1건 제외), 머지 race 없음(origin/main 여전히 6f97cb619) |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요) 이번 --impl-prep 게이트는 통과 가능. FK 인덱스 V121~V130 마이그레이션 구현에 착수해도 무방.
2. `--impl-done` 검토 시 다음 두 가지를 체크리스트로 확인: (a) V121~V130 10개 파일 전부가 `DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS` + `.conf`(`executeInTransaction=false`) 패턴을 지키는지, (b) 구현 완료 후 `plan/in-progress/spec-draft-fk-remaining-dispositions.md`가 `plan/complete/`로 이동해 `spec/1-data-model.md` Rationale 의 순방향 인용이 깨진 링크로 남지 않는지.
3. (기존 상태, 비긴급) `spec/conventions/migrations.md` §7의 Rationale 헤딩 표기를 corpus 관례(bare `## Rationale`, 종결 섹션)에 맞추거나 SKILL.md에 예외 명시 — 이번 작업 착수를 막지 않으므로 별도 후속 편집 기회에 처리.
