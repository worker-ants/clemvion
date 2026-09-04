# 부작용(Side Effect) 리뷰

## 대상 요약

이번 diff(로컬 3커밋: `a65a4f85e`→`5a7de8ab1`→`dc83c0312`, origin/main 대비)는 `AlertRuleDto.threshold` 를 `number`→`string` 으로 정정하는 코드 변경(파일 2) + 이를 되잡는 가드/테스트 신설(파일 3,4) + CHANGELOG·plan 문서(파일 1,5) + 이전 리뷰(`19_43_18`)·consistency(`20_05_42`) 세션 산출물의 커밋(파일 6~26, `review/**` 관례에 따른 정식 보관)으로 구성된다.

## 발견사항

- **[INFO]** 공개 인터페이스(OpenAPI 응답 스키마) 변경 — `threshold` 필드 타입이 `number`→`string`
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28-29` (게이트 기준)
  - 상세: 점검 관점 #5(인터페이스 변경)에 해당하는 실질적 breaking change다. OpenAPI 로 타입을 생성하는 외부/프런트엔드 클라이언트가 `threshold` 를 숫자로 다루던 코드가 있다면 컴파일/런타임에서 어긋난다. 다만 실측 확인 결과:
    - wire 는 이번 변경으로 바뀌지 않는다 — `numeric(12,4)` 컬럼은 이전에도 문자열로 직렬화되고 있었고, DTO 는 문서상 거짓을 정정할 뿐이다(`git grep`으로 컨트롤러가 엔티티를 그대로 반환함을 확인 — `alerts.controller.ts` 의 `list`/`create`/`update` 모두 반환 타입 미애노테이트, `class-transformer` 데코레이터 없음 → DTO 클래스는 순수 swagger 메타데이터이며 런타임 직렬화에 관여하지 않는다).
    - 유일한 내부 소비자(`codebase/frontend/src/lib/api/alerts.ts`)는 이미 `string` 을 기대하도록 손수 타입을 갈라 두고 있었다(CHANGELOG 서술과 대조 확인).
    - 백엔드 내부에서 `rule.threshold` 를 소비하는 자리(`alerts-evaluator.service.ts:111`)는 이미 `Number(rule.threshold)` 로 문자열을 가정하고 있어, 이번 DTO 변경과 무관하게 기존 상태다.
    - CHANGELOG(`CHANGELOG.md`) 에 `**영향**:` 문단이 이미 명시돼 있어 고지 의무는 충족됐다(이전 라운드 `19_43_18` WARNING #3 조치 확인).
  - 제안: 조치 불요 — 이미 CHANGELOG 로 고지됐고 실제 wire·내부 소비자와 정합함을 재확인했다.

- **[INFO]** 새 가드 술어 `findNumericAsNumber` 의 module-level 정규식 `NUMERIC_COLUMN` 이 `g` 플래그를 갖는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findNumericAsNumber` 함수, `NUMERIC_COLUMN` 상수)
  - 상세: `g` 플래그 정규식을 모듈 스코프 상수로 두고 여러 파일에 걸쳐 재사용하면 `lastIndex` 상태가 호출 간 누적되어 특정 호출에서 매칭을 건너뛰는 전형적 부작용 패턴이 될 수 있다. 다만 실제 사용처는 `src.matchAll(NUMERIC_COLUMN)` 뿐이며, `String.prototype.matchAll` 은 스펙상 내부적으로 정규식을 복제해 사용하므로 원본 `NUMERIC_COLUMN.lastIndex` 는 변경되지 않는다 — 파일 간 상태 누적 부작용은 없음을 확인했다(`.exec()`/`.test()` 를 루프에서 직접 호출하는 패턴이 아님).
  - 제안: 조치 불요 — 현재 사용 패턴은 안전하다. 다만 향후 이 상수를 `.test()`/`.exec()` 로 재사용하는 코드가 추가되면 즉시 이 문제가 재발하므로, 정규식은 함수 내부 지역 변수로 옮기거나 주석으로 "matchAll 전용" 을 명시해 두는 편이 안전하다(선택).

- **[INFO]** 파일시스템 부작용 범위 확인 — `review/**` 산출물 대량 신규 커밋(파일 6~26)
  - 위치: `review/code/2026/09/04/19_43_18/*`, `review/consistency/2026/09/04/20_05_42/*`
  - 상세: 세션 상태 파일(`_retry_state.json`)·`meta.json` 등 orchestrator 내부 파일까지 저장소에 커밋되어 있다. 예상 밖의 파일 생성처럼 보일 수 있으나, `git log` 로 대조한 결과 이 저장소는 동일 패턴(`review/code/**` 산출물 전체 커밋, `_prompts/` 만 `.gitignore` 로 제외)을 기존에도 반복해 왔고 이번 것도 그 관례를 따른다 — 새로운/일탈적 부작용이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `withFiles` 테스트 픽스처 헬퍼(파일 4 신규 사용, 정의는 diff 밖 `common/__test-utils__/temp-fixture.ts`)의 파일시스템 동작 확인
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (diff 대상 아님, 참조용 확인)
  - 상세: `os.tmpdir()` 하위에 `mkdtempSync` 로 격리된 디렉터리를 만들고 `finally` 블록에서 `rmSync(..., { recursive: true, force: true })` 로 정리한다. 저장소 트리 밖에서만 쓰고 지우므로 저장소에 대한 파일시스템 부작용은 없다. 헬퍼 자체는 이번 diff 의 변경 대상이 아니며(이미 이전 리뷰 라운드들에서 다뤄진 기존 유틸), 이번 diff 는 이를 새 소비처로 `import` 만 추가했다.
  - 제안: 조치 불요.

시그니처 변경(점검 관점 #4) 은 `findNumericAsNumber(files: string[]): NumericAsNumberOffender[]` 신설 함수 하나뿐이며 기존 export 시그니처(`findSwaggerContractMismatches`)는 그대로다 — 기존 호출자에 영향 없음. 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 발생 패턴은 diff 전체에서 발견되지 않았다. 전역 변수 신설도 `NUMERIC_COLUMN`(module-scope `const`, 위에서 다룸) 외에는 없다.

## 요약

핵심 변경은 `AlertRuleDto.threshold` 의 공개 타입을 실제 wire 에 맞추는 breaking-but-already-true 정정으로, 유일한 내부 소비자·백엔드 평가 로직 모두 이미 문자열을 전제하고 있어 런타임 부작용은 없다(문서/타입 계층에 국한). 신설 가드 함수는 순수 스캔 로직으로 전역 상태·파일시스템 쓰기가 없고, 유일하게 주의할 만한 `g`-플래그 정규식 재사용 패턴도 `matchAll` 의 내부 복제 의미론 덕에 현재는 안전하다. 대량으로 추가된 `review/**` 산출물 커밋은 이 저장소의 기존 관례와 일치해 이례적 부작용이 아니다. 저장소 트리에 대한 뮤테이션은 이번 리뷰 과정에서 발생하지 않았다(`git status --short` 확인, 세션 산출 디렉터리 외 변경 없음).

## 위험도

LOW
