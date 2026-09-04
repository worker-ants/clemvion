# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD` (병합base `677ba9c60`, HEAD `9ba0991c8`, 브랜치
`claude/passthrough-dto-verifier`)로 실제 diff 를 직접 확인했다 — 프롬프트가 크기 제한으로
일부 파일 diff 를 생략했기 때문에(`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`,
다수 `review/**` 파일), 저장소를 직접 열어 6개 커밋(`a65a4f85e`~`9ba0991c8`) 각각의
`git show --stat` 과 개별 파일 `git diff`로 전수 대조했다. 저장소에 쓰기는 하지 않았다
(`git status --short` 로 확인 — 이번 리뷰 라운드 자신의 산출물 디렉터리 `21_10_30/` 외
untracked/변경 없음).

52개 파일, +3853/-15 이 diff 전체다.

## 항목별 확인

1. **의도 이상의 변경**: 없음. 6개 커밋 전부 하나의 단일 서사에 묶인다 — `AlertRuleDto.threshold`
   가 `number` 로 잘못 문서화된 것을 실측으로 발견(`a65a4f85e`) → 재발 방지 가드 축 신설
   (`5a7de8ab1`) → 그 가드의 JSDoc/내부 서사가 공개 OpenAPI `description` 으로 새는 것을 발견해
   정정(`dc83c0312`) → 가드가 자기 파일 상단에 스스로 적어 둔 "정규식 금지" 원칙을 어긴 것을
   리뷰가 잡아 AST 로 교체(`c15489e61`) → 후속 리뷰가 지적한 포지셔널 `@Column` 인자·스캔 전제
   누락을 마저 닫음(`b5d5210cf`) → 그 라운드의 RESOLUTION/SUMMARY 등 리뷰 산출물 커밋
   (`9ba0991c8`). 각 커밋이 직전 커밋의 코드 리뷰(19_43_18/20_16_17/20_39_25) 또는 consistency
   체크(20_05_42) WARNING 에 1:1 로 대응하며, 그 근거가 커밋 메시지·RESOLUTION.md 에 명시돼
   있다. `codebase/` 변경은 `alerts` 모듈 DTO 1개 파일, 가드 2개 파일(`swagger-dto-contract-
   guard.ts`/`.spec.ts`), 신규 e2e 1개 파일뿐이다(`git diff --stat -- codebase/` 로 확인, 그
   외 `codebase/` 파일 변경 0건).

2. **불필요한 리팩토링**: 가드 파일에 `readOption<T>` 제네릭 통합(`readBooleanOption`/
   `readStringOption` 중복 제거, `b5d5210cf` W2)과 `collectNumericFields`/`collectDtoFieldTypes`
   분리(`c15489e61` 부수)가 있지만, 둘 다 **이번에 새로 추가한 코드 자신에 대한 정리**이지 무관한
   기존 코드를 건드리지 않았다. `readBooleanOption` 의 기존 호출부·시그니처는 그대로다(내부
   구현만 `readOption` 위임으로 바뀜, 외부에서 관측되는 동작 변화 없음).

