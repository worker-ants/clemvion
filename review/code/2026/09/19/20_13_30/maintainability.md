# 유지보수성(Maintainability) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

실제 애플리케이션·테스트 코드(`codebase/backend/**`) 11개 파일을 중심으로 검토했다. 나머지 45개 파일(`spec/**` 5개, `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`, `review/code/2026/09/19/19_44_33/**`·`review/consistency/2026/09/19/{18_56_41,19_11_16,19_21_39}/**` 전 39개)은 산문 spec 문서이거나 이전 리뷰·consistency-check 라운드의 자동 산출 리포트(SUMMARY/meta.json/각 checker 결과)라, "함수 길이·중첩·매직 넘버·중복 코드" 같은 코드 유지보수성 관점이 직접 적용되지 않는다 — 직전 라운드(`review/code/2026/09/19/19_44_33/maintainability.md`)도 동일 기준으로 이 파일들을 발견사항 대상에서 제외했으므로 그 판단을 유지한다.

이번 라운드는 직전 라운드(19:44:33)가 남긴 RESOLUTION 을 반영한 뒤(CHANGELOG 추가, 동시 경합 e2e 추가, 서비스/트리거 함수 주석 정리, `triggers.service.spec.ts` 단언 헬퍼 통합)의 상태를 diff base(`origin/main`) 기준 전체로 재검토한 것이다.

## 발견사항

- **[INFO]** 새 동시-경합 e2e 의 폴링 루프가 리터럴 상수 두 개(반복 횟수·간격)로 총 대기 시간(암묵적 5초)을 표현
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts:260-268` (`waitUntilSecondBlocks` 내부 `for (let i = 0; i < 200; i++)` · `setTimeout(resolve, 25)`)
  - 상세: `200 × 25ms = 5000ms` 라는 전체 타임아웃이 두 숫자의 곱으로만 암묵적으로 존재하고 이름 붙은 상수(`MAX_WAIT_MS`/`POLL_INTERVAL_MS` 등)로 추출돼 있지 않다. 다만 같은 파일이 아니어도 이 저장소의 다른 e2e 폴링 루프(`webhook-trigger.e2e-spec.ts:132` `for (let i = 0; i < 15; i++)` + `setTimeout(r2, 200)`, `notifications-dismiss.e2e-spec.ts:225` `for (let i = 0; i < 3; i++)`)도 동일하게 리터럴 반복 횟수 + 리터럴 간격 스타일을 쓰고 있어(`execution-seq-allocator-load.e2e-spec.ts` 만 `LATENCY_WARMUP_COUNT` 류 명명 상수를 쓴다), 이번 코드가 기존 컨벤션에서 벗어난 것은 아니다 — 코드베이스 자체가 이 축에서 일관되지 않다.
  - 제안: 차단 사유 아님. 다음에 이 파일의 폴링 로직을 다시 만질 일이 있으면 `MAX_WAIT_MS`/`POLL_INTERVAL_MS` 로 이름을 붙여 두면 "왜 200과 25인가"를 다시 계산할 필요가 없어진다.

- **[INFO]** (직전 라운드 INFO 재확인, 변경 없음) `triggers.service.spec.ts` 의 3중 `flatMap`/`map` 테스트 케이스 생성기
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3034-3039` (`(['update','create'] as const).flatMap(method => (['driverError','top'] as const).flatMap(surface => CONFLICT_NAMES.map(name => [method, surface, name])))`)
  - 상세: 축이 메서드·표면·제약이름 3개로 늘며 중첩이 생겼으나, 각 축이 데이터 생성일 뿐 조건 분기가 아니라 순환 복잡도에는 기여하지 않고, 바로 위 JSDoc 이 각 축의 의도를 설명해 가독성 저해는 제한적이다. 직전 라운드에서 이미 INFO 로 지적됐고 이번 라운드에서 축이 더 늘지 않았다.
  - 제안: 지금 상태로는 허용 범위. 축이 하나 더 늘면 `cartesian(...)` 헬퍼로 평탄화를 고려.

