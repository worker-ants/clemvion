# 유지보수성(Maintainability) 리뷰 — integration-dup-delete (11_32_06)

## 검토 범위 및 사전 확인

- 핵심 대상: `codebase/backend/src/modules/integrations/integrations.service.ts`,
  `integrations.service.spec.ts`, 신규 `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`.
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/21/10_54_47/*`,
  `review/consistency/2026/09/21/10_27_27/*` 는 애플리케이션 코드가 아니라 문서/plan/이전 라운드
  리뷰 산출물(신규로 커밋되는 아카이브)이라 함수 길이·중첩·순환 복잡도 등 코드 전용 관점의 평가
  대상에서 제외했다(선례: `project_reaper_engine_dry_refactor_920` 계열 리뷰와 동일 처리).
- 이번 라운드 diff 는 **직전 라운드(`review/code/2026/09/21/10_54_47`)가 지적한 WARNING #2
  (maintainability, `RESOURCE_NOT_FOUND` 리터럴 중복)를 이미 해소한 상태**를 담고 있다
  (`RESOLUTION.md` 조치 commit `5bbdf753d`). 아래는 그 해소가 실제로 완전한지 재검증한 결과다.
- 작업 트리 이상 상태 없음: `git status --short` 결과 `review/code/2026/09/21/11_32_06/`(이 세션
  산출물 디렉터리) 외 변경 없음 — 다른 병렬 reviewer 의 미커밋 뮤테이션 관측되지 않았다. 리포지토리에
  쓰기(뮤테이션)는 하지 않았다.

## 발견사항

- **[INFO]** `throwIntegrationNotFound()` 헬퍼 추출이 파일 전체 7곳 모두에 정확히 반영됨 — 재검증 완료, 잔여 리터럴 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:602`(`findById`),
    `:613-618`(헬퍼 정의), `:740`(`update`), `:769`(`remove` 존재 확인), `:803`(`remove` 의
    `affected===0` 판정), `:1191`(`rotate` 재조회), `:1219`(`rotate` `affected` 판정), `:1480`(`requireEntity`)
  - 상세: `grep -n "RESOURCE_NOT_FOUND\|throwIntegrationNotFound\|NotFoundException" integrations.service.ts` 로
    직접 재확인한 결과 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })` 리터럴은 헬퍼 정의부
    단 한 곳(`:614-616`)에만 남아 있고, 나머지 7개 호출부는 전부 `this.throwIntegrationNotFound()`
    한 줄로 통일돼 있다. 형제 모듈(`schedules.service.ts` `throwScheduleNotFound()`,
    `triggers.service.ts` `throwTriggerNotFound()`)과 동일한 `private ...(): never` 시그니처를 따르고,
    호출부의 `if (!x) this.throwIntegrationNotFound();` 단일 라인 스타일도 그 형제들의 관례와 일치한다.
    JSDoc 주석(`:606-612`)이 직전 리뷰 라운드(`review/code/2026/09/21/10_54_47` maintainability WARNING 2)를
    전체 경로로 인용해, 이 리팩터가 무엇을 왜 고쳤는지 다음 사람이 추적 가능하게 남겼다.
  - 제안: 조치 불요 — 이미 완전히 해소됨. 신규 지적 아님(긍정 확인 기록).

- **[INFO]** `remove()` 함수의 복잡도·길이는 적절 — 새 로직이 함수를 비대화시키지 않음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:765-818`
  - 상세: 실제 실행 로직은 순차적인 4단계(존재 확인 → 사용처 확인 → 원자적 `delete` + `affected===0`
    판정 → 감사·broadcast)뿐이며 중첩은 없다(모든 조건문이 함수 최상위 레벨). 함수 본문이 54줄로 보이는
    이유는 대부분(약 16줄, `:783-798`)이 설계 근거를 설명하는 인라인 주석이기 때문이다 — 코드/주석
    비율이 다소 높지만, 같은 결함 클래스를 고친 형제 커밋들(`schedules.service.ts` 의 cascade-delete
    trigger 블록 등)도 동일한 밀도로 근거·기각된 대안·실측을 남기는 것이 이 저장소의 확립된 관례다.
    새로운 매직 넘버는 도입되지 않았다 — `0`/`undefined`/`null` 은 판별자로서 주석·테스트 양쪽에서
    의미가 명시적으로 설명된다.
  - 제안: 조치 불요.

- **[INFO]** 신규 단위 테스트 2건과 mock 확장은 형제 스펙(`schedules.service.spec.ts`)의 대조군 패턴과
  구조적으로 동형이며, 새로운 복잡도를 추가하지 않음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:131-134`(mock
    `delete` 스텁 추가), `:1059-1066`(기존 테스트의 `remove`→`delete` 단언 갱신), `:1073-1109`(신규
    두 테스트), `:1173-1176`·`:1195-1198`(conflict-path 두 곳의 `remove`→`delete` 단언 갱신)
  - 상세: `for (const affected of [undefined, null])` 루프(`:1098`)는 반복마다 `mockClear()` 로 상태를
    격리하고 매 반복 끝에 `auditLogsService.record`·`integrationCacheBus.publish` 두 단언을 모두
    확인한다(직전 라운드 INFO #7 조치 반영 — `publish` 단언 누락이 없어졌다). conflict-path 두 테스트의
    단언도 죽은 `integrationRepo.remove` mock 대신 실제 진입점인 `integrationRepo.delete` 를 가리키도록
    정확히 갱신됐다(직전 라운드 WARNING #1 조치). 테스트 이름이 한국어인 것은 같은 `describe` 블록의
    기존 영어 테스트와 섞여 있으나, `schedules.service.spec.ts`/`triggers.service.spec.ts` 에도 이미
    광범위하게 존재하는 기존 관례라 새로 지적할 비일관성이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 파일은 형제 4파일과 구조·명명 패턴을 의도적으로 복제 — DRY 위반 아님(기존 판정 유지)
  - 위치: `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` (전체, 특히
    `beforeAll`/`afterAll` 커넥션 관리 `:33-50`, `finally` 블록의 안전 정리 `:104-107`)
  - 상세: `schedule-delete-concurrency.e2e-spec.ts` 와 직접 diff 한 결과, 겹침을 만드는 락 기법(행 락
    `SELECT ... FOR UPDATE` vs 스케줄의 advisory lock)만 이 경로에 락이 없다는 사실을 반영해 다르고,
    나머지 구조(헤더 독스트링 형식, `Promise.race` 공허성 가드, `finally` 의 `ROLLBACK`+`pending` 흡수,
    감사 카운트 쿼리)는 동형이다. 이 저장소는 이런 형제 e2e 간 미러 중복을 cafe24/makeshop 미러처럼
    의도된 패턴으로 다뤄 온 선례가 있어 새로 결함으로 지적하지 않는다. plan 문서(`plan/in-progress/integration-dup-delete.md`)가
    이미 6번째 자리(`WorkspacesService.removeMember()`)를 예고했으므로, 그 PR 에서 5번째 반복이 되는
    시점엔 공통 헬퍼 추출을 검토할 가치가 있다는 점만 참고로 남긴다 — 이번 PR 에서 강제할 사항 아님.
  - 제안: 지금은 조치 불요, 다음 반복 시 검토(직전 라운드 INFO #9 와 동일한 판단 유지).

## 요약

이번 diff 는 직전 리뷰 라운드(`review/code/2026/09/21/10_54_47`)가 지적한 유일한 maintainability
WARNING(`RESOURCE_NOT_FOUND` 리터럴 중복)을 `throwIntegrationNotFound(): never` 헬퍼로 정확히
해소했다 — grep 재검증 결과 파일 전체 7개 호출부가 모두 헬퍼를 재사용하고, 리터럴은 헬퍼 정의 한
곳에만 남아 형제 모듈(schedules/triggers)의 확립된 관례와 정렬됐다. 핵심 로직(`remove()`)은 여전히
순차적 3단계 판정으로 중첩·복잡도가 낮고, 새 매직 넘버도 없다. 테스트 쪽도 직전 라운드가 지적한
vacuous conflict-path 단언(WARNING #1)과 무단언 대조군(INFO #7)이 모두 실제로 고쳐져 있음을
확인했다. 신규 e2e 파일의 형제-미러 중복은 이 저장소의 기존 의도된 패턴이라 결함으로 보지 않는다.
이번 라운드에서 새로 발견한 Critical/Warning 급 유지보수성 이슈는 없다.

## 위험도

NONE
