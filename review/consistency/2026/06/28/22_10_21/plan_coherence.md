# Plan 정합성 검토 결과

검토 모드: `--impl-prep`, scope=`spec/5-system/`
검토 일시: 2026-06-28

---

## 발견사항

### [WARNING] `webhook-public-ip-failopen-hardening.md` 미해결 결정이 `1-auth.md §2.3` 과 잠재 충돌

- **target 위치**: `spec/5-system/1-auth.md §2.3 "클라이언트 IP"` 행 — "webhook/rate-limit/`ip_whitelist` 경로는 헤더 기반(CF-gated → XFF 첫 IP)만 적용하며 `req.ip`/`socket` 폴백이 없다(`extractClientIpFromHeaders` 직접 호출)"
- **관련 plan**: `plan/in-progress/webhook-public-ip-failopen-hardening.md` §"결정 필요" 항목 2: "`req.socket.remoteAddress` 를 IP 폴백으로 쓸지"; 항목 3: "fail-closed 전환 여부"
- **상세**: `webhook-public-ip-failopen-hardening.md` 는 현재 Guard 가 IP 미식별 시 `return true`(fail-open)하는 우회 가능성을 "결정 필요" 보안 이슈로 남겼다. 결정 2(소켓 폴백)·결정 3(fail-closed)이 채택되면 `1-auth.md §2.3` 의 "req.ip/socket 폴백 없음" 기술이 갱신돼야 한다고 해당 plan 자체에 명시되어 있다. target(`1-auth.md §2.3`)은 "헤더 전용·폴백 없음"을 현재 확정 사실로 서술하고 있으나, 해당 결정 자체가 아직 열려 있다. 구현 착수 전 target 을 그대로 spec 기준으로 삼으면 미결 결정과의 정합 추적이 누락된다.
- **제안**: `1-auth.md §2.3` 에 "webhook IP 미식별 fail-open 강화 결정 전까지 현행 헤더 전용 정책 유지 — `webhook-public-ip-failopen-hardening.md` 참조" 주석을 추가하거나, plan 의 "결정 필요" 항목이 완료된 뒤 target 을 갱신한다. 현 상태로는 구현자가 §2.3 만 보고 결정이 확정된 것으로 오해할 수 있다.

---

### [WARNING] `webhook-hardening-cleanup.md` 잔여 항목(C spec 묶음)이 target 에 미반영

- **target 위치**: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`(target 범위 내)
- **관련 plan**: `plan/in-progress/webhook-hardening-cleanup.md` §"범위 밖 (별도)" — "C(spec-only 단방향 포인터): 잔여(api-convention §5.3 echo 금지 포인터·web-chat §4 fail-open 언급)는 별도 spec 묶음"
- **상세**: PR 머지 전 단계(push+PR 미완료)이고 A-1~B-7 코드 정리는 완료됐으나, spec 후속(api-convention §5.3 포인터, channel-web-chat §4 fail-open 언급)은 별도 spec PR 로 명시적으로 분리됐다. target 으로 `spec/5-system/` 전체가 구현 착수 대상이라면, `2-api-convention.md` §5.3 에 이 포인터 갱신이 선행 spec 작업으로 계획돼 있지만 아직 수행되지 않은 상태임을 인지해야 한다.
- **제안**: `webhook-hardening-cleanup.md` 의 spec 잔여(C) 항목을 별도 plan 으로 분리하거나, 본 구현 착수 전 해당 spec 갱신을 선행 완료로 확인한다. 분리된 spec PR 이 있다면 그 plan 파일 위치를 명시한다.

---

### [INFO] `spec-sync-auth-gaps.md` 미구현 추적 항목과 target `1-auth.md §1.3` 의 관계

- **target 위치**: `spec/5-system/1-auth.md §1.3` — "LDAP·SAML 2.0 은 미구현·Planned. 추적은 `plan/in-progress/spec-sync-auth-gaps.md`"
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` — LDAP·SAML 미구현 항목 2건 open
- **상세**: target 이 plan 을 올바르게 포인팅하고 있으며 충돌 없음. 단, `spec-sync-auth-gaps.md` 는 `worktree: (unstarted)` 상태로 LDAP/SAML 이 이번 구현 착수 범위에 포함되는 경우 선행 미해소 상태임을 명확히 인지해야 한다. 이번 `spec/5-system/` 구현이 §1.3 을 포함한다면 plan 미착수 상태를 착수로 전환해야 한다.
- **제안**: 이번 구현 범위에 LDAP·SAML 이 포함되지 않는다면 현 상태 무방. 포함된다면 `spec-sync-auth-gaps.md` 를 활성화(worktree 지정)해야 한다.

---

### [INFO] `rag-dynamic-cut.md` 이 `spec/5-system/10-graph-rag.md` 를 spec_impact 에 포함

- **target 위치**: `spec/5-system/10-graph-rag.md` — target 범위 내 포함
- **관련 plan**: `plan/in-progress/rag-dynamic-cut.md` — `spec/5-system/10-graph-rag.md` 를 `spec_impact` 에 명시. worktree `rag-dynamic-cut-12fac1` 에서 진행 중
- **상세**: `rag-dynamic-cut` 이 `10-graph-rag.md §KB-GR-SR-05`(topK→동적 컷 표현) 을 수정했거나 수정 예정이다. target 범위(`spec/5-system/`) 에 `10-graph-rag.md` 가 포함되므로, 해당 plan 의 spec 갱신이 적용됐는지 확인 필요. `rag-dynamic-cut.md` 의 D1+D2 deliverable 은 완결 표시(`[x] 10.`)이나 `in-progress` 상태 유지 중이므로 spec 잔여 변경이 있을 수 있다.
- **제안**: `10-graph-rag.md §KB-GR-SR-05` 의 현재 본문이 `rag-dynamic-cut` 의 변경을 반영하고 있는지 확인한다. 반영됐다면 무방하고, 미반영이면 spec 선행 갱신 또는 해당 plan 완료 처리가 필요하다.

---

## 요약

`spec/5-system/` 을 구현 착수 대상으로 점검한 결과, 가장 주요한 정합 이슈는 두 가지다. 첫째, `webhook-public-ip-failopen-hardening.md` 에서 "결정 필요"로 열려 있는 IP 미식별 fail-open 처리 방향(소켓 폴백·fail-closed 전환 여부)이 아직 합의되지 않았음에도 `1-auth.md §2.3` 이 "헤더 전용·폴백 없음"을 확정 서술로 기재하고 있어, 결정 채택 시 해당 §2.3 을 함께 수정해야 한다는 plan 자체의 경고가 현 target 에 반영되지 않은 상태다. 둘째, `webhook-hardening-cleanup.md` 의 spec 잔여(C — api-convention §5.3 포인터 등)가 별도 spec PR 로 미분리되어 있어 구현 착수 전 해당 범위가 완료됐는지 확인이 필요하다. CRITICAL 수준 미해결 결정 우회는 없으나, 위 두 WARNING 항목이 방치되면 구현 완료 후 spec 재수정이 필요해질 수 있다.

## 위험도

LOW
