# Security Review

## 발견사항

### [INFO] extractClientIpFromHeaders 반환 타입 변경: null → undefined
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` (diff)
- 상세: `extractClientIpFromHeaders` 의 반환 타입이 `string | null` 에서 `string | undefined` 로 변경됨. `hooks.service.ts` 에서 `?? undefined` 중복 변환을 제거하고 직접 할당. 보안 동작(IP 식별 불가 시 falsy)은 동일하므로 취약점 없음.
- 제안: 변경 자체는 문제 없음. `extractClientIp`(req 전체 버전)는 여전히 `string | null` 반환이므로 두 함수 간 타입 불일치가 존재하나, 소비처가 명확히 분리되어 있어 즉각적 위험은 없음. 향후 통합 시 반환 타입 통일 고려.

### [INFO] private 브래킷 접근 → 공개 API 캡슐화 (getStatusById)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (diff, 884행)
- 상세: `this.executionsService['executionRepository']` private 브래킷 접근을 `executionsService.getStatusById()` 공개 메서드로 교체. 브래킷 접근은 TypeScript 접근 제어를 우회하는 안티패턴이므로 제거는 올바른 방향. `getStatusById` 내부에서 `.catch(() => null)` 로 DB 오류를 흡수해 caller 에게 단순한 인터페이스 제공.
- 제안: 이 변경 자체는 보안상 개선이다. DB 오류 흡수(null 반환)가 `getActiveExecutionStatus` 의 null-as-terminal 해석과 결합되면, DB 장애 시 활성 execution 이 존재함에도 새 execution 이 시작될 수 있다(fail-open). 이는 알려진 의도적 설계(fail-open 모니터링 플랜 언급)이나, DB 장애 시 중복 execution 시작 리스크가 존재함.

### [INFO] QueryFailedError 23505 → 409 매핑 (에러 처리)
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (51-65행)
- 상세: unique 위반 에러에 대한 응답에서 드라이버 원문(`duplicate key value`, 컬럼명·제약명 등)이 클라이언트에 노출되지 않는다는 것을 명시적으로 단언하는 테스트가 추가됨. CWE-209 준수 확인.
- 제안: 구현(필터)이 실제로 드라이버 메시지를 마스킹하는지 필터 코드를 별도로 검토할 것을 권장하나, 테스트가 이를 regression guard 로 커버하고 있으므로 현재 변경에서는 이슈 없음.

### [INFO] 소스 IP 추출 경로: CF-Connecting-IP 신뢰 기본 off
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` (전체 파일)
- 상세: `CF-Connecting-IP` 헤더는 기본적으로 무시되고 `TRUST_CF_CONNECTING_IP=true` 환경변수로만 활성화됨. fail-safe(기본 off) 설계는 올바름. XFF 첫 번째 IP만 신뢰하며, 이 역시 프록시 환경에서 적절.
- 제안: req.ip(Express trust-proxy) 폴백이 현재 webhook 경로에서는 적용되지 않음(`extractClientIpFromHeaders` 사용). `extractClientIp`(req 포함 버전) 미사용으로 IP whitelist 검증이 프록시 뒤에서 불완전할 수 있는 알려진 갭이 in-progress 플랜에 명시되어 있음. 보안 완결성을 위해 해당 후속 작업을 조기에 처리할 것을 권장.

### [INFO] form_submission 필드 필터링 (injection 방지)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (3062-3069행)
- 상세: `form_submission` 처리 시 제출된 필드를 `pendingFormModal.fields` 에 선언된 이름으로만 필터링(`allowedNames` Set). 선언되지 않은 필드 주입을 차단하여 undefined-field injection 방지. 올바른 방어.
- 제안: 이슈 없음. 현재 구현 충분.

### [INFO] channelUserKey 불일치 체크 (form modal)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (open_form_modal, form_submission 분기)
- 상세: `state.channelUserKey !== update.channelUserKey` 조건으로 다른 사용자의 form 가로채기를 방지. 코드 주석에 "Security guard" 명시.
- 제안: 이슈 없음. 동작 정상.

### [INFO] chatChannelLastError에 외부 입력 미포함 (Stored XSS 방지)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (3497-3498행)
- 상세: rate-limit degraded 갱신 시 `conversationKey`(외부 입력)를 `chatChannelLastError` 에 포함하지 않고 정적 한도 문자열만 기록. 관리자 UI stored-XSS 표면 축소 의도가 주석에 명시되어 있음.
- 제안: 이슈 없음. 올바른 방어.

### [INFO] logger.warn에 외부 입력 포함 (운영 로그 주의)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 다수 위치 (warn 호출)
- 상세: `err.message`, `conversationKey`, `channelUserKey`, `config.provider` 등이 warn 로그에 포함됨. `err.message` 는 외부 입력 기반 오류 메시지일 수 있으며, 로그 집계 시스템에서 로그 인젝션(log injection) 가능성이 있음.
- 제안: 운영상 큰 위험은 아니나, 외부 입력 기반 문자열을 로그에 출력할 때 개행 문자(`\n`, `\r`) 제거 또는 이스케이프를 고려할 것. 현재 변경에서 새로 추가된 패턴은 없으므로 기존 코드베이스의 일관된 관행임.

### [WARNING] getStatusById DB 오류 묵음(fail-open) → 활성 execution 중복 시작 가능성
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` (696-701행)
- 상세: `getStatusById` 가 DB 오류를 `.catch(() => null)` 로 묵음 처리한다. `HooksService.getActiveExecutionStatus` 는 null 반환을 "활성 execution 없음"으로 해석하므로, DB 장애 시 실제로 활성 execution 이 진행 중임에도 새 execution 이 시작될 수 있다(fail-open). 채팅 채널에서 사용자가 연속 메시지를 보내고 DB가 간헐적으로 응답 지연을 보이는 경우 중복 실행이 발생할 수 있음.
- 제안: fail-open 이 의도된 설계라면 명확한 문서화와 메트릭 알림이 필요. 더 안전한 접근은 DB 오류 시 null 대신 오류를 re-throw하거나, caller 에서 오류를 명시적으로 처리하는 것. 현재 in-progress 플랜에 fail-open 모니터링 언급이 있으므로 후속 처리가 필요.

---

## 요약

이번 변경은 주로 (1) `extractClientIpFromHeaders` 반환 타입을 `null`에서 `undefined`로 통일하여 불필요한 `?? undefined` 변환을 제거하고, (2) `HooksService.getActiveExecutionStatus`가 private 브래킷 접근(`['executionRepository']`) 대신 `ExecutionsService.getStatusById()` 공개 API를 사용하도록 캡슐화하는 리팩터링이다. 보안 측면에서 인젝션 취약점, 하드코딩된 시크릿, XSS, 암호화 문제는 발견되지 않았다. 에러 처리는 CWE-209를 준수하며 드라이버 원문 마스킹, stored-XSS 방지 등 적절한 방어 코드가 갖춰져 있다. 주목할 사항은 `getStatusById`의 DB 오류 묵음(fail-open) 설계로, 채팅 채널 환경에서 DB 장애 시 활성 execution이 존재함에도 새 execution이 시작되는 중복 실행이 발생할 수 있다는 점이다. 이는 의도된 설계이나 모니터링과 문서화가 수반되어야 한다. 또한 webhook 경로에서 `req.ip`(trust-proxy) 폴백이 누락된 알려진 IP 추출 갭이 있으며, 이는 in-progress 플랜에서 후속 처리 예정이나 IP whitelist 기반 인증의 완결성을 위해 조기 해결이 권장된다.

---

## 위험도

LOW
