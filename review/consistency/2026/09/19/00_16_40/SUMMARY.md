# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보, 재시도 필요 없음.

## 전체 위험도
**LOW** — Critical/충돌 없음. 유일한 실질 항목은 plan_coherence 의 WARNING 1건(트래커 문서 staleness)이며 구현 착수를 막지는 않는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md`)가 이미 결정·구현된 "웹훅 트리거 조회가 endpoint_path 인덱스 전체를 훑는다" 항목을 여전히 미체크·"결정 필요"(폐기된 두 선택지 프레이밍)로 서술 | `spec/2-navigation/2-trigger-list.md` §2.3.1(`endpointPath` 행)·§3(PATCH 註, `(endpoint_path) UNIQUE(전역…)`) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4632-4637` | 4632행 체크박스 `[x]`로 갱신 + 결정·근거 링크(`spec-draft-webhook-endpoint-path-global-unique.md`, `spec/1-data-model.md` Rationale) 추가, "지운 웹훅 경로 재등록(묘비 부재)" 신규 항목 등재. draft plan 자신이 예고한 "트래커 반영" 스텝이므로 developer 턴(V131/V132 구현) 착수 전 마무리 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `2-trigger-list.md` frontmatter 의 `pending_plans:`/`code:` 순서가 스키마 예시·형제 문서(`1-workflow-list.md`)와 다름(기능 영향 없음) | `spec/2-navigation/2-trigger-list.md` frontmatter | 다음 편집 시 `code:` 를 `pending_plans:` 앞으로 이동해 정렬 |
| 2 | plan_coherence | draft plan 자체 체크리스트 `S1~S10 반영` 이 실제로는 `eb5332b57` 커밋에 전부 반영됐음에도 미체크 | `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` | `- [x] S1~S10 반영`으로 갱신(다음 커밋에 함께 반영 가능) |
| 3 | plan_coherence | `2-trigger-list.md` §2.3.1 의 "별 plan `eia-trigger-edit-ui`" 참조가 dangling(사전 존재 결함, 금번 변경과 무관) | `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스 | 후속 spec 정리 시 실제 완료 이력으로 교체 또는 제거(우선순위 낮음) |
| 4 | naming_collision | V131/V132 마이그레이션 번호를 구현 착수 시점에 병렬 세션이 먼저 점유할 표준적 경합 위험(현재는 충돌 없음 확인) | 착수 예정 `V131__trigger_endpoint_path_dedupe.sql` / `V132__trigger_endpoint_path_global_unique.sql` | draft 체크리스트에 이미 명시된 `check-migration-versions.py --base origin/main` 재확인을 착수 직전 실행 |
| 5 | cross_spec / rationale_continuity / convention_compliance | endpoint_path 전역 유일화 서술이 `1-data-model.md`·`5-system/12-webhook.md`·`5-system/2-api-convention.md`·`5-system/3-error-handling.md`·`data-flow/10-triggers.md`·`7-channel-web-chat/5-admin-console.md` 8개 문서·409 wire 계약·인덱스명·마이그레이션 번호 전반에서 정합함을 실측 확인(조치 불요, 기록용) | 위 6개 spec 파일 + `triggers.service.ts`/`triggers.controller.ts` | 없음 — 그대로 진행 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | endpoint_path 전역 유일 서사가 8개 문서에서 모두 일치, 409 wire 계약 불변, V131/V132 번호·인덱스명 충돌 없음, chat-channel 닫힌 열거 비침해 |
| Rationale Continuity | NONE | 2026-09-18 결정(`1-data-model.md` Rationale)의 세 처방(전역 UNIQUE·최초생성자 우선·NOTICE-only)을 착수 계획이 그대로 따름, 기각 대안 재도입 없음, 옛 인덱스 이름 실측 일치 |
| Convention Compliance | NONE | 에러코드/감사액션/DTO 명명·details 형태 전부 규약 SoT 와 일치, `TRIGGER_ENDPOINT_PATH_CONFLICT` rename 안 한 것도 규약 준수. frontmatter 키 순서 INFO 1건만 |
| Plan Coherence | LOW | 트래커(`spec-draft-nullable-notation-followups.md`) 미반영 WARNING 1건(폐기된 두 선택지 프레이밍 잔존) + 체크리스트 staleness INFO 2건 |
| Naming Collision | NONE | 신규 식별자(V131/V132, `idx_trigger_endpoint_path`) 전수 대조 결과 충돌 없음, 관련 에러코드/상수는 신설이 아닌 의미 확장 재사용 |

## 권장 조치사항
1. (WARNING 해소 우선) `plan/in-progress/spec-draft-nullable-notation-followups.md:4632-4637` 체크박스를 `[x]`로 갱신하고 근거 링크 추가 + "지운 웹훅 경로 재등록(묘비 부재)" 신규 항목 등재 — V131/V132 구현 착수 전
2. `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 체크리스트 `S1~S10 반영` 을 `[x]`로 갱신
3. `2-trigger-list.md` frontmatter 키 순서(`code:`/`pending_plans:`) 다음 편집 시 정렬
4. 구현 착수 직전 `check-migration-versions.py --base origin/main` 재확인(draft 체크리스트 항목)
5. (저우선, 별건) `eia-trigger-edit-ui` dangling plan 참조 후속 정리
