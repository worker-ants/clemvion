# 부작용(Side Effect) Review — 17221ecb9

## 검증 방법

커밋 메시지의 "런타임 미접촉" 주장을 추측이 아니라 **바이트 비교**로 검증했다.

1. `git show 17221ecb9~1:<path>` (변경 전) / `git show 17221ecb9:<path>` (변경 후) 로 3개
   파일의 전체 소스를 scratch 디렉터리에 추출.
2. 저장소에 설치된 TypeScript 5.9.3 (`node_modules/.pnpm/typescript@5.9.3`) 의
   `ts.transpileModule` 로 각 before/after 쌍을 emit.
   - 1차: 기본 옵션(target ES2020, CommonJS) — `execution-engine.service.ts` 만 바이트가
     달랐는데, diff 를 떠보니 **커밋이 추가한 두 줄짜리 순수 주석**(`m.query<{ id: string }[]>`
     위의 설명 주석) 때문이었다. 코드는 동일.
   - 2차: `codebase/backend/tsconfig.json` 의 실제 옵션(`module: nodenext`,
     `moduleResolution: nodenext`, `isolatedModules: true`, `removeComments: true`,
     `target: ES2023`, `emitDecoratorMetadata`, `experimentalDecorators`, `strictNullChecks`)
     을 그대로 이식해 재실행.
3. 3개 파일 모두 `md5` 로 최종 확인.

### 결과 (2차, 프로젝트 실제 컴파일 옵션, `removeComments: true`)

```
eng.before.ts    vs eng.after.ts    : IDENTICAL=true  (md5 d21fca3ae06a85752da664e12efdb36e = d21fca3ae06a85752da664e12efdb36e)
trig.before.ts   vs trig.after.ts   : IDENTICAL=true  (md5 50f1a36dd848f6737b918660828260e0 = 50f1a36dd848f6737b918660828260e0)
migrate.before.ts vs migrate.after.ts: IDENTICAL=true (md5 5b2a3c7423d483367f71a6ed6c98eb84 = 5b2a3c7423d483367f71a6ed6c98eb84)
```

3개 파일 모두 emit 된 JS 가 **바이트 단위로 100% 동일**하다. 코드 실행에는 어떤 차이도 없다.
(수정한 저장소 파일은 없음 — 전 과정은 `/private/tmp/.../scratchpad/side_effect_check/` 에서만
진행했고 `git restore`/`checkout` 은 사용하지 않았다.)

## 점검 관점별 판정

1. **정말 런타임 0인가** — 그렇다. 위 바이트 비교로 3개 파일 전부 확인.
2. **`let result;` → `let result: SetupResult;`** (`triggers.service.ts:1077`) — emit 동일.
   초기화 없는 `let` 선언은 타입 주석 유무와 무관하게 `let result;` 그대로 emit 된다.
   (참고: 대응 import 추가 `triggers.service.ts:31` `import { ChatChannelConfig, SetupResult }
   from '../chat-channel/types';` 도 `SetupResult` 가 값 위치에서 전혀 쓰이지 않아
   import elision 으로 emit 에서 사라진다 — 이것도 바이트 비교에 포함되어 확인됨.)
3. **`Object.create(Object.getPrototypeOf(trigger) as object)`** (`triggers.service.ts:546`) —
   `as object` 단언은 emit 에서 완전히 제거된다 (TS `as` 단언은 항상 타입 레벨 전용이며 값을
   감싸는 함수 호출이 아니다). emit 은 `Object.create(Object.getPrototypeOf(trigger))` 로 변경 전과
   동일.
4. **`m.query<{ id: string }[]>(...)`** (`execution-engine.service.ts:2911`) — 제네릭 타입 인자는
   emit 에서 완전히 제거된다. `m.query(...)` 호출 자체(인자·순서·개수)는 변경 전과 동일.
5. **다른 부작용 표면(전역·캐시·파일시스템·네트워크)** — 없음. 세 파일 모두 함수 시그니처
   (파라미터 개수·순서·이름), 제어 흐름, 조건문, 호출 인자 어느 것도 바뀌지 않았다.
   `migrate-node-output-refs.ts` 의 7개 hunk 는 전부 `String.replace` 콜백 파라미터
   (`match, dbl, sgl, field` 등)에 타입 주석만 추가한 것이고 콜백 본문·정규식·치환 로직은
   1바이트도 바뀌지 않았다(위 바이트 비교로 확인).

## 발견사항

없음. 전 표면에서 런타임 부작용 0을 바이트 단위로 실증했다.

## 요약

세 파일 4개 hunk(코멘트 1건 포함 7개 diff 위치) 전부 값 위치 변경이 아니라 순수 타입 주석
(변수 타입 주석·`as` 단언·제네릭 타입 인자·콜백 파라미터 타입)이었고, 프로젝트의 실제
`tsconfig.json` 옵션으로 `ts.transpileModule` emit 을 재현해 before/after JS 를 md5 까지
바이트 단위로 비교한 결과 3개 파일 모두 완전히 동일했다. 함수 시그니처·호출 인자·제어
흐름·전역 상태·파일시스템·네트워크·이벤트 어느 표면도 건드리지 않았다. 커밋 메시지의
"런타임 미접촉" 주장은 추측이 아니라 사실로 확인된다.

## 위험도

NONE

STATUS: OK
