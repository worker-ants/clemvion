# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
검토 일시: 2026-06-11

---

## 발견사항

### [CRITICAL] Refresh 토큰 회전 원자성 Rationale 삭제 — 합의된 설계 결정 기록 소멸

- **target 위치**: `spec/data-flow/2-auth.md` — §1.4 시퀀스 다이어그램(트랜잭션 박스 + 조건부 UPDATE 분기 삭제) 및 `## Rationale` 섹션의 "Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)" 항목 전체 삭제
- **과거 결정 출처**: `spec/data-flow/2-auth.md` `## Rationale` > "Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)" (origin/main 기준 §341–357) 및 `plan/complete/auth-refresh-rotation-atomic.md`
- **상세**:

  `origin/main` 에서 `plan/complete/auth-refresh-rotation-atomic.md`(refactor 05 C-1, 2026-06-11 완료)가 다음 두 가지를 확정했다.

  1. **트랜잭션 원자성**: 회전 정상 분기의 revoke(UPDATE) + 신규 토큰 INSERT 를 `dataSource.transaction` 단일 트랜잭션으로 묶어 중간 실패 시 세션 소실 제거.
  2. **조건부 UPDATE + TOCTOU 차단**: revoke 는 `WHERE id = row.id AND is_revoked = false AND expires_at > now` 조건부 UPDATE 로 수행해, `affected = 0` 이면 동시 회전 경합으로 판정해 `TOKEN_INVALID` 로 거부.

  이 두 결정에 대한 Rationale 전체(세션 소실 방지·TOCTOU 차단·동시 유효 토큰 창 방지·JWT sign 분리의 근거)가 현재 브랜치의 `spec/data-flow/2-auth.md` diff 에서 **삭제**됐다. 시퀀스 다이어그램도 트랜잭션 박스와 `affected = 0` 분기가 제거되어, origin/main 이 확정한 설계가 spec 에서 사라졌다.

  `plan/complete/auth-refresh-rotation-atomic.md` 는 "spec 갱신: `data-flow/2-auth.md §1.4` 시퀀스에 트랜잭션 박스 1개" 를 완료 조건으로 체크했으므로, 본 삭제는 해당 완료 계획의 spec 산출물을 무근거로 번복하는 것이다.

- **제안**:
  - `spec/data-flow/2-auth.md §1.4` 의 시퀀스 다이어그램에 `rect` 트랜잭션 박스 + `affected = 0 이면 (동시 회전 경합) 401 TOKEN_INVALID` 분기를 복원한다.
  - `## Rationale` 섹션의 "Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)" 항목(세션 소실 방지·TOCTOU 차단·JWT sign 분리 근거 포함)을 복원한다.
  - 만약 이 브랜치의 `auth.service.ts` 구현이 실제로 조건부 UPDATE 없이 단순 `WHERE id` UPDATE 로 후퇴했다면, 그에 맞는 새 Rationale("TOCTOU 방어를 포기한 이유") 를 명시적으로 작성해야 한다.

---

### [CRITICAL] `TOKEN_INVALID` 에러 코드 설명에서 "동시 회전 경합" 케이스 제거 — 합의된 에러 코드 SoT 번복

- **target 위치**: `spec/5-system/3-error-handling.md` §1 에러 코드 표 — `TOKEN_INVALID` 행의 설명에서 "refresh 회전 시 조건부 revoke 매칭 0건(동일 토큰 동시 회전 경합 — data-flow §1.4)" 부분 삭제. 현재: `변조/형식 오류` 만 남음.
- **과거 결정 출처**: `spec/5-system/3-error-handling.md` `TOKEN_INVALID` 행 (origin/main 기준 §36), `plan/complete/auth-refresh-rotation-atomic.md`의 체크리스트 항목 "I6(TOKEN_INVALID SoT) 반영"
- **상세**:

  `plan/complete/auth-refresh-rotation-atomic.md` 의 체크리스트 "I6(TOKEN_INVALID SoT) 반영" 이 명시적으로 `3-error-handling.md` 의 `TOKEN_INVALID` 설명을 조건부 회전 경합 케이스까지 포함하도록 갱신하는 것을 완료 조건으로 담았다. 이를 이 브랜치가 "refresh 토큰 미존재/소유자 부재" 와 함께 "조건부 revoke 매칭 0건" 설명을 모두 삭제해 에러 코드의 용도 범위를 좁혀버렸다. 새로운 Rationale 없이 이루어진 번복이다.

- **제안**:
  - `TOKEN_INVALID` 설명을 원래대로 복원한다: `변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동일 토큰 동시 회전 경합)`.
  - 만약 구현에서 조건부 UPDATE 가 실제로 제거됐다면, 그 에러 케이스 자체가 없어진 것이므로 해당 분기를 제거한 이유를 Rationale 로 명시해야 한다.

---

### [WARNING] `spec/5-system/1-auth.md §2.1` — 새 `JWT_SECRET` fail-closed 설명이 Rationale 대신 본문에 인라인 삽입됨

