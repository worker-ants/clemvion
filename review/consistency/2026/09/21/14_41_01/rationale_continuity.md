# Rationale 연속성 검토 — spec/2-navigation (--impl-prep, authconfig-dup-delete)

## 검토 대상

- 계획: `plan/in-progress/authconfig-dup-delete.md` — `AuthConfigsService.remove()` 의 동시 삭제
  이중 감사(`auth_config.delete` 2건) 결함을, 형제 6건(#1369 workflow/workspace · #1370 trigger ·
  #1371 schedule · #1372 integration · #1373 member)과 같은 처방(락 없이 원자적
  `delete({ id, workspaceId })` 의 `affected === 0` → 404)으로 닫는 7번째 자리. `spec_impact: none`.
- target 문서: `spec/2-navigation/6-config.md`(DELETE `/api/auth-configs/:id` 계약·Rationale),
  교차 확인: `spec/2-navigation/2-trigger-list.md`(R-14/R-15, §4.4), `spec/2-navigation/4-integration.md`
  (§9 Rationale "PostgreSQL advisory lock" 기각 항목).

## 발견사항

### [INFO] 기각된 대안(advisory lock)의 재도입이 아님을 계획 자체가 사전 검증함

- target 위치: `plan/in-progress/authconfig-dup-delete.md` §B "락이 없으므로 처방도 #1372·#1373 과 같다"
- 과거 결정 출처: `spec/2-navigation/4-integration.md` §9 Rationale — "PostgreSQL advisory lock
  (`pg_advisory_xact_lock`): 코드 단순하지만 **lock 보유 중 HTTP 요청**(Cafe24 endpoint)을 transaction
  안에 묶어야 해 DB 커넥션 점유 시간이 늘고 … 운영 부담이 더 큼" (기각 대안)
- 상세: 이 기각은 Cafe24 token refresh 문맥의 advisory lock에 한정된 것이지 "삭제 경로에 락을 쓰지
  말라"는 일반 원칙이 아니다. 이번 계획은 애초에 advisory lock 을 도입 대상으로 검토조차 하지 않고
  (§B "참조하는 FK … ON DELETE SET NULL", "사용처 검사 없다" 확인) 원자적 `DELETE`+`affected` 판정만
  쓴다 — 4d9064740(integration PR) 커밋이 이미 "기각 사유는 lock 보유 중 HTTP 요청이고 여기엔 외부
  호출이 없다"고 명시적으로 자기 판별을 남긴 선례를 그대로 계승한다. 충돌 없음.
- 제안: 조치 불요. 향후 8·9번째 자리(model-config, webauthn)도 동일 자기 판별 문장을 반복해 두면
  "기각된 대안 재도입" 오탐을 예방한다.

### [WARNING] `2-api-convention.md §3` "DELETE=멱등 O" 표와의 기존 충돌이 7번째 인스턴스로 확장 — 이미 추적 중, 비차단

- target 위치: 이번 변경이 적용되면 `DELETE /api/auth-configs/:id` (동시 요청 패자 → `404`)가
  `spec/5-system/2-api-convention.md §3`(HTTP 메서드 표, `DELETE | O`)와 다시 어긋나는 6→7번째 경로가 된다.
  `spec/2-navigation/6-config.md` §3 자체는 이 계약을 서술하지 않으므로 target 문서 단독으로는 새 모순이
  생기지 않지만, cross-spec 멱등성 표와는 정면 충돌이 이어진다.
