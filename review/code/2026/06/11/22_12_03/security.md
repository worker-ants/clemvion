# 보안(Security) Review

## 발견사항

### **[INFO]** `req.ip` 신뢰 — trust proxy 미설정 시 클라이언트 조작 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `create`, `update`, `regenerate`, `remove`, `reveal` 핸들러
- 상세: 컨트롤러가 `req.ip`를 감사 로그의 `ipAddress`로 전달한다. Express/NestJS 에서 `app.set('trust proxy', ...)` 가 구성되지 않으면 `req.ip`는 직접 TCP 연결 소켓의 IP(즉, 리버스 프록시 IP)를 반환하거나, `trust proxy`가 `true`로 과도하게 설정되면 클라이언트가 `X-Forwarded-For` 헤더를 위조해 임의 IP를 주입할 수 있다. 감사 로그의 `ipAddress`는 포렌식 자료로 쓰이므로, 조작 가능한 값이 기록되면 사후 추적력이 저하된다.
- 제안: `spec/5-system/1-auth.md §2.3`의 IP 추출 정책(`CF-Connecting-IP → X-Forwarded-For 첫 항목 → req.ip`) 과 일치하는 공통 헬퍼(`extractClientIp(req)`)를 만들어 컨트롤러에서 일관 적용한다. 동일 정책이 `LoginHistory`에 이미 존재한다면 재사용이 가장 안전하다. 현재 plan의 §3 "IP 추출 정책 spec 명시" 항목과 연결된다.

### **[INFO]** `reveal` 비밀번호 재확인에 rate limit 미적용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — `reveal` 핸들러
- 상세: `POST /api/auth-configs/:id/reveal` 은 현재 로그인 비밀번호를 본문으로 받아 bcrypt 비교를 수행한다. 단시간 다수 요청을 보내면 비밀번호를 온라인으로 brute-force할 수 있다. `plan/in-progress/auth-config-webhook-followups.md §4`에도 이미 식별된 백로그 항목이다.
- 제안: NestJS `@nestjs/throttler`를 사용해 해당 엔드포인트에 엄격한 rate limit(예: 분당 5회, 시간당 20회)을 적용한다.

### **[INFO]** `update` 서비스에서 `Object.assign(config, data)` — 오염 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `update` 메서드 (~line 1790)
- 상세: `Object.assign(config, data)` 는 `data` 의 모든 키를 `config` 엔티티에 덮어쓴다. `UpdateAuthConfigDto` 가 화이트리스트(class-transformer `@Exclude`/허용 필드만 선언)로 제한되어 있다면 문제없지만, DTO 에 검증이 부족하거나 향후 필드가 추가될 때 `workspaceId`, `id`, `isActive` 등 보안에 민감한 필드까지 사용자 입력으로 덮어쓸 수 있다. 이 변경에서 DTO 내용은 확인 불가지만, mass assignment 패턴 자체가 잠재적 위험을 내포한다.
- 제안: `Object.assign` 대신 허용 필드만 명시적으로 복사하거나, DTO 에 `@Expose()` + `plainToInstance({ excludeExtraneousValues: true })` 를 적용해 의도하지 않은 필드가 엔티티에 반영되지 않도록 한다.

### **[INFO]** `basic_auth` 자격증명 평문 저장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create` 메서드
- 상세: `basic_auth` 타입의 경우 `username`/`password` 가 자동 발급 없이 사용자 입력 그대로 `config` 컬럼에 저장된다(spec §2.17.1 인정 설계). DB가 침해될 경우 평문 자격증명이 노출된다. `api_key`, `bearer_token`, `hmac` 은 랜덤하게 발급되므로 예측이 어렵지만, `basic_auth` 의 경우 사용자가 지정한 비밀번호라 재사용 위험도 있다. 이는 신규 취약점이 아니며 이 PR이 도입한 것도 아니지만, 감사 로그 추가로 해당 동작이 더 많은 감시 하에 놓이게 되어 언급한다.
- 제안: `ENCRYPTION_KEY` 기반 대칭 암호화로 `config` 컬럼의 민감 필드(`key`, `token`, `secret`, `password`)를 at-rest 암호화하는 것을 중기 과제로 검토한다. `plan/in-progress/auth-config-webhook-followups.md §3`의 `secret-store.md` 개선과 연계 가능하다.

### **[INFO]** HMAC 알고리즘 화이트리스트가 생성/재발급 경로에 미적용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create` 메서드
- 상세: `verifyHmac` 에서는 `HMAC_ALLOWED_ALGORITHMS`(`sha256`, `sha512`) 화이트리스트로 약한 알고리즘을 차단하지만, `create` 시 `config.algorithm` 을 저장할 때는 입력값 검증 없이 그대로 저장된다. `CreateAuthConfigDto`에서 검증이 이미 이루어진다면 중복이지만, 서비스 레이어에서도 방어적 검증을 하면 계층 방어가 강화된다. 이는 이 PR이 새로 도입한 문제는 아니지만 서비스 코드를 다루는 김에 언급한다.
- 제안: `create` 메서드 내 `type === 'hmac'` 분기에서 `config.algorithm` 이 `HMAC_ALLOWED_ALGORITHMS` 에 있는지 검증하고, 화이트리스트 밖이면 `BadRequestException`을 던진다.

## 요약

이번 변경은 `auth_config` CRUD 4종에 감사 로그를 추가하고, 권한 레벨을 `editor` → `admin`으로 상향 조정한 보안 강화 작업이다. 상수 단일 SoT 강제(`AUDIT_ACTIONS` union), `constantTimeEquals` 타이밍 안전 비교, IP 화이트리스트 fail-closed 패턴 등 기존 보안 설계를 잘 유지하고 있다. 중대한 취약점은 없으며, 발견사항은 모두 INFO 등급이다. 주요 주의 사항은 `req.ip` 직접 사용으로 인한 감사 로그 IP 조작 가능성(trust proxy 설정 의존), `reveal` 엔드포인트 rate limit 부재(기존 백로그 확인), `Object.assign` 기반 mass assignment 패턴이다. 하드코딩된 시크릿, 인젝션 취약점, 인증 우회, 안전하지 않은 암호화 알고리즘은 발견되지 않았다.

## 위험도

LOW
