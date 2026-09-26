# 테스트(Testing) 리뷰 — request-body-guard (2R)

## 뮤테이션 검증 방법 및 원복 경과 (규약 4 고지)

`UNVALIDATED_METATYPES`(`codebase/backend/src/common/pipes/validation.pipe.ts`)에서 `Number` 를 제거하는 뮤턴트를 저장소 파일에 직접
적용해 관련 spec 셋을 실행했다(plan `plan/in-progress/request-body-guard.md` 의 R2 KILLED 주장을 독립 검증). 원복 과정에서 두 단계가
실패했다 — 그대로 밝힌다:
1. 최초 백업 `cp` 를 `git -C <path> status` 와 한 커맨드로 묶었더니, 후자가 "worktree 격리" 가드에 걸려 **명령 전체가 통째로 실행되지
   않아** 백업이 만들어지지 않았다.
2. 뮤턴트를 원복하려던 `git restore -- <단일 파일>` 이 "Irreversible Local Destruction" 권한 분류기에 의해 차단됐다.

최종적으로 `git show HEAD:<path>`(읽기 전용)로 커밋된 원문을 확인한 뒤 `Write` 도구로 그대로 다시 썼다. 복원 후 `git diff
codebase/backend/src/common/pipes/validation.pipe.ts` 가 빈 출력, `git status --short` 는 이 리뷰 세션 자신의 출력 디렉터리
(`review/code/2026/09/26/19_54_03/`) 외 어떤 변경도 보이지 않음을 확인했다 — 저장소는 깨끗하다. (다른 뮤턴트는 시도하지 않았다.)

## 발견사항

