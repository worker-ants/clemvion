# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 발견된 WARNING 은 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 기존 개방 항목의 재확인이며, 이번 PR(`user-entity-column-defense`)이 신규로 만든 결함이 아니다.

## 전체 위험도
**LOW** — `spec/2-navigation/` 델타는 0(코드 전용 PR). 실제 diff(User 엔티티 시크릿 컬럼 노출 방어 + trigger endpoint_path 409 처리 + workflow-version creator 투영)는 target spec 이 이미 선언한 계약을 그대로 구현했고 신규 위반이 없다. 남은 WARNING 은 전부 `2-trigger-list.md` 자체의 기존 내부 모순으로, developer 권한 밖이라 정상적으로 planner 이월 상태.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 이 없으므로 인계 대상 없음. 단, 아래 WARNING 은 모두 developer 권한 밖(`spec/` 쓰기 불가) 사유로 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 다음 planner 턴을 기다리는 상태다.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, plan_coherence | `2-trigger-list.md` R-2(Webhook HMAC 인라인 rotate-secret 설계)가 폐기됐음에도 취소선/정정 콜아웃 없이 유효한 것처럼 서술 — cross-doc 파급까지 확인(`5-system/15-chat-channel.md:610` R-CC-10 이 R-2 를 현재 유효 설계로 인용) | `spec/2-navigation/2-trigger-list.md` R-2(226~283행 부근), §3 각주 | `spec/5-system/15-chat-channel.md` R-CC-10 | R-2 원문에 취소선+정정 콜아웃, R-CC-10 인용문 동시 갱신. 이미 plan 490~505행에 등재, planner 턴에서 두 파일 동시 처리 |
| 2 | convention_compliance, plan_coherence | `2-trigger-list.md §2.3.1` botToken 행이 같은 셀 안에서 "`hasBotToken: boolean` 만 노출"과 "마스킹 placeholder(`•••• <last4>`)"를 동시 서술 — boolean-only 라면 last4 노출 불가능한 자기모순 | `spec/2-navigation/2-trigger-list.md §2.3.1` botToken 행(155행 부근) | `spec/5-system/15-chat-channel.md §5.4.2`, `spec/conventions/swagger.md §1-5` | "마스킹 placeholder" 문구 삭제 또는 "형식 예시일 뿐 기존 값 일부 노출 아님"으로 정정. 이미 plan 564~577행에 등재 |
| 3 | convention_compliance | `2-trigger-list.md` frontmatter `status: implemented` 인데 §3 본문이 sort/order 미구현을 자백 — `spec-impl-evidence.md §3` 라이프사이클 규약 위반 형태 | `spec/2-navigation/2-trigger-list.md` frontmatter(3행) vs §3(151행) | `spec/conventions/spec-impl-evidence.md §3`, 자매 문서 `3-schedule.md` 의 올바른 선례(구현 완료 후 Planned 표기 해제) | `status: partial` + `pending_plans:` 등록, 또는 sort/order 구현 후 `implemented` 유지. 이미 plan 507~516행에 등재 |
| 4 | plan_coherence | Auth Config "새 인증 설정 만들기" 링크 노출 권한이 `2-trigger-list.md`(editor+)와 `6-config.md`(admin+, 확정 서술) 간 불일치 — 이번 대조로 `6-config.md` 쪽이 SoT 임을 확정 | `spec/2-navigation/2-trigger-list.md §2.3.1` Auth Config 행(152행) | `spec/2-navigation/6-config.md §A.4`/Authentication API 표(262행), `spec/5-system/1-auth.md §3.2` | `2-trigger-list.md` 를 `admin+` 로 정정(6-config.md 가 SoT). plan 518~527행 문구를 "제품 의도 확인"에서 "정정"으로 좁히도록 근거 보강 권고 |
| 5 | naming_collision | 백엔드 신규 export `WorkflowVersionDetail` 이 프런트엔드 기존 동명 타입과 완전 동명이나 shape 상이(creator optionality) — 이미 3회 검토 세션의 "유일 정의" 오판을 유발한 전력 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:61` (신규 export) | `codebase/frontend/src/lib/api/workflows.ts:109` (기존 손-미러 타입) | 프런트 선언 옆에 백엔드 동명 타입 역참조 주석 추가(최소 조치). 공유 타입 패키지 이관 또는 개명 후속 작업을 `plan/in-progress/`에 신규 등재 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, cross_spec | `TRIGGER_ENDPOINT_PATH_CONFLICT`/`details.code` 구현이 이전 라운드가 지적한 `details.subCode` 비표준 키를 이미 수정 완료 — spec 이 선언한 계약과 정합 | `triggers.service.ts` `rethrowEndpointPathConflict()` | 조치 불요(양성 확인) |
| 2 | plan_coherence | `spec-draft-nullable-notation-followups.md` frontmatter `spec_impact` 목록이 본문이 요구하는 `2-trigger-list.md`/`3-schedule.md`/`15-chat-channel.md` 를 누락 | plan frontmatter(8~12행) | 다음 planner 턴에서 `spec_impact` 에 위 3개 파일 추가(향후 `--spec`/`--impl-done` 번들 스코프 누락 방지) |
| 3 | convention_compliance | `error.details` object vs array 이중 컨테이너 형태가 `api-convention.md §5.3` 에 아직 미명문화(target 문서 자체는 위반 아님, 문서 공백) | `2-trigger-list.md §3` blockquote | 이미 plan 544~562행에 등재, 별도 조치 불요 |
| 4 | rationale_continuity | Trigger 충돌 코드가 `details.code` 패턴(b)을 택한 근거가 코드 주석에 명시되고 정식화가 planner backlog(같은 plan 파일 544행)에 등재됨 — 결정 번복 아님 | `triggers.service.ts` `rethrowEndpointPathConflict()` | 후속 세션에서 정식 원칙 승격 여부 확인 |
| 5 | rationale_continuity | `select:false` 회피(`CREATOR_PROJECTION`)가 `secret-store.md §1.1` 기각 근거를 정확히 계승 | `workflow-versions.service.ts` | 조치 불요(양성 확인) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec/2-navigation 델타 0, 관련 코드 표면(trigger 409, joinedAt, creator 투영) 전부 spec 계약과 정합. CRITICAL/WARNING 없음 |
| rationale_continuity | NONE | 기존 Rationale(secret-store §1.1, error-codes §4.2, api-convention §5.4) 위반·기각 대안 재도입 없음. 열린 축 1건은 이미 planner backlog 등재 |
| convention_compliance | LOW | 신규 위반 없음. 기존 3건(status 오표기, R-2 미정정, botToken 모순) 전부 재확인됐고 plan 에 추적됨 |
| plan_coherence | LOW | 이 PR 이 만든 신규 충돌 없음. plan 이 이미 추적 중인 4건 재확인 + Auth Config 권한 불일치 근거 보강 + spec_impact 누락 지적 |
| naming_collision | LOW | `WorkflowVersionDetail` 동명 타입 shape 상이 1건 WARNING. 나머지 신규 식별자는 격리되거나 기존 spec 문구의 구현일 뿐 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — CRITICAL 없음) 다음 planner 턴에서 `spec/2-navigation/2-trigger-list.md` 의 4건(R-2 취소선 정정, botToken 문구 정정, frontmatter status 정정, Auth Config 권한 정정)과 `spec/5-system/15-chat-channel.md` R-CC-10 인용 동시 갱신을 일괄 집행 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 전부 등재돼 있으므로 신규 plan 작성 불요.
2. 같은 planner 턴에서 plan frontmatter `spec_impact` 에 `spec/2-navigation/2-trigger-list.md`·`spec/2-navigation/3-schedule.md`·`spec/5-system/15-chat-channel.md` 추가.
3. `WorkflowVersionDetail` 동명 타입 비대칭(백엔드는 프런트를 참조하나 역방향 없음) 해소 — 프런트엔드 `workflows.ts:109` 옆에 역참조 주석 추가(최소 조치), 공유 타입 패키지 이관은 별도 후속 plan 항목으로 등재 권장.