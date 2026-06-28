# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/webhook-spec-pointer-cleanup.md`
검토 기준: `plan/in-progress/**` 미해결 결정과의 충돌, 선행 plan 미해소, 후속 항목 누락

---

## 발견사항

### 발견사항 1

- **[WARNING]** P-2 의 "Guard 의 trigger DB 조회 실패 시 fail-open + error 레벨 로깅" 추가가 `webhook-public-ip-failopen-hardening.md` 의 미결 결정과 부분 중첩
  - target 위치: `plan/in-progress/webhook-spec-pointer-cleanup.md §필수 P-2` — `spec/7-channel-web-chat/4-security.md §4 + R3` 에 Guard trigger DB 조회 실패 시 fail-open + error 레벨 로깅 언급 추가를 명시
  - 관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md §결정 필요` — fail-open 강화 정책(fail-closed 전환 여부, req.socket 폴백, 인프라 vs 앱 레벨)이 모두 미결(사용자/보안 결정 선행 필요)이며, "결정 확정 후 spec(`12-webhook.md §6·WH-SC-05·Rationale`) 반영"을 후속으로 명시
  - 상세: P-2 가 추가하려는 내용("Guard 의 trigger DB 조회 실패 시 fail-open + error 레벨 로깅")은 이미 `12-webhook.md §6`(line 330)과 Rationale `공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅`(line 433-439)에 구현 SoT 로 기술되어 있다. 반면 `webhook-public-ip-failopen-hardening.md` 는 fail-open 정책 자체의 강화(fail-closed 전환·소켓 폴백 등)를 미결 상태로 두며, 결정 후 `12-webhook.md §6·Rationale` 을 갱신할 예정이다. P-2 가 `4-security.md §4 + R3` 에 추가하는 내용은 현행 정책(fail-open + error 로깅)을 cross-reference 포인터로 언급하는 범위라, `webhook-public-ip-failopen-hardening.md` 의 결정이 나와 `12-webhook.md §6` 이 바뀌면 `4-security.md §4` 의 포인터도 연동해 갱신해야 한다. 즉 P-2 는 현재 SoT 의 단순 포인터이므로 결정을 일방적으로 내리는 것은 아니나, `webhook-public-ip-failopen-hardening.md` 의 결정이 확정되면 본 target 의 P-2 결과물도 재검토가 필요할 수 있다.
  - 제안: 현재 P-2 는 현행 확정된 구현 사실(fail-open + error 레벨 로깅)을 `4-security.md §4+R3` 에 포인터로 추가하는 것이라 차단은 불필요하다. 단, P-2 수행 후 `webhook-spec-pointer-cleanup.md` 에 "향후 `webhook-public-ip-failopen-hardening.md` 결정 시 P-2 결과물(`4-security.md §4+R3`) 재검토 필요"라는 note 를 추가해 후속 누락을 방지한다.

### 발견사항 2

- **[INFO]** `webhook-public-ip-failopen-hardening.md §후속` 의 `1-auth.md §2.3` 갱신 필요 조건이 P-3 범위와 중첩
  - target 위치: `plan/in-progress/webhook-spec-pointer-cleanup.md §선택 P-3` — `1-auth.md Rationale 2.3.B (m-3)` 에 `extractClientIpFromHeaders` 함수명과 파일 경로 명시, `12-webhook.md §7e·§8b` 에 역참조 추가
  - 관련 plan: `plan/in-progress/webhook-public-ip-failopen-hardening.md §후속` — "결정 2(`req.socket.remoteAddress` 폴백)·3(fail-closed) 채택 시 `1-auth.md §2.3` 행도 함께 갱신 필요"라고 명시
  - 상세: P-3 는 현행 확정된 `extractClientIpFromHeaders` 함수명을 Rationale 에 추가 명시하는 것이고, `webhook-public-ip-failopen-hardening.md` 의 결정이 나오면 같은 §2.3 행이 다시 갱신될 수 있다. 중복 편집으로 인한 merge-time 충돌 가능성은 있으나, P-3 는 Rationale(m-3) 명시이고 failopen 결정은 세션 정책 행 갱신이므로 같은 행을 덮어쓰는 것은 아니다.
  - 제안: 추적 메모 수준. P-3 수행 후 `webhook-public-ip-failopen-hardening.md` plan 의 `§후속` 항목에 "P-3(`webhook-spec-pointer-cleanup`) 으로 Rationale 2.3.B m-3 에 함수명 추가됨 — 결정 확정 시 §2.3 세션 정책 행 갱신과 분리하여 적용 가능"을 기록하면 충분하다.

### 발견사항 3

- **[INFO]** `webhook-hardening-cleanup.md` 의 `push + PR` 단계가 미완료인 채로 본 target plan 이 파생됨
  - target 위치: `plan/in-progress/webhook-spec-pointer-cleanup.md §범위` 서두 — "상위 plan `webhook-hardening-cleanup.md` §범위 밖" 에서 분리 예고된 작업이라 명시
  - 관련 plan: `plan/in-progress/webhook-hardening-cleanup.md §워크플로` — `push + PR` 단계만 미완료(`[ ]`)이고 나머지 단계는 모두 완료(`[x]`)
  - 상세: target plan 이 상위 plan 에서 `push + PR` 이 완료되기 전에 신설됐다. 상위 plan 의 잔여 단계는 본 target 에 논리적 의존성이 없으며(코드 변경 아닌 spec-only 작업), 독립적으로 진행 가능하다.
  - 제안: 의존성 없음. 단순 추적 메모 — 상위 plan 이 PR 올라갈 때까지 target 을 대기할 필요 없음.

---

## 요약

target plan `webhook-spec-pointer-cleanup.md` 는 PR #762·#763·#765 이후 남겨진 spec-only 정비 작업을 정확히 한정하고 있으며, 미해결 결정을 일방적으로 우회하는 항목은 없다. 주요 주의 사항은 P-2 가 포인터로 추가하는 "Guard trigger DB 조회 실패 시 fail-open + error 로깅" 내용이 이미 `12-webhook.md §6·Rationale` 의 확정 SoT 를 반영하는 것이라 현재로서는 충돌이 없으나, `webhook-public-ip-failopen-hardening.md` 의 결정이 나와 해당 SoT 가 변경되면 `4-security.md §4+R3` 의 P-2 결과물도 연동 갱신이 필요하다는 점이다. 이 후속 연결을 plan 에 note 로 추가하면 충분하고 작업 차단 수준은 아니다.

---

## 위험도

LOW
