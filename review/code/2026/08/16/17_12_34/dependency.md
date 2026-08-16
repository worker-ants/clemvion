# 의존성(Dependency) Review

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 확인 — 이번 changeset(54개 리뷰 대상 파일)에 `package.json` /
`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` 변경은 **0건**이다. 즉 외부 패키지 추가·제거·버전
변경이 전혀 없다. 리뷰 대상은 사실상 (a) 신규 backend 유틸 1개 + 그 소비 4곳(TS), (b) plan/spec/review
문서 다수다. 아래는 (a)에 한정해 8개 관점을 적용한 결과다.

## 발견사항

- **[INFO]** 신규 파일이지만 신규 "의존성"은 아니다 — 기존 leaf 모듈 재사용
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:4`
  - 상세: 신설된 `redactStoredErrorForResponse` 는 외부 패키지가 아니라 저장소에 이미 있는
    `./sanitize-error-message` 의 `deepRedactSecrets` 를 그대로 감싼다. 이 leaf 모듈 자체는
    `import` 문이 0개(순수 정규식 기반, `wc -l` 206줄)라 새 npm 패키지·새 순환 위험을 들여오지
    않는다. 소비처는 2곳(`background-runs.service.ts`, `executions.service.ts`) — grep 실측으로
    diff 와 일치함을 확인.
  - 제안: 조치 불필요. 오히려 파일 헤더 주석이 "왜 `sanitize-error-message` 하나만 import 하는지"
    (ES-module 순환 회피, #1175)를 명시해 둔 점이 내부 의존성 방향을 문서화하는 좋은 선례.

- **[INFO]** 내부 의존 관계(fan-in)가 4개 호출부로 수렴 — 파편화 방지 확인됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:40`,
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:21`
  - 상세: `Execution.error`/`NodeExecution.error` 를 노출하는 4개 반환 지점
    (`findById`/`getChain`/`stop`/`toExecutionDto`, `background-runs` body 노드)이 모두 같은
    `redactStoredErrorForResponse` 하나로 수렴한다 (`toResponseExecution` 관문 도입 포함). 동일
    마스킹 로직을 호출부마다 재구현하지 않아 "자매 중 하나만 마스킹" 재발 패턴을 구조적으로 막는다.
    이는 8번 관점(내부 의존 관계)에서 바람직한 방향.
  - 제안: 조치 불필요.

- **[INFO]** `toTerminalErrorPayload` 재사용을 의도적으로 회피 — 응답 계약 변경 방지
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` 상단 doc 주석
    ("왜 `toTerminalErrorPayload` 를 쓰지 않나")
  - 상세: 기존에 이미 있는 종결 emit 전용 마스킹 함수(`toTerminalErrorPayload`)를 그대로 재사용하지
    않고 새 유틸을 둔 이유가 명시돼 있다 — 그 함수는 wire 형태로 *정규화*까지 하므로 내부 응답에
    쓰면 계약이 바뀐다. "표준 라이브러리·기존 의존성으로 대체 가능한지"(5번 관점)를 저자가 이미
    스스로 검토하고 근거를 남겼다.
  - 제안: 조치 불필요.

- **[INFO]** `.claude/docs/plan-lifecycle.md` 의 `pending_plans` — plan 레벨 선언적 의존, 코드 레벨
  gate 없음(문서 자체가 명시)
  - 위치: `.claude/docs/plan-lifecycle.md:80-96`
  - 상세: plan 간 "먼저 닫혀야 하는" 의존 관계를 frontmatter `pending_plans` 로 표기하는 관행을
    문서화한 변경. 코드 의존성이 아니라 작업 관리 메타데이터이므로 이 리뷰 관점(패키지·라이선스·
    취약점)의 대상은 아니지만, 문서가 스스로 "가드 없음(선언적 cross-link 전용)"을 명시해 향후
    stale 참조 리스크를 인지하고 있다는 점만 기록해 둔다.
  - 제안: 조치 불필요(의존성 관점에서는 코드 변경 없음).

## 요약

이번 changeset 에 신규 외부 패키지/라이브러리 추가는 없다(`package.json`/lockfile diff 0). 유일한
코드 레벨 변경은 backend 내부에 신규 leaf 유틸 `redact-stored-error.ts` 를 추가하고 기존 정규식
기반 `sanitize-error-message.ts` 를 재사용해 4개 응답 표면(`findById`/`getChain`/`stop`/
`toExecutionDto`/`background-runs` body)의 `error` 컬럼 마스킹을 단일 관문으로 수렴시킨 것으로,
버전 고정·라이선스·취약점·번들 크기·기존 의존성과의 충돌 등 8개 점검 관점 어디에도 해당 사항이
없다. 순환 import 재유입 여부도 실측(leaf 모듈에 `import` 0개, 소비처 2곳만 grep 확인)으로
검증되어 내부 의존성 그래프에 새 리스크를 추가하지 않는다. 나머지 파일은 plan/spec/review 문서로
의존성 관점의 분석 대상이 아니다.

## 위험도

NONE
