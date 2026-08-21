# 변경 범위(Scope) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (03_14_16)

## 검토 방법

`git diff origin/main...HEAD --stat`(149 files, +14184/-25)와 `--stat -- codebase/`(12 files,
+1042/-11)를 대조하고, `git log origin/main..HEAD --oneline`(10 commits)으로 각 커밋이 무엇을
건드렸는지 실측했다. 프롬프트가 diff 를 생략한 파일(`reject-masked-resubmission.ts` 등)은
`Read`로 직접 열어 확인했다.

## 발견사항

- **[WARNING]** developer 턴 커밋이 `spec/` 을 직접 수정했다 (CLAUDE.md 권한 위반) — 단, 같은 PR
  안에서 자체 발견·사후 정규화까지 완료됨
  - 위치: 커밋 `50f799efd`(`fix(security): \`boolean\` 파라미터가 마커 가드를 통째로 우회했다`)가
    `spec/5-system/14-external-interaction-api.md` 표 행("서버 (재제출 API)" → "서버 (Manual 실행
    경로)")을 직접 편집. 위반 disclosure·근거는
    `plan/complete/spec-update-masked-reject-framing.md:21-35`("## ⚠️ 절차 위반을 먼저 적는다
    (W3)").
  - 상세: CLAUDE.md 는 `developer` 의 `spec/` 을 read-only 로 규정하고 spec 변경은
    `project-planner` 위임으로 못박는다. 그런데 `fix(security)` 로 레이블된 developer 커밋이
    표 행 하나를 직접 고쳤다 — 내용 자체(캐비엇과 표 행 동기화)는 틀리지 않았지만 **경로**가
    규약을 벗어났다. 이 문제는 이후 `git log -S` 로 스스로 발견돼
    `plan/complete/spec-update-masked-reject-framing.md`(planner 드래프트) + 커밋 `871d3fcb0`
    (`docs(spec): 거부 범위의 판정 기준을 '출처' 에서 '저작 주체' 로 정정`)로 사후 정규화됐다.
    남은 spec 표면(§6 검사 시점 "직후"→"전후", 자매 3곳의 "재제출 경로 한정"→"Manual 실행 경로
    한정" 서술)도 같은 planner 문서 범위 안에서 함께 정리됐다. 실질 콘텐츠 리스크는 낮지만,
    **권한 경계를 넘은 사실 자체**는 스코프 관점의 유효한 발견사항이라 등재한다 — 이미 이 PR
    안에서 절차대로 회수됐다는 점만 다르다.
  - 제안: 조치 불요(이미 정규화 완료, 재작업 대상 아님). 다음에 유사 리뷰-수정 루프를 돌 때
    "이 파일이 `spec/` 인가"를 커밋 전에 먼저 체크하는 습관만 남긴다.

- **[INFO]** 공유 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에서 이번
  작업(W6)과 무관한 별도 항목(W5, `Execution.inputData` 응답 의미 반전의 외부 소비자 확인)이
  같은 planner 커밋(`3e96f4b44`)에서 함께 종결됨
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (diff 게이트 353행 부근,
    `Execution.inputData` 항목)
  - 상세: 이전 라운드(`01_15_47/scope.md`)가 이미 같은 사실을 INFO 로 등재하고 "저장소가 그루밍
    커밋에서 여러 트래커 항목을 함께 닫는 패턴을 정책적으로 허용해 온 이력이 있다"(참고:
    MEMORY `project_spec_sync_grooming_2026_07_08`)는 근거로 조치 불요 판정했다. 이번 라운드에서
    재확인해도 근거·판정이 그대로 유효하다 — 종결 사유가 "저장소 소유자 직접 답변" 으로 명시돼
    있고 코드 변경을 수반하지 않는다.
  - 제안: 조치 불요. 새 리스크 아님, 이월 기록.

## 실질 코드 변경 범위 확인

`codebase/` 하위는 12개 파일(+1042/-11)로 좁게 유지된다 — 전부 backend, frontend 변경 없음:

- `execution-engine/types/trigger-parameter.types.ts` — `masked_value_resubmitted` reason/code
  enum 1행 + 매핑 1건. 유니온 타입이 한 줄에서 여러 줄로 바뀐 것은 값 추가로 인한 prettier
  자동 개행이지 무관한 포맷팅이 아니다.
- `execution-engine/utils/reject-masked-resubmission.ts`(신규) + `.spec.ts`(신규) — 이번 기능의
  핵심 구현. `Read` 로 전체(146줄)를 열어 확인 — raw→resolve 순서를 캡슐화하는 단일 함수와
  헬퍼 셋 외 다른 책임 없음. `isPlainRecord` 재구현 이슈(전전 라운드 WARNING)는 현재
  `import { isRecord } from './to-record'` 로 이미 해소되어 있음을 실코드로 확인.
- `executions/executions.service.ts` — import 교체 + 호출부 1곳 교체 + `errors`→`details` 봉투
  교정(§R17 표 캐비엇·CHANGELOG·RESOLUTION 이 "이 PR 이 만드는 새 코드가 그 배선을 거치지 않으면
  무의미해지는 선존 버그"로 근거를 남겨 직접 결합돼 있음 — 별개 무관 수정이 아님).
- `workflows/workflows.controller.ts` — import 교체 + 호출부 1곳 교체.
- `shared/utils/sanitize-error-message.ts` — 기존 private `isMaskedMarker`/`MASKED_MARKERS` 를
  `export`로 승격 + `Set`→`readonly string[]` 로 교체(직전 라운드가 "`Object.freeze(Set)` 는
  런타임 불변성을 주지 못한다"를 실측해 반증한 것을 반영한 재작업). 로직은 재제출 거부 판정기와
  egress 마스킹 판정기가 같은 SoT 를 공유하기 위함으로, 이번 기능이 요구하는 범위 안.
- `repo-guards/__tests__/masked-reject-callers-guard.ts`(신규) + `.spec.ts`(신규) — "Manual 실행
  경로는 반드시 wrapper 를 써야 한다"는 불변식을 코드로 강제. 새 아키텍처 패턴이 아니라 기존
  `eslint-unicorn-peer-guard.ts`(backend) · `typescript-toolchain-guard.ts`(frontend) 와 동일한
  "파서(순수 로직) + 소비 spec 분리" 컨벤션을 그대로 따른 것을 `git ls-tree origin/main` 으로
  확인 — over-engineering 이 아니라 선례를 재사용한 것.
- `workflows.controller.spec.ts` / `executions-rerun.service.spec.ts` /
  `resolve-trigger-parameters.spec.ts` — 신규 기능에 대한 캐너리 테스트 추가, 기존 테스트 수정
  없음(`resolve-trigger-parameters.spec.ts` 는 `masked_value_resubmitted` reason 1건을 형제 셋
  옆에 추가한 것뿐).

이 12개 파일 모두 "마스킹 마커 재제출을 Manual 실행 경로 서버측에서 거부한다"는 단일 의도에서
벗어나지 않는다. 불필요한 리팩토링·무관한 import 정리·사용하지 않는 import 추가는 발견되지
않았다.

## 나머지 137개 파일에 대한 판단

`review/code/**`(9라운드분)·`review/consistency/**`(4라운드분)·`spec/**`(7곳)·`plan/**`·
`CHANGELOG.md` 는 이 저장소의 SDD+TDD 워크플로 규약(`CLAUDE.md` 정보 저장 위치 표)상 각 라운드의
필수 산출물이자 이번 기능의 spec 동기화·리뷰 이력이다. 이 판단은 이전 라운드(`01_15_47/scope.md`)
가 이미 독립적으로 내렸고, 이번 라운드에서 `git diff --stat` 실측으로 재확인해도 그대로 유효하다
— spec 변경은 전부 `masked_value_resubmitted`/§R17 범위 서술·검사 시점 정정에 국한되고(7개 파일
diff 를 직접 대조), plan 문서는 이 작업의 진행 기록(및 위 두 INFO/WARNING)이다. 별도 관심사를
끌어들인 흔적은 없다.

## 요약

실질 애플리케이션 코드 변경은 backend 12개 파일·+1042/-11 로 "마스킹된 값의 재제출을 Manual
실행 경로 서버측에서 거부한다"는 단일 의도에 정확히 부합하며, frontend 는 전혀 건드리지 않았다.
불필요한 리팩토링·포맷팅 혼입·무관한 import·주석 정리는 발견되지 않았고, 신규 repo-guard 는
기존 컨벤션을 재사용한 것이라 기능 확장(over-engineering)이 아니다. 유일한 실질 발견사항은
developer 턴 커밋(`50f799efd`)이 `spec/` 파일을 직접 편집해 CLAUDE.md 의 권한 경계(spec/ 는
`project-planner` 전용)를 넘은 것인데, 이는 같은 PR 안에서 작업자 스스로 `git log -S` 로 발견해
planner 턴(`871d3fcb0` + `plan/complete/spec-update-masked-reject-framing.md`)으로 절차대로
회수·정규화까지 마친 상태다. 내용상 리스크는 없고 재작업이 필요하지도 않지만, 발생 사실 자체는
스코프 리뷰가 기록해 둘 가치가 있다. 그 외 137개 비-코드 파일(review 산출물·spec·plan)은 이
프로젝트가 명시적으로 요구하는 표준 워크플로 부산물이며 스코프 이탈이 아니다.

## 위험도

LOW
