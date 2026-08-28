# 부작용(Side Effect) 리뷰 — eslint 9→10 상향 + 연쇄 lint 정리

## 발견사항

- **[INFO]** `dependabot.yml`의 `eslint-plugin-unicorn` major ignore 제거 — 자동화 PR(외부 이벤트) 재활성화
  - 위치: `.github/dependabot.yml` (unicorn ignore 항목 삭제, 묘비 주석으로 대체된 지점 — 게이트 라인 46~82 부근)
  - 상세: dependabot 이 이제 backend `eslint-plugin-unicorn`의 향후 major 상향도 자동 PR로 올릴 수 있게 됐다(종전엔 명시적으로 차단). 이는 "dependabot 이 사람 몰래 값을 올려 unmet peer 를 만든다"(`#1049` 사고)는 이 저장소가 이미 한 번 겪은 부작용 클래스를 다시 열어 둔 것과 같은 구조다. 다만 이번 PR 자체가 그 사고의 재발 방지용 상시 가드(`eslint-unicorn-peer.spec.ts` — 실측 peer range 대조, fail-closed)와 CI `--strict-peer-dependencies`(`.github/actions/pnpm-workspace/action.yml:90`에 이미 존재함을 직접 확인)를 갖췄고, 두 가드 모두 이번 리뷰에서 실측 검증됨. 즉 "조용히 통과하는" 경로는 없다.
  - 제안: 조치 불요 — 의도된 정책 변경이고 사후 게이트가 실효성 있음을 확인했다. 다만 다음에 이 ignore 블록을 다시 만질 사람을 위해 "재발 조건(가드 실패)"이 무엇인지가 이미 문서화돼 있으므로 그대로 유지.

- **[INFO]** 신규 테스트 헬퍼가 `require()` 대신 `fs.readFileSync`로 파일시스템을 직접 읽는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 함수 `readInstalledPackageJson` (게이트 57~82줄)
  - 상세: `eslint-plugin-unicorn@73`의 `exports` 맵 제약으로 `require('eslint-plugin-unicorn/package.json')`이 막혀, `node_modules/<pkg>/package.json` 경로를 직접 `fs.readFileSync`로 읽는 방식으로 전환됐다. 새로운 파일시스템 접근 경로가 생긴 것은 사실이나 (a) read-only, (b) 경로 인자가 테스트 내부 하드코딩 문자열(`'eslint-plugin-unicorn'`) 하나뿐이라 경로 조작 벡터가 없고, (c) 테스트 전용 코드(런타임 프로덕션 경로 아님)라 영향 범위가 CI 실행 환경에 국한된다.
  - 제안: 조치 불요.

- **[INFO]** `parseGteFloor`의 반환 의미가 확장돼 종전에 `null`이던 입력이 이제 유효 값을 반환한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` 함수 `parseGteFloor` (게이트 23~27줄)
  - 상세: `>=X`/`>=X.Y` 형태가 이제 `[X, 0, 0]`/`[X, Y, 0]`을 반환한다(종전엔 `null` → 호출부 fail-closed). 시그니처(`(range: string): SemverTriple | null`) 자체는 안 바뀌었고, 이 함수의 호출부는 같은 파일 그룹(`eslint-unicorn-peer.spec.ts`) 안에만 존재함을 `grep`으로 확인했다 — 외부 공개 API가 아니라 저장소 내부 가드 전용이므로 다른 호출자에 대한 하위호환 영향은 없다.
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음)

- `let x: T = <default>;` → `let x: T;` (dead-initializer 제거, `no-useless-assignment`) 8개 지점을 각각 직접 `Read`로 열어 모든 실행 경로에서 사용 전 재할당됨을 재확인했다 — 새로운 use-before-assign·의도치 않은 초기값 유실은 없다.
  - `codebase/backend/src/common/utils/ssrf-safe-url.util.ts`(`checkResolvedHostIp` — `addrs`): try 성공 시 할당, catch 는 `return`으로 조기 종료.
  - `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`(`validateScalarField` — `re`): catch 에서 `re = null`로 명시 할당.
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`finalizeCancelledExecution` — `live`): catch 에서 `return`.
  - `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`(`canActivate` — `trigger`): catch 에서 `return true`(fail-open, 원래 의미 그대로).
  - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`(`results`): catch 에서 `return`.
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`(`recalled`): catch 에서 `recalled = []` 명시 할당.
  - `codebase/packages/web-chat-sdk/src/index.ts`(`validateBootConfig` — `size`): 동형 패턴.
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `finalSystemPrompt` 재할당 2곳(single-turn/multi-turn) 제거. `grep`으로 각 함수 스코프(`executeSingleTurn`류, `executeMultiTurn`) 내 이후 참조가 전혀 없음을 확인 — 순수 사문(死文) 제거이며 `applySingleTurnMemoryInjection`/`injectThreadContext` 등 내부 헬퍼 함수 자체의 시그니처·반환값·동작은 변경되지 않았다(호출자만 반환값 일부를 더 이상 소비하지 않음).
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `graphRequeued -= slice.length;` 제거 지점 직후 `throw err`로 함수가 즉시 종료돼 반환값(`{ embeddingRequeued, graphRequeued }`)에 도달하지 않음을 확인 — 카운터 보정 로직 제거가 관측 가능한 상태 변화를 만들지 않는다.
- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts`, `codebase/backend/src/nodes/data/code/code.handler.ts` — `throw new Error(msg, { cause: err })` 신설 2건. 저장소 내 Sentry/APM 등 외부 리포팅 연동이 실존하는지 확인했으나(`grep -rl Sentry`) 코드 주석 언급뿐 실제 SDK 연동은 없었고, 다운스트림 소비 경로(`execution-engine.service.ts`, `http-exception.filter.ts`)도 `.cause`를 읽지 않아 새로 노출되는 채널이 없다.
- `.github/actions/pnpm-workspace/action.yml:90`에 `--strict-peer-dependencies`가 이미 존재함을 직접 확인 — 주석들이 전제로 삼는 "사후 게이트"가 실재한다(이번 diff가 새로 추가한 게 아니라 기존 안전망).

## 요약

이번 변경은 devDependency(eslint 9→10, eslint-plugin-unicorn 56→73) 상향과 그로 인해 새로 켜진 두 recommended 룰(`no-useless-assignment`, `preserve-caught-error`) 위반 수정, 그리고 관련 가드 테스트 보강으로 구성된다. `let x = default` 제거 8건은 전부 catch 블록의 조기 return/명시 재할당 패턴이라 실행 경로상 상태 변화가 없음을 개별 확인했고, `finalSystemPrompt` 재할당 제거·`graphRequeued` 카운터 제거도 각각 grep/코드 추적으로 사문(死文)이었음을 검증했다. 새로 도입된 부작용 표면은 (1) `eslint-unicorn-peer.spec.ts`의 파일시스템 직접 읽기(read-only, 하드코딩 경로, 테스트 전용)와 (2) `dependabot.yml`의 unicorn major ignore 제거로 인한 자동 PR 재활성화 정도인데, 둘 다 의도적이고 이미 검증된 사후 가드(`eslint-unicorn-peer.spec.ts` + 기존 CI `--strict-peer-dependencies`)로 방어돼 있다. 함수 시그니처·공개 인터페이스·전역 변수·환경 변수·네트워크 호출 관점에서 새로운 미의도 변화는 발견되지 않았다.

## 위험도

LOW
