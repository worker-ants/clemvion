### 발견사항

변경된 파일 6개를 API 계약 관점에서 분석했습니다.

**파일 1~3 (DTO 파일들): doc-string 전용 변경**

- **[INFO]** `create-knowledge-base.dto.ts` — `cross_encoder_llm` 설명 문자열 갱신
  - 위치: L38-39, L51-52
  - 상세: `@ApiPropertyOptional.description` 값만 변경. `(후속 구현)` 문구 제거 및 동작 설명 정확화. enum 값·필드명·타입·유효성 검증 데코레이터 무변경.
  - 제안: 해당 없음 — Swagger 문서 정합성 개선이며 계약 파괴 없음.

- **[INFO]** `rag-search.dto.ts` — `topK` 필드 description 갱신 및 `default: 5` 제거
  - 위치: L288-293
  - 상세: `@ApiPropertyOptional` 에서 `default: 5` 속성이 삭제됨. 이는 OpenAPI 스키마 상 `default` hint 가 사라지는 변경이나, 실제 서버 동작(기본값 처리 로직)은 DTO 레이어가 아닌 서비스 레이어에서 결정된다. class-validator 데코레이터·필드명·타입 무변경이므로 런타임 계약 파괴 없음. 단, API 클라이언트가 OpenAPI 스펙을 보고 `default: 5` 를 의존하는 코드 생성(SDK codegen)을 하고 있었다면 생성물 변경 가능.
  - 제안: codegen 사용처가 있다면 재생성 필요 여부 확인. 런타임 동작은 서비스 레이어 기본값 처리와 일치하는지 별도 확인 권장(LOW 이하 범위).

- **[INFO]** `update-knowledge-base.dto.ts` — `rerankLlmConfigId` description 갱신
  - 위치: L381-382
  - 상세: `(후속 구현)` 문구 제거. 필드명·타입·유효성 검증 무변경.
  - 제안: 해당 없음.

**파일 4~5 (web-chat-sdk): 공개 API 시그니처 변경**

- **[WARNING]** `byo-ui-headless.ts` — `startHeadlessChat` 함수 시그니처 파괴적 변경
  - 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` L718-726
  - 상세: 두 번째 파라미터 `firstMessage: string` 이 제거되고, `profile?: Record<string, unknown>` 이 `handlers` 뒤 네 번째(optional) 파라미터로 이동. 이 파일은 `examples/` 디렉토리의 헬퍼 함수이며 패키지 공개 `index.ts` 에서 re-export 되는지에 따라 breaking change 범위가 달라진다. README 에서 직접 참조하고 있어 외부 개발자가 이 패턴을 복사해 사용할 수 있음. `firstMessage` 제거는 spec §R6 에 의한 의도된 변경이나, 기존 사용자 코드가 `startHeadlessChat(apiBase, path, "첫 메시지", handlers)` 형태로 호출했다면 런타임 오류 또는 의도치 않은 동작 발생.
  - 제안: 패키지 `package.json` exports 에 `examples/` 가 포함되어 있는지 확인. 포함된다면 major version bump 또는 deprecation notice 필요. examples 전용이라면 README 마이그레이션 가이드(before/after) 추가 권장.

- **[INFO]** `triggerWebhook` 호출 payload — `{ firstMessage }` → `{ profile }` 변경
  - 위치: `codebase/packages/web-chat-sdk/README.md` L596, `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` L736-739
  - 상세: webhook 엔드포인트로 전송되는 payload 키가 변경됨. 서버 측 webhook 엔드포인트가 `firstMessage` 필드를 이미 수신하지 않도록 변경되어 있다는 가정 하에 클라이언트 코드가 정렬됨. 서버-클라이언트 동기화 여부는 이번 diff 범위 밖이므로 별도 확인 필요.
  - 제안: 백엔드 webhook 핸들러에서 `firstMessage` 가 완전히 제거(무시)되는지 확인.

**파일 6 (plan 문서): API 계약과 무관**

- 계획 추적 문서 갱신으로 API 계약 관점 분석 대상 아님.

---

### 요약

이번 변경의 대부분은 Swagger/JSDoc 문서 문자열 정정(stale `후속 구현` 제거, 동작 설명 정확화)으로 API 런타임 계약에는 영향을 주지 않는다. 주목할 지점은 두 가지다: (1) `rag-search.dto.ts` 에서 `default: 5` OpenAPI hint 제거 — codegen 기반 클라이언트가 있다면 재생성 필요 여부 확인 필요(LOW). (2) `byo-ui-headless.ts` 의 `startHeadlessChat` 시그니처 변경 — `firstMessage: string` 파라미터 제거는 examples 범위지만 외부 개발자가 참조하는 공개 패턴이므로, 이 파일이 패키지 exports 에 포함된다면 breaking change 처리(major bump 또는 deprecation)가 필요하다. 그 외 하위 호환성·버전 관리·에러 응답·URL 설계·페이지네이션·인증 관련 계약 변경은 없다.

### 위험도

LOW
