# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL·WARNING 없음. 공통 INFO 하나(§4.4 caveat 미기재)를 세
checker(cross_spec/rationale_continuity/plan_coherence)가 서로 다른 각도에서 지적했고,
convention_compliance·plan_coherence 는 완성도 성격의 INFO 로 개별 위험도를 LOW 로 매겼다.
`plan/in-progress/trigger-dup-delete.md` 의 --impl-prep 착수를 막을 사유는 없다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, plan_coherence (중복 수렴) | `spec/2-navigation/2-trigger-list.md` §4.4 "동시 삭제: 두 번째는 `404 RESOURCE_NOT_FOUND`" 가 caveat 없이 확정 사실처럼 서술돼 있으나, 실측 결과(`TriggersService.remove()`, `triggers.service.ts:1060-1107`) 현재 코드는 advisory lock 뒤 행 재조회 없이 바로 삭제해 두 요청 모두 204 + 중복 audit 행이 남는다. 직전 impl-done 게이트(`review/consistency/2026/09/20/21_21_21`)가 이미 이 gap 을 Warning 으로 지적했고 `plan/in-progress/spec-draft-nullable-notation-followups.md:4761-4769` 에 planner 항목 (b)로 등재돼 있다 | `spec/2-navigation/2-trigger-list.md` §4.4 (약 318행) | 차단 사유 아님 — `trigger-dup-delete.md` 가 정확히 이 gap 을 메우는 PR 이며 완료되면 자연 해소. 다만 tracker 항목의 (a)(`1-workflow-list.md`/`data-flow/12-workspace.md` 서술 누락, 별개 사안)와 (b)(이 §4.4 검증)가 한 체크박스에 묶여 있어, 이 PR 종결 시 (b)만 콕 집어 "e2e 실측 완료 — caveat 불필요" 로 명시 처분하고 (a)는 분리해 남겨둘 것을 권장 (실수로 항목 전체 `[x]` 처리되거나 (b) 해소가 묻히는 것을 방지) |
| 2 | cross_spec | `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 "(2026-09-10 — 재호출 실제 발생 여부 미확정)" 각주가 이번 target(`2-trigger-list.md` §2.3.1/§3, Chat Channel 관련 서술)과 코드 위치상 인접(같은 `update`/활성화 경로)하나 직접 모순은 아님 | `spec/2-navigation/2-trigger-list.md` §2.3.1, §3 vs `spec/5-system/15-chat-channel.md` §5.4.1 | 조치 불요 — 이번 PR 범위(`remove()`) 밖이며 이미 트래커가 추적 중. 중복 등재 금지 |
| 3 | convention_compliance | `GET /api/triggers/:id/history` 행이 형제 목록 endpoint(`GET /api/triggers`, `GET /api/schedules`)와 달리 응답 포맷(§5.2 페이징 vs 비-페이징 vs bare array) 인용이 없음. 실제 구현(`@ApiOkWrappedArrayResponse`)은 swagger 규약을 따르고 있어 실질 위반은 아니고 문서 완성도 문제 | `spec/2-navigation/2-trigger-list.md` §3 API 표 | 해당 행에 "최근 10건 고정 배열 — 페이지네이션 없음(`ApiOkWrappedArrayResponse`)" 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·RBAC·API 관행·감사 액션·Chat Channel 계약 전부 원문과 1:1 일치 확인(생략된 15개 파일은 직접 Read 로 보완). §4.4 gap 은 spec-spec 충돌이 아니라 spec-vs-구현 gap(INFO) |
| rationale_continuity | NONE | §3 "동시 쓰기 직렬화"(락 안 재읽기 후 0행 판정) 원칙을 이번 plan 이 삭제 경로에도 그대로 확장 적용 — 기각된 대안의 재도입·무근거 번복 없음. §4.4 caveat 미기재만 INFO |
| convention_compliance | LOW | 에러 코드·감사 액션·secret store 경계·Chat Channel 어댑터·DTO 명명·문서 3섹션 구조 전부 정합. `history` 응답 포맷 인용 누락만 INFO |
| plan_coherence | LOW | `trigger-dup-delete.md` 와 `spec-draft-nullable-notation-followups.md` 트래커가 §4.4 gap 에 대해 동일 결론 공유 — 정면 충돌 없음. 다만 트래커 체크박스 (a)/(b) 미분리로 종결 시 누락 위험 |
| naming_collision | NONE | `git diff origin/main -- spec/2-navigation` 빈 diff, `spec_impact: none` 과 일치. 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV·설정키·파일 경로 없음. 재사용 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)도 기존 정의 그대로 |

## 권장 조치사항

1. (BLOCK 해소 불필요 — BLOCK: NO) `plan/in-progress/trigger-dup-delete.md` 구현·impl-done 게이트를 정상 진행한다.
2. PR 종결 시 `plan/in-progress/spec-draft-nullable-notation-followups.md:4761-4769` 의 (b) 항목을
   "§4.4 실측 완료 — caveat 불필요" 로 명시 처분하고, (a) 항목은 분리해 별도로 남긴다(세 checker 수렴 INFO #1).
3. (선택, 완성도) `spec/2-navigation/2-trigger-list.md` §3 API 표의 `GET /api/triggers/:id/history` 행에
   응답 포맷("최근 10건 고정 배열, 페이지네이션 없음") 한 줄을 추가한다(convention_compliance INFO #3).
4. `15-chat-channel.md` 미확정 각주(INFO #2)는 이번 PR 범위 밖이므로 별도 조치 불요, 트래커 중복 등재 금지.
