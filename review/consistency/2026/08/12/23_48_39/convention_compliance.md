# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 메모

- 실제 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
  `idempotency.interceptor.spec.ts` 한 쌍뿐이다(캐시 엔트리·payload 손상을 `discardCorruptEntry` 로
  통합하고 warn 로그를 추가, bodyHash 판정을 payload 파싱보다 앞에 두도록 순서 고정). spec 파일 자체의
  diff 는 없다 — 따라서 이번 검토는 "diff 가 신설한 conventions 위반"이 아니라 **그 diff 가 서술하는
  기능을 다루는 `spec/data-flow/15-external-interaction.md`(및 형제 data-flow 문서)가 기존
  `spec/conventions/**` 정식 규약을 준수하는가"를 확인하는 것에 집중했다.
- 프롬프트 번들은 `spec/conventions/error-codes.md` · `execution-context.md` ·
  `interaction-type-registry.md` · `node-output.md` · `swagger.md` · `migrations.md` ·
  `conversation-thread.md` 등 **EIA 문서와 가장 밀접한 conventions 파일들을 컨텍스트 예산 초과로 전부
  절단**했다(각 파일 안내 문구 "본문 생략됨 — 컨텍스트 예산 초과"). 판정 신뢰성을 위해 이 파일들을
  worktree 절대경로로 직접 `Read` 해 대조했다(아래 근거에 반영). 이 반복되는 절단 자체는 별도 INFO 로
  적는다.

## 대조 결과

### 1. 명명 규약

- 에러 코드: 목표 문서가 나열하는 `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `TOKEN_SCOPE_MISMATCH` /
  `TOKEN_AUDIENCE_MISMATCH` / `TOKEN_INVALID` / `STATE_MISMATCH` / `EXECUTION_TERMINATED` /
  `VALIDATION_ERROR` / `IDEMPOTENCY_KEY_CONFLICT` / `TOO_MANY_CONNECTIONS` / `WEBCHAT_IDLE_TIMEOUT` 는
  전부 `spec/conventions/error-codes.md` §1 이 요구하는 `UPPER_SNAKE_CASE` + 의미 기반 명명을 따른다.
  diff 가 던지는 `ConflictException({ error: { code: 'IDEMPOTENCY_KEY_CONFLICT', ... } })` 도 동일 표기.
  §3 historical-artifact 예외 레지스트리에 이 코드들이 없는 것도 맞다 — 예외가 아니라 원칙 준수이기
  때문.
- Secret URI: 목표 문서 §1.5 의 `secret://triggers/<id>/notification-signing` 은
  `spec/conventions/secret-store.md` §1 URI Scheme(`secret://<scope>/<resourceId>/<name>`, scope/name
  모두 kebab-case)과 정확히 일치한다.
- BullMQ 큐 이름(`notification-webhook` / `notification-secret-rotator` /
  `terminal-revoke-reconcile` / `webchat-idle-reaper` / `execution-continuation`)은 모두
  `spec/data-flow/0-overview.md` §4 큐 카탈로그에 동일 이름·동일 producer/consumer 로 등재되어 있어
  카탈로그 동기화 규율("큐가 늘어나면 본 표와 해당 도메인 spec 의 외부 의존 섹션 모두 갱신")도
  충족한다.
