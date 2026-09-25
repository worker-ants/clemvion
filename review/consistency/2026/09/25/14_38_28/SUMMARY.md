# Consistency Check 통합 보고서

**BLOCK: YES** — Convention Compliance checker 가 지목한 Critical 1건(예정 동작을 "이미 구현됨"으로 서술)이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — spec draft 가 인용 정확도·전수 확인 면에서는 견고하지만(cross_spec LOW, naming_collision NONE), 이번에 새로 카탈로그화하는 미구현 동작(`@WorkspaceParam` 인식, `EDITOR_REQUIRED`/`OWNER_REQUIRED`/경로용 `NOT_A_MEMBER` 발행)을 이미 배포된 사실처럼 현재형으로 서술해 `spec-impl-evidence.md` 가 막으려는 갭을 반대 방향(구현 없는 promise)으로 재현할 Critical 1건이 있고, 그 외에도 opt-in 데코레이터 완화책 미상세·인접 문서 미동기화·다른 in-progress plan 과의 조율 누락 등 Warning 7건이 남아 있음

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | 예정 동작(`@WorkspaceParam` 인식, `EDITOR_REQUIRED`/`OWNER_REQUIRED`/경로용 `NOT_A_MEMBER` 발행 등)을 후속 developer PR 구현 전인데도 spec 절 전체가 현재형("…를 검증한다", "…코드를 갖는다")으로 서술 | `plan/in-progress/spec-draft-workspace-path-guard.md` C-1~C-9 전체 (특히 C-1(c), C-2, C-3, C-7, C-8, C-9) | `spec/conventions/spec-impl-evidence.md` §3 status 라이프사이클 + 이 저장소 자신의 확립된 선례(`5-system/3-error-handling.md:326,449,458`, `5-system/1-auth.md:113,439,457`, `2-navigation/9-user-profile.md:260,311`, `2-navigation/6-config.md:334` 의 "계획(Planned)/미구현" 인라인 마커) | C-1~C-9 각 항목에 "(2026-09-25 결정 — 계획(Planned), 후속 developer PR 구현 전까지 미구현)" 마커를 추가하거나 각 spec 변경 서두에 미구현 고지 문단 삽입. 대안으로 손댄 파일 중 합리적인 것은 frontmatter `pending_plans` 전이도 검토 |

## planner 인계 (권한 밖 Critical)

