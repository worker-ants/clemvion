# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

**대상 문서**: `spec/4-nodes/4-integration/5-makeshop.md`
**검토 일시**: 2026-06-03
**검토 모드**: `--spec`

---

## 전체 위험도

**MEDIUM** — Critical 1건(포트 테이블 컬럼 누락) + Warning 8건(frontmatter enum 위반·Node.type 미등재 포함). 즉각 운영 차단 리스크는 없으나 구현 착수 전 해소 필수.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | §3 포트 테이블에 `dynamic` 컬럼 누락 — Cafe24 §3 과 "동일" 선언하나 4컬럼 vs 5컬럼 불일치. 실행 엔진의 포트 스키마 파싱에 직접 영향. | `spec/4-nodes/4-integration/5-makeshop.md §3` 포트 테이블 | `spec/4-nodes/4-integration/4-cafe24.md §3` 포트 테이블 (`id\|label\|type\|dynamic\|설명`) | §3 포트 테이블에 `dynamic` 컬럼 추가, 값 `false` 로 명시하여 Cafe24 §3 과 일치시킨다. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | frontmatter `status: planned` — 허용 enum 외 값. `spec-frontmatter.test.ts` build-time 가드 위반 예상. | 문서 frontmatter `status: planned` | `spec/conventions/spec-impl-evidence.md §3` (허용 값: `backlog`/`spec-only`/`partial`/`implemented`/`archived`) | `status: spec-only` 로 수정. `pending_plans:` 에 `makeshop-integration.md` 등록. |
| 2 | Convention Compliance | frontmatter `code:` 필드 자체 누락. 파서 오류 가능. | 문서 frontmatter | `spec/conventions/spec-impl-evidence.md §2.1` | `code: []` 추가. |
| 3 | Cross-Spec | `spec/1-data-model.md §2.6` Node.type 전체 목록 표에 `makeshop` 미등재. 구현 시 DB Enum 마이그레이션 범위 불명확. | `spec/4-nodes/4-integration/5-makeshop.md §1` | `spec/1-data-model.md §2.6 Node.type 전체 목록` (`cafe24` 만 있고 `makeshop` 없음) | §2.6 integration 카테고리에 `makeshop` 행 추가. 마이그레이션 파일 `V05X__node_type_makeshop.sql` 체크리스트에 포함. |
| 4 | Cross-Spec | `spec/4-nodes/4-integration/0-common.md §7 출력 구조 색인` "Integration 4종" 표현 및 색인에 MakeShop 미포함. | `spec/4-nodes/4-integration/5-makeshop.md §5` | `spec/4-nodes/4-integration/0-common.md §7` ("Integration 4종" 명시) | `§7` "4종" → "Integration 노드"로 일반화, MakeShop 행을 `Planned` 상태로 추가. |
| 5 | Cross-Spec | OAuth 토큰 갱신 endpoint `auth.makeshop.com` — 공식 문서 미검증 상태로 §9.7 open question 목록에 미수록. | `spec/4-nodes/4-integration/5-makeshop.md §4 step 6, §9.1` | `spec/4-nodes/4-integration/5-makeshop.md §9.7 미확인 항목` | §9.7 에 "token refresh endpoint 호스트(`auth.makeshop.com`) 구현 전 재확인" 추가. |
| 6 | Cross-Spec | `spec/2-navigation/4-integration.md §9.3` catalog API — makeshop은 현재 "`:type='cafe24'`만 non-empty 반환" 대상이라 구현 시 spec-코드 불일치 발생. | `spec/4-nodes/4-integration/5-makeshop.md §4 step 11` | `spec/2-navigation/4-integration.md §9.3` 초기 응답 정책 | implemented 승격 시 §9.3 에 `makeshop` non-empty 반환 대상 추가. plan 체크리스트에 포함. |
| 7 | Rationale Continuity | §9.3 에서 `(workspace_id, shop_uid) UNIQUE` 로 표기 — 실제 컬럼명은 `mall_id`. 구현자 혼동 유발. | `spec/4-nodes/4-integration/5-makeshop.md §9.3` | `spec/1-data-model.md §2.10` Integration.`mall_id` 컬럼 정의 및 partial UNIQUE 인덱스 | §9.3 표현을 "`mall_id` 컬럼(`credentials.shop_uid` 재사용), `(workspace_id, mall_id) WHERE service_type='makeshop'` partial UNIQUE" 로 수정. |
| 8 | Cross-Spec | `spec/2-navigation/4-integration.md §13 데이터 모델 영향 요약`에 MakeShop 인덱스 미언급 (Cafe24 인덱스 V046은 명시됨). | `spec/4-nodes/4-integration/5-makeshop.md §9.3` | `spec/2-navigation/4-integration.md §13` | implemented 승격 시 §13 에 MakeShop partial UNIQUE 인덱스 항목(마이그레이션 번호 포함) 추가. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `0-common.md` 범위 서술에 cafe24·makeshop 미포함 | `spec/4-nodes/4-integration/0-common.md` 서두 | "통합 카테고리 노드 전반"으로 일반화하거나 makeshop 명시 추가 |
| 2 | Cross-Spec | `0-common.md §5` 캔버스 요약 색인 테이블에 MakeShop 미등재 | `spec/4-nodes/4-integration/0-common.md §5` | implemented 승격 시 `makeshop \| {{resource}} · {{operation}} \| Planned` 행 추가 |
| 3 | Cross-Spec | `spec/1-data-model.md §2.10.1` `api_label` 설명에 makeshop 미언급 (cafe24만 예시) | `spec/1-data-model.md §2.10.1`, `spec/2-navigation/4-integration.md §9.3` | implemented 승격 시 `makeshop = 'makeshop.<resource>.<operation>'` 추가 |
| 4 | Cross-Spec | `spec/2-navigation/4-integration.md §2.3` 서비스 유형 칩·`§2.5` Add Integration 모달에 MakeShop 미반영 | `spec/2-navigation/4-integration.md §2.3, §2.5` | implemented 승격 시 MakeShop 칩/카드 추가. `§5.9` credentials JSONB 스키마 섹션도 신설. |
| 5 | Cross-Spec | `spec/2-navigation/4-integration.md §10.3` provider별 설정 표에 MakeShop OAuth endpoint 미등재 | `spec/2-navigation/4-integration.md §10.3` | implemented 승격 시 MakeShop 행 추가. token endpoint는 target §9.1이 단일 진실. |
| 6 | Cross-Spec | `spec/0-overview.md §6.3` → `spec/2-navigation/4-integration.md#59-makeshop` 앵커 현재 미존재 (dead link) | `spec/0-overview.md §6.3` | §5.9 섹션 추가 전까지 링크를 "(Planned, 추가 예정)"으로 표기하거나 제거 |
| 7 | Cross-Spec | `spec/2-navigation/4-integration.md §9.1` `autoRefresh` 설명에 makeshop 미언급 | `spec/2-navigation/4-integration.md §9.1` | implemented 승격 시 makeshop 추가 |
| 8 | Rationale Continuity | `INTEGRATION_SERVICE_UNAVAILABLE` 에러 코드 — Cafe24 §6 에 있으나 MakeShop §6 미수록 | `spec/4-nodes/4-integration/5-makeshop.md §6` | `MAKESHOP_SERVICE_UNAVAILABLE (D4)` 행 추가 또는 공통 §4.2 로 이동 |
| 9 | Rationale Continuity | `meta.callUsage`/`meta.callRemain` 필드 — "5필드 동일" 선언이나 MakeShop §5.1 표에서 미명시 | `spec/4-nodes/4-integration/5-makeshop.md §5.1` | `meta.callUsage?`/`meta.callRemain?` 항목을 "rate-limit 헤더 미확인(§9.7)" 주석과 함께 추가 |
| 10 | Rationale Continuity | cursor pagination 폐기 근거 미언급 (Cafe24 §1은 명시) | `spec/4-nodes/4-integration/5-makeshop.md §1` | §9.7 에 "cursor-based pagination 지원 여부 catalog 확인 후 결정" 추가 |
| 11 | Convention Compliance | §5.3 (에러 케이스) 출력 JSON 예시 블록 누락 (node-output.md Principle 11) | `spec/4-nodes/4-integration/5-makeshop.md §5.3` | `output.error.{code,message,details}` JSON 예시 블록 추가 |
| 12 | Convention Compliance | §4 "6단계 계약을 따른다" 선언이나 실제 12단계 — 대응 관계 미명시 | `spec/4-nodes/4-integration/5-makeshop.md §4` | "공통 계약 기반 세부 실행 흐름 12단계"로 문구 수정하거나 매핑 표 추가 |
| 13 | Convention Compliance | §8.1 도구 이름 매핑 표 2행 `resource='cart'(cpik)` — 유효 resource enum은 `cpik` | `spec/4-nodes/4-integration/5-makeshop.md §8.1` | `resource='cart'(cpik)` → `resource='cpik'` 로 수정 |
| 14 | Convention Compliance | §2 "catalog의 `planned` 행 표기 정책" 참조 — MakeShop catalog에는 status 컬럼 미보유 | `spec/4-nodes/4-integration/5-makeshop.md §2` | "(구현 착수 시 status 컬럼 도입 후 적용 — 현재 catalog 미보유)" 주석 추가 |
| 15 | Plan Coherence | plan 체크박스 7건 미완 — staged 상태로 실제 편집은 완료됨 | `plan/in-progress/makeshop-integration.md` | 편집 완료 확인 후 체크박스 `[x]` 표시 |
| 16 | Plan Coherence | cafe24-backlog-residual.md C-6 체크박스 미완 — 구현 PR 완료 시 닫아야 함 | `plan/in-progress/cafe24-backlog-residual.md` C-6 | 구현 PR 완료 시 `→ resolved by makeshop-integration PR` 주석과 함께 닫기 |
| 17 | Naming Collision | `spec/1-data-model.md §2.6` Node.type 표에 `makeshop` 미등재 (spec/4-nodes/0-overview.md 에는 등재됨) | `spec/1-data-model.md §2.6` | `makeshop` 행 추가 (W-3번과 동일 항목 — 통합 조치) |
| 18 | Naming Collision | `spec/1-data-model.md §2.10.1` `api_label` 설명에 makeshop 미명시 | `spec/1-data-model.md §2.10.1`, `spec/2-navigation/4-integration.md §9.1` | INFO-3번과 동일 항목 — 통합 조치 |