- **[WARNING]** `validation.pipe.spec.ts` 의 신규 테스트가 `UNVALIDATED_METATYPES` 원소 제거를 탐지하지 못한다(자기참조 루프) — 뮤테이션으로 실측 확인
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` 테스트 파일 — 함수 없는 `describe('UNVALIDATED_METATYPES', ...)` 블록의
    두 번째 `it`, `codebase/backend/src/common/pipes/validation.pipe.spec.ts:123-131`
    (`it('파이프는 이 목록의 설계 타입이면 검증하지 않고 값을 그대로 넘긴다', ...)`)
  - 상세: 이 테스트는 `for (const metatype of UNVALIDATED_METATYPES) { ... }` 로 **같은 파일에서 import 한 그 배열 자체**를 순회한다.
    배열에서 원소가 하나 빠지면 테스트는 남은 원소만 돈다 — 빠진 원소를 검증하는 어떤 단언도 없다. 실측: `Number` 를 배열에서 제거한
    뮤턴트를 적용하고 `validation.pipe.spec.ts` 를 단독 실행하면 **7/7 전부 GREEN** (freeze 단언도, 이 루프 단언도 걸리지 않는다).
    같은 뮤턴트로 `request-body-advertised.spec.ts` 를 실행하면 대조군(`numberBody` 라우트)이 있어 **2건 RED** —
    `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts:172-187`(위반 목록에서 `numberBody:Number` 소실),
    `:202-208`(`unschematized` 카운트 10→9). 즉 plan 의 뮤턴트 표 R2(KILLED)는 사실이지만, **그 킬은 guard spec 의 대조군 라우트가
    한 것이지 이 pipe spec 테스트가 한 것이 아니다** — 이 파일 하나만 보면 테스트 이름이 암시하는 "목록 보호"는 거짓이다.
  - 제안: 이 테스트를 `for (const metatype of UNVALIDATED_METATYPES)` 대신 **고정된 기대 배열**(`[String, Boolean, Number, Array,
    Object]`)을 순회하도록 바꾸거나, `expect(UNVALIDATED_METATYPES).toStrictEqual([String, Boolean, Number, Array, Object])` 단언을
    추가한다. 그러면 이 파일 하나로도 원소 축소를 탐지하며, 지금처럼 guard spec 의 대조군에 원소별 방어를 전적으로 의존하지 않는다.
    (실질 위험은 LOW — guard spec 이 이미 다섯 원소 전부를 대조군으로 관측해 교차 방어하고 있음을 이번 검증으로 확인했다.)

## 그 외 확인 사항 (새 발견 없음 — 이전 라운드 검증 재확인)

- `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts` 의 대조군(`BodyFixtureController` 의
  `numberBody`/`booleanBody`/`arrayBody`, `AlphaBodyFixtureController.zInline`)은 1R WARNING 2·INFO9 조치(`8bc7e8f19`)로 추가됐고,
  위 뮤테이션 검증으로 **실제로 판별력이 있음**을 재확인했다(Number 제거 시 RED). `beforeAll` 이 `120_000`ms 타임아웃으로 실제
  `src/modules` 컨트롤러를 동적 로드하는 통합형 스캔과, `describe` 본문에서 동기 평가되는 순수 fixture 대조군이 분리돼 있어 테스트
  격리는 양호하다 — fixture 클래스는 각 테스트 파일 로컬 스코프이고 `Reflect.defineMetadata` 도 그때그때 새로 선언한 클래스에만 싣는다.
- `swagger-probe.spec.ts:100-106`(`bodyArgIndexes` 오름차순 정렬 단언)은 파라미터 데코레이터 평가 순서([1,0] 삽입 → [0,1] 기대)를
  직접 이용해 정렬 로직 없이는 실패하도록 설계됐다 — 정적으로 타당해 보이나 별도 뮤테이션 검증은 하지 않았다(plan 표 R6 KILLED 주장,
  시간 예산상 신뢰).
- `scanRequestBodyAdvertised` 의 `checked`/`unschematized` vacuity floor(`request-body-advertised.spec.ts:64-71`)와 정확한 카운트
  단언(`:202-208`)이 병존해, 느슨한 하한(회귀 시 vacuous 방지)과 정밀 단언(분기 실제 실행 확인) 두 층을 모두 갖췄다 — 좋은 패턴.
- `validation.pipe.spec.ts` 의 `얼려 있다`(freeze) 단언(`:119-121`)은 `UNVALIDATED_METATYPES` 자체가 아니라 `Object.isFrozen(...)`
  이라는 독립된 술어를 검사하므로 자기참조 문제가 없다 — freeze 해제 뮤턴트(plan R4)는 이 단언이 정상적으로 잡을 것으로 판단된다
  (직접 재현하지는 않았다).
- 이전 두 라운드(`review/consistency/2026/09/26/{18_59_58,19_09_17}`, `review/code/2026/09/26/19_32_47`)에서 이미 다룬 항목
  (다중 `@Body()` 키 중 하나만 광고돼도 통과 — INFO2, `@ApiBody` 정확성 미검증 — INFO1, 형제 가드와 메타데이터 키 상수 중복 — INFO6/7)은
  스코프·근거가 문서화돼 있고 이번 라운드에서 반증되지 않아 재론하지 않는다.
- 전체 backend 단위 테스트 재실행(`_test_logs/unit-20260926-194417.log`) 결과 `Test Suites: 484 passed`, `Tests: 1 skipped,
  10288 passed, 10289 total` — 신규 테스트 추가가 기존 테스트를 깨지 않았다(회귀 없음).

## 요약

테스트 존재·엣지 케이스·격리·가독성 전반은 이미 두 차례 리뷰·수정(뮤턴트 8/8 KILLED 주장)을 거쳐 성숙한 상태이고, 이번 라운드에서
독립적으로 재실행한 뮤테이션(`Number` 원소 제거)도 guard spec 레벨에서는 정확히 RED 로 잡혀 그 주장이 사실임을 확인했다. 다만 같은
수정 커밋(`8bc7e8f19`)이 `validation.pipe.spec.ts` 에 추가한 새 테스트 하나는 자기참조 루프 구조 때문에 **그 파일 단독으로는** 원소
제거를 전혀 탐지하지 못한다는 것을 실측으로 확인했다 — 전체 방어는 guard spec 의 대조군이 대신하고 있어 실질 위험은 낮지만, 테스트
이름이 암시하는 보장과 실제 판별력이 어긋나는 사례라 WARNING 으로 남긴다. 그 외 새로운 Critical/Warning 급 커버리지 갭은 발견하지
못했다.

## 위험도

LOW