> `(없음)` — 위 Critical 은 이 세션 자체가 project-planner 의 `--spec` 사전 검토(spec draft 를 `spec/` 에 반영하기 직전 단계)이며, 근본 원인(Planned/미구현 마커 누락)이 지금 이 draft 를 쓰고 있는 바로 그 행위자의 권한 안에 있다. developer 턴에서 발견된 out-of-scope spec drift 유형이 아니므로 인계 대상 없음 — 위 Critical 제안을 이 draft 자체에 바로 반영하면 됨.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `@WorkspaceParam` 은 이 저장소가 "재발 위험"을 근거로 이미 두 번 재기각한 라우트별 opt-in 마커 패턴과 구조적으로 같은 계열인데, 완화책("저장소 가드")이 한 줄로만 적혀 과거 캐너리 수준의 상세함이 없음 | C-1(c), D-1, D-4 | `spec/data-flow/12-workspace.md` "멤버십 검증은 가드 1곳에서"(기각 대안: 73개 라우트 `@Roles('viewer')` 부착), `spec/5-system/1-auth.md` "부트 캐너리" (b) "재기각이다" | D-4 에 저장소 가드의 구체 메커니즘(정적 스캔 대상·판별 규칙·실패 방향)을 부트 캐너리와 동등한 밀도로 명시하거나, 최소한 "가드 구현 전까지 opt-in 재발 위험이 남는다" caveat 을 Rationale 에 명시 |
| 2 | Rationale Continuity | 코드 3분기 변경이 `13-replay-rerun.md` 안 에러 표 이외의 서술(RR-PL-06 본문, §7 회귀 잠금 목록)까지 전파되지 않아 "권한 실패 = 단일 코드" invariant 서술이 표와 어긋난 채 남음 | C-8 | `spec/5-system/13-replay-rerun.md` §RR-PL-06 본문("동일 가드를 enforce 하고 … `RERUN_PERMISSION_DENIED` 반환"), §7 "회귀 잠금" 목록 | C-8 에 RR-PL-06 본문과 §7 회귀 잠금 목록 문구도 3분기(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`RERUN_PERMISSION_DENIED`) 반영 대상으로 추가 |
| 3 | Convention Compliance | C-3 이 표의 `forbidden` 행을 `ADMIN_REQUIRED` 로 바꾸지만, 같은 절 바로 아래 각주("특히 `forbidden`·`rate_limited` 는 … lowercase 예외")가 여전히 `forbidden` 을 예시로 지목해 stale 해짐 | C-3 | `spec/5-system/1-auth.md` §1.5.4 표 아래 각주 | C-3 에 해당 각주에서 `forbidden` 언급 제거(또는 `rate_limited` 단독 예시로 축소) 항목 추가 |
| 4 | Plan Coherence | D-8 "여러 줄 링크는 doclink 가드 앵커 검증을 우회한다(알려진 사각)" 근거가 2026-08-29 `#1235` 로 이미 닫힌(뮤테이션 검증 완료) 가드 한계를 살아있는 것처럼 인용 | D-8 | `plan/in-progress/harness-review-gate-followups.md` "미해결 항목" 첫 항목(`#1235` 로 해소됨) | D-8 근거 문장을 "2026-08-29 `#1235` 로 이미 닫힘 — 지금은 검증됨. 가독성 목적으로 한 줄 권장" 으로 정정하거나 근거 문장 삭제 |
| 5 | Plan Coherence | C-4 가 편집하는 `error-codes.md §3` 예외 레지스트리를 다른 미결 plan 도 같은 표의 다른 행(`AbortError` 신규 등재)으로 동시에 겨눔 | C-4 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (미결, `AbortError` historical-artifact 신규 등재 제안, `spec_impact` 에 `error-codes.md` 명시) | C-4 절 또는 Rationale 에 "같은 절을 겨누는 미결 plan 있음" 한 줄 포인터 추가해 두 planner 턴 편집 순서 인지시킬 것 |
| 6 | Plan Coherence | D-1 부트 캐너리가 경로 소비자까지 세면 소비 라우트 수가 늘어나는데, 다른 plan 이 고정해 둔 캐너리 기준값(142)이 stale 해짐을 언급하지 않음 | D-1 | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C "착수 시 반드시 검증할 것" — 업그레이드 전 기준값 142(2026-09-24 실측, `0b5b226b3`) 고정 | §D 에 "`@WorkspaceParam` 배선 착지 시 `nestjs-v12-coordinated-upgrade.md` §C 기준값(142) 재실측·갱신 필요" 항목 추가 |
| 7 | Plan Coherence | D-6 "새 코드를 사용자 노출 코드로 등재할지는 구현 PR 이 정한다"가, `ERROR_KO`/`translateBackendError` 읽기 배선 자체가 프로덕션 호출부 0건으로 죽어 있다는 선행 미해결 결정을 참조하지 않음 | D-6 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 미해결 항목 "`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다" | D-6 에 해당 tracker 항목을 포인터로 추가하고, "등재" 결정이 더 큰 배선 결정과 독립적으로 완결되지 않음을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `roles.guard.ts` docstring("가드 거부에 코드를 부여하려면 전 경로를 함께 바꿔야 한다(별도 작업)")이 D섹션 구현 요구 어디에도 갱신 대상으로 없어 구현 후 stale 코멘트로 남을 위험 | D 섹션 전체 vs `codebase/backend/src/common/guards/roles.guard.ts` L85-88 | 후속 구현 PR 체크리스트에 docstring 갱신 추가 |
| 2 | Cross-Spec | 코드 변경의 실질 blast radius 가 트래커 원 스코프(경로 파라미터 라우트 15개)보다 훨씬 커서(`@Roles()` 전체 87개 라우트: editor 66/admin 9/owner 7/viewer 5) 제목만 보면 과소평가 위험 | C-1(e) | 후속 developer PR 리뷰 시 실제 영향 범위 링크 |
| 3 | Rationale Continuity | `error-codes.md §3` 병합 행에서 `forbidden` 만 나열에서 빼면 같은 셀의 "진실(의미)" 텍스트("권한 부족")·"이유" 서술이 그대로 남아 셀 내부 정합 깨짐 | C-4 | `forbidden` 제거 시 "진실" 셀의 "권한 부족" 문구도 함께 정정(또는 각주화) |
| 4 | Rationale Continuity | "워크스페이스 `:id` 경로 파라미터" 표 행이 `:id`(14곳)와 `memberId`/`invitationId`(4곳)를 합산 18로 묶어놨는데, "두 단계가 된다"고만 고치면 후자까지 2단으로 바뀐 것처럼 오독될 위험 | C-1(d) | 표 행을 `:id`(2단)와 `memberId`/`invitationId`(1단 유지)로 분리, "적용 범위" 문장에 `@WorkspaceParam()` 병기 |
| 5 | Convention Compliance | C-4 의 `admin_required` 註 삽입 지시가, 실제로는 `workspace_not_found`·`user_not_found`·`admin_required` 세 코드를 한 행에 묶은 병합 행 구조와 어떻게 상호작용할지 불명확 | C-4 | "행을 쪼개지 않고 註는 '진실' 셀 끝에 `admin_required` 한정 문구로 추가" 처럼 편집 형태 한 줄 명시 |
| 6 | Naming Collision | 구현 PR 이 만들 이름 미정의 "저장소 가드"(D-4)가 기존 `param-uuid-pipe-guard.ts` 와 스코프상 인접해 이름 유사 시 책임 경계 혼동 가능 | D-4 | 새 가드에 `workspace-param-binding-guard.ts` 류 구분되는 이름 사용 + 기존 가드 스캔 모집단에서 `@WorkspaceParam` 전환 라우트 제외 처리 기록 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 9개 spec_impact 대상 파일의 모든 인용문·grep 수치(87개 라우트 66/9/7/5 등)를 워크트리 실측과 전수 대조해 전부 일치, 직접 모순·잠재 충돌 없음. INFO 2건만 |
| Rationale Continuity | MEDIUM | 과거 기각 대안 인용 등 연속성 실천은 모범적이나, `@WorkspaceParam` opt-in 완화책 미상세(재기각 패턴 재현 위험) + `13-replay-rerun.md` 내부 서술 부분 전파 누락 |
| Convention Compliance | HIGH | 인용 정확도는 매우 높으나, 미구현 동작을 현재형으로 서술해 이 저장소 자신의 "계획(Planned)/미구현" 마킹 관행·`spec-impl-evidence.md` 원칙 위반 (Critical 1건) |
| Plan Coherence | MEDIUM | 이 draft 자체와 `spec-draft-nullable-notation-followups.md` 간 결정 인계는 정합하나, 후속 developer PR 표면이 다른 3개 in-progress plan(`error-codes.md` 동시 편집, 캐너리 기준값 142, `ERROR_KO` 죽은 배선)과 조율되지 않음. 부수적으로 D-8 근거 1건 stale |
| Naming Collision | NONE | 신규 식별자 `@WorkspaceParam`·`EDITOR_REQUIRED` 저장소 전수 grep 0건 충돌, 재사용 식별자(`OWNER_REQUIRED`·`NOT_A_MEMBER`) 도 기존 의미와 정합 |

