# 문서화(Documentation) 코드 리뷰

대상: `eia-error-code-unify` — 두 Manual 엔드포인트(`POST /workflows/:id/execute`·`POST /workflows/:id/save`
는 이미 `INVALID_TRIGGER_PARAMETERS`, `POST /executions/:id/re-run` 만 `INVALID_INPUT`)의
최상위 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일한 변경.

## 검증 방법

프롬프트에 실린 unified diff 21개 파일 전부를 확인하고, 프롬프트 크기 제한으로 절단된 파일
(1/3/4/5/7/16~21)은 `Read`/`Bash`(grep, sed)로 저장소 원본을 직접 열어 대조했다. 특히:
- 코드·spec·plan 전역 `grep -rn 'INVALID_INPUT' codebase spec` 재실행 — plan 이 주장한
  "잔존 5건, 전부 이력 기록" 을 실측 재확인(일치).
- `error-codes.md` 의 §4→§4.1/§4.2 분리 후 앵커(`#4-내부-전용-분류-코드-정규화-후-발행`)가
  기존 인입 참조(`webhook.md:313`, `error-handling.md:109`)에서 깨지지 않는지 확인(H2 텍스트
  불변이라 앵커 유지, 문제 없음).
- `reject-masked-resubmission.ts` 의 `MAX_REDACT_DEPTH`/`hasMaskedLeaf`, CI 가드
  `masked-reject-callers-guard.ts` 등 spec 신규 인용 심볼이 실제 코드에 존재하는지 대조(일치).
- `git log`/`git diff 7b0e65aa8..HEAD --stat -- CHANGELOG.md` 로 이 브랜치가 `CHANGELOG.md` 를
  건드렸는지 확인.

전체적으로 코드·주석·spec 6파일·유저 가이드 mdx 2파일·테스트 파일의 상호 정합성은 **매우
정확했다** — 인용한 파일·라인·grep 결과 중 불일치를 찾지 못했다. 아래 두 건만 실질적으로
남는 문서화 갭이다.

---

## 발견사항

- **[WARNING]** 선언된 **breaking API 변경**인데 `CHANGELOG.md` 에 항목이 없다
  - 위치: `CHANGELOG.md` (이번 PR 의 diff 목록 21개 파일에 포함되지 않음 — 변경 부재 자체가 발견사항)
  - 상세: 이 변경의 커밋(`c9a78d04f`)은 `feat(api)!:` 접두(Conventional Commits 의 breaking
    표기) + 본문에 명시적으로 `BREAKING CHANGE: POST /executions/:id/re-run 의 inputOverride
    검증 실패 봉투가 INVALID_INPUT → INVALID_TRIGGER_PARAMETERS 로 바뀐다` 를 적었고,
    plan 문서(`plan/in-progress/eia-error-code-unify.md`) 자체도 "breaking: 기존 re-run
    클라이언트가 보던 `INVALID_INPUT` 이 사라진다" 라고 명시한다. 그런데 이 저장소의
    `CHANGELOG.md` 는 정확히 이런 breaking 변경을 위해 **`## Unreleased — <제목>` 섹션을 PR 마다
    추가**하는 관행이 확립돼 있다 — `git log --oneline -3 -- CHANGELOG.md` 로 확인한 최근 이력
    (`4287cdd5b`·`b677564e0`·`89a816ab9`)이 전부 이 패턴이고, 현재 파일 최상단
    (`CHANGELOG.md:3`)은 **같은 기능 영역(마커/re-run 관련)의 직전 breaking 변경**(PR #1189,
    마커 재제출 서버 거부)이 남긴 항목이다. 즉 바로 위에 형제 항목이 있는데 이번 변경만
    빠졌다. `git diff 7b0e65aa8..HEAD --stat -- CHANGELOG.md` 로 확인한 결과 이 브랜치의 3개
    커밋 중 `CHANGELOG.md` 를 건드린 커밋이 없다.
  - 영향: re-run 을 UI 밖에서 직접 호출하는 기존 클라이언트가 있다면(§5 신규 행 자신이
    "제3자 분기 가능성을 코드로 배제할 수 없다" 고 명시한 바로 그 위험) `error.code` 값이
    조용히 바뀐다. CHANGELOG 항목이 없으면 이 변경을 추적할 유일한 표면적 통로가 git 커밋
    본문과 `spec/conventions/error-codes.md §5` 표뿐이 되어, 릴리스 노트/외부 공지 작성자가
    이 breaking 변경을 놓치기 쉽다.
  - 제안: `CHANGELOG.md` 최상단에 이번 변경을 위한 `## Unreleased — ...` 섹션을 추가하고,
    breaking 내용(재발행되는 코드 값, 영향받는 엔드포인트, 하위 호환 없음, §5 신규 행 링크)을
    커밋 본문 수준으로 요약해 남길 것.

