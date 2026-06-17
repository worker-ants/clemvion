# 보안(Security) 리뷰 — RetryTurnService 추출 (C-1 step4)

대상 커밋: `01e45f80f087a6a9f2ed82d365d6df709ab39445`

## 발견사항

- **[INFO]** 에러 메시지에 내부 식별자(ID) 노출
  - 위치: `retry-turn.service.ts` 라인 121–122, 128–129, 140–141, 149–151, 158–160, 179–181, 208–210, 231–233
  - 상세: `retryLastTurn` 내 에러 메시지와 `applyRetryLastTurn` 내 logger 메시지에 `nodeExecutionId`, `executionId`, `spawnedNodeExecutionId`, `nodeId` 같은 내부 DB row ID 가 그대로 포함된다. 이 메시지들은 로거(`this.logger.error/warn`) 와 throw 된 예외 객체 모두에 존재한다. throw 된 예외가 상위 WS gateway 레이어에서 클라이언트에 그대로 직렬화되어 전송될 경우, 내부 엔티티 구조·UUID 패턴이 외부에 노출된다.
  - 제안: (1) 상위 WS gateway/HTTP 응답 계층에서 에러를 code + 사용자용 메시지로 변환하여 내부 ID 를 포함한 `message` 필드가 클라이언트에 전달되지 않도록 한다. (2) 또는 `InvalidExecutionStateError`/`RetryLastTurnError` 생성 시 내부 ID 를 `detail` 필드(비직렬화)에만 보관하고 `message` 는 generic 으로 유지한다. 현재 이 변경만으로는 보안 위협이 아니나, gateway 쪽 핸들링이 확인되지 않으면 잠재 정보 노출이다.

- **[INFO]** `_retryState` 내 사용자 대화 메시지가 DB에 평문 영속
  - 위치: `retry-turn.service.ts` 라인 186–220 (`retryLastTurn` atomic consume+spawn 블록), `applyRetryLastTurn` 라인 286–288
  - 상세: `_retryState`(사용자·LLM 메시지 내역 포함)가 `NodeExecution.outputData` JSONB 컬럼에 평문으로 저장되고, spawn 된 RUNNING row 의 `inputData` 에도 동일하게 복사된다. 이는 이전 구현에도 동일하게 존재했던 사항이므로 이번 변경이 새 취약점을 도입하지는 않는다. 그러나 DB 접근 권한이 있는 내부자가 대화 내역을 조회할 수 있다.
  - 제안: 이번 PR 범위(리팩토링) 밖이나, 장기적으로 대화 내역 암호화 저장 또는 별도 분리된 저장소(TTL 기반)를 검토할 것.

- **[INFO]** TypeORM raw JSONB expression 사용
  - 위치: `retry-turn.service.ts` 라인 196–204
  - 상세: `.set({ outputData: () => \`output_data - '_retryState'\` })` 와 `.andWhere(\`jsonb_exists(output_data, '_retryState')\`)` 에 raw SQL fragment 가 사용된다. 이 expression 내에서 `'_retryState'` 는 하드코딩된 리터럴이며 외부 입력이 아니므로 SQL 인젝션 위험은 없다. `.where('id = :id', { id: nodeExecutionId })` 도 파라미터 바인딩이 올바르게 사용된다.
  - 제안: 현재 안전하나, 향후 이 패턴 확장 시 외부 입력을 raw fragment 에 직접 삽입하지 않도록 주의할 것.

- **[INFO]** `dataSource` 멤버 직접 교체 (테스트 코드)
  - 위치: `retry-turn.service.spec.ts` 라인 1666, 1946 `(service as unknown as { dataSource: unknown }).dataSource = {...}`
  - 상세: 테스트 코드에서 private-equivalent 멤버 `dataSource` 를 타입 캐스팅으로 직접 교체한다. 이는 테스트 코드이므로 프로덕션 보안에 영향이 없다. 다만 타입 시스템 우회(`as unknown as never`, `as unknown as { dataSource: unknown }`)가 과도하게 사용되어 TypeScript 안전망이 약화된다.
  - 제안: 테스트 전용이므로 수용 가능. 가능하다면 생성자에 `DataSource`를 교체 가능한 형태(설정 주입)로 노출하는 것이 더 안전하나 이번 PR 범위에서는 허용.

- **[INFO]** `clearLlmDefaultConfigCache` 가 `public` 으로 변경됨
  - 위치: `execution-engine.service.ts` diff, `engine-driver.interface.ts` 라인 119–123
  - 상세: 이전에 `private` 이었던 `clearLlmDefaultConfigCache`, `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge` 가 모두 `public` 으로 변경된다. `EngineDriver` 인터페이스로 노출되는 이 메서드들은 동일 모듈 내 `RetryTurnService` 가 소비한다. DI 경계(`ENGINE_DRIVER` 토큰) 내에서만 쓰이므로 외부 HTTP 표면으로 노출되지는 않는다. 그러나 `public` 메서드는 향후 다른 소비자가 의도치 않게 직접 호출할 수 있는 표면이 된다.
  - 제안: 현재는 허용 가능. 장기적으로 NestJS `@Module` exports 에서 `ExecutionEngineService` 의 직접 export 가 제한될 경우 이 표면은 자연히 보호된다. `EngineDriver` 인터페이스 이외 경로로 호출하는 것을 ESLint rule 또는 아키텍처 테스트로 제한하는 것을 고려.

## 요약

이번 변경은 `ExecutionEngineService` 의 retry-last-turn 생명주기를 `RetryTurnService` 로 추출하는 구조적 리팩토링이다. 코드 이동이 verbatim(동일 로직 그대로)이고, 새로 도입된 인터페이스(`EngineDriver` 추가 멤버)는 DI 토큰 경계 내에서만 소비된다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 알려진 취약 의존성 추가 등의 실질적 보안 취약점은 발견되지 않는다. 주요 관찰 사항은 (a) 에러 메시지 내 내부 ID 노출 가능성(gateway 레이어 필터링에 의존), (b) 사용자 대화 내역의 JSONB 평문 영속(기존 동일)이며, 두 가지 모두 이번 PR 이 새로 도입한 위험이 아니다.

## 위험도

NONE