3. **기능 확장**: 가드에 세 번째 축(`findNumericAsNumber`/`scanNumericExposure`)과 e2e 테스트가
   신설됐지만, CHANGELOG 가 "재발 방지" 로 명시했고 plan 문서의 §5.4 drift 2단계 (b) 항목("대표
   엔드포인트 실제 응답 대조 테스트")과 정확히 대응한다 — 임의의 기능 확장이 아니라 발견된 결함
   클래스를 좁게 겨눈 회귀 방지책이다. 전수 대조가 아니라 numeric/decimal 컬럼 한 축만 좁힌
   점(46건 오탐 회피 근거 명시)도 over-engineering 을 스스로 경계한 흔적이다.

4. **무관한 수정**: 없음. `codebase/frontend/**`, 다른 모듈, 다른 spec 문서는 diff 에 전혀
   나타나지 않는다. `dc83c0312` 커밋 메시지가 스스로 "INFO#4 — `3-schedule.md` 의 stale plan
   경로. **이 diff 와 무관한 선재 상태**다" 라고 명시하며 그 파일을 건드리지 않은 점이 오히려
   스코프 규율을 보여준다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff
   도 §5.4 drift 관련 체크리스트 항목(약 46줄 구간)에 국한되고 문서의 다른 절은 무변경이다.

5. **포맷팅 변경**: 실질 변경과 뒤섞인 순수 포맷팅 diff 는 관측되지 않았다. 각 hunk 가 좁게
   대상 블록만 치환한다(예: `alert-rule-response.dto.ts` 는 `threshold` 필드 1개 블록만 hunk
   범위).

6. **주석 변경**: `alert-rule-response.dto.ts` 의 JSDoc 이 8~9줄로 길어졌으나, 이는 별도로
   리뷰(`dc83c0312`)가 "JSDoc 이 `nest-cli.json` 의 `@nestjs/swagger` 플러그인을 통해 공개
   OpenAPI `description` 으로 나간다"는 실측을 근거로 **내부 서사를 CHANGELOG 로 옮기고 JSDoc
   은 소비자용 2문장으로 축약**하도록 정정한 결과다 — 임의의 주석 비대화가 아니라 근거 있는
   재정정이다. 가드 파일의 신규 docstring(`NumericAsNumberOffender` 등)도 전부 신규 함수
   자체의 설계 근거를 설명하며, 기존 무관 코드의 주석은 건드리지 않았다.

7. **임포트 변경**: `swagger-dto-contract-guard.ts` 가 `toPosixPath` 를, `swagger-dto-contract.
   spec.ts` 가 `withFiles`/`findNumericAsNumber`/`scanNumericExposure` 를 추가 import 했는데,
   전부 이번 diff 안에서 실제로 호출된다(미사용 임포트 없음). `toPosixPath`/`withFiles` 는
   이번 diff 이전에 이미 저장소에 존재하던 유틸(`e55b3a74a` 등 선행 커�밋에서 도입)이라 신규
   유틸 난립도 아니다(`git diff` 로 두 유틸 파일 자체는 이번 범위에서 무변경임을 확인).

8. **설정 변경**: 없음. `package.json`/`tsconfig`/CI 워크플로 등 설정 파일은 diff 에 없다.

## 발견사항

- **[INFO]** 리뷰 산출물(`review/code/**19_43_18/20_16_17/20_39_25**`, `review/consistency/
  **20_05_42**`) 27개 파일이 코드 변경 5개 파일과 함께 같은 브랜치에 누적 커밋됐다
  - 위치: 각 라운드 디렉터리 전체(예: `review/code/2026/09/04/19_43_18/*.md`)
  - 상세: 좁게 보면 "리뷰 산출물"은 실제 기능 코드가 아니므로 diff 볼륨의 대부분(52개 파일 중
    27개, +3853줄 중 상당수)을 차지한다. 다만 CLAUDE.md 가 "코드 리뷰 산출물 위치:
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"를 단일 진실 저장 위치로 명시하고, "구현
    완료 후 자동 review/fix 는 상시 승인된 강제 의무"라고 규정하므로, 각 라운드의 fix 커밋에
    직전 라운드의 RESOLUTION/SUMMARY 를 동반 커밋하는 것은 이 저장소의 정식 워크플로이지
    범위 이탈이 아니다. 각 라운드 파일이 그 라운드에서 실제로 실행된 리뷰의 산출물이고
    (`meta.json` 의 파일 목록·`agents_forced` 가 그 시점 diff 범위와 대응), 임의로 지어낸
    문서는 아니다.
  - 제안: 조치 불요 — 참고용 기록.

- **[INFO]** 가드 파일이 같은 changeset 안에서 "정규식 → AST" 를 3번의 후속 커밋에 걸쳐
  왕복 수정했다(`5a7de8ab1` 신설 → `c15489e61` AST 로 교체 → `b5d5210cf` 포지셔널 인자 보강)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 커밋 메시지 자체가 "그 파일 상단 docstring 이 이미 금지한 실수를 반복했다"고 자인하고
    있어, 코드 구조 관점에서는 낭비처럼 보일 수 있다. 그러나 각 반복이 **직전 라운드 리뷰의
    WARNING 에 대한 직접 응답**이고(뮤테이션 예측/실측까지 RESOLUTION 에 기록), 최종 상태만
    diff 로 보면 정규식이 아니라 AST 구현 하나만 남는다 — "범위(scope)" 관점에서는 왕복 자체가
    아니라 **최종 diff 가 원 의도(재발 방지 가드)를 벗어났는가**가 판단 기준인데, 벗어나지
    않았다.
  - 제안: 조치 불요 — scope 관점 결함 아님(반복 자체는 이 프로젝트의 review-fix loop 컨벤션).

## 요약

`git diff origin/main...HEAD` 전수 대조 결과, 52개 파일·6개 커밋 전부가 "`AlertRuleDto.threshold`
가 `number` 라고 잘못 문서화됐던 것을 정정하고, 같은 결함 클래스가 재발하지 않도록 가드·e2e·plan
문서를 갱신한다"는 단일 서사에 묶인다. `codebase/` 변경은 alerts DTO 1개·가드 2개·신규 e2e
1개로 한정되고, 각 후속 커밋은 직전 리뷰/consistency 라운드의 구체적 WARNING 에 1:1 대응한다.
무관한 파일·설정·불필요한 임포트·의미 없는 포맷팅은 발견되지 않았다. 볼륨의 상당 부분을 차지하는
`review/**` 산출물 커밋과 가드 구현의 반복 수정은 이 저장소가 명시적으로 요구하는 review-fix
루프의 정상적 부산물이라 범위 이탈로 보지 않았다.

## 위험도

NONE