- **[WARNING]** `spec/conventions/error-codes.md` §5 Rename 이력 표의 신규 행 "PR" 컬럼이
  플레이스홀더 `#TBD_PR` 그대로 커밋돼 있다
  - 위치: `spec/conventions/error-codes.md:145`
  - 상세: 같은 표의 기존 3행은 실제 참조 가능한 값(`PR4b`, `#566`, `#566`)을 쓰는데 신규 행만
    `#TBD_PR` 이다. plan 자체가 이를 인지하고 있다("§5 신규 행 PR 컬럼은 이 작업의 PR 번호를
    쓴다 — 실측 근거로 인용한 커밋 `7b0e65aa8` 을 옮겨 적지 않는다", SUMMARY 권장조치 #7)와
    naming_collision 리뷰 INFO #8 이 동일 항목을 이미 지적했으므로 **알려진, 추적 중인 갭**이지만,
    커밋 시점(`c9a78d04f`)에도 아직 미해결 상태로 코드베이스에 들어와 있다. `error-codes.md`
    는 rename 이력의 **단일 진실(SoT)** 문서이므로, 이 PR 번호가 채워지지 않은 채 머지되면
    "이 rename 이 어느 PR/커밋에서 일어났는가" 를 추적할 수단이 영구히 비게 된다(`#TBD_PR`
    은 실제 GitHub PR 번호로 링크 리졸브되지 않는 죽은 참조로 남는다).
  - 제안: 이 작업의 실제 PR 번호가 확정되는 즉시(머지 직전) `#TBD_PR` 을 실제 번호로
    치환. push 전 최종 확인 체크리스트 항목으로 명시해 두는 것을 권장(plan 의 "TEST WORKFLOW"
    또는 "/ai-review" 항목 완료 시점에 함께 확인).

---

## 검증 완료 항목 (문제 없음 — 정확도가 높았던 부분)

- **주석 정확성**: `executions.service.ts:506-510` 의 신규 주석("자매 호출부와 같은 코드다…
  2026-08-22 이전엔 이 자리만 `INVALID_INPUT` 이었다… rename 근거는 `error-codes.md §5`")이
  실제 코드·spec 상태와 정확히 일치. 오래된 주석 잔존 없음.
- **API 문서(Swagger)**: `executions.controller.ts:274` `@ApiBadRequestResponse` description 이
  코드 값 변경과 함께 갱신됨. 같은 파일에 `INVALID_INPUT`/re-run 관련 다른 Swagger 서술 잔존
  없음(grep 확인).
- **테스트-문서 정합**: `executions-rerun.service.spec.ts:330,422` 의 테스트 제목·단언이 코드
  변경과 동기화됨. 잔존 `INVALID_INPUT` 참조 0건.
- **유저 가이드(mdx, KO/EN)**: `triggers.mdx:33`·`triggers.en.mdx:22` 갱신. 이 갱신은 부수적으로
  **선존 오류**(주 실행 경로는 원래도 `INVALID_TRIGGER_PARAMETERS` 였는데 가이드는
  `INVALID_INPUT` 이라 적고 있었음)를 정정한다 — plan 이 이를 "우연히 맞아진 것이 아니라
  정정" 으로 명시 처리한 점도 정확.
- **spec 6파일 동반 개정**: `1-manual-trigger.md §6`(코드 표 + wrapper 함수명·CI 가드 신규
  단락), `13-replay-rerun.md §8.1`(코드 값 + `RERUN_` prefix 미사용 각주 신설)·§10.2,
  `3-error-handling.md`(카탈로그 행 교체 + 반대 방향 Rationale 을 지우지 않고 "무엇이
  뒤집혔는지" 콜아웃으로 개정 + `details[]` 노트), `12-webhook.md:313`(세 경로 공용 서술로
  교정), `14-external-interaction-api.md §R17`(볼드 통일 + wrapper 구현 위치 신규 콜아웃),
  `error-codes.md`(§4→§4.1/§4.2 분리 + §5 신규 행) — 전부 실제 코드·다른 spec 문서와 대조해
  불일치 없음. `§4` 분리는 consistency 리뷰(WARNING #2)가 "단순 append 금지" 로 지적한 것을
  실제로 반영한 결과이며, 표 scope 선언(§4 상단 "Code 노드 핸들러 내부"/"노드
  `output.error.code`")과 신규 trigger-parameter 계열(§4.2, 목적지 `details[].code`) 간
  스코프 충돌이 해소됨을 확인.
- **frontmatter `code:` 갱신**: `1-manual-trigger.md`·`14-external-interaction-api.md` 에 추가된
  `reject-masked-resubmission.ts`·`workflows.controller.ts` 경로가 실제 파일과 일치.
- **README**: 이 변경과 관련해 갱신이 필요한 README 는 발견되지 않음(`error.code` 값을 언급하는
  README 없음).
- **예제 코드**: 값 rename 범위라 신규 사용법 예제는 불필요 — 해당 없음.

---

## 요약

코드 3파일(controller/service/spec) + 유저 가이드 mdx 2파일 + spec 6파일 + plan 2파일의 문서
정합성은 이례적으로 높은 정확도로 관리됐다 — 모든 인용(파일·라인·grep 결과·앵커·심볼명)이
저장소 실측과 일치했고, §4 표 scope 충돌 같은 구조적 위험까지 spec 편집 단계에서 실제로
해소했다. 다만 이 변경이 커밋 메시지 자체가 선언한 **breaking API 변경**임에도
`CHANGELOG.md`(이 저장소가 바로 이런 변경을 위해 PR 마다 `## Unreleased` 섹션을 쌓아 온
활성 관행)에 항목이 빠져 있고, `error-codes.md §5` 신규 행의 "PR" 컬럼도 `#TBD_PR` 플레이스홀더
그대로 커밋돼 있다. 둘 다 머지 전에 반드시 채워야 문서 추적선이 완결된다.

## 위험도

MEDIUM