- Migration 참조 표기(`V060` / `V036` / `V107` 등)는 `spec/conventions/migrations.md` §1 명명 규약과
  형식이 맞고(단조 증가 정수, 문서 인용은 축약 `V<N>` 형태가 리포 전역 관례), 실제 엔티티
  (`execution-token.entity.ts` — `jti` PK / `execution_id` FK ON DELETE CASCADE / `issued_at` /
  `exp_at`)와 §2.1 Schema 매핑 표의 컬럼 서술이 정확히 일치해 §3.3("컬럼명은 항상 entity/migration 에서
  직접 인용")을 충족한다.

### 2. 출력 포맷 규약

- HTTP status ↔ 에러 코드 매핑(401 TOKEN_*, 409 STATE_MISMATCH/IDEMPOTENCY_KEY_CONFLICT, 410
  EXECUTION_TERMINATED, 400 VALIDATION_ERROR, 429 TOO_MANY_CONNECTIONS, 403 refresh-token itk_* 거부)은
  `spec/conventions/swagger.md` §2-4 상태 코드 표와 어긋나지 않는다.
- diff 가 던지는 예외 payload 형태 `{ error: { code, message } }` 는 `error-codes.md` 가 위임하는
  envelope SoT(`5-system/3-error-handling.md §2.1` · `2-api-convention.md §5.3`)와 부합하는 형태를
  그대로 유지한다 — 이번 diff 는 envelope 을 새로 만들지 않고 기존 `ConflictException` 호출 형태를
  그대로 재사용했다.

### 3. 문서 구조 규약

- `spec/data-flow/15-external-interaction.md` 는 `spec/data-flow/0-overview.md` §3 "공통 규약"(도메인
  spec 5요소: System role / Source→Sink 다이어그램 / Schema 매핑 표 / 상태 전이 / 외부 의존)을 섹션
  순서까지 그대로 따른다(`## Overview → ### System role`, `## 1. Source → Sink`, `## 2. Schema 매핑`,
  `## 3. 상태 전이`, `## 4. 외부 의존`, `## Rationale`). CLAUDE.md 가 요구하는 Overview/본문/Rationale
  3섹션 구성도 만족한다.
- 번들에 포함된 형제 data-flow 문서(0-overview, 1-audit, 2-auth, 3-execution, 4-file-storage,
  5-integration, 6-knowledge-base, 7-llm-usage, 8-notifications, 9-observability, 10-triggers,
  11-workflow, 12-workspace, 13-agent-memory, 14-chat-channel) 전부 동일하게 `## Overview` /
  `## Rationale` 을 갖춰 구조 규약을 이탈하지 않는다. 파일명도 `0-overview.md` + `N-<slug>.md` 패턴을
  일관 유지한다.

### 4. API 문서 규약 (swagger/OpenAPI)

- 대상 문서는 data-flow 서술이라 컨트롤러/DTO 데코레이터를 직접 선언하지 않는다. 문서가 언급하는
  Bearer scheme(`interaction-token`, `iext_*`/`itk_*`)은 `swagger.md` §2-1 이 정의한 것과 동일 이름이라
  불일치 없음. 이번 diff 는 컨트롤러·DTO 를 건드리지 않아 §1(DTO 패턴)·§5(응답 DTO 규약) 적용 대상
  자체가 아니다.

### 5. 금지 항목

- `swagger.md` §1-4 가 금지하는 "닫힌 union 을 `additionalProperties` 로 뭉개는" 패턴, §6 "빈 껍데기
  스키마" 패턴 등은 이번 diff·대상 문서 어디에도 나타나지 않는다.
- `error-codes.md` §2 가 금지하는 "이름 정확성 향상만을 위한 rename" 도 해당 없음 — 이번 변경은 로직
  리팩터(경로 통합 + warn 추가)이며 코드 값 자체는 그대로다.

## 발견사항

- **[INFO]** conventions 번들 절단이 EIA 관련 핵심 문서를 정확히 겨냥해 반복됨
  - target 위치: 프롬프트 `## 정식 규약 모음` 섹션, `spec/conventions/error-codes.md` ·
    `execution-context.md` · `interaction-type-registry.md` · `node-output.md` · `swagger.md` ·
    `migrations.md` · `conversation-thread.md` 등
  - 위반 규약: 없음(프로세스 관찰 — 규약 위반이 아니라 검토 파이프라인의 예산 배분 이슈)
  - 상세: `spec/data-flow/15-external-interaction.md` 가 직접 참조하거나 명명 규율을 공유하는
    conventions 파일들이 "컨텍스트 예산 초과"로 전부 본문 생략된 채 전달됐다. 이번 검토에서는 해당
    파일들을 절대경로로 직접 열어 대조해 판정 신뢰성을 확보했지만, 다음 회차에도 동일 절단이 반복되면
    (특히 error-codes/swagger/interaction-type-registry 처럼 명명·출력 포맷 규약의 SoT 인 문서가
    빠지면) convention checker 가 근거 없이 PASS/BLOCK 을 내는 거짓 판정 위험이 있다.
  - 제안: orchestrator 프롬프트 조립 시 target 디렉토리(`spec/data-flow/`)가 명시적으로 cross-reference
    하는 `spec/conventions/*.md` 파일(문서 본문의 링크 목록에서 추출 가능)에 예산 우선순위를 주는 방안
    검토. (기존 메모리 feedback_consistency_spec_mode_budget.md 와 동일 계열 — 새 사례로 재확인됨)

## 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts` — 캐시 엔트리/payload 손상 처리 통합 + warn 로깅 +
판정 순서 고정)는 spec 파일을 건드리지 않았고, 그 기능을 서술하는
`spec/data-flow/15-external-interaction.md` 는 에러 코드 표기(`UPPER_SNAKE_CASE`), secret URI scheme,
BullMQ 큐 카탈로그 동기화, migration 컬럼 인용, 0-overview.md §3 의 도메인 문서 5-요소 구조,
CLAUDE.md 의 Overview/본문/Rationale 3섹션 구성을 모두 충족한다. `spec/conventions/**` 의 명시적 금지
패턴(닫힌 union 을 열린 map 으로 뭉개기, 빈 껍데기 swagger 스키마, 근거 없는 에러 코드 rename)도
관측되지 않았다. 프롬프트 번들 자체가 관련 conventions 다수를 예산 초과로 절단한 점만 프로세스
차원의 관찰 사항으로 남긴다(직접 원본 대조로 보완 완료, 실제 위반 없음).

## 위험도

NONE
