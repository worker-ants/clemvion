# testing-reviewer (journal 복구 — disk-write gap 로 원본 output 유실, wf_62c80b6c-072 journal.jsonl 에서 복원)

No type errors in `hooks.controller.ts`. Test suite for the file passes (3/3) after the change.

## 발견사항

- **[INFO]** 기존 단위 테스트가 헤더 값을 느슨하게(`stringContaining`) 검증해 상수 파생 로직의 정확성을 보장하지 못함
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.spec.ts:56-59`
  - 상세: 이번 리팩터의 목적은 `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MIN` 을 "단일 진실"로 만들어 실제 헤더와 Swagger 문서 문자열이 byte-identical 하게 유지되는 것이다. 그런데 유일하게 이 헤더 값을 검증하는 기존 테스트는 `expect.stringContaining('max-age')` 로 존재 여부만 확인하고 정확한 값(`'public, max-age=300'`)은 검증하지 않는다. 향후 누군가 `EMBED_CONFIG_CACHE_SEC` 값이나 템플릿 리터럴을 잘못 수정해도(예: 오타·단위 실수) 이 테스트는 계속 통과한다.
  - 제안: `expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=300')` 처럼 정확한 문자열로 단언을 강화하면 상수 SoT 가 깨졌을 때 실제로 회귀를 잡을 수 있다. (본 PR 자체의 diff 에는 테스트 파일 변경이 없으므로 이번 변경으로 신규 도입된 문제는 아니고, 기존 테스트를 강화할 기회로 지적.)

- **[INFO]** Swagger 문서 문자열(`@ApiOperation.description`, `@ApiResponse.headers['Cache-Control'].description/example`) 자체는 어떤 테스트로도 검증되지 않음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:46-64`
  - 상세: 이번 diff 는 문자열 결합 방식을 템플릿 리터럴에서 `+` 연결 혼합 형태로 바꾸면서 `EMBED_CONFIG_CACHE_CONTROL`/`EMBED_CONFIG_CACHE_MAX_MIN` 을 문서 텍스트에 삽입한다. 이 결합이 실제로 올바른 문자열을 만드는지(예: 공백·백틱 위치 실수)는 컴파일·런타임 모두 오류 없이 통과하고, 회귀가 나더라도 어떤 테스트도 이를 잡지 못한다(`SwaggerModule.createDocument()` 로 실제 렌더링을 확인하는 테스트 없음 — 과거 PR #904 에서도 동일 클래스의 갭이 DTO 스키마에 대해 지적된 바 있음). 다만 이는 이 코드베이스에서 문서 텍스트 자체를 테스트하지 않는 기존 관행의 연장으로, 이번 diff 가 새로 만든 리스크는 아니며 저위험(순수 텍스트, 기능에 영향 없음)이다.
  - 제안: 필수는 아니나, 여력이 있다면 `SwaggerModule.createDocument()` 를 통해 `getEmbedConfig` 오퍼레이션의 description/example 에 `EMBED_CONFIG_CACHE_CONTROL`/`5분` 문자열이 포함되는지 확인하는 가벼운 smoke 테스트를 고려할 수 있다.

- **[INFO]** plan 체크리스트의 `unit test` 항목이 아직 미체크 상태
  - 위치: `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md:35`
  - 상세: 이번 diff 에는 테스트 파일 변경이 포함되어 있지 않고 체크리스트도 전부 미체크다. 리뷰 시점 기준으로는 워크플로 진행 중(구현 직후) 단계로 보이며, 기존 테스트가 계속 통과(3/3, 재실행 확인)하므로 "회귀 없음" 은 충족된다. 다만 plan 완료 이동 전 위 INFO 항목(정확한 값 단언 강화 등)을 반영할지 판단해 `unit test` 체크박스를 실제 상태에 맞게 채우는 것을 권장.

## 요약

이번 변경은 `hooks.controller.ts` 의 캐시 TTL 관련 하드코딩 문자열 4곳을 파생 상수 2개로 통합하는 순수 behavior-preserving DRY 리팩터다. 실제 응답에 영향을 주는 유일한 코드 경로(`res.set('Cache-Control', ...)`)는 기존 단위 테스트로 이미 커버되며, 리팩터 후에도 해당 테스트(3/3)가 그대로 통과해 회귀가 없음을 확인했다(직접 실행 검증). 다만 그 테스트의 단언이 `stringContaining` 수준으로 느슨해 상수 SoT 가 깨져도 잡아내지 못하는 잠재적 커버리지 갭이 있고, 함께 바뀐 Swagger 문서 문자열(순수 텍스트) 자체는 어떤 테스트로도 검증되지 않는다 — 둘 다 기능적 위험은 낮고 이번 diff 가 새로 만든 문제는 아니다. plan 체크리스트의 `unit test` 항목이 아직 미체크인 점은 워크플로 진행 상태를 반영해 정리가 필요하다.

## 위험도
LOW