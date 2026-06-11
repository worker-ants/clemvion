# 신규 식별자 충돌 검토 — auth-refresh-rotation-atomic

검토 대상 spec diff: `spec/data-flow/2-auth.md`, `spec/5-system/3-error-handling.md`, `spec/2-navigation/5-knowledge-base.md`  
기준 브랜치: `origin/main`

---

## 발견사항

### [INFO] `TOKEN_INVALID` 설명 확장 — 기존 식별자에 새 발동 시나리오 추가

- **target 신규 식별자**: `TOKEN_INVALID` (에러 코드) — 기존 설명("변조/형식 오류")에 "refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" 시나리오가 추가됨 (`spec/5-system/3-error-handling.md` 36번 줄)
- **기존 사용처**: `spec/5-system/3-error-handling.md` (에러 코드 SoT 테이블), `spec/5-system/14-external-interaction-api.md:315`, `spec/data-flow/15-external-interaction.md:270`, 코드 `auth.service.ts`, `jwt.strategy.ts`, `interaction.guard.ts` — 모두 동일한 `TOKEN_INVALID` 코드, 동일한 HTTP 401 매핑
- **상세**: 이 변경은 새 식별자를 생성하지 않는다. 기존 코드 에러 코드 `TOKEN_INVALID` 가 이미 `auth.service.ts:546/568/585/615` 에서 동일 목적(잘못된 refresh token 처리)으로 사용 중이며, 확장된 설명은 기존 의미(토큰 무효)의 부분집합이다. 클라이언트 처리 분기는 변경 없음 — 동시 회전 경합 응답도 기존 `TOKEN_INVALID` 401 경로를 그대로 타므로 외부 인터페이스 계약 변화 없음.
- **제안**: 충돌 없음. 다만 `spec/5-system/14-external-interaction-api.md:315` 의 `TOKEN_INVALID` 설명이 외부 인터랙션 토큰 컨텍스트에 특화되어 있고 원본 `3-error-handling.md` SoT 와 별도로 기술되어 있으므로, 장기적으로 SoT 참조 링크로 통합하면 좋다 (본 PR 범위 밖).

---

### [INFO] 새 Rationale 섹션 `### Refresh token 회전 원자성` — 기존 파일 내 중복 없음

- **target 신규 식별자**: `spec/data-flow/2-auth.md` Rationale 섹션 제목 "Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)"
- **기존 사용처**: `origin/main` 의 `spec/data-flow/2-auth.md` Rationale 에는 "Refresh token 의 `family_id` 단위 세션", "`login_history` 와 `audit_log` 분리", "OAuth state 의 one-shot DELETE" 3개 섹션만 존재 — 회전 원자성 섹션은 신규
- **상세**: 동일 파일 내 제목 중복 없음. 다른 spec 파일(`spec/5-system/1-auth.md` 포함)에도 동명 섹션 없음. `spec/5-system/1-auth.md` 은 refresh token rotation 을 별도 섹션으로 기술하지 않아 의미 충돌 없음.
- **제안**: 없음.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md` frontmatter `status: partial` + `pending_plans` 키 — 신규 frontmatter 필드

- **target 신규 식별자**: frontmatter 키 `pending_plans` (배열), status 값 `partial`
- **기존 사용처**: `spec/2-navigation/5-knowledge-base.md` 기존 frontmatter 는 `status: implemented`. `pending_plans` 키는 해당 파일에 없었음
- **상세**: `pending_plans` 키와 `partial` status 값이 다른 navigation spec 파일에서 이미 사용되는지 확인 필요. 이 변경은 auth data-flow 와 무관하며(동일 PR 에 혼재), 식별자 충돌보다는 schema 일관성 문제다.
- **제안**: navigation spec frontmatter 에 `pending_plans` 키가 규약에 정의되어 있는지 확인. 다른 navigation spec 파일과 일관성 유지 권장.

---

## 요약

`spec/data-flow/2-auth.md` + `spec/5-system/3-error-handling.md` 의 변경은 기존 에러 코드 식별자 `TOKEN_INVALID` 의 발동 범위를 명시적으로 확장하는 문서 업데이트다. 새 에러 코드, 새 엔티티/DTO명, 새 API 엔드포인트, 새 이벤트/큐명, 새 ENV var 는 일절 도입되지 않았다. 유일한 주의 사항은 `TOKEN_INVALID` 설명 확장이 기존 의미(토큰 무효 401)와 완전히 정합하며, 클라이언트 처리 분기 변경이 없다는 점이 코드(`auth.service.ts`, `interaction.guard.ts`)로 확인된다. `spec/2-navigation/5-knowledge-base.md` 의 `pending_plans` frontmatter 키 추가는 신규 식별자로 볼 수 있으나 충돌을 일으키지 않는다.

## 위험도

NONE

---

STATUS: OK
