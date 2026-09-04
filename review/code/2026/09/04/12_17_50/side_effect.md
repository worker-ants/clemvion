# 부작용(Side Effect) 리뷰

## 검증 방법 메모

이번 diff 는 이전 두 코드리뷰 라운드(`review/code/2026/09/04/11_02_30/`, `11_44_16/`)가 이미
side_effect 관점을 각각 훑고 WARNING(async 레이스 W4·경로 정규화 W3)을 조치한 결과물을 포함한다.
저장소 트리는 수정하지 않고 `Read`/`Bash grep`만 사용했다. 실제 소스 5개 파일
(`swagger-dto-contract-guard.ts`·`swagger-dto-contract.spec.ts`·`temp-fixture.ts`·
`background-run-response.dto.ts`·`create-assistant-session.dto.ts`)을 전체 열어 diff 만으로는
안 보이는 호출부·소비처(`workflow-assistant-session.service.ts`, `update-assistant-session.dto.ts`)
까지 직접 grep 으로 대조했고, `toPosixRelative` 로 교체된 8개 호출부 전부에서 `path` import 잔존
여부(죽은 import)를 재확인했다.

## 발견사항

- **[INFO]** 공유 tmpdir 헬퍼(`withFiles`)의 async/thenable 감지가 discard 하는 Promise 에
  rejection 핸들러를 붙이지 않는다 — 향후 실제 async 소비처가 생기면 무관한 다른 테스트로
  전이되는 unhandled rejection 여지가 남는다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:57-64` (`withFiles` 함수 —
    `const result = fn(paths); if (isThenable(result)) { throw new Error(...); }`)
  - 상세: 이전 라운드가 지적한 "조용한 ENOENT 레이스"(콜백이 async 면 `finally`의 `rmSync`가
    완료를 기다리지 않고 먼저 실행됨)는 `isThenable` 판정 + 즉시 `throw` 로 올바르게 고쳐졌다.
    다만 thenable 인 `result` 자체는 `.then()`/`.catch()` 구독 없이 그대로 버려진다. 콜백이
    실제로 `await` 를 포함한 진짜 비동기 작업이고 그 작업이 나중에 reject 되면, 아무도 구독하지
    않은 그 Promise 가 Jest 워커 프로세스에 `unhandledRejection` 을 남긴다 — 마이크로태스크
    큐잉 특성상 `withFiles` 호출 테스트가 이미 끝나고 **다음 무관한 테스트가 도는 시점**에
    표면화될 수 있다. 현재 async 소비처는 0건(`grep -rn "withFiles(" codebase/backend/src` 로
    실측한 모든 호출부가 동기 콜백)이라 지금 당장 발현하지 않는다.
  - 제안: `if (isThenable(result)) { (result as PromiseLike<unknown>).then(undefined, () => {}); throw new Error(...); }` 로 discard 전에 빈 rejection 핸들러를 붙이면 원천 차단된다. 급하지 않음(0 현재 소비처).

- **[INFO]** `withFiles` 가 픽스처 파일명(`name`)을 검증 없이 `path.join(dir, name)` 에 사용 —
  이론상 `..`/절대경로 키를 넘기면 tmpdir 밖에 쓰고 `finally` 의 `rmSync` 가 그 파일을 못 지운다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:49-55`
  - 상세: `path.join('/tmp/repo-guard-xxxx', '../../evil.ts')` 는 tmpdir 바깥으로 정규화되고,
    `rmSync(dir, { recursive: true })` 는 `dir` 자신만 지우므로 그 파일은 남는다(파일시스템에
    "예상치 못한 파일" 이 생기는 경로 — 점검 관점 3). 현재 모든 호출부는 하드코딩 리터럴 키만
    쓴다(`'a.ts'`, `'probe.ts'`, `'probe.dto.ts'`, `'probe.entity.ts'` 등 — 저장소 전수 grep 확인,
    동적 생성 키 0건)라 지금 트리거되는 실사례는 없다. 다만 이 헬퍼는 이제 두 개 이상의
    repo-guard spec 이 공유하는 "준-공개" 유틸이라 다음 소비처가 동적 파일명을 구성할 가능성은
    배제 못한다.
  - 제안: 급하지 않음. 필요해지면 `if (name.includes('..') || path.isAbsolute(name)) throw ...` 한 줄로 하드닝 가능.

