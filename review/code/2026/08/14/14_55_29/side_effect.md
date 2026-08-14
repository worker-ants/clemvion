# 부작용(Side Effect) 리뷰

## 범위 설명

`git diff origin/main...HEAD -- codebase/` 기준 실제 프로덕션 코드 변경은 6개 파일뿐이다:
`strip-external-only-fields.ts`(신규), `strip-external-only-fields.spec.ts`(신규),
`interaction.service.ts`, `interaction.service.spec.ts`, `websocket.service.ts`,
`websocket.service.spec.ts`. 프롬프트에 포함된 나머지 `review/**/*.md|json`,
`plan/**/*.md`, `CHANGELOG.md`는 코드가 아닌 검토·계획 산출물이라 부작용(전역 상태·
파일시스템·시그니처·이벤트) 관점의 적용 대상이 아니다 — 직전 라운드들의 동일 판단과
일치.

## 발견사항

- **[INFO]** `stripExternalOnlyFields` 시그니처가 1-인자 → 2-인자(`maxDepth` 필수)로
  바뀌었고, 함수 자체가 `websocket.service.ts` 내부 private 함수에서
  `shared/utils/strip-external-only-fields.ts` 의 **export 함수**로 승격됐다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:74`
    (`export function stripExternalOnlyFields<T>(value: T, maxDepth: number): T`)
  - 상세: 이전엔 파일 내부 private 함수(`envelope: Record<string, unknown>` 단일 인자)였고
    호출부가 `websocket.service.ts` 안 2곳뿐이었다. 이번 diff 로 (a) 모듈 밖으로 export 되어
    다른 모듈이 import 할 수 있는 공개 표면이 됐고, (b) 호출부가 `maxDepth` 를 **명시적으로**
    넘겨야 하는 계약으로 바뀌었다. `grep` 으로 실사용 호출부를 확인한 결과 현재는
    `interaction.service.ts:103`(`redactAndStrip` 내부, `MAX_REDACT_DEPTH` 전달)와
    `websocket.service.ts:454`·`:528`(`MAX_SANITIZE_DEPTH` 전달) 3곳뿐이며 모두 같은
    diff 안에서 새 시그니처로 갱신됐다 — 컴파일 타임에 강제되므로 누락 호출부가 조용히
    깨질 위험은 낮다. 다만 앞으로 세 번째 외부 표면(예: 새 fanout 채널)이 이 함수를
    가져다 쓸 때 `maxDepth` 를 잘못된 상수(자기 자매 sanitizer 와 다른 값)로 넘기면
    깊이 상한이 표면별로 갈라질 수 있다 — JSDoc(`:15-18`)이 이미 이 위험을 "호출부가
    명시한다" 고 문서화하고 있어 별도 조치는 불필요.
  - 제안: 조치 불요. 향후 세 번째 호출부 추가 시 리뷰에서 `maxDepth` 인자가 해당 표면의
    자매 sanitizer 상수와 일치하는지 확인하는 체크포인트로만 남겨 둔다.

- **[INFO]** `InteractionService.getStatus`(REST 공개 API)의 응답 바디가 이번 diff 로
  실제로 달라진다 — `nodeOutput`/`result`/`error` 안의 `llmCalls` 필드가 이제 삭제된다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:376`
    (`redactAndStrip(nodeExec.outputData) ?? {}`), `:438`·`:442`
    (`result`/`error` 분기의 `redactAndStrip(execution.outputData)`)
  - 상세: 이 항목은 "결함" 이 아니라 이 PR 의 핵심 목적(보안 수정)이 낳는 **의도된**
    인터페이스 변경이다. `GET /api/external/executions/:id` 를 호출하는 외부 통합자가
    (의도치 않게 노출되던) `llmCalls` 필드를 실제로 읽고 있었다면 이 필드가 사라진다.
    `CHANGELOG.md`(Unreleased 최상단)에 두 유출 경로·수신자·"이미 전송된 데이터라
    운영 판단 필요" 라는 영향 범위가 이미 명시돼 있어, 이 리뷰 관점이 요구하는
    "공개 API 변경의 기존 사용자 영향" 고지는 이미 충족돼 있다.
  - 제안: 조치 불요 — CHANGELOG 고지로 충분. 참고 기록 목적으로만 남긴다.

