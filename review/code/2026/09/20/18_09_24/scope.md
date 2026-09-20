# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD` 로 전체 41개 파일을 확인하고, 핵심 코드 파일
(`integrations.service.ts`) 은 `git diff` 로 직접 전문을 열람했다. 각 개별 fix 커밋
(`ab0988f7f`·`af6cc0d2c`·`154e17d31`·`d532184f5`)과 그 이전 커밋(`5c694cc5f`·`f3ea25d02`)도
`git show --stat`/`git show` 로 대조했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short`
확인 결과 이 세션이 만든 것은 `review/code/2026/09/20/18_09_24/` 뿐).

## 발견사항

- **[WARNING]** 커밋 `f3ea25d02` 에 이번 작업(rotate lost-update)과 무관한 main 브랜치 YAML 파싱
  결함 수정이 함께 묶여 있다 — 1라운드 scope 리뷰(`review/code/2026/09/20/17_35_12/scope.md`)가
  이미 지적했고, `RESOLUTION.md` WARNING 7 이 "되돌리지 않는다"로 처분한 항목의 재확인이다.
  - 위치: `plan/complete/spec-draft-integration-error-facts.md:2` (frontmatter `title:` 을
    unquoted → quoted 로 변경)
  - 상세: `git show --stat f3ea25d02` 로 확인한 결과, 이 커밋은 `integration-rotate-concurrency.e2e-spec.ts`
    신규 추가(본 작업 범위)와 `plan/complete/spec-draft-integration-error-facts.md` 1줄 수정(무관한
    main Gate C red 수정)을 같은 커밋에 담고 있다. 커밋 메시지 자체가 "함께: main 이 red 였다"로 투명하게
    밝히고 있고, `plan/in-progress/rotate-lost-update.md` 체크리스트에도 근거가 남아 있어 은폐는 아니다.
    다만 이 문서를 되돌리면 frontend/harness Gate C 가 다시 실패하므로(`RESOLUTION.md` 확인),
    이번 라운드에서도 되돌리지 않기로 한 결정이 그대로 유지되고 있다 — 새로 발견된 것은 아니고,
    이미 처분된 사안이 이번 diff 에도 여전히 존재함을 재확인하는 것이다.
  - 제안: 추가 조치 불요(이미 처분됨). 다만 다음에 "선행 PR 이 깨뜨린 게이트 수정"과 "이번 기능 변경"이
    겹치면 커밋을 분리하는 습관을 권고한다(`RESOLUTION.md` 자체도 같은 권고를 남겼다).

- **[INFO]** 이번 라운드에 추가된 4개 fix 커밋(`ab0988f7f`·`af6cc0d2c`·`154e17d31`·`d532184f5`)은
  전부 1라운드 SUMMARY 의 특정 항목(WARNING 1/2/3/4/5/6/8)에 1:1로 대응하며, 각 커밋이 건드리는 파일도
  그 항목이 지목한 파일 하나로 국한된다.
  - 상세: `git show --stat` 로 확인 — `ab0988f7f`(SUMMARY#1,#2)는 `integrations.service.spec.ts` 만,
    `af6cc0d2c`(SUMMARY#3,#4,#5)는 `integrations.service.ts` 만, `154e17d31`(SUMMARY#6)는
    `integration-rotate-concurrency.e2e-spec.ts` 만, `d532184f5`(SUMMARY#8)는 `CHANGELOG.md` 만
    수정한다. `af6cc0d2c` 의 헬퍼 추출(`assertCanRotate`/`mergeAndValidateCredentials`)은 "임의
    리팩토링"이 아니라 이번 작업 자신이 도입한 락 전/후 중복(architecture.md·maintainability.md
    WARNING)을 직접 겨냥한 것이고, 락 전/후 두 호출 지점의 동작은 바꾸지 않았다(커밋 메시지가 명시,
    unit 141건 GREEN 유지). CLAUDE.md 가 요구하는 "구현 완료 후 자동 review/fix" 표준 절차와 일치하므로
    범위 위반이 아니다.
  - 제안: 없음 — 긍정 기록.

- **[INFO]** `integrations.service.ts` 핵심 diff(생성자 `DataSource` 주입, `assertCanRotate`/
  `mergeAndValidateCredentials` private 헬퍼, `rotate()` 트랜잭션 재작성) 를 직접 열람한 결과
  범위를 벗어나는 import 정리·포맷팅·주석 drive-by 수정은 없다.
  - 상세: 유일한 import 변경은 `Repository` → `Brackets, DataSource, Repository`(실제로 새로
    쓰인 `DataSource` 타입 추가, 미사용 import 없음). 기존 주석("바꾸는 컬럼만 update 한다…")은
    삭제되지 않고 트랜잭션 콜백 안으로 이동·확장됐을 뿐 내용이 보존된다. 나머지 diff 는 전부
    "요청 시작 시점 스냅샷 위 머지" → "락 안 재읽기 위 머지"라는 단일 처방에 직접 종속된 변경이다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/20/17_35_12/**`(16개)·`review/consistency/2026/09/20/{16_43_05,16_58_56}/**`
  (18개, 철회된 spec draft 검토 포함)는 CLAUDE.md 가 의무화한 리뷰·consistency-check 절차의 정상 증적이며
  범위 위반이 아니다. 1라운드 scope.md 가 이미 같은 결론을 냈고, 이번 확인에서도 다른 판단 근거를
  찾지 못했다.

- 핵심 코드 변경(`integrations.service.ts`/`.spec.ts`/신규 e2e) 은 "동시 rotate 가 연결 테스트(수 초)
  가 도는 동안 다른 rotate 의 커밋을 옛 스냅샷으로 되돌리는 lost-update"라는 선언된 단일 목적에서
  벗어나지 않는다. 기능 확장(요청하지 않은 API·엔드포인트 추가), 무관한 파일 수정(위 WARNING 1건
  제외), 의미 없는 포맷팅·주석 변경, 불필요한 import/설정 변경은 발견되지 않았다.

## 요약

이번 diff(41개 파일, 2355행 추가)의 실질적 코드 변경은 `IntegrationsService.rotate()` 의 lost-update
수정이라는 선언된 범위에 정확히 들어맞는다. 1라운드 리뷰에서 받은 Critical/Warning 에 대한 후속 fix 4건도
각각 지목된 파일 하나만 건드려 추가 확산이 없고, `af6cc0d2c` 의 헬퍼 추출은 이 작업 자신이 만든 중복을
해소하는 표준 review-fix 절차이지 임의 리팩토링이 아니다. 유일한 실질적 범위 이탈은 커밋 `f3ea25d02` 에
묶인 무관한 main Gate C(YAML) 수정 1줄인데, 이는 1라운드 scope 리뷰가 이미 발견해 `RESOLUTION.md`
WARNING 7 로 "되돌리면 게이트가 다시 깨지므로 유지"라고 명시적으로 처분한 사안이며, 이번 라운드에서도
그 상태가 변함없이 유지되고 있음을 재확인했을 뿐 새로운 결함은 아니다. `review/**` 다수 산출물은
프로젝트가 강제하는 리뷰·consistency-check 절차의 증적으로 범위 위반이 아니다.

## 위험도

LOW
