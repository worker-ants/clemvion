# 정식 규약 준수 검토 — `trigger-workflow-ref-canary` (--impl-prep)

target: `plan/in-progress/trigger-workflow-ref-canary.md`
검토 모드: `--impl-prep` (구현 착수 전)

## 발견사항

### [CRITICAL] §자기-반증형 소정정 조건 1 미충족 — 대상 문장은 developer 가 아니라 project-planner 가 썼다

- **target 위치**: plan §T-4 "spec 문장 정정 — `2-trigger-list.md §3`", 다섯 조건 표의 1행
  (`| 1. developer 자신이 그 문서에 썼다 | ✅ #1304 (git blame 으로 확인 가능) |`)
- **위반 규약**: `CLAUDE.md` §자기-반증형 소정정 — `developer` 가 `spec/` 을 고칠 수 있는 유일한 경우, **조건 1**
  ("대상 문장을 **developer 자신이 그 문서에 썼다**")
- **상세**: 실측 결과 조건 1 이 거짓이다.
  - `git blame -L 178,185 spec/2-navigation/2-trigger-list.md` → 대상 3줄 전부 commit
    `dc77317cd4`(#1304, `docs(spec): §5.4 가 요구한 키-생략 사유를 nav-spec 으로 …`) 소속.
  - 그러나 그 커밋을 만든 plan 자체가 남아 있다: `plan/complete/spec-draft-schedule-trigger-ref-nav.md`
    의 frontmatter 는 `owner: planner`, `worktree: spec-schedule-dto-nav-6c2f18` 다.
  - 같은 커밋의 diff 에는 `review/consistency/2026/09/10/11_13_14/{convention_compliance,cross_spec,
    naming_collision,plan_coherence,rationale_continuity}.md` 가 함께 들어 있다 — 이는
    `project-planner` 의 `spec/` 쓰기 직전 의무 게이트인 **`--spec` 모드 표준 checker 세트**이지,
    developer 의 `--impl-done` 사후 게이트가 아니다. 커밋 본문도 "codebase/ 변경 0건이라
    `/ai-review` 와 두 타입체크 ratchet 은 이 축에 대상이 없다"고 스스로 밝혀, `codebase/**` 를
    건드리지 않는 순수 spec 세션(=planner 턴)이었음을 재확인한다.
  - 즉 `git blame` 이 보여주는 것은 "이 git 계정(`worker-ants`, 이 저장소의 유일한 git identity)이
    커밋했다"는 사실뿐이고, 조건 1 이 실제로 요구하는 것은 "**developer 역할**이 썼다"는 것이다.
    이 저장소에서 역할은 git 계정이 아니라 plan frontmatter `owner:`/worktree 세션으로 구분되며,
    그 SoT 가 명시적으로 `planner` 라고 말하고 있다.
  - `CLAUDE.md` 의 예외 도입 근거 문단은 정확히 이 오용을 경계한다: *"조건 1~5 가 이 예외를
    '실측했으니 고쳤다' 라는 만능 통행증으로 넓히는 것을 막는다."* 여기서는 project-planner 가
    정상 절차로 남긴 문장을 developer 가 (사후 게이트만으로) 직접 고치는 형태가 되어, 그 문장을
    쓴 적도 없는 사람에게 소정정 권한을 부여하는 셈이다 — 예외가 지키려는 "반증할 수 있는 유일한
    사람에게만 정정권을 준다"는 취지와 정반대다.
- **제안**: T-4 를 §자기-반증형 소정정 경로로 진행하지 않는다. `CLAUDE.md` 의 일반 규칙
  ("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")을 따라, `spec/2-navigation/
  2-trigger-list.md §3` 문장 정정은 **project-planner 턴**(`--spec` 게이트)으로 넘긴다. 정정 문안
  자체(취소선 + 실측 병기)는 plan 이 이미 옳게 설계했으므로 그대로 planner 턴에 전달하면 된다.
  developer 턴은 T-1~T-3(코드)만 착지시키고, plan 의 `spec_impact`/게이트 문구에서 "`--impl-done`
  을 그 spec 파일이 포함되는 scope 로 돌린다"는 대체 조항을 제거해야 한다(그 조항 자체가 조건
  1~5 전부 충족을 전제로 하는데 지금 그렇지 않다).

### [WARNING] PROJECT.md 의 e2e 헬퍼 배치 규칙이 실제 jest 구조와 어긋나게 읽힌다 — plan 은 옳게 피해 갔지만 근거가 문서화돼 있지 않다

- **target 위치**: plan §T-1 "헬퍼 — `shared/testing/trigger-workflow-ref.ts`" (배치 선택 자체는 문제
  없음 — 아래는 근거 문서화 공백에 대한 지적)
