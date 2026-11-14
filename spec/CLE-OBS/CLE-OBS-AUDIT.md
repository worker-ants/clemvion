---
id: "CLE-OBS-AUDIT"
title: "감사 로그"
type: "feature"
version: 10
status: "approved"
requirements: ["REQ-AUDIT-001", "REQ-AUDIT-002", "REQ-AUDIT-003", "REQ-AUDIT-004", "REQ-AUDIT-005", "REQ-AUDIT-006", "REQ-AUDIT-007", "REQ-AUDIT-008", "REQ-AUDIT-009", "REQ-AUDIT-010", "REQ-AUDIT-011", "REQ-AUDIT-012", "REQ-AUDIT-013", "REQ-AUDIT-014", "REQ-AUDIT-015", "REQ-AUDIT-016", "REQ-AUDIT-017", "REQ-AUDIT-018", "REQ-AUDIT-019", "REQ-AUDIT-020", "REQ-AUDIT-021", "REQ-AUDIT-022", "REQ-AUDIT-023", "REQ-AUDIT-024", "REQ-AUDIT-025", "REQ-AUDIT-026", "REQ-AUDIT-027", "REQ-AUDIT-028", "REQ-AUDIT-029", "REQ-AUDIT-030", "REQ-AUDIT-031", "REQ-AUDIT-032"]
basis_superseded: false
parent: "CLE-OBS"
ancestors: ["CLE-VISION", "CLE-OBS"]
area: "CLE-OBS"
content_hash: "91cb173a05623d358fec2a57ab0bd9e8d4e79693ee8d0878a465028cde22faa8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/1-data-model.md", "spec/5-system/1-auth.md", "spec/conventions/audit-actions.md", "spec/data-flow/1-audit.md"]
mirror_sha256: "a24ea94ed82b39d8fc5c365a841676e2e0294f00ea098b90c34306789818b2e7"
etag: "sha256-89b2617479d9ba5d209f5b8e0262d2585eaa9a7683274f489ac8d27cc2791cd1"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/1-auth.md` (§4, Rationale 4.1.B), `spec/data-flow/1-audit.md`, `spec/1-data-model.md` (§2.18), `spec/conventions/audit-actions.md` (§3 레지스트리의 구현 상태와 기록 규칙) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 두 가지 기록을 정한다.

- **감사 로그(Audit Log, `AuditLog`)**: 워크스페이스 안에서 일어난 변경을 한 행씩 남긴다. 테이블은 `audit_log` 다. 관리자 이상만 조회한다.
- **로그인 이력(Login History, `LoginHistory`)**: 로그인 성공·실패, 로그아웃 같은 인증 이벤트를 사용자별로 시간순으로 남긴다. 테이블은 `login_history` 다. 본인만 조회하고 180일 보존한다.

두 테이블은 일부러 나눠 두었다. 감사 로그는 워크스페이스가 정해진 동작을 기록하고 로그인 이력은 워크스페이스 없이도 일어나는 인증 이벤트를 기록한다([두 테이블로 나눈다](#두-테이블로-나눈다)).

이 문서와 하위 문서가 정하는 것:

- 감사 액션(`AuditLog.action`) 카탈로그. 구현된 것과 예정인 것을 한 표로 둔다.
- 감사 로그 기록 계약, 워크스페이스 귀속, 조회 API, 조회 응답을 읽는 쪽의 계약, 보존 정책
- 로그인 이력 이벤트, 기록 계약, 조회 API, 보존 배치

범위 밖:

- 감사 액션 이름 규칙(`<resource>.<verb>`, 시제 세 갈래): [감사 action 명명](CLE-OBS-AUDITNAME.md)
- `login_history` 컬럼과 CHECK 제약, 인증 흐름의 테이블 쓰기 순서: [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md)
- 활성 세션과 로그인 이력 탭 화면: [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md)
- 역할별 권한 매트릭스: [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)
- 감사 적재 실패 메트릭(`clemvion.audit.write_failed`)의 정의와 부수 기록 실패 흡수 방식: [로깅과 헬스 체크](CLE-OBS-LOGGING.md)
- 재실행 감사 행의 필드 대응: [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)

## 요구사항

- REQ-AUDIT-001 WHEN 워크스페이스 안에서 카탈로그에 있는 변경이 완료되면 THE SYSTEM SHALL `audit_log` 에 워크스페이스·행위자·감사 액션·리소스 종류·리소스 ID·상세·요청 IP·발생 시각을 한 행 남긴다. (원본: 1-auth §4.1)
- REQ-AUDIT-002 WHEN 코드가 감사 로그를 남기면 THE SYSTEM SHALL `AUDIT_ACTIONS` union 에 있는 감사 액션만 받는다. (원본: 1-auth §4.1)
- REQ-AUDIT-003 IF 감사 로그 적재가 실패하면 THE SYSTEM SHALL 예외를 흡수해 주 동작을 계속한다. (원본: data-flow/1-audit Overview)
- REQ-AUDIT-004 IF 감사 로그 적재가 실패하면 THE SYSTEM SHALL 경고 로그에 유실된 행의 `action`·`resourceType`·`resourceId`·`workspaceId` 를 싣고 `clemvion.audit.write_failed{resource_type}` 카운터를 올린다. (원본: data-flow/1-audit Overview)
- REQ-AUDIT-005 WHEN 로그인한 세션에서 비밀번호 변경·2단계 인증 켜기·2단계 인증 끄기·이메일 변경이 일어나면 THE SYSTEM SHALL 그 감사 행을 행위자의 현재 워크스페이스에 귀속한다. (원본: 1-auth §4.1)
- REQ-AUDIT-006 IF 비밀번호 재설정이 로그인 없이 토큰으로 완료되면 THE SYSTEM SHALL `user.password_changed` 감사 행을 남기지 않는다. (원본: 1-auth §4.1)
- REQ-AUDIT-007 WHEN WebAuthn 인증 수단을 추가로 등록하면 THE SYSTEM SHALL `user.2fa_enabled` 로 남기고 `details.firstCredential` 로 첫 등록인지 구분한다. (원본: 1-auth Rationale 4.1.B)
- REQ-AUDIT-008 WHEN 감사 로그를 남기는 인증 설정·사용자 보안 동작이 일어나면 THE SYSTEM SHALL 요청 IP 를 함께 남긴다. (원본: data-flow/1-audit §1.1)
- REQ-AUDIT-009 WHEN 트리거를 켜거나 끄면 THE SYSTEM SHALL `trigger.updated` 로 남긴다. (원본: 1-auth §4.1)
- REQ-AUDIT-010 WHEN 트리거와 스케줄처럼 서로의 행을 바꾸는 짝 리소스가 함께 바뀌면 THE SYSTEM SHALL 호출된 엔드포인트의 리소스 감사 액션만 남긴다. (원본: audit-actions §3)
- REQ-AUDIT-011 WHEN 트리거의 알림 서명 시크릿 교체·봇 토큰 재발급·트리거 단위 토큰 재발급이 일어나면 THE SYSTEM SHALL 대상별 감사 액션으로 남긴다. (원본: 1-auth §4.1)
- REQ-AUDIT-012 WHEN 워크스페이스를 삭제하면 THE SYSTEM SHALL 삭제 감사 행을 남기지 않는다. (원본: 1-auth §4.1)
- REQ-AUDIT-013 WHEN 워크플로우가 실행되면 THE SYSTEM SHALL `workflow.executed` 감사 행을 남긴다. (원본: 1-auth §4.1 Planned) (미구현)
- REQ-AUDIT-014 WHEN 관리자 이상이 감사 로그를 조회하면 THE SYSTEM SHALL 현재 워크스페이스의 행만 돌려준다. (원본: 1-auth §4.2)
- REQ-AUDIT-015 IF 관리자 미만이거나 그 워크스페이스의 멤버가 아닌 사용자가 감사 로그를 조회하면 THE SYSTEM SHALL 거부한다. (원본: 1-auth §4.2)
- REQ-AUDIT-016 WHEN 감사 로그를 조회하면 THE SYSTEM SHALL 기간·행위자·감사 액션·리소스 종류 필터와 offset 페이지네이션을 제공한다. (원본: 1-auth §4.2)
- REQ-AUDIT-017 WHEN 감사 로그 조회 응답을 만들면 THE SYSTEM SHALL 과거 행의 레거시 감사 액션 값을 바꾸지 않고 그대로 싣는다. (원본: 1-auth §4.1)
- REQ-AUDIT-018 WHILE 감사 로그 보존 정책이 정해지지 않은 동안 THE SYSTEM SHALL 감사 로그 행을 지우지 않는다. (원본: 1-auth §4.2)
- REQ-AUDIT-019 WHEN 감사 로그 행이 보관 기간(기본 90일, 설정 가능)을 넘으면 THE SYSTEM SHALL 그 행을 지운다. (원본: 1-auth §4.2) (미구현)
- REQ-AUDIT-020 WHEN 로그인 성공·로그인 실패·TOTP 실패·WebAuthn 실패·로그아웃·세션 강제 종료·refresh token 재사용 감지가 일어나면 THE SYSTEM SHALL `login_history` 에 한 행 남긴다. (원본: 1-auth §4.3)
- REQ-AUDIT-021 WHEN 비밀번호 변경이나 이메일 변경이 확정되면 THE SYSTEM SHALL `session_revoked` 로그인 이력 한 행을 `familyId=null`(일괄)로 남긴다. (원본: 1-auth §4.3)
- REQ-AUDIT-022 WHEN 로그인 이력을 남기면 THE SYSTEM SHALL User-Agent 에서 기기 라벨을 만들어 함께 저장한다. (원본: data-flow/1-audit §1.2)
- REQ-AUDIT-023 WHEN 인증 코드가 로그인 이력을 남기면 THE SYSTEM SHALL 적재가 끝난 뒤에 다음 단계로 넘어간다. (원본: data-flow/1-audit §1.2)
- REQ-AUDIT-024 IF 로그인 이력 적재가 실패하면 THE SYSTEM SHALL 예외를 흡수하고 에러 로그를 남긴다. (원본: data-flow/1-audit Overview)
- REQ-AUDIT-025 WHEN 사용자가 로그인 이력을 조회하면 THE SYSTEM SHALL 본인 이력만 커서 페이지네이션으로 돌려준다. (원본: 1-auth §4.3)
- REQ-AUDIT-026 WHEN 로그인 이력을 조회하면 THE SYSTEM SHALL 워크스페이스 관리자를 포함해 본인이 아닌 사용자에게 그 이력을 보여 주지 않는다. (원본: 1-auth §4.3)
- REQ-AUDIT-027 IF 로그인 이력 조회 커서가 손상돼 있으면 THE SYSTEM SHALL 커서를 무시하고 첫 페이지를 돌려준다. (원본: data-flow/1-audit §2.2)
- REQ-AUDIT-028 WHEN 매일 03:00(Asia/Seoul)이 되면 THE SYSTEM SHALL 180일이 지난 로그인 이력 행을 지운다. (원본: 1-auth §4.3)
- REQ-AUDIT-029 WHEN 로그인 이력 보존 배치가 한 번 돌면 THE SYSTEM SHALL 1000행씩 최대 50번까지만 지우고 나머지는 다음 실행에 넘긴다. (원본: data-flow/1-audit §3)
- REQ-AUDIT-030 WHILE 서버 인스턴스가 여럿인 동안 THE SYSTEM SHALL 로그인 이력 보존 배치를 전역에서 한 번만 실행한다. (원본: data-flow/1-audit §3)
- REQ-AUDIT-031 IF 로그인 이력 보존 배치의 삭제가 실패하면 THE SYSTEM SHALL 예외를 흡수하고 로그만 남긴다. (원본: data-flow/1-audit §3)
- REQ-AUDIT-032 WHEN 트리거 생성이나 수정(PATCH)이 일회성 평문(첫 알림 서명 시크릿, 트리거 단위 토큰)을 발급하면 THE SYSTEM SHALL 그 요청의 `trigger.created` · `trigger.updated` 행 `details.issuedSecrets` 에 발급한 비밀의 종류 이름만 싣고 평문은 싣지 않는다.

## 하위 문서

| 문서 | 내용 | 맡는 요구사항 |
| --- | --- | --- |
| [감사 로그 — 기록과 조회](CLE-OBS-AUDIT-RECORD.md) | `AuditLogsService.record` 기록 계약, 워크스페이스 귀속, 조회 API 와 읽는 쪽 계약, `AuditLog` 데이터 | REQ-AUDIT-001 ~ 008, REQ-AUDIT-014 ~ 017 |
| [감사 로그 — 감사 액션 카탈로그](CLE-OBS-AUDIT-CATALOG.md) | 감사 액션 단일 목록(기록 위치 · `details` · 상태)과 카탈로그 규칙(워크스페이스 삭제, 짝 리소스, 트리거 시크릿 교체, 레거시 행, 커버리지 갭) | REQ-AUDIT-009 ~ 013, REQ-AUDIT-032 |
| [감사 로그 — 로그인 이력](CLE-OBS-AUDIT-LOGIN.md) | 로그인 이력 이벤트, 기록 계약, 조회 API, 보존 배치 | REQ-AUDIT-020 ~ 031 |

이 문서의 보존 절이 REQ-AUDIT-018 · 019 를 맡는다. 하위 문서의 코드 경로는 따로 적지 않으면 `codebase/backend/src/modules/` 아래 경로다.

## 감사 액션 카탈로그

→ [감사 로그 — 감사 액션 카탈로그](CLE-OBS-AUDIT-CATALOG.md#감사-액션-카탈로그)

## 보존

| 테이블 | 보존 | 정리 |
| --- | --- | --- |
| `audit_log` | 정책 미정. 지금은 무제한 | 정리 배치 없음. "최근 90일 보관(설정 가능)" 은 예정이고 미구현이다 |
| `login_history` | 180일(`RETENTION_DAYS`) | 매일 배치로 자동 삭제([로그인 이력 보존 배치](CLE-OBS-AUDIT-LOGIN.md#보존-배치)) |

두 테이블 모두 외부 시스템으로 내보내지 않는다. 알림 규칙 평가(`alerts/alerts-evaluator.service.ts`)도 두 테이블을 읽지 않는다.

## 외부 의존

| 의존 | 방향 | 내용 |
| --- | --- | --- |
| 9개 도메인 서비스(integrations·workspaces·workspace-invitations·executions·auth-configs·workflows·triggers·schedules·model-config)와 3개 컨트롤러(users·auth·webauthn) | 상류 | `audit_log` 를 쓰는 곳 전부. 목록은 [감사 액션 카탈로그](CLE-OBS-AUDIT-CATALOG.md#감사-액션-카탈로그) |
| 인증 도메인(`AuthService`·`SessionsService`·`WebAuthnService`) | 상류 | `login_history` 를 쓰는 유일한 곳 |
| BullMQ(Redis) | 기반 | `login-history-pruner` 반복 작업 |

## 구현 위치

하위 문서마다 자기 범위의 구현 위치를 다시 적는다. 이 목록은 영역 전체다.

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`record`, `findAll`)
- `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AUDIT_ACTIONS`)
- `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts`
- `codebase/backend/src/modules/auth/login-history.service.ts` (`record`, `findForUser`, `pruneOlderThanRetention`)
- `codebase/backend/src/modules/auth/jobs/login-history-pruner.service.ts`
- `codebase/backend/src/modules/auth/sessions.controller.ts` (로그인 이력 조회)

## Rationale

### 두 테이블로 나눈다

- `audit_log` 는 워크스페이스 단위 역할 권한과 바로 이어지는 변경 기록이다. 규정 준수와 분쟁 해결에 쓰고 워크스페이스 관리자와 감사 담당자가 본다.
- `login_history` 는 사용자가 자기 계정 보안을 확인하는 용도다(의심스러운 로그인 찾기). 워크스페이스 없이도 일어난다. 로그인 실패는 어느 워크스페이스에도 속하지 않는다.

목적과 조회자가 달라서 한 테이블로 합치면 권한 분리와 쿼리 형태가 모두 복잡해진다. 조회 방식도 다르다. 감사 로그는 워크스페이스 범위의 offset 페이지네이션이고 로그인 이력은 본인 전용 커서 페이지네이션이다.

### 감사 액션은 애플리케이션 union 으로 막고 로그인 이력 이벤트는 DB CHECK 로 고정한다

`audit_log.action` 은 DB 에서 자유 문자열(`VARCHAR(100) NOT NULL`, V001)이다. 새 감사 액션을 더할 때 마이그레이션이 필요 없다. 그 대가는 제각각인 표기가 DB 에 들어갈 위험인데, 이는 애플리케이션의 타입으로 막는다. `AuditLogsService.record({ action })` 의 `action` 이 `AuditAction` union 이라 const 에 더하지 않은 감사 액션은 호출 자체가 컴파일되지 않는다. DB CHECK 대신 union 을 고른 이유는 감사 액션이 도메인이 늘 때마다 자주 추가되기 때문이다.

반대로 `login_history.event` 는 DB CHECK 제약(`chk_login_history_event`, V040)으로 값을 고정한다. 이벤트 종류를 더하려면 마이그레이션이 필요하다. 예를 들어 `webauthn_failed` 는 V058 에서 CHECK 제약을 DROP 한 뒤 ADD 해 더했다. 엔티티의 `LoginHistoryEvent` union 과 DB CHECK 가 함께 정합성을 지킨다.

### 기록 실패는 흡수하고 호출은 기다린다

감사 기록은 부수 기록이다. INSERT 가 실패했다고 리소스 변경이나 로그인이 실패하면 안 된다. 그래서 두 `record` 모두 예외를 흡수한다. 그래도 `await` 를 요구하는 이유는 에러 전파가 아니라 순서 보장이다. 바로 뒤의 조회와 읽기 경쟁이 나지 않게 한다. 흡수하되 기다리는 조합은 의도한 설계다.

### 적재 실패 관측이 감사 로그와 로그인 이력에서 다르다

감사 로그는 흡수한 실패를 경고 로그와 카운터로 드러내고 로그인 이력은 에러 로그만 남긴다. 이 차이는 일부러 드러내 둔다. 하나로 묶어 적으면 어느 쪽으로 읽어도 틀리고 로그인 이력 쪽의 빈틈이 보이지 않는다. 로그인 이력에 카운터를 도입할지는 별도 작업으로 추적한다.

### 트리거 생성의 감사 행은 커밋 직후 트랜잭션 밖에서 남긴다

다른 문서가 이 앵커로 링크하므로 제목을 남긴다. 결정과 근거는 [감사 로그 — 기록과 조회](CLE-OBS-AUDIT-RECORD.md#트리거-생성의-감사-행은-커밋-직후-트랜잭션-밖에서-남긴다) 에 있다.
