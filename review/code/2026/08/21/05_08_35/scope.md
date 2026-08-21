# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 마커 재제출 서버측 거부

## 검토 범위

`git diff origin/main...HEAD` 기준 193개 파일. 실질 애플리케이션 코드는 15개 파일
(`codebase/backend/**`, 1389 insertions/12 deletions), spec 7곳(93 insertions/4
deletions), plan 3개(317 insertions/6 deletions), `CHANGELOG.md`(42 insertions).
나머지 다수(160여개)는 `review/code/**`·`review/consistency/**` 산출물로, 이 저장소
CLAUDE.md 가 강제하는 구현 후 자동 리뷰 워크플로의 결과물이다 — 별도 승인 없이 커밋에
실리는 것이 규약이므로 그 자체는 scope 위반이 아니다. 커밋 로그(`git log --oneline`)를
보면 이 브랜치는 10라운드에 걸친 리뷰→수정 반복이었고, 이번이 그 전체를 다시 훑는 최종
라운드로 보인다.

## 발견사항

- **[WARNING]** `production-build-devdep-guard` — 마스킹 재제출 거부 기능과 무관한 **저장소
  전역 빌드 위생 정책**이 같은 PR 에 번들됐다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep-guard.ts`
    (신규 파일 전체, 함수 `findDevDepLeaks`/`resolveBuildFileNames`/
    `collectRuntimeModuleSpecifiers`), `production-build-devdep.spec.ts`(신규),
    `codebase/backend/tsconfig.build.json` (게이트 7-17)
  - 상세: 이 가드는 "빌드 대상 파일 중 어느 것도 devDependency 를 런타임 참조하지 않는다"
    를 **`src/` 전체**에 대해 검증한다. 이번 PR 의 본 주제(Manual 실행 경로에서 마스킹 마커
    재제출 거부)와 직접적 인과는 있다 — `masked-reject-callers-guard.ts` 를 정규식에서
    AST(`ts.createSourceFile`)로 바꾸며 devDependency 인 `typescript` 를 import 하게 됐고,
    그로 인해 `tsconfig.build.json` 의 선존 갭(`*-guard.ts` 가 `**/*spec.ts` 패턴에 안 걸려
    `dist` 로 나가던 문제)이 실제 위험이 됐다. 하지만 그 즉시 위험을 닫는 데는
    `"src/repo-guards/**"` 를 exclude 에 추가하는 것으로 충분했고(실제로 그렇게 했다,
    게이트 12-17), **그 이상으로 "앞으로 이 저장소 전체에서 같은 일이 재발하지 않게
    한다"는 별도의 repo-wide 불변식 하나를 통째로 새로 만들었다.** CHANGELOG 자체가
    "이 기능의 범위를 넘으므로 따로 적어 둔다"고 명시해 스스로 인지하고 있다.
  - 제안: 기능적으로는 무해하고(테스트 전용 파일, 읽기 전용, 이번 라운드 side_effect 리뷰가
    별도 재검증 완료) CHANGELOG 에 투명하게 분리 기록돼 있어 병합을 막을 사유는 아니다.
    다만 이런 저장소 전역 정책 가드는 별도 커밋/PR 로 분리했으면 "마스킹 마커 거부"라는
    보안 기능 리뷰와 "빌드 산출물 devDependency 누출 방지"라는 인프라 정책 리뷰가 섞이지
    않았을 것이다. 향후 유사 패턴(부산물로 저장소 전역 가드가 파생되는 경우)은 별도 PR 로
    쪼개는 쪽을 권장.

- **[INFO]** `masked-reject-callers-guard` 역시 저장소 전역 정적 분석 가드이지만, 위 항목과
  달리 **이 PR 이 도입한 불변식(base `resolveTriggerParameters` 대신 wrapper 를 써야 한다)
  자체를 지키는 회귀 방지 장치**라 기능적 결합도가 높다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`(신규
    전체), `masked-reject-callers.spec.ts`(신규)
  - 상세: CHANGELOG 는 이 가드도 devdep 가드와 함께 "범위를 넘는 부산물"로 묶어서 서술한다.
    그러나 이 가드가 지키는 불변식은 이번 PR 이 방금 만든 것(두 Manual 경로가
    `resolveTriggerParametersRejectingMasked` 를 써야 마커 거부가 실제로 적용된다)이므로,
    "이 기능 자체의 회귀 방지"로 보면 오히려 정상 스코프에 가깝다. 정규식→AST 전환까지
    간 것은 4라운드에 걸쳐 우회 형태(주석 언급 오탐, 개행 import 누락, namespace
    import/require 우회)가 계속 드러났기 때문으로, 커밋 로그(라운드4~8)가 그 근거를
    뒷받침한다.
  - 제안: 조치 불요. 참고 등재만.

- **[INFO]** 브랜치 히스토리 중 절차 위반 1건이 있었으나 이미 자체 발견·정규화됨
  - 위치: `plan/complete/spec-update-masked-reject-framing.md` "⚠️ 절차 위반을 먼저 적는다"
  - 상세: `fix(security)` 커밋(`50f799efd`, developer 턴)이 `spec/5-system/14-external-interaction-api.md`
    표 행을 직접 수정했다 — CLAUDE.md 는 `developer` 의 `spec/` 을 read-only 로 규정한다.
    작업자가 `git log -S` 로 스스로 발견해 사후 planner 문서로 정규화했고, 내용 자체는
    옳다고 리뷰어들도 확인했다(이미 확정된 캐비엇을 표 행에 동기화한 것뿐). 새로 발견한
    문제가 아니라 이미 닫힌 항목이라 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 핵심 기능 파일(`reject-masked-resubmission.ts`)은 요청 범위에 정확히 부합 —
  검증 결과로 기록
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
  - 상세: `resolveTriggerParameters`(base, `resolve-trigger-parameters.ts`) 자체는 이 브랜치
    전체에서 diff 가 없음을 `git diff origin/main...HEAD -- .../resolve-trigger-parameters.ts`
    로 확인했다 — "공유 프리미티브를 넓히지 않는다"는 문서화된 설계가 실제로 지켜졌다.
    `hooks.service.ts`/`schedule-runner.service.ts` 도 이 브랜치에서 변경 없음(diff 0) —
    "webhook·schedule 은 대상이 아니다" 캐비엇 역시 실측으로 정합.
  - 제안: 없음(정상).

## 요약

핵심 변경(마스킹 마커 재제출 서버측 거부, 15개 코드 파일·약 1,400줄)은 요청된 기능
범위에 정확히 부합하고, 공유 함수(`resolveTriggerParameters`)를 건드리지 않은 설계
경계·webhook/schedule 미개입도 diff 로 실측 확인됐다. spec 7곳·plan 3개·CHANGELOG 는
모두 이 기능의 배경·범위·근거를 기록하는 문서 변경으로 무관한 영역을 건드리지 않는다.
유일한 scope 관찰 사항은 저장소 전역 가드 두 개(`masked-reject-callers-guard`,
`production-build-devdep-guard`)가 부산물로 함께 커밋된 것인데, 전자는 이 PR 자체의
회귀 방지라 결합도가 높고, 후자는 인과 관계는 있으나("이 PR 의 AST 전환이 devDependency
누출을 실제 위험으로 만들었다") 해결 방식이 즉시 필요한 범위(해당 파일 exclude)를 넘어
저장소 전역 정책으로 확장됐다. 둘 다 CHANGELOG 에 "범위를 넘는다"고 스스로 명시하는
투명성을 보였고 기능적 위험은 없어 병합을 막을 사유는 아니다. review/** 대량 산출물은
이 프로젝트가 강제하는 리뷰 워크플로의 정상 부산물이라 scope 위반으로 보지 않았다.

## 위험도

LOW