- **[INFO]** (직전 라운드 INFO 재확인, 변경 없음) `triggers.controller.ts` Swagger 설명 문자열의 두 절 사이 서술어 비대칭
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:51`
  - 상세: `'...트리거가 이미 있거나(...), 그 경로를 다른 워크스페이스가 예약했다(...). 둘을 구분하지 않는다.'` — 이번 라운드에서 문구 자체는 갱신됐지만("있거나" → 새 절 추가), 두 절의 서술어 형태가 여전히 완전히 대칭은 아니다. API 소비자가 Swagger 문서에서 그대로 읽는 문자열이라 내부 코드 주석보다 문장 완결성 기준이 조금 더 높아야 한다는 이전 지적이 유효하다.
  - 제안: 사소한 다듬기 수준, 차단 사유 아님.

## 정합성이 확인된 항목 (참고 — 개선/오탐 방지)

- **중복 제거(직전 라운드 INFO 해소 확인)**: `webhook-trigger.e2e-spec.ts` 의 B5 지역 헬퍼 `expectConflict` 와 신규 B7/B8 용 `expectPathConflict` 가 바이트 단위로 같은 단언을 두 벌 유지하던 문제(`review/code/2026/09/19/19_44_33/testing.md` INFO)가, 이번 diff 에서 `expectConflict` 를 삭제하고 파일 스코프 공용 헬퍼 `expectPathConflict` 하나로 B4·B5·B7·B8 전부를 통합하는 방식으로 정확히 해소됐다(`git diff origin/main...HEAD` 확인).
- **함수 길이·중첩**: `rethrowEndpointPathConflict`(`triggers.service.ts:1663-1685`)는 JSDoc 이 대부분을 차지할 뿐 본체는 단일 `if`/`throw` 로 짧고 직선적이며, `create`/`update` 의 catch 어댑터(`.catch((err) => this.rethrowEndpointPathConflict(err))`, 504·730행)도 한 줄로 중첩을 만들지 않는다.
- **네이밍/추출**: 이번 라운드에서 새로 뽑힌 `createOtherWorkspace`/`createIn`/`patchPath`(B7~B9 용) 는 파일 내 기존 헬퍼(`createWebhookTrigger`, `uniqueName`) 와 동일한 camelCase·서술적 네이밍 관례를 따르고, 각 헬퍼가 단일 책임(다른 워크스페이스 생성 / 트리거 생성 / 경로 패치)만 맡아 B7~B9 세 테스트 본문의 중복을 줄인다.
- **상수 일반화(개선, 직전 라운드에서 이미 확인됨)**: `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(단일 문자열) → `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(`ReadonlySet<string>`) 전환이 이번 diff 전체에 유지되고 있고, 새 e2e(`webhook-endpoint-reservation.e2e-spec.ts`)와 `triggers.service.spec.ts` 모두 이 이름을 하드코딩 반복 없이 상수/픽스처(`OWNER_LABEL`, `CONFLICT_NAMES`)로 참조한다.
- **매직 넘버(핵심 도메인 값)**: 마이그레이션의 `VARCHAR(255)` 는 기존 `trigger.endpoint_path VARCHAR(255)` 폭을 그대로 계승한 것으로 임의 숫자가 아니다.
- **일관성**: 마이그레이션 헤더 주석 형식(요약·SoT 링크·설계 근거·DOWN 절)이 V131/V132 와 동일 패턴을 따르고, 신규 e2e 파일(`webhook-endpoint-reservation.e2e-spec.ts`)의 SAVEPOINT/임시 스키마 패턴은 `trigger-endpoint-path-dedupe.e2e-spec.ts` 하네스를 그대로 재사용한다.

## 요약

이번 라운드는 직전 라운드가 INFO 로 남긴 테스트 헬퍼 중복(`expectConflict`/`expectPathConflict`)을 정확히 해소했고, 새로 추가된 동시-경합 e2e·B7~B9 API e2e 는 헬퍼 추출·서술적 네이밍·직선적 흐름으로 기존 코드베이스 스타일과 정합한다. 서비스 계층의 핵심 로직(`rethrowEndpointPathConflict`, `isEndpointPathUniqueViolation`)은 짧고 단일 책임이며 순환 복잡도가 낮다. 남은 지적은 전부 INFO 세 건 — 새 e2e 의 폴링 상수 미명명(기존 코드베이스도 혼재된 컨벤션이라 이번 코드만의 이탈은 아님), 그리고 직전 라운드부터 이어지는 두 건(테스트 케이스 생성기 3중 중첩, Swagger 문구 서술어 비대칭) — 이며 어느 것도 가독성·복잡도·유지보수성을 실질적으로 저해하지 않는다.

## 위험도

NONE
