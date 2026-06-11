# Requirement Review — SSRF Guard All-Auth (refactor 04 C-3)

**리뷰 일시**: 2026-06-11  
**대상 파일**: error-codes.ts, http-request.handler.ts, http-request.handler.spec.ts, plan files, consistency review artifacts

---

## 발견사항

### **[INFO]** dry-run 분기가 SSRF 가드 앞에 위치해 dry-run 시 SSRF 검증 건너뜀
- 위치: `http-request.handler.ts` ~line 321 (`isDryRun(context)` 분기) vs line 346 (`assertSafeOutboundUrl`)
- 상세: dry-run 분기가 SSRF 가드 블록보다 앞에 위치해 dry-run 실행 시 `assertSafeOutboundUrl` / `assertSafeOutboundHostResolved` 가 호출되지 않는다. 코드 주석("We deliberately branch BEFORE the SSRF host checks ... no real request leaves the process, so those guards have nothing to protect against")이 이 동작을 의도적으로 명시하고 있다. spec §4 step 8 은 "fetch 호출 전" SSRF 가드를 요구하며 dry-run 은 fetch 자체가 없으므로 논리적으로 일관성이 있다. 기능 요구사항 위반이 아니라 spec 에 명시되지 않은 dry-run 예외 처리다. spec §4 step 8 이 이 예외를 명문화하지 않아 가시성이 낮다.
- 제안: 없음 (코드 정합, spec 에 dry-run 예외 서술 보강은 선택).

### **[INFO]** configEcho 열거 vs 스키마 필드 완전 일치 확인
- 위치: `http-request.handler.ts` line 164-177 (configEcho 빌드)
- 상세: `httpRequestNodeConfigSchema` (`http-request.schema.ts`)는 `method`, `url`, `authentication`, `integrationId`, `headers`, `queryParams`, `body`, `bodyType`, `responseType`, `timeout`, `followRedirects`, `verifySsl` 12개 필드를 정의한다. configEcho 명시 열거가 이 12개 필드를 정확히 일대일 매핑하고 있음을 확인했다. Principle 7 D1 준수 완전. 스키마에 `.passthrough()` 가 선언되어 있어 향후 스키마 외 필드가 통과될 수 있지만, configEcho 는 스키마 정의 12개 필드만 명시 열거하므로 추가 필드가 passthrough 되어도 echo 에 포함되지 않는다. 의도된 설계.

### **[INFO]** SSRF logUsage 시 `integrationId` 조건 — integration 이면서 `integrationId` 가 undefined 인 엣지 케이스
- 위치: `http-request.handler.ts` line 352 (`if (authentication === 'integration' && integrationId)`)
- 상세: `authentication === 'integration'` 이지만 `integrationId` 가 undefined 인 경우(사용자가 integration 인증을 선택했으나 integrationId 를 미입력) SSRF 차단 시 logUsage 가 호출되지 않는다. 기존 코드에서도 동일 패턴(`if (integrationId)`)이 integration credential 해석 단계에서 사용됐으므로 회귀가 아니다. spec §4.2 의 Usage 로깅 매트릭스는 `authentication='integration'` 전제로 기술하고 있으며, integrationId 미설정 시 행동에 대한 명시는 없다. 이 경우 `INTEGRATION_SERVICE_UNAVAILABLE` 또는 `INTEGRATION_CALL_FAILED` 로 이미 앞 단계(line 190-238)에서 분기하므로 실제 SSRF 가드까지 도달하지 않는다. 기능 완전성 이상 없음.

### **[INFO]** `HTTP_TIMEOUT` enum 값이 error-codes.ts 에 존재하나 handler 에서 미사용
- 위치: `error-codes.ts` line 13 (`HTTP_TIMEOUT: 'HTTP_TIMEOUT'`), handler spec §6
- 상세: `error-codes.ts` 에 `HTTP_TIMEOUT` 이 여전히 남아 있으며 `HTTP_BLOCKED` 가 신규 추가됐다. spec §6 에러 코드 표는 `HTTP_TRANSPORT_FAILED` 가 타임아웃을 포함(통합 코드)한다고 명시하며, handler 에서 `HTTP_TIMEOUT` 을 독립적으로 사용하지 않는다. 이는 `3-error-handling.md §1.4` 에서 `HTTP_TIMEOUT` 을 독립 코드로 열거하는 것과의 기존 불일치를 그대로 계승한다. 본 변경이 신규로 만든 문제가 아니다.

---

## Spec Fidelity 분석

### 핵심 요구사항 구현 일치 여부

**spec §4 step 8 (SSRF 가드 전 인증 방식 공통)**: 코드가 `if (authentication === 'integration')` 게이트를 제거하고 unconditional `try { assertSafeOutboundUrl; assertSafeOutboundHostResolved }` 블록으로 교체했다. spec 요구사항과 정확히 일치한다.