- **[INFO]** 공유 승격 과정에서 tmpdir 접두사 기본값이 `'nullable-guard-'`(기존 지역 함수 고정값)에서 `'repo-guard-'`(신규 공유 헬퍼 기본값)로 조용히 바뀌었다
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:47` (`prefix = 'repo-guard-'`) / `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:41-51`(신규 `withFixture` 래퍼가 prefix 인자를 넘기지 않음)
  - 상세: 리팩터 전에는 `nullable-type-lie-cast.spec.ts` 안의 지역 `withFiles` 가 항상 `'nullable-guard-'` 접두사로 tmpdir 을 만들었다. 공유 헬퍼로 옮기며 `prefix` 가 파라미터화됐는데 이 소비처는 그 값을 넘기지 않아, 비정상 종료로 tmpdir 이 남는 경우 이름이 `nullable-guard-*` → `repo-guard-*` 로 바뀐다. `os.tmpdir()` 안의 특정 접두사로 grep 하는 별도 정리 스크립트·문서는 저장소에 없음을 확인했다(`grep -rn "nullable-guard-" codebase/ .claude/` 0건) — 실질 영향 없음.
  - 제안: 조치 불요. 정보성 기록.

- **[INFO]** `background-run-response.dto.ts` 8필드의 OpenAPI `required` 가 `false → true` 로 전환됨 — 런타임 부작용은 없으나 관측 가능한 공개 API 계약(인터페이스) 변경
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`BackgroundRunNodeExecutionDto.finishedAt`(43)/`durationMs`(46)/`inputData`(49-55)/`outputData`(58-64)/`error`(67-73), `BackgroundRunNodeExecutionsPageDto.nextCursor`(84-87), `BackgroundRunResponseDto.completedAt`(142)/`durationMs`(145-148))
  - 상세: `class-validator`/`class-transformer` 는 데코레이터의 `required`/`nullable` 인자가 아니라 실제 런타임 값 기준으로 동작하므로 서버 실행 시 부작용은 없다. 이 DTO 는 응답 전용이라 `@IsOptional()` 류 검증 데코레이터도 붙어 있지 않다(직접 확인). 다만 이 데코레이터가 생성하는 OpenAPI 문서 스키마의 `required` 필드가 바뀌므로, 이 스키마로 클라이언트를 코드젠하는 외부 소비자가 있다면 재생성 시 `field?: T | null` → `field: T | null` 로 타입이 더 엄격해진다 — 점검 관점 5(인터페이스 변경)에 해당. `CHANGELOG.md` 에 방향·영향과 함께 명시적으로 고지돼 있음을 확인했다.
  - 제안: 조치 불요(이미 문서화된 의도된 변경). 외부 SDK/코드젠 소비자가 실재하면 배포 노트 병기 권장.

- **[INFO]** `create-assistant-session.dto.ts` `llmConfigId` 타입이 `string?` → `string | null` 로 넓어짐 — 하위 호환(narrowing 아님), 소비처 재확인 완료
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `workflow-assistant-session.service.ts:91`(`llmConfigId: dto.llmConfigId ?? null`, 생성 경로)과 `:107`(`if (dto.llmConfigId !== undefined) session.llmConfigId = dto.llmConfigId;`, 수정 경로)을 직접 grep 확인 — 둘 다 이미 `null` 을 안전하게 처리하고 있었다. `@IsOptional()` 은 `null`/`undefined` 모두에서 `@IsUUID()` 검증을 스킵하므로(class-validator 관례) 런타임 검증 동작도 이 diff 이전부터 동일하다. 자매 DTO `update-assistant-session.dto.ts` 는 같은 필드를 이미 `string | null` 로 선언 중이었다. 타입만 실제 동작을 뒤늦게 따라간 것이라 호출자 영향 없음.
  - 제안: 없음.

- **[NONE]** `toPosixPath`/`toPosixRelative` 추출(순수 문자열 변환)로 교체된 8개 호출부 — 동작 보존 확인
  - 위치: `masked-reject-callers-guard.ts:142`, `nullable-type-lie-cast-guard.ts:49-53,122-126,256-259`, `production-build-devdep-guard.ts:120`, `production-build-devdep.spec.ts:61`, `swagger-dto-contract-guard.ts:128`
  - 상세: `toPosixRelative(root, file)` 는 `toPosixPath(path.relative(root, file))` 이고, `toPosixPath` 의 기본 `sep` 인자는 `path.sep`(호출 플랫폼 기준)이라 종전 `path.relative(...).split(path.sep).join('/')` 와 바이트 단위로 동일한 결과를 낸다 — 전역 상태·시그니처·부작용 변화 없는 순수 리팩터. `path` import 제거 2곳(`masked-reject-callers-guard.ts`·`swagger-dto-contract-guard.ts`)도 grep 으로 잔존 사용처 0건을 확인했다(죽은 import 정리, 컴파일 영향 없음).

- **[INFO]** 리뷰 세션 도중 워킹트리에서 이 리뷰가 만들지 않은 뮤테이션을 관측함 — `review/consistency/2026/09/04/11_33_21/SUMMARY.md`
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md` (`git status --short` 기준 `M`)
  - 상세: 이 파일은 이번 리뷰 프롬프트가 실어 준 diff 상으로는 "# Consistency SUMMARY — `--impl-done spec/5-system/`" 로 시작하는 짧은 버전(신규 파일, `de7e270ee`)인데, 지금 워킹트리에는 "# Consistency Check 통합 보고서" 로 시작하는 더 긴 버전이 들어 있다(`git diff` 로 확인, 37줄 → 54줄). 나는 이 파일을 Write/Edit 하지 않았다 — 병렬로 도는 다른 세션/에이전트가 같은 워킹트리에 쓴 것으로 추정된다(이 리뷰 프롬프트 자체가 "지금 이 순간 다른 reviewer 들이 같은 워킹트리를 동시에 읽고 있다" 고 명시). 코드가 아니라 리뷰 산출물 문서이므로 이 diff 가 리뷰하는 "부작용"의 범위 밖이지만, 관측한 이상 상태를 숨기지 말라는 지침에 따라 보고한다. 복원 시도는 하지 않았다(내가 만들지 않은 변경이며 `git restore`/`checkout` 은 금지 정책).
  - 제안: 다음 사람이 이 diff 를 기준으로 병합/리뷰할 때 `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 의 최종본이 이 시점의 워킹트리 내용과 프롬프트에 실린 내용 중 어느 쪽인지 재확인 필요.

## 요약

이번 diff 의 실질 부작용 표면은 좁다 — 파일시스템 쓰기는 전부 `os.tmpdir()` 안에 격리되고
`try/finally` 로 정리되며, 전역 상태·환경변수·네트워크 호출은 어디에도 도입되지 않았다. 직전
두 라운드가 지적한 WARNING(async 레이스 W4, 경로 정규화 W3)은 이번 diff 에서 실제로 조치됐음을
소스 재열람으로 재확인했고, `toPosixRelative` 로 통일된 8개 호출부 전부가 바이트 단위로 동일한
출력을 내는 순수 리팩터임을 확인했다. 잔여 갭은 전부 이전 라운드부터 이어지는 낮은 우선순위
INFO 다 — discard 되는 thenable 에 rejection 핸들러가 없어 향후 async 소비처가 생기면 다른
테스트로 전이되는 unhandled rejection 여지, 픽스처 파일명 미검증에 따른 이론적 tmpdir 이스케이프,
tmpdir 접두사의 조용한 변경 — 셋 다 현재 소비처 0건으로 실사례가 없다. DTO 2건
(`background-run-response.dto.ts` 8필드, `create-assistant-session.dto.ts` `llmConfigId`)의
변경은 런타임 검증·직렬화 로직에 영향이 없음을 소비 코드까지 직접 추적해 재확인했고,
`background-run-response.dto.ts` 의 OpenAPI `required` 전환만 공개 계약 관점에서 관측 가능한
인터페이스 변경이나 이미 CHANGELOG 에 문서화된 의도된 정합화다. 신규 repo-guard
(`swagger-dto-contract-guard.ts`)는 `fs.readFileSync` 읽기만 하고 쓰기가 없어 부작용이 없다.
CRITICAL/WARNING 급 신규 결함은 없다. 별도로, 이 리뷰가 만들지 않은 워킹트리 뮤테이션 1건
(`review/consistency/2026/09/04/11_33_21/SUMMARY.md`)을 관측해 투명성 차원에서 기록했다 — 코드
결함이 아니라 병렬 세션 간섭으로 보인다.

## 위험도

LOW
