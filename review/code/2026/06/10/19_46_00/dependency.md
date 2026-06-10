# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 — 전부 기존 의존성의 추가 import
  - 위치: `s3.service.ts:8` (`DeleteObjectsCommand`), `execution-engine.service.ts:10` (`In`), `workflows.service.ts:7,10` (`randomUUID`, `QueryDeepPartialEntity`)
  - 상세: 이번 PR 은 성능 리팩터로, package.json / lock 파일 변경이 전혀 없음 (`git diff` 확인: NO_MANIFEST_CHANGES). 새로 끌어온 심볼은 모두 이미 설치된 패키지에서 나온다 — `DeleteObjectsCommand`(`@aws-sdk/client-s3` ^3.1045.0), `In`/`QueryDeepPartialEntity`(`typeorm` ^0.3.28), `randomUUID`(Node 표준 `node:crypto`). 설치본에 대해 export/경로 실재 검증 완료 (`DeleteObjectsCommand: function`, `In: function`, `QueryPartialEntity.d.ts` 존재).
  - 제안: 조치 불요.

- **[INFO]** `randomUUID` 를 표준 라이브러리에서 조달 — 불필요한 외부 패키지 회피의 모범
  - 위치: `workflows.service.ts:7` `import { randomUUID } from 'node:crypto'`
  - 상세: UUID 사전 생성에 `uuid` 같은 별도 패키지를 들이지 않고 Node 내장 `node:crypto` 를 사용. `node:` prefix 명시로 사용자 모듈 shadowing 방지. 신규 런타임 의존성·번들·취약점 표면 증가 0.
  - 제안: 조치 불요.

- **[INFO]** TypeORM 내부 타입 경로 직접 import — deep-path 결합으로 인한 미미한 버전 취약성
  - 위치: `workflows.service.ts:10` `import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'`
  - 상세: 패키지 루트(`typeorm`)가 아닌 내부 파일 경로를 직접 참조한다. `import type` 이라 런타임 영향은 0(컴파일 후 소거)이고 설치본 0.3.28 에 경로 실재 확인됨. 다만 이 경로는 TypeORM 의 공개 배럴(`typeorm` 루트)에 re-export 되지 않는 내부 구조라, 향후 마이너 버전에서 디렉터리 구조가 바뀌면 타입 import 가 깨질 수 있는 결합점이다(빌드 타임 실패라 런타임 사고는 아님). 동일 deep-path 가 코드베이스 다른 곳에 이미 쓰이는지에 따라 신규 결합인지 기존 패턴 답습인지가 갈린다.
  - 제안: (선택) `typeorm` 루트에서 동등 타입을 노출하면 루트 import 로 교체. 불가하면 현 deep-path 유지는 수용 가능 — `^0.3.28` caret 범위가 마이너 업데이트를 허용하므로 lock 고정에 의존해 안정성 확보 중임을 인지.

- **[INFO]** 의존성 버전 고정 상태 적정 — 변경 없음, caret + lock 조합 유지
  - 위치: `codebase/backend/package.json`
  - 상세: `typeorm: ^0.3.28`, `@aws-sdk/client-s3: ^3.1045.0` 모두 caret 범위이나 lock 파일로 실제 설치본이 고정된다. 이번 PR 이 manifest 를 건드리지 않으므로 기존 고정 정책 그대로.
  - 제안: 조치 불요.

- **[INFO]** 프런트엔드 신규 의존성 없음 — store 내부 모듈 결합만 변경
  - 위치: `execution-store.ts`, `use-execution-events.ts`, `use-expression-context.ts`, `run-results-drawer.tsx`, `transform/preview.tsx`
  - 상세: `selectSortedNodeResults` 라는 store 내부 export 를 신설해 4개 소비처가 이를 import 하도록 한 내부 의존 재배선. 외부 패키지(`@tanstack/react-query`, `zustand` 등) 추가/변경 없음. `WeakMap` 메모이즈도 표준 내장. 단일 출처(store)로 정렬 로직을 모은 방향이라 내부 의존 그래프 상 응집도가 오히려 개선됨.
  - 제안: 조치 불요.

## 요약

순수 성능 리팩터 PR 로, 의존성 관점에서 위험이 사실상 없다. package.json / lock 파일 변경이 0 건이며(검증 완료), 새로 추가된 import 심볼(`DeleteObjectsCommand`, `In`, `QueryDeepPartialEntity`, `randomUUID`)은 전부 이미 설치된 패키지(`@aws-sdk/client-s3`, `typeorm`) 또는 Node 표준 라이브러리(`node:crypto`)에서 조달되어 신규 런타임 의존성·번들 크기·취약점 표면·라이선스 변동이 없다. 설치본에 대한 export/경로 실재도 직접 확인했다. UUID 를 외부 패키지 대신 내장 `node:crypto` 로 처리한 점은 모범적이며, 프런트엔드 변경은 store 내부 모듈 결합 재배선으로 외부 의존과 무관하다. 유일하게 눈여겨볼 점은 `typeorm/query-builder/QueryPartialEntity` 라는 내부 deep-path 타입 import 인데, `import type` 이라 런타임 영향이 없고 빌드 타임 결합에 그쳐 LOW 수준이다.

## 위험도

LOW
