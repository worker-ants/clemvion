# 보안(Security) 리뷰 결과

대상: 공개 웹채팅 위젯 idle-wait execution 회수 reaper (EIA-RL-07, PR-2) — `WebchatIdleReaperService` +
`ExecutionEngineService.markWebchatIdleTimeout` + `InteractionTokenService.findIdleWebchatExecutionIds` +
관련 모듈 배선·env·spec/plan 동기화 문서.

## 발견사항

- **[INFO]** `markWebchatIdleTimeout` 이 engine 계층에서 "공개 위젯(anonymous)" 자격을 재검증하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:981-1043` (`markWebchatIdleTimeout`)
  - 상세: 이 메서드는 `id = :id AND status = 'waiting_for_input'` 만 조건부 UPDATE 가드로 사용하고, 대상이 실제로 `auth_config_id IS NULL`(익명 공개 위젯)인지, 발급 토큰이 정말 전량 만료됐는지는 재검증하지 않는다. 그 판정은 전적으로 호출측인 `InteractionTokenService.findIdleWebchatExecutionIds`(§EIA-AU-04 invariant 기반 pre-filter)에 위임돼 있다. 현재는 `WebchatIdleReaperService.reapOne` 만이 이 메서드를 호출하고 어떤 컨트롤러도 `executionId` 를 외부 입력으로 이 메서드에 전달하지 않으므로 **현재 시점에 외부에서 직접 악용 가능한 경로는 없다**. 다만 향후 다른 호출자(예: 관리자 API, 다른 백그라운드 잡)가 이 메서드를 재사용하면 인증 트리거의 정상 `waiting_for_input` execution(예: form/AI 대기)까지 검증 없이 취소될 위험이 있다 — caller-side 전용 enforcement 는 이 코드베이스에 반복되는 패턴(cf. 알림 설정 API 사례)이지만, 이 메서드는 이름(`markWebchatIdleTimeout`)이 "공개 위젯 idle" 을 함의하므로 오용 시 조용히 잘못된 execution 을 취소시킬 수 있다.
  - 제안: 최소한 JSDoc 에 "호출자가 EIA-RL-07 대상 자격(anonymous + 토큰 전 만료)을 사전 검증했다고 가정 — 검증되지 않은 executionId 로 호출 금지" 경고를 명시하거나, engine 쪽에서도 `trigger.authConfigId IS NULL` join 조건을 UPDATE 절에 추가해 defense-in-depth 를 확보. (현재 exploit 가능성 없음 — 강등된 등급.)

- **[INFO]** `findIdleWebchatExecutionIds` 가 per_execution 토큰 family 를 암묵적 invariant(EIA-AU-04)에 의존
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:548-572`
  - 상세: 쿼리는 `execution_token` row 존재 자체를 "per_execution 접근 증거"로 해석해 별도 토큰 family 필터를 두지 않는다(주석에 명시된 설계 의도). 이 invariant("per_execution 만 `execution_token` row 를 남긴다")가 향후 다른 기능 추가로 깨지면(예: per_trigger 토큰도 같은 테이블에 기록되도록 변경), 인증된 트리거의 정상 대기 execution 이 익명 조건(`t.authConfigId IS NULL`)과 결합돼 의도치 않게 조기 취소될 수 있다. 이는 기밀성/인젝션 이슈가 아니라 **가용성(원치 않는 조기 취소) 회귀 리스크**다.
  - 제안: 코드 주석대로 이 invariant 는 문서화돼 있으므로 당장 조치 불요. 다만 `execution_token` 테이블에 향후 필드(예: `token_family`)가 추가될 경우 본 쿼리도 함께 갱신하도록 spec/코드 양쪽에 상호 참조를 남기는 것을 권장.

## 점검 관점별 확인 사항 (문제 없음)