## 권장 조치사항
1. **(BLOCK 해소 우선)** C-1~C-9 각 spec 변경 항목에 "계획(Planned)/후속 developer PR 구현 전까지 미구현" 마커를 추가해, 이 저장소가 이미 반복 확립한 관행(`3-error-handling.md`·`1-auth.md`·`9-user-profile.md`·`6-config.md` 의 Planned/미구현 표기)과 정합시킨다.
2. D-4 의 "저장소 가드"를 부트 캐너리 수준의 구체 메커니즘(스캔 대상·판별 규칙·실패 방향)으로 명시하거나 최소한 caveat 을 남겨, opt-in 패턴 재기각 이력과의 긴장을 해소한다.
3. C-8 을 `13-replay-rerun.md` 의 RR-PL-06 본문·§7 회귀 잠금 목록까지 확장하고, C-3 의 `1-auth.md` 인접 각주(`forbidden` 예시)도 함께 정정한다.
4. §D 에 `error-codes.md §3` 동시 편집 plan, `nestjs-v12-coordinated-upgrade.md` 캐너리 기준값(142) 재실측, `ERROR_KO`/`translateBackendError` 죽은 배선 tracker 항목을 각각 포인터로 추가해 후속 developer PR 착수 전 세 plan 을 조율한다.
5. D-8 의 doclink 가드 근거 문장을 `#1235` 로 이미 닫힌 사실에 맞게 정정한다.
