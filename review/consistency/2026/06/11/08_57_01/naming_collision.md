# 신규 식별자 충돌 검토 결과

검토 대상: `spec/data-flow/2-auth.md` (diff vs origin/main)
검토 모드: 구현 완료 후 (--impl-done, scope=spec/data-flow/, diff-base=origin/main)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `"05 C-1"` 요구사항 레이블 — 기존 `C-1` 식별자와 네임스페이스 모호
  - target 신규 식별자: `spec/data-flow/2-auth.md` §1.4 주석 `**회전 원자성 (05 C-1)**` 및 코드 주석 `// 05 C-1`
  - 기존 사용처:
    - `spec/conventions/execution-context.md:44` — `"C-1 옵션 a 채택"` (Parallel concurrency 분리 결정)
    - `spec/4-nodes/1-logic/10-parallel.md:230` — `"consistency-check C-1"` (동일 Parallel 결정 참조)
    - `spec/conventions/i18n-userguide.md:105,107,184` — `P3-C-1` (i18n graphWarning 가드)
  - 상세: 기존 `C-1` 은 consistency-check 결과 ID (Parallel 노드 분리 결정)로 쓰이고 있다. 신규 `05 C-1` 은 `plan/in-progress/refactor/05-database.md` 의 항목 ID(데이터베이스 refactor 백로그)다. 두 `C-1` 은 완전히 다른 네임스페이스(consistency-check 결과 vs refactor 백로그 항목)이나, 표기가 `C-1` / `05 C-1` 으로 닮아 독자 입장에서 혼동을 유발할 수 있다. 특히 코드 주석에도 `// 05 C-1` 이 여러 곳에 등장해 검색 시 노이즈가 생긴다.
  - 제안: spec 본문의 레퍼런스를 `(refactor/05-database.md C-1)` 또는 `(DB-C-1)` 으로 좀 더 명확하게 기재하거나, 현재처럼 `(05 C-1)` 으로 두되 plan 참조임을 한 줄 주석으로 명시한다(`// refactor 05-database C-1`). consistency-check 결과의 `C-1` 과 혼동 가능성을 낮추기 위한 prefix 구분이 목적.

---

### 발견사항 2

- **[INFO]** `TOKEN_INVALID` — refresh 회전 경로에서 새 의미(TOCTOU 동시 회전 거부)를 추가
  - target 신규 식별자: `spec/data-flow/2-auth.md` §1.4 "`매칭 0건이면 다른 요청이 먼저 회전한 것이므로 `TOKEN_INVALID` 로 거부한다`"
  - 기존 사용처:
    - `spec/5-system/3-error-handling.md:36` — `TOKEN_INVALID` = 토큰 무효(변조/형식 오류) 401
    - `spec/5-system/14-external-interaction-api.md:315` — `TOKEN_INVALID` = interaction 토큰 검증 실패
    - `spec/data-flow/15-external-interaction.md:270` — 동일
  - 상세: `TOKEN_INVALID` 는 기존에 "변조/형식 오류" 의미로 등재된 에러 코드다. 신규 설명은 같은 코드를 "동시 refresh 경합으로 인한 이미 회전된 토큰" 거부에도 사용한다는 것을 명시한다. 두 의미가 같은 HTTP 에러 코드(`401 TOKEN_INVALID`)를 공유하고, 클라이언트 입장에서는 재로그인을 요구한다는 동작이 같아 혼선 없이 동일 코드 재사용이 가능하다. 단, 에러 코드 정의 문서(`spec/5-system/3-error-handling.md`)가 이 추가 발생 시나리오를 미기재 중이다.
  - 제안: `spec/5-system/3-error-handling.md` 의 `TOKEN_INVALID` 행에 "TOCTOU 동시 회전 경합으로 이미 revoke 된 토큰 재사용 시도" 를 추가 발생 케이스로 병기하면 에러 코드 SoT 와 data-flow 설명이 일치한다. 현재 수준에서 INFO 처리(기능 충돌 없음).

---

### 발견사항 3

- **[INFO]** `generateTokens` 시그니처 변경 — 코드 식별자의 spec 반영 누락
  - target 신규 식별자: `spec/data-flow/2-auth.md` §1.4 에 `generateTokens(user, false, stored.familyId, ctx, manager)` 라는 호출 형태가 암묵적으로 반영됨(시퀀스 다이어그램에는 직접 등장하지 않음)
  - 기존 사용처: `spec/data-flow/2-auth.md` 의 기존 텍스트는 `generateTokens` 를 내부 private 메서드로만 언급
  - 상세: `generateTokens` 의 optional `EntityManager` 파라미터 추가는 코드 변경이지 spec 충돌이 아니다. 다만 코드 주석(`auth.service.ts`)이 이 시그니처를 `@internal` / `private` / `trust boundary 확장 금지` 로 명확히 문서화한 것에 비해, spec 의 §1.4 설명에는 이 시그니처 계약(external 노출 금지)이 기술되지 않는다. data-flow spec 이 코드 진입점을 나열하는 문서이므로 현재 수준에서 INFO 처리.
  - 제안: 필요하다면 §1.4 또는 코드 진입점 섹션에 "`generateTokens` — private, 트랜잭션 컨텍스트 전파 전용" 한 줄을 추가해 spec 내 경계를 명시. 필수 아님.

---

## 요약

이번 변경(`spec/data-flow/2-auth.md §1.4`)이 도입하는 신규 식별자는 `"05 C-1"` 레이블, `TOKEN_INVALID` 에러 코드의 추가 발생 케이스 설명, 그리고 암묵적인 `generateTokens` 시그니처 변경 설명이다. 실질적인 충돌은 없고, `C-1` 레이블의 네임스페이스 혼동 가능성(WARNING 1건)과 에러 코드 SoT 미갱신(INFO 1건)이 주요 관찰사항이다. `TOKEN_INVALID` 는 기존과 동일 코드를 동일 의미로 재사용하며 새로 발명된 식별자가 아니다. API endpoint·이벤트명·환경변수·파일 경로·BullMQ 큐명·엔티티명에서 신규 도입된 식별자는 없다.

## 위험도

LOW

STATUS: OK
