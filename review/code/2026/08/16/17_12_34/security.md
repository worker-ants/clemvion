# 보안(Security) 코드 리뷰

## 스코프 요약

이번 변경의 핵심은 `Execution.error`/`NodeExecution.error` (DB JSONB 컬럼)가 내부 REST 읽기
경로(`GET /api/executions/:id`, `getChain`, `stop`, `findByWorkflow`, `background-runs`)와
WS `execution.snapshot` 에서 **마스킹 없이 원문**으로 나가고 있던 실제 자격증명 유출 결함을
닫는 보안 수정이다 (`redactStoredErrorForResponse` → 기존 `deepRedactSecrets` 위임). 신규
인젝션·인증 우회·하드코딩 시크릿은 발견되지 않았고, 오히려 기존 정보 노출(CWE-209 계열)
취약점을 해소하는 방향의 변경이다.

## 발견사항

- **[INFO]** 응답 DTO 가 여전히 엔티티 spread(denylist) 패턴 — 신규 컬럼 추가 시 자동 노출 위험
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:922-928` (`toResponseExecution`)
  - 상세: `const { trigger: _t, executor: _e, ...rest } = execution;` 로 `trigger`/`executor` 두
    관계만 명시적으로 제외하고 나머지 `Execution` 엔티티 필드 전부를 그대로 응답에 편입한다.
    이번 PR 이 추가한 `error` 마스킹도 이 denylist 위에 한 겹 더 얹는 방식이라, 앞으로
    `Execution` 엔티티에 민감한 컬럼(예: 내부 diagnostic 필드)이 추가되면 **명시적으로
    막지 않는 한 자동으로 응답에 노출**된다. 같은 문제가 `background-runs.service.ts` 의
    `toNodeExecutionDto`(명시적 필드 나열이라 상대적으로 안전)와는 성격이 다르다 — 이 함수만
    spread 방식이다. 이번 라운드 consistency checker(`16_48_55` convention_compliance INFO 6)도
    `swagger.md §5-1` "엔티티 직접 노출 금지" 조항과의 미합치로 이미 지적했고, PR 스코프 밖으로
    명시돼 있다.
  - 제안: 이번 PR 범위는 아니지만, 향후 `Execution` 엔티티에 필드를 추가하는 PR 에서는
    이 함수를 명시적 allowlist DTO 매핑으로 전환하는 것을 고려할 것 (또는 최소한 새 컬럼
    추가 시 이 함수를 함께 점검하는 체크리스트 항목을 남길 것).

- **[INFO]** 잔여 노출 표면 — WS `execution.node.*` emit 및 내부 REST `inputData`/`outputData`
  는 이번 마스킹 관문을 지나지 않는다 (의도적 범위 밖, 이미 트래커에 등재됨)
  - 위치: `spec/5-system/14-external-interaction-api.md:1508-1511` (§R17 "잔여(범위 밖)" 불릿)
  - 상세: `websocket.gateway.ts`(및 관련 emit 경로)의 `execution.node.*` 이벤트는 여전히
    `NodeExecution.error` 원문을 실어 내보내고, 내부 `GET /api/executions/:id` 의
    `inputData`/`outputData` 는 외부 EIA `getStatus` 가 거는 `stripAndRedact` 를 거치지 않는다.
    이번 diff 가 만든 신규 갭은 아니고(선존), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 명시적으로 등재·추적 중이다. 다만 두 표면 모두 이번에 닫힌 `error` 필드와 **같은 위험
    프로파일**(viewer 롤을 포함한 워크스페이스 멤버 전원에게 노출, `@Roles` 게이트 없음)을
    공유하므로, 이 PR 이 만든 마스킹 관문 패턴(`toResponseExecution` 단일 초크포인트)을 그대로
    재사용해 조속히 닫는 것을 권장한다.
  - 제안: 별도 조치 불요(이미 계획됨). 후속 plan 착수 시 이번 PR 의 "자매 넷 중 하나만" 회귀
    패턴을 반복하지 않도록 동일한 단일 관문 설계를 재사용할 것.

- **[INFO]** `Trigger.config.interaction.triggerToken` 평문 JSONB 보관 (기존 설계, 이번엔 문서화만)
  - 위치: `spec/conventions/secret-store.md:42-48`
  - 상세: 이번 diff 는 기존에 이미 평문으로 저장되던 값에 대해 "명시적 비대상 예외"로
    문서화만 했을 뿐 코드/저장 방식 자체를 바꾸지 않았다. 문서가 스스로 근거((a) hot-path
    timing-safe 비교, (b) rotation 으로 즉시 무효화, (c) 서버 발급 랜덤값이라 노출 시 blast
    radius 가 해당 트리거 1건으로 한정)를 제시하며 위험을 인지하고 있어 새로운 결함은
    아니다. DB 유출 시나리오에서는 여전히 평문 토큰이 그대로 노출된다는 점만 기록해 둔다.
  - 제안: 조치 불요 — 이미 근거를 갖춘 의식적 트레이드오프. 향후 다른 필드가 같은 예외를
    근거 없이 재사용하지 않도록(문서가 스스로 캐비엇을 둠) 유지만 하면 된다.

## 관점별 점검 결과 (요약)

- **인젝션**: 모든 신규/변경 쿼리가 TypeORM parameterized `where`/`andWhere` 를 사용 —
  SQL 인젝션 신규 표면 없음. `background-runs.service.ts` 의 raw `#>>` JSONB 경로도 파라미터
  바인딩(`:backgroundRunId`)이라 안전.