- **관련 규약**: `PROJECT.md` §e2e 테스트 작성 가이드 §파일 위치·명명 — *"신규 헬퍼:
  `codebase/backend/test/helpers/<name>.ts`"*
- **상세**: `PROJECT.md` 문면만 읽으면 신규 e2e 전용 헬퍼는 `test/helpers/` 로 가야 하는 것처럼
  보인다. plan 의 T-1 은 자매 `schedule-trigger-ref.ts` 와의 "성격 차이"만 논하고, 왜
  `shared/testing/` 이 맞는 자리인지 실제 근거는 대지 않는다. 실측하면 다음과 같다.
  - `codebase/backend/jest.config.ts` (unit) 는 `rootDir: 'src'` — `test/` 하위는 애초에 스캔
    대상이 아니다.
  - `codebase/backend/test/jest-e2e.json` 은 `testRegex: '.e2e-spec.ts$'` 만 잡는다 — 평범한
    `*.spec.ts` (T-2 가 만들 self-spec) 는 이 정규식에 안 걸린다.
  - 즉 `test/helpers/trigger-workflow-ref.ts` + `test/helpers/trigger-workflow-ref.spec.ts` 로
    두면, **T-2 self-spec 은 어느 jest 설정으로도 실행되지 않는다** — 존재는 하지만 영구히 돌지
    않는 죽은 테스트가 된다(§헬퍼 자신의 스펙이 있어야 하는 이유가 무르게 바뀐 헬퍼를 잡기
    위함인데, 그 self-spec 자체가 안 돌면 T-2 의 존재 이유가 통째로 무효화된다). 반대로
    `src/shared/testing/**` 는 unit jest 의 `rootDir='src'` 안에 있어 self-spec 이 실제로 돈다 —
    `schedule-trigger-ref.spec.ts`/`response-contract.spec.ts` 등 기존 4개가 전부 이 자리에서
    실행되는 이유가 바로 이것이다(부수적으로 `tsconfig.build.json` 이 `src/shared/testing/**`
    를 devDependency 격리 목적으로 통째로 exclude 하므로 production 빌드 오염도 없다).
  - 결론: **plan 의 배치 선택(`shared/testing/`)은 실제로 옳다.** 다만 그 근거(self-spec
    discoverability)가 plan 에도 `PROJECT.md` 에도 적혀 있지 않아, `PROJECT.md` 를 문면 그대로
    따르는 다음 사람은 `test/helpers/` 를 골라 조용히 죽은 self-spec 을 만들 위험이 있다.
- **제안**: (a) 이번 plan 은 그대로 진행하되, T-1 헬퍼 docstring 에 "왜 `test/helpers/` 가 아니라
  `shared/testing/` 인가"를 한 줄 남긴다(위 rootDir 근거). (b) 후속 project-planner 턴에서
  `PROJECT.md` §e2e 테스트 작성 가이드 §파일 위치·명명에 "self-spec 을 동반하는 assertion 헬퍼는
  `test/helpers/` 가 아니라 `src/shared/testing/` 을 쓴다(unit jest `rootDir='src'` 라 `test/` 는
  self-spec 을 못 돈다)"를 한 줄 추가하는 것을 검토 권고 — 규약 문서와 실제 강제 메커니즘이
  갈리는 자리이므로 규약 쪽을 갱신하는 것이 맞다.

### [INFO] e2e 파일 신설·배선 판단은 실측으로 확인 — 위반 없음 (참고용 기록)

