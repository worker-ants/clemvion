# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (최종 라운드, 04_20_10)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 branch diff(163 files, +16100/-26)를 확정하고,
`git log origin/main..HEAD --oneline` 으로 11개 커밋 전체(라운드 1~8의 리뷰-수정 사이클)를
확인했다. `codebase/` 하위만 별도로 필터링해 실질 애플리케이션 코드 변경 범위를 재검증했고,
프롬프트가 diff 를 생략한 신규 핵심 파일(`reject-masked-resubmission.ts`,
`masked-reject-callers-guard.ts`)은 `Read` 로 직접 열어 대조했다. 이전 8개 라운드의 자체
`scope.md`(`01_15_47`, 위험도 NONE)가 이미 같은 결론에 도달해 있었으므로, 그 결론을 그대로
받지 않고 최신 커밋(`e9b942b08`, 라운드8 — 가드를 정규식에서 AST 파서로 전면 재설계)까지
포함한 **최종 상태**를 독립적으로 재확인했다.

## 실질 코드 변경 범위 확인 (독립 재검증)

`codebase/` 하위 diff 는 13개 파일(+1107/-12)로 좁게 유지된다:

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted` reason/code
  enum 1행 + 매핑 1건.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규, 145줄) + `.spec.ts`(신규,
  317줄) — 핵심 구현. 직접 `Read` 로 전문을 확인 — raw→resolve 2단계 검사, 정확 일치·깊이
  상한 두 경계, 다른 책임 없음.
- `executions/executions.service.ts`, `workflows/workflows.controller.ts` — import 교체 +
  호출부 1곳씩 wrapper 로 교체. `errors`→`details` 봉투 교정은 이 PR 이 만드는 새 배선이
  실제로 작동하려면 필요한 선존 버그 수정으로 직접 결합돼 있다(별개 무관 수정 아님).
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS`
  를 `export` 로 승격 + `Set`→`readonly string[]`+`Object.freeze` 로 자료구조 교체(라운드5
  자체 리뷰가 "freeze(Set) 는 플라시보" 라고 반증해 수정한 것 — 이 PR 이 새로 만든 표면의
  런타임 보장을 이 PR 안에서 고친 것이라 스코프 안).
- `repo-guards/__tests__/masked-reject-callers-guard.ts`(신규) + `.spec.ts`(신규) — 두 호출부
  외 "제3의 Manual 경로가 base 함수를 직접 import 하면 마커 거부가 조용히 우회된다" 는 이 PR
  자신의 불변식을 CI 타임에 강제하는 defense-in-depth. 라운드4(`01_38_26` WARNING1)에서
  "불변식이 JSDoc 코멘트로만 강제된다"는 자체 리뷰 지적에 대한 직접 수정으로 도입됐고,
  이후 라운드5~8에 걸쳐 이 가드 자신의 결함(언급/사용 혼동 → 탐지 무보증 → named-import 만
  탐지 → 결국 정규식 자체를 버리고 AST 로 전환)이 반복 발견·수정됐다. 최종 상태를 `Read` 로
  직접 확인 — `typescript`(backend 기존 devDependency, package.json 변경 없음 확인)의 AST
  파서로 식별자 판정 2가지(식별자 위치·element access 문자열 인자)만 본다.
- `tsconfig.build.json` — 위 repo-guard 가 `typescript` 를 `require` 하게 되면서 처음 드러난
  파생 결함(`*-guard.ts` 가 `*spec.ts` exclude 패턴에 안 걸려 dist 로 나가던 선존 문제)의
  수정. `src/repo-guards/**` 를 build exclude 에 추가. 이 PR 이 만든 신규 파일이 촉발한
  결함의 수정이라 스코프 안.
- `resolve-trigger-parameters.spec.ts`, `workflows.controller.spec.ts`,
  `executions-rerun.service.spec.ts` — 신규 기능/회귀에 대한 캐너리 테스트만 추가.

이 13개 파일 모두 "마스킹 마커 재제출을 서버가 거부한다"는 단일 의도에서 벗어나지 않는다.
불필요한 리팩토링·의도치 않은 포맷팅 변경·무관한 import 정리·사용하지 않는 import 추가는
발견되지 않았다.

## 발견사항