- **하드코딩 시크릿**: 없음. `redact-stored-error.spec.ts`(`codebase/backend/src/shared/utils/redact-stored-error.spec.ts`)
  의 `sk-live-abc123def456`, `Bearer zzz` 등은 마스킹 대상을 검증하기 위한 합성 테스트
  픽스처이며, 같은 패턴이 기존 `sanitize-error-message.spec.ts` 에도 이미 쓰인다. 실제 자격증명
  아님.
- **인증/인가**: 변경되지 않음. `verifyOwnership`/`verifyExecutionAccess`/IDOR 방지(404 통일)
  로직은 그대로이고, 이번 diff 는 마스킹만 추가했다. `GET /api/executions/:id` 에 `@Roles`
  게이트가 없는 것은 기존 설계(spec R-5 로 문서화된 의도적 결정)이며 이번 PR 이 그 사실을
  근거로 삼아 마스킹을 강화한 것이지, 새로 도입한 약점이 아니다.
- **입력 검증**: `redactStoredErrorForResponse` 는 `null`/`undefined` 를 안전하게 정규화하고,
  `deepRedactSecrets` 는 `MAX_REDACT_DEPTH`(10) 로 재귀 깊이를 제한해 비정상 깊이의 JSONB 값에
  의한 스택 오버플로/DoS 를 방지한다(기존 유틸, 이번 diff 는 재사용만).
  `SECRET_LEAK_PATTERNS` 정규식들은 앵커·bounded quantifier 위주로 구성돼 있어 nested
  quantifier 로 인한 ReDoS 패턴은 관측되지 않는다.
- **암호화**: 변경 없음. `AuthConfig.config`/`notification.signing.secretRef` 는 여전히
  AES-256-GCM/`SecretResolver` 경유. 이번 diff 가 다루는 `Execution.error` 마스킹은 저장이
  아니라 응답 egress 값 마스킹(§R17 egress-only 원칙 — DB 는 원문 보존, 로그/사후 디버깅
  진실성 유지)이라 암호화 정책과는 직교.
- **에러 처리**: 바로 이 축이 이번 diff 의 본론이다 — 종전에 `Execution.error`/
  `NodeExecution.error` 가 응답에 원문으로 실려 Bearer 토큰·DB 연결 문자열의 자격증명
  부분이 워크스페이스 viewer 에게까지 노출되던 것을 4개 독립 반환 경로(`findById` ·
  `toExecutionDto` · `getChain` · `stop`, 자매 `background-runs.service.ts` 포함)에서 일관되게
  마스킹한다. 테스트(`executions.service.spec.ts` "Execution.error 응답 마스킹 — 표면 전수",
  `background-runs.service.spec.ts` 신규 케이스)가 표면별로 개별 단언해 "하나만 빠짐" 회귀를
  차단하도록 설계돼 있다. DB 원문 보존(egress-only) 도 별도 테스트로 고정.
- **의존성 보안**: 신규 외부 의존성 추가 없음(기존 내부 유틸 재사용).

## 요약

이번 변경은 신규 취약점을 도입하지 않으며, 오히려 실제로 존재하던 **정보 노출(민감 정보가
에러 메시지에 노출)** 취약점 — DB 컬럼 `Execution.error`/`NodeExecution.error` 에 담긴
Bearer 토큰·DB 연결 문자열의 자격증명 조각이 `@Roles` 게이트 없는 내부 REST/WS 조회
경로를 통해 워크스페이스 viewer 롤까지 원문으로 노출되던 문제 — 를 닫는 방어적 수정이다.
마스킹은 기존에 검증된 `deepRedactSecrets` 유틸을 재사용하고, 4개(+자매 표면 포함 5개)
독립 반환 경로를 단일 관문(`toResponseExecution`)으로 묶어 "자매 중 하나만 마스킹" 이라는
이 저장소의 반복 결함 패턴을 구조적으로 방지했다. 표면별 전수 테스트, 캐시 경로 마스킹,
DB 비변이(egress-only) 불변식까지 각각 별도 테스트로 고정돼 있어 회귀 방지력도 양호하다.
남은 항목(WS `execution.node.*` emit, `inputData`/`outputData` 비대칭, entity-spread DTO
패턴)은 전부 기존에 인지되고 트래커에 등재된 범위 밖 잔여 갭으로, 이번 diff 가 새로 만든
결함이 아니다.

## 위험도

NONE — 신규 보안 결함 없음. 검토한 변경은 기존 정보노출 취약점을 해소하는 방향이며,
발견사항은 전부 참고용 INFO(이미 인지·추적 중인 범위 밖 잔여 항목).
