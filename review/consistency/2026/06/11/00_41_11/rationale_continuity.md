# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (diff-base=origin/main)
실제 변경 파일: `spec/2-navigation/4-integration.md` (3개 hunk)

---

## 발견사항

### INFO: `unknown` → `unknown_error` 에러 코드 renaming (§5.4)

- **target 위치**: `spec/2-navigation/4-integration.md` §5.4 Database 테스트 라인
- **과거 결정 출처**: 동 파일 Rationale 에는 DB error.code 정규화 명칭에 대한 별도 ADR 항목이 없음. §10.5 / §14.1 의 에러 코드 분류도 `auth_failed` / `network` 두 가지만 언급하며 세 번째 값에 대한 결정 근거가 없음.
- **상세**: 기존 `unknown` → `unknown_error` 로 이름 변경. 해당 표기는 §5.4 본문 한 곳에만 노출되며, Rationale 에 "왜 `unknown` 으로 정했는가" 에 대한 기록이 없었으므로 기각된 대안의 재도입은 아니다. 다만 변경의 근거(예: `error(auth_failed)` / `error(network)` / `error(unknown_error)` 와의 snake_case 컨벤션 통일 등)가 Rationale 에 기록되지 않았다.
- **제안**: 영향 범위가 작고 기존 Rationale 와 충돌하지 않으므로 INFO 수준. §5.4 변경 옆이나 Rationale 에 "오류 코드 정규화 컨벤션과의 통일(`error(unknown_error)`)" 한 줄 추가 권장.

---

### WARNING: cafe24 `integration_expired` passive 알림 정책 번복 — 새 Rationale 부분 기재

- **target 위치**: `spec/2-navigation/4-integration.md` §11 서두 cafe24 주석 + §11.1 `connected-expiry` 표 + 의사코드
- **과거 결정 출처**: 동 파일 `## Rationale` — **"refresh 실패 시 status_reason 통일"** 항 (line 1416 근처): `"integration_expired 알림은 expired 전이 중에서도 token_expired 경로에만 발사. error(*) 전이는 별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 integration_action_required 등 신설 검토."` (강조: "향후 신설 검토" 수준이었음)
- **상세**: 기존 Rationale 는 두 가지를 동시에 확립했다.
  1. `integration_expired` (passive) 는 refresh_token 없는 provider 의 `token_expired` 경로에만 발사.
  2. `error(*)` 전이는 **별도 알림 없이 UI 배지만** — `integration_action_required` 는 "향후 신설 검토" 상태.

  그런데 이번 변경은:
  - (1) 은 유지 (기존 정책 연장으로 `isRefreshCapable` 개념 도입).
  - (2) 를 번복: `integration_action_required` 가 이미 §11.2 에 정식 섹션으로 존재하고(현재 spec 내 line 999 이하), refresh 실패 시 이 알림이 `active` 로 발사되는 것을 §11.1 표와 의사코드에 명시.

  §11.2 의 `integration_action_required` 섹션 자체는 현재 spec 본문에 이미 정의되어 있어 — 즉 이전 어느 시점에 "향후 신설 검토" 에서 정식 채택으로 결정이 전환된 것으로 보인다. 그러나 `## Rationale` 의 해당 항("refresh 실패 시 status_reason 통일")은 여전히 옛 문구("향후 신설 검토")를 그대로 보유하고 있어 본문과 Rationale 사이에 불일치가 남아 있다.

  이번 diff 는 이 불일치를 해소하지 않고, 오히려 `connected-expiry` 스캐너 경로에서도 refresh 실패 시 `integration_action_required` 를 발사한다는 새 정책을 추가했다 — Rationale 에 대응하는 ADR 항 없이.

- **제안**:
  - `## Rationale` 의 "refresh 실패 시 status_reason 통일" 항 내 `"향후 별도 알림 타입 필요 시 integration_action_required 등 신설 검토"` 문구를 **결정 완료 문장**으로 갱신한다: `"integration_action_required 를 §11.2 에 정식 도입해 error(*) 전이 시 active 알림을 발사하도록 결정함 — passive integration_expired 와의 구분(수동 vs 능동) 원칙 유지."`.
  - 이번 diff 가 도입한 `isRefreshCapable` / makeshop 의 passive 알림 제외 결정 근거도 별도 Rationale 항으로 추가 권장 (아래 항 참조).

---

### WARNING: `isRefreshCapable` (makeshop 포함) 도입 — Rationale 항 누락

- **target 위치**: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 표, 의사코드, MakeShop 주석
- **과거 결정 출처**: 동 파일 `## Rationale` — 기존 항목들은 cafe24 에 대해서만 refresh 경로를 논했으며(§10.5, "cafe24 背景 갱신 잡" 등), makeshop 을 동일 `isRefreshCapable` 집합에 넣는 명시적 결정 근거가 Rationale 에 없다.
- **상세**: 변경 내용:
  - 기존: `service_type='cafe24' AND credentials.refresh_token 존재` → cafe24 전용 경로.
  - 변경: `isRefreshCapable = service_type ∈ {cafe24, makeshop} AND credentials.refresh_token 존재` — makeshop 을 동등하게 취급.

  이 결정은 "makeshop 은 배경-큐 없이 in-call proactive / reactive_401 만으로 커버되므로 `expired` 격하 대상에서 제외한다" 는 실질적인 정책 결정이다. 본문 MakeShop 주석에는 근거가 서술되어 있으나 (`refresh_token TTL 이 30~90일로 충분히 길어...`), 이 결정을 공식화하는 Rationale 항이 없다.

  합의된 invariant 위반 여부: `refresh 실패 시 status_reason 통일` Rationale 는 cafe24 만 대상이었고, makeshop 을 포함시키는 것이 그 원칙을 "위반"하지는 않는다. 그러나 기각된 대안(예: makeshop 도 `expired` 로 격하하는 방식)을 명시적으로 비교·거부하는 Rationale 기록이 없어 향후 reviewers 가 `isRefreshCapable` 에 makeshop 이 포함된 경위를 알기 어렵다.

- **제안**: `## Rationale` 에 `isRefreshCapable — makeshop 포함 결정` 항을 신설한다. 핵심 내용: (a) cafe24 와 makeshop 모두 refresh_token 보유 → `expired` 격하 거짓 양성 방지, (b) makeshop 은 in-call proactive/reactive_401 자가 회복으로 커버(배경-큐 불필요), (c) 기각된 대안: makeshop 을 "refresh_token 없는 provider" 와 동일하게 스캐너에서 `expired` 격하 → 정상 동작 중인 integration 이 불필요하게 재연결 요청을 받는 UX 문제.

---

## 요약

이번 diff 는 `spec/2-navigation/4-integration.md` 에서 세 가지를 변경했다: (1) DB 에러 코드 `unknown` → `unknown_error` 리네이밍, (2) cafe24·makeshop 을 `isRefreshCapable` 로 묶어 `connected-expiry` 스캐너의 passive `integration_expired` 알림 대상에서 제외, (3) refresh 실패 시 `integration_action_required` (active) 알림 발사 명시. 이 중 (1)은 Rationale 와 충돌이 없다. (2)와 (3)은 기존 Rationale 의 `error(*) 전이 = UI 배지만, integration_action_required 는 향후 신설 검토` 문구를 사실상 번복하거나 확장하는 결정이지만, 그에 상응하는 Rationale 갱신이 동반되지 않았다. 기각된 대안의 재도입은 아니고 일관성 방향으로의 진전이나, 두 WARNING 항목 모두 `## Rationale` 에 대응 항을 추가해야 미래 reviewers 가 결정 경위를 추적할 수 있다.

## 위험도

LOW
