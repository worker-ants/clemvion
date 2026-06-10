# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
검토 대상 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/spec/5-system/1-auth.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/spec/1-data-model.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/spec/data-flow/1-audit.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/spec/data-flow/15-external-interaction.md`

---

## 발견사항

### [INFO] Rate Limit 스코프 변경: 워크스페이스·invited_by 단위 → 글로벌 분당 10건

- **target 위치**: `spec/5-system/1-auth.md` §1.5.1 Rate Limit 행
- **과거 결정 출처**: `spec/5-system/1-auth.md` (origin/main) §1.5.1 Rate Limit 셀 — `"워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)"`
- **상세**: 과거 spec 은 rate limit 스코프를 "워크스페이스·invited_by 단위"(요청자 식별 기반 세분화)로 명시했고 값은 "구현 시 결정"으로 열어뒀다. 이번 변경은 스코프를 글로벌(단일 엔드포인트 전체)로 좁히고 값을 분당 10건으로 확정했다. `data-flow/12-workspace.md §1.2` 의 `INVITATION_THROTTLE` 구현값과는 일치한다. 과거 "워크스페이스·invited_by 단위" 분기는 보안 관점의 세분화 의도(특정 admin 의 남용 격리)였는데, 이번 spec 갱신은 그 의도가 왜 폐기됐는지를 Rationale 에 기록하지 않았다.
- **제안**: `spec/5-system/1-auth.md §Rationale` 에 "1.5.E — Rate Limit 스코프를 글로벌로 채택한 이유 (워크스페이스·invited_by 단위 안 채택)" 항목을 추가하거나, §1.5.1 비고 컬럼에 인라인으로 "워크스페이스 단위 분기 아님 — 구현 복잡도 대비 이득이 작고 `data-flow/12-workspace.md §1.2` INVITATION_THROTTLE 값과 일치" 정도를 부기한다. 위협 모델상 낮은 우선순위이므로 CRITICAL 은 아니지만 의도된 스코프 결정인지 우연한 생략인지 불명확하다.

---

### [INFO] 1-data-model.md User 테이블 신규 필드 추가 — 대응 Rationale 부재

- **target 위치**: `spec/1-data-model.md` §2.1 User 표 (email_verified, email_verify_token, password_reset_token, login_attempts, locked_until, oauth_provider, oauth_provider_id, notification_preferences 필드 추가)
- **과거 결정 출처**: `spec/1-data-model.md` Rationale (기존 — Execution.execution_path, install_token 형식 등 기존 항목만 존재) 및 `spec/5-system/1-auth.md §1.1` (이미 이메일 인증·비밀번호 재설정 토큰 SHA-256 해시 저장 원칙 기술됨)
- **상세**: 추가된 필드들은 기능 정의는 `spec/5-system/1-auth.md §1.1` 에 있던 기존 내용의 data model 반영(코드 동기화)이라 설계 원칙 자체를 번복하지 않는다. `spec/1-data-model.md §Rationale` 에는 이 sync 작업에 대한 설명이 없으나, 기존 Rationale 항목들의 작성 패턴("code-sync 근거 기록"도 Rationale 에 포함, 예: `spec/2-navigation/0-dashboard.md Rationale` R-1)과 비교하면 추가를 기대할 수 있다. 합의된 원칙을 위반하는 것이 아니라 기록 누락 수준이다.
- **제안**: `spec/1-data-model.md §Rationale` 에 "User 테이블 §2.1 보강 (2026-06-10 spec-sync)" 항목으로 "auth spec 에 정의된 토큰 저장·잠금·OAuth 필드를 data model SoT 에 반영 (코드 선행 구현의 spec 동기화)" 한 줄 추가. 생략해도 Rationale 연속성 위반은 아니나 일관성을 높인다.

---

### [INFO] 15-external-interaction.md Rationale — 갭 해소 이력 기록 패턴 적합성 확인

- **target 위치**: `spec/data-flow/15-external-interaction.md §Rationale` "§1.5 구현 갭 — 해소 이력 (C3 fix)" 항목
- **과거 결정 출처**: 동일 파일의 이전 버전(origin/main)에 있던 "§1.5 구현 갭을 본문에 남긴 이유" 항목
- **상세**: 이전 Rationale 항목은 "갭을 본문 callout 으로 가시화한 이유"를 설명했다. 이번 변경은 해당 항목을 "해소 이력"으로 전환하고 수정 내용을 서술한다. 과거 결정(가시화 이유)을 폐기하는 것이 아니라 갭 자체가 해소됐으므로 Rationale 항목을 역사 기록으로 업데이트하는 자연스러운 패턴이다. 합의된 원칙(secret store ref 우선 정책)을 위반하지 않으며, 번복도 아니다.
- **제안**: 현행 서술 적합. 추가 조치 불필요.

---

### [INFO] 1.5.D Rationale — 초대 토큰 raw 저장 근거 신규 추가 (기존 Rationale 와의 정합)

- **target 위치**: `spec/5-system/1-auth.md §Rationale` 1.5.D 항목 (신규)
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.1` "토큰 at-rest 저장" 행 — 이메일 인증·비밀번호 재설정 토큰은 SHA-256 해시로만 저장하는 원칙
- **상세**: SHA-256 해시 저장 원칙은 §1.1 에서 확립됐다. 초대 토큰이 raw 저장인 점은 이 원칙의 예외처럼 보일 수 있는데, 1.5.D Rationale 이 이메일 일치 강제·단일 사용·7일 만료라는 위협 모델 차이를 이유로 예외를 정당화한다. 기각된 대안("해시로 저장") 을 명시적으로 언급하면서 새 Rationale 를 함께 작성했으므로 "결정의 무근거 번복" 패턴에 해당하지 않는다. 합의된 원칙을 준수한 예외 처리다.
- **제안**: 현행 서술 적합. 추가 조치 불필요.

---

## 요약

이번 브랜치의 spec 변경(security-fixes) 에서 Rationale 연속성 관점의 CRITICAL 또는 WARNING 수준 문제는 발견되지 않았다. 가장 주목할 지점은 초대 Rate Limit 스코프 변경(워크스페이스·invited_by 단위 → 글로벌)인데, 구현값(`INVITATION_THROTTLE`)과 data-flow spec 이 이미 글로벌 스코프를 사용하고 있어 실제 동작과 일치하는 방향으로 spec 을 확정한 것이다. 다만 과거 spec 이 "워크스페이스·invited_by 단위" 를 의도했던 이유가 제거된 근거를 Rationale 에 남기지 않아 INFO 수준 보완이 권장된다. 나머지 변경들(초대 토큰 raw 저장 Rationale 1.5.D 추가, audit-log 권한 구현 갭 해소, secret 승격 갭 해소, data-model User 표 동기화)은 모두 기존 원칙과 일관성을 유지하거나 갭 해소를 명시적 Rationale 로 기록하는 패턴을 따르고 있다.

## 위험도

LOW
