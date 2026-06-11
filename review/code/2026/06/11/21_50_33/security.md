### 발견사항

- **[INFO]** `req.ip` 직접 사용 — 프록시/리버스 프록시 환경에서 IP 스푸핑 가능성
  - 위치: `auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove`, `reveal` 핸들러 전체 (`req.ip` 전달 라인)
  - 상세: `req.ip` 는 Express 의 `trust proxy` 설정에 따라 달라진다. `trust proxy` 가 활성화되지 않은 상태에서 로드밸런서·리버스 프록시 뒤에 배포되면 `req.ip` 가 프록시 IP 를 반환한다. 반대로 `trust proxy = true` 가 지나치게 넓게 설정되면 클라이언트가 `X-Forwarded-For` 헤더를 위조해 임의의 IP 를 audit 로그에 기록할 수 있다. 단, audit 로그의 `ipAddress` 는 보안 게이트가 아닌 포렌식 목적이므로 실제 인가 우회 위협은 없다. 또한 spec §2.3 에서 IP 추출 우선순위(`CF-Connecting-IP → X-Forwarded-For → req.ip`)가 정의되어 있으나 CRUD audit 핸들러들은 이를 따르지 않고 `req.ip` 만 사용한다.
  - 제안: spec §2.3 의 IP 추출 정책(CF-Connecting-IP → X-Forwarded-For → req.ip)을 공통 헬퍼 함수로 추출하고 audit ipAddress 기록에도 일관 적용. 이미 reveal 엔드포인트와 동일 패턴이므로 공통화 시 일관성 확보.

- **[INFO]** `ipAddress` 파라미터가 optional(`?`) 이어서 감사 로그에 IP 가 기록되지 않을 수 있음
  - 위치: `auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove`, `reveal` 시그니처 (`ipAddress?: string`)
  - 상세: `ipAddress` 가 `undefined` 로 전달되면 `AuditLogsService.record` 에 `ipAddress: undefined` 가 넘어가 DB 컬럼에 NULL 이 저장된다. 현재 controller 는 `req.ip` 를 항상 전달하므로 정상 경로에서는 문제없다. 그러나 향후 service 를 내부에서 직접 호출하는 경우(백그라운드 작업, 마이그레이션 스크립트 등) ipAddress 누락이 감사 추적성을 저하시킨다.
  - 제안: 내부 전용 호출 경로가 없다면 큰 위험은 아니나, 테스트 코드에서 `USER` 상수만 전달하고 `ipAddress` 를 생략하는 케이스가 다수 존재한다는 점을 인지하고, 운영 경로는 항상 IP 를 제공하도록 주석/문서를 보완.

- **[INFO]** `basic_auth` 타입의 `password` 가 평문으로 DB 에 저장됨 — 설계 의도이나 위협 면 인지 필요
  - 위치: `auth-configs.service.ts` `create` 메서드 내 basic_auth 분기, `verifyBasicAuth`
  - 상세: `basic_auth` 타입은 사용자가 `username`/`password` 를 직접 입력하고 이를 검증 비교용으로 저장한다. 코드는 `basic_auth: 자동 발급 없음 — username/password 보존` 으로 의도를 명시하고, `SECRET_CONFIG_KEYS` 마스킹으로 응답에서 노출은 방지한다. 그러나 DB 에 평문 저장 → DB 유출 시 자격증명 노출이다. 해당 config 는 외부 webhook 송신자가 보내는 인증 정보를 수신 검증하는 용도이므로, 수신자(서버)가 비밀을 알아야 하는 구조상 해시 저장이 근본적으로 불가하다. 단, 이 설계 결정이 spec 및 문서에 명시되어 있지 않으면 향후 검토자가 오해할 수 있다.
  - 제안: 해당 파일 주석 또는 spec §2.17 에 "수신 검증용이므로 평문 저장 불가피, ENCRYPTION_KEY 로 at-rest 암호화가 적용된다" 명시를 권장. `ENCRYPTION_KEY` 가 실제로 AuthConfig.config 컬럼에 적용되는지 entity 레벨에서 확인 필요.

- **[INFO]** `constantTimeEquals` 의 길이 불일치 → `false` 반환은 timing leak 이 아니나 길이 자체가 누출됨
  - 위치: `auth-configs.service.ts` `constantTimeEquals` 메서드 (1977–1980라인)
  - 상세: 길이 불일치 시 즉시 `false` 를 반환하는 구현은 공격자가 응답 시간으로 토큰 길이를 추론할 수 있게 한다. 고정 길이 토큰(`wfk_`, `wft_`, `whs_` prefix + 고정 hex)을 사용하므로 실용적 위협은 낮지만, 순수한 constant-time 비교라고 볼 수 없다.
  - 제안: 위협도 낮음. `timingSafeEqual` 에 앞서 길이를 일치시키는 패딩 또는 두 버퍼를 최대 길이로 확장 후 비교하는 방식을 선택할 수 있으나, 현재 고정 길이 토큰 사용 맥락에서는 수용 가능한 구현.

- **[INFO]** `update` 메서드에서 `Object.assign(config, data)` 가 config 에 임의 필드를 덮어쓸 수 있음
  - 위치: `auth-configs.service.ts` `update` 메서드 (1696–1697라인)
  - 상세: `data` 가 `Partial<AuthConfig>` 이고 DTO 레벨 검증이 controller 에서 `UpdateAuthConfigDto` 로 이루어지므로, DTO 스키마가 적절히 제한한다면 인가된 필드만 수정된다. 그러나 `Object.assign` 은 화이트리스트 기반이 아니라 `data` 에 포함된 모든 키를 적용하므로, DTO 검증 우회 시(또는 내부 호출 시) `workspaceId` 등 민감 필드가 덮어씌워질 수 있다.
  - 제안: `UpdateAuthConfigDto` 에서 허용되는 필드 목록을 명시적으로 선택(destructuring 또는 pick)하는 방식이 더 안전. 현재 DTO 가 충분히 제한적이라면 낮은 위험.

- **[INFO]** reveal 엔드포인트의 rate limiting 미적용 (기존 인지된 항목)
  - 위치: `auth-configs.controller.ts` `reveal` 핸들러 (343–376라인), `plan/in-progress/auth-config-webhook-followups.md §4`
  - 상세: 비밀번호 재확인 + bcrypt 비교가 있어 brute-force 비용이 높지만, Throttler 미적용 시 병렬 요청 폭격이 가능하다. plan 에서 인지된 항목.
  - 제안: `@Throttle` 데코레이터 또는 전역 Throttler 설정 적용. plan §4 에서 이미 추적 중.

---

### 요약

이번 변경은 AuthConfig CRUD 작업에 감사 로그(audit log) 기록을 추가한 보안 강화 작업이다. `@CurrentUser('sub')` 와 `req.ip` 를 통해 행위 주체와 IP 를 capture 하는 구조는 적절하며, `@Roles('admin')` 가드로 CRUD 접근을 Admin+ 로 제한하고 있다. HMAC 알고리즘 화이트리스트(`sha256`, `sha512`), constant-time 비교(`timingSafeEqual`), IP 화이트리스트 fail-closed, reveal 시 bcrypt 비밀번호 재확인 등 기존 보안 설계가 잘 유지되고 있다. 주요 우려사항은 `req.ip` 가 spec §2.3 의 IP 추출 정책과 일치하지 않는 점(포렌식 정확성 문제), `ipAddress` optional 설정, `Object.assign` 기반 update 의 필드 제한 수준이며 모두 낮은 위험도다. 하드코딩된 시크릿·SQL 인젝션·XSS·의존성 취약점은 발견되지 않았다.

### 위험도

LOW
