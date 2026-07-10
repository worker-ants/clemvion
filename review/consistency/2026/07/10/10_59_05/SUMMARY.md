# Consistency Check 통합 보고서 (--spec) — **BLOCK: NO**

target: `plan/in-progress/expr-autocomplete-table-rows.md` (§7.1/§8.4.2 Table 컨텍스트 트리거 행 문서화).
5 checker 중 naming_collision 만 디스크 기록, 나머지 4개는 FS-flakiness 로 미기록 → **journal.jsonl(authoritative)에서 복구**해 전수 확보.

## 판정
- **BLOCK: NO** — Critical 0. 순수 additive 문서 변경(코드·런타임 무변). WARNING 3·INFO 다수는 반영 시 정정.

## Critical
없음.

## WARNING (복구) — 반영에 정정 반영
| # | Checker | 위배 | 처분 |
|---|---|---|---|
| 1 | cross_spec | `table.md` §1(field·label 평가 시 `$sourceItem`/`$sourceItemIndex`/`$dataSource` 3변수 제공) ↔ §4 step7(label 평가는 `$dataSource` 만) 내부 불일치. 내 note 가 "컬럼 표현식" 으로 뭉뚱그리면 확산 | **내 note 를 "에디터 자동완성 노출(isTableContext)" 관점으로 한정**하고 런타임 가용범위는 §4.1·table.md cross-ref(field/label 미주장). table.md §1↔§4 불일치는 **별도 follow-up 분리**(table 도메인 소관, spawn_task) |
| 2 | plan_coherence | `suggestions-prefix-dry.md §후속` 의 "§7.1/§8.4.2 표에 $sourceItem/$dataSource 행" 항목을 본 작업이 해소하나 갱신 단계 누락 | 워크플로에 "suggestions-prefix-dry 후속 갱신" 추가 |
| 3 | convention_compliance | §8.4.2 트리거 열에 `(Table 노드 한정)` 주석 삽입 → 트리거 열=리터럴만 관례 위반(§7.1 은 동작 열에 넣어 정합) | `(Table 노드 한정)` 을 §8.4.2 "제안 내용" 열로 이동, 트리거 열은 리터럴만 |

## INFO — 처분
- rationale_continuity: §7.1 note 가 §4.1 L185 재서술 → **cross-ref 링크**로 변경(drift 방지).
- convention_compliance: §7.1 note `§4.1` cross-ref 링크 스타일 통일 → 링크화 반영.
- naming_collision(2): `sourceItemSample`·`$sourceItem` 등 전부 기존 코드·§4.1 재인용, 신규 식별자·충돌 없음 — 무조치.

## Checker별 (journal 복구)
| Checker | 판정 | 비고 |
|---|---|---|
| cross_spec | WARNING | table.md §1↔§4 pre-existing 불일치 확산 우려 → 관점 한정 + 별도 follow-up |
| rationale_continuity | INFO | §7.1 note §4.1 중복 → cross-ref |
| convention_compliance | INFO×2 | §8.4.2 트리거 열 주석·§7.1 링크 스타일 |
| plan_coherence | WARNING | suggestions-prefix-dry 후속 갱신 단계 |
| naming_collision | NONE | 신규 식별자·충돌 없음(디스크 기록됨) |

→ spec 반영 진행(BLOCK:NO + WARNING/INFO 정정 반영, table.md 불일치는 spawn_task 분리).
