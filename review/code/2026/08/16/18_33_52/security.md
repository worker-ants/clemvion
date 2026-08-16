# 보안(Security) Review

> 5라운드째 동일 코드에 대한 재검토다. 코드(`codebase/**`)는 `17_12_34`~`18_14_50` 4라운드에서
> 이미 CRITICAL 0으로 수렴했고(`git log`상 HEAD `95e7a56e8` 이후 `codebase/**` 변경 없음), 본
> 라운드는 그 결론을 그대로 인용하지 않고 소스를 직접 열어 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 이번 diff는 신규 취약점이 아니라 기존 CWE-209(민감정보 노출) 를 닫는 방어적 수정이며, 마스킹 관문이 실제로 식별된 모든 읽기 표면에 적용돼 있음을 직접 확인
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:57-64` (`redactStoredErrorForResponse`), 소비처 — `codebase/backend/src/modules/executions/executions.service.ts:994-999`(`toResponseExecution`, `findById`/`getChain`/`stop` 공용 관문) · `:638-644`(`findById` 내부 `NodeExecution.error` 형제 필드) · `:950`(`toExecutionDto`, 목록 경로) · `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:285-303`(`toNodeExecutionDto`)
  - 상세: `Execution.error`/`NodeExecution.error` 를 반환하는 4+1개 지점(`findById`·`getChain`·`stop`·`toExecutionDto`·`background-runs`)을 실제로 열어 각각 `redactStoredErrorForResponse` 호출이 걸려 있음을 확인했다. `deepRedactSecrets`(`codebase/backend/src/shared/utils/sanitize-error-message.ts`)의 `SECRET_LEAK_PATTERNS`는 Bearer 토큰·URI userinfo·`client_secret`류 키워드·bare JWT를 커버하며, `null`/`undefined` 입력은 즉시 `null`로 정규화하고 입력을 변이하지 않는 순수 함수다. DB 컬럼 자체는 원문 보존(egress-only 마스킹)이라 서버 로그·사후 디버깅 경로에는 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** IDOR/권한 검증이 리팩터 과정에서 훼손되지 않고 보존됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:249-274`(`verifyOwnership`) · `:281-297`(`verifyWorkflowOwnership`) · `:311-320`(`isOwnerOrAdmin`, RR-PL-06) · 호출부 `codebase/backend/src/modules/executions/executions.controller.ts:87`·`:114-117`·`:144`·`:176`·`:253`
  - 상세: `GET /executions/:id`·`/workflow/:workflowId`·`POST /:id/stop`·`/:id/continue`·e2e 전용 `/:id/_test/simulate-execution-run-redelivery` 모두 workspace 소유권 검증(`verifyOwnership`/`verifyWorkflowOwnership`)을 거치며 불일치 시 404로 통일해 ID enumeration을 차단한다. `re-run`/`chain`은 `RR-PL-06`(대상 워크스페이스 owner/admin, `JwtPayload.role`이 아니라 `WorkspacesService.getMemberRole` 재조회)을 따로 검증한다 — 이 로직들은 이번 diff의 리팩터(`toResponseExecution` 도입, `stop`/`stopInternal` 분리) 대상 밖이며 실제로 손상되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** e2e 전용 백도어 엔드포인트의 다층 방어 확인
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:217-228`(`_test/recover-stuck-executions`) · `:238-256`(`:id/_test/simulate-execution-run-redelivery`)
  - 상세: `@Roles('owner')` + `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트, 미충족 시 404(라우트 부재로 위장)로 존재 자체를 숨긴다. 후자는 추가로 `verifyOwnership`까지 거쳐 cross-workspace 접근을 막는다. 이번 diff의 변경 대상이 아니고 그대로 보존됨을 확인.
  - 제안: 조치 불필요.

