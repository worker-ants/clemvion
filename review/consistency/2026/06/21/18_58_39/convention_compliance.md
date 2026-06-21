# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/1-auth.md` 및 이번 변경에 포함된 연관 spec 파일
(`spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`,
`spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`)

---

## 발견사항

### INFO: §1.1.B 이메일 변경 흐름 — 문서 구조 관점
- **target 위치**: `spec/5-system/1-auth.md §1.1.B` (새로 추가된 섹션)
- **위반 규약**: 없음 (INFO)
- **상세**: §1.1.B 는 핵심 설계·운영 시나리오·본문 내용을 `§1.1.B` 소절에 기술하고, 설계 근거는 `## Rationale` 절(1.1.B-1 ~ 1.1.B-6)에 분리했다. CLAUDE.md 가 권장하는 Overview / 본문 / Rationale 3섹션 구조를 파일 레벨에서 이미 갖추고 있으며, 신규 소절도 그 패턴을 준수한다.
- **제안**: 이상 없음. 현행 구조 유지 권장.

### INFO: `audit-actions.md` §3 레지스트리에 `user.email_changed` 추가 — 정확성 확인
- **target 위치**: `spec/conventions/audit-actions.md §3` (변경된 행)
- **위반 규약**: 없음 (INFO)
- **상세**: `user.email_changed` 가 `user` resource 의 과거분사(§2.1) 패턴에 추가됐다. `email_changed` 는 `changed` 말미 과거분사형이므로 §2.1 분류와 정합하고, `user.*` 네임스페이스 과거분사 규약(`password_changed`, `2fa_enabled`, `2fa_disabled`)과 일관된다. 토큰 구분자(언더스코어) 규약도 준수한다.
- **제안**: 이상 없음.

### INFO: 에러 코드 케이싱 — 신규 에러 코드 확인
- **target 위치**: `spec/5-system/1-auth.md §1.1.B` 운영 시나리오 표
- **위반 규약**: 없음 (INFO)
- **상세**: 신규 이메일 변경 흐름에서 참조된 에러 코드들(`REAUTH_NOT_AVAILABLE`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`)은 모두 기존 카탈로그 내 `UPPER_SNAKE_CASE` 코드다. `REAUTH_NOT_AVAILABLE` 은 §2.3 세션-revoke 재인증에서 재사용함을 명시했고, `RESOURCE_CONFLICT` 는 `spec/5-system/3-error-handling.md §1.2` 표준 코드다. `node-output.md §3.2` 의 `UPPER_SNAKE_CASE` 규약과 `error-codes.md §1` 의 의미 기반 명명 원칙을 모두 준수한다. `lower_snake_case` 예외(`invitation_*`)와 같은 historical-artifact 패턴은 없다.
- **제안**: 이상 없음.

### INFO: API endpoint 명명 — `/api/users/me/email-change/` 경로 세그먼트
- **target 위치**: `spec/5-system/1-auth.md §5` + `spec/2-navigation/9-user-profile.md §6.1`
- **위반 규약**: 없음 (INFO)
- **상세**: 엔드포인트 경로는 `/api/users/me/email-change/request`, `/verify`, `/resend`, `/cancel` 로 kebab-case 세그먼트를 사용한다. 기존 `/api/users/me/change-password` 와 동일 패턴이다. `spec/5-system/2-api-convention.md` 에 별도 path segment 케이싱 규약이 명문화되지 않았으나, 프로젝트 전체 endpoint 관용 패턴과 일치한다.
- **제안**: 이상 없음.

### INFO: `spec/5-system/1-auth.md §4.1.A` 참조 일관성
- **target 위치**: `spec/5-system/1-auth.md §Rationale 1.1.B-6` 마지막 문장
- **위반 규약**: 없음 (INFO)
- **상세**: "액션 분류는 §4.1.A 가 예고한 `user.*` 네임스페이스·과거분사 규약을 그대로 따른다" — 다소 어색한 표현이다. §4.1.A 는 과거 "예고"가 아니라 이미 확정된 규약이며 `audit-actions.md §3` 이 현재 SoT 다. §1.1.B-6 의 설명이 "§4.1.A 및 `audit-actions.md §2.1` 의 `user.*` 과거분사 규약을 따른다" 로 표현하면 더 정확하다.
- **제안**: 오류 수준은 아니나 사소한 표현 명확화 가능. 수정 시 "§4.1.A 및 `audit-actions.md §2.1` 규약" 으로 업데이트 권장.

---

## 요약

이번 변경(`spec/5-system/1-auth.md` §1.1.B 이메일 변경 흐름 신설, 관련 spec 갱신)은 정식 규약 준수 관점에서 전반적으로 양호하다. 신규 감사 액션 `user.email_changed` 는 `audit-actions.md §3` 레지스트리에 즉시 등재됐고, 시제(과거분사, §2.1) 및 `<resource>.<verb>` 구조·언더스코어 구분자 규약을 모두 준수했다. 신규 에러 코드는 추가 없이 기존 `UPPER_SNAKE_CASE` 코드를 재사용했다. 문서 구조는 본문/Rationale 분리 패턴을 유지하며, 엔드포인트 정의는 `§5` 에서 `9-user-profile.md §6.1` 로 위임하는 기존 방식을 일관되게 따른다. 발견사항은 모두 INFO 수준의 사소한 제안이며, CRITICAL 또는 WARNING 항목이 없다.

## 위험도

NONE
