# 테스트(Testing) 리뷰

## 사전 검증 (직접 실행)

리뷰 대상 diff 는 대부분 rename/파일 이동/공유 헬퍼 추출인 hygiene PR 이라, 주장(claim)을 문서만으로
받지 않고 실제로 돌려서 확인했다.

```
codebase/backend$ npx jest src/nodes/core/node-output-allowlist.spec.ts \
  src/shared/testing/swagger-probe.spec.ts src/shared/utils/redact-stored-error.spec.ts
  → 3 suites / 64 tests, 전부 PASS

codebase/backend$ npx jest src/modules/websocket/websocket.service.spec.ts \
  src/modules/executions/dto/re-run.dto.spec.ts \
  src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts \
  src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts \
  src/modules/workflows/workflows-execute-body.spec.ts
  → 5 suites / 95 tests, 전부 PASS

codebase/backend$ npx jest src/repo-guards/__tests__/production-build-devdep.spec.ts
  → 1 suite / 20 tests, 전부 PASS
```

Jest 는 `ts-jest`(비-`isolatedModules`)라 타입체크가 실행 경로에 포함된다 — "green 인데 타입만
strip 됐다" 류의 위양성 걱정은 배제된다.

## 발견사항

- **[INFO]** `buildSwaggerDocument` 의 핵심 계약(`createDocument` 가 던져도 `finally` 로
  `app.close()` 가 실행된다)을 직접 검증하는 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:36-44`(JSDoc·구현) /
    `codebase/backend/src/shared/testing/swagger-probe.spec.ts`(케이스 부재)
  - 상세: 이 파일의 새 spec(`swagger-probe.spec.ts`)은 "존재 이유는 에러 경로"라는 원칙 아래
    `schemaOf`/`propertyOf`/`schemasOf` 의 실패 메시지는 촘촘히 고정했지만, `try/finally`
    로 명시한 "예외 시에도 앱을 닫는다"는 보장 자체는 캐너리가 없다. 다만 이 갭은 새로 발견한
    것이 아니라 직전 리뷰 라운드(`19_36_17` INFO 1)에서 이미 지적되고, `RESOLUTION.md` 에서
    "Nest 내부(`NestApplication.prototype.close`)를 스파이해야 하고 프레임워크 업그레이드에
    깨지기 쉬워 비용이 방어값보다 크다"는 근거로 의식적으로 유예된 상태다 — 그 판단에 동의하며,
    가시성 확보 차원에서만 재기록한다(새 지적 아님, 상태 유지 확인).
  - 제안: 추가 조치 불요(기존 유예 근거 유효). 다음에 이 헬퍼를 다른 이유로 열 때 함께 처리.

## 관점별 확인 결과 (요약)

1. **테스트 존재 여부** — 신규 로직(파일 신설)에는 전부 자기 `.spec.ts` 가 동반됐다:
   `nodes/core/node-output-allowlist.ts`(이동, 로직 무변경)는 자기 spec 이 그대로 따라왔고,
   `shared/testing/swagger-probe.ts`(신규 추출 헬퍼)는 새 `swagger-probe.spec.ts` 로
   "에러 경로"를 전담 검증한다. 나머지는 순수 rename/import-path 변경(`redactNodeExecutionRow`
   → `…ForResponse`, `allowlistNodeOutputKeys` import 경로, `interaction.guard.ts` JSDoc
   오기 정정)이라 신규 동작이 없고, 기존 테스트가 호출부와 함께 갱신됐다.
2. **커버리지 갭** — `buildSwaggerDocument` 의 `finally` 보장 미검증(위 INFO) 외에는 갭이
   눈에 띄지 않는다. `node-output-allowlist.spec.ts`(nodes/core 로 이동한 버전)는 캐너리
   (`_retryState`/`_resumeState`/미지 키), 폼 폴백 3키, 전체 목록 리터럴 고정(뮤테이션 실증
   주석 포함), 런타임 불변(`Object.freeze`), copy-on-change 정체성, 원본 비변이,
   `__proto__` 오염 방지, 비객체 입력(`null`/`number`/배열) 통과, 최상위 한정(deep 값 보존)
   까지 골고루 덮는다.
3. **엣지 케이스** — `null`/원시값/배열 입력, 빈 `nodeOutput`, `additionalProperties`/`oneOf`
   경계(swagger DTO 스펙들), `llmCalls` 부재 시 no-op strip, allowed-key 전수 순회
   (`it.each([...NODE_OUTPUT_ALLOWED_KEYS])`) 등 경계값이 잘 다뤄진다.
4. **Mock 적절성** — `websocket.service.spec.ts` 는 `gateway.broadcastToChannel` 만 `jest.fn()`
   으로 스텁하고 나머지(seq allocator)는 결정적 fake 로 대체해 실제 로직(fanout/wire 분리,
   allowlist 파이프라인)은 실 코드 경로를 그대로 태운다 — 과도한 mock 으로 실동작과 괴리되는
   부분은 없다. `swagger-probe.spec.ts`/DTO spec 들은 실제 Nest 모듈을 부팅해 `createDocument`
   를 태우는 통합 성격이라 mock 자체가 없다.
5. **테스트 격리** — `websocket.service.spec.ts` 최상위 `beforeEach` 가 매 테스트마다
   `service`/`gateway`/fake allocator 를 새로 만들어(파일 상단 `beforeEach`, 실측 확인) 이번에
   추가된 두 테스트(`llmCalls 없는 이벤트`, `emitNodeEvent fanout 도 strip`)를 포함해 전 테스트가
   독립적으로 실행된다. `node-output-allowlist.spec.ts`/`swagger-probe.spec.ts` 도 공유
   mutable state 없이 각 `it` 가 자기 입력을 새로 만든다.
6. **테스트 가독성** — 한국어 서술형 테스트 이름과 "왜 이 fixture 를 골랐는지"를 설명하는 인접
   주석(예: `_retryState` 를 고른 이유, `formConfig` 를 굳이 리터럴로 고정하는 이유)이 일관되게
   붙어 있어 의도 파악이 쉽다.
7. **회귀 테스트** — rename/이동 전수 `grep` 결과 구 이름(`redactNodeExecutionRow`)·구 경로
   (`shared/utils/node-output-allowlist`) 코드 잔존 0건(직접 재실행 확인). 직전 라운드
   (`19_36_17`)에서 지적된 JSDoc 오귀속 W1(`swagger-probe.ts` 의 `schemaOf`/`schemasOf` 문서
   뒤섞임)·W2(`websocket.service.spec.ts` 의 doc-comment 가 이동 경계 밖에 남음)는 이번 diff 의
   현재 상태(`swagger-probe.ts:58-98`, `websocket.service.spec.ts:791-812`)에서 실제로
   교정돼 있음을 `Read` 로 직접 재확인했다 — 재발 없음.
8. **테스트 용이성** — `WebsocketService` 는 생성자 주입(gateway/allocator)이라 fake 로 완전
   대체 가능하고, `swagger-probe.ts` 추출로 4개 스펙이 DI 컨테이너 boilerplate 를 반복하지
   않게 됐다. `node-output-allowlist.ts` 의 컴파일타임 결속(`assertAllowlistCoversHandlerContract`)
   은 런타임 테스트가 아니라 빌드 실패로 드리프트를 잡는 설계라 오히려 "테스트가 필요 없어지는"
   방향으로 테스트 용이성을 높인다. `tsconfig.build.json` 의 신규 `exclude` 항목은 "빌드해서 눈으로
   확인" 수준이 아니라 기존 범용 가드 `src/repo-guards/__tests__/production-build-devdep.spec.ts`
   가 `resolveBuildFileNames`+`findDevDepLeaks` 로 매 실행마다 자동 검증한다 — 직접 실행해
   20/20 PASS 를 확인했고, 이 exclude 항목이 나중에 실수로 지워져도 이 가드가 잡는다(수동 확인에
   의존하지 않는 산출물 기반 방어).

## 요약

이번 PR 은 rename·파일 이동·중복 보일러플레이트 추출 위주의 hygiene 리팩터이고, 테스트 관점에서
실질적 결함은 발견되지 않았다. 신규 코드(`swagger-probe.ts`)에는 "존재 이유"에 초점을 맞춘 전용
spec 이 동반됐고, 이동된 코드(`node-output-allowlist.ts`)는 이미 두터운 캐너리 스위트를 그대로
데려왔다. rename 은 호출부·테스트가 전수 동반 갱신됐음을 grep 과 실행으로 직접 확인했고, 관련
spec 5개(95 tests)+3개(64 tests)+가드 1개(20 tests)를 전부 직접 실행해 GREEN 을 재현했다. 직전
리뷰 라운드가 지적한 JSDoc 오귀속(WARNING 2건)도 현재 diff 상태에서 실제로 교정된 것을 확인했다.
유일하게 남은 항목은 `buildSwaggerDocument` 의 `finally` 보장에 대한 미검증(INFO)인데, 이는 새
지적이 아니라 이미 의식적으로 유예된 낮은 우선순위 갭이다.

## 위험도

LOW
