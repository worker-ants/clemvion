# Plan 정합성 검토 — `spec/5-system/` (audit-record-factory)

## 검토 범위 요약

이번 작업(HEAD, `origin/main` 대비 6개 커밋)의 실제 델타:

- `spec/5-system/_product-overview.md` NF-OB-07 카탈로그에 `clemvion.audit.write_failed` 메트릭 등재 + 라벨 클램핑 원칙 문단 추가
- `spec/data-flow/1-audit.md`·`spec/data-flow/9-observability.md` 동반 갱신
- 코드: `AuditLogsService.record()` 에 카운터·유실 대상 로그 추가, `BusinessMetricsService.recordAuditWriteFailed`, `auth-configs.service.ts` 의 `AuditAction` → `AuditActionFor<...>` 좁힘, `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` + `.spec.ts` 신설
- `plan/in-progress/spec-sync-auth-gaps.md` 를 같은 커밋 계열에서 갱신 — `recordAudit` 공통 팩토리 항목을 "won't-do(가드로 대체)" 로, `audit_log 적재 실패 관측` 항목을 "완료" 로 체크하고 `login_history 축` 은 명시적으로 미결로 남김
- 신규 spec-draft(`plan/complete/spec-draft-audit-write-failed-metric.md`, 이미 draft→구현 반영 완료로 `complete/` 이동)

## 발견사항

- **[INFO]** repo-guard 3파일 패턴 누적 카운트가 이 PR 로 갱신되지 않음
  - target 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard.ts,fixture.ts}` + `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts` (신규 3파일 세트)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "같은 라운드의 별건 INFO 2" — "`repo-guard 3파일 패턴(*-guard.ts/*-fixture.ts/*.spec.ts)이 5쌍 이상 누적됐는데 소유 규약 문서가 없다. `spec/conventions/repo-guards.md` 신설 검토는 이 항목과 독립이며 더 큰 결정이라 여기 묶지 않는다(포인터만 남긴다)."
  - 상세: 이 plan 항목이 관찰한 시점(2026-08-31)에 이미 5쌍 이상이었는데, 이번 PR 이 `audit-action-binding-{guard,fixture}.ts` 를 신설해 실질적으로 6번째 세트가 됐다(`find` 로 `*-guard.ts` 6개 확인: `audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·`eslint-unicorn-peer-guard.ts`·`masked-reject-callers-guard.ts`·`production-build-devdep-guard.ts`·`redis-fail-open-catalog-guard.ts`). 그 plan 은 이 결정을 명시적으로 "독립·더 큰 결정이라 여기 묶지 않는다" 고 선언했으므로 이번 PR 이 그 결정을 대신 내려야 할 의무는 없다 — 이 지적은 미해결 결정 우회(CRITICAL)나 후속 누락(WARNING)이 아니라 단순 카운트 신선도 이슈다.
  - 제안: 차단 사유 아님. `spec-conventions-engine-error-code-surface.md` 를 다음에 다루는 사람이 "5쌍" 을 실측 갱신하면 된다 — 지금 이 PR 범위에서 조치 불요.

## 요약

`spec/5-system/_product-overview.md` NF-OB-07 카탈로그 확장(`clemvion.audit.write_failed`)은 `plan/in-progress/spec-sync-auth-gaps.md` 의 미해결 항목("`audit_log` 적재 실패에 관측 수단이 없다")을 직접 해소하는 작업이며, **같은 PR 안에서 plan 문서 자체도 함께 갱신**됐다 — 완료 항목은 체크, `login_history` 축은 명시적 미결 + 재개 신호까지 적어 뒀다(추후 conflicting 감사 불필요). `recordAudit` 공통 팩토리 항목도 원래 처방(공통 팩토리 추출)을 "가드로 대체" 로 바꾸면서 그 근거(실측 프로브·대조군)를 plan 에 남겼고, 이 처방 변경이 다른 plan/spec 의 미해결 결정과 충돌하는 지점은 찾지 못했다. `pending_plans` 프론트매터(`spec/5-system/1-auth.md`)가 가리키는 `spec-sync-auth-gaps.md` 는 여전히 다수의 미해결 항목(LDAP/SAML, `workflow.executed`, `saveCanvas` 감사, `login_history` 축 등)을 보유하므로 `in-progress` 유지가 맞다. 유일한 관찰 사항은 이번에 신설된 `repo-guards` 3파일 세트가 다른 plan(`spec-conventions-engine-error-code-surface.md`)이 추적 중인 "가드 패턴 누적" 카운트를 한 단계 더 늘렸다는 것인데, 그 plan 스스로 이 결정을 "독립·별도" 로 선언해 뒀으므로 이번 PR 이 조치할 의무는 없다(INFO, 비차단).

## 위험도

LOW
