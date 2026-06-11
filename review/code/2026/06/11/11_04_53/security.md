# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 감사 로그 action 상수화 — 인라인 문자열에서 `AUDIT_ACTIONS` const로 전환
  - 위치: 파일 1 (`audit-action.const.ts`), 파일 4, 8, 9, 10 전반
  - 상세: `AuditAction` union 타입 강제로 임의 문자열이 `record()` 에 전달되는 경로를 컴파일 타임에 차단. 감사 로그 훼손·누락 위험 경감.
  - 제안: 현재 설계 적절. 추가 개선 없음.

- **[INFO]** 감사 로그 기록 실패 swallow 설계 (`audit-logs.service.ts` L213-228)
  - 위치: `AuditLogsService.record()` catch 블록
  - 상세: DB 장애 시 감사 로그가 소실되는 설계. 의도된 결정(주석에 명시)이나, 고위험 액션(`auth_config.reveal`, `workspace.transfer_ownership`)은 감사 누락이 규제 위반으로 이어질 수 있다.
  - 제안: 현재 아키텍처를 유지할 경우, 적어도 `CRITICAL` 레벨 액션(reveal, transfer_ownership)은 실패 시 별도 알람 채널(Slack, alerting)에 best-effort 발송하는 패턴 고려.

- **[INFO]** 에러 메시지에서 민감 정보 노출 수준 — 적절
  - 위치: `AuditLogsService.record()` L225-228, `AuthConfigsService.authFailed()` L720-724
  - 상세: `record()` 실패 시 `err.message`만 logger.warn으로 내부 기록(외부 미노출). `authFailed()`는 type 무관 단일 메시지('Authentication failed')로 정보 열거 차단. 설계 양호.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 위험 — TypeORM 파라미터 바인딩 사용
  - 위치: `audit-logs.service.ts` L166-185, `auth-configs.service.ts` L412-423
  - 상세: 모든 WHERE 조건이 `:param` 바인딩 방식으로 처리됨. `getSortColumn()` 화이트리스트(L231-238)로 정렬 컬럼 인젝션도 차단. 안전.
  - 제안: 없음.

- **[INFO]** 타이밍 공격 방어 — `constantTimeEquals` 적용
  - 위치: `auth-configs.service.ts` L731-735
  - 상세: bearer token, api_key, basic_auth, hmac 전체 경로에서 `crypto.timingSafeEqual` 사용. 길이 불일치 시 즉시 false 반환(길이 정보 누설은 이미 HMAC 비교에서 불가피). 설계 적절.
  - 제안: 없음.

- **[INFO]** HMAC 알고리즘 화이트리스트 (`HMAC_ALLOWED_ALGORITHMS`)
  - 위치: `auth-configs.service.ts` L377, L703-705
  - 상세: 외부 입력이 `crypto.createHmac()` 알고리즘 인자로 전달되는 경로를 `sha256`/`sha512`로 제한. 알고리즘 다운그레이드 및 커맨드 인젝션 차단. 설계 양호.
  - 제안: 없음.

- **[INFO]** 비밀값 마스킹 — `SECRET_CONFIG_KEYS` 화이트리스트
  - 위치: `auth-configs.service.ts` L380, L742-750
  - 상세: `key`, `token`, `secret`, `password` 키를 응답에서 `***{last4}` 처리. `findAll()` 목록 응답은 항상 마스킹, 평문은 create/regenerate/reveal 경로만 노출. 적절.
  - 제안: `headerName`, `username` 같은 비-비밀 키는 마스킹 제외되어 있어 의도 부합. 단 향후 new config type 추가 시 `SECRET_CONFIG_KEYS` 갱신을 잊지 않도록 코드 주석으로 안내 권장.

- **[INFO]** `reveal()` 비밀번호 재확인 — bcrypt 비교, OAuth 사용자 차단
  - 위치: `auth-configs.service.ts` L527-551
  - 상세: `bcrypt.compare()`로 검증. OAuth 단독 가입자(passwordHash=NULL)는 `UnauthorizedException` 반환. 에러 code는 `AUTH_FAILED`로 통일해 사용자 존재 여부 열거 차단. 안전.
  - 제안: 없음.

- **[INFO]** IP 화이트리스트 fail-closed 설계
  - 위치: `auth-configs.service.ts` L576-580
  - 상세: `ipWhitelist`가 설정된 경우 `clientIp`를 알 수 없으면 거부. `parseIp()` 실패 시 매칭 제외(L614-625). IPv4-mapped IPv6 정규화(`::ffff:`→IPv4). 안전.
  - 제안: 없음.

- **[WARNING]** IDOR 방어는 서비스 레이어에 있으나 controller 레이어 게이트 검증 부재 확인 필요
  - 위치: `executions-rerun.service.spec.ts` L932-948, `executions.service.ts` (reRun 메서드)
  - 상세: `reRun()`은 `getMemberRole(workspaceId, userId)`로 대상 워크스페이스 멤버십을 직접 조회해 IDOR를 차단하고 있으며, 테스트도 이를 검증. 그러나 이 변경 diff에서는 controller 레이어의 `@Roles` 가드 적용 여부가 보이지 않는다. 서비스 레이어 단독 방어는 controller가 가드 없이 호출될 경우 우회 가능.
  - 제안: 별도 리뷰 턴에서 `ExecutionsController.reRun()` 핸들러에 `@Roles()` 또는 `JwtAuthGuard` + `WorkspaceGuard`가 올바르게 적용되어 있는지 확인 권장.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff
  - 상세: API 키, 토큰, 비밀번호 등 하드코딩된 시크릿 없음. 테스트 파일의 `u@e.com` 등은 픽스처 이메일로 위험 없음.
  - 제안: 없음.

- **[INFO]** 의존성 보안 — 이번 diff에서 신규 패키지 추가 없음
  - 위치: 전체 diff
  - 상세: `bcrypt`, `ip-address`, `crypto`(내장) 등 기존 의존성만 사용. 신규 패키지 추가 없어 의존성 취약점 위험 추가 없음.
  - 제안: 없음.

## 요약

이번 변경은 감사 로그 action 문자열을 `AUDIT_ACTIONS` const + `AuditAction` union 타입으로 집중 관리하는 리팩터링이다. 보안 측면에서 인라인 문자열 오탈자로 인한 감사 누락 위험이 컴파일 타임 검증으로 대체되어 긍정적이다. SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩 시크릿, 암호화 알고리즘, 에러 메시지 정보 노출 등 주요 보안 항목은 모두 적절히 처리되어 있다. 유일한 WARNING은 controller 레이어 인가 게이트의 확인 필요성이나 이는 이번 diff 범위 외부에 있다.

## 위험도

LOW
