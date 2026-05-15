## 보안 코드 리뷰 결과

---

### 발견사항

**[WARNING] `details` 필드의 스택 트레이스 / 원본 입력 노출**
- 위치: `spec/5-system/3-error-handling.md` - `output.error.details` 필드 정의
- 상세: `details` 필드에 `stack / originalInput / attempts / missingFields` 등을 허용한다고 명시. `originalInput`에는 사용자 PII, 자격증명, 민감 데이터가 포함될 수 있음. 이 데이터가 에러 포트를 통해 다운스트림 노드로 전달되고 DB에 영구 저장되면 `$node["X"].output.error.details.originalInput`으로 표현식에서 접근 가능.
- 제안: `details`에서 `originalInput` 포함을 제거하거나, 저장 전 민감 필드를 마스킹하는 레이어를 `buildErrorEnvelope` 레벨에서 강제화. `error-codes.ts`의 `buildErrorEnvelope`에 allowlist 기반 필터 추가 권장.

**[WARNING] `config` echo에 credential이 포함될 위험**
- 위치: `spec/5-system/3-error-handling.md` - Route to Error Port 예시, `spec/5-system/4-execution-engine.md` - `NodeHandlerOutput.config` 정의
- 상세: 에러 포트 출력 envelope의 `config` 필드에 "credentials 제외"를 주석으로만 명시. 런타임 강제 제거 로직이 별도로 존재하지 않으면 핸들러 구현 실수로 credential이 `output.error.config`에 포함될 수 있음. 에러 발생 시 일반 성공 경로와 동일한 sanitize 레이어를 거치는지 명확하지 않음.
- 제안: `buildErrorEnvelope`가 `config` 파라미터를 받는 시그니처로 확장 시 `sanitizeConfig(config, CREDENTIAL_KEYS)` 헬퍼를 반드시 통과하도록 강제화. 에러 포트 경로가 일반 `NodeHandlerOutput.config` sanitize 파이프라인을 우회하는지 검토 필요.

**[INFO] Migration 스크립트의 DB 직접 접근 및 dry-run 없는 apply 위험**
- 위치: `backend/src/scripts/migrate-node-output-refs.spec.ts` - `main()` 경로 주석
- 상세: 테스트 파일 주석에 "DB-touching `main()` path is exercised manually"라고 명시. 자동화된 dry-run 검증 없이 prod DB에 직접 적용 시 대규모 expression 재작성 오류 발생 가능. 체크리스트에도 "권한 차단으로 사용자 직접 실행 대기" 상태.
- 제안: CI 파이프라인에서 `--dry-run` 결과를 PR artifact로 저장하는 단계 추가. `--apply` 전 diff 검토를 필수 승인 게이트로 설정.

**[INFO] `interaction.data.selectedItem`에 임의 사용자 데이터 전달**
- 위치: `spec/4-nodes/6-presentation-nodes.md` - Resumed 출력 형식의 `selectedItem`
- 상세: `selectedItem: { "title": "…" }` 형태로 클릭된 아이템의 원본 데이터가 그대로 `output.interaction.data.selectedItem`에 포함. 다운스트림 노드가 이 값을 신뢰하고 SQL/LLM 프롬프트에 직접 사용할 경우 injection 벡터가 될 수 있음.
- 제안: Spec에 "다운스트림 노드는 `selectedItem`을 신뢰할 수 없는 사용자 입력으로 취급해야 한다"는 보안 노트 추가.

**[INFO] `output.error.details.url`에 credential이 포함된 URL 저장 가능성**
- 위치: `spec/5-system/3-error-handling.md` - HTTP 에러 예시 `details: { statusCode: 502, url: "https://api.example.com/data" }`
- 상세: HTTP 에러 시 `details.url`에 원본 URL이 저장되는데, URL에 Basic Auth credential이 포함된 경우(`https://user:pass@host/path`) DB에 평문 저장됨. Stage 6에서 `configEcho.url`만 sanitize하고 실제 fetch는 원본 URL을 사용하는데, 에러 경로의 `details.url`이 sanitize를 거치는지 불명확.
- 제안: 에러 `details.url`도 `sanitizeUrlCredentials()` 헬퍼를 통과하도록 명시.

---

### 요약

이번 변경은 노드 출력 구조 표준화 및 에러 컨트랙트 명문화를 다루는 spec/migration 중심의 작업으로, 직접적인 코드 취약점보다는 **설계 레벨 보안 정책의 미완성**이 주요 위험입니다. 가장 중요한 이슈는 `output.error.details.originalInput`을 통한 민감 데이터의 의도치 않은 영구 저장·표현식 접근이며, `config` echo의 credential 제거가 에러 경로에서도 일관되게 강제되는지 구현 레벨에서 검증이 필요합니다. `buildErrorEnvelope` 헬퍼가 중앙화된 sanitize 게이트 역할을 수행하도록 확장하면 대부분의 위험을 체계적으로 차단할 수 있습니다.

---

### 위험도

**MEDIUM**