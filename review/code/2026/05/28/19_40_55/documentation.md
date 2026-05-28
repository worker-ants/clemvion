# Documentation Review — cafe24 MCP bridge 활동 로그 api 식별 fix

## 발견사항

### [INFO] `apiInfo` 인라인 주석이 spec 참조를 정확히 명시
- 위치: `cafe24-mcp-tool-provider.ts` 신규 블록 (라인 ~1596–1604)
- 상세: `INT-US-05` 사용자 스토리 식별자, `spec/conventions/cafe24-api-metadata.md §7.5` 와 `spec/5-system/11-mcp-client.md §8.3` 두 SoT 를 함께 인용한다. spec 에서 직접 확인한 결과 두 참조 모두 실재하며 내용이 일치한다 — §7.5 는 catalog key 형식 (`cafe24.<resource>.<operation>`) 을 명문화하고, §8.3 표는 Internal Bridge 경로의 `api_label`/`api_method`/`api_path` 채움 의무를 기록하고 있다. 주석 정확성 문제 없음.

### [INFO] 테스트 주석이 spec 링크를 적절히 반복
- 위치: `cafe24-mcp-tool-provider.spec.ts`, 두 `logUsage` 검증 블록
- 상세: 성공 경로 주석 (`// INT-US-05 — MCP bridge 경로도 활동 로그에 api 식별 정보 동반. // spec/...§7.5 + spec/...§8.3.`) 과 실패 경로 주석 (`// 실패 경로에서도 api 식별 정보가 동반돼야...`)이 각각 검증 의도를 충분히 설명한다. 공개 API 가 아닌 테스트 파일이므로 JSDoc 은 불필요하다.

### [INFO] `plan/in-progress/cafe24-mcp-usage-api.md` 가 변경 이력·원인·범위를 잘 기술
- 위치: `plan/in-progress/cafe24-mcp-usage-api.md` 전체
- 상세: 버그 원인(PR #338 에서 MCP bridge 경로 누락), 진단 표, 변경 범위(3개 항목), Phase 체크리스트가 모두 포함되어 있다. CHANGELOG 가 별도로 없는 프로젝트 구조에서 plan 문서가 그 역할을 대체하고 있으므로 변경 이력 관점에서 적절하다.

### [WARNING] spec §8.3 표의 컬럼명 표기와 구현 파라미터명 표기 사이의 용어 불일치
- 위치: `spec/5-system/11-mcp-client.md §8.3` 표 vs `integrations.service.ts` `logUsage` 파라미터
- 상세: spec §8.3 은 DB 컬럼을 `api_label` / `api_method` / `api_path` (snake_case) 로 기록하는 반면, `logUsage` 의 `api` 파라미터 내부 키는 `label` / `method` / `path` 이다. `plan/in-progress/cafe24-mcp-usage-api.md` 의 원인 섹션도 `api_label`/`api_method`/`api_path` 를 직접 인용한다. 오해 소지는 낮지만, 독자가 spec → 코드 추적 시 혼란을 느낄 수 있다.
- 제안: plan 문서의 원인 설명에 `(logUsage api.label 파라미터 → DB api_label 컬럼)` 처럼 매핑을 한 줄 덧붙이거나, spec §8.3 표에 "logUsage 파라미터명: `api.label`" 주기를 추가하면 추적 경로가 명확해진다. 필수는 아님.

### [WARNING] `Cafe24McpToolProvider` 클래스 JSDoc 에 `api` 식별 정보 로깅 동작이 미기술
- 위치: `cafe24-mcp-tool-provider.ts` 클래스 상단 JSDoc (라인 ~1236–1248)
- 상세: 기존 JSDoc 은 MCP tool 명명 규칙, McpToolProvider 와의 공존 방식, `matches()` 우선순위 등을 설명하지만, 이번 변경으로 추가된 "활동 로그에 `api` 식별 정보(`label`/`method`/`path`)를 항상 첨부한다" 는 행동은 언급되어 있지 않다. `execute()` 자체에도 별도 JSDoc 이 없다.
- 제안: 클래스 JSDoc 또는 `execute()` 메서드에 아래 수준의 한 줄을 추가하면 충분하다.
  ```
  * execute() logs api.label/method/path on every logUsage call
  * (INT-US-05; spec/conventions/cafe24-api-metadata.md §7.5).
  ```
  현재 메서드 내부 인라인 주석으로 어느 정도 커버되므로 중요도는 WARNING 수준.

### [INFO] `Cafe24TransportFailedError` 실패 케이스의 `logUsage` 검증에는 `api` assertion 미추가
- 위치: `cafe24-mcp-tool-provider.spec.ts`, `translates Cafe24TransportFailedError` 테스트 (라인 ~893–899)
- 상세: `CAFE24_AUTH_FAILED` 실패 경로에는 이번 변경으로 `api` assertion 이 추가됐으나, `CAFE24_TRANSPORT_FAILED` 및 기타 오류 경로의 `logUsage` 검증에는 `api` 항목이 없다. 구현 코드에서는 두 경로 모두 동일한 `api: apiInfo` 를 전달하므로 동작상 커버는 된다. 그러나 테스트 문서화 관점에서 일관성이 부족하다.
- 제안: `CAFE24_TRANSPORT_FAILED` 케이스의 `logUsage` 기댓값에도 `api: { label: ..., method: ..., path: ... }` 검증을 추가하면 문서화 및 회귀 방지 측면에서 완결성이 높아진다. 결함 차단에 필수적이지는 않아 INFO 에서 WARNING 으로 상향 표기.

### [INFO] README·CHANGELOG 업데이트 불필요
- 상세: 이번 변경은 이미 spec 에 명문화된 행동(`§8.3`)의 구현 누락을 메우는 버그 픽스이다. 사용자 대면 API 인터페이스나 설정 옵션이 변경되지 않았으므로 README 나 외부 API 문서 업데이트가 필요하지 않다.

### [INFO] 환경변수·설정 옵션 변경 없음
- 상세: `apiInfo` 구성에 새 환경변수나 설정이 없다. 문서화 누락 없음.

---

## 요약

변경 범위가 좁은 버그 픽스 (spec §8.3 약속의 구현 누락 보완)이며, 핵심 변경 로직의 인라인 주석과 spec 참조가 모두 정확하다. plan 문서가 변경 이력 역할을 적절히 수행한다. 주요 약점은 두 가지로, 클래스 레벨 JSDoc 에 새 동작이 기술되지 않은 점과 `CAFE24_TRANSPORT_FAILED` 실패 경로의 `logUsage` 검증에 `api` assertion 이 없어 테스트 문서화 일관성이 낮다는 점이다. 두 사항 모두 즉각 차단 이슈는 아니다.

## 위험도

LOW
