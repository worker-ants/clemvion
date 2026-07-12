# 부작용(Side Effect) 리뷰

대상: `codebase/backend/src/modules/hooks/hooks.controller.ts`,
`codebase/backend/src/modules/hooks/hooks.controller.spec.ts`
(+ `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`, `review/code/2026/07/12/12_36_04/**`,
`review/consistency/2026/07/12/12_56_04/**` — 이전 리뷰/컨시스턴시 세션 산출물 재커밋. 코드 아님, 실행 경로 없음)

## 발견사항

- **[INFO]** 신규 module-level 파생 상수 2개 도입
  - 위치: `hooks.controller.ts:41-44` (`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MINUTES`)
  - 상세: `EMBED_CONFIG_CACHE_SEC`(기존)에서 `EMBED_CONFIG_CACHE_CONTROL = \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\``, `EMBED_CONFIG_CACHE_MAX_MINUTES = Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)` 두 `const` 를 새로 선언한다. 모듈 로드 시 1회 평가되는 순수 계산식(I/O·랜덤·외부 상태 참조 없음)이고 `export` 되지 않아 파일 스코프 안에서만 보인다. "전역 변수 도입/수정" 관점에서 우려할 mutable state 는 아니며, 다른 모듈에서 import 해 재사용할 수 없으므로 공개 인터페이스 확장도 아니다.
  - 제안: 조치 불필요. 향후 이 값을 다른 모듈에서도 참조해야 한다면 `export` 시 명명 컨벤션(RESOLUTION.md 반영된 `_MINUTES` 접미사) 유지 권장.

- **[INFO]** 런타임 응답 헤더 값 — 동일성 검증
  - 위치: `hooks.controller.ts:87-89`(`res.set('Cache-Control', EMBED_CONFIG_CACHE_CONTROL)`)
  - 상세: 기존 `res.set('Cache-Control', \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`)` → `res.set('Cache-Control', EMBED_CONFIG_CACHE_CONTROL)` 로 변경. `EMBED_CONFIG_CACHE_CONTROL` 을 전개하면 `'public, max-age=300'` 로 이전과 byte-identical. `getEmbedConfig` 함수 시그니처(`Promise<EmbedConfigDto>`, 파라미터)·리턴값·호출 순서·부수효과(단일 `res.set` 호출) 모두 불변 — 이 엔드포인트를 소비하는 웹챗 위젯 클라이언트에 대한 실질적 인터페이스 변경 없음.
  - 제안: 조치 불필요.

- **[INFO]** Swagger/OpenAPI 문서 문자열 렌더 — 리터럴 결합 → 상수 참조 치환
  - 위치: `hooks.controller.ts:56-64`(`@ApiOperation.description`), `hooks.controller.ts:78-81`(`@ApiResponse.headers['Cache-Control']`)
  - 상세: `@ApiOperation` description 이 단일 문자열 리터럴에서 문자열 연결(`'...' + EMBED_CONFIG_CACHE_CONTROL + '...' + EMBED_CONFIG_CACHE_MAX_MINUTES + '...'`)로 바뀌었다. 이는 `SwaggerModule.createDocument()` 가 생성하는 공개 OpenAPI 스펙(`/api-docs` 등으로 노출되는 문서, 외부 소비자가 파싱할 수 있는 "인터페이스"의 일부)의 텍스트를 변경하는 것이므로 넓게 보면 인터페이스 변경 범주에 든다. 다만 값을 직접 계산해 대조한 결과 `EMBED_CONFIG_CACHE_CONTROL='public, max-age=300'`, `EMBED_CONFIG_CACHE_MAX_MINUTES=Math.ceil(300/60)=5` 로, 렌더된 최종 문자열은 변경 전 리터럴과 완전히 동일하다(RESOLUTION.md 의 byte-identical 주장과 일치). `@ApiResponse` 의 `example: EMBED_CONFIG_CACHE_CONTROL` 도 동일 값. 자동화된 Swagger 렌더 스냅샷 테스트는 없어(기존 관행) 회귀 시 침묵 가능성은 있으나, 이는 이 diff 가 신규로 도입한 리스크가 아니라 기존 갭의 연장이다.
  - 제안: 조치 불필요. (다만 이번 변경 자체가 "런타임 헤더값과 문서 문자열의 드리프트를 원천 차단"하는 목적이므로, 오히려 향후 이 갭이 실제로 문제될 확률을 낮추는 방향.)

- **[INFO]** 테스트 단언 강화 — 부작용 없음, 회귀 탐지력만 상승
  - 위치: `hooks.controller.spec.ts:104-107`
  - 상세: `expect.stringContaining('max-age')` → 정확 문자열 `'public, max-age=300'` 단언으로 강화. 테스트가 호출하는 `res.set`/`embedConfigService.resolve` mock 호출 순서·인자는 변경 없음(같은 `makeRes()`, 같은 흐름). 유일한 차이는 검증 엄격도이며 이는 테스트 자체의 부작용이 아니라 회귀 감지 민감도의 변화(테스트 카테고리 관점, side-effect 관점에서는 중립).
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 대상에 포함된 `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 파일 6~22
  - 위치: 파일 3~22 (신규 생성)
  - 상세: 모두 markdown/JSON 트래킹·이전 리뷰 세션 산출물이며 실행되는 코드가 아니다. CLAUDE.md 정보 저장 위치 규약상 `plan/`·`review/` 는 커밋 대상이 맞고(`review/ 는 gitignored 아님`), 이 파일들 자체가 파일시스템 부작용을 일으키는 "코드"는 아니다. 부작용 관점에서 분석할 실행 경로가 없다.
  - 제안: 조치 불필요.

## 요약

핵심 변경은 `hooks.controller.ts` 의 Cache-Control 관련 리터럴 4곳을 `EMBED_CONFIG_CACHE_SEC` 파생 상수 2개(`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MINUTES`)로 치환하는 순수 컴파일타임 리팩터다. 새로 선언된 상수는 불변(`const`)·미노출(`export` 없음)이라 전역 상태·공개 인터페이스에 실질적 영향이 없고, 실제 HTTP 응답 헤더 값과 Swagger 문서 문자열 모두 계산 결과가 변경 전 리터럴과 byte-identical 함을 직접 대조로 확인했다. 함수 시그니처·리턴 타입·호출 순서·이벤트/콜백 발생 패턴은 그대로이며, 환경 변수·네트워크 호출·파일시스템 부작용도 관련 없다. 테스트 강화(정확값 단언)는 회귀 탐지력만 높일 뿐 부작용을 유발하지 않는다. 함께 포함된 plan/review 문서 파일들은 실행되지 않는 트래킹 산출물로 side-effect 분석 대상 밖이다.

## 위험도

NONE
