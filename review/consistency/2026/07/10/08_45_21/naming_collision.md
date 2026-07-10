# 신규 식별자 충돌 검토 — `spec/5-system/3-error-handling.md`

## 검토 범위 확정

target 의 실제 diff(`git diff -- spec/5-system/3-error-handling.md`)는 두 구간을 추가한다:

1. `§1.2.1 2FA / WebAuthn / 재인증 코드 (도메인 spec 참조)` — `WEBAUTHN_DISABLED`(503)·`WEBAUTHN_VERIFY_FAILED`(400)·`INVALID_OPTIONS_TOKEN`(400)·`CHALLENGE_INVALID`(401)·`WEBAUTHN_INVALID`(401)·`RECOVERY_CODE_INVALID`(401)·`REAUTH_NOT_AVAILABLE`(403) 7개 코드 등재
2. `§1.8 KB / Graph RAG 도메인 에러 코드 (도메인 spec 참조)` — `KB_REEXTRACT_IN_PROGRESS`(409) 1개 코드 등재

`plan/in-progress/error-codes-catalog-sot.md` 에 따르면 이는 신규 식별자 발행이 아니라 **기존에 이미 구현·문서화된 도메인 코드를 §1 공용 카탈로그에 가시성 목적으로 등재**하는 작업(§1.5~§1.7 의 "도메인 spec 참조" 패턴 확장)이다. 이 전제를 검증하는 방향으로 점검했다.

## 점검 결과

### 1. 요구사항 ID 충돌
해당 없음 — target 은 요구사항 ID(`NAV-*`/`ND-*` 류)를 부여하지 않는다.

### 2. 엔티티/타입명 충돌
해당 없음 — 새 엔티티·DTO·인터페이스 도입 없음.

### 3. API endpoint 충돌
해당 없음 — target 이 언급하는 엔드포인트(`POST /api/auth/2fa/webauthn/*`, `POST /api/knowledge-bases/:id/re-extract`)는 모두 `1-auth.md`·`10-graph-rag.md`에 diff 이전부터 존재하던 기존 엔드포인트다. target 은 새 endpoint 를 정의하지 않는다.

### 4. 이벤트/메시지명 충돌
해당 없음.

### 5. 환경변수·설정키 충돌
해당 없음 — target 은 env var 를 새로 도입하지 않는다 (plan 에도 "env var 4종 제외"로 명시, WebAuthn env var 는 카탈로그 대상에서 의도적으로 제외됨).

### 6. 파일 경로 충돌
해당 없음 — 파일 경로 변경 없음(기존 `3-error-handling.md` 본문 내 섹션 추가).

### 코드값 1:1 정합성 (실질 충돌 검증)

8개 코드 전부를 `spec/`·`codebase/backend/src` 전역에서 재검색해 도메인 SoT·구현과의 정합을 확인했다. 모두 코드값·HTTP status·의미가 기존 사용처와 정확히 일치하며 상충 없음:

| 코드 | target 등재 HTTP | 기존 사용처(도메인 SoT/구현) | 일치 여부 |
|---|---|---|---|
| `WEBAUTHN_DISABLED` | 503 | `1-auth.md:174,472` (503) · `webauthn.service.ts:110` | 일치 |
| `WEBAUTHN_VERIFY_FAILED` | 400 | `1-auth.md:473` (400) · `webauthn.service.ts:212,219` | 일치 |
| `INVALID_OPTIONS_TOKEN` | 400 | `1-auth.md:473` (400) · `webauthn.service.ts:583,589,595` | 일치 |
| `CHALLENGE_INVALID` | 401 | `1-auth.md:474` (401) · `auth.service.ts:414,420,492,498,512` | 일치 |
| `WEBAUTHN_INVALID` | 401 | `1-auth.md:449,475` (401) · `webauthn.service.ts:437,443` · `data-flow/1-audit.md:117` | 일치. `1-data-model.md:705` 의 `login_history.failure_reason` 열거값과도 문자열 일치(별도 레이어지만 같은 명칭 재사용 — 기존부터 의도된 설계, target 신규 아님) |
| `RECOVERY_CODE_INVALID` | 401 | `1-auth.md:476` (401) · `webauthn.controller.ts:253` | 일치 |
| `REAUTH_NOT_AVAILABLE` | 403 | `1-auth.md:80,91,519` (403) · `2-navigation/9-user-profile.md:333` · `data-flow/2-auth.md:203` · `sessions.service.ts:257` | 일치 |
| `KB_REEXTRACT_IN_PROGRESS` | 409 | `2-navigation/5-knowledge-base.md:221` (409) · `10-graph-rag.md:523,564` (409) · `knowledge-base.service.ts:344,403` | 일치 |

