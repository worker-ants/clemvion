# 의존성(Dependency) 리뷰 결과

## 조사 방법

`git diff origin/main...HEAD -- codebase/backend/package.json`, `pnpm-lock.yaml` 를 직접
재실행해 lockfile 변경 유무를 확인하고, 프롬프트에 첨부된 14개 코드 파일(파일 1~14)의 각
hunk 를 전수 대조해 `import` 라인 추가/변경 여부를 확인했다. 이 델타는 이전 두 리뷰 라운드
(`11_06_12`, `12_05_39`, `12_24_14`)에서 누적 검토된 diff 와 동일 스코프의 재노출이며, 세
라운드 모두 독립적으로 동일 결론(NONE)에 도달했음을 교차 확인했다.

## 발견사항

없음.

이 델타는 backend ESLint `no-unsafe-*` warning 잔여분(46→21→0)을 타입 주석·제네릭 인자·`as`
단언으로 처분하고 `lint` 스크립트에 `--max-warnings 0` 게이트를 거는 작업 + 관련 plan/review
문서 갱신이다. 의존성 표면(신규 패키지·버전·라이선스·취약점·번들 크기)을 건드리는 변경이
없다.

- **`codebase/backend/package.json`** — 유일한 변경은 `scripts.lint` 에 `--max-warnings 0`
  플래그 추가(`"eslint \"{src,apps,libs,test}/**/*.ts\""` → `... --max-warnings 0`, +1/-1).
  직접 재확인: `git diff origin/main...HEAD -- codebase/backend/package.json` 은 정확히 이
  1줄뿐이고, 같은 범위에서 `pnpm-lock.yaml` 변경은 0건이다. `dependencies` /
  `devDependencies` 블록은 추가·삭제·버전 변경이 전혀 없다(`eslint` 는 기존 devDependency
  그대로 사용). 새 패키지 도입이 없으므로 라이선스·취약점·번들 크기·버전 충돌 검토 대상
  자체가 없다.
- **`workspace-reflection-canary.ts`, `chat-channel.dispatcher.ts`,
  `execution-engine.service.ts`, `executions.service.ts`, `idempotency.interceptor.ts`,
  `chat-channel-config.dto.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`,
  `migrate-node-output-refs.ts` / `migrate-node-output-refs.spec.ts`** — 전부 타입 주석
  (제네릭 인자, 콜백 파라미터 타입, `as` 단언, 지역 인터페이스 `HttpResponseLike`)만 추가된
  순수 컴파일타임 변경이다. 새 `import` 문으로 외부 패키지를 끌어온 곳이 없다(각 diff hunk
  개별 확인).
- **`idempotency.interceptor.spec.ts`** (파일 7, 프롬프트에는 diff 생략) — 이전 라운드 조사에서
  `import { createHash } from 'crypto'` (Node 내장 모듈, 패키지 아님)와
  `import { ConflictException } from '@nestjs/common'` (이미 `package.json` 에
  `"@nestjs/common": "^11.0.1"` 로 존재하는 기존 dependency) 추가가 확인됐다. 둘 다 신규
  외부 의존성이 아니다.
- **`triggers.service.ts`** — 유일하게 `import` 라인이 바뀐 곳으로, 기존
  `'../chat-channel/types'` 에서 `ChatChannelConfig` 외에 `SetupResult` 를 추가로 import
  한다. `SetupResult` 는 같은 내부 모듈(`codebase/backend/src/modules/chat-channel/types.ts`)에
  이미 export 되어 있던 interface로, 새로 만든 타입도 새 외부 패키지도 아니다. 내부 모듈 간
  의존 관계 변화는 "쓰지 않던 기존 export 를 쓰기 시작"한 것뿐이라 결합도 관점에서도
  중립(neutral)이다 — 기존에 이미 존재하던 `triggers.service.ts → chat-channel/types` 엣지에
  named import 하나가 얹힌 것뿐 신규 엣지가 아니다.
- **`README.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `review/code/2026/08/12/{11_06_12,12_05_39}/*`** — 계획·문서·이전 리뷰 라운드 산출물(다른
  reviewer 의 `dependency.md` 2건 포함)로, 전부 의존성 표면과 무관한 md/json 문서다. 그
  선행 `dependency.md` 두 건 역시 같은 결론(NONE, 신규 의존성 없음)에 도달해 있어 이번
  라운드의 판정과 정확히 일치한다.

## 요약

새 외부 패키지 추가·버전 변경·삭제가 전혀 없다. 유일한 `package.json` 변경은 이미
devDependency 로 존재하는 `eslint` 실행 시 `--max-warnings 0` 플래그를 붙인 것뿐이며, 이는
의존성이 아니라 lint 게이트 정책 변경이다(로컬·CI 가 같은 `pnpm --filter backend lint` 호출을
공유하므로 drift 도 없음). 코드 변경은 전부 TypeScript 컴파일타임 타입 주석(제네릭·단언·로컬
interface)이거나 Node 내장 모듈/기존 `@nestjs/common` export 를 쓰는 테스트 코드로, 런타임
의존성 그래프에 영향이 없다. 유일한 신규 import 인 `triggers.service.ts` 의 `SetupResult` 도
이미 존재하던 내부 모듈의 export 를 추가로 소비하는 것뿐이라 신규 내부 결합·순환 참조 소지가
없다. lockfile(`pnpm-lock.yaml`) 변경도 0건임을 `git diff` 로 직접 확인했다. 의존성 관점에서
검토할 위험 요소가 존재하지 않으며, 이 결론은 동일 스코프를 독립 검토한 선행 두 라운드와도
일치한다.

## 위험도

NONE
