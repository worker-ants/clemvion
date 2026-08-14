# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `InteractionService.getStatus()` (REST `GET /api/external/executions/:id`) 응답 payload 의 shape 가 바뀐다 — `nodeOutput.meta.turnDebug[].llmCalls[]` 가 더 이상 실리지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`
  - 상세: `stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}) as Record<string, unknown>, MAX_REDACT_DEPTH)` 로 바뀌면서, 이전엔 `deepRedactSecrets` 의 값 마스킹만 거쳐 실제로 (일부 마스킹된 형태로나마) 내려가던 `llmCalls` 서브필드가 이제 통째로 사라진다. 이는 공개 REST 인터페이스의 응답 shape 변경(필드 소멸)이라 "인터페이스 변경" 관점에서는 breaking 이다. 다만 (a) 의도된 보안 수정이고 (b) `CHANGELOG.md` 에 "이미 전송된 데이터" 라는 운영 영향까지 명시적으로 기록돼 있으며 (c) 애초에 새어 나가면 안 되는 debug-only 필드였다는 점에서 정당한 변경이다. 부작용 관점에서 추가 조치는 필요 없고, 사실관계만 기록.
  - 제안: 없음 (문서화 완료, 의도된 변경).

- **[INFO]** `stripExternalOnlyFields` 시그니처가 `(envelope)` → `(value, maxDepth)` 로 바뀌고 module-private 함수에서 `shared/utils` 의 **exported** 함수로 승격됐다 — 호출부 전수 확인, 잔존 호출자 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:41-43` (신규 시그니처), 호출부 `codebase/backend/src/modules/websocket/websocket.service.ts:454-457`·`:528-531`, `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`
  - 상세: 병합 전 base(`f9d31041d`)에서 `stripExternalOnlyFields` 는 `websocket.service.ts` 안에서 `export` 없이 선언된 module-private 단일 인자 함수였다(`grep` 으로 직접 확인, 외부 호출자 0). 이번 변경으로 공개 유틸로 승격되면서 `maxDepth` 필수 인자가 추가됐는데, `grep -rn "stripExternalOnlyFields" codebase/backend/src` 로 전수 확인한 결과 이 diff 범위 안의 2개 호출부(websocket.service.ts 2곳, interaction.service.ts 1곳) 모두 갱신됐고 orphan 호출자는 없다. `maxDepth` 는 기본값이 없는 필수 파라미터라, 향후 새 호출부가 인자를 빠뜨리면 TS 컴파일 타임에 잡히므로 "조용한 런타임 side effect" 로 이어질 가능성은 낮다. 문제는 아니고 확인 결과만 기록.
  - 제안: 없음 (검증 완료, 문제 없음). 다만 이 함수가 이제 backend 전역에서 import 가능한 공개 API 가 됐으므로, 향후 새 호출부가 자기 sanitizer 와 다른 `maxDepth`/경계 연산자를 쓰면 두 표면의 strip 깊이가 조용히 갈릴 수 있다는 점은 maintainability 리뷰의 관련 지적과 함께 참고.

- **[INFO]** `stripExternalOnlyFields` 는 입력을 변형하지 않음(no-mutation) — 직접 확인, 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:45-86` (`stripDeep`)
  - 상세: object/array 각 분기 모두 `out` 을 `null` 로 시작해 실제 변경이 있을 때만 `{...obj}`/`value.slice()` 로 얕은 복제하고, 변경이 없으면 원본 참조를 그대로 반환한다(`out ?? value`). `websocket.service.ts:454`(`stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)`) 호출 시점은 `broadcastToChannel(channel, eventType, wireEnvelope)`(내부 WS full-payload 브로드캐스트, `:446`) **이후**인데, strip 이 `wireEnvelope` 자체를 변형하지 않으므로 내부 WS 채널이 받은 payload 와 이후 재사용 가능성에 영향이 없다. `interaction.service.ts` 쪽도 `deepRedactSecrets` 가 반환한(캐시될 수 있는, `DEEP_REDACT_CACHE` WeakMap 키가 원본 `nodeExec.outputData`) 객체를 strip 이 그대로 mutate 하지 않고 clone-on-write 하므로, 캐시된 redact 결과가 strip 호출로 오염되는 일도 없다. `__proto__` own-key 오염 방지(스프레드 우선 + `Object.defineProperty` 중복 방어)는 직전 라운드에서 뮤테이션 테스트로 이미 실증됐다(RESOLUTION `10_32_27` W1).
  - 제안: 없음 (문제 없음, 확인용 기록).

- **[INFO]** 이번 diff 는 신규 전역 변수·환경 변수 읽기/쓰기·네트워크 호출을 도입하지 않는다
  - 위치: 전체 diff (`CHANGELOG.md`, `interaction.service.ts`/`.spec.ts`, `websocket.service.ts`/`.spec.ts`, `strip-external-only-fields.ts`, `plan/`·`review/` 문서)
  - 상세: `EXTERNAL_STRIPPED_FIELDS`(`strip-external-only-fields.ts:31`)는 `as const` 불변 배열로 모듈 스코프 상수이며 런타임에 변경되지 않는다(이전에도 `websocket.service.ts` 안에서 동일한 형태의 모듈 상수였고, 이번엔 위치만 옮겨졌다). `process.env` 접근, 신규 `fetch`/HTTP client 호출, 파일 I/O 는 diff 전체에서 발견되지 않았다(`plan/`·`review/` 하위 파일은 orchestrator/개발자가 직접 `Write` 한 문서 산출물이며 코드 실행에 의한 파일시스템 부작용이 아니다).
  - 제안: 없음.

## 요약

핵심 변경은 REST 스냅샷(`InteractionService.getStatus`)에도 fanout 과 동일한 `stripExternalOnlyFields` 를 적용해 `llmCalls` 누출 표면을 닫은 것과, 그 함수를 module-private 단일 인자 형태에서 `shared/utils` 의 exported 2-인자(`value, maxDepth`) 형태로 승격한 것이다. 시그니처 변경의 영향 범위를 전수 grep 으로 확인한 결과 이 diff 가 갱신한 두 호출부(websocket, interaction) 외에 잔존 호출자가 없고, `maxDepth` 는 TS 필수 인자라 누락 시 컴파일 타임에 걸린다. `stripDeep` 은 clone-on-write 로 입력(`wireEnvelope`, `deepRedactSecrets` 결과)을 mutate 하지 않아 내부 WS 브로드캐스트나 `deepRedactSecrets` 의 WeakMap 캐시를 오염시키지 않는다. REST 응답 shape 가 `llmCalls` 필드 소멸로 바뀌는 것은 공개 인터페이스 변경이지만, 의도된 보안 수정이고 CHANGELOG 에 운영 영향까지 명시돼 있어 부작용 관점에서 추가 조치가 필요한 항목은 없다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 형태의 새로운 부작용은 발견되지 않았다.

## 위험도

LOW