- **[INFO]** repo-guard 서브시스템(가드 본체 + spec + `tsconfig.build.json` 배제)은 "마스킹
  마커 재제출을 거부한다"는 최소 구현을 넘어서는 **defense-in-depth 확장**이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`,
    `masked-reject-callers.spec.ts`, `codebase/backend/tsconfig.build.json`(게이트 7-17)
  - 상세: 핵심 요구사항(re-run·execute 두 호출부에서 마커 재제출 거부)은 13개 파일 중
    `reject-masked-resubmission.ts`/`.spec.ts` + 두 호출부 교체 + `sanitize-error-message.ts`
    export 승격만으로 이미 완결된다. repo-guard 는 "미래의 제3 호출부가 이 규칙을 우회하지
    않도록" CI 타임에 강제하는 별도의 방어층으로, 요청된 기능 자체가 요구하는 것은 아니다.
    다만 이 확장이 **독자적으로 발의된 기능 추가가 아니라**, 이 PR 자신의 mandatory
    /ai-review 사이클(`01_38_26` WARNING1 — "불변식이 주석으로만 강제된다")에 대한 직접
    fix 로 도입됐고, CLAUDE.md 가 "구현 완료 후 review 의 Critical/Warning fix 는 같은 턴의
    강제 의무" 로 명문화하고 있어 절차상 스코프 이탈로 보기는 어렵다. 다만 그 결과로 가드
    자신이 5라운드에 걸쳐 4개의 우회 형태(named-only → +namespace → +require → +동적
    import/bracket/require+rename)를 반복 노출하며 정규식→AST 전면 재설계까지 갔고, 그
    과정에서 `tsconfig.build.json` 까지 두 번 편집됐다 — 원 요청("서버가 마커 재제출을
    거부한다") 대비 코드 볼륨의 상당 부분이 이 가드 자체의 자기 결함을 좇는 데 쓰였다.
  - 제안: 조치 불요(이미 CRITICAL 0 / WARNING 0 으로 수렴, 프로젝트 표준 fix-loop 범위 안).
    다만 향후 유사 패턴에서는 "정적 스캔 가드가 스스로 검증 대상"이 될 수 있다는 점을
    설계 초기에 고려해, 처음부터 AST 파서를 쓸지 판단하면 반복 라운드를 줄일 수 있다는
    점만 참고로 남긴다.

- **[INFO]** 커밋 `50f799efd`(developer 턴)가 `spec/5-system/14-external-interaction-api.md`
  표 행을 직접 편집 — CLAUDE.md 상 developer 의 `spec/` read-only 원칙 위반이었으나, 이미
  같은 diff 안에서 자체적으로 발견·기록·정규화 완료됨
  - 위치: `plan/complete/spec-update-masked-reject-framing.md` "⚠️ 절차 위반을 먼저 적는다
    (W3)" 절(게이트 21-35)
  - 상세: 작업자 스스로 `git log -S` 로 발견해 planner 턴 문서(`spec-update-masked-reject-framing.md`)
    로 사후 정규화했고, 내용 자체는 이미 확정된 캐비엇을 표 행에 동기화한 것이라 리뷰어들도
    "실질 리스크 낮음" 으로 판정했다(`01_38_26/RESOLUTION.md` WARNING2). 새로운 발견이
    아니라 이미 처분된 항목을 최종 스코프 리뷰에서 재확인한 것이다.
  - 제안: 조치 불요 — 이미 정규화 완료.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 이번 작업
  범위(W6, 마커 거부)와 무관한 별도 트래커 항목(W5, `Execution.inputData` 응답 의미 반전의
  외부 소비자 확인)이 같은 커밋(`3e96f4b44`)에서 함께 종결됨
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 게이트 353행 부근
    (`- [x] **`Execution.inputData` 응답 의미 반전의 외부 소비자 확인**`)
  - 상세: 이전 라운드(`01_15_47/scope.md`)가 이미 동일하게 지적하고 "저장소 소유자 직접
    답변으로 근거 명확, 코드 변경 없음, 그루밍 커밋 관행과 일치, 실질 리스크 낮음" 으로
    처분한 항목의 재확인이다. 새로운 스코프 이탈이 아니다.
  - 제안: 조치 불요(기존 처분 유지).

## review/** 산출물 143개 파일에 대한 판단

`review/code/2026/08/21/{00_03_57,00_39_27,01_15_47,01_38_26,02_04_38,02_29_01,02_49_22,03_14_16}/**`
(8개 라운드, 107개 파일)와 `review/consistency/2026/08/{20,21}/**`(4개 세션, 36개 파일)는
전부 이 PR 자체가 CLAUDE.md 의 상시 승인된 강제 워크플로(`/ai-review` + Critical/Warning fix,
`consistency-check --spec`/`--impl-prep`)를 거치며 생성한 표준 산출물이고, `review/` 는
gitignore 대상이 아니라 커밋되는 것이 이 저장소의 정책이다. 각 라운드가 다루는 주제도
전부 이번 마커 거부 기능(및 그 자신이 만든 repo-guard)에 한정돼 있어, 별도 관심사를
끌어들인 흔적이 없다.

## 요약

실질 애플리케이션 코드 변경은 13개 파일·+1107/-12줄로 "마스킹된 값의 재제출을 Manual 실행
경로 서버측에서 거부한다"는 단일 의도에 정확히 부합하며, 기존 판정 로직 재사용(`isMaskedMarker`
export 승격)과 직접 결합된 선존 버그 수정(`errors`→`details`)·파생 빌드 결함 수정
(`tsconfig.build.json`) 외에는 범위를 벗어나는 수정이 없다. 유일하게 "최소 요구사항을 넘는
확장"으로 볼 만한 것은 repo-guard 서브시스템이지만, 이는 이 PR 자신의 mandatory 리뷰 사이클이
낸 WARNING 에 대한 직접 fix 로 도입돼 프로젝트 표준 절차 안에 있다 — 다만 그 가드가 5라운드에
걸쳐 자기 결함을 반복 노출하며 diff 볼륨을 상당히 키운 점은 기록해 둔다. 143개의 `review/**`
산출물과 spec/plan 문서 변경은 이 프로젝트의 표준 SDD+TDD+AI-review 워크플로 부산물로 스코프
이탈이 아니며, 남은 두 건(절차 위반 자체 정규화, 무관 트래커 항목 동반 종결)은 모두 이전
라운드에서 이미 발견·처분됐음을 이번 라운드에서 독립 재검증했다. 신규로 지적할 CRITICAL/WARNING
급 스코프 이탈은 없다.

## 위험도

LOW
