# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 2건(서로 다른 checker 에서 동일 사안 지적), INFO 다수. Critical 위배 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision / Cross-Spec (통합) | `order/orders.md` 응답 래퍼 `order` 행 설명이 `_overview.md §7.3` 에서 회귀 검증 예시로 명시됐음에도 이번 diff 에서 미수정 — "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" 오염값 잔존 | `spec/conventions/cafe24-api-catalog/order/orders.md` line 839, 1400 | `spec/conventions/cafe24-api-catalog/_overview.md §7.3` 신규 bullet, `appstore-orders.md` fix 와 불일치 | `order/orders.md` line 839, 1400 의 `order` 행 설명을 `(응답 객체)` 로 정정. 동일 패턴이 있는 `store/orders-setting.md` 등 최소 8개 파일도 후속 PR 에서 일괄 처리 |
| 2 | Convention Compliance | `application.md` 인덱스 표에서 `restricted` 컬럼 누락 — `applications_list`, `webhooks_list` 두 row 의 "미검증 seed" 상태가 footnote 에만 의존 | `spec/conventions/cafe24-api-catalog/application.md` §표 | `spec/conventions/cafe24-api-catalog/_overview.md §2` 컬럼 정의 (선택 컬럼이므로 규약상 허용 범위) | 규약 위반은 아니나 `restricted` 컬럼 또는 `status` 값 확장으로 비정상 seed 상태를 표 컬럼 수준에서 포착하는 방안을 향후 규약 갱신 시 고려 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `_generator.py` 버그 수정 후 동일 `order` 래퍼 버그가 `order/orders.md`, `store/orders-setting.md` 등 최소 8개 field-level 파일에 잔존 — `_overview.md §7.3` 이 "수동 회귀 검증 대상"으로 인지·명시 | `spec/conventions/cafe24-api-catalog/` 하위 8개+ field-level 파일 | 생성기 재생성 또는 후속 PR 에서 일괄 처리. `cafe24-backlog-residual.md` backlog 추적 항목 추가 권장 |
| 2 | Rationale Continuity (통합 #3) | `_overview.md` 에 `## Rationale` 섹션 미존재 — 이번 결정("컨테이너에 cross-map fallback 제외" 근거)이 `_generator.py` 주석·§7.3 불릿에만 분산 기록 | `spec/conventions/cafe24-api-catalog/_overview.md` | `## Rationale` 섹션 추가, `R-7.3` 항 등재. 또는 index/layout 파일 Rationale 면제 규칙을 CLAUDE.md 에 명시 (필수 아님) |
| 3 | Convention Compliance | `_overview.md §4` 규칙 번호와 `catalog-sync.spec.ts` 테스트 헤더 주석 번호 off-by-one (규칙8 vs "규칙7") — 규약 파일 자체에 경고 명시됨 | `spec/conventions/cafe24-api-catalog/_overview.md §4` | `catalog-sync.spec.ts` 헤더 주석을 "규칙7" → "규칙8" 로 정정하거나 spec 경고 주석 제거하여 번호 일치 |
| 4 | Convention Compliance | `application/appstore-orders.md` Operation 제목 "Retreive" 오탈자 — Cafe24 공식 docs anchor 원본 오탈자 그대로 반영한 정상 동작 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 헤더 | 변경 불필요. Cafe24 docs 오탈자 수정 시 재생성. `cafe24-backlog-residual.md §G-2` 에 "docs anchor 오탈자 확인" 항목 추가 권장 |
| 5 | Convention Compliance | `category/categories__decorationimages.md` 등 이중 밑줄(`__`) 파일명이 `_overview.md §7.1` 에 미정의 | `spec/conventions/cafe24-api-catalog/category/` 하위 파일 | `_overview.md §7.1` 에 "sub-resource 다단계 경로 `/` → `__` 치환" 패턴 1줄 추가 |
| 6 | Convention Compliance | field-level 파일 frontmatter `source` 필드 값 형식이 규약에 미정의 — de facto 표준 존재하나 미명시 | 모든 field-level 파일 frontmatter | `_overview.md §7.1` 에 각 frontmatter 필드 예시값/허용 형식 추가 |
| 7 | Plan Coherence | `cafe24-backlog-residual.md §G-1-remaining` 착수 시 본 수정 병합 후의 최신 main 기준 사용 필요 — 추적성 향상 위해 plan 노트 추가 권장 | `plan/in-progress/cafe24-backlog-residual.md §G-1-remaining` | G-1-remaining 에 "컨테이너 래퍼 설명 오염 버그 수정 PR 병합 후 최신 main 기준 진행" 짧은 노트 추가 (필수 아님) |
| 8 | Plan Coherence | `plan/in-progress/fix-spec-frontmatter-catalog.md` 삭제 여부 미확인 — `plan/complete/` 이동 시 원본 파일도 함께 제거해야 완전한 이동 | `plan/in-progress/fix-spec-frontmatter-catalog.md` | PR merge 전 `in-progress/` 원본 삭제(또는 `complete/` 통합) 확인 |
| 9 | Naming Collision | `resp_param_rows` 코드 심볼이 `_overview.md §7.3` 에 직접 노출 — generator 리팩터링 시 spec 문서도 함께 갱신 필요한 결합 생성 | `spec/conventions/cafe24-api-catalog/_overview.md §7.3`, `_generator.py` line 353 | 현상 유지 허용. generator 리팩터링 시 spec 문서 동시 갱신 필요성 주석/TODO 추가 |
| 10 | Naming Collision | `store.md` 의 `privacy_*` operation ID 와 `privacy.md` resource prefix 잠재 혼동 — 기 인지된 사항, 이번 diff 와 무관 | `spec/conventions/cafe24-api-catalog/store.md` line 85-90 | 별도 follow-up 트랙에서 처리. 이번 검토 차단 사유 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `order/orders.md` 등 field-level 파일 잔존 버그 INFO, `_overview.md §7.3` 이 인지·명시. Cross-spec 블로커 없음 |
| Rationale Continuity | NONE | 3건 변경 모두 기존 §7.2 원칙과 정합. `_overview.md` Rationale 섹션 부재 INFO |
| Convention Compliance | LOW | WARNING 1건(`restricted` 컬럼 누락, 규약상 허용 범위). INFO 5건(Rationale 부재, off-by-one 번호, 오탈자, 이중밑줄 미정의, frontmatter 형식 미정의) |
| Plan Coherence | NONE | plan 충돌 없음. `in-progress/` 원본 삭제 확인 및 G-1-remaining 노트 추가 INFO |
| Naming Collision | LOW | WARNING 1건(`order/orders.md` 응답 래퍼 미수정). INFO 2건(코드 심볼 결합, privacy prefix 혼동) |

## 권장 조치사항

1. **(WARNING 해소 — 권장)** `order/orders.md` line 839, 1400 의 `order` 응답 래퍼 행 설명을 `(응답 객체)` 로 정정. 이번 diff 에서 `appstore-orders.md` 를 정정하고 `_overview.md §7.3` 에 `order/orders.md` 를 회귀 검증 예시로 명시한 이상, 해당 파일도 동일 PR 또는 직후 PR 에서 수정하는 것이 일관성 측면에서 바람직함. 동일 패턴의 `store/orders-setting.md` 등도 일괄 처리 권장.
2. **(INFO — 선택)** `plan/in-progress/fix-spec-frontmatter-catalog.md` 삭제 여부를 PR merge 전 확인 (plan-lifecycle 규약 준수).
3. **(INFO — 선택)** `_overview.md §7.1` 에 이중 밑줄 파일명 치환 패턴 1줄 추가 (`/` → `__`).
4. **(INFO — 선택)** `catalog-sync.spec.ts` 헤더 주석 번호 off-by-one 정정 ("규칙7" → "규칙8").
5. **(INFO — 선택)** `_overview.md` 끝에 `## Rationale` 섹션 추가 (결정 근거 spec 내 추적 가능화).
