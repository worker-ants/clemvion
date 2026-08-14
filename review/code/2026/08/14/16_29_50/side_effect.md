### 발견사항

- **[INFO]** `stripExternalOnlyFields` 가 module-private 함수 → exported 공유 유틸로 승격되면서 시그니처가 바뀌었다 (호출자 영향은 없음, 확인 완료)
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:101` (`export function stripExternalOnlyFields<T>(value: T, maxDepth: number): T`) — 종전 `codebase/backend/src/modules/websocket/websocket.service.ts` 안의 `function stripExternalOnlyFields(envelope: Record<string, unknown>): Record<string, unknown>` (module-private, `export` 없음, `git show origin/main:...` 로 확인)
  - 상세: 시그니처가 1-인자(암묵적 상수 필드 목록·상한 없음, depth-1 shallow) → 2-인자(호출부가 `maxDepth` 명시)로 바뀌었지만, 종전 함수는 `export` 되지 않은 파일-스코프 함수였다. `grep -rn "stripExternalOnlyFields" codebase --include="*.ts"` 로 저장소 전체를 확인한 결과 참조하는 곳은 정의 파일 자신과 두 호출부(`websocket.service.ts:450`, `:524`, `interaction.service.ts:106`)뿐이며 셋 다 이 diff 안에서 새 시그니처에 맞춰 함께 갱신됐다. 즉 기존 호출자를 깨뜨리는 실질적 시그니처 변경 영향은 없다. 다만 이제 `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` 가 `shared/utils/` 로 옮겨져 백엔드 어디서든 import 가능해졌다 — `maxDepth` 인자에 대해 "자매 sanitizer 와 같은 상수를 넘겨라" 라는 계약이 JSDoc(`strip-external-only-fields.ts:94-99`)에만 있고 타입 시스템은 임의의 숫자를 받아들인다. 새 호출부가 이 계약을 어겨도 컴파일은 통과한다.
  - 제안: 조치 불요(현재 두 호출부 모두 올바른 상수를 넘기는 것을 확인). 새 호출부 추가 시 리뷰에서 `maxDepth` 가 자매 sanitizer 상수와 일치하는지 확인하는 습관만 유지.

- **[INFO]** `InteractionService.getStatus()` 의 REST 응답 payload 가 이번 diff 로 실질적으로 변경된다 — 의도된 보안 수정이며 CHANGELOG 에 문서화돼 있으나 "공개 API 응답이 달라진다" 는 관점에서 기록
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:379`(`nodeExec.outputData` 분기), `:441`(`result`), `:445`(`error`) — 전부 `stripAndRedact()`(`:98-108`) 호출로 교체
  - 상세: 종전엔 `deepRedactSecrets(...)` 단독(값 마스킹만)이었던 `nodeOutput.meta`/`result`/`error` 필드가, 이제 `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)` 를 먼저 거쳐 `llmCalls` 이름의 필드 자체가 응답에서 사라진다. `GET /api/external/executions/:id` 는 컨트롤러 하나(`interaction.controller.ts:188`)만 이 메서드를 호출하고(`grep -rn getStatus`로 확인), 캐싱 인터셉터(`IdempotencyInterceptor`)도 이 GET 엔드포인트엔 걸려 있지 않아(`@UseInterceptors` 는 66/112 줄의 POST 계열에만 붙어 있고 182 줄 `getStatus` 에는 없음) 응답이 stale 캐시로 재사용될 위험도 없다. 이 변경 자체는 CHANGELOG.md 에 명시적으로 기록된 의도된 보안 수정이고, DTO 타입(`ExecutionStatusDto`)의 필드 구조(`nodeOutput`/`result`/`error` 모두 여전히 `Record<string, unknown> | null`)는 그대로라 타입 레벨 파괴적 변경은 아니다. 다만 이 필드를 파싱해 `llmCalls` 를 사용하던 외부 통합자가 있다면(버그를 의도치 않게 의존하던 경우) 이번 배포부터 그 값이 조용히 사라진다.
  - 제안: 조치 불요(의도된 보안 수정이고 CHANGELOG 에 영향 범위·운영 판단 필요성이 이미 명시돼 있음). 참고 기록.

