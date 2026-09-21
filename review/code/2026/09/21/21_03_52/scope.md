# 변경 범위(Scope) 코드 리뷰

## 검토 범위 요약

핵심 변경은 아홉 개 e2e 동시성 테스트 파일(11 블록)에 손으로 복제돼 있던
`BEGIN → 락 → 두 요청 발사 → 1.5초 공허성 가드 → COMMIT/ROLLBACK` 보일러플레이트를
`codebase/backend/test/helpers/concurrency.ts`의 `raceUnderHeldLock()`로 추출하는
순수 테스트 리팩터다. `plan/in-progress/e2e-race-helper.md`가 착수 전 실측(§B)·설계·
"하지 않는 것"(§D)을 명시했고, 실제 diff는 그 계획과 정확히 일치한다.

나머지 파일은 (1) `PROJECT.md`의 e2e 가이드 갱신 6줄, (2) 앞선 두 라운드의 `/ai-review`
산출물(`review/code/2026/09/21/{20_26_50,20_45_43}/**`), (3) `/consistency-check --impl-prep`
산출물(`review/consistency/2026/09/21/19_59_55/**`)이다.

## 발견사항

- **[INFO]** 신규 export `raceUnderHeldLock()`에 plan §B 시그니처 스케치에 없던 방어 로직 두 가지가 추가됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:81`(`if (fires.length < 2) { throw ... }`),
    `:12-14`+`:29-36`(`KNOWN_LOCK_TIMEOUTS_MS` 레지스트리 + 모듈 로드 시점 `for`/`throw` assert)
  - 상세: `fires.length < 2` 가드는 이미 앞선 두 라운드(`review/code/2026/09/21/20_26_50/scope.md`,
    `20_45_43/scope.md`)에서 INFO로 지적·"조치 불요"로 판정된 항목이다 — 함수 자체의 목적(겹침 생성)에
    직결된 5줄 방어이지 별개 기능 추가가 아니다. `KNOWN_LOCK_TIMEOUTS_MS` 레지스트리+assert는 이번
    세션에서 새로 추가된 것으로 보이지만, 이는 임의 확장이 아니라 직전 라운드(`20_45_43/architecture.md`)의
    WARNING("JSDoc 이 '프로덕션 전역 최소 상한'이라 주장하지만 실제 비교 대상은 트리거 상수 하나뿐")에
    대한 응답이며, `git log`상 마지막 커밋(`905e1f696`, "내가 넣은 검사의 주장이 실제 범위보다 넓었다")이
    바로 그 자기-반증 정정이다. 요청받은 범위(공허성 가드 대기시간의 안전 마진을 코드로 고정)를 벗어나지
    않는다.
  - 제안: 조치 불요 — 두 항목 모두 헬퍼 자신의 안전성에 종속된 최소 변경이며 새 발견이 아니다.

- **[INFO]** diff의 대다수(46개 중 30여 개)가 실제 코드 변경이 아니라 선행 두 `/ai-review` 라운드 +
  `--impl-prep` consistency-check 산출물 커밋
  - 위치: `review/code/2026/09/21/20_26_50/**`, `review/code/2026/09/21/20_45_43/**`,
    `review/consistency/2026/09/21/19_59_55/**`
  - 상세: `CLAUDE.md`가 구현 완료 후 `/ai-review` + Critical/Warning fix를 "상시 승인된 강제 의무"로,
    착수 직전 `consistency-check --impl-prep`을 의무로 규정하고 그 산출물 저장 위치를 각각
    `review/code/**`/`review/consistency/**`로 명시한다. 이번 세션 안에서 실제로 2라운드의 fix 사이클이
    돌았고(`8b3c81f7c` 추출 → `20_26_50` 라운드 → `6b29435ac` fix → `20_45_43` 라운드 → `905e1f696`
    정정), 각 라운드 산출물이 그 라운드를 유발한 커밋에 정확히 동봉돼 있다. 무관한 파일 혼입이 아니라
    프로세스가 강제하는 정상 부산물이다.
  - 제안: 조치 불요.

## 스코프 정합성 확인 (문제 없음)

- **프로덕션 코드 변경 0**: `codebase/backend/src/**` 전체에서 diff 없음 — plan §D 서술과 실행이 일치.
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`codebase/backend/test/helpers/concurrency.ts:4`)는 프로덕션
  상수를 읽기만 하는 단방향 import이며(경계 결합 자체는 architecture 리뷰 영역, scope 위반 아님),
  `trigger-`/`schedule-delete-concurrency.e2e-spec.ts`가 이미 같은 모듈에서 다른 export를 참조하던
  기존 결합의 연장이다.
- **단언(assertion) 변경 0**: 9개 e2e spec 파일 전부에서 상태 코드·에러 코드 기대값이 리팩터 전후
  문자 그대로 동일하다(`auth-config-delete-concurrency.e2e-spec.ts`, `integration-delete-concurrency.e2e-spec.ts`,
  `member-remove-concurrency.e2e-spec.ts`(2블록), `model-config-delete-concurrency.e2e-spec.ts`,
  `schedule-delete-concurrency.e2e-spec.ts`, `trigger-delete-concurrency.e2e-spec.ts`,
  `workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts` diff 직접
  대조). 사라진 것은 각 블록의 `expect(raced).toBe('pending')` 뿐이며, 그것이 헬퍼로 옮겨간 공허성
  가드 자체다.
- **`integration-rotate-concurrency` 제외 결정 유지**: diff 어디에도 그 파일이 등장하지 않는다 — plan
  §B가 "single-fire·update-merge 구조라 축이 다르다"로 명시적으로 제외한 근거와 실행이 일치.
- **매직 넘버 처리 범위**: `1_500`만 `VACUITY_GUARD_MS` 단일 상수로 통합됐고, `60_000`/`120_000`(jest
  timeout)은 plan §D가 "파일마다 다를 이유가 있어 일괄 상수화하지 않는다"고 명시한 대로 각 파일에
  그대로 남아 있다 — 계획과 실행 일치.
- **임포트**: 9개 spec 파일 모두 `raceUnderHeldLock` 단일 신규 import만 추가. 미사용 import·불필요한
  정리 없음.
- **포맷팅·주석**: 각 e2e 파일 diff는 인라인 블록을 헬퍼 호출로 치환하는 최소 변경이며, 헬퍼로 옮겨간
  로직을 가리키는 한 줄 주석으로 대체됐을 뿐(예: "공허성 가드는 헬퍼가 건다 — `helpers/concurrency.ts`")
  기존 도메인 설명 주석(예: `auth-config-delete-concurrency.e2e-spec.ts`의 "둘 다 무락 `findById` 를
  통과한 뒤…")은 그대로 보존된다. 무관한 줄의 재포맷·공백 변경은 관찰되지 않는다.
- **문서 변경 범위**: `PROJECT.md` 변경은 새 헬퍼 소개 6줄 추가뿐이며, 절 구조·인접 서술·다른 절은
  건드리지 않는다. 이 추가 자체가 plan §A("열 번째 작성자가 또 손으로 복제할 위험")가 명시한 리팩터의
  목적과 직결돼 요청 범위 밖의 기능 확장이 아니다.
- **설정 파일**: `package.json`/lockfile/tsconfig/jest 설정 등 어떤 설정 파일도 diff에 없다.

## 요약

핵심 변경(`raceUnderHeldLock()` 추출 + 9파일 리팩터)은 plan 문서의 사전 실측·설계·명시적 배제 목록과
정확히 일치하며, 프로덕션 코드·assertion·제외 대상(`integration-rotate-concurrency`)·매직넘버 처리
범위 모두 계획대로 집행됐다. diff의 상당 부분을 차지하는 두 라운드의 `/ai-review` 산출물과
`--impl-prep` consistency-check 산출물은 프로젝트가 강제하는 게이트의 정상 부산물이며 무관한 파일
혼입이 아니다. 이번 세션에서 새로 관찰된 `KNOWN_LOCK_TIMEOUTS_MS` 레지스트리·모듈 로드 시점 assert는
임의의 기능 확장이 아니라 직전 라운드 WARNING(문서된 보장이 구현보다 넓다)에 대한 정확한 응답이자
자기 자신의 과장된 주장을 실측으로 좁힌 정정(`905e1f696`)이다. 의도 이상의 변경, 불필요한 리팩토링,
무관한 파일·영역 수정, 의미 없는 포맷팅 혼입, 불필요한 주석/임포트 변경, 의도하지 않은 설정 변경 —
어느 항목에서도 범위 위반을 발견하지 못했다.

## 위험도

NONE