> NOTE: INFO-17, INFO-18은 각각 WARNING-3, INFO-3과 동일 항목을 다른 checker 각도에서 지적한 것으로, 최강 등급으로 통합 처리됨 (중복 제거).

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | §3 포트 테이블 `dynamic` 컬럼 누락(CRITICAL) + Node.type Enum 미등재·0-common §7 불완전·catalog API 정책 불일치(WARNING) |
| Rationale Continuity | LOW | `mall_id`/`shop_uid` 컬럼명 표기 혼동(WARNING) + 에러 코드·rate-limit 메타·cursor pagination 근거 미수록(INFO) |
| Convention Compliance | MEDIUM | frontmatter `status: planned` enum 위반 + `code:` 누락(WARNING, build gate 위반) + §5.3 JSON 예시 누락·단계 수 불일치·오기(INFO) |
| Plan Coherence | NONE | 발견사항 전부 INFO. plan 체크박스 미완(실제 편집 완료), C-6 연동 시점 관리만 후속 필요 |
| Naming Collision | NONE | CRITICAL/WARNING 0건. data-model Node.type 표·api_label 동기화 2건만 INFO |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시)** `spec/4-nodes/4-integration/5-makeshop.md §3` 포트 테이블에 `dynamic` 컬럼 추가, 값 `false` 명시.
2. **(BLOCK 해소 — 즉시)** frontmatter `status: planned` → `status: spec-only` 수정, `code: []` 필드 추가. `pending_plans: [makeshop-integration]` 등록.
3. **(구현 착수 전 권장)** §9.3 `(workspace_id, shop_uid) UNIQUE` 표현 → `mall_id` 컬럼 기반 표현으로 보정.
4. **(구현 착수 전 권장)** `spec/1-data-model.md §2.6` Node.type 표에 `makeshop` 행 추가. `spec/4-nodes/4-integration/0-common.md §7` "4종" 표현 일반화 및 MakeShop Planned 행 추가.
5. **(구현 착수 전 권장)** §9.7 미확인 항목에 ① token refresh endpoint 재확인, ② cursor pagination 지원 여부 항목 추가.
6. **(구현 착수 전 권장)** §8.1 도구 이름 매핑 표 `resource='cart'(cpik)` → `resource='cpik'` 수정.
7. **(구현 착수 전 권장)** §2 catalog `planned` 행 참조에 "status 컬럼 미보유" 주석 추가. §5.3 에 에러 케이스 JSON 예시 블록 추가.
8. **(implemented 승격 시)** `spec/2-navigation/4-integration.md §9.3` makeshop non-empty catalog 반환 추가, §10.3 MakeShop OAuth provider 행 추가, §13 인덱스 항목 추가, §2.3·§2.5 서비스 유형 칩/카드 추가.
9. **(PR 완료 시)** plan 체크박스 7건 `[x]` 표시. `cafe24-backlog-residual.md` C-6 완료 처리.
10. **(부수 정리)** stale worktree 14건 정리 — `./cleanup-worktree-all.sh --yes --force` 실행 권장 (모두 MERGED PR).