# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `--filter "backend..."` 워크스페이스 필터 문자열이 두 스테이지에 리터럴로 중복
  - 위치: `codebase/backend/Dockerfile` — `deps` 스테이지 `RUN pnpm install --frozen-lockfile --filter "backend..."` 와 신규 `prod-deps` 스테이지 `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`
  - 상세: 동일한 workspace 필터 표현식이 두 `RUN` 인스트럭션에 그대로 반복된다. 대상 패키지를 바꾸거나(예: 다른 서비스용 파생 Dockerfile) 필터를 조정할 때 두 곳을 함께 갱신해야 하며, 하나만 고치면 `deps`/`prod-deps` 가 서로 다른 패키지 집합을 설치하는 silent drift 가능성이 있다.
  - 제안: `ARG PNPM_FILTER="backend..."` 를 상단에 선언하고 두 `RUN` 에서 `--filter "$PNPM_FILTER"` 로 참조하면 단일 진실 소스가 된다. 다만 중복이 2회뿐이고 멀티스테이지 Dockerfile 관용구상 흔한 패턴이라 규모는 작다 — 즉시 조치 필수는 아님.

- **[INFO]** Dockerfile 인라인 주석과 plan 완료 기록의 근거 서술이 상당 부분 중복
  - 위치: `codebase/backend/Dockerfile`(`prod-deps` 스테이지 주석, "native(bcrypt/isolated-vm) 재컴파일", "`CI=true` 필요 이유", "dist 는 node_modules 밖이라 보존" 등) vs `plan/in-progress/pnpm-migration-followups.md` §1 완료 기록(동일 사실을 재서술).
  - 상세: 같은 근거가 코드 주석과 plan 문서 두 곳에 산문으로 각각 기술된다. 독자층이 다르다는 점(Dockerfile 주석=코드 유지보수자용 "why", plan 기록=의사결정·검증 이력 감사용)에서 의도된 분리로 볼 수 있고 CLAUDE.md 의 "결정의 배경·근거는 spec/plan 에" 관행과도 부합하지만, 스테이지 접근 방식이 바뀌면(예: `pnpm deploy` 로 전환) 두 곳을 함께 갱신해야 stale 서술을 피할 수 있다.
  - 제안: 별도 조치 불요. 이 영역을 다시 손댈 때 두 파일을 함께 갱신할 것.

- **[INFO]** 이번 diff 로 커밋되는 `review/code/2026/07/12/23_21_17/*.md` 12개 리뷰어 산출물 간 서술 중복(구조적 요인, 조치 불필요)
  - 위치: `review/code/2026/07/12/23_21_17/{architecture,dependency,documentation,maintainability,performance,requirement,scope,security,side_effect,testing}.md`
  - 상세: 12개 관점별 리뷰 파일이 동일한 Dockerfile 사실(native addon 재컴파일 이유, `CI=true` 스코핑, `prod-deps` 스테이지 목적, "이번 diff 회귀 아님" 서술 등)을 관점별로 각각 독립 서술해 상당한 narrative 중복이 존재한다. 다만 이는 코드가 아니라 멀티에이전트 fan-out 리뷰 프로세스의 산출물(각 에이전트가 독립적으로 같은 diff 를 분석)이 갖는 본질적 특성이며, 전통적 "중복 코드" 개념(동일 로직의 반복 구현)과는 성격이 다르다. 각 파일은 정해진 템플릿(발견사항/요약/위험도)을 일관되게 따르고 있어 문서 자체의 구조적 일관성은 양호하다.
  - 제안: 조치 불요 — 리뷰 프로세스 설계상 의도된 산출물 구조.

- **[INFO]** Dockerfile 은 선언적 인스트럭션 나열 구조라 함수 길이·중첩 깊이·순환 복잡도 항목이 해당 없음
  - 위치: `codebase/backend/Dockerfile` 전체
  - 상세: 신규 `prod-deps` 스테이지 추가로 스테이지 수가 3개(`deps`/`builder`/`runner`) → 4개(`deps`/`builder`/`prod-deps`/`runner`)로 늘었으나 여전히 선형 체인(순환 없음)이고 각 스테이지가 install/compile/prune/assembly 단일 책임을 유지해 가독성 저하가 없다. `CI=true` 를 `ENV` 전역 선언 대신 해당 `RUN` 에만 스코프한 것도 경계 설정이 명확하다.
  - 제안: 없음(유지).

- **[INFO]** `plan/in-progress/pnpm-migration-followups.md` 변경은 기존 항목 포맷과 일관
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §1(완료 기록), §2(조사 기록)
  - 상세: `**완료(날짜, PR)**:` / `**조사(날짜, defer)**:` 포맷이 문서 내 기존 규약을 그대로 따르고, frontmatter(`worktree`/`owner`) 갱신도 `ensure-worktree.sh` 표준 관행과 일치한다. 네이밍·서술 스타일 모두 파일 내 다른 섹션과 일관됨.
  - 제안: 없음.

## 요약

이번 diff 의 실질적 "코드" 변경은 `codebase/backend/Dockerfile`(신규 `prod-deps` 스테이지)과 `plan/in-progress/pnpm-migration-followups.md`(완료·조사 기록) 두 파일뿐이며, 나머지는 직전 라운드(23_21_17)의 리뷰 산출물(markdown 리포트·JSON 상태 파일)이 새 파일로 커밋되는 것이다. Dockerfile 은 선형 4단계 빌드 체인을 유지하며 각 스테이지가 단일 책임을 가져 가독성·복잡도 문제가 없고, 인라인 주석도 WHY 중심으로 상세·정확하다. 유일한 경미한 지적은 `--filter "backend..."` 문자열의 2회 리터럴 반복(silent drift 가능성, ARG 화로 완화 가능하나 규모상 필수 아님)과 Dockerfile 주석·plan 기록 간 근거 서술 중복(의도된 분리로 판단)이다. 신규로 추가되는 리뷰 산출물 파일들은 코드가 아니므로 함수 길이·중첩·매직 넘버 등 전통적 유지보수성 기준이 적용되지 않으며, 템플릿 일관성도 양호하다. 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
