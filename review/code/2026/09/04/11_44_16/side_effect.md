# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소 트리는 수정하지 않았다(`Read`/`Bash grep`만 사용, `git status --short` 최종 확인 —
이번 리뷰가 만든 잔여물 없음, 사전에 존재하던 미커밋 변경 2건은 이 리뷰와 무관). 실제 소스
파일(`temp-fixture.ts`, `nullable-type-lie-cast.spec.ts`, `create-assistant-session.dto.ts` 소비처)을
직접 열어 diff 만으로는 안 보이는 호출부까지 확인했다.

이 배치는 이전 코드리뷰(`review/code/2026/09/04/11_02_30/`)의 W3(경로 정규화)·W4(async 레이스)
WARNING을 이미 조치한 결과물을 포함한다. 그 조치 자체가 부작용 관점에서 충분한지를 중점적으로
재검증했다.

## 발견사항

- **[INFO]** W4 fix(`isThenable` 체크)가 레이스를 "시끄럽게" 만들되, discard 된 thenable 자체는
  여전히 rejection 핸들러 없이 버려진다 — 향후 실제 async 소비처가 생기면 **다른 시점의
  unhandled rejection**으로 새어나갈 수 있다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-65` (`withFiles` 의
    `const result = fn(paths); if (isThenable(result)) { throw new Error(...); }`)
  - 상세: `fn(paths)`가 반환한 `result`가 thenable이면 `withFiles`는 그 자리에서 자신의 동기
    `Error`를 던진다 — 이건 W4가 의도한 대로 "조용한 ENOENT 레이스"를 "즉각적이고 명확한 에러"로
    바꾸는 올바른 개선이다. 다만 `result`(원래의 Promise/thenable) 자체에는 `.then()`도
    `.catch()`도 붙이지 않고 그냥 버린다. 만약 그 콜백이 `await` 를 포함해 진짜 비동기로 이어지는
    작업이고, 그 작업이 나중에(우리가 던진 동기 Error와 무관하게) reject 되면, 아무도 구독하지
    않은 그 Promise가 Node/Jest 의 `unhandledRejection` 이벤트를 발생시킨다. Jest는 동일 워커
    프로세스에서 테스트를 순차 실행하므로, 이 rejection 이 마이크로태스크 큐에 남아 있다가
    **`withFiles` 를 호출한 테스트가 이미 끝나고 다음(무관한) 테스트가 실행 중일 때** 표면화될
    수 있다 — 그 경우 엉뚱한 테스트가 실패하거나 경고를 뒤집어쓴다. 현재는 async 소비처가
    **0건**(파일 자신의 docstring 실측)이라 지금 당장 발현하지 않지만, 이 파일은 "저장소 가드
    spec 들이 공유하는" 헬퍼로 승격됐고 이미 2번째 소비처(`swagger-dto-contract.spec.ts`)가
    생겼다 — W4가 스스로 지적한 "공유 유틸로 승격되며 blast radius 가 커진다"는 논리가 이 잔여
    갭에도 그대로 적용된다.
  - 제안: `if (isThenable(result)) { (result as PromiseLike<unknown>).then(undefined, () => {}); throw new Error(...); }` 처럼 discard 하기 전에 빈 rejection 핸들러를 붙여 unhandled rejection 표면화를 원천 차단하거나, JSDoc에 "throw 후에도 원래 Promise 는 백그라운드에서 계속 실행되며 그 reject 는 다른 테스트에서 나타날 수 있다"를 명시. 현재 소비처가 0건이라 급하지 않다.

- **[INFO]** `withFiles` 가 `name`(파일명 키)을 검증 없이 `path.join(dir, name)` 에 그대로 사용 — 상대경로 이스케이프 키를 넘기면 `mkdtempSync` tmpdir 밖에 쓰고, `finally` 의 `rmSync(dir, ...)` 는 그 파일을 지우지 못한다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:51-54` (`for (const [name, content] of Object.entries(files)) { const full = path.join(dir, name); fs.writeFileSync(full, content); ... }`)
  - 상세: `path.join('/tmp/repo-guard-xxxx', '../../evil.ts')` 는 `dir` 바깥 경로로 정규화된다 — `writeFileSync` 가 그 바깥 경로에 파일을 쓰고, 함수 종료 시 `rmSync` 는 `dir` 자신만 재귀 삭제하므로 그 파일은 지워지지 않고 남는다(파일시스템에 "예상치 못한 파일 생성" 이 남는 경로 — 점검 관점 3). 현재 모든 호출부(`withFiles({'a.ts':...})`, `withFixture(..., 'probe.ts'/'probe.dto.ts'/'probe.entity.ts')`)는 하드코딩된 리터럴 키만 쓰므로 지금 당장 트리거되는 실사례는 없다. 다만 이 헬퍼는 이제 두 개 서로 다른 repo-guard spec 이 공유하는 공용 테스트 인프라이고, 자체 전용 spec(`temp-fixture.spec.ts`)까지 갖춘 "준-공개" 유틸이라 다음 소비처가 동적으로 파일명을 구성할 가능성을 배제할 수 없다.
  - 제안: 급하지 않음. 방어가 필요해지면 `if (name.includes('..') || path.isAbsolute(name))` 가드나 `path.relative(dir, full).startsWith('..')` 체크로 한 줄 하드닝 가능.