- **[INFO]** `redactAndStrip`(및 그 안의 `stripExternalOnlyFields`/`deepRedactSecrets`
  경로) 어디에서도 원본 엔티티(`nodeExec.outputData`/`execution.outputData`)가
  변형되지 않음을 확인했다 — TypeORM dirty-checking 을 통한 의도치 않은 UPDATE 위험 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:78-119`
    (`stripDeep` — object 분기는 `out ??= { ...obj }` 로 **새** 객체에만 쓰고, 원본
    `obj`/`value` 에는 `delete`/대입이 일어나지 않는다), 회귀 테스트로 고정됨
    (`strip-external-only-fields.spec.ts` "입력을 변형하지 않는다" 케이스)
  - 이 항목은 문제가 아니라 이 리뷰 관점의 1번 항목("의도치 않은 상태 변경")을 겨냥해
    직접 확인한 결과다 — clone-on-write 라 "read 경로가 조회 대상 엔티티를 조용히
    변경해 다음 저장 시 의도치 않은 UPDATE 를 유발" 하는 클래스의 부작용은 없다.

- **[INFO]** `deepRedactSecrets` 의 모듈 전역 `DEEP_REDACT_CACHE`(WeakMap, depth-0
  identity 캐시)는 이 diff 가 새로 도입한 전역이 아니며, 호출 순서가
  `stripExternalOnlyFields` → `deepRedactSecrets` 로 바뀐 것도 캐시 적중률에 실질적
  영향이 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:107`
    (`DEEP_REDACT_CACHE`, 이번 diff 로 수정되지 않음), 호출부
    `interaction.service.ts:102-104`
  - 상세: `getStatus` 는 요청마다 DB 에서 새로 읽은 `outputData` 객체를 넘기므로, 이
    캐시는 이 diff 이전에도 이후에도 REST 경로에서 identity 재사용 이득을 볼 수 없다
    (캐시는 같은 프로세스 내에서 **같은 객체 참조**가 반복 emit 되는 ForEach fanout
    같은 시나리오를 위한 것). 전역 상태 자체나 그 동작 특성이 이 diff 로 바뀌지 않았다.

## 확인했으나 문제 없음

- 환경 변수 읽기/쓰기, 네트워크 호출 신규 도입 없음.
- 파일시스템 부작용 없음(코드 파일 6개는 모두 소스 편집이며 런타임에 파일 I/O 를
  발생시키는 변경이 아니다).
- 이벤트/콜백: `emitExecutionEvent`/`emitNodeEvent` 는 여전히 동일한 두 채널(내부 WS
  전체 payload, 외부 fanout strip-payload)로 동일한 순서로 broadcast 한다 —
  `stripExternalOnlyFields` 호출에 `maxDepth` 인자가 추가된 것 외에 이벤트 발행 자체의
  타이밍·대상·횟수는 변경되지 않았다(`websocket.service.ts:451-462`, `:525-536` 확인).
- `interaction.service.ts` 의 `result`/`error` 삼항식은 `ExecutionStatus.COMPLETED`
  와 `FAILED` 가 상호 배타적이므로 같은 요청 안에서 `redactAndStrip(execution.outputData)`
  가 두 번 실행되는 일은 없다 — 이중 호출로 인한 중복 부작용 우려 없음.

## 요약

프로덕션 코드 변경은 `stripExternalOnlyFields` 를 공유 유틸로 승격하고 depth-1 shallow
삭제를 깊이 무관 재귀로 바꾼 뒤, fanout(WS)과 REST 스냅샷(`InteractionService.getStatus`)
양쪽이 같은 헬퍼를 부르도록 통합한 것이다. 시그니처 변경(1→2 인자, private→export)과
`getStatus` 응답 바디 변경(공개 API 인터페이스 변경)이 있으나 둘 다 (a) 호출부가 같은
diff 안에서 전부 갱신돼 컴파일 타임에 안전하고, (b) 후자는 CHANGELOG 에 영향 범위와 함께
명시된 **의도된** 보안 수정이다. clone-on-write 구현이라 원본 엔티티를 변형하지 않아
TypeORM 우회 UPDATE 같은 은닉 상태 변경도 없다. 전역 변수 신규 도입, 환경 변수, 네트워크
호출, 이벤트 발행 패턴의 의도치 않은 변경은 발견되지 않았다.

## 위험도

LOW
