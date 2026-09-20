# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 없음. `plan/in-progress/schedule-cron-flake.md`(spec_impact: none)는 `schedule-trigger.e2e-spec.ts` 「D. PATCH cron → nextRunAt 재계산」 케이스의 cron 리터럴·단언만 바꾸는 테스트 전용 수정이며, 서비스 코드·spec 문서를 건드리지 않는다.

## 전체 위험도
**LOW** — 실질 위반은 spec 내부 기존(pre-existing) 상태 불일치 1건(WARNING)뿐이며, 이번 작업(cron e2e 비교식 수정)과는 인과관계가 없다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | 요구사항 카탈로그 `NAV-WF-02`(마지막 실행 시간·생성일 컬럼)가 `✅`(구현완료)로 표시되지만 상세 spec 은 두 컬럼 모두 "미구현(Planned)"이라 명시 — 현재 컬럼은 마지막 *실행*이 아닌 마지막 *수정*(`updatedAt`) 기준. 같은 표의 `NAV-WF-06`(폴더/태그 정리, 권장)도 "폴더 관리 UI는 아직 없음(필터 조회 전용)"과 상태 불일치, 다만 더 약한 근거 | `spec/2-navigation/_product-overview.md` §3.1 표(NAV-WF-02, NAV-WF-06 행) | `spec/2-navigation/1-workflow-list.md` §2.1 컬럼표 + 각주, §3.1 폴더 관리 서술 | `_product-overview.md` 의 `NAV-WF-02` 문구를 실제 구현(수정 시각만 표시)에 맞게 정정하거나 상태를 🚧/조건부로 낮추고, "마지막 실행 시간"·"생성일"은 별도 Planned 요구사항으로 분리. `NAV-WF-06` 은 "필터"와 "관리"를 구분해 문구 다듬기. 어느 표가 stale 인지 project-planner 턴에서 확정 (pre-existing, 이번 작업과 무관) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | Folder 리소스가 중앙 RBAC "리소스별 권한 매트릭스" 표에 행으로 없음 (Workflow 권한 상속으로 실제 모순은 아님) | `spec/5-system/1-auth.md` §3.2 vs `spec/2-navigation/1-workflow-list.md` §3.1 | §3.2 각주에 "Folder 는 Workflow 권한을 상속" 한 줄 추가 (선택) |
| 2 | Convention Compliance | `spec/2-navigation/` 디렉터리 파일 번호 결번(12번 없음, 0~11→13). 정렬 보장 자체는 안 깨져 규약 직접 위반은 아님 | `spec/2-navigation/` 디렉터리 목록 | 위생 사항, 급하지 않음 — 재배열 시 메우거나 `_layout.md`에 의도 명시 |
| 3 | Plan Coherence | `--impl-prep` scope 가 디렉터리 전체라 이번 작업과 무관한 기존 WARNING 3건(폴더/이력 API 응답 형태 미기재, stale `pending_plans`)이 함께 딸려옴 — 전부 `spec-draft-nullable-notation-followups.md`에 이미 개별 추적 중, 이번 작업의 원인도 해소 의무도 아님 | scope 메커니즘 자체(§O 트래커 처방 대상) | 조치 불요 — 이미 별도 planner 백로그 |
| 4 | Plan Coherence | `3-schedule.md` Rationale 이 인용하는 plan 경로가 `plan/in-progress/spec-sync-schedule-gaps.md` 를 가리키나 실제로는 `plan/complete/`로 이미 이관됨(서술 내용 자체는 참) | `spec/2-navigation/3-schedule.md` `## Rationale` | 경로만 `plan/complete/spec-sync-schedule-gaps.md` 로 갱신 (선택, 이번 체크리스트에 끼워 넣을 필요 없음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `NAV-WF-02`(및 약하게 `NAV-WF-06`) 요구사항 카탈로그 상태(✅)가 상세 spec 의 자기 서술(미구현)과 불일치 — pre-existing, 이번 e2e 수정과 무관 |
| Rationale Continuity | NONE | 기각된 대안 재도입·원칙 위반·무근거 번복·암묵 가정 충돌 4관점 모두 위반 없음. 오히려 기존 관례(e2e 는 구현을 고정, 판별력은 뮤턴트로 검증)를 그대로 따름 |
| Convention Compliance | NONE | 에러코드·DTO명명·감사액션·advisory-lock 키·secret 마스킹·i18n·문서 3섹션 구조 전부 규약 원문과 일치. 유일한 지적은 파일번호 결번 INFO 1건 |
| Plan Coherence | NONE | 대상 plan 은 기존 트래커 항목의 실행일 뿐이며 활성 결정과 충돌 없음. 딸려온 WARNING 3건은 전부 별도 추적 중 |
| Naming Collision | NONE | 신규 요구사항ID·엔티티·DTO·endpoint·이벤트·ENV·파일경로 어느 축으로도 신규 식별자 도입 없음 |

## 권장 조치사항
1. `schedule-cron-flake.md` 착수 진행 가능 — BLOCK 사유 없음, spec_impact: none 그대로 유효.
2. (별도 planner 백로그, 비차단) `_product-overview.md` `NAV-WF-02`/`NAV-WF-06` 상태 문구를 상세 spec 의 실제 구현 상태에 맞게 정정 — 이번 작업 체크리스트에는 불필요.
3. (선택, INFO) `5-system/1-auth.md` §3.2 에 Folder 권한 상속 각주 추가.
4. (선택, INFO) `3-schedule.md` Rationale 의 plan 경로를 `plan/complete/spec-sync-schedule-gaps.md` 로 갱신.
5. (선택, INFO) `spec/2-navigation/` 파일 번호 12 결번은 다음 재배열 시 정리.