1. **인젝션**: 모든 신규 쿼리(`markWebchatIdleTimeout`, `findIdleWebchatExecutionIds`, e2e seed SQL)는 TypeORM QueryBuilder 파라미터 바인딩(`:id`, `:waiting`, `:threshold`, `:executionId`) 또는 `pg` parameterized query(`$1,$2,...`)만 사용 — 문자열 결합 없음. SQL 인젝션 벡터 없음.
2. **하드코딩된 시크릿**: 신규 코드에 시크릿 없음. `interaction-token.service.spec.ts` 의 `TEST_SECRET`(`unit-test-secret-must-be-long-enough-32b`)은 diff 이전부터 존재하던 단위테스트 전용 더미 값이며 프로덕션 자격증명이 아님(신규 도입 아님).
3. **인증/인가**: 이번 변경은 신규 REST 엔드포인트를 노출하지 않는 순수 백그라운드 BullMQ backstop이다. 대상 스코프는 `auth_config_id IS NULL`(공개 위젯) + `waiting_for_input` + 모든 발급 토큰 만료로 제한되며, 인증 트리거(`per_trigger`)·`formConfig.timeout` 은 명시적으로 배제된다. 위 INFO 두 건을 제외하면 인가 우회 경로 없음.
4. **입력 검증**: `WEBCHAT_IDLE_REAP_GRACE_MS` env 파서(`resolveWebchatIdleReapGraceMs`)는 `^\d+$` 정규식 선검증 + `parsed > 0` 체크 후에만 채택하고, 그 외(음수·소수·공학표기·`0`·빈 문자열)는 모두 안전한 기본값(1h)으로 폴백한다 — `0`(즉시 reap 허용)을 명시적으로 차단한 점이 특히 적절하다. `findIdleWebchatExecutionIds` 의 `batchLimit` 도 `[1, RECONCILE_BATCH_MAX(=1000)]` 로 clamp돼 단일 tick 당 처리량이 무제한으로 커지는 것을 방지한다.
5. **OWASP Top 10**: 해당 없음 특이사항 없음(A03 인젝션 없음, A01 접근제어는 위 INFO 참고, A09 로깅 항목 아래 참조).
6. **암호화**: 신규 암호화 로직 없음(JWT 서명/검증은 기존 `InteractionTokenService` 로직 재사용, 변경 없음).
7. **에러 처리**: `markWebchatIdleTimeout` 은 예외를 catch 해 `logger.error`/`logger.warn` 으로만 기록하고 호출자에게는 `boolean` 만 반환한다. EIA emit 페이로드의 `error.message` 도 고정 문자열("Execution cancelled: public web-chat widget idle-wait timeout")이라 내부 스택트레이스·DB 에러 문구가 클라이언트로 노출되지 않는다. `WebchatIdleReaperService.reap`/`reapOne` 도 fail-open swallow 패턴으로 개별 실패가 다른 execution 처리를 막지 않으며 민감정보 노출 없음.
8. **의존성 보안**: 신규 외부 의존성 없음(`@nestjs/bullmq`, `bullmq` 등 기존 스택 재사용).

## 요약

이번 변경(EIA-RL-07 idle-wait reaper)은 신규 REST 공격 표면을 만들지 않는 내부 BullMQ backstop이며, 모든 DB 접근이 파라미터 바인딩된 쿼리로 이루어져 인젝션 위험이 없고, env 파싱·배치 상한 등 입력 검증도 견고하다. 하드코딩된 시크릿이나 민감정보 노출 에러 메시지도 발견되지 않았다. 유일한 관찰 사항은 `markWebchatIdleTimeout` 이 engine 계층에서 "공개 위젯" 자격을 재검증하지 않고 호출자(reaper)의 사전 필터링에 전적으로 의존한다는 점과, 그 사전 필터링 자체가 `execution_token` row 존재를 per_execution 증거로 간주하는 문서화된 invariant 에 의존한다는 점인데, 둘 다 현재 외부에서 도달 가능한 악용 경로는 없어 INFO 등급으로 강등했다. 전반적으로 보안 관점에서 우려되는 결함은 없다.

## 위험도

LOW
