# 아키텍처 리뷰

## 발견사항

- **[INFO]** 런타임 이미지에 빌드 아티팩트가 아닌 원본 소스 전체가 잔존
  - 위치: `codebase/backend/Dockerfile` — `deps` 스테이지 `COPY codebase/packages ./codebase/packages`(패키지 원본 소스 전체), `builder` 스테이지 `COPY codebase/backend ./codebase/backend`. `runner` 는 `COPY --from=prod-deps --chown=node:node /app ./` 로 `prod-deps`(= `builder` 상속) 전체를 그대로 옮긴다.
  - 상세: 이번 diff 로 신설된 `prod-deps` 스테이지는 `node_modules` 의 devDependencies 만 prune 할 뿐, `builder` 로부터 상속받은 `codebase/backend`·`codebase/packages/*` 의 TypeScript 원본 소스(각 패키지의 `src/`, 테스트 파일 등)는 그대로 `runner` 까지 전달된다. 빌드 레이어(소스·컴파일 도구)와 런타임 레이어(컴파일 산출물만)의 책임 분리가 아직 완전하지 않아, 최종 이미지가 실행에 불필요한 소스를 포함하고 공격 표면·이미지 크기를 늘린다.
  - 제안: 이 자체는 이번 PR 의 스코프(devDeps 제거, WARNING #1)를 벗어난 기존 상태이며 `plan/in-progress/pnpm-migration-followups.md` 의 "이미지 크기 최적화는 후속 과제" 서술과 일치하므로 이번 diff 의 결함으로 판단하지 않는다. 다만 다음 최적화 라운드에서 `runner` 가 `/app` 전체 대신 `dist`(backend + 내부 패키지) · 필요한 `package.json` · `node_modules` 만 선별 COPY 하도록 후속 항목으로 plan 에 명시적으로 등재할 것을 권장.

- **[INFO]** `prod-deps` 스테이지의 "전체 재설치" 방식은 빌드 시간 대비 비용 트레이드오프
  - 위치: `codebase/backend/Dockerfile:41-43` (`FROM builder AS prod-deps` / `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: `pnpm install --prod` 가 `node_modules` 를 삭제 후 재구성하면서 native 애드온(bcrypt/isolated-vm) 재컴파일과 내부 워크스페이스 패키지의 `prepare`(tsc) 훅을 다시 실행시킨다 — 이미 `deps` 스테이지에서 한 번 수행한 작업의 반복이다. 옵션 A(`pnpm deploy --prod`)가 gitignored `dist` 이슈로 기각된 배경은 plan 문서에 근거가 남아 있어 설계 결정으로서는 타당하나, 빌드 그래프상 동일 작업이 두 스테이지에 걸쳐 반복되는 구조적 비용이 있다.
  - 제안: 현 상태로 충분히 실용적(문서화·검증 완료)이므로 즉시 조치 불필요. 빌드 시간이 실제 병목이 되면 `pnpm prune --prod`(재해소 없는 순수 prune, pnpm 버전에 따라 지원 범위 상이) 등 대안을 재검토.

- **[INFO]** 스테이지 책임 분리(SRP)는 양호 — 참고용 긍정 관찰
  - 위치: `codebase/backend/Dockerfile` 전체 (`deps` → `builder` → `prod-deps` → `runner`)
  - 상세: 각 스테이지가 install/compile/prune/runtime-assembly 로 단일 책임을 가지며 선형 체인(순환 없음)을 이룬다. `CI=true` 를 `ENV` 로 전역 선언하지 않고 해당 `RUN` 인스트럭션에만 스코프한 것도 빌드타임 플래그가 후속 레이어로 누수되지 않도록 하는 적절한 경계 설정이다.
  - 제안: 해당 없음(유지).

- **[INFO]** plan 문서(`plan/in-progress/pnpm-migration-followups.md`) 변경은 완료 근거·조사 결과 기록으로, 아키텍처 관점 이슈 없음.

## 요약

이번 변경은 `codebase/backend/Dockerfile` 에 `prod-deps` 중간 스테이지를 신설해 프로덕션 이미지에서 devDependencies 를 제거하는 국소적 인프라 개선으로, 기존 `deps → builder → runner` 선형 빌드 체인에 `prod-deps` 를 삽입해도 순환 의존이나 스테이지 간 책임 혼재 없이 각 단계가 install/compile/prune/assembly 단일 책임을 유지한다. `CI=true` 를 인스트럭션 스코프로 한정한 점, 결정 배경(옵션 A/B 트레이드오프)을 plan 문서에 근거와 함께 남긴 점도 설계 이력 관리 측면에서 양호하다. 다만 이 PR 의 스코프를 벗어난 기존 구조적 특성으로, `runner` 최종 이미지가 여전히 컴파일 산출물이 아닌 워크스페이스 원본 소스 전체를 포함하고 있어(빌드 레이어와 런타임 레이어의 완전한 분리는 미완) 향후 이미지 경량화 라운드의 후속 과제로 남겨둘 필요가 있다. plan 문서 자체의 변경은 순수 기록성이라 아키텍처 관점 이슈가 없다.

## 위험도

NONE
