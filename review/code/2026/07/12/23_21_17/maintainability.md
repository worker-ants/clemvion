# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `--filter "backend..."` 문자열이 두 스테이지에 하드코딩 중복
  - 위치: `codebase/backend/Dockerfile` — `deps` 스테이지 `RUN pnpm install --frozen-lockfile --filter "backend..."` (line 97) 및 신규 `prod-deps` 스테이지 `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."` (line 113)
  - 상세: 동일한 workspace 필터 문자열이 두 RUN 명령에 리터럴로 반복된다. 향후 대상 패키지를 바꾸거나(예: 다른 서비스용 Dockerfile 파생) 필터 표현식을 조정할 때 두 곳을 함께 갱신해야 하며, 누락 시 `deps`/`prod-deps` 스테이지가 서로 다른 패키지 집합을 설치하는 silent drift 가 발생할 수 있다.
  - 제안: 멀티스테이지 Dockerfile 특성상 완전한 제거는 어렵지만, `ARG PNPM_FILTER="backend..."` 로 상단에 선언 후 두 RUN 에서 `--filter "$PNPM_FILTER"` 로 참조하면 단일 진실 소스가 된다. 다만 현재 중복은 2회뿐이고 Dockerfile 관용구상 흔한 패턴이라 규모가 크지 않다.

- **[INFO]** Dockerfile 인라인 주석과 plan 완료 기록의 근거 서술이 상당 부분 중복
  - 위치: `codebase/backend/Dockerfile` lines 35-40 (prod-deps 스테이지 주석) vs `plan/in-progress/pnpm-migration-followups.md` line 158 (완료 기록)
  - 상세: "native(bcrypt/isolated-vm) 재빌드 필요 이유", "CI=true 필요 이유", "dist 는 node_modules 밖이라 보존" 등 거의 동일한 설명이 두 파일에 각각 산문으로 기술되어 있다. 대상 독자가 다르다는 점(Dockerfile 주석=코드 유지보수자용 "why", plan 기록=의사결정·검증 이력 감사용)에서 의도된 분리로 보이며 CLAUDE.md 의 "결정의 배경·근거" 저장 관행과도 부합하지만, 향후 이 스테이지의 접근 방식이 바뀌면(예: `pnpm deploy` 로 전환) 두 곳 모두 동기화해야 stale 주석/기록을 피할 수 있다는 점은 유의할 필요가 있다.
  - 제안: 별도 조치 불요. 현 상태 유지 가능하나, 이 영역을 다시 건드릴 때는 두 파일을 함께 갱신할 것.

## 요약

이번 변경은 Dockerfile 에 `prod-deps` 스테이지를 추가해 프로덕션 이미지에서 devDependencies 를 제거하는 최적화이며, 각 스테이지의 목적·제약(native 의존성 재빌드 필요성, `CI=true` 필요성, dist 보존 근거)을 설명하는 상세한 한국어 주석이 기존 파일의 주석 스타일과 일관되게 유지되고 있다. 이전 스테이지에 남아있던 "이미지 크기 최적화는 후속 과제" 라는 stale 코멘트도 이번 변경으로 제거되어 코드와 문서의 정합성이 개선되었다. Dockerfile 은 선언적 특성상 함수 길이·중첩 깊이·순환 복잡도 항목이 해당되지 않으며, 발견된 사항은 필터 문자열의 경미한 반복과 문서-코드 간 서술 중복 정도로 실질적 유지보수 리스크는 낮다. `plan/in-progress/pnpm-migration-followups.md` 변경은 기존 항목 포맷(`**완료(날짜, PR)**:` / `**조사(날짜, defer)**:`)을 그대로 따르는 문서 갱신으로 일관성 문제가 없다.

## 위험도

LOW
