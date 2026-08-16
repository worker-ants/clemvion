# 보안(Security) 리뷰

## 개요

이번 변경의 핵심은 **CWE-209/CWE-200 계열 결함(민감정보 노출)의 수정**이다. 종전엔 `execution.failed` 종결 emit 경로(#1177)만 `Execution.error` 값을 마스킹했고, 같은 컬럼을 내보내는 **읽기 경로**(`GET /api/executions/:id`, `GET /executions/:id/chain`, `POST /executions/:id/stop`, `GET /executions?workflowId=`, `GET /executions/:id/background-runs/:id`, WS `execution.snapshot`)는 원문을 그대로 반환하고 있었다. `codebase/backend/src/shared/utils/redact-stored-error.ts` 를 신설해 `ExecutionsService`·`BackgroundRunsService` 의 모든 독립 반환 경로에 일관 적용했다. 코드·테스트·spec 문서를 대조 실측한 결과, 아래와 같이 판단한다.

## 검증한 항목

- **표면 전수 커버리지**: `executions.service.ts` 에서 `error` 를 다루는 자리 4곳(`toResponseExecution` 경유 `findById`/`getChain`/`stop`, `toExecutionDto`)과 `nodeExecutions[].error`, `background-runs.service.ts` 의 body 노드 `error` 까지 `redactStoredErrorForResponse` 로 일관 커버됨을 `grep` 으로 재확인했다(빠진 자리 없음).
- **내부 소비자 영향 없음**: `stop()` 의 반환 타입이 `Execution → ResponseExecution` 으로 좁아졌지만, 실제 내부 호출부(`interaction.service.ts:226,248`, `hooks.service.ts:407`)는 반환값을 버리고(discard) HTTP 컨트롤러(`executions.controller.ts:145`)만 소비한다 — 문서의 주장을 실측으로 재확인.
- **DB 원문 보존(egress-only)**: `redactStoredErrorForResponse`/`deepRedactSecrets` 는 copy-on-change 이고, `stop`/`findById` 등은 엔티티를 변이하지 않고 응답 직전에만 마스킹한다(`executions.service.spec.ts` 의 `'DB 원문은 건드리지 않는다'` 테스트로 고정).
- **`GET /api/executions/:id` 등에 `@Roles` 게이트가 없다**는 서술을 컨트롤러 실코드(`executions.controller.ts:63`, `background-runs.controller.ts:24`)로 대조 확인 — 사실이며, 이 PR 이 신규로 만든 노출이 아니라 **기존에 문서화된 설계**(spec §R-5 "boundary masking parity")를 전제로 이번 PR 이 그 마스킹 parity 갭을 메우는 방향이다. 즉 이 PR 은 기존 위험을 줄이는 방향으로만 작동한다.
- **테스트/문서 내 시크릿 형태 문자열**(`sk-live-abc123def456`, `postgres://u:pw@db.internal/prod`, `Bearer zzz` 등)은 마스킹 로직 검증용 합성 fixture이며, 실 자격증명이 아니다. `git diff` 전수로 실 자격증명 패턴(`AKIA…`, `ghp_…`, PEM 키, 실제 `postgres://user:realpw@`) 이 섞여 들어간 흔적은 없다.
- **`spec/conventions/secret-store.md`** 에 `Trigger.config.interaction.triggerToken` 을 `secret://` 통합 대상에서 명시 제외하는 결정이 이번 diff 에 포함돼 있으나, 이는 **문서가 기존 코드 동작(이미 JSONB 평문 저장)을 추인하는 것**이지 이번 PR 이 새로 평문 저장을 도입한 것이 아니다. 근거(hot-path timing-safe 비교, rotation 즉시무효화, 값공간이 닫힌 서버발급 랜덤 hex)도 문서에 명시돼 있다.

## 발견사항

- **[INFO]** 남은 마스킹 갭이 CHANGELOG/스펙에 스스로 등재돼 있다 (신규 결함 아님, 확인용 기록)
  - 위치: `CHANGELOG.md:32` (그리고 `spec/5-system/14-external-interaction-api.md` §R17 잔여 불릿)
  - 상세: WS `execution.node.*` **emit** 경로의 `error` 는 여전히 원문, `inputData`/`outputData` 컬럼은 이번 마스킹 대상에 포함되지 않음, `workflow-assistant` LLM 도구 표면은 키-기반 마스킹만 적용된다는 사실이 이번 PR 자체에서 "잔여 갭(의도, 트래커 등재)"로 명시적으로 문서화되어 있다. 코드 변경이 이 갭을 만든 것은 아니고, 다만 리뷰어 관점에서 잔여 노출면으로 인지해둘 필요가 있다.
  - 제안: 별도 트래커 항목으로 이미 등재됐다고 서술돼 있으므로 이번 PR 범위에서는 추가 조치 불필요. 후속 PR 에서 WS `execution.node.*` emit 경로도 동일 관문을 통과하도록 확장 검토를 권장.

- **[INFO]** `deepRedactSecrets` 의 값-패턴 정규식이 이번 PR 로 새 표면(REST 읽기 경로 4곳 + WS snapshot + background-runs)에 반복 적용되게 됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`redactStoredErrorForResponse`) 가 위임하는 `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`
  - 상세: 해당 정규식들(Bearer, client-secret/token 키워드, bare JWT, URI userinfo lookbehind/lookahead 등)은 이번 diff 의 변경 대상이 아니며 각 패턴이 중첩 정량자 없이 선형 구조라 catastrophic backtracking 형태는 아닌 것으로 보인다. 다만 이번 PR 로 호출 빈도(목록·상세·chain·stop·background-run 매 응답마다)가 늘어나므로, 공격자가 통제 가능한 매우 큰 `error`/`details` 필드를 만들 수 있는 경로가 있다면 CPU 비용이 그만큼 늘어난다. `MAX_REDACT_DEPTH=10` 재귀 캡과 depth-0 WeakMap 캐시가 이미 존재해 완화되어 있다.
  - 제안: 이번 PR 범위에서 별도 조치 불필요(사전 존재하는 유틸 재사용, 정규식 자체는 변경 없음). 신규 결함 아님, 참고 사항으로만 기록.

