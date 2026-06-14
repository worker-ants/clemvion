# Rationale 연속성 검토 결과

검토 모드: --impl-done  
Scope: `spec/2-navigation/6-config.md`  
Diff base: origin/main

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] R-6 Rationale 내 캘린더 버킷 기각 근거가 구현에 정확히 반영됨 — 확인 완료

- target 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `USAGE_PERIOD_WINDOWS_MS` 상수 및 `periodRaw` 집계 쿼리
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-6` — "캘린더 버킷(일/주/월 경계) 대신 현재 시점 기준 롤링 윈도를 택했다"
- 상세: 구현은 `COUNT(*) FILTER (WHERE e.started_at >= :since24h)` 패턴으로 롤링 윈도를 적용하며, 캘린더 경계 기반 집계는 채택되지 않았다. R-6 의 기각 결정과 완전히 일치한다.
- 제안: 추가 조치 불필요.

### [INFO] 전용 call-log 엔티티 미도입 결정이 구현에 정확히 반영됨 — 확인 완료

- target 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` 주석 및 `auth-configs.service.ts`
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-6` — "전용 call-log 엔티티 미도입. ... Execution 을 SoT 로 재사용"  
  `spec/1-data-model.md` §2.13 AuthConfig 호출 집계 경로 — "(Integration 이 전용 IntegrationUsageLog(§2.10.1)를 두는 것과 달리, AuthConfig 의 '호출' 은 워크플로 실행과 1:1 이므로 Execution 을 재사용해 이중기록을 피한다.)"
- 상세: V096 은 `execution` 테이블에 `source_ip`/`response_code` 컬럼을 추가하는 방식으로 구현했다. 별도 auth-call-log 테이블 신설은 없다. 마이그레이션 헤더 주석도 이 설계 결정을 정확히 설명한다.
- 제안: 추가 조치 불필요.

### [INFO] Flyway forward-only 정책 준수 확인

- target 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` 파일 하단 `-- DOWN:` 주석
- 과거 결정 출처: `spec/0-overview.md ## Rationale` "forward-only 채택 (§2.8 롤백 정책)" — "별도 undo 스크립트(`U{version}__...sql`)는 두지 않는다. ... 각 마이그레이션 파일 하단의 `-- DOWN:` 주석으로 충분"
- 상세: V096 은 별도 undo 스크립트 없이 파일 하단에 `-- DOWN:` 주석 블록을 포함한다. 기각된 `U{version}` 자동 undo 패턴은 사용되지 않았다.
- 제안: 추가 조치 불필요.

### [INFO] `extractClientIp` 단일 호출 경로 — R-6 소스 IP 캡처 경로와 일치

- target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` 및 chat-channel 경로 각각 `const clientIp = extractClientIp(input.headers)` 를 인증 검증 전에 한 번만 호출
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-6` — "hooks.service 가 webhook 진입 시 extractClientIp ... 결과를 인증 IP whitelist 검증과 호출 이력 영속에 공용으로 쓴다"
- 상세: 두 경로 모두 단일 `clientIp` 변수를 인증 검증(`this.authConfigsService.verifyWebhookAuth`) 과 execute options(`sourceIp: clientIp ?? undefined`) 양쪽에 전달한다. 중복 호출이나 별도 추출 경로 없이 R-6 의 "공용" 결정을 충실히 구현한다.
- 제안: 추가 조치 불필요.

### [INFO] 응답 코드 폴백 정책 — R-6 · WH-MG-05 이행 확인

- target 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `responseCode: e.responseCode ?? e.status`
- 과거 결정 출처: `spec/2-navigation/6-config.md ## Rationale R-6` — "schedule 등 비-HTTP 트리거는 HTTP 코드가 없어 response_code 가 NULL 이며, getUsage 가 워크플로 status enum 으로 폴백 표시한다"
- 상세: null-coalescing `e.responseCode ?? e.status` 가 R-6 의 폴백 정책을 정확히 구현한다. 성공 경로 webhook 의 `WEBHOOK_ACCEPTED_RESPONSE_CODE = String(HttpStatus.ACCEPTED) = '202'` 는 "execution 생성 성공 경로는 항상 202 Accepted" 결정과도 일치한다.
- 제안: 추가 조치 불필요.

---

## 요약

구현 변경(`spec/2-navigation/6-config.md §A.3` 호출 이력 — 소스 IP·응답 코드·기간별 호출 수)은 해당 spec 의 `## Rationale R-6` 과 `spec/1-data-model.md §2.13` 의 모든 설계 결정을 준수한다. 과거 Rationale 에서 기각된 대안(전용 call-log 엔티티, 캘린더 버킷 집계, `U{version}` undo 스크립트)이 재도입된 사례는 발견되지 않았으며, `extractClientIp` 단일 경로·202 응답 코드 고정·NULL 폴백 표시 등 합의된 원칙도 모두 올바르게 반영됐다. Rationale 연속성 관점에서 위반·번복·충돌이 없다.

---

## 위험도

NONE
