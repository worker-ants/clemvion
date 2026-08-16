# 변경 범위(Scope) Review — 7라운드 (코드 동결 후, push 직전 최종 게이트)

## 방법론 노트

프롬프트가 예산 문제로 다수 파일의 diff 를 생략했다(`... 원본 파일 참조 ...`). 생략된 파일과
스코프 판정에 필요한 근거는 저장소에서 직접 확인했다:
`git diff origin/main...HEAD --stat`(158개 파일) 로 전체 변경 파일 목록을 뽑아 프롬프트가
나열한 164개 항목과 대조했고(차이 6건은 `git mv` 로 인한 rename — `plan/in-progress/*.md` →
`plan/complete/*.md`, `--name-only` 표시 방식 차이일 뿐 실제 diff 는 동일), 개별 파일은
`git diff origin/main...HEAD -- <path>` 로 직접 열었다. 최신 커밋(`9f870fb00`, "6라운드")의
diff 도 별도로 확인했다.

이 changeset 은 이미 **6라운드**의 `/ai-review`(각 라운드 전담 scope reviewer 포함, `RESOLUTION.md`
6개)를 거쳤다. scope 관점 지적은 1라운드(`17_12_34`) 1건뿐이었고(plan chore 번들), 이후
라운드들이 반복 재검증했지만 새 스코프 이탈은 나오지 않았다. 아래는 그 이력을 전제로 한
**독립 재검증**이며, 이전 라운드와 같은 결론에 도달하더라도 근거는 직접 실측했다.

## 발견사항

없음 (CRITICAL/WARNING 급 스코프 이탈 0건). 아래는 참고용 INFO다.

- **[INFO]** plan 위생 chore(`fafb57e46`, 6개 EIA plan `in-progress/` → `complete/` 이동 +
  인입 링크 8곳 정정)가 핵심 작업과 별도 관심사로 같은 브랜치에 번들돼 있다 — 단, 프로젝트
  규약이 명시적으로 요구하는 형태이므로 스코프 위반이 아니다
  - 위치: 커밋 `fafb57e46`. 파생: `plan/in-progress/backend-lint-gate-broken-on-main.md:787`,
    `plan/in-progress/retry-turn-terminal-guard.md:308,372`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106`,
    `plan/in-progress/ws-event-types-extract.md:293` — 전부 `./eia-terminal-emit-facade.md` 류
    상대링크를 `../complete/eia-terminal-emit-facade.md` 로 정정하는 1줄씩의 기계적 수정.
  - 상세: 실측 확인 —
    [`.claude/docs/plan-lifecycle.md §3`](../../../../../../.claude/docs/plan-lifecycle.md) 이
    *"이동은 마지막 작업 PR 안에서 … 별 commit 으로. plan 이동만 담은 별 PR 분리 금지"* 를
    명문화하고, *"가리키던 plan 을 `complete/` 로 옮기면 이 값도 같은 commit 에서 갱신한다"*
    (§4, `pending_plans` 캐비엇)도 규정한다. 실제 구조는 정확히 그 형태(별도 commit, 별도
    PR 아님, 인입 참조 8곳 동시 갱신)를 따른다. 이 항목은 1라운드에서 WARNING 으로 지적됐고
    developer 가 규약 인용으로 반박해 무조치 처리했다 — 판단은 문서 근거와 정확히 일치한다.
  - 제안: 조치 불필요. 이미 5차례 걸쳐 같은 결론에 도달했고 이번 라운드도 동일 근거를
    재확인했다.

- **[INFO]** `.claude/docs/plan-lifecycle.md` 에 `pending_plans` 표·재현법·caveat(30줄)가
  신설됨 — 핵심 서사(EIA 마스킹)와 직접 인과는 약하지만, 이번 PR 자신의 산출물이 근거다
  - 위치: `.claude/docs/plan-lifecycle.md:80-109`
  - 상세: 실측 — 신설된 `plan/in-progress/eia-internal-rest-error-masking.md` 자신의
    frontmatter 8번째 줄이 `pending_plans:` 키를 쓴다. 같은 세션의 `--impl-prep`
    consistency-check(`16_48_55` convention_compliance)가 이 키의 선언 방향을 지적했고,
    5라운드(`18_33_52`) RESOLUTION 이 `requirement`/`documentation` reviewer 간 수치
    불일치(17 vs 18, 4 vs 5)를 실측으로 정리하며 "세는 방법을 문서에 박았다"고 명시한다.
    즉 이 문서 변경은 임의 확장이 아니라 이번 PR 이 새로 쓰기 시작한 필드의 의미를 같은 PR
    에서 정의하고, 같은 PR 이 만든 리뷰 불일치에 답한 것이다. `pending_plans` 표 자체는
    "6개 plan 을 옮긴다"는 chore 범위를 한 단계 넘어 "plan 관행 문서화"로 미세하게
    확장된 지점이긴 하나, 근거 사슬이 이 PR 내부에서 닫힌다.
  - 제안: 조치 불필요.

- **[INFO]** `executions.service.ts` 의 `stripPrivateRelations` → `toResponseExecution`
  개명, `stop()`/`stopInternal()` 분리, `ResponseExecution`/`ResponseNodeExecution` 신규
  타입 도입은 표면적으로 리팩터이지만 마스킹 단일 관문을 강제하기 위한 최소 구조 변경이다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — diff hunk 는
    import 1줄, 상단 타입 선언부, `findById`/`getChain`/`stop`·`stopInternal`/`toExecutionDto`
    총 5개 지점에만 집중된다(`git diff --stat` 로 hunk 헤더 실측 — 무관한 메서드는 건드리지
    않음).
  - 상세: `as Execution` 무단 캐스트가 `redactStoredErrorForResponse` 의 `| null` 반환을
    지워 null-check 누락을 컴파일러가 놓치는 문제(1라운드 maintainability WARNING)를 고치기
    위해 도입된 타입이며, `stop()` 분리도 "반환 지점이 늘어도 마스킹 관문 하나만 지나게"
    하는 같은 목적이다. TOCTOU 원자 UPDATE 로직 자체는 이번 diff 로 변경되지 않는다
    (concurrency reviewer 가 별도 확인). 요청 범위(마스킹 적용) 밖의 기능 확장이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `codebase/**` 변경은 `executions` 모듈 + 신규 `shared/utils/redact-stored-error.*`
  로 완전히 한정된다 — frontend·다른 backend 모듈·CI·의존성 파일에 무관한 수정 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD --stat -- 'codebase/**'` 로 실측)
  - 상세: `codebase/**` 에서 `executions` 모듈과 `redact-stored-error.*` 를 제외한 나머지
    패턴에 diff 가 0건이다. `package.json`/`pnpm-lock.yaml`/`.github/**` 변경도 0건
    (json 변경은 전부 `review/consistency/**/_retry_state.json` 산출물). frontend 변경 없음.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 신규 파일(120여 개)은 스코프 이탈이
  아니라 이 저장소 표준 워크플로의 산출물
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49,17_56_15,18_14_50,18_33_52,18_58_22}/**`,
    `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55,17_35_13,18_20_34,18_33_59,18_58_29}/**`
  - 상세: `CLAUDE.md` 가 구현 완료 후 `/ai-review` + critical/warning fix 를 "상시 승인된
    강제 의무"로 규정하고, 각 라운드 산출물이 `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/` 에
    커밋되는 것이 정본 관행이다(`review/` 는 gitignore 대상 아님). 이 파일들은 요청 이상의
    변경이 아니라 요청된 워크플로 자체의 필수 산출물이다. 이번 라운드(`19_16_28`) 자신의
    출력 디렉토리는 아직 미커밋 상태(untracked)로, 이번 diff 범위 밖이다.
  - 제안: 조치 불필요.

