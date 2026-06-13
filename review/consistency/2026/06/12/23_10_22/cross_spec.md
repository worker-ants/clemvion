# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-draft-audit-workspace-scope.md`
검토 모드: `--spec`

---

## 발견사항

### 결정 1 — `user.*` 감사 이벤트 workspace 귀속

- **[INFO]** 귀속 규칙 추가는 기존 §4.1 분류와 정합
  - target 위치: 결정 1 전체 (§4.1 Planned 표 + 새 Rationale `4.1.B` + `data-flow/1-audit.md §1.1`)
  - 충돌 대상: 없음 (기존 spec 과 모순 없음)
  - 상세: `spec/5-system/1-auth.md §4.1` 은 `user.password_changed` / `user.2fa_enabled` / `user.2fa_disabled` 를 "인증 (워크스페이스 컨텍스트)" Planned 액션으로 이미 명시했으며, `login/logout/login_failed → LoginHistory` 분류 규칙도 §4.1 L379 에 확립되어 있다. target 이 추가하는 "액터 세션 workspaceId 에 귀속" 규칙은 열린 문제에 답하는 것이며 기존 정의와 모순되지 않는다.
  - 제안: 해당 없음.

- **[WARNING]** `reset-password` → `login_history` 라우팅이 기존 LoginHistory enum 범위를 벗어남
  - target 위치: 결정 1 엣지 — "무인증 password-reset: … `login_history` 에 기록한다(또는 미기록)"
  - 충돌 대상: `spec/5-system/1-auth.md §4.3` · `spec/1-data-model.md §2.18.2` (LoginHistory 이벤트 enum 7종 + DB CHECK 제약 `chk_login_history_event`)
  - 상세: 현행 LoginHistory `event` enum 은 `login_success / login_failed / totp_failed / webauthn_failed / logout / session_revoked / token_reuse_detected` 7종만 정의되어 있고(`spec/1-data-model.md §2.18.2`, V040 + V058), DB CHECK 제약 `chk_login_history_event` 도 이 7종만 허용한다. `POST /auth/reset-password` 에 해당하는 `password_reset_completed` 류 이벤트는 enum 에 없다. target 이 "login_history 에 기록한다" 를 선택할 경우 신규 enum 값 추가 + 마이그레이션(`chk_login_history_event` DROP+ADD, V058 선례) 이 필요하다. target 은 이를 명시하지 않았고 "또는 미기록" 이라는 유보 표현을 병기했다. 명확한 결론이 없으면 이후 developer 가 login_history INSERT 를 시도해 DB CHECK 위반으로 런타임 에러가 발생할 수 있다.
  - 제안: 결정 1 에서 reset-password 경로를 "미기록" 으로 명확히 확정하거나, 기록하기로 한다면 어떤 event 값을 사용할지(신규 enum 값 추가 포함) 및 필요한 마이그레이션 V번호까지 함께 결정한다. 애매한 "(또는 미기록)" 이분지를 제거한다. `spec/1-data-model.md §2.18.2` 와 `spec/5-system/1-auth.md §4.3` 의 LoginHistory event 목록도 함께 갱신 필요.

### 결정 2 — IP 추출 헤더 기반은 by-design (1b)

- **[INFO]** 기존 §Rationale 2.3.B 서술과 방향 일치 — 표현 보강에 해당
  - target 위치: 결정 2 전체 (§Rationale 2.3.B 에 1~2줄 추가)
  - 충돌 대상: `spec/5-system/1-auth.md §2.3 클라이언트 IP 행` · `§Rationale 2.3.B 클라이언트 IP 신뢰 (m-3)` 단락
  - 상세: §Rationale 2.3.B 는 이미 "본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용한다"고 명시하고 있다. target 이 추가하려는 내용(CF Tunnel 에서 `req.ip` 우선화가 부정확하므로 헤더 기반 XFF 유지)은 기존 서술과 방향이 같다. 단, 기존 §2.3 표의 클라이언트 IP 행은 폴백 순서를 `X-Forwarded-For 첫 IP → req.ip(trust proxy) → req.socket.remoteAddress` 로 기술하여 `req.ip` 를 폴백으로 포함하는데, target 은 "`req.ip` 우선화는 채택하지 않는다"고 표현한다. 두 서술은 의미가 같으므로(XFF 가 먼저, req.ip 는 폴백) 충돌이 아니다. 그러나 코드의 `extractClientIp` (`hooks`)가 실제로 `req.ip` 폴백 자체를 제거하고 XFF 전용으로 구현되어 있다면 spec §2.3 표의 폴백 순서 서술도 동기화가 필요하다.
  - 제안: target 의 1~2줄 추가 전에, 현재 코드(`extractClientIp`)가 `req.ip` 폴백을 유지하는지 확인한다. 폴백을 유지한다면 §2.3 표(폴백 순서)와 추가 Rationale 문구를 일치시킨다. 폴백을 제거했다면 §2.3 표에서 "`req.ip(trust proxy)` 폴백" 항목을 함께 제거해야 spec 과 코드가 일치한다.

---

## 요약

target 이 제안하는 두 결정은 기존 `spec/5-system/1-auth.md` · `spec/data-flow/1-audit.md` · `spec/1-data-model.md` 와 직접 모순되는 부분이 없다. 결정 1 의 session-workspaceId 귀속 규칙은 기존 §4.1 분류를 구체화하는 보완이고, 결정 2 의 IP 헤더 기반 설계 재확인은 §Rationale 2.3.B 의 기존 서술과 방향이 같다. 다만 결정 1 에서 `reset-password` 경로의 login_history 기록 여부가 "(또는 미기록)" 으로 이분화된 채 열려 있고, 기록하기로 할 경우 현행 LoginHistory event enum 7종 및 DB CHECK 제약 범위를 벗어나 마이그레이션이 필요한 미결 결정이 포함되어 있다. 이 애매함이 해소되지 않은 채 developer 가 구현에 착수하면 런타임 DB 오류 가능성이 있다.

---

## 위험도

LOW
