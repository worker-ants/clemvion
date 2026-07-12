# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 범위에 대한 메모

diff 에 포함된 22개 파일 중 실제 애플리케이션 코드는 파일 1(`hooks.controller.spec.ts`)·파일 2(`hooks.controller.ts`) 뿐이다.
나머지는 `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`(작업 추적 문서)와
`review/code/2026/07/12/12_36_04/**`·`review/consistency/2026/07/12/12_56_04/**`(선행 리뷰/일관성 검토 세션의
산출물 markdown·json, 이미 커밋된 이력 로그)이며, 이들은 "유지지보수할 소스 코드"가 아니라 워크플로 산출물이므로
가독성/네이밍/함수 길이 등 코드 관점 체크리스트의 적용 대상이 아니다. 아래는 실제 코드 diff(파일 1·2)에 집중한다.

## 발견사항

- **[INFO]** 파생 상수 도입으로 실질적 DRY 개선 — 매직 넘버 근절 목적 달성
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:40-44, 60-62, 79-80, 89-90`
  - 상세: `EMBED_CONFIG_CACHE_SEC`(단일 진실) → `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MINUTES`(파생) 구조로,
    이전에 헤더 값과 Swagger 문서 문자열 4곳(및 인라인 주석 1곳)에 개별 하드코딩돼 있던 `300`/"5분" 리터럴이 모두
    상수 참조로 교체됐다. 선행 리뷰 세션(`review/code/2026/07/12/12_36_04/maintainability.md`)이 지적한
    `EMBED_CONFIG_CACHE_MAX_MIN`(코드베이스 `_MIN`=minimum 컨벤션과 충돌) 네이밍 WARNING도 `_MINUTES` 로 개명되어
    해소됐고(`grep` 확인, 현재 `_MIN` suffix 잔존 없음), L89 인라인 주석의 리터럴 `5분`도 `EMBED_CONFIG_CACHE_SEC 초`
    상수 지목으로 교체되어 문서 사용처 5곳 전부 단일 진실을 참조한다. 각 상수에 목적을 설명하는 JSDoc 도 일관된 스타일.
  - 제안: 없음(긍정 평가).

- **[INFO]** `@ApiOperation` description 블록의 문자열 `+` 결합과 `@ApiResponse` 블록의 템플릿 리터럴이 파일 내 혼재
  - 위치: `hooks.controller.ts:57-64`(`'...' + EMBED_CONFIG_CACHE_CONTROL + '...' + EMBED_CONFIG_CACHE_MAX_MINUTES + '...'`)
    vs `hooks.controller.ts:79`(``` `${EMBED_CONFIG_CACHE_CONTROL} — ... ${EMBED_CONFIG_CACHE_MAX_MINUTES}분 ...` ```)
  - 상세: description 문자열 안에 마크다운용 백틱(`` ` ``)이 다수 포함돼 있어, 템플릿 리터럴로 통일하면 그 백틱들을
    전부 이스케이프해야 해 가독성이 오히려 떨어지는 트레이드오프가 있다. 선행 maintainability 리뷰(12_36_04)에서도
    같은 항목을 INFO 로 판정하고 "현행 유지 가능"으로 결론낸 바 있으며, 이번 diff 에서도 그 구조가 그대로 유지되어
    별도 조치 없이도 일관된 판단이다.
  - 제안: 우선순위 낮음. 더 다듬고 싶다면 description 조립을 별도 헬퍼로 분리하는 안은 여전히 유효하나 필수 아님.

- **[INFO]** 테스트 헤더 단언이 생성 상수를 직접 참조하지 않고 리터럴 문자열로 재하드코딩
  - 위치: `hooks.controller.spec.ts:56` (`expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300')`)
  - 상세: `EMBED_CONFIG_CACHE_CONTROL` 이 컨트롤러 파일 내부 비-export 상수라 테스트에서 직접 import 할 수 없어
    부득이한 재하드코딩이다. 회귀 테스트 관점에서는 "정확한 기대값을 명시적으로 고정"하는 것이 오히려 올바른
    패턴(주석에도 의도 명시: "EMBED_CONFIG_CACHE_SEC 단일 진실이 깨지면 회귀를 잡는다")이라 결함은 아니다. 다만
    `EMBED_CONFIG_CACHE_SEC` 값이 바뀌면 이 리터럴도 사람이 수동으로 갱신해야 하는 지점이 하나 더 생긴 셈이므로,
    이번 리팩터의 "단일 진실화" 취지를 완전히 프로덕션 코드 밖까지 확장하려면 상수를 export 하는 선택지도 있다.
  - 제안: 현행 유지 가능(테스트는 SoT 를 import 하기보다 기대값을 고정하는 것이 일반적으로 더 안전). 굳이 완전
    자동화하고 싶다면 `EMBED_CONFIG_CACHE_SEC`(또는 `EMBED_CONFIG_CACHE_CONTROL`)를 export 해 테스트에서
    ``` `public, max-age=${EMBED_CONFIG_CACHE_SEC}` ``` 형태로 조립하는 방법도 있으나, 그 경우 "정확한 값을 고정해
    타이핑/단위 실수를 잡는다"는 테스트 본연의 방어력이 오히려 약해질 수 있어 트레이드오프. 필수 아님.

## 요약

이번 diff 는 `hooks.controller.ts` 의 embed-config Cache-Control TTL 값이 실제 헤더와 Swagger 문서 문자열·인라인
주석 등 5곳에 중복 하드코딩돼 있던 것을 `EMBED_CONFIG_CACHE_SEC` 단일 진실에서 파생시킨 두 상수(`_CONTROL`,
`_MAX_MINUTES`)로 정리하는 소규모 behavior-preserving DRY 리팩터다. 선행 리뷰 세션(12_36_04)에서 지적된 네이밍
WARNING(`_MIN`→`_MINUTES`)과 인라인 주석 리터럴 잔존 WARNING 이 모두 이번 diff 상태에서 해소되어 있음을 직접
확인했다. 함수 길이·중첩 깊이·순환 복잡도에 영향이 없고, 새로 추가된 매직 넘버도 없다. 남은 지적사항은 모두
INFO 수준의 스타일 트레이드오프(문자열 결합 방식 혼재, 테스트의 불가피한 리터럴 재선언)로 조치를 강제할 필요는
없다.

## 위험도

LOW