- **[INFO]** 문서(`spec/conventions/secret-store.md`)가 `Trigger.config.interaction.triggerToken` 평문 JSONB 보관을 명시적 비대상 예외로 확정
  - 위치: `spec/conventions/secret-store.md` (§1 하단 신설 블록)
  - 상세: 이번 diff 자체는 코드 동작을 바꾸지 않고 기존 동작(평문 저장)을 문서에 명시적으로 인정한 것이다. 근거(hot-path timing-safe 비교, rotation 즉시 무효화, 서버 발급 랜덤 hex 값공간, 1회 노출)가 함께 기재돼 있어 의식적 트레이드오프로 보인다. 코드 변경(이번 diff 범위)이 없으므로 이번 리뷰에서 별도 조치를 요구하지 않는다.
  - 제안: 조치 불요. 향후 이 필드에 대한 timing 공격 방어(비교 시 `crypto.timingSafeEqual` 사용 여부)는 이번 diff 범위 밖이라 별도 확인이 필요하면 그쪽 코드를 대상으로 별도 리뷰 권장.

## 인젝션·인증/인가·암호화·의존성 관점 확인

- SQL/커맨드/경로탐색 인젝션: 이번 diff 는 문자열 마스킹(정규식 치환)과 TypeORM 조회부(`createQueryBuilder`, `findOne`) 재사용뿐이며 신규 raw SQL·동적 커맨드·경로 조합이 없다. 인젝션 표면 변화 없음.
- 인증/인가: `@Roles` 게이트 부재는 기존 설계(spec R-5)이고 이번 PR 이 신규로 약화시키지 않았다. 오히려 그 설계가 전제하는 "boundary masking parity" 를 실질적으로 채우는 방향.
- 암호화: 해시/암호화 알고리즘 신규 도입 없음. `deepRedactSecrets` 는 암호화가 아니라 패턴 치환(마스킹)이며 그 성격이 코드/문서에 명확히 기술돼 있다.
- 의존성: 신규 외부 패키지 도입 없음(순수 내부 유틸 재사용).

## 요약

이번 변경은 신규 취약점을 도입하지 않고, 기존에 존재하던 정보노출(민감정보가 종결 이벤트 경로에서만 마스킹되고 다른 읽기 경로에서는 원문으로 새던 결함)을 4개 서비스 반환 경로 + 형제 필드(`nodeExecutions[].error`) + 자매 컨트롤러(`background-runs`)까지 전수로 닫는 방어적 수정이다. 내부 소비자 영향(반환 타입 축소)도 실사용 지점을 grep 으로 대조해 안전함을 확인했다. DB 원문 보존(egress-only) 원칙도 코드·테스트로 고정돼 있다. 남은 갭(WS `execution.node.*` emit, `inputData`/`outputData`, workflow-assistant 도구)은 PR 스스로 명시적으로 잔여 항목으로 등재해 두었고 이번 범위 밖이다. 시크릿 하드코딩, 인젝션, 인가 우회, 암호화 약화 등 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