- **target 위치**: plan §"② '양성 4 + 음성 1 을 기존 파일에 얹는다'" 및 §T-3
- **상세**: 아래 두 주장을 실측으로 재확인했고 둘 다 맞다.
  1. **새 파일 신설 자체**는 `PROJECT.md` §금지·주의 의 *"`app.e2e-spec.ts` 무한 누적 금지 —
     신규 시나리오는 영역별 파일로 분할"* 과 부합한다. 실제로 `secret-store-like-prefix.e2e-spec.ts`
     `terminal-duration-sql.e2e-spec.ts` `alerts-threshold-wire-type.e2e-spec.ts` 등 단일 축만
     무는 좁은 스코프 e2e 파일 선례가 이미 다수 존재해 `trigger-workflow-ref.e2e-spec.ts` 명명·
     스코프가 이질적이지 않다.
  2. **배선 불필요 주장도 사실이다.** `test/jest-e2e.json` 은 `rootDir` 가 config 파일 위치(=`test/`)
     이고 `testRegex` glob discovery 라 신규 파일이 자동으로 잡힌다. `.github/workflows/e2e.yml`
     은 `paths-ignore`(deny-list: `.claude/**`·`.github/**`·`spec/**`·`plan/**`·`review/**`·`*.md`)
     방식이라 `codebase/backend/test/**` 신규 파일이 트리거를 막지 않는다. `docker-compose.e2e.yml`
     의 `backend-e2e-runner` 는 호스트 `./codebase/backend` 전체를 볼륨 마운트하고
     `pnpm run test:e2e`(= `jest --config ./test/jest-e2e.json`, 파일 인자 없음)를 실행하므로
     Dockerfile·compose·Makefile 어느 것도 갱신할 필요가 없다.
  - 다만 plan 은 `afterAll`/`db.end()` 같은 기존 e2e 파일 전원이 따르는 teardown 보일러플레이트를
    설계 표에 명시하지 않았다 — 코드 작성 시점에는 `schedule-trigger.e2e-spec.ts`/
    `chat-channel-trigger-create.e2e-spec.ts` 와 같은 `beforeAll(connect)`/`afterAll(db.end())`
    패턴을 그대로 따라야 한다(row 자체의 삭제는 불필요 — ephemeral schema 가 자동 truncate).
    이는 설계 문서의 생략일 뿐 위반은 아니라 INFO 로만 남긴다.

## 확인했으나 위반 없음 (참고)

- **뮤테이션 복원 규율**: plan이 "뮤테이션 원복은 `cp` + 절대경로로 한다(`git checkout` 금지)"를
  명시 — 저장소 관례와 정확히 일치.
- **예측/실측 분리**: "완료의 기계적 증거" 표가 뮤턴트 전/후 기대값(예측)과 `(미측정)`(실측) 두
  칸으로 분리돼 있어, 사후에 "예상 GREEN 을 미리 적어 둔 것도 증거가 된다"는 관례를 따른다.
- **plan frontmatter**: `worktree`/`started`/`owner` 세 필수 필드 모두 존재. `spec_impact` 가
  YAML 리스트(`- spec/2-navigation/2-trigger-list.md`)로, bare string/빈 배열 위반 없음.
- **review 인용 형식**: `review-citations.md` §3 은 `plan/**` 문서를 애초에 적용 대상에서 제외하지만,
  plan 이 인용한 `review/code/2026/09/06/01_13_50`(W4·W6) 은 이미 전체 경로+날짜 형식이라
  `codebase/**` 기준으로도 문제없다. 인용 내용(W4="문서한 보장이 구현보다 넓었다", W6="단언
  헬퍼 자신에게 테스트가 없었다")도 해당 파일에서 실제로 확인됨 — 근거 날조 없음.
- **`TriggerWorkflowRefDto` 명명**: plan 이 참조하는 키셋(`['id','name']`)과 DTO 이름은
  `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 기존 선언과
  정확히 일치 — 신규 DTO 를 만드는 것이 아니라 기존 것을 정확히 인용.

## 요약

핵심 결함은 하나다: plan §T-4 가 `CLAUDE.md` §자기-반증형 소정정을 적용할 근거로 든 조건 1
("developer 자신이 그 문서에 썼다")이 **실측으로 반증된다** — 대상 문장은 project-planner 가
정상 `--spec` 절차(PR #1304, `owner: planner`)로 남긴 것이지 developer 의 예고 문장이 아니다.
이 상태로 진행하면 developer 가 project-planner 의 서술을 사후 게이트만으로 직접 고치는
결과가 되어, 이 예외 조항이 명시적으로 막으려는 "만능 통행증화"를 그대로 재현한다 — 반드시
project-planner 턴으로 전환해야 한다. 그 외 e2e 파일 신설·배선 판단, 헬퍼의 self-spec 패턴,
뮤테이션 복원 규율, plan frontmatter, review 인용 형식은 모두 실측으로 확인했고 위반이 없다 —
특히 헬퍼 배치(`shared/testing/`)는 얼핏 `PROJECT.md` 문면과 어긋나 보이지만 unit jest 의
`rootDir='src'` 제약상 실제로는 유일하게 올바른 선택이며, 이 사실이 `PROJECT.md` 에 적혀 있지
않다는 점만 별도 WARNING 으로 남긴다.

## 위험도

HIGH — CRITICAL 발견 1건(§자기-반증형 소정정 조건 1 오판정)이 구현 착수 전 단계에서 나왔다.
코드 자체(T-1~T-3)에는 구조적 결함이 없으므로 착수를 전면 차단할 사안은 아니지만, T-4(spec
문장 정정 경로)는 반드시 project-planner 턴으로 재설계한 뒤 진행해야 한다.
