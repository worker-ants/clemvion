# 문서화(Documentation) 리뷰 — patch-omit-undefined (2R, 14_20_00)

## 검토 범위

이번 라운드는 1R(`review/code/2026/09/27/13_50_41`)에서 나온 Critical 1 · Warning 2 를 처분한 뒤의 diff다.
실질적으로 새로 얹힌 코드 변경은 `workflows.service.ts` 의 `settings` null 가드(`!== undefined` → `!= null`),
그 회귀·명시적 null 캐너리 단위 테스트 3건, `omit-undefined.ts`/`omit-undefined.spec.ts` 의 JSDoc·경계 테스트,
CHANGELOG 신규 항목, plan(`patch-omit-undefined.md`) 실측 기록, 그리고 1R 자체의 산출물(SUMMARY/RESOLUTION/
8개 reviewer 리포트 + consistency 세션 산출물)이 리포지토리에 커밋된 것이다. 코드·주석·테스트·plan·CHANGELOG를
모두 `Read`로 직접 열어 대조했다(저장소 쓰기 없음, `git status --short` 리뷰 시작·종료 시 이 세션 산출물 외 변경 없음 확인).

## 발견사항

- **[INFO]** `workflows.service.ts` 의 `settings` null 가드 수정과 그 위 인라인 주석이 정확히 대응
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` — 함수 `WorkflowsService.update()`, `if (settings != null)` 블록 직전 주석
  - 상세: 주석이 "`null` 도 건너뛴다 — `@IsOptional()` 이 `settings: null` 을 통과시키는데 이 병합은 원래 그것을 no-op 으로 다뤘다(`{ ...null }` 은 빈 객체). `!== undefined` 로 두면 `omitUndefined(null)` 이 던져 500 이 된다" 라고 왜 `!= null` 로 바꿨는지 원인(class-validator `@IsOptional()`의 null 통과)·과거 동작(no-op)·회귀 형태(500)를 모두 담고 있고, 실제 코드(`if (settings != null)`)·plan 실측 기록(`plan/in-progress/patch-omit-undefined.md` `/ai-review` 1R 절)과 1:1 로 일치한다.
  - 제안: 없음(양성 확인).

- **[INFO]** 신규 단위 테스트 3건("settings: null 은 던지지 않고…", "명시적 null 은 로드한 값을 지운다", e2e B 의 `settings: null` 케이스)의 주석·의도가 실제 단언과 일치
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts`(두 `it`), `codebase/backend/test/patch-partial-body.e2e-spec.ts` 케이스 B 하단(`settings: null` 블록)
  - 상세: `// §5.4 tri-state 의 나머지 한 칸 — 명시적 null 은 «값을 지운다» 는 요청이라 걸러내면 안 된다` 주석은 `settings` 가 아닌 `description`/`folderId` 필드 단위 null 처리 테스트 위에 붙어 있고, `settings` 자체의 null(중첩 DTO 통째 null) 테스트에는 별도로 "`@IsOptional()` 은 `settings: null` 도 통과시킨다 — 병합은 그것을 no-op 으로 다룬다(던지면 500)" 주석이 붙어 두 성격(필드 단위 null=초기화 vs `settings` 전체 null=no-op)을 혼동 없이 구분한다. `e16a35beb` 커밋이 캔너리의 불필요한 `null as unknown as string` 캐스트를 제거한 것도 `nullable-type-lie-cast` 가드 로그와 정확히 일치함을 커밋 diff 로 확인했다.
  - 제안: 없음(양성 확인).

- **[INFO]** CHANGELOG 항목은 `settings: null` 500 회귀를 언급하지 않는다 — 이는 누락이 아니라 기준에 맞는 생략
  - 위치: `CHANGELOG.md` `## Unreleased — 워크플로 · 노드 · 인증 설정 수정이 보내지 않은 필드를 잃지 않는다`
  - 상세: 이 회귀는 1R 리뷰가 push 전에 잡아 같은 PR 안에서 고쳐졌으므로 main 에 노출된 적이 없다. `CHANGELOG.md` 상단 기준이 명시하는 "판정과 수치는 main 대비 · 머지 시점이다 — PR 안에서 생겼다 사라진 것은 변화가 아니다" 원칙과 정확히 부합한다. `settings: null` 자체의 최종 동작(no-op, 저장값 유지)도 수정 전후 동일해 관측 가능한 계약 변화가 없으므로 별도 문장도 불필요하다.
  - 제안: 없음(양성 확인 — 조치 불요).

