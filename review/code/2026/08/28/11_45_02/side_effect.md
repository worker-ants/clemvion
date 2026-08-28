# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `let x = <default>;` → `let x;`(초기화 제거) 패턴이 8개 파일에 걸쳐 반복 적용됨(`@eslint/js@10` recommended 의 `no-useless-assignment` 룰 대응). 모두 개별 확인 결과, catch 블록이 (a) 값을 명시적으로 재설정하거나(`re = null`, `recalled = []`) (b) 함수/루프를 조기 `return`/`throw`하여 미할당 상태로 하류에 도달하지 않음을 확인 — 실제 동작 변경 없음.
  - 위치: `codebase/backend/src/common/utils/ssrf-safe-url.util.ts:156`(`addrs`), `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:289`(`re`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918`(`live`), `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:67`(`trigger`), `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:239`(`results`), `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:332`(`recalled`), `codebase/packages/web-chat-sdk/src/index.ts:63`(`size`)
  - 상세: 예를 들어 `execution-engine.service.ts` 의 `live`는 DB 재조회 실패 시 catch 블록에서 `warn` 로그 후 즉시 `return`하므로 `live` 미사용 경로가 없음. `public-webhook-throttle.guard.ts` 의 `trigger` 도 catch 에서 `return true`(fail-open)로 조기 종료. `kb-tool-provider.ts` 의 `results` 역시 catch 블록이 `return {...}`으로 종료. 전부 안전.
  - 제안: 없음 (검증 완료, 조치 불필요).

- **[INFO]** `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — single-turn 경로의 `finalSystemPrompt`가 `let`→`const`로 바뀌고, `memInjection.finalSystemPrompt`로의 재할당(구 `finalSystemPrompt = memInjection.finalSystemPrompt;`)이 삭제됨. multi-turn 경로(`executeMultiTurn`)에서도 동일하게 `multiTurnInjection.finalSystemPrompt`로의 재할당이 삭제됨.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1583`, `:1618-1620`(single-turn) / 함수 `executeMultiTurn` 내 `finalSystemPrompt` 선언부와 `multiTurnInjection.messages` 대입 직후(:2037-2038 부근)
  - 상세: 두 경로 모두 해당 지역 변수는 재할당 지점 이후 함수 내에서 더 이상 읽히지 않음을 grep으로 확인(2432 라인의 동명 프로퍼티 `finalSystemPrompt: stripMemoryBlocks(...)`는 별개 함수 `applyMultiTurnTurnMemory`의 객체 리터럴 키이며 이 지역 변수를 참조하지 않음). 하류 로직은 `messages`(이미 주입 결과 반영됨)만 소비하므로 실질적 동작 변경 없음 — 다만 "system prompt 조립"이라는 AI 노드의 핵심 실행 경로라 회귀 시 파급이 크므로 하이라이트만 해 둔다.
  - 제안: 회귀 확인용 unit/e2e(메모리 주입 후 system prompt 반영 검증)가 있는지 재확인 권장. 없다면 이번 기회에 캐너리 테스트 추가를 고려.

- **[INFO]** `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — catch 블록의 `graphRequeued -= slice.length;` 보정 라인 삭제. 바로 다음 줄에 무조건 `throw err;`가 있어 함수가 `{ embeddingRequeued, graphRequeued }`를 반환하지 않으므로 그 보정값은 애초에 관측 불가능한 dead code였음을 확인.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 함수 `requeueFailedDocuments`(또는 동일 스코프)의 graph 재큐 루프, `throw err;` 직전 라인
  - 상세: 상위 스코프에 이 예외를 삼키는 try/catch가 없음을 확인 — 호출자로 그대로 전파됨. 동작 변경 없음.
  - 제안: 없음.

- **[INFO]** `.github/dependabot.yml` — `eslint-plugin-unicorn` major 버전을 dependabot 자동 갱신에서 제외하던 `ignore` 항목이 완전히 삭제됨. 이는 "GitHub 저장소의 자동화 도구(dependabot)가 이후 이 패키지의 major PR을 자동 생성한다"는 외부 자동화 동작 변경(부작용 관점 6-8과 근접한 "이벤트/워크플로 트리거 변경")이다.
  - 위치: `.github/dependabot.yml` (구 `- dependency-name: "eslint-plugin-unicorn"` / `update-types: ["version-update:semver-major"]` 블록, 삭제됨)
  - 상세: 삭제 자체는 plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md` §2)에 의도적으로 기록돼 있고, 되돌리는 조건(재발 방지)으로 `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` 상시 가드 + CI `--strict-peer-dependencies --frozen-lockfile`(`.github/actions/pnpm-workspace/action.yml:90`) 이중 안전장치를 명시. 실측 확인 결과 해당 가드·CI 스텝이 실제로 존재함 — 근거가 코드와 부합.
  - 제안: 없음 (의도된 변경, 근거 확인됨).

- **[INFO]** `pnpm-lock.yaml` — `eslint-plugin-unicorn` 56→73 상향으로 `change-case`, `espree`, `super-regex`, `regjsparser` 등 20여 개의 신규 transitive devDependency가 lockfile에 추가됨(`git diff origin/main -- pnpm-lock.yaml` 로 확인, 총 +517/-286줄). eslint 계열 외 무관한 패키지의 버전 변경은 발견되지 않음.
  - 위치: `pnpm-lock.yaml` (신규 `packages:` 엔트리 — `builtin-modules@5.3.0`, `change-case@5.4.4`, `espree@11.2.0` 등)
  - 상세: 이는 `eslint-plugin-unicorn@73`의 자체 의존 그래프 변화이며 프로덕션 런타임 코드에는 영향 없음(전부 devDependency 경로). `pnpm install`이 다음 CI/로컬 설치 시 이 패키지들을 신규로 내려받는다는 점에서만 "네트워크" 부작용이 있으나 이는 통상적인 lockfile 갱신 절차이고 이번 PR이 의도한 결과.
  - 제안: 없음 — 정보성 기록.

- **[INFO]** `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` — 신규 헬퍼 `readInstalledPackageJson()`가 `req('<pkg>/package.json')`(Node 모듈 해석) 대신 `fs.readFileSync(path.join(BACKEND_ROOT, 'node_modules', pkgName, 'package.json'))`로 파일을 직접 읽도록 변경됨(파일시스템 접근 경로 변경).
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts:57-82`(`readInstalledPackageJson` 함수 정의), 호출부 `:186`, `:217`
  - 상세: `eslint-plugin-unicorn@73`의 `exports` 맵이 `"./package.json"` 서브패스를 차단해 기존 `require()` 방식이 깨졌기 때문에 나온 우회. `pkgName` 인자는 호출부에서 항상 리터럴 `'eslint-plugin-unicorn'`만 전달되어 경로 조작(injection) 위험 없음. 테스트 전용 코드이고 읽기 전용(write/delete 없음)이라 실질적 파일시스템 부작용 없음.
  - 제안: 없음.

## 요약

이번 diff는 대부분 eslint 9→10 상향에 수반된 (1) 의존성 버전 bump(package.json ×11, pnpm-lock.yaml), (2) `@eslint/js@10` recommended 룰(`no-useless-assignment`, `preserve-caught-error`) 대응을 위한 기계적 코드 정리, (3) 회귀 가드(`eslint-unicorn-peer-guard.ts`/`.spec.ts`) 확장, (4) 설명 주석·plan 문서 갱신으로 구성된다. `no-useless-assignment` 대응으로 제거된 초기화 값들은 모두 개별 확인 결과 catch 블록의 명시적 재할당 또는 조기 return/throw로 보호되어 있어 실질적인 상태·제어흐름 변화가 없다. `ai-turn-executor.ts`의 `finalSystemPrompt` 재할당 제거는 AI 노드 실행의 핵심 경로(system prompt 조립)에 있어 파급 범위가 크므로 별도로 표시했으나, 코드 추적 결과 하류가 `messages`만 소비하고 해당 지역 변수를 재사용하지 않음을 확인했다. `dependabot.yml`의 unicorn major ignore 제거는 외부 자동화(dependabot) 동작을 바꾸는 명시적이고 의도된 부작용이며, 재발 방지용 상시 가드와 CI 이중 게이트가 실제로 존재함을 확인했다. 전역 변수 도입, 예상치 못한 파일 생성/삭제, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출, 공개 API 시그니처의 실질적 파괴적 변경은 발견되지 않았다.

## 위험도

LOW
