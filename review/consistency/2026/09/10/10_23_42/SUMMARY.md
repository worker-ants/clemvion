# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 전문을 확보했고 Critical 발견은 0건이다.

## 전체 위험도
**LOW** — 4개 checker 는 NONE, `plan_coherence` 가 자매 plan stale 화 WARNING 1건을 보고해 통합 위험도를 LOW 로 올린다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | C-2 가 `spec-draft-nullable-notation-followups.md` 체크박스만 플립하고, 같은 항목(같은 필드·같은 절·같은 저장 형태 사실)을 독자적으로 들고 있는 `plan/in-progress/spec-draft-notification-secret-storage.md` §「후속 (이 PR 밖)」 마지막 bullet(INFO#2, `1-data-model.md §2.8` 저장 형태 한 줄)을 갱신하지 않는다 | `plan/in-progress/spec-draft-doc-precision-batch-c.md` C-2 | `plan/in-progress/spec-draft-notification-secret-storage.md` (동일 날짜 2026-09-05, 동일 근거 INFO#2로 별도 등재) | C-2 실행 시 `spec-draft-notification-secret-storage.md` 해당 bullet 도 취소선/완료 표시로 동기화. 그 결과 이 plan 의 잔여 미해결 항목이 `4-integration.md §9.1` 포인터 하나뿐이 되면 `plan/complete/` 이관 여부도 그 자리에서 판정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | C-1 각주가 표 마지막 행 바로 뒤 블록쿼트로 들어가면, 표 직후 기존 설명 문단과 신규 블록쿼트가 연달아 붙어 "어느 것이 채택 행 각주이고 어느 것이 표 전체 설명인지" 시각 경계가 흐려질 수 있음(GFM 문법 자체는 안 깨짐) | `1-data-model.md ## Rationale` 채택 행 | 실제 편집 시 diff 렌더링을 눈으로 한 번 더 확인 |
| 2 | convention_compliance | C-4 draft 표의 `code:` 경로가 `…/` 축약형 — 실제 frontmatter 반영 시 레포 루트 기준 전체 경로(`codebase/backend/src/repo-guards/__tests__/fixtures/...`)로 펼쳐야 함 | C-4 "변경안" 표 | draft 단계는 문제 아님. 실제 편집 시 전체 경로 사용 재확인 (`--impl-done` 재검증 체크리스트가 갭을 잡아줌) |
| 3 | convention_compliance | C-4 신규 등재 항목이 전부 "대조군(negative fixture)" 성격인데, `review-citations.md` 선례(`# 준수 예시`/`# 시행 코드` 인라인 YAML 주석)와 달리 성격 구분 주석이 없음 | C-4 "변경안" 표 전체 | 강제 아님. 실제 편집 시 `# 대조군(negative fixture) — <가드 이름> 이 강제하는 위반 형태의 실례` 류 인라인 주석 부기 권장 |
| 4 | convention_compliance | C-4 는 `spec/2-navigation/**` frontmatter 에 `repo-guards/__tests__` 를 등재하는 첫 사례(현재 `2-api-convention.md` 만 선례 보유) | C-4 `2-navigation/2-trigger-list.md` 행 | 근거(`3-error-handling.md:234` SoT 위임 문구) 실측 확인됨. 별도 조치 불요 |
| 5 | naming_collision | "쿼리 범위 `select` 투영"(채택안) vs "컬럼 `select: false`"(기각안) 대비 문구를 후속 배치·타 spec 재인용 시에도 동일하게 유지 권고 | `1-data-model.md ## Rationale` 채택 행 각주 | 현재 문안이 이미 대비 표 포함, 별도 조치 불요 — 향후 재인용 시 동일 문구 재사용 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | C-1~C-5 전부 기존 spec/코드 실측값에 맞춘 정밀화, 새 엔티티/API/요구사항 ID 도입 없음. INFO 1건(각주 렌더링 시각 경계) |
| rationale_continuity | NONE | 5건 모두 기존 `## Rationale` 원문(1-data-model.md, secret-store.md, swagger.md 등)을 정확히 인용하며 기각 대안 재도입·번복 없음 |
| convention_compliance | NONE | `spec-impl-evidence.md`/`swagger.md`/`secret-store.md` 규약과 정합. C-4 는 오히려 "넓은 글롭 무효" 위반을 스스로 닫는 조치. INFO 3건 |
| plan_coherence | LOW | C-1·C-3·C-4·C-5 는 `spec-draft-nullable-notation-followups.md` 체크박스와 정확 대응. C-2 는 자매 plan(`spec-draft-notification-secret-storage.md`) 동기화 누락 — WARNING 1건 |
| naming_collision | NONE | 신규 요구사항 ID·엔티티·API·이벤트명·ENV 키 도입 없음. 전부 기존 식별자 재사용/재배치. INFO 1건(용어 대비 유지 권고) |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) C-2 실행 시 `plan/in-progress/spec-draft-notification-secret-storage.md` §「후속 (이 PR 밖)」의 해당 bullet 을 취소선/완료 표시로 동기화하고, 그 plan 의 잔여 항목이 0건에 수렴하면 `plan/complete/` 이관 여부를 판정한다.
2. C-4 실제 편집 시 `code:` glob 을 레포 루트 기준 전체 경로로 펼치고, 대조군 성격을 구분하는 인라인 YAML 주석(`# 대조군(negative fixture) — ...`)을 `review-citations.md` 선례에 맞춰 부기하는 것을 고려한다.
3. C-1 각주 삽입 후 diff 렌더링을 육안으로 한 번 더 확인해 표-각주 시각 경계를 점검한다.