- **target 위치**: `spec/5-system/1-auth.md` §2.1 세션 토큰 표 직하에 추가된 blockquote (새 내용)
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale` (기존 Rationale 섹션) — 설계 근거는 본문에 inline 으로 두지 않고 `## Rationale` 섹션에 분리하는 CLAUDE.md 원칙("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")
- **상세**:

  `JWT_SECRET` fail-closed 가드 추가는 가치 있는 변경이나, 그 설계 근거("기본 secret 으로 서명하면 인증 우회 가능" 이유 등)가 `## Rationale` 섹션이 아닌 §2.1 본문 blockquote 안에 inline 으로 삽입됐다. spec 문서 구성 원칙("본문은 latest-only 사실, 왜 이 선택인가는 Rationale 섹션")에 부분적으로 어긋난다. blockquote 내용의 분량이 짧고 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 가드 패턴의 참조 내용이 주를 이루므로 CRITICAL 이 아닌 WARNING 으로 분류한다.

- **제안**:
  - `1-auth.md §2.1` blockquote 의 설계 근거 내용을 `## Rationale` 섹션의 별도 항목("JWT_SECRET production fail-closed, refactor 04 C-1")으로 이동하고, §2.1 blockquote 는 사실 기술("JWT_SECRET 미설정/예시 키면 부팅 거부. 근거: Rationale §JWT_SECRET")로 압축한다.
  - 동일하게 `spec/5-system/11-mcp-client.md §3.2` 의 `MCP_ALLOW_INSECURE_URL` fail-closed 추가도 같은 패턴 검토.

---

### [WARNING] `spec/conventions/secret-store.md §3.3` — `ENCRYPTION_KEY` fail-closed 근거를 Rationale 섹션 없이 본문에만 기술

- **target 위치**: `spec/conventions/secret-store.md §3.3` 마스터키 절에 추가된 bullet point
- **과거 결정 출처**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**:

  `ENCRYPTION_KEY` placeholder 차단(refactor 04 M-4)의 설계 근거("예시 키로 운영 시 secret store 사실상 평문" 이유 등)가 `## Rationale` 섹션 없이 §3.3 본문에 직접 inline 됐다. `secret-store.md` 에 Rationale 섹션 자체가 없어 이 패턴은 기존 본문 서술 방식과 일관하나, 의사결정 근거가 본문과 섞인다.

- **제안**:
  - `secret-store.md` 에 `## Rationale` 섹션을 추가하고 "ENCRYPTION_KEY 예시 키 production 차단 (refactor 04 M-4)" 항목으로 이동한다. 또는 기존 문서 스타일(Rationale 무섹션)을 의도적으로 유지한다면 그 이유를 명시한다.

---

### [INFO] `spec/5-system/7-llm-client.md` — `assertProductionConfig` 로의 통합 설명이 Rationale 부재

- **target 위치**: `spec/5-system/7-llm-client.md` LLM_STUB_MODE 프로덕션 차단 설명 수정
- **과거 결정 출처**: 기존 `7-llm-client.md` — "main.ts 부팅 가드가 ... fail-closed 로 throw"
- **상세**:

  `assertProductionConfig` 로의 가드 통합(refactor 04 C-1)을 설명하는 문구 변경은 사실 기술의 갱신이라 Rationale 번복이 아니다. 다만 "왜 가드들을 하나로 응집했나" (단일 진실·테스트 커버리지 등) 근거가 어느 spec 의 Rationale 에도 명시되지 않았다. `production-guards.ts` 코드 주석에는 설명이 있으나 spec Rationale 에는 없는 상태다. INFO 수준의 보완 제안.

- **제안**:
  - `spec/5-system/7-llm-client.md` 또는 `spec/5-system/1-auth.md` 의 Rationale 에 "production fail-closed 가드 응집 (assertProductionConfig, refactor 04 C-1·M-4·M-7)" 항목을 추가해 단일 블록으로 응집한 설계 근거를 기록한다.

---

## 요약

이 브랜치의 spec 변경은 두 가지 명백한 Rationale 연속성 위반을 포함한다. 첫째, `spec/data-flow/2-auth.md` 에서 `plan/complete/auth-refresh-rotation-atomic.md`(refactor 05 C-1, 2026-06-11 완료)가 확정한 "Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)" Rationale 항목 전체와 시퀀스 다이어그램의 트랜잭션 박스가 새 Rationale 없이 삭제됐다. 둘째, `spec/5-system/3-error-handling.md` 의 `TOKEN_INVALID` 에러 코드 설명에서 조건부 revoke 경합 케이스가 이유 없이 제거됐다. 두 삭제가 의도적인 설계 번복(구현에서 조건부 UPDATE 없이 단순 UPDATE 로 변경 등)이라면 반드시 새 Rationale 을 함께 작성해야 하며, 단순 편집 오류라면 해당 내용을 복원해야 한다. 신규 추가된 production fail-closed 가드(JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL) 설명은 Rationale 이 본문에 inline 삽입된 패턴 문제가 있으나 설계 방향 자체는 기존 `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 가드의 확장으로 합의 원칙에 부합한다.

---

## 위험도

**HIGH**