target 파일 내부에도 8개 코드 각각 정확히 1회씩만 등장 — 카탈로그 내 자체 중복도 없음.

### 섹션 번호 충돌
diff 이전 `3-error-handling.md` 에는 `§1.2.1`, `§1.8` 서브섹션이 존재하지 않았다(기존 헤딩 목록: §1.1~§1.7, §2.1~§2.2, §3.1~§3.3, §5.1~§5.2, §6.1~§6.3, §7.1~§7.2). 신규 번호가 기존 사용 중인 다른 의미를 덮어쓰지 않는다. 다른 spec 문서에서 `error-handling.md#18` 또는 `error-handling.md#121` 앵커를 참조하는 곳도 없어(전수 grep 결과 0건) dangling/충돌 앵커 리스크 없음.

### conventions/error-codes.md 와의 이중 소스 여부
`spec/conventions/error-codes.md` 에는 이번에 등재된 8개 코드의 자체 열거가 없다(grep 0건) — 별도 enumeration 이 없으므로 drift 리스크 없음.

## 발견사항

- **[INFO]** 카탈로그 완결성 잔여 갭 (target 범위 밖, 이미 plan 에 후속으로 명시됨)
  - target 신규 식별자: 없음 (target 은 이 코드들을 도입하지 않음)
  - 기존 사용처: `codebase/backend/src/modules/auth/sessions.service.ts:222,239,267,280,286` 의 `PASSWORD_INVALID`(400)·`TOTP_INVALID`(401)·`REAUTH_REQUIRED`(403) — `REAUTH_NOT_AVAILABLE` 과 같은 재인증 흐름의 형제 코드지만 `3-error-handling.md §1` 에 여전히 미등재. plan 파일도 "후속 (비차단)" 항목으로 `NOT_A_MEMBER`·`INVALID_PASSWORD` 를 이미 별도 추적 중.
  - 상세: 이번 diff 는 WebAuthn/2FA·KB 두 클러스터만 등재 범위로 명시적으로 한정했고(plan §확정 코드), `REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID` 는 원래도 WebAuthn 클러스터가 아니라 이번 WARNING(#880 review) 범위 밖이었다. 신규 식별자 충돌은 아니고 카탈로그 완결성 갭(누락)이다.
  - 제안: 이번 target 커밋과 무관 — plan 의 "후속 (비차단, 별도 완결성 pass)" 항목에 이미 반영돼 있으므로 별도 조치 불요. 차후 완결성 pass 에서 흡수.

발견된 CRITICAL/WARNING 등급 충돌 없음.

## 요약

target 이 실제로 변경하는 두 구간(§1.2.1 WebAuthn/2FA/재인증 7개 코드, §1.8 KB/Graph RAG 1개 코드)은 신규 식별자를 발행하는 것이 아니라 `1-auth.md`·`10-graph-rag.md` 에 이미 정의·구현된 기존 코드를 §1 공용 카탈로그에 참조 등재하는 작업이다. 코드값·HTTP status·의미를 도메인 SoT·실제 구현(`webauthn.service.ts`·`auth.service.ts`·`sessions.service.ts`·`knowledge-base.service.ts`)과 전수 대조한 결과 모두 1:1 일치했고, 파일 내 자체 중복·섹션 번호 충돌·conventions 이중 소스·dangling anchor 어느 것도 발견되지 않았다. 유일한 특이사항은 target 범위 밖의 카탈로그 완결성 잔여 갭(`REAUTH_REQUIRED` 등)이며 이는 이미 plan 의 후속 항목으로 추적 중이라 이번 diff 의 책임 범위가 아니다.

## 위험도
NONE
