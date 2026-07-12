# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `prod-deps` 스테이지가 root 로 `pnpm install --prod` 실행
  - 위치: `codebase/backend/Dockerfile:41-43` (`FROM builder AS prod-deps` ~ `RUN CI=true pnpm install --prod --frozen-lockfile --filter "backend..."`)
  - 상세: 해당 RUN 이 `USER node` 지정 전, 즉 root 권한으로 실행된다. 다만 이 스테이지는 builder 계열 중간 레이어이며 런타임에 노출되지 않고, 최종 `runner` 로의 `COPY --chown=node:node` 로 소유권이 교정된다. 멀티스테이지 빌드에서 흔한 패턴이고 실행 이미지에 영향 없음 — 정보 제공 목적으로만 기록.
  - 제안: 조치 불요. (참고용)

- **[INFO]** `@nestjs/swagger` 11.2.7 핀 — 보안 패치 영구 차단 위험이 plan 문서에 재확인됨
  - 위치: `plan/in-progress/pnpm-migration-followups.md:212` (조사 결과 문단, `## 2. @nestjs/swagger 11.2.7 핀 제거`)
  - 상세: 이 diff 자체는 해당 핀을 도입하지 않으며(기존 npm→pnpm 전환 PR에서 이미 존재), 이번 변경은 "왜 아직 못 없앴는지"에 대한 조사 결과를 문서화한 것뿐이다. 그러나 문서가 스스로 명시하듯 `pnpm.overrides["@nestjs/swagger"]` 핀이 11.4.x 이상의 보안 패치 적용을 영구적으로 차단할 수 있는 상태이며, 이번 diff 는 이를 해소하지 않고 별도 PR 로 defer 하기로 결정했다. 코드 변경은 아니지만 "의존성 보안" 관점에서 리스크가 미해결로 남아있음을 명확히 인지시키는 것이 리뷰 목적에 부합한다고 판단해 기록.
  - 제안: 별도 PR 착수 시 11.2.7→11.4.x changelog 의 CVE/보안 수정 여부를 우선 확인해 우선순위를 정할 것 (plan 문서에 이미 명시된 계획과 일치).

- **[INFO]** `CI=true pnpm install --prod --frozen-lockfile` — lifecycle 스크립트 승인 정책 확인
  - 위치: `codebase/backend/Dockerfile:43`
  - 상세: `CI=true` 는 pnpm 의 비대화형(non-interactive) 승인 프롬프트를 건너뛰기 위한 것으로, deps 스테이지에서 이미 `onlyBuiltDependencies` 허용 목록에 등록된 패키지(bcrypt/isolated-vm 등)의 native build 및 내부 워크스페이스 패키지 `prepare` 재실행만 트리거한다. pnpm 의 비대화형 기본 동작은 허용 목록 밖 패키지의 설치 스크립트를 자동 승인하지 않고 skip 하는 fail-closed 방식이므로, 이 설정이 임의 서드파티 postinstall 스크립트를 새로 승인하는 것은 아니다. `--frozen-lockfile` 병행으로 lockfile 변조/드리프트도 차단됨 — 공급망 보안 관점에서 문제 없음.
  - 제안: 조치 불요.

## 요약

이번 diff 는 `codebase/backend/Dockerfile` 에 `prod-deps` 중간 스테이지를 추가해 런타임 이미지에서 devDependencies 를 제거하는 변경으로, 오히려 **공격 표면을 축소하는 보안 개선**에 해당한다(이미지 1.4GB → 1.23GB, dev 툴링·devDeps 제거). `--frozen-lockfile` 유지로 공급망 무결성도 그대로 보존되고, 최종 런타임 유저는 여전히 non-root(`USER node`)이며 `--chown=node:node` 로 소유권도 정확히 이관된다. 인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리 관점에서 해당되는 코드 변경은 없다(Dockerfile·plan 문서 한정 diff). 유일하게 언급할 만한 것은 plan 문서에 재확인된 기존(diff 이전부터 존재) `@nestjs/swagger` 11.2.7 버전 핀의 보안 패치 차단 리스크이며, 이는 이번 diff 의 범위가 아니라 이미 별도 후속 작업으로 추적 중이다. 전반적으로 신규 취약점 없이 순수 하드닝 변경.

## 위험도

NONE
