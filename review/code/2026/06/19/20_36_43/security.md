# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] 입력 검증 — 폼 필드 화이트리스트 폴백 (form-interaction.service.ts)
- 위치: `codebase/backend/src/modules/execution-engine/form-interaction.service.ts` — `processFormResumeTurn` 내 `interactionData` 구성 로직 (allowedFieldNames.size === 0 분기)
- 상세: 폼 제출 payload의 `formData`를 `node.config.fields`에 정의된 필드명으로 화이트리스트 필터링하는 로직이 이미 구현되어 있다. 단, `allowedFieldNames.size === 0`인 경우(필드 정의 없음) 전체 키 통과 폴백이 존재한다. 이 경로에서는 미정의 키(XSS payload, 과도한 데이터)가 그대로 저장·전파될 수 있다.
- 제안: `allowedFieldNames.size === 0` 시 빈 객체를 반환하거나, 최소한 경고 로그를 남기는 방향을 검토한다. 필드 없는 폼이 유효한 유스케이스라면 해당 분기에 의도를 명시하는 주석을 추가한다.

### [INFO] 에러 메시지 — BullMQ job 실패 로그에 원본 메시지 포함 (continuation-execution.processor.ts)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `onFailed` 메서드 (logger.warn 호출 부분)
- 상세: 실패 로그에 `err?.message ?? err`가 그대로 포함된다. `err.message`는 LLM API 응답 본문, 외부 서비스 오류 메시지 등 민감 정보를 담을 수 있다. 현재 `Logger.warn`은 서버 측에만 기록되어 클라이언트 노출 경로는 없으나, 로그 집계 시스템 전송 시 민감 정보가 평문으로 저장될 수 있다.
- 제안: 외부 API 오류 메시지가 포함될 경우 민감 필드 마스킹 정책을 로그 파이프라인 수준에서 적용하는 것을 권장한다.

### [INFO] payload 런타임 타입 미검증 — TypeScript 타입 단언만 사용 (continuation-execution.processor.ts)
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` — `button_click`, `ai_message`, `retry_last_turn` 케이스의 payload 캐스팅
- 상세: `payload as { buttonId?: string } | undefined` 등 TypeScript 타입 단언만으로 처리된다. BullMQ 큐 데이터가 클라이언트 WebSocket 메시지에서 유래하므로 예상치 않은 타입이 들어올 수 있으나, `?.` 옵셔널 체이닝으로 undefined가 안전하게 처리된다. 즉각적 취약점은 아니다.
- 제안: payload 구조가 복잡해지면 Zod 등 런타임 스키마 검증 추가를 검토한다.

### [INFO] forwardRef 확대 — 잘못된 주입 시 런타임 undefined 위험 (execution-event-emitter.service.ts, websocket.gateway.ts)
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`; `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: 이번 변경으로 `forwardRef` 사용이 확대됐다. `forwardRef`는 순환 DI 해소 수단으로 적법하지만, 모듈 설정 오류 시 `undefined` 주입이 조용히 통과해 런타임에야 오류가 드러난다. 인증 관련 서비스가 undefined 상태로 동작할 경우 우회 경로가 생길 수 있다.
- 제안: 현재 spec 파일에서 mock 등록이 정상적으로 이루어지고 있어 테스트 커버리지는 적절하다. 통합 테스트에서 주입 인스턴스가 undefined가 아닌지 확인하는 어서션을 포함하는 것을 권장한다.

### [INFO] node_modules symlink 커밋
- 위치: diff 파일 14 — `node_modules`가 symlink(`120000`)로 커밋됨, 절대 경로 `/Volumes/project/private/clemvion/node_modules` 참조
- 상세: `node_modules`를 심볼릭 링크로 git에 추가한 변경이 포함되어 있다. 로컬 머신 절대 경로를 가리키므로 이식성이 없고, 의존성 감사(npm audit, Snyk 등) 기준점 추적이 어려워진다.
- 제안: `node_modules`를 `.gitignore`에 추가하여 소스 추적에서 제외한다. 강제 추가된 경우 해당 항목을 제거한다.

---

## 요약

이번 변경은 `EngineDriver` 인터페이스 ISP 적용과 DI 그래프 단방향 정리가 핵심이다. 보안 관점에서 SQL 인젝션, XSS, 커맨드 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화 알고리즘은 발견되지 않았다. 폼 입력 화이트리스트 필터링이 이미 구현되어 있고(WARN #8 대응), WebSocket 이벤트 핸들러 수준의 인증도 기존 패턴을 유지한다. 주목할 사항은 `allowedFieldNames.size === 0` 폴백으로 필드 정의가 없는 폼에서 미정의 키가 통과되는 경로, 에러 로그에 외부 API 메시지가 평문 기록되는 점, `node_modules` symlink 커밋이며 모두 INFO 수준으로 즉각적 차단이 필요한 취약점은 없다.

---

## 위험도

LOW
