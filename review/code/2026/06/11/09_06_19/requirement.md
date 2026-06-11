# 요구사항(Requirement) Review — refresh 토큰 rotation 원자화 (05 C-1)

## 발견사항

### [INFO] [SPEC-DRIFT] 시퀀스 다이어그램(라인 170)과 조건부 UPDATE 구현의 불일치
- **위치**: `spec/data-flow/2-auth.md` 라인 170 vs `auth.service.ts` 라인 594–601
- **상세**: 시퀀스 다이어그램 라인 170은 `UPDATE refresh_token SET is_revoked=true, last_used_at=now WHERE id = row.id` 로 단순 id 조건만 표기한다. 실제 구현은 `{ id: stored.id, isRevoked: false, expiresAt: MoreThan(new Date()) }` 의 복합 조건(TOCTOU 방어)을 사용한다. 원자성 노트(라인 181–183)에서 조건부 UPDATE 를 산문으로 설명하지만 시퀀스 다이어그램 자체는 갱신되지 않아 두 설명이 불일치한다. 코드가 옳고(TOCTOU 방어가 명시적 요구사항) 다이어그램이 낡았다.
- **제안**: 코드 유지 + `spec/data-flow/2-auth.md` 라인 170 의 시퀀스 다이어그램 UPDATE 행을 `WHERE id = row.id AND is_revoked = false AND expires_at > now` 로 갱신해야 한다. spec 갱신 대상: `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램 라인 170.

### [INFO] `resolveTokenWorkspaceContext` 가 트랜잭션 내부에서 실행됨 — 기능상 무결
- **위치**: `auth.service.ts` 라인 758 (`generateTokens` 내 `resolveTokenWorkspaceContext` 호출)
- **상세**: `generateTokens` 가 manager 와 함께 트랜잭션 콜백 안에서 호출될 때, `resolveTokenWorkspaceContext`(최대 3회 순차 DB 읽기)도 같은 트랜잭션 안에서 실행된다. spec §1.4 원자성 노트는 "JWT sign 은 DB 무관이라 트랜잭션 밖에서 선계산" 이라고 언급하지만 workspace context 조회가 트랜잭션 밖인지에 대해서는 침묵한다. 기능 정확성에 영향을 주지 않으며 단순 성능 트레이드오프다. RESOLUTION.md 에 수용 근거(INFO-1) 가 있고 plan 의 후속 항목으로 등록됐다.
- **제안**: 기능 요구사항에 반하지 않음 — INFO 수준 유지. 후속 리팩토링 backlog(RESOLUTION.md §보류) 에 이미 등록.

### [INFO] `stored.user` null 가드 — 정상 회전 분기에 추가됨, 이전 리뷰 이슈 충족
- **위치**: `auth.service.ts` 라인 572–580
- **상세**: 이전 리뷰(SUMMARY.md INFO-5) 에서 "stored.user null 체크 부재" 가 요구사항 불일관으로 지적됐고 현재 변경에서 가드가 추가되어 반영됐다. 정상 회전 분기와 reuse 분기의 방어 패턴이 통일되어 있다.
- **제안**: 해결됨. 추가 조치 불필요.

### [INFO] 테스트 커버리지 — 4개 신규 케이스 모두 요구사항 핵심 시나리오 대응
- **위치**: `auth.service.spec.ts` 라인 69–150
- **상세**: (1) 단일 트랜잭션 내 회전 검증, (2) affected=0 시 TOKEN_INVALID + save 미호출, (3) 만료 토큰 경로의 트랜잭션 미진입, (4) INSERT 실패 시 에러 전파 — 4개 케이스 모두 05 C-1 의 핵심 요구사항 시나리오를 직접 커버한다. 롤백 케이스(4번)는 단위 mock 한계를 주석으로 명시하고 e2e 로 보완하는 방식이 적절히 문서화됐다.
- **제안**: 기능 충족. 추가 조치 불필요.

### [INFO] `lastUsedIp` 필드명 — entity 와 spec 표기 정합
- **위치**: `auth.service.ts` 라인 599; `refresh-token.entity.ts` 라인 50–51
- **상세**: spec 라인 254는 `last_used_ip` (스네이크 케이스, DB 칼럼명)로 표기하고, 구현은 TypeORM camelCase 매핑 `lastUsedIp` 를 사용한다. entity 에 `@Column({ name: 'last_used_ip' })` 로 DB 칼럼명이 정확히 매핑돼 있어 불일치 아님 — TypeORM 관용구.
- **제안**: 정합됨. 추가 조치 불필요.

### [INFO] `rememberMe=false` 하드코딩 — refresh 회전 경로에서 의도적
- **위치**: `auth.service.ts` 라인 609: `this.generateTokens(user, false, stored.familyId, ctx, manager)`
- **상세**: refresh 회전 시 `rememberMe` 가 false 로 고정되어 신규 토큰 만료가 항상 7일이다. 원래 로그인 시점의 rememberMe 설정이 회전에 인계되지 않는다. spec §1.4 는 이 동작에 대해 명시적으로 침묵하며(회전 후 만료 정책 미언급), 기존 코드에서도 동일하게 false 였으므로 본 변경이 도입한 새 문제가 아니다.
- **제안**: spec 범위 밖. INFO 수준 유지.

## 요약

05 C-1 요구사항(refresh 토큰 rotation 원자화)은 완전히 충족됐다. revoke+INSERT 의 단일 트랜잭션 묶음, TOCTOU 방어를 위한 조건부 UPDATE(`is_revoked=false AND expires_at>now`), affected=0 시 TOKEN_INVALID 거부, stored.user null 가드 추가, 롤백 시 세션 소실 방지 — 모두 구현됐다. spec 에서 요구하는 에러 코드(TOKEN_INVALID, TOKEN_EXPIRED), 필드명(last_used_at, last_used_ip), 트랜잭션 경계, loginHistory 미기록 정책이 코드와 일치한다. 유일한 spec 정합 이슈는 시퀀스 다이어그램 라인 170 이 조건부 UPDATE 조건을 반영하지 않아 낡은 상태이며(`[SPEC-DRIFT]`) 코드가 옳고 spec 갱신이 필요하다. TODO/FIXME 미완성 주석 없음. 모든 반환 경로가 적절한 값을 반환하거나 명시적 예외를 던진다.

## 위험도

LOW