- **[INFO]** `omit-undefined.ts` JSDoc·타입 시그니처(`T & NotArray<T>`)가 `null` 입력 케이스는 서술하지 않는다 — 호출부 가드로 위임된 설계이며 문서 자체의 결함은 아님
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:1`~`26`
  - 상세: 1R Critical 의 근본 원인은 `T extends object` 제네릭이 `settings?: WorkflowSettingsDto`(nullable) 같은 유니온 타입을 `T`로 추론할 때 컴파일 타임에 `null`을 막지 못한다는 점이었다(plan `/ai-review` 1R 절 "교훈"이 이를 명시). 이번 fix는 헬퍼 자체를 null-safe하게 만들지 않고 호출부(`workflows.service.ts`)에서 `!= null` 가드로 막는 쪽을 택했는데, `omit-undefined.ts`의 JSDoc은 이 "호출부가 null을 걸러야 한다"는 전제를 문장으로 남기지 않는다 — 현재는 유일한 nullable 전체-필드 호출부(`settings`)가 가드를 갖췄지만, 다음에 같은 헬퍼를 nullable 필드에 새로 배선하는 개발자가 이 JSDoc만 읽으면 "런타임에 null이 들어오면 던진다"는 사실을 알기 어렵다.
  - 제안: (경미, 필수 아님) `omit-undefined.ts` JSDoc에 "인자가 런타임에 `null`/`undefined` 자체이면 `Object.entries`가 던진다 — 필드 전체가 명시적으로 null일 수 있는 호출부는 먼저 `!= null` 로 가드하라(예: `settings`)" 한 문장을 추가하면, 다음 호출부 추가 시 같은 회귀가 재발할 가능성을 줄인다. 이번 PR 은 plan에 그 교훈을 이미 기록해 두었으므로(사후 문서화는 있음) 차단 사유는 아니다.

- **[INFO]** 1R 리뷰 산출물(`RESOLUTION.md`/`SUMMARY.md`/8개 reviewer 리포트)에 인용된 커밋 해시·수치가 실제 git 이력과 일치
  - 위치: `review/code/2026/09/27/13_50_41/RESOLUTION.md`, `plan/in-progress/patch-omit-undefined.md` `/ai-review` 1R 절
  - 상세: `git log --oneline`으로 `fd21691c9`·`814a99605`·`6da351477`·`5a4bb2bd4`·`52744b0cf`·`edd79ca40`·`a4f57aeb0`·`e16a35beb`·`1a9d9b414` 순서·메시지를 대조한 결과 RESOLUTION.md의 조치 항목표(SUMMARY # 1~3, INFO 4·5·9)가 인용한 커밋과 정확히 일치했다.
  - 제안: 없음(양성 확인).

## 요약

이번 라운드(2R)의 문서화 품질은 1R과 마찬가지로 높다 — `settings` null 가드 수정에 붙은 인라인 주석, 신규 캐너리 테스트들의 상단 주석, RESOLUTION/SUMMARY의 조치 근거가 실제 코드·git 이력과 어긋남 없이 대응한다. CHANGELOG는 PR 내부에서 생겼다 사라진 회귀를 항목화하지 않는 프로젝트 기준을 정확히 따랐다. 유일하게 지적할 만한 것은 `omit-undefined.ts` JSDoc이 이번 Critical의 근본 원인("헬퍼가 null 입력에 안전하지 않으므로 nullable 전체-필드 호출부는 호출 전에 가드해야 한다")을 헬퍼 자신의 문서에는 아직 남기지 않고 plan 문서에만 기록해 둔 점이다 — 다음에 같은 헬퍼를 새 nullable 필드에 배선할 때 같은 함정을 다시 밟을 여지가 남는다. 다만 이는 INFO 수준의 예방적 제안이며 CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