- **[INFO]** spec(`5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·
  `4-nodes/1-logic/12-background.md`·`2-navigation/14-execution-history.md`·
  `conventions/secret-store.md`·`1-data-model.md`, 6곳) 및 `CHANGELOG.md`, DTO
  JSDoc/Swagger `description` 변경은 전부 코드 변경의 직접 파생이며 새 약속을 추가하지 않는다
  - 위치: 위 6개 spec 파일, `CHANGELOG.md` `## Unreleased`, `execution-response.dto.ts`
    3곳, `background-run-response.dto.ts` 1곳
  - 상세: `6-websocket-protocol.md` 의 `execution.snapshot` 행처럼 언뜻 무관해 보이는
    자매 문서 수정도 `execution.snapshot` 이 `findById` 를 재사용해 같은 마스킹 관문을
    상속한다는 인과가 명시돼 있다. `1-data-model.md` §2.14 는 최신 커밋(`9f870fb00`)에서
    "무조건문 → 열거"로 좁혀져 R17 과 일치한다(실측 확인). `spec-sync-external-interaction-api-gaps.md`
    의 체크박스 갱신도 이번 PR 자신이 등재한 정본 트래커 항목을 닫는 것이라 범위 내다.
  - 제안: 조치 불필요.

## 요약

이번 changeset(158개 파일, origin/main 대비)의 실질 코드 변경은 `executions` 모듈 4개 파일
+ 신규 leaf 유틸 `redact-stored-error.ts`(+각 `.spec.ts`)에 완전히 한정되며, 요청된 작업
("내부 REST/WS 읽기 경로 `Execution.error`/`NodeExecution.error` egress 마스킹")과 hunk
단위로 1:1 대응한다. 리팩터(타입 신설·함수 분리·개명)는 전부 그 목적을 안전하게 달성하기
위한 최소 구조 변경이고, frontend·CI·의존성 파일 변경은 0건이다. 문서 변경(spec 6곳·
CHANGELOG·DTO JSDoc·정본 트래커 체크박스)도 코드 변경의 직접 파생이다. 유일하게 핵심
서사와 인과가 약한 항목은 plan 위생 chore(6개 완료 plan 이동 + `pending_plans` 문서화)인데,
이는 1라운드부터 지속적으로 재검증됐고 프로젝트 규약(`plan-lifecycle.md §3`)과 이 PR 자신의
산출물(신규 plan 의 `pending_plans:` 키, 리뷰 불일치 정정)이 근거로 닫혀 있어 무관한 확장이라
보기 어렵다. `review/**` 대량 산출물도 이 저장소가 강제하는 리뷰 워크플로 자체의 결과물이다.
7라운드에 걸친 반복 검증에도 새로운 스코프 이탈은 발견되지 않았고, 발견의 성격도 1라운드
이후 계속 좁아졌다(동작·구조 → 검증 공백 → 문서 배치 → 수치/서술 정확성) — 이 changeset 은
push 직전 시점에 스코프 관점에서 안정적으로 수렴했다고 판단한다.

## 위험도

NONE
