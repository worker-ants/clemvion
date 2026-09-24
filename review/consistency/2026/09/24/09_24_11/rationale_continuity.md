# Rationale 연속성 검토 — spec/5-system (--impl-done, member-owner-toctou)

## 발견사항

- **[WARNING]** "워크스페이스 소유권 보호" 도메인의 확립된 TOCTOU 방지 패턴(비관적 락)을 벗어난 네 번째 메커니즘을 채택했으나, spec Rationale 은 아직 미갱신 — 단, 이번 라운드에서 planner 백로그로 정식 등재됨을 확인
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` (diff — `delete({ id, workspaceId, role: Not('owner') })` + `affected===0` 분기). 대응 spec 서술은 `spec/5-system/1-auth.md` §3.2 각주(†) `CANNOT_REMOVE_OWNER`.
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §1.10 (`leaveWorkspace` — "sole-owner 판정과 멤버십 DELETE 를 **비관적 락 트랜잭션** 내에서 수행해 TOCTOU 방지"), 같은 §1.10 `deleteWorkspace`(워크스페이스 row 를 `pessimistic_write`), §1.6 `transfer-ownership`(대상 멤버 행 `pessimistic_write`). §1.6 `DELETE /api/workspaces/:id/members/:memberId` 행(141행)은 "owner 는 제거 불가" 만 적고 메커니즘을 규정하지 않는다.
  - 상세: 이 저장소에서 "owner 보호" 클래스의 TOCTOU 방지 수단은 spec 에 서술된 세 사례(leave·delete·transfer-ownership) 모두 비관적 락 트랜잭션이었다. 이번 PR 은 같은 클래스(owner 보호, 동시 `transferOwnership` 과의 경합)를 새 락 없이 조건부 `DELETE … WHERE role != 'owner'` + Postgres READ COMMITTED EvalPlanQual 재평가로 처리한다. `--impl-prep`(`review/consistency/2026/09/24/07_29_15` rationale_continuity WARNING 1)가 정확히 이 이탈을 짚었다. plan(`plan/in-progress/member-owner-toctou.md` §B)이 대안(트랜잭션+잠근 재조회)을 재저울질하고 **셀 수 있는 손실**(`affected===0` 판별자 도달 불가화·기존 단위 테스트 사문화)로 기각한 근거를 상세히 남겼으므로 "무근거 번복"은 아니다. 다만 그 근거는 spec 이 아니라 plan·코드 주석에만 있다 — `spec_impact: none` 선언(관찰 가능한 API 계약 불변)은 타당하지만, `data-flow/12-workspace.md:141` 자체는 형제 셋과 달리 여전히 메커니즘 무기술 상태로 남는다.
    이번 라운드에서 확인한 것: developer 는 spec 쓰기 권한이 없으므로 (a) 코드 주석에 `4-execution-engine.md §8`(타-행 집계 조건, 조건부 UPDATE 단독 불충분 선례)와 이번 자리(같은-행 조건, EvalPlanQual 재평가로 충분)의 차이를 명시했고, (b) `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`removeMember` 의 owner 보호 메커니즘을 `data-flow/12-workspace.md` 에 명문화" 항목을 planner 소유로 신규 등재했다(2026-09-24). 이는 WARNING 1 이 요구한 처방 (a)(b) 를 그대로 이행한 것이다.
  - 제안: 재등재 불필요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 걸려 있다. 다음 planner 턴에서 `spec/data-flow/12-workspace.md:141` 인근에 "owner 보호는 비관적 락이 아니라 조건부 DELETE(`role != 'owner'`) + affected-count 판별이며, `transferOwnership` 이 대상 행에 쥔 `pessimistic_write` 로 안전하다" 각주를 추가하면 이 WARNING 은 해소된다.

- **[INFO]** 개발자 자신이 남긴 "기각된 대안" 주석의 자기-반증 정정 — 절차 준수 확인
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` 위 JSDoc/인라인 주석 (diff)
  - 과거 결정 출처: 같은 파일의 기존 주석 — "그것은 계약이 다른 별 사안이라 함께 닫지 않았다 — 여기서 `role: Not('owner')` 를 더하면 `affected === 0` 의 의미가 둘로 늘어나 이 판별자 자체가 흐려진다"(개발자 본인이 #1373 에서 작성)
  - 상세: 이번 PR 은 그 주석이 "하면 안 된다"고 적은 것을 정확히 수행한다. 그러나 코드 주석은 `spec/` 이 아니라 harness 자기-반증형 소정정 조항의 적용 대상도 아닌 일반 코드이므로 developer 가 직접 고칠 수 있고, 실제로 diff 가 그 문장을 최신 설계(같은 문장 안에서 판정 + `affected===0` 이유가 둘로 늘어난 것을 0-행 경로의 추가 조회로 흡수)로 교체했다. 오도하는 옛 "기각 사유"가 코드에 남지 않았다.
  - 제안: 없음 — 확인만 하고 넘어간다.

- **[INFO]** RBAC §3.2 각주("멤버 관리 Admin 열 정정", 2026-07-28)와의 정합 — 충돌 없음
  - `CANNOT_REMOVE_OWNER` 는 "역할 권한이 아니라 대상 조건"이라는 기존 각주 원칙이 이번 변경 후에도 그대로 유지된다. plan §C 가 이를 인용해 spec 서술 불변을 명시했고, 실제로 `spec/5-system/1-auth.md` §3.2 각주 본문은 diff 대상에 없다.

## 요약

CRITICAL 급 — 명시적으로 기각된 대안의 재도입이나 spec invariant 위반 — 은 없다. 이 PR 이 실제로 하는 일은 개발자 본인이 과거(#1373)에 남긴 "여기서 `role: Not('owner')` 를 더하면 안 된다"는 코드 주석의 판단을 뒤집는 것이지만, 그 번복은 (1) `--impl-prep` 단계에서 WARNING 으로 미리 지적됐고, (2) plan 이 대안(트랜잭션+잠근 재조회)을 계량적 손실(기존 판별자 사문화·단위 테스트 무효화)로 명시 기각했으며, (3) 코드 주석이 `4-execution-engine.md §8` 선례와의 구조적 차이(타-행 집계 vs 같은-행 조건)를 남겨 다음 리뷰어의 오적용을 막고, (4) spec 쓰기 권한이 없는 developer 가 `data-flow/12-workspace.md:141` 명문화를 planner 백로그로 정식 등재해 절차를 완결했다 — 즉 "무근거 번복"의 반대 사례다. 남는 갭은 spec 텍스트 자체(`data-flow/12-workspace.md`)가 아직 이 네 번째 메커니즘을 기록하지 않았다는 것뿐이며, 이는 이미 추적 중인 WARNING 으로 남긴다. CHANGELOG 도 이전 "owner 승격 TOCTOU (실측 재현)" 잔존 문구를 취소선 처리하고 이번 해소를 교차 참조해 전방 참조 정합을 지켰다.

## 위험도

LOW
