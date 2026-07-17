# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 신규 내부 패키지 `@workflow/ai-end-reason` 추가 — 정당하고 구조적으로 견고함
  - 위치: `codebase/packages/ai-end-reason/package.json`, `codebase/backend/package.json`, `codebase/frontend/package.json`
  - 상세: 새 외부(서드파티) 런타임 의존성은 0개다. `dependencies` 필드 자체가 없고 `devDependencies`(eslint/jest/ts-jest/typescript/typescript-eslint/globals/@types/jest)만 있으며, 그 버전 범위(`^9.18.0` 등)는 기존 자매 패키지(`chat-channel-validation`/`expression-engine`/`graph-warning-rules`/`node-summary`) 4개와 **완전히 동일**하다(`tsconfig.json` byte-diff 0, `eslint.config.mjs` 는 패키지명 주석 1줄만 차이). `pnpm-lock.yaml` 실측 결과 해상 버전(`eslint@9.39.4`/`jest@30.4.2`/`ts-jest@29.4.11`/`typescript@5.9.3`/`typescript-eslint@8.61.1`/`globals@16.5.0`)이 전부 기존 lockfile 엔트리와 100% dedup 되어, 신규 패키지 버전이 트리에 순증되지 않는다(`pnpm-lock.yaml` diff 는 순수 33줄 추가, 기존 라인 변경 0). 목적도 명확하다 — backend enum 을 frontend 가 손으로 베낀 사본이 어긋나 대화 미리보기가 사라진 실제 회귀(PR #959)를 구조적으로(컴파일 타임 `satisfies`+`Exclude`) 차단한다.
  - 제안: 없음 — 기존 4-패키지 컨벤션을 그대로 재사용한 모범 사례.

- **[INFO]** 라이선스·취약점 노출 없음
  - 위치: `codebase/packages/ai-end-reason/package.json`, `.github/workflows/deps-security-checks.yml`
  - 상세: `license` 필드가 없으나 루트(`"private": true`)와 자매 패키지 4개 전부 동일 패턴(비공개 모노레포, npm 미배포)이라 실질적 라이선스 호환성 이슈는 없다. `pnpm audit --audit-level=moderate` 게이트(`deps-security-checks.yml`)의 path filter 가 `codebase/**/package.json` 를 이미 포괄하므로 신규 devDependencies 는 별도 배선 없이 자동으로 CVE 게이트에 편입된다. "dependencies" 필드가 아예 없어 런타임 공급망 공격면 순증은 0이다.
  - 제안: 없음.

- **[INFO]** 내부 의존성 클로저 배선을 실측 검증 — 완전함
  - 위치: `.claude/test-stages.sh`(INTERNAL_PACKAGES), `.github/workflows/packages-checks.yml`(path×2 + matrix×1), `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`, `codebase/frontend/Dockerfile.playwright-e2e`, `docker-compose.e2e.yml`
  - 상세: `scripts/check-e2e-playwright-config.py` 를 직접 실행해 `@workflow closure (5) synced across Dockerfile COPY + compose masks` (exit 0) 를 확인했다 — `Dockerfile.playwright-e2e` COPY 셋과 `docker-compose.e2e.yml` 볼륨 마스크 셋이 신규 패키지를 포함해 정확히 일치함을 하드 가드로 재확인. 이 브랜치의 커밋 이력(`f17fc18dd`)을 보면 직전 `/ai-review` 라운드에서 배선 누락 3건(docker-compose 마스크 누락·`packages-checks.yml` push.paths 누락·오배치 README 사본)이 실제로 발견돼 이미 수정됐고, 현재 diff 는 그 수정 이후 상태다. `pnpm audit`/보안 config-guard(`scripts/check-pnpm-security-config.py`) 대상 파일(`pnpm-workspace.yaml`)은 이번 변경과 무관해 미변경.
  - 제안: 없음 — 배선 완결성은 스크립트 실행으로 객관적으로 확인됨.

- **[INFO]** Dockerfile 인라인 주석의 "클로저 개수"가 stale — 기능 영향은 없음
  - 위치: `codebase/backend/Dockerfile:29` (`backend closure (= @workflow 4개)만`), `codebase/frontend/Dockerfile.playwright-e2e:38-39` (`frontend closure(= @workflow 4개)만` / `manifest 는 위에서 6개`)
  - 상세: 실제 COPY 라인 수를 직접 카운트한 결과, 두 Dockerfile 모두 소스 COPY 는 5개(`ai-end-reason` 포함)이고, `Dockerfile.playwright-e2e` 의 manifest COPY(`codebase/packages/*/package.json`)는 7개다. 즉 "4개"는 5로, "6개"는 7로 갱신되지 않은 채 남아 있다. 실제 COPY/마스크 집합 자체는 (위 항목에서 확인했듯) 정확하므로 빌드·CI 에는 영향이 없는 순수 프로즈(comment) drift 다. 다만 이 PR 자신이 이미 같은 계열의 "손으로 든 개수가 실제와 어긋남" 드리프트를 plan 문서에서 두 차례(E-3 "5곳→6곳", E-5 "6곳→7곳" — 커밋 `6b0b5cd45`) 겪고 정정한 이력이 있어, 같은 패턴의 잔여 사례로 짚어둘 가치가 있다.
  - 제안: `4개`→`5개`, `6개`→`7개` 로 정정하거나, 숫자를 서술에서 빼고 "위 COPY 목록 참고" 식으로 바꿔 향후 재발을 원천 차단.

- **[INFO]** 번들·빌드 영향은 무시할 수준
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`, `ai-turn-executor.ts`, `information-extractor.handler.ts`, `codebase/backend/src/nodes/core/node-handler.interface.ts`, `codebase/frontend/src/components/editor/run-results/output-shape.ts`, `codebase/frontend/next.config.ts`
  - 상세: backend 4개 소비 파일은 전부 `import type { AiAgentEndReason } from '@workflow/ai-end-reason'` 형태의 type-only import 라 컴파일 타임에 소거되며 런타임 비용이 없다. frontend `output-shape.ts` 만 유일하게 값(런타임) import(`CONVERSATION_END_REASONS`, 7-string 배열)를 하는데, `next.config.ts` 의 `transpilePackages` 목록(`["@workflow/expression-engine"]`)에는 신규 패키지가 없다. 다만 같은 방식(자체 `tsc` 컴파일 CJS `dist/index.js` 를 `transpilePackages` 등록 없이 직접 소비)으로 런타임 값을 export 하는 `@workflow/node-summary`·`@workflow/graph-warning-rules` 가 이미 frontend 프로덕션 코드(`editor-store.ts`, `node-config-summary.ts` 등)에서 동작 중임을 확인했다 — 검증된 기존 패턴의 재사용이라 신규 리스크가 아니다. CI 매트릭스에 job 1개(`packages-checks.yml`, timeout 10분, `fail-fast:false` 병렬)가 추가되지만 devDependencies 전량 dedup 이라 설치 시간 순증은 미미하고, 빌드 대상도 ~95 LOC 수준이다.
  - 제안: 없음.

- **[INFO]** 호환성 — 버전 충돌 없음
  - 위치: `pnpm-lock.yaml`
  - 상세: 신규 패키지의 모든 devDependency 해상 버전이 기존 자매 내부 패키지들과 정확히 동일한 버전으로 dedup 된다(위 항목 참조). `@workflow/ai-end-reason` 자체도 `dependencies` 필드가 없는 leaf 패키지라 다른 `@workflow/*` 패키지와의 순환 의존 가능성이 없다. backend/frontend 양쪽 `package.json` 모두 `"@workflow/ai-end-reason": "workspace:*"` 로 기존 4개 내부 패키지와 동일한 프로토콜·알파벳 순서 위치에 정확히 삽입되어 있다(`dependencies` 섹션, `devDependencies` 아님 — 배치 정확).
  - 제안: 없음.

## 요약

이번 변경의 핵심은 새 외부 패키지가 아니라 **새 내부(workspace) 패키지 `@workflow/ai-end-reason`** 하나이며, 목적은 backend가 선언한 `endReason` enum을 frontend가 손으로 복사해 오다 어긋나며 발생한 실제 회귀(PR #959, 대화 미리보기 소실)를 컴파일 타임 장치(`satisfies` + `Exclude`)로 구조적으로 차단하는 것이다. 새 패키지는 런타임 서드파티 의존성이 전혀 없고(devDependencies만, 전부 기존 자매 패키지와 동일 버전이라 `pnpm-lock.yaml`에서 완전히 dedup됨), 기존 4개 내부 패키지(`expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation`)와 100% 동일한 template(package.json/tsconfig/eslint)을 재사용해 설정 편차 위험이 없다. 내부 의존성 클로저 배선(Dockerfile COPY·docker-compose 볼륨 마스크·CI 매트릭스·로컬 test-stages.sh)은 전용 가드 스크립트(`scripts/check-e2e-playwright-config.py`)를 직접 실행해 완결성을 실측 확인했으며, 직전 리뷰 라운드에서 발견된 배선 누락 3건도 이미 후속 커밋에서 수정되어 반영돼 있다. 유일한 잔여 지적은 두 Dockerfile의 인라인 주석에 남은 "클로저 개수"(4개→5개, 6개→7개 미갱신)로, 실제 COPY/마스크 집합에는 영향이 없는 순수 프로즈 drift라 기능·보안·빌드 리스크는 없다.

## 위험도

LOW
