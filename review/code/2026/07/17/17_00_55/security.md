# 보안(Security) 코드 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + endReason 화이트리스트 drift 차단

## 리뷰 범위

37개 변경 파일. 핵심은 backend 가 선언하고 frontend 가 소비하던 `endReason`(AI Agent / Information
Extractor multi-turn 종결 사유) 값 도메인을 신규 워크스페이스 패키지 `@workflow/ai-end-reason` 으로
추출해 `satisfies`/`Exclude` 양방향 컴파일타임 잠금으로 통합한 리팩터링과, 그에 딸린 워크스페이스/CI/
Docker 배선(package.json ×2, pnpm-lock.yaml, Dockerfile ×3, docker-compose.e2e.yml,
packages-checks.yml, test-stages.sh), backend 4개 파일의 인라인 유니온 타입 교체, frontend 의
하드코딩 화이트리스트 제거 + `interaction-type-registry.ts` 신설, spec 문서 backlink 3건, 그리고
plan/review 프로세스 산출물(meta.json, SUMMARY.md 등)이다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 보안 취약점은 발견되지 않았다. 아래는 참고용 INFO 관찰이다.

- **[INFO]** 신규 패키지가 런타임 `dependencies` 없이 `devDependencies` 만 사용
  - 위치: `codebase/packages/ai-end-reason/package.json`
  - 상세: `main`/`types` 가 가리키는 `dist/index.js`·`dist/index.d.ts` 는 문자열 리터럴 유니온 타입과
    `as const` 배열만 export 하며 어떤 외부 런타임 패키지도 import 하지 않는다. 즉 이 패키지 자체의
    공급망(supply-chain) 표면은 0이다. `devDependencies` 로 들어간 eslint/jest/ts-jest/typescript
    계열은 기존 4개 자매 패키지(`graph-warning-rules` 등)와 **정확히 동일한 버전 범위**를 그대로 재사용해
    새로운 미검증 의존성이 추가되지 않았다.
  - 제안: 조치 불요 (긍정적 관찰).

- **[INFO]** `endReason` 값은 사용자 입력이 아니라 backend 상태 머신이 내부적으로 산출하는 고정
  리터럴 집합(`user_ended`/`max_turns`/`condition`/`error`/`completed`/`timeout`/`max_retries`)
  - 위치: `codebase/packages/ai-end-reason/src/index.ts`, `output-shape.ts`, backend 4개 handler
  - 상세: 이번 변경은 이 값들의 **선언 위치**(손으로 각지에 베낀 사본 → 단일 패키지 import)만 바꿀 뿐
    값 자체의 발생 경로·검증 로직은 건드리지 않는다(plan 문서·diff 모두 "동작 무변경" 명시, 실측
    확인). 따라서 인젝션·입력 검증 표면에는 영향이 없다 — 사용자가 `endReason` 문자열을 직접 주입할
    경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** `errorPayload`(`{ code, message, details? }`) 전달 경로는 타입 시그니처만 변경, 로직 무변경
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `endMultiTurnConversation`/
    `buildMultiTurnFinalOutput`
  - 상세: 함수 본문을 직접 확인한 결과(`sed -n '3140,3260p'`), `endReason` 파라미터 타입만
    `AiAgentEndReason` 로 교체됐고 `errorPayload` 는 기존 주석대로 `handleAiTurnError` 가 이미
    sanitize 한 결과를 그대로 운반한다 — 에러 메시지에 민감정보가 추가로 노출되는 변경이 아니다.
  - 제안: 조치 불요.

- **[INFO]** CI/Docker 배선 변경은 기존 4개 shared 패키지와 동형 패턴만 반복
  - 위치: `.github/workflows/packages-checks.yml`, `codebase/{backend,frontend}/Dockerfile*`,
    `docker-compose.e2e.yml`, `.claude/test-stages.sh`
  - 상세: 신규 `ARG`/`ENV`/시크릿 참조가 추가되지 않았고, `packages-checks.yml` 은 `pnpm install
    --frozen-lockfile` 을 그대로 사용한다. `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 배열은
    정적 하드코딩 문자열만 담고 `_run_internal` 에서 `pnpm --filter "$pkg" "$stage"` 로 항상
    quoting 되어 순회되므로 커맨드 인젝션 경로가 없다(값이 사용자 입력이 아니라 이 파일 자체에서
    선언된 리터럴이기도 함).
  - 제안: 조치 불요.

- **[INFO]** 신규 패키지 `package.json` 에 `"private": true` 없음
  - 위치: `codebase/packages/ai-end-reason/package.json`
  - 상세: 루트 `package.json` 은 `"private": true` 이고 5개 shared 패키지(`graph-warning-rules`
    등 기존 4개 포함) 전부가 개별 `"private"` 필드 없이 동일 패턴을 따른다 — 이번 diff 가 새로
    도입한 편차가 아니라 저장소 기존 관례를 그대로 답습한 것이며, `publishConfig`/CI publish 스텝도
    확인되지 않아 실제 npm registry 게시 경로가 없다. 내용물도 시크릿이 아닌 타입 정의뿐이라 실질
    위험은 없다.
  - 제안: 조치 불요 — 리뷰 범위 밖의 기존 저장소 전반 패턴이므로 이번 PR 에서 시정할 필요 없음.

## 요약

이번 변경은 AI 노드(`AiAgentHandler`/`AiTurnExecutor`/`InformationExtractorHandler`)가 생산하고
frontend 대화 미리보기 UI가 소비하는 `endReason` 값 도메인을 신규 내부 워크스페이스 패키지로
추출해 backend/frontend 간 손으로 유지되던 사본을 제거하고 컴파일타임 exhaustiveness 로 대체한
순수 타입 계층 리팩터링이며, 여기에 딸린 워크스페이스 의존성 선언·CI matrix·Docker COPY·
docker-compose 볼륨 마스킹 배선이 함께 포함된다. 신규 코드는 문자열 리터럴 유니온 타입과 `as const`
배열, 컴파일타임 단언(`satisfies`/`Exclude`)만으로 구성되어 있어 사용자 입력을 받거나, 인증/인가를
수행하거나, 시크릿·암호화를 다루거나, 외부 네트워크/파일시스템/DB에 접근하는 코드가 전혀 없다.
`endReason` 값은 사용자가 직접 주입할 수 없는 backend 내부 상태 머신 산출값이고, 에러 페이로드는
기존 sanitize 로직을 그대로 통과하므로 에러 메시지 정보 노출 표면도 변하지 않았다. CI/Docker 배선
변경 역시 기존 4개 자매 패키지와 동일한 정적 패턴을 반복할 뿐 새로운 시크릿 참조나 인젝션 가능
지점을 만들지 않는다. 종합적으로 이번 diff 는 보안 관점에서 중립적인 리팩터링으로 판단되며,
CRITICAL/WARNING 급 발견사항은 없다.

## 위험도

NONE
