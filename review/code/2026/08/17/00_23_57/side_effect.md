# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 전역 `WeakMap` 캐시의 적용 범위가 `outputData`/`inputData` 컬럼까지 확장됨
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:158`(`DEEP_REDACT_CACHE`), `codebase/backend/src/modules/websocket/websocket.service.ts:91`(`SANITIZE_CACHE`)
  - 상세: `deepRedactSecrets`/`sanitizePayloadForWs` 는 모듈 스코프 `WeakMap`(프로세스 전역, depth-0 객체 identity 키)을 이미 갖고 있었고(선존 패턴, 이번 diff 는 리터럴 `'***'`/`'[REDACTED]'` 를 export 상수로 치환했을 뿐), 이번 변경으로 이 캐시를 거치는 호출부가 `error` 단일 컬럼에서 `outputData`(신규) 로 넓어졌다. 캐시 키가 값이 아니라 **객체 참조**라서 서로 다른 컬럼·행 간 오염 가능성은 없음을 확인했다(각 DB row 는 매 조회마다 새 객체). `deepRedactSecretsPreserving`(WS wire 경로)은 명시적으로 이 캐시를 우회하도록 구현·테스트되어 있어(`sanitize-error-message.spec.ts` "캐시를 공유하지 않는다" 케이스) 옵션이 다른 두 변형 간 오염도 없다. 실질 위험은 낮으나, 같은 객체 참조가 마스킹 이후 **제자리 변형(in-place mutation)** 되어 재사용되는 새 호출부가 생기면 캐시가 stale 결과를 돌려줄 수 있다는 전제는 여전히 유효하다.
  - 제안: 조치 불필요(설계 의도대로 동작). 향후 이 캐시를 거치는 새 호출부를 추가할 때 "같은 객체 참조를 마스킹 후 mutate 하지 않는다"는 불변식을 유지할 것.

- **[INFO]** WS 내부 wire envelope 의 payload 바이트가 바뀌는 프로토콜 동작 변경(공개 인터페이스 영향, 문서화됨)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387`(`maskWireEnvelope`), `:408`(`toFanoutEnvelope`)
  - 상세: 종전에는 "인증된 내부 WS(에디터) 채널은 debug 필드(`llmCalls`)를 포함한 full payload 를 수신"했으나, 이번 변경으로 `emitExecutionEvent`/`emitNodeEvent` 모두 wire 단계에서 `deepRedactSecretsPreserving` 값-마스킹을 거친다(`llmCalls` 하위 트리만 예외). 기존 WS 클라이언트(에디터 프런트엔드)가 `error`/`input`/`output` 등 자유 텍스트 필드의 원문을 기대하는 코드가 있다면 그 바이트가 `***` 로 바뀐다. 이는 **의도된 결정**이며 CHANGELOG(`⚠️ wire 변화`), EIA §R17, 프런트엔드 유저 가이드(`run-results.mdx`/`.en.mdx`)에 이미 반영되어 있어 통지되지 않은 부작용은 아니다.
  - 제안: 조치 불필요. 프런트엔드가 `outputData`/`error` 원문에 의존하는 별도 로직(예: 자격증명 파싱)이 있는지는 이 PR 범위 밖이라 별도 확인 권장(문서상 언급 없음).

- **[INFO]** 공개(export) 타입 `ResponseExecution`/`ResponseNodeExecution` 필드 확장 — 시그니처 성격의 인터페이스 변경, 영향 범위 자체 검증됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:147`(`ResponseExecution`), `:162`(`ResponseNodeExecution`)
  - 상세: 두 타입 모두 `outputData` 가 `Record<string, unknown>`(non-null) → `Record<string, unknown> | null` 로 넓어졌다. 이 저장소에서 `import` 로 이 타입을 소비하는 소스 모듈이 있는지 `grep` 으로 독립 재검증했고, `background-runs.service.ts` 주석 내 텍스트 언급 1건 외 실제 타입 소비자는 0건이었다(RESOLUTION.md 의 "INFO 8" 처리 내용과 일치). `nest build` 로도 확인됐다는 기록이 있어 회귀 위험은 낮다.
  - 제안: 조치 불필요.

- **[INFO]** `ExecutionsService.stop()` 반환 계약 변경 — 내부 호출부 영향 없음을 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:900`(`stop`)
  - 상세: 종전 `stop()` 은 마스킹되지 않은 엔티티 참조를 그대로 반환했으나, 이제 `toResponseExecution` 관문을 통과한 마스킹된 **복사본**(`ResponseExecution`)을 반환한다. 내부 호출부(`external-interaction/interaction.service.ts:226,248`, `hooks/hooks.service.ts:407`)가 반환값을 실제로 버리는지 직접 grep 으로 재확인했고, 셋 다 `await this.executionsService.stop(...)` 형태로 반환값을 캡처하지 않아 영향이 HTTP 응답 표면 하나로 국한된다는 JSDoc 주장이 사실과 일치한다.
  - 제안: 조치 불필요.

## 요약

리뷰 대상 diff(EIA §R17 잔여 마스킹 확장 — WS emit 값-패턴 마스킹 + 내부 REST `outputData` 마스킹 + `inputData` 마스킹 철회)는 전반적으로 순수 함수(`redactStoredDataForResponse`/`deepRedactSecrets*`) 기반의 copy-on-change 변환이며, DB 원본이나 호출자가 넘긴 입력 객체를 in-place mutate 하는 코드는 발견되지 않았다. 새로 도입된 전역 상태는 기존 WeakMap 캐시의 적용 범위 확장뿐이고 객체-identity 키 특성상 교차 오염 경로는 없다. WS wire payload 바이트 변경과 `ResponseExecution`/`ResponseNodeExecution` 타입 확장은 성격상 "인터페이스 변경"에 해당하지만, PR 스스로가 CHANGELOG·spec·Swagger·유저 가이드에 명시적으로 공지했고 영향 범위(0 외부 소비자, `stop()` 반환값 미사용 내부 호출부 3곳)를 실측으로 재검증한 근거가 코드 주석과 RESOLUTION.md 에 남아 있다. 환경 변수 읽기/쓰기, 예상치 못한 파일시스템 접근, 신규 네트워크 호출, 전역 변수 신설은 관찰되지 않았다.

## 위험도

LOW
