# Cross-Spec 일관성 검토 결과

**대상**: `spec/data-flow/2-auth.md` (refresh token 회전 원자화 변경)  
**검토 모드**: 구현 완료 후 (--impl-done), scope=spec/data-flow/, diff-base=origin/main  
**검토 일시**: 2026-06-11

---

## 발견사항

### 발견사항 1

- **[INFO]** `spec/5-system/1-auth.md §2.4` 의 토큰 갱신 플로우 설명이 data-flow 와 미동기
  - target 위치: `spec/data-flow/2-auth.md §1.4` — 단일 트랜잭션 박스 + 조건부 UPDATE + TOCTOU 차단 설명이 신규 추가됨
  - 충돌 대상: `spec/5-system/1-auth.md §2.4 토큰 갱신 플로우` (4단계 bullet list: "이전 Refresh Token 즉시 무효화 → 새 토큰 발급") — 단일 트랜잭션·조건부 UPDATE(TOCTOU 차단) 개념이 반영되어 있지 않음
  - 상세: `data-flow/2-auth.md §1.4` 는 이번 변경에서 "revoke + INSERT 가 단일 DB 트랜잭션으로 원자화되며, revoke 는 `is_revoked=false AND expires_at>now` 조건부 UPDATE" 임을 명시했다. `1-auth.md §2.4` 는 여전히 "3. 새 Access Token + 새 Refresh Token 발급 / 4. 이전 Refresh Token 즉시 무효화" 의 순서형 2단계 서술로 남아 있어 단일 트랜잭션 원자화와 TOCTOU 이중회전 차단 보장이 보이지 않는다. 직접 모순은 아니지만 `1-auth.md` 를 먼저 읽는 독자가 "발급 후 무효화" 순서로 오해할 수 있다.
  - 제안: `spec/5-system/1-auth.md §2.4` 의 3~4단계 설명에 "(revoke + INSERT 는 단일 트랜잭션 원자화 — [data-flow §1.4](../data-flow/2-auth.md))" 한 줄 링크 보강. 별도 maigration/rewrite 불요, 링크 추가 수준.

### 발견사항 2

- **[INFO]** `spec/5-system/1-auth.md §2.3` 세션 정책의 "동시 세션 5개 / 초과 시 오래된 세션 자동 종료 / 비활동 30일 만료" 가 구현 코드 및 data-flow 와 불일치
  - target 위치: `spec/data-flow/2-auth.md §1.4` — refresh 회전 시 세션 수 상한·자동 종료 로직 언급 없음
  - 충돌 대상: `spec/5-system/1-auth.md §2.3 세션 정책` 표 ("동시 세션: 기본 5개 (관리자 설정 가능) / 초과 시: 가장 오래된 세션 자동 종료 / 비활동 만료: 30일간 미사용 시 무효화")
  - 상세: `codebase/backend/src/modules/auth/auth.service.ts` 를 전체 탐색한 결과 MAX_SESSION 상수, 오래된 세션 정리 로직, 비활동 만료 배치가 존재하지 않는다. `rememberMe=true` 면 30일, `false` 면 7일의 **절대 만료**만 있고 비활동 기반 만료는 없다. 본 발견은 이번 PR 변경(회전 원자화) 과 직접 관련은 없으나, `1-auth.md §2.3` 의 기술이 구현 현실과 이미 벌어진 상태임을 교차 확인했다. 기존 gap 이며 이번 target 변경이 새로 만든 모순은 아님.
  - 제안: `spec/5-system/1-auth.md §2.3` 의 "동시 세션 / 초과 시 자동 종료 / 비활동 만료" 항목을 "미구현(Planned)" 주석으로 표기하거나 실제 구현 사실(절대 만료 7d/30d만)으로 수정. 이번 PR 범위 밖 — 별도 spec 수정 plan 으로 위임 권장.

### 발견사항 3

- **[INFO]** `spec/data-flow/2-auth.md §1.4` 의 Rationale 에서 `refactor/05-database.md` C-1 을 직접 인용 — plan 파일 링크가 spec 내부에 있음
  - target 위치: `spec/data-flow/2-auth.md §1.4` Rationale 단락 — `(**refactor/05-database.md** C-1)` 인용
  - 충돌 대상: `plan/in-progress/refactor/05-database.md` — plan 파일, spec 이 아님
  - 상세: Spec 문서가 `plan/` 경로를 직접 참조하는 것은 라이프사이클 불일치다. plan 은 이동·완료될 수 있어 링크가 불안정해진다. `plan/complete/auth-refresh-rotation-atomic.md` 로 이동된 이후 링크가 깨지는 경로. 직접 모순은 아니나 long-term 유지보수 관점에서 INFO.
  - 제안: `spec/data-flow/2-auth.md §1.4` Rationale 의 `refactor/05-database.md C-1` 언급을 spec 자체 설명으로 대체하거나, 이미 `plan/complete/` 로 이동된 경우 참조를 제거하고 동작 사실만 서술.

---

## 요약

이번 target 변경(`spec/data-flow/2-auth.md §1.4` refresh 회전 원자화 + TOCTOU 차단 명시)은 기존 `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`, `spec/1-data-model.md §2.18.1` 과 직접 모순을 일으키지 않는다. `3-error-handling.md` 의 `TOKEN_INVALID` 설명은 동일 PR 에서 함께 갱신되어 일관성이 유지된다. `1-data-model.md §2.18.1` 의 `refresh_token` 스키마(entity 코드 포함)도 변경 없이 일치한다. INFO 수준으로 `1-auth.md §2.4` 의 갱신 플로우 설명이 단일 트랜잭션 원자화를 미반영하고 있어 동기화 권장되며, 기존에 벌어진 `1-auth.md §2.3` 세션 정책의 구현 미반영 gap 도 별도 plan 으로 처리를 권고한다. 전반적으로 Cross-Spec 일관성 위험도는 낮다.

---

## 위험도

LOW

---

STATUS: SUCCESS