**spec §4 step 2 (Principle 7 D1 — 명시 열거)**: configEcho 빌드가 `{ ...rawConfig }` spread 에서 12개 스키마 필드 명시 열거로 교체됐다. spec §4 step 2 본문 및 schema 필드 목록과 line-level 로 일치한다.

**spec §4.2 (Usage 로깅 — integration 한정)**: catch 블록 내 `if (authentication === 'integration' && integrationId)` 조건으로 logUsage 를 integration 인증에만 제한한다. SSRF 차단의 error 포트 반환은 전 인증 공통. spec §4.2 와 §4 step 8 명세 일치.

**spec §4 step 8 opt-out**: `ALLOW_PRIVATE_HOST_TARGETS=true` 환경변수 opt-out 이 `http-safety.ts` 내 `isPrivateHostsAllowed()` 에 배선되어 있고, 가드 함수 자체에서 opt-out 을 처리하므로 handler 는 별도 분기 없이 함수 호출만으로 정책을 따른다. spec opt-out 요구사항 충족.

**error-codes.ts HTTP_BLOCKED 등재**: spec §5.8·§6 및 plan 체크리스트에서 요구한 `HTTP_BLOCKED` enum 등재가 완료됐다. comment 에 "Applies to ALL auth methods (refactor 04 C-3)" 명시.

### [SPEC-DRIFT] spec §4 step 8 이 dry-run 예외를 명문화하지 않음
- 위치: `http-request.handler.ts` line 311-332 (dry-run 분기) vs `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/spec/4-nodes/4-integration/1-http-request.md` §4 step 8
- 상세: 코드가 dry-run 시 SSRF 가드를 의도적으로 건너뜀을 주석으로 명문화했으나, spec §4 step 8 은 이 예외를 서술하지 않는다. 코드의 판단("no real request leaves the process, so those guards have nothing to protect against")은 합리적이며 의도적이다. 코드를 되돌리는 것이 오답이며, spec §4 step 8 에 dry-run 예외를 서술하는 것이 올바른 해결이다.
- 제안: 코드 유지 + spec `§4 step 8` 에 "(dry-run 실행 시 실제 fetch 가 발생하지 않으므로 SSRF 가드 생략 — `spec/5-system/13-replay-rerun.md §7` 참조)" 한 줄 추가. 대상 spec: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/spec/4-nodes/4-integration/1-http-request.md` §4 step 8.

### 테스트 코드 요구사항 충족 분석

**`blocks authentication=none requests to cloud IMDS (04 C-3)`**: 169.254.169.254 (link-local, IMDS) 를 `authentication='none'` 으로 요청해 `port: 'error'`, `output.error.code === 'HTTP_BLOCKED'`, `output.error.message` 에 'SSRF_BLOCKED' 포함, logUsage 미호출 검증. plan §테스트 요구사항 완전 충족.

**`blocks authentication=custom requests to private RFC1918 (04 C-3)`**: 10.0.0.5 RFC1918 대역을 `authentication='custom'` 으로 요청해 HTTP_BLOCKED 확인. 요구사항 충족.

**`allows none-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true (opt-out)`**: env 설정 후 opt-out 동작 확인, finally 블록에서 env 원복. 요구사항 충족. env 원복 로직이 `prev === undefined` 케이스(delete)와 기존 값 복원 케이스를 모두 처리하여 테스트 격리 완전.

**credential-leak 방지 테스트 (Principle 7 D1)**: 비-스키마 credential-shape 필드(`apiKey`, `authToken`)가 `rawConfig` 에 주입되어도 `result.config` 에 노출되지 않음을 검증. 값 문자열(`SUPER_SECRET_KEY`)의 JSON stringify 출력 내 부재도 확인. 요구사항 완전 충족.

---

## 요약

핵심 기능 요구사항(SSRF 가드 전 인증 방식 적용, configEcho spread 금지 명시 열거, HTTP_BLOCKED 에러코드 등재, none/custom 인증 SSRF 차단 테스트, ALLOW_PRIVATE_HOST_TARGETS opt-out 테스트)이 모두 완전히 구현됐다. spec §4 step 8 및 §4.2 와 코드 구현이 line-level 로 일치한다. 발견된 사항은 INFO 4건(dry-run 예외 처리 가시성, configEcho-스키마 완전 일치 확인, integrationId 미설정 엣지, HTTP_TIMEOUT 잔존)이며 기능 결함이 없다. SPEC-DRIFT 1건은 dry-run 예외를 spec 이 서술하지 않은 것으로 코드 동작이 합리적이고 의도적이며 되돌리는 것이 오답이다.

---

## 위험도

**LOW**

INFO 4건, SPEC-DRIFT 1건(spec 갱신 필요). 기능 요구사항 충족 완전.

---

STATUS: OK
