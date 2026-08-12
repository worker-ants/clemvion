# 의존성(Dependency) 리뷰 결과

## 조사 방법

`git diff origin/main...HEAD --stat` 로 이번 세션이 보는 누적 diff(62개 파일, 8개 커밋 계열)
전체를 확인하고, 의존성 표면에 해당할 수 있는 세 갈래를 직접 재검증했다.

- `git diff origin/main...HEAD -- codebase/backend/package.json codebase/backend/pnpm-lock.yaml`
  — lockfile 변경 유무 직접 확인.
- `git diff origin/main...HEAD -- 'codebase/backend/src/**/*.ts' | grep -E '^\+import'` — 이번
  누적 diff 전체에서 새로 추가된 `import` 라인 전수 grep.
- 위 두 결과를 이전 4라운드(`11_06_12`, `12_05_39`, `12_24_14`, `12_40_58`)의 동일 조사와 대조.

## 발견사항

없음.

이 델타는 backend ESLint `no-unsafe-*` warning 잔여분(46→21→0)을 타입 주석·제네릭 인자·`as`
단언으로 처분하고 `lint` 스크립트에 `--max-warnings 0` 게이트를 거는 작업 + 그 과정에서 나온
회귀 테스트(idempotency 캐시 R8 캐너리, 손상 JSON fallback 등) + plan/이전 리뷰 라운드 산출물
커밋으로 구성된다. 의존성 표면(신규 패키지·버전·라이선스·취약점·번들 크기)을 건드리는 변경이
없다.

- **`codebase/backend/package.json`** — 이번 누적 diff 전체를 통틀어 유일한 변경은
  `scripts.lint` 에 `--max-warnings 0` 플래그 추가
  (`"eslint \"{src,apps,libs,test}/**/*.ts\""` → `... --max-warnings 0`, 정확히 +1/-1).
  직접 재실행한 `git diff origin/main...HEAD -- codebase/backend/package.json` 결과가 이
  1줄뿐임을 확인했고, 같은 범위에서 `pnpm-lock.yaml`(루트 워크스페이스 단일 lockfile) 변경은
  **0건**이다. `dependencies` / `devDependencies` 블록은 추가·삭제·버전 변경이 전혀 없다
  (`eslint` 는 기존 devDependency `^9.18.0` 그대로 사용). 새 패키지 도입이 없으므로 라이선스·
  취약점·번들 크기·버전 충돌 검토 대상 자체가 없다.
- **신규 `import` 전수 grep 결과 (누적 diff 전체, 3건)**:
  - `import { createHash } from 'crypto'` (`idempotency.interceptor.spec.ts`) — Node.js 내장
    모듈. 외부 패키지 아님.
  - `import { ConflictException } from '@nestjs/common'` (`idempotency.interceptor.spec.ts`) —
    `package.json` 에 이미 `"@nestjs/common": "^11.0.1"` 로 존재하는 기존 dependency. 신규
    외부 의존성 아님.
  - `import { ChatChannelConfig, SetupResult } from '../chat-channel/types'`
    (`triggers.service.ts`) — 같은 내부 모듈(`codebase/backend/src/modules/chat-channel/types.ts`)에
    **이미 export 되어 있던** interface `SetupResult` 를 기존 import 문의 named specifier 목록에
    추가한 것뿐이다. 새로 만든 타입도 새 외부 패키지도 아니며, `triggers.service.ts →
    chat-channel/types` 모듈 엣지 자체는 이 diff 이전부터 존재했다(같은 줄에서 `ChatChannelConfig`
    를 이미 import). 내부 모듈 간 의존 관계 변화는 "쓰지 않던 기존 export 를 쓰기 시작"한 것뿐이라
    결합도 관점에서 중립(neutral)이며, 신규 엣지·순환 참조 소지가 없다.
- 그 외 리뷰 대상 소스 파일(`workspace-reflection-canary.ts`, `chat-channel.dispatcher.ts`,
  `execution-engine.service.ts`, `executions.service.ts`, `idempotency.interceptor.ts`,
  `chat-channel-config.dto.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`,
  `migrate-node-output-refs.ts`/`.spec.ts`)는 전부 타입 주석(제네릭 인자, 콜백 파라미터 타입,
  `as` 단언, 지역 인터페이스 `HttpResponseLike`)만 추가된 순수 컴파일타임 변경이며 새 `import`
  문이 없다(위 grep 이 이미 diff 전체를 스캔했으므로 누락 없음).
- `codebase/backend/README.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14,12_40_58}/*`(각 라운드의 `dependency.md`
  4건 포함) — 계획·문서·이전 리뷰 라운드 산출물로, 전부 의존성 표면과 무관한 md/json 문서다.
  선행 4건의 `dependency.md` 모두 이번과 동일한 결론(NONE, 신규 의존성 없음)에 도달해 있다.

## 요약

새 외부 패키지 추가·버전 변경·삭제가 이번 누적 diff 전체에 걸쳐 전혀 없다. 유일한
`package.json` 변경은 이미 devDependency 로 존재하는 `eslint` 실행 시 `--max-warnings 0`
플래그를 붙인 것뿐이며, 이는 의존성이 아니라 lint 게이트 정책 변경이다(로컬·CI 가 같은
`pnpm --filter backend lint` 호출을 공유하므로 drift 도 없음). 코드 변경은 전부 TypeScript
컴파일타임 타입 주석(제네릭·단언·로컬 interface)이거나 Node 내장 모듈/기존 `@nestjs/common`
export 를 쓰는 테스트 코드다. 이번 델타에서 새로 추가된 유일한 내부 import(`triggers.service.ts`
의 `SetupResult`)도 이미 존재하던 내부 모듈의 export 를 추가로 소비하는 것뿐이라 신규 내부
결합·순환 참조 소지가 없다. lockfile(`pnpm-lock.yaml`) 변경도 0건임을 `git diff` 로 직접
확인했다. 의존성 관점에서 검토할 위험 요소가 존재하지 않으며, 이 결론은 동일 스코프를 독립
검토한 선행 4개 라운드(`11_06_12`, `12_05_39`, `12_24_14`, `12_40_58`)와도 일치한다.

## 위험도

NONE
