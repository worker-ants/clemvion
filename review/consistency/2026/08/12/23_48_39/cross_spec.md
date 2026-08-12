# Cross-Spec 일관성 검토 — spec/data-flow/ (--impl-done)

## 검토 범위 및 방법론 메모

- diff-base `origin/main` 대비 실제 변경분은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
  `idempotency.interceptor.spec.ts` (+ `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스 갱신) 뿐이다.
  `spec/**` 자체는 이번 diff 에서 수정되지 않았다 — 즉 "새 draft 가 다른 spec 영역과 충돌하는가" 라는 질문은
  실질적으로 "이 코드 변경이 `spec/data-flow/15-external-interaction.md` 가 참조를 위임한
  `spec/5-system/14-external-interaction-api.md`(EIA, §R8) 및 인접 영역과 어긋나는가" 로 좁혀진다.
- prompt 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`(EIA 본문, 97,667자)와
  `spec/5-system/15-chat-channel.md`, `spec/5-system/6-websocket-protocol.md` 등 대다수 `related_specs` 가 절단되어
  있었다(과거에도 반복된 현상). 이 checker 는 HEAD 워크트리 절대경로에서 `spec/5-system/14-external-interaction-api.md`
  §R8("Idempotency-Key 와 submit_form 검증 실패의 관계", 캐시 대상 닫힌 목록·캐시 키 스코프)과
  `spec/5-system/3-error-handling.md`, `spec/7-channel-web-chat/*.md` 를 직접 읽어 절단분을 보강했다.

## 발견사항

없음. 아래는 확인한 근거다.

- **닫힌 목록 술어 불변**: 코드의 `isErrorStatusCacheable`은 여전히 `statusCode === 409 || statusCode === 410`
  명시 열거이며, EIA §R8 "구현이 이 목록을 조건으로 옮길 때 단일 비교로 축약하면 안 된다" 요구와 일치한다
  (`idempotency.interceptor.ts:333-335`). 이번 diff 는 이 술어 자체를 건드리지 않았고, `bodyHash` 판정과
  `responseJson` 파싱의 **순서**만 재배치했다.
- **캐시 키 스코프 불변**: `interaction:idempotency:<executionId>:<route>:<key>` 스코프 로직(§R8 "캐시 키 스코프",
  `spec/data-flow/15-external-interaction.md` §2.2)은 이번 diff 의 변경 범위 밖이다.
- **fail-open 정책과의 정합**: `spec/data-flow/15-external-interaction.md` §2.2/§Rationale 은 "Redis … 전 경로
  fail-open (warn) — 가용성 우선"을 요구한다. 이번 diff 이전에는 캐시 엔트리 안쪽 `responseJson` 손상이
  `GlobalExceptionFilter` 에 의해 500 으로 마스킹되어 이 요구를 어기고 있었다(spec-impl 갭). 이번 diff 는
  그 갭을 닫아 **spec 이 이미 선언한 계약과의 정합을 회복**하는 방향이며, 새로운 계약을 도입하지 않는다.
  코드 docstring 이 "세 경로"→"다섯 경로"로 갱신한 것은 클래스 자기 서술 표(코드 내부 문서)이지 spec 문언을
  인용한 숫자가 아니다 — `spec/data-flow/15-external-interaction.md`·`spec/5-system/14-external-interaction-api.md`
  어디에도 fail-open 경로 개수를 못박은 문장이 없어 grep 결과 상 수치 불일치는 없다.
- **데이터 모델 / API 계약 / 요구사항 ID 불변**: 이번 diff 는 신규 엔티티·필드·endpoint·요구사항 ID(EIA-*)를
  도입하지 않는다. 응답 shape(`{fresh:true}` 류)도 "캐시 미스 시 정상 처리"와 동일해 EIA 문서화 계약과 다르지 않다.
- **상태 전이 / RBAC / 계층 책임 불변**: `InteractionGuard`→`IdempotencyInterceptor`→`InteractionService` 파이프라인
  순서, 인가 경계는 그대로다. `channel-web-chat` spec(`1-widget-app.md`, `2-sdk.md`) 에는 이 interceptor 의
  손상-복구 동작을 전제한 클라이언트 계약 문구가 없어 웹챗 쪽과의 충돌 표면도 없다.

## 요약

이번 diff 는 `spec/data-flow/15-external-interaction.md` 및 그 API 계약 SoT 인 `spec/5-system/14-external-interaction-api.md`
§R8 이 이미 선언한 "닫힌 캐시 대상 목록"·"캐시 키 스코프"·"Redis 전 경로 fail-open" 세 계약을 그대로 둔 채,
캐시 엔트리 내부 payload 손상이 500 으로 마스킹되던 구현 갭만 닫는 순수 내부 하드닝이다. 새 엔드포인트·필드·
요구사항 ID·상태 전이·RBAC·계층 책임 변경이 없어 다른 spec 영역과 충돌할 표면 자체가 없다. prompt 번들의
예산 절단으로 EIA 본문이 비어 있었으나, 해당 절 전문을 워크트리에서 직접 대조해 결론의 근거로 삼았다.

## 위험도

NONE