- **[INFO]** `stripDeep` 재귀는 원본을 변형하지 않고 clone-on-write 로 새 참조만 만든다 — 변형/전역 상태 변경 없음 확인
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:105-145`(`stripDeep`)
  - 상세: 배열은 변경이 발생할 때만 `value.slice()`, 객체는 변경이 발생할 때만 `{ ...obj }` 로 얕은 복제 후 `Object.defineProperty` 로 값을 재설정한다. 변경이 없는 서브트리는 원본 참조를 그대로 반환해 불필요한 할당이 없고(신규 회귀 테스트 `strip-external-only-fields.spec.ts` "제거할 것이 없으면 입력을 그대로 돌려준다" 로 고정), 재귀 깊이는 `depth > maxDepth` 로 상한(10)이 걸려 있어 깊은 payload 에도 무한 재귀/스택 오버플로 위험이 없다. `EXTERNAL_STRIPPED_FIELDS`(`:91`)는 모듈 레벨 `const` 배열이지만 `Object.freeze` 는 없다 — `as const` 로 TS 컴파일 타임 readonly 보호만 있고 런타임 변형은 막지 않는다. 다만 이 diff 안에서 이를 변형하는 코드는 없으며, 기존 `TERMINAL_STATUSES`(interaction.service.ts) 등 같은 파일들의 관례(freeze 없는 `as const`/`ReadonlySet`)와 일치해 이례적이지 않다.
  - 제안: 없음(positive finding). 향후 새 호출부가 `EXTERNAL_STRIPPED_FIELDS` 를 `as string[]` 캐스트로 우회해 변형하지 않는지만 리뷰 시 유의.

- **[INFO]** 이벤트 발행(`emitExecutionEvent`/`emitNodeEvent`) 흐름 자체는 변경 없음 — `stripExternalOnlyFields` 호출에 `maxDepth` 인자만 추가됐을 뿐 emit 순서·대상·payload 최상위 구조는 동일
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:450-457`(`emitExecutionEvent`), `:524-531`(`emitNodeEvent`)
  - 상세: 두 메서드 모두 `this.gateway.broadcastToChannel(...)` (내부 wire, full payload) → `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` → `this.attachRoutingContext(...)` → `this.executionEventSubject.next({...})` 순서가 diff 전후로 동일하다. 새로 추가된 회귀 테스트(`websocket.service.spec.ts`)가 "wire 는 여전히 full payload 를 받는다"(대조군) / "fanout 참조 동일성"(clone-on-write) 을 명시적으로 단언하므로 관측 가능한 부작용 없음이 실측됐다.
  - 제안: 없음.

- **[INFO]** `InteractionService`/`WebsocketService` 생성자·DI 구성·`*.module.ts` 는 이번 diff 에서 변경되지 않았다
  - 위치: `git diff origin/main...HEAD --stat -- codebase/` 로 확인 — 변경 파일 6개(`interaction.service.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`, `strip-external-only-fields.ts`/`.spec.ts`)뿐이고 `*.module.ts` 는 없음
  - 상세: `strip-external-only-fields.ts` 는 `@Injectable()` 없는 순수 함수 유틸이라 NestJS 모듈 그래프에 새 provider 등록이 필요 없다. 두 서비스 클래스의 constructor 시그니처도 diff 전후 동일(`interaction.service.ts` constructor 블록은 `@@ -97,6 +130,7 @@` hunk 에서 바로 위에 빈 줄 하나만 추가됨).
  - 제안: 없음.

### 요약
핵심 변경은 `websocket.service.ts` 안에 있던 module-private `stripExternalOnlyFields`(depth-1 전용)를 `shared/utils/strip-external-only-fields.ts` 로 승격해 깊이 무관 재귀 strip + 명시적 `maxDepth` 인자를 받도록 시그니처를 바꾼 것과, `InteractionService.getStatus()` 의 세 출구(`nodeOutput`/`result`/`error`)가 새 private 헬퍼 `stripAndRedact`(`interaction.service.ts:98`)를 통해 같은 strip 을 받도록 한 것이다. 시그니처가 바뀐 함수는 이번 diff 전엔 export 되지 않아 저장소 전체에서 실제 호출자가 두 곳(승격 전)/세 곳(승격 후)뿐임을 grep 으로 확인했고 전부 새 시그니처에 맞춰 갱신돼 있어 breaking 영향은 없다. `stripDeep` 재귀는 원본을 변형하지 않는 clone-on-write 이고 재귀 깊이도 상한(10)으로 유계이며, 모듈 등록(`*.module.ts`)·생성자·이벤트 발행 순서·환경변수·파일시스템·네트워크 호출에는 어떤 변경도 없다(전수 grep 으로 확인). `InteractionService.getStatus()` REST 응답에서 `llmCalls` 필드가 조용히 빠지는 것은 실질적인 "공개 API 응답 변화"이지만 이는 이번 커밋 군이 의도한 보안 수정 그 자체이고 CHANGELOG.md 에 영향 범위까지 명시돼 있어 새로 발견된 부작용이 아니다. 관찰된 항목은 모두 확인·문서화된 의도된 동작이거나 무해한 리팩토링 부산물이라 위험도는 낮다.

### 위험도
LOW
