# 문서화(Documentation) 리뷰 — model-config 동시 DELETE 중복 감사 수정 (8번째 자리, 2라운드)

## 발견사항

- **[INFO]** 「과장 정정」의 근거로 3곳에서 반복 인용한 `llm.service.ts:81` 이 실제 호출 줄이 아니라 그 한 줄 위(리스너 선언 줄)를 가리킨다
  - 위치:
    - `CHANGELOG.md` — 인증 설정(7번째) 항목의 `> **정정 (2026-09-21, 여덟 번째 PR 실측)**` 블록(`` `llm.service.ts:81` `` 인용부)
    - `plan/in-progress/modelconfig-dup-delete.md` — `## B. 트래커에 내가 적은 것 하나가 과장이었다` 문단
    - `plan/in-progress/spec-draft-nullable-notation-followups.md` — 여덟 번째 항목의 `> **2026-09-21 정정**` 블록
  - 상세: 세 문서 모두 "`ModelConfigService.remove()` 의 캐시 무효화 리스너는 `llm.service.ts:81` 의 `clearClientCache(configId)` 하나뿐"이라고 적었다. 실제로 `codebase/backend/src/modules/llm/llm.service.ts` 를 열어 대조하면 81번째 줄은 `private readonly onConfigInvalidatedListener = (configId: string): void => {` (리스너 필드 선언)이고, `this.clearClientCache(configId);` 호출 자체는 82번째 줄이다. 이 세 문서는 정확히 이 결함 클래스의 이전 항목(#1374)이 남긴 예고("캐시 무효화 통지 중복까지 있다")를 **실측으로 반증**하며 "확인해 보니 리스너가 하나뿐이더라"는 것을 근거로 드는 대목인데, 그 근거 자체의 줄 번호 인용이 정확히 그 호출문을 가리키지 않는다. 이 diff의 다른 모든 줄 인용(예: `model-config.service.ts:404` 원본 버그 코드, `notFound():148`, 마이그레이션 `V090:22`/`V091:23` 의 `ON DELETE SET NULL`)은 실제로 열어 대조한 결과 전부 정확했던 것과 대비된다.
  - 제안: 차단 사유는 아니다(리스너 함수 자체가 81번째 줄에서 시작하므로 "그 블록"을 가리킨 것으로 읽을 여지는 있다). 다음에 이 문서들 중 하나를 편집할 기회가 있으면 `llm.service.ts:81-82` 로 정정하거나 줄 번호를 빼고 메서드명만 인용하는 편이 안전하다.

- **[정보, 비-결함]** 이전 라운드(`review/code/2026/09/21/16_39_52`) 의 문서화 WARNING 2건이 이번 diff 에서 실제로 해소됐음을 확인
  - 위치: `CHANGELOG.md` 상단(신규 8번째 항목 + 7번째 항목의 취소선 정정), `codebase/backend/src/modules/model-config/model-config.service.ts` (`remove()` 상단 JSDoc)
  - 상세: WARNING 1(형제 6건이 지켜온 CHANGELOG 갱신 관례를 이번 PR만 건너뜀)은 형제와 동일한 3단 구성(판별자가 형제와 같은 이유/고친 것/판별력 실측/남는 것)으로 추가됐고, 판별력 실측값(`[204,204]`→`[204,404]`, 감사 2건→1건)도 정확히 실려 있다. WARNING 2(7번째 항목의 과장된 예고 미정정)는 원문을 취소선으로 보존하고 인접에 실측 정정 블록을 추가하는 방식으로 처리됐다 — 배포 이력(CHANGELOG)을 고쳐 쓰지 않고 정정하는 규약을 정확히 따랐다. INFO 11(`remove()` JSDoc 부재)도 `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND` 한 줄로 해소됐고, 기존 인라인 주석(판별자 근거)과 중복 서술하지 않는다.
  - 제안: 없음(확인 기록).

- **[정보, 비-결함]** 오래된 주석(kind 캡처 순서 근거)이 새 구현에 맞춰 정확히 교체됨을 확인
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` 본문, `const { kind } = config;` 직전 주석
  - 상세: 종전 주석 "kind 를 remove 전에 읽어둔다 — TypeORM `remove` 는 엔티티의 id 를 지우므로 삭제 후 `config.id` 를 쓰면 undefined 가 감사에 남는다"는 `repo.remove(entity)` 를 전제로 한 서술이었다. `repo.delete(criteria)` 로 바뀐 뒤에는 그 전제가 거짓이 되는데, 새 주석이 "아래 `delete(criteria)` 는 엔티티를 건드리지 않으므로 순서 때문이 아니라 단순히 조회 결과에서 읽는 것"이라고 정확히 고쳐 두었다. 단위 테스트 쪽(`model-config.service.spec.ts`)의 옛 "**삭제 전에** 읽은 kind 를 남긴다" 테스트명·흉내 코드(`delete entity.id; delete entity.kind`)도 vacuous 해진 이유를 주석으로 남기고 제거했다 — 오래된 주석/테스트명이 방치된 사례가 없다.
  - 제안: 없음(모범 사례로 기록).

- **[정보, 비-결함]** README·API(Swagger) 문서 업데이트 불필요성 확인
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` (diff 밖, 직접 열어 대조)
  - 상세: 이번 변경은 컨트롤러 계층(URL·인증/인가·`@HttpCode`·`@ApiNotFoundResponse`)을 건드리지 않고 서비스 내부 구현(`remove(entity)`→`delete(criteria)`)에 국한된다. 레이스 패자가 이제 받는 404 는 이미 컨트롤러가 `@ApiNotFoundResponse` 로 문서화해 둔 기존 코드 경로(`findEntity` 실패와 동일한 `MODEL_CONFIG_NOT_FOUND`)를 재사용한 것이라 Swagger/OpenAPI 문서에 새로 추가할 계약이 없다. 새 환경변수·설정 옵션도 도입되지 않았다. README 갱신 불필요.
  - 제안: 없음.

## 요약

이번 diff(CHANGELOG, 서비스 코드, 단위/e2e 테스트, plan 2건)의 문서화 수준은 전반적으로 높다. 형제 7건(#1369~#1374)과 동일한 CHANGELOG 3단 구성을 지켰고, 직전 항목이 남긴 과장된 예고를 취소선+실측으로 정정하는 프로젝트 관례를 정확히 따랐으며, 전 라운드 리뷰가 지적한 WARNING 2건·INFO 2건(CHANGELOG 누락, 과장 미정정, JSDoc 부재, 죽은 fixture)이 모두 확인 가능한 형태로 해소되어 있다. 오래된 주석은 새 구현(원자적 `DELETE`)에 맞춰 정확히 교체됐고, 복잡한 동시성 로직(무락 조회 → 원자적 DELETE → `affected` 판별)에는 근거·실측치를 곁들인 상세한 인라인 주석이 달려 있다. 유일하게 발견한 흠은 「캐시 무효화 통지 중복은 과장이었다」는 자기-정정 근거로 3개 문서가 반복 인용한 `llm.service.ts:81` 줄 번호가 실제 `clearClientCache` 호출 줄(82)이 아니라 그 한 줄 위(리스너 선언)를 가리키는 사소한 오프바이원으로, 이 diff의 다른 모든 줄 인용이 실측 대조로 정확했던 것과 대비되는 옥의 티다. 차단 사유는 아니다.

## 위험도
LOW
