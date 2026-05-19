# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
검토 범위: Cafe24 background refresh cron 주기 단축 (24h → 6h) + cutoff 마진 격상 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` 10일 → 7일)
대상 파일:
- `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts`
- `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`

---

## 발견사항

### [INFO] 신규 식별자 도입 없음 — 순수 값 변경

- target 신규 식별자: 없음. plan 이 명시한 대로 "신규 spec / 식별자 없음"이며 기존 상수명(`REFRESH_PROACTIVE_THRESHOLD_DAYS`)·큐 이름(`cafe24-token-refresh`)·스케줄러 ID(`cafe24-background-refresh-daily`)·잡 이름(`cafe24-background-refresh`) 모두 그대로 보존된다.
- 기존 사용처: 위 식별자들은 아래 파일에서 충돌 없이 동일 의미로 사용 중.
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-bg-refresh-tuning-fb72d5/codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts` (정의)
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-bg-refresh-tuning-fb72d5/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` (소비)
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-bg-refresh-tuning-fb72d5/codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` (소비)
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-bg-refresh-tuning-fb72d5/codebase/backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.ts` (소비)
- 상세: 충돌 없음.
- 제안: 해당 없음.

---

### [WARNING] spec 의 `10d` 임계 하드코딩이 코드 변경 후 불일치를 유발

- target 신규 식별자: 해당 없음 (이 항목은 신규 도입이 아니라 기존 값 변경으로 인한 spec 드리프트 위험 경고).
- 기존 사용처 (spec 에 `10d` 또는 `10일` 을 명시한 위치):
  - `/Volumes/project/private/clemvion/spec/0-overview.md` 라인 90 — "10일 임계 백그라운드 갱신"
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 821 — "`lastRotatedAt < now - 10d OR IS NULL`"
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 842 — "10일 임계 = refresh_token 14일 - 4일 안전 마진"
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 1207 — `### cafe24-background-refresh 10일 임계 (2026-05-16)` 섹션 제목
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 1211 — "`lastRotatedAt < now - 10d OR IS NULL`"
  - `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md` 라인 1384 — "`last_rotated_at < now - 10d OR IS NULL`"
  - `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md` 라인 137 — "`last_rotated_at < now-10d OR last_rotated_at IS NULL`" + "임계 근거: refresh_token 14일 - 4일 안전 마진"
  - `/Volumes/project/private/clemvion/spec/data-flow/5-integration.md` 라인 181 (sequence diagram) — "`last_rotated_at < now-10d OR last_rotated_at IS NULL`"
- 상세: `REFRESH_PROACTIVE_THRESHOLD_DAYS` 가 코드에서 7로 변경되면 위 spec 위치들은 여전히 `10d` / "4일 안전 마진" 으로 남아 있어 spec ↔ 구현 불일치가 된다. plan 은 이를 인지하고 후속 항목("project-planner 위임")으로 명시해 두었다. 본 검토 범위(--impl-prep)에서는 구현 착수를 차단할 수준의 식별자 충돌은 아니나, 코드 머지 전 또는 직후 spec 갱신 없이 방치하면 미래 검토자에게 혼선을 준다.
- 제안: 구현 PR 머지 직후 project-planner 가 위 spec 위치들을 "7d" / "7일 임계 = refresh_token 14일 - 7일 안전 마진 (50%)" 로 일괄 갱신. 또한 `spec/data-flow/5-integration.md` 라인 137·181 의 scheduler 주기 기술("일일", sequence diagram 내 cron 표시)도 "매 6시간 (0 */6 * * *)" 로 함께 갱신 필요.

---

### [INFO] scheduler 설명 로그 문자열 "daily 00:00 UTC" — 식별자 충돌 아님

- target 신규 식별자: 해당 없음.
- 기존 사용처: `integration-expiry-scanner.service.ts` 라인 129 의 `logger.log` 문자열 `"... cafe24-background-refresh (daily 00:00 UTC)"`.
- 상세: 이 문자열은 식별자가 아니라 운영 로그 메시지이므로 BullMQ 동작에 영향을 주지 않는다. 그러나 구현 변경 후 6h 주기로 바뀐 cafe24-background-refresh 를 여전히 "daily 00:00 UTC" 로 출력하면 온콜 운영자에게 혼선을 줄 수 있다. plan 이 이 로그 갱신을 변경 범위에 명시해 두었으므로 충돌이 아닌 이행 사항으로 기록.
- 제안: plan §2 의 지시에 따라 로그 문자열을 `"... cafe24-background-refresh (every 6h)"` 등으로 갱신.

---

## 요약

이번 구현 변경(cafe24 background refresh cron 24h→6h, `REFRESH_PROACTIVE_THRESHOLD_DAYS` 10→7)은 어떠한 신규 식별자도 도입하지 않는다. 기존 상수명·큐 이름·스케줄러 ID·잡 이름은 전부 보존되므로 식별자 레벨의 충돌은 전무하다. 단, 코드 값이 변경되면 spec 여러 위치에 하드코딩된 `10d` / "4일 안전 마진" 기술이 불일치 상태가 된다. plan 이 이를 후속 project-planner 위임으로 명시했으므로 구현 착수를 차단하는 CRITICAL 충돌은 없다.

## 위험도

LOW