- **[INFO]** SQL 인젝션 표면 없음 — 파라미터 바인딩 전수 확인, `getSortColumn`은 화이트리스트
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1018-1026`(`getSortColumn`) · `:333-361`(`computeChainDepth`, 파라미터화된 raw SQL)
  - 상세: 사용자 입력으로 정렬 컬럼을 받는 `getSortColumn`은 고정 매핑 테이블에서만 값을 꺼내고(`allowed[sort] || 'startedAt'`), 매핑에 없는 임의 문자열이 템플릿 리터럴(`` `e.${sortColumn}` ``)에 그대로 들어갈 여지가 없다. 재귀 CTE(`computeChainDepth`)도 `$1`/`$2` 바인딩만 사용한다. 이번 diff가 건드리지 않은 부분이지만 마스킹 관문 삽입 지점 주변에 인젝션 표면이 새로 생기지 않았음을 확인했다.
  - 제안: 조치 불필요.

- **[INFO]** `Trigger.config.interaction.triggerToken` 평문 저장 — 기존 코드 동작 무변경, 문서만 정정
  - 위치: `spec/conventions/secret-store.md` (§1 신규 블록) / 실제 코드는 `codebase/backend/src/modules/triggers/triggers.service.ts:969`(diff 대상 아님, 실측 확인)
  - 상세: 코드 자체(`triggerToken: newToken` 평문 저장)는 이번 diff 이전부터 존재하며 변경되지 않았다. 이번 diff는 이 결정을 "검토 예정"에서 "근거 있는 영구 예외"로 문서화하며, 이전 라운드가 지적한 논리적 약점(근거 (a) "timing-safe 비교를 위해 평문이 필요"는 사실 해시+`crypto.timingSafeEqual`로도 동일하게 성립하므로 필요성 근거가 아님)을 스스로 정정해 반례를 명시하고 있다. 실질 근거 (c)(서버 발급 랜덤 hex, 1회 노출, 유출 영향 범위가 해당 트리거 하나로 국한)는 타당하다.
  - 제안: 코드 변경이 아니므로 이번 PR을 막을 사유는 아니다. "해시 저장 + timing-safe 비교" 전환은 문서에 이미 유효한 후속 개선으로 열려 있으므로 별도 트래킹 확인만 하면 된다.

- **[INFO]** `GET /api/executions/:id` 등 조회 엔드포인트에 `@Roles` 게이트 부재는 기존 설계이며 이번 diff가 신규로 만들거나 악화시키지 않음
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:63-89`(`findOne`) · `:293-312`(`getChain`) · `codebase/backend/src/modules/executions/background-runs/background-runs.controller.ts:24-66`
  - 상세: `spec/2-navigation/14-execution-history.md` R-5가 이 설계(viewer 포함 워크스페이스 멤버 전원 조회 가능)를 이미 문서화했고, 이번 diff는 오히려 그 노출면에 값 마스킹 통제를 추가하는 방향이다. 다만 R-5의 원 근거(Config 탭 echo 마스킹)를 `Execution.error`에 그대로 원용하면 오독 소지가 있었는데, 이번 diff가 `spec/2-navigation/14-execution-history.md:467`에 "R-5의 직접 대상은 Config 탭 하나이고 error 필드는 별개 정책(egress 마스킹)"이라는 캐비엇을 명시적으로 추가해 그 오독을 스스로 차단했다.
  - 제안: 조치 불필요. 인가 모델 자체(viewer 조회 허용)를 바꾸는 것은 이 PR의 범위가 아니다.

- **[INFO]** 하드코딩된 시크릿 없음 — 테스트 픽스처는 합성 값
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (`sk-live-abc123def456`, `postgres://u:pw@db.internal/prod`, `Bearer zzz`, `api_key: 'k-1'` 등)
  - 상세: 모두 마스킹 함수 자체를 검증하기 위한 명백한 합성 예시(내부 호스트명 `db.internal`, 대표적 접두사 패턴)이며 실제 발급된 자격증명의 형태가 아니다. `git diff origin/main...HEAD -- codebase/`를 AWS 키·PEM 헤더·Slack/GitHub 토큰 패턴으로 grep한 결과도 0건.
  - 제안: 조치 불필요.

## 요약

이번 changeset의 실질 코드 변경은 신규 leaf 유틸 `redact-stored-error.ts`와 그 소비처 5곳(`ExecutionsService`의 `findById`/`getChain`/`stop`/`toExecutionDto`, `BackgroundRunsService`의 `toNodeExecutionDto`)으로 국한되며, 소스를 직접 열어 확인한 결과 기존 CWE-209급 정보 노출(종결 emit 경로만 마스킹되고 내부 REST 읽기 경로·WS snapshot·형제 필드 `NodeExecution.error`는 원문으로 새던 것)을 닫는 방어적 수정이다. IDOR 가드(`verifyOwnership`/`verifyWorkflowOwnership`/RR-PL-06)·파라미터화 쿼리·e2e 백도어의 다층 게이팅은 리팩터 과정에서 훼손되지 않고 그대로 보존됐다. 새 인젝션 벡터, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화는 발견되지 않았다. `triggerToken` 평문 저장은 기존(diff 이전) 코드 동작이고 이번 diff는 그 결정의 근거를 오히려 더 정확하게(반례 명시) 정정하는 문서 변경뿐이라 이 PR을 막을 사유가 아니다. 4라운드 연속 동일 판정과 일치하며, 독립 재검증에서도 CRITICAL/WARNING급 신규 발견은 없다.

## 위험도

NONE
