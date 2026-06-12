# 신규 식별자 충돌 검토 결과

대상 문서: `spec/5-system/1-auth.md`

---

## 발견사항

### INFO-1: Planned 감사 액션 `password_change` vs `user.password_changed` 혼재 표기
- **target 신규 식별자**: target §4.1 Planned 표에 `user.password_changed` (Rationale §4.1.A 에서 확정)
- **기존 사용처**: `spec/data-flow/1-audit.md` §1.1 커버리지 갭 행에 `password_change 등` (dot-prefix 없는 옛 표기) — 해당 줄 원문: `인증(password_change 등) 액션은 **모두 미구현**이다`
- **상세**: target 의 Rationale §4.1.A 는 `user.password_changed` 로 확정했으나 data-flow §1.1 은 아직 옛 표기 `password_change` 를 유지 중이다. 동일 미구현 액션을 두 문서가 다른 이름으로 지칭해 혼동 가능하다. Planned 액션이라 코드 의존이 없으므로 파급이 낮다.
- **제안**: `spec/data-flow/1-audit.md` §1.1 의 `password_change` 를 `user.password_changed`, `2fa_enable/disable` 을 `user.2fa_enabled`/`user.2fa_disabled` 로 갱신해 target 과 일치시킨다.

---

### INFO-2: `GET /api/auth/oauth/providers` endpoint 가 target §5 표에 누락
- **target 신규 식별자**: target §5 API 표에는 `GET /api/auth/oauth/:provider`, `GET /api/auth/oauth/:provider/callback` 만 정의됨
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §8 API 표에 `GET /api/auth/oauth/providers` (활성화된 OAuth provider 목록, 5분 캐싱) 가 추가로 정의됨
- **상세**: 충돌(중복 정의)은 아니며 target 이 `10-auth-flow.md` 를 "기존 엔드포인트 + 추가" 구조로 참조한다고 해석할 수 있다. 그러나 target §5 는 Auth 모듈 전체 엔드포인트의 SoT 를 표방하므로 해당 행이 빠지면 완전성 문제가 생긴다.
- **제안**: target §5 에 `GET /api/auth/oauth/providers` 행을 추가하거나, §5 표 상단에 "10-auth-flow.md §8 표와 보완 관계" 임을 명시한다.

---

### INFO-3: `POST /api/auth/verify-email` 및 `POST /api/auth/check-email` endpoint 가 target §5 표에 누락
- **target 신규 식별자**: target §5 는 회원가입·로그인·OAuth·초대 관련 경로를 열거하나 `verify-email`/`check-email` 은 미포함
- **기존 사용처**: `spec/2-navigation/10-auth-flow.md` §8 에 두 경로 모두 정의됨. `spec/data-flow/2-auth.md` 에도 `POST /api/auth/verify-email`·`POST /api/auth/resend-verification` 이 나타남
- **상세**: INFO-2 와 동일한 완전성 문제. 새 경로가 아니라 기존 경로이므로 충돌은 아니나 target §5 를 SoT 로 읽으면 해당 엔드포인트가 존재하지 않는 것처럼 보인다.
- **제안**: target §5 에 `POST /api/auth/verify-email`, `POST /api/auth/check-email` 행을 추가하거나 보완 관계를 명시한다.

---

### INFO-4: `auth_config.reveal` verb 표기 일관성 확인
- **target 신규 식별자**: target §4.1 기록 대상 표에 `auth_config.reveal` (현재 구현 동사 현재형)
- **기존 사용처**: `spec/2-navigation/6-config.md` §120 `audit_log 에 action='auth_config.reveal' 기록`, `spec/5-system/12-webhook.md` §368 — 동일 표기
- **상세**: 충돌 없음. target 과 기존 사용처가 일치한다. 확인 차원에서 기록.
- **제안**: 조치 불필요.

---

## 요약

`spec/5-system/1-auth.md` 가 도입하거나 확정하는 식별자(감사 액션명·env var·API endpoint·에러 코드·JWT kind·이벤트명)는 기존 코드베이스 및 여타 spec 파일과 대체로 정합하게 사용되고 있다. 실질적 충돌은 발견되지 않았다. 다만 두 가지 INFO 등급 문제가 식별됐다: (1) Planned 감사 액션 `password_change` 가 target 에서는 `user.password_changed` 로 확정됐으나 `spec/data-flow/1-audit.md` §1.1 은 아직 옛 표기를 유지 중이어서 두 문서가 동일 대상을 다른 이름으로 지칭한다. (2) target §5 API 표가 `spec/2-navigation/10-auth-flow.md` §8 에 정의된 일부 Auth 엔드포인트(`GET /api/auth/oauth/providers`, `POST /api/auth/verify-email`, `POST /api/auth/check-email`)를 빠뜨려 완전성이 떨어진다. 두 문제 모두 운영상 혼선을 일으키는 수준은 아니며 문서 동기화 차원에서 보완이 권장된다.

---

## 위험도

LOW