- **[INFO]** 공유 승격 과정에서 tmpdir 접두사가 `'nullable-guard-'` → 공용 기본값 `'repo-guard-'` 로 조용히 바뀌었다 — 기능 영향은 없지만 부작용 관점의 "예상 외 상태 변경"에 해당하는 사소한 동작 변화
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:28,41-49`(`withFiles({...})` 호출, prefix 인자 미지정) / `codebase/backend/src/common/__test-utils__/temp-fixture.ts:47`(`prefix = 'repo-guard-'`)
  - 상세: 리팩터 전 지역 함수는 `fs.mkdtempSync(path.join(os.tmpdir(), 'nullable-guard-'))` 로 고정 접두사를 썼다. 공유 헬퍼로 옮기며 `prefix` 파라미터화됐고 기본값이 `'repo-guard-'` 로 바뀌었는데, `nullable-type-lie-cast.spec.ts` 는 새 `withFiles` 를 호출하면서 이 파라미터를 넘기지 않는다 — 즉 이 spec 이 남기는(비정상 종료 시) tmpdir 이름이 `nullable-guard-*` 에서 `repo-guard-*` 로 바뀐다. `os.tmpdir()` 안의 이름으로 grep 하는 별도 정리 스크립트나 문서가 저장소에 없음을 확인했으므로(grep 0건) 실질 영향은 없다.
  - 제안: 조치 불요. 다음에 이 파일을 만지는 사람이 "왜 tmp 이름이 바뀌었지" 라고 묻지 않도록 정보성으로만 기록.

- **[INFO]** `background-run-response.dto.ts` 8필드의 OpenAPI `required` 가 `false → true` 로 전환됨 — 런타임 부작용은 없으나 **공개 API 계약(OpenAPI 스펙)의 관측 가능한 변경**
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`BackgroundRunNodeExecutionDto.finishedAt`/`durationMs`/`inputData`/`outputData`/`error`, `BackgroundRunNodeExecutionsPageDto.nextCursor`, `BackgroundRunResponseDto.completedAt`/`durationMs` — 각 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 게이트)
  - 상세: `class-validator`/`class-transformer` 런타임 검증·직렬화 경로는 데코레이터 인자가 아니라 실제 값 기준으로 동작하므로 서버 실행 시 부작용은 없다(직접 확인). 다만 이 데코레이터가 생성하는 OpenAPI 문서의 `required` 필드가 바뀌므로, 이 스키마로 클라이언트를 코드젠하는 소비자가 있다면 재생성된 타입이 `field?: T | null` → `field: T | null` 로 좁혀진다 — 이는 "함수 시그니처 변경의 호출자 영향"과 같은 급의 인터페이스 변경이다. `finishedAt`/`durationMs` 등은 실제로 항상 키가 채워지고 있었음을 서비스 조립 코드로 확인했으므로 이 변경은 정합화(계약을 실제에 맞춤)이지 계약을 임의로 좁히는 것은 아니다.
  - 제안: 별도 조치 불요(이미 CHANGELOG·plan 문서에 의도된 변경으로 기록됨). 외부 SDK/코드젠 소비자가 있다면 배포 노트에 남기는 정도로 충분.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 타입이 `string?` → `string | null` 로 넓어짐 — 하위 호환(narrowing 아님), 소비처 재확인 완료
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `workflow-assistant-session.service.ts:91` (`llmConfigId: dto.llmConfigId ?? null`)과 엔티티(`workflow-assistant-session.entity.ts:52` `llmConfigId: string | null`)를 직접 확인 — 이미 `null` 을 받아 안전하게 처리하고 있었다. `@IsOptional()` 은 `null`/`undefined` 모두에서 `@IsUUID()` 검증을 스킵하므로 런타임 검증 동작도 이 diff 이전부터 동일했다. 타입만 실제 동작을 뒤늦게 따라간 것이라 호출자 영향 없음.
  - 제안: 없음.

- **[INFO]** `nullable-type-lie-cast-guard.ts` 의 경로 정규화 추가(W3 fix)는 `CastOffender.file`/`field` 출력의 **Windows 한정 동작 변화** — 현재 CI(POSIX)·유일한 소비처(자기 자신의 spec)에는 영향 없음을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:47-54,119-127,252-260` (`findCastOffenders`/`findUntypedNullableColumns`/`findStaleSpecCasts`)
  - 상세: `path.relative(SRC_ROOT, file)` 뒤에 `.split(path.sep).join('/')` 를 추가해 리포트 문자열 포맷이 바뀐다 — POSIX 에서는 no-op(확인), Windows 에서는 `\`→`/` 로 바뀐다. 이 세 함수의 소비처를 저장소 전수 grep 했고 `nullable-type-lie-cast.spec.ts`/`-guard.ts` 자기 자신 외에는 없음을 확인 — 외부 호출자 영향 없음.
  - 제안: 없음(조치 완료로 충분).

## 요약

이번 diff의 실질 부작용 표면은 좁다 — 파일시스템 쓰기는 전부 `os.tmpdir()` 안에 격리되고
`try/finally` 로 정리되며(단, 이스케이프 키·async 콜백에 대한 방어는 여전히 낮은 확률의 잔여
갭으로 남아 있다), 전역 상태·환경변수·네트워크 호출·이벤트/콜백 발생 변경은 발견되지 않았다.
직전 라운드 WARNING(async 레이스, 경로 정규화)은 이번 diff에서 실제로 조치됐고 재검증 결과
효과가 있음을 확인했다 — 다만 async 레이스 fix 자체가 discard 하는 thenable 에 rejection
핸들러를 안 붙여, 향후 실제 async 소비처가 생기면 **다른 테스트로 전이되는 unhandled
rejection** 이라는 더 미묘한 부작용을 남길 여지가 있다(현재 소비처 0건이라 지금은 무해).
DTO 2건(`background-run-response.dto.ts`, `create-assistant-session.dto.ts`)의 변경은 런타임
검증·직렬화 로직에 영향이 없음을 소비 코드까지 직접 추적해 확인했고, `background-run-
response.dto.ts` 8필드의 OpenAPI `required` 전환만 공개 계약 관점에서 관측 가능한 변경이나
이미 문서화·의도된 정합화다. 신규 repo-guard(`swagger-dto-contract-guard.ts`)는 `fs.readFileSync`
읽기만 하고 쓰기가 없어 부작용이 없다. CRITICAL/WARNING 급 신규 결함은 없다.

## 위험도

LOW
