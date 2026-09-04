# 테스트(Testing) 리뷰 — Swagger DTO nullable 계약 정합화 배치 (재검토)

## 검증 방법

정적 리딩 외에, 이번 diff 가 실제로 도입한 새 로직 4곳을 저장소 밖 scratch 에 원본을 백업해 둔
뒤 in-place 로 뮤테이션하고 `npx jest`(backend, jest)로 RED/GREEN 을 직접 관측했다. 전부
`cp` 로 원복했고 종료 시 `git status --short` 로 대상 파일에 diff 가 없음을 확인했다(아래
"검증 노트" 참고).

## 발견사항

- **[WARNING]** 크로스플랫폼 경로 정규화(리뷰 W3 로 이번 배치에서 4곳에 추가된 `split(path.sep).join('/')`)를 검증하는 테스트가 **하나도 없다** — mutation 으로 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:128`, `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:51,124,257`
  - 상세: 네 자리 모두 `.join('/')` 를 `.join('\\WRONG\\')`(swagger 쪽) / `.join('WRONG')`(nullable-type-lie-cast 쪽)로 깨뜨려 봤다. `swagger-dto-contract.spec.ts` 19개, `nullable-type-lie-cast.spec.ts` 31개 전 테스트가 **그대로 GREEN** 이었다(각각 별도 커맨드로 재현·복원 완료). 원인은 두 spec 모두 `withFixture`/`withFiles` 픽스처 파일명이 전부 단일 세그먼트(`probe.dto.ts`, `probe.entity.ts` 등)라 `path.relative(...)` 결과에 애초에 구분자가 등장하지 않기 때문이다 — `.split(path.sep)` 이 항상 길이 1 배열을 내므로 `.join(무엇이든)` 이 사실상 no-op 이고, 실제 판정 로직(`count`/`field`/`axis`)도 `.file` 값에 의존하지 않는다. 즉 이 정규화 코드는 POSIX CI 뿐 아니라 **어떤 플랫폼에서도 현재 테스트 스위트로는 원리적으로 검증 불가능**한 상태다 — "로컬(POSIX)에서 no-op 이라 회귀 없이 통과한다"(`RESOLUTION.md` W3 절)는 서술은 맞지만, 그 이유가 플랫폼이 아니라 **픽스처 형태**라는 점은 적혀 있지 않다.
  - 제안: 이 정규화 로직만 순수 함수로 뽑아(`toPosixRelative(root, file): string` 등) `path.sep` 를 인자로 받게 하면, 백슬래시 2개 이상을 포함한 문자열을 직접 넣어 플랫폼 의존 없이 유닛 테스트할 수 있다. 최소한으로는 fixture 에 중첩 디렉터리(`{'sub/probe.dto.ts': ...}`)를 하나 추가해 `path.relative` 결과에 구분자가 실제로 나타나게 만드는 것만으로도 지금의 vacuous 상태는 벗어난다(POSIX 에서도 `/` 가 그대로 있는지 값 단언은 가능).

- **[INFO]** `hasTopLevelNull` 이 최상위 `ParenthesizedTypeNode` 를 언랩하지 않아 `field: (T | null)` 형태에서 위음성 — mutation 으로 재현 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:83-90`
  - 상세: `swagger-dto-contract.spec.ts` 에 `@ApiProperty() nextCursor: (string | null);` 픽스처를 임시로 추가해 실행하니 `axes(...)` 가 `[]` 를 반환했다(기대값 `['null']`) — RED 확인 후 원복. 즉 개발자가 괄호를 쳐서 `(T | null)` 로 선언하면 이 가드가 조용히 통과시킨다. `grep -rnE ':\s*\([A-Za-z_.<>\[\] ]+\|[^)]*null[^)]*\)' src --include='*.dto.ts'` 결과 현재 저장소 인스턴스는 0건이라 당장 위험은 없다. 직전 라운드 testing 리뷰(INFO#9, `review/code/2026/09/04/11_02_30/testing.md`)가 이미 지적했고 이번 라운드에도 미해결로 남아 있다.
  - 제안: `ts.isParenthesizedTypeNode(type)` 이면 `type.type` 으로 한 겹 벗기고 재귀. 급하지 않음(0 인스턴스).

- **[INFO]** `CreateAssistantSessionDto.llmConfigId` 가 실제로 `null` 을 받아 검증을 통과하고 서비스까지 도달하는 경로를 직접 겨눈 테스트가 없다
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `grep -rln "CreateAssistantSessionDto" codebase/backend/src codebase/backend/test --include='*.spec.ts' --include='*.e2e-spec.ts'` 결과 0건 — 이 DTO 를 참조하는 unit/e2e 스펙이 하나도 없다. 신규 정적 가드(`swagger-dto-contract.spec.ts`)는 "선언(OpenAPI)과 타입(TS)이 같은 말을 하는가" 만 보장하지, "런타임이 실제로 그 타입대로 동작하는가" 는 보장하지 않는다 — 이번에 고친 버그 자체가 "선언과 실제 동작의 괴리" 였다는 점을 감안하면, 이 필드에 대한 최종 방어선이 정적 계약 가드 하나뿐이라는 뜻이다. `workflow-assistant-session.service.ts` 의 `dto.llmConfigId ?? null` 소비는 코드 리딩으로 확인했으나 컨트롤러 레벨에서 `null` 페이로드를 보낸 실제 요청 검증은 이번 diff 범위에 없다.
  - 제안: `workflow-assistant.e2e-spec.ts`(또는 상응 컨트롤러 spec) 에 `llmConfigId: null` 바디로 세션 생성 요청 후 워크스페이스 기본값으로 폴백하는지 확인하는 케이스 1개 추가.

- **[INFO]** `readBooleanOption` 이 boolean literal(`true`/`false`) 만 인식 — non-literal 값(상수 참조 등)은 조용히 `undefined`(미선언) 처리되고 이 경로를 겨눈 테스트가 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:59-74`
  - 상세: `nullable: SOME_CONST` 처럼 식별자 표현식이면 `TrueKeyword`/`FalseKeyword` 매칭에 안 걸려 `undefined` 가 되고, null 축은 `false`(미선언) 취급, presence 축은 데코레이터 이름 기본값으로 판정이 밀린다 — 실제 불일치가 있어도 못 잡을 수 있다. 저장소 실측(1,096개 필드) 상 전부 리터럴이라 현재는 무해하다. api_contract 리뷰(INFO#3, `review/code/2026/09/04/11_02_30/api_contract.md`)와 같은 지점을 다른 각도(테스트 부재)에서 지적.
  - 제안: 급하지 않음. non-literal 값을 만나면 "판정 불가"로 별도 카운트하는 방어 + 그 경로를 겨눈 픽스처 1개를 향후 추가 고려.

## 긍정 관찰

- **W4(async thenable 레이스) 수정의 테스트가 실제로 유효함을 mutation 으로 확인.** `withFiles` 의 `isThenable` 체크·`throw` 블록을 제거해 이전(버그) 동작을 재현하니 `temp-fixture.spec.ts` 의 관련 테스트 2개가 정확히 RED 로 전환됐다(`동기 콜백만 지원` 정규식 미매치, `finally` 관련 케이스) — 복원 후 6개 전부 GREEN. vacuous 테스트가 아니라는 것을 직접 확인했다.
- `swagger-dto-contract.spec.ts`·`nullable-type-lie-cast.spec.ts` 모두 픽스처가 실제 `ts.createSourceFile` 파싱과 실제 `fs` I/O 를 쓰고 mock/stub 이 전혀 없다 — "실제 동작과의 괴리" 위험이 구조적으로 낮다. `[캐너리] @nestjs/swagger 별칭 가정이 살아있는가`(W1 대응)만 예외적으로 실제 `@nestjs/swagger` 데코레이터를 호출해 `Reflect` 메타데이터를 읽는데, 이는 서드파티 라이브러리의 비공개 구현에 대한 가정을 캐너리로 고정하는 정당한 용도다.
- `[전제]` 테스트(스캔 대상이 비지 않았는가·`Api*` 데코레이터가 실제로 있는가)로 전수 스캔 테스트의 vacuous 실행을 방지하는 패턴이 일관되게 적용됨.
- 정규식이 세 번 틀렸던 실패 형태(객체 리터럴 내부 `;`, 화살표 함수의 `)`, `required:false` 를 이름으로 오판) 각각에 대응하는 대조군이 빠짐없이 존재하고, 각 테스트 docstring 이 실패했던 정규식의 실제 실패 이유를 설명한다 — 회귀 방지 근거가 코드가 아니라 서술로만 남지 않았다.
- `temp-fixture.spec.ts`(신설)가 정상/예외(throw)/async-오용 3경로를 모두 커버하고, 헤더 주석이 "공유 소비처가 간접 검증하므로 여기서는 예외 경로만" 이라고 스코프를 명시해 테스트 의도가 분명하다.
- 테스트 격리: 모든 픽스처가 `mkdtempSync` 로 고유 tmpdir 을 만들고 `finally` 로 정리하며, 전수 스캔 테스트(`collectTsFiles(SRC_ROOT)`)는 읽기 전용이라 테스트 간 상태 공유·순서 의존이 없다.
- 기존 e2e/unit 회귀 테스트 유효성: DTO 데코레이터 변경(`@ApiPropertyOptional`→`@ApiProperty({nullable:true})`)은 OpenAPI 메타데이터만 바꾸고 직렬화 값 자체는 안 바꾸므로, `background-monitoring.e2e-spec.ts` 등 기존 응답 바디 검증 테스트는 그대로 유효하다 — 코드 리딩으로 확인.

## 검증 노트 (뮤테이션 원복)

`temp-fixture.ts`, `swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`, `swagger-dto-contract.spec.ts` 4개 파일을 각각 scratch(`mktemp`류 디렉터리 아님, 세션 scratchpad)에 백업 후 in-place 로 수정·테스트·`cp` 원복했다. 각 원복 직후 `git status --short <파일>` 로 diff 없음을 확인했고, 최종적으로 저장소 전체 `git status --short` 를 봤을 때 내가 건드린 4개 파일은 깨끗했다. 잔여 상태(`review/consistency/2026/09/04/11_33_21/SUMMARY.md` modified, `review/code/2026/09/04/11_44_16/` untracked)는 내가 만든 것이 아니다 — 동시에 도는 다른 세션/리뷰어의 산출물로 보인다(이 리뷰 자신의 출력 디렉터리 포함).

## 요약

핵심 로직(Swagger 선언-TS 타입 불일치 가드, tmpdir 픽스처 헬퍼)의 테스트는 전반적으로 견고하다 — 정규식에서 AST 로 전환한 근거가 대조군으로 코드화돼 있고, 이전 라운드에서 지적된 W1(비공개 API 하드커플링)·W4(async 레이스)·W5(line/file 미검증) 수정 모두 실제로 유효한 테스트로 뒷받침됨을 mutation 으로 직접 확인했다. 다만 같은 이전 라운드에서 W3 로 지적돼 "고쳤다"고 기록된 크로스플랫폼 경로 정규화는, 이번 검증에서 4곳 전부 뮤테이션해도 관련 스위트(50개 테스트) 가 단 하나도 RED 가 되지 않아 — 코드는 있지만 테스트 커버리지는 없는 상태임을 새로 확인했다(WARNING). 나머지는 0-인스턴스 엣지 케이스(괄호 유니온, non-literal boolean 옵션)와 정적 가드만으로 방어되는 런타임 경로(`llmConfigId: null`) 부재로, 전부 급하지 않은 INFO 수준이다.

## 위험도

LOW
