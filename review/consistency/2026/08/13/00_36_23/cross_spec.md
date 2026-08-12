# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done, diff-base=origin/main)

## 검토 범위 확인

이번 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
`idempotency.interceptor.spec.ts` 두 파일만 변경한다 (캐시 엔트리 형태 검증 `isIdempotencyEntry()` 추가,
안쪽 `responseJson` 손상 방어 `discardCorruptEntry()` 로 통합, warn 로그 일원화). **`spec/**/*.md` 는 이번
diff 에서 변경되지 않았다** — 즉 target(`spec/data-flow/`)는 기존 텍스트 그대로이고, 이번 회차는 "코드 변경이
기존(불변) spec 과 여전히 정합한가" 를 보는 순수 impl-vs-spec 라운드다.

핵심 계약 대조:
- `isErrorStatusCacheable`(409/410) — 변경 없음. [Spec EIA §R8](spec/5-system/14-external-interaction-api.md#r8-idempotency-key-와-submit_form-검증-실패의-관계) "캐시 대상은 닫힌 목록" 과 정합.
- 캐시 키 스코프(`interaction:idempotency:<executionId>:<route>:<key>`) — 변경 없음. R8 "캐시 키 스코프" 절과 정합.
- `bodyHash` 판정을 payload 파싱보다 앞에 두는 순서 — `EIA-RL-02`(동일 응답 24h 재현) 의 409 충돌 탐지를 보존.

`spec/7-channel-web-chat/`, `spec/5-system/15-chat-channel.md` (CCH-SE-02) 등 EIA 소비자 spec 은 이
인터셉터의 캐시 손상 처리를 참조하지 않으므로 영향 없음.

## 발견사항

- **[INFO]** `data-flow/15` 의 "전 경로 fail-open (warn)" 서술이 diff 이후 코드보다 한 칸 넓다
  - target 위치: `spec/data-flow/15-external-interaction.md` L308 (§4 외부 의존 표 — "Redis … 전 경로
    fail-open (warn) — 가용성 우선") 및 §Rationale "Fail-open 정책의 일관 표기" (L331 이하)
  - 충돌 대상: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스
    docstring (이번 diff 가 3경로 서술을 5경로 표로 정밀화) — 및 간접적으로
    [`spec/5-system/14-external-interaction-api.md` §R8 Rationale](spec/5-system/14-external-interaction-api.md#r8-idempotency-key-와-submit_form-검증-실패의-관계)
  - 상세: 이번 diff 로 코드가 처음으로 fail-open 경로를 5개로 표로 명세했는데, 그중 **경로 1(기동 시 미주입 — 생성자 `null`)은
    warn 을 남기지 않는다**(장애가 아니라 설정 상태이므로). 반면 target L308 은 "전 경로 fail-open (warn)" 이라고
    뭉뚱그려, 그 표와 대조하면 문구가 실제보다 넓다. 또한 target 의 현재 프레이밍은 "Redis/DB **미가용**" 하나뿐인데,
    이번 diff 가 추가한 `isIdempotencyEntry()`/`discardCorruptEntry()` 는 "Redis 는 가용한데 캐시 **데이터가
    손상**된" 별개의 실패 축을 다룬다 — 이 축이 §4 표·§Rationale 어디에도 명시적으로 자리를 갖지 못한다.
    두 spec 영역(`data-flow/15` ↔ `5-system/14`) 이 같은 컴포넌트의 fail-open 정책을 각자 다른 정밀도로
    서술하게 되어, 문서만 보고 운영 알림(warn 로그) 설계를 하면 경로 1 을 잘못 포함시킬 수 있다.
  - 제안: 기능적 모순은 아니므로 이번 PR 을 막을 사유는 아니다. 이미
    [`plan/in-progress/backend-lint-gate-broken-on-main.md`](plan/in-progress/backend-lint-gate-broken-on-main.md)
    에 동일 항목이 `23_48_39` rationale_continuity INFO 1 로 기록되어 있고 "spec/ 쓰기는 developer 권한
    밖" 이라 planner 인계로 미처리(`- [ ]`) 상태다. 다음 planner 턴에서: (1) "전 경로 warn" → "경로 1(설정
    미주입) 제외 4/5 경로 warn" 으로 정정, (2) 프레이밍을 "Redis/DB 미가용" 에서 "미가용 또는 (캐시) 손상"
    으로 확장 — 대상은 `data-flow/15` §4 표 + §Rationale, `5-system/14` §R8 Rationale 세 자리 동반 갱신.
    새로 발견된 항목이 아니므로 중복 등록 불필요.

## 요약

이번 diff 는 `IdempotencyInterceptor` 의 캐시 손상(엔트리 형태·내부 payload) 방어를 하드닝하는 코드 전용
변경이며, `spec/**` 문서는 건드리지 않는다. 엔드포인트 계약(2xx/409/410 재현, 캐시 키 스코프
`executionId`+`route`, `EIA-RL-02` 재현 보장)은 diff 전후로 동일해 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 6개 관점 모두에서 다른 spec 영역과 새로운 모순은 발견되지 않았다. 유일한 발견은
`data-flow/15` 의 fail-open 서술이 이번 diff 가 코드에 정밀화한 5-경로 표보다 한 칸 넓다는 문서 정밀도
갭인데, 이는 이미 별도 라운드(`23_48_39` rationale_continuity)가 잡아 planner 인계로 plan 에 등록해 둔
선재 항목이라 새로 차단할 이유가 되지 않는다.

## 위험도
LOW
