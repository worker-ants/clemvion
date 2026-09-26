# 부작용(Side Effect) 리뷰 — rotate-bot-token-body (2R)

## 범위 요약

`origin/main...HEAD` 32개 파일 중 실제 런타임 코드는 컨트롤러 3곳(`triggers.controller.ts`,
`executions.controller.ts`, `hooks.controller.ts`)에 `@ApiBody`/`@ApiConsumes` 데코레이터만
추가한 것과, 문서 전용 DTO 2개 신설, 테스트 헬퍼 `bodyParamDesignType` 신설 + 그 에러 경로
테스트 보강(1R WARNING 조치, `fafc6b8ac`)이다. 나머지는 CHANGELOG·plan·이전 리뷰/consistency
세션의 산출물(md/json) 커밋으로 부작용 관점에서 검토 대상이 아니다.

## 실측 확인

- 세 라우트의 `@Body()` 파라미터 타입은 이번 diff 전후 동일함을 직접 확인했다 — `rotateBotToken`
  (`triggers.controller.ts:308`), `continueExecution`(`executions.controller.ts:180`,
  `@Body() body?: { formData?: unknown }`), `receiveWebhook`(`hooks.controller.ts:154`,
  `@Body() body: unknown`). 추가된 것은 데코레이터뿐이고 파라미터 시그니처는 손대지 않았다.
- `codebase/`, `import` 문 전체에 `process.env` · `global.` · prototype 직접 대입 패턴 신규
  도입 없음(grep 0건).
- `bodyParamDesignType`(`codebase/backend/src/shared/testing/swagger-probe.ts:145-172`)은
  `Reflect.getMetadata` 만 호출하는 순수 조회 함수다 — `Reflect.defineMetadata` 호출이 없어
  다른 테스트/런타임이 참조하는 라우트 메타데이터를 변형하지 않는다.
- `swagger-probe.spec.ts:110-115`(1R 조치로 추가된 에러 경로 테스트)는 로컬 스코프의 `Bare`
  클래스에 한해 `Reflect.defineMetadata` 를 호출한다 — 그 클래스는 그 테스트 안에서만
  생성·참조되고 다른 스펙 파일이나 프로덕션 컨트롤러의 메타데이터에 닿지 않는다.
- 작업 트리는 현재 clean 하다(`git status --short` — 세션 디렉터리만 untracked). 1R
  `SUMMARY.md`/`api_contract.md` 가 기록한, 다른 리뷰어가 뮤테이션 검증 중 남겼던
  `writeOnly: true` 임시 변경·`.bakmut` 은 이미 원복·정리되어 있고(`find ... -name '*.bak*'`
  0건), `chat-channel-rotate-bot-token-request.dto.ts:17` 의 `writeOnly: true` 도 그대로다 —
  이번 라운드에서 재검증 결과 이상 없음.

## 발견사항

- **[INFO]** 세 라우트가 처음으로 OpenAPI `requestBody` 를 광고하기 시작 — 외부 codegen 클라이언트에 새 표면
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`, `@ApiBody` 추가 라인 — diff 게이트 287),
    `codebase/backend/src/modules/executions/executions.controller.ts`(`continueExecution`, 게이트 162),
    `codebase/backend/src/modules/hooks/hooks.controller.ts`(`receiveWebhook`, 게이트 135-141)
  - 상세: 지금까지 이 세 엔드포인트의 생성 OpenAPI 문서에는 `requestBody` 자체가 없었다. 이번
    변경으로 처음 광고되므로, 기존에 이 문서를 기반으로 클라이언트를 생성해 두었던 외부
    소비자가 있다면 재생성 시 "새 필드가 생겼다"는 diff 를 보게 된다. 서버 런타임 계약은
    실측대로 불변이지만(같은 파일 캐너리 3종이 회귀 가드), OpenAPI 문서 자체는 "본문 없음"에서
    "본문 스키마 있음"으로 바뀌는 것이므로 **문서 소비자 관점의 인터페이스 확장**이다.
  - 제안: 조치 불필요 — CHANGELOG·plan 이 이미 이 변화를 "Unreleased" 로 명시했고 순수
    additive(요구하지 않던 것을 요구하게 만들지 않음)라 하위 호환 파괴는 아니다. api_contract
    리뷰어가 1R 에서 이미 같은 지점을 INFO 로 짚었다 — 재확인 차 병기.

- **[INFO]** `bodyParamDesignType` 이 `@nestjs/common` 비공개 내부 경로(`ROUTE_ARGS_METADATA`,
  `RouteParamtypes`)에 의존
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:9-10`, 함수 `bodyParamDesignType`
  - 상세: 1R INFO 로 이미 지적됐고 JSDoc(swagger-probe.ts:142-143)에 "Nest 메이저 업그레이드 시
    이 헬퍼의 에러 경로 테스트가 먼저 깨진다" 고 명시돼 대비돼 있다. 부작용 관점에서 추가할
    새 사실 없음 — 프로덕션 런타임 코드가 아니라 테스트 전용 헬퍼이므로 실패 시 영향 범위는
    테스트 스위트로 국한된다.

## 요약

이번 2R 대상 diff 는 세 라우트에 OpenAPI 데코레이터만 추가하고 `@Body()` 파라미터 시그니처를
그대로 유지했음을 직접 코드로 재확인했다 — 함수 시그니처 변경, 전역 변수 신설/변경, 파일시스템
부작용, 환경변수 접근, 네트워크 호출, 이벤트/콜백 변경 중 어느 것도 발견되지 않았다. 신규
테스트 헬퍼 `bodyParamDesignType` 은 메타데이터를 읽기만 하고 쓰지 않아 공유 상태를 오염시키지
않으며, 1R 에서 추가된 에러 경로 테스트의 `Reflect.defineMetadata` 호출도 로컬 스코프 클래스에
한정된다. 유일한 실질 영향은 세 엔드포인트가 처음으로 OpenAPI `requestBody` 를 광고하게 된
것인데, 이는 의도된 문서 확장이고 런타임 불변은 캐너리로 고정되어 있다. 1R 이 기록한 "리뷰
중 워킹트리 뮤테이션 관측"은 이번 확인 시점에 잔여물 없이 정리된 상태임을 재검증했다.

## 위험도

NONE
