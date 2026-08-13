STATUS=success cross_spec review complete (0 CRITICAL / 0 WARNING / 1 INFO)
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

이번 diff 는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
(+ `.spec.ts`) 한 파일에 국한된다. 변경 내용은:

- 캐시 엔트리(바깥 JSON)뿐 아니라 **엔트리 내부 `responseJson`** 파싱 실패도 방어(종전엔 `SyntaxError`
  가 `GlobalExceptionFilter` 까지 올라가 500 으로 마스킹됐다).
- `JSON.parse` 가 문법 오류에만 던지는 한계(`'null'`·`'42'`·`'[]'` 등은 통과)를 메우기 위해
  `isIdempotencyEntry()` 형태 검증 + `isHttpStatusCode()` 범위 검증(100~599) 추가.
- `rawKey === null` (truthiness 대신 명시 비교)로 판정 책임을 `readKey` 로 일원화.
- fail-open 경로를 "3경로"→"5경로" 로 재열거하고 각 경로의 warn 로그 존재 여부를 문서화.

`isErrorStatusCacheable`(2xx/409/410 닫힌 목록)·캐시 키 스코프(`interaction:idempotency:<executionId>:<route>:<key>`)·
TTL(24h) 등 스펙이 규정하는 계약면(response shape, endpoint, 캐시 대상 판정)은 diff 에서 **변경되지 않았다**.

## 대조한 SoT

- `spec/5-system/14-external-interaction-api.md` §R8 ("Idempotency-Key 와 `submit_form` 검증 실패의
  관계" / "캐시 대상은 닫힌 목록이다" / "캐시 키 스코프" / "스코프 단위는 토큰이 아니라 execution")
  — 이 문서는 프롬프트 번들에서는 컨텍스트 예산 초과로 절단돼 있었으나, 실제 워크트리 절대경로에서
  직접 확인함 (`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434/spec/5-system/14-external-interaction-api.md:1053-1066`).
- `spec/data-flow/15-external-interaction.md` §2.2 Redis 표 + Rationale "Fail-open 정책의 일관 표기".
- `spec/5-system/3-error-handling.md` (`IDEMPOTENCY_KEY_CONFLICT` 409 매핑).
- 저장소 전체에서 idempotency 를 언급하는 다른 영역(`spec/7-channel-web-chat/1-widget-app.md`,
  `spec/conventions/chat-channel-adapter.md`, `spec/5-system/15-chat-channel.md` CCH-SE-02,
  `spec/data-flow/3-execution.md` BullMQ jobId idempotency)을 전수 grep — 전부 **다른 idempotency
  개념**(BullMQ jobId dedup·chat provider `update_id` 기반 어댑터 자동발급)이라 이번 diff 의
  Redis 캐시 로직과 이름만 겹칠 뿐 실제 sink·계약이 분리돼 있어 충돌 표면이 아니다.

## 발견사항

- **[INFO]** fail-open 경로 개수(3→5) 열거가 코드 docstring 에만 존재
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스 docstring (신규 5-path 표)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §Rationale "Fail-open 정책의 일관 표기" / §2.2 Redis 표
  - 상세: 코드 docstring 은 이제 fail-open 경로를 5개로 표(#1 미주입 ~ #5 캐시 손상)로 명시하지만,
    대응하는 spec 문서는 여전히 "Redis … 전 경로 fail-open (warn) — 가용성 우선" 정도의 일반 서술만
    갖고 있어 개수·경로 목록이 spec 쪽엔 없다. 직접적 모순은 아니다 (spec 이 "3개" 라고 못박은 적이
    없으므로 코드가 5개로 갱신됐다고 spec 과 어긋나는 문장은 없다) — 다만 diff 자체의 주석이
    "종전 세 경로 라고 적혀 있었는데 실제로는 어긋났다" 는 drift 를 지적하고 있어, 같은 종류의 drift 가
    spec 문서(개수를 명시하지 않는 서술 방식) 쪽에서도 다음에 재발할 여지가 있다.
  - 제안: 급하지 않음. spec 문서 갱신이 필요하면 §2.2 Redis 표의 idempotency 캐시 행에 "손상 엔트리도
    fail-open 대상(신규 처리로 강등)" 한 문장만 추가해 코드 docstring 과의 상세 수준 격차를 줄이는
    정도로 충분 — 목록 개수까지 미러링할 필요는 없다(운영 문서가 구현 세부 사항의 스냅샷을 따라가면
    오히려 stale 위험이 커진다는 점은 `4-execution-engine.md` 의 "멤버 수 갱신" Rationale 에서도 이미
    같은 논리로 코드-SoT 를 선언한 전례가 있음).

다른 5개 관점(데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / 권한·RBAC / 계층 책임)에서는 충돌
없음:

- **API 계약**: 응답 shape(`{executionId, accepted, currentStatus}` 등)·엔드포인트·상태코드 매핑
  (`IDEMPOTENCY_KEY_CONFLICT`=409) 은 diff 에서 불변. 캐시 판정 로직이 정확해진 것뿐이며 클라이언트가
  관측하는 계약면은 동일.
- **요구사항 ID**: 새 ID 부여 없음. 기존 `EIA-IN-11`/`EIA-RL-02`/`R8` 참조만 유지.
- **상태 전이**: `iext_*`/`itk_*` 토큰 상태 머신, execution 상태 전이 모두 무변경.
- **RBAC**: `InteractionGuard` 검증 로직 무변경 — 이번 diff 는 Guard 이후의 캐시 계층에 한정.
- **계층 책임**: 캐시 손상 처리 책임이 인터셉터 내부(`discardCorruptEntry`)로 수렴했을 뿐, 모듈
  경계(엔진 ↔ external-interaction ↔ Redis)는 그대로.

## 요약

diff 는 `IdempotencyInterceptor` 의 Redis 캐시 엔트리 파싱을 문법 검증에서 형태 검증으로 강화하고,
내부 payload(`responseJson`) 파싱 실패까지 fail-open 경로에 포함시킨 순수 방어적 하드닝이다.
`spec/5-system/14-external-interaction-api.md` §R8 의 캐시 대상 닫힌 목록(2xx/409/410)·캐시 키 스코프
(execution+route)·`spec/5-system/3-error-handling.md` 의 에러코드 매핑 등 cross-spec 계약면과 대조한
결과 직접 모순은 없다. 저장소 전역에서 "idempotency" 를 사용하는 다른 세 영역(BullMQ jobId dedup,
chat-channel 어댑터 자동발급 키)은 이름만 겹칠 뿐 별개 sink 라 충돌 표면이 아니다. 유일한 관찰은 코드
docstring 의 신규 5-path fail-open 열거가 spec 문서엔 미러링되지 않았다는 점이나, spec 이 그 개수를
못박은 적이 없어 모순은 아니고 개선 여지(INFO) 수준이다.

## 위험도

NONE