- 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` (4816행 부근) "DELETE
  멱등성 표" 항목 — `--impl-done review/consistency/2026/09/21/11_42_00` WARNING 1(rationale_continuity)이
  최초 지적했고, 이후 5개 라운드(workspace/member PR 포함) 연속으로 재확인되며 "경로 수를 세지 말고
  계약 문장만 각주로 적을 것"으로 처분이 이미 확정됨(오늘 c1bf3f1c0 이 그 일반화를 반영).
  disposition: BLOCK:NO — planner 소유, 신규 등재 불요, 코드 유지가 옳음(형제 6건 검증된 의도적 패턴).
- 상세: 새로운 위반이 아니라 기존 미해결 SPEC-DRIFT 의 인스턴스 수 증가일 뿐이다. 다만 rationale
  continuity 관점에서 "동일 계약 문장과 정면 충돌하는 동작을 새 Rationale 없이 재확인 없이 넘긴다"는
  패턴이 반복되는 것 자체가 누적 리스크이므로 WARNING 으로 유지해 감사 추적을 끊지 않는다.
- 제안: 이번 PR 에서 조치 불요(선례와 동일 disposition). `2-api-convention.md §3` 각주
  ("멱등성은 최종 상태 기준이며, 동시 요청 중 진 쪽은 404 를 받을 수 있다") 집행 시 이 7번째 자리도
  자연히 커버된다 — 새 등재 불필요.

### [INFO] `6-config.md §A`(DELETE 계약)에 "동시 삭제 → 두 번째 404" 서술 부재 — 이미 정확히 재등재됨

- target 위치: `spec/2-navigation/6-config.md` §3 "Authentication API" 표, `DELETE /api/auth-configs/:id`
  행 — "삭제 (Admin+)" 만 적혀 있고 동시 요청 시 패자 응답은 서술하지 않는다.
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.4 가 이 계열에서 유일하게 이미 문서화한
  선례 — "동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`".
- 상세: 오늘 커밋 c1bf3f1c0 이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  "삭제 엔드포인트를 적는 spec 들에 «동시 삭제 → 두 번째 404» 서술이 없다" 항목을 재열거형으로
  일반화하면서 `6-config.md §A(DELETE /api/auth-configs/:id)`를 2026-09-21 기준 스냅샷에 정확히
  포함시켰고, `5-system/12-webhook.md`·`1-auth.md`는 삭제 계약을 서술하지 않아 대상이 아님을 직접
  확인해 배제했다 — target 문서 실사 결과와 정확히 일치한다(본 checker 가 `6-config.md` 를 직접 읽고
  같은 결론에 도달함).
- 제안: 조치 불요. 이번 developer PR(spec_impact: none)이 직접 갱신할 필요 없음 — 해당 planner 항목
  집행 시 §A 에 "동시 삭제 → 두 번째 404" 한 문장 추가로 처리될 것.

### 대상 외 확인 (결론: 무관)

- `spec/2-navigation/2-trigger-list.md` R-14/R-15 (`authConfigId == null` FK SET NULL 시 webhook
  무인증 경고 표시)는 트리거 측 표현 정책이며, 이번 삭제 결함 수정(동시 요청 감사 중복 제거)은
  `ON DELETE SET NULL` cascade 자체를 바꾸지 않으므로 R-14/R-15 와 무충돌.
- `6-config.md` Rationale R-2/R-6(마스킹·Reveal·호출 이력 audit)는 삭제 audit 의 exactly-once 여부에
  대해 아무 것도 규정하지 않아 이번 변경과 충돌하지 않음.
- 계획 §"이 PR 이 하지 않는 것" — "사용처 검사 부재"는 이번 PR 이 만든 문제가 아니라는 서술은
  `6-config.md` 자체에 사용처 검사(예: `INTEGRATION_IN_USE` 류) 서술이 원래 없다는 사실과 일치함
  (target 문서 §3 DELETE 행에 그런 가드 언급 없음 — 확인됨).

## 요약

이번 계획은 이미 6차례 검증·수렴한 "락 없는 원자적 `DELETE` + `affected===0`" 패턴을 7번째로 그대로
적용하며, 명시적으로 기각된 대안(4-integration.md Rationale 의 advisory lock 기각)을 그 기각 사유
범위 밖임을 스스로 확인한 뒤 재사용하고 있어 오도입 위험이 없다. 유일하게 이어지는 긴장은
`5-system/2-api-convention.md §3` "DELETE=멱등 O" 표와의 기존 SPEC-DRIFT 인데, 이는 6차례 연속 같은
disposition(BLOCK:NO, planner 소유, 집행 시 일괄 각주)으로 처분된 사안이 인스턴스 하나 늘어난 것뿐이다.
`6-config.md §A` 의 "동시 삭제 → 두 번째 404" 서술 부재도 오늘자 커밋(c1bf3f1c0)이 이미 정확한 스냅샷으로
재등재해 두어 누락이 없다. spec/2-navigation 범위 안에서 Rationale 을 침해하거나 원칙을 위반하는
새로운 문제는 발견되지 않았다.

## 위험도

LOW
