## 발견사항

### [CRITICAL] `send-email.handler.ts` — 죽은 코드(dead ternary)로 에러 코드 구분 불가
- **위치**: `send-email.handler.ts` (catch 블록 내 `code` 변수 정의)
- **상세**: 두 브랜치가 동일한 값 `'EMAIL_SEND_FAILED'`를 반환하므로, `IntegrationError`(INTEGRATION_TYPE_MISMATCH / INTEGRATION_NOT_CONNECTED / INTEGRATION_INCOMPLETE)와 SMTP 전송 실패를 `output.error.code`로 구분할 수 없음.
  ```typescript
  const code =
    err instanceof IntegrationError
      ? 'EMAIL_SEND_FAILED'   // ← 의도가 err.code 였을 것
      : 'EMAIL_SEND_FAILED';  // 동일 값
  ```
- **제안**: IntegrationError 시 `err.code`를 직접 사용하거나, 설계 의도가 모두 `EMAIL_SEND_FAILED`라면 분기 자체를 제거하여 혼란 방지.

---

### [WARNING] `code.handler.ts` — `output.error.code`와 `meta.errorCode` 간 코드 불일치
- **위치**: `code.handler.ts`, `buildErrorOutput` 메서드
- **상세**: `output.error.code`는 정규화된 코드(`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`)를 사용하지만, `meta.errorCode`는 원본 코드(`EXECUTION_TIMEOUT`, `CODE_RUNTIME_ERROR`, `CODE_SYNTAX_ERROR`)를 유지함. 두 필드를 같이 참조하는 소비자는 코드 체계가 달라 혼동 가능. 테스트도 `meta.errorCode`로 원본 코드를 검증하므로 의도적 설계라면 문서화가 필요.
- **제안**: 스펙 또는 주석으로 두 필드의 역할(정규화 vs. 디버그 원본) 명시.

---

### [WARNING] `database-query.handler.ts` — `QUERY_FAILED` → `DB_QUERY_FAILED` 코드 변경 범위 불명확
- **위치**: `database-query.handler.ts` (fallback 에러 코드)
- **상세**: 기존 `QUERY_FAILED`가 `DB_QUERY_FAILED`로 변경됐으나, 이 코드를 소비하는 프론트엔드 렌더러나 외부 클라이언트에 대한 업데이트 여부가 diff에 없음. 에러 코드 변경은 Breaking Change에 해당.
- **제안**: 해당 에러 코드를 참조하는 프론트엔드/문서 검색 후 일괄 업데이트 또는 마이그레이션 가이드 추가.

---

### [WARNING] `information-extractor` — waiting 상태의 `output.partial` 구현 여부 불확실
- **위치**: `information-extractor.schema.ts` (테스트 fixture), `spec/4-nodes/3-ai-nodes.md`
- **상세**: 스펙은 waiting 상태에서 `output.partial.{extracted, missingFields, collectionRetryCount}`를 내보내도록 정의하고 있으나, 스키마 테스트 fixture는 여전히 `conversationConfig`를 사용함(`// legacy resume fields retained for Stage 2`). `information-extractor.handler.ts` diff가 일부 생략되어 핸들러가 실제로 `output.partial`을 emit하는지 확인 불가.
- **제안**: 핸들러 구현과 스키마/테스트 fixture가 동일 waiting 포맷을 사용하는지 교차 검증 필요.

---

### [WARNING] `output-shape.ts:extractIeSnapshot` — `partial` 탐색 경로 우선순위 오류 가능성
- **위치**: `output-shape.ts`, `extractIeSnapshot` 함수
- **상세**: `partialTopLevel`(최상위 `raw.partial`)을 `partialNested`(`raw.output.partial`)보다 먼저 확인함. 스펙은 `output.partial`을 정규 경로로 정의하므로, 최상위 `partial` 키가 다른 의미로 존재할 경우 오탐 가능성 있음.
- **제안**: 정규 경로인 `output.partial`을 우선 탐색하고 legacy fallback 순서로 정렬.

---

### [WARNING] `handler-output.adapter.ts` — `isLegacyPortSelector` 제거 후 하위 호환성 검증 부재
- **위치**: `handler-output.adapter.ts`
- **상세**: `{ port, data, ...rest }` 형태의 레거시 port-selector envelope 처리 코드가 제거됨. 주석은 "Phase 3 완료 후 제거"라고 하나, `ai-agent.handler.ts`의 condition-based 출력이 신규 canonical shape로 교체됐는지 전체 핸들러에 걸친 검증 테스트가 없음.
- **제안**: 모든 핸들러가 canonical shape를 준수하는지 확인하는 통합 테스트 또는 타입 체크 단계 추가.

---

### [INFO] `carousel/chart/table.handler.ts` — `durationMs: 0` 하드코딩
- **위치**: 각 presentation 핸들러의 waiting_for_input 반환값
- **상세**: `meta.durationMs`가 `0`으로 고정됨. 실제 렌더링 소요 시간이 있을 경우 모니터링 데이터 왜곡 가능.
- **제안**: `Date.now() - startTime` 으로 실제 경과 시간 측정 혹은 waiting 상태에서 측정 불가임을 스펙에 명시.

---

### [INFO] `conversation-utils.ts` — `meta.turnDebug` vs `output._turnDebugHistory` fallback 체인
- **위치**: `conversation-utils.ts`, `parseHistoryMessages`
- **상세**: fallback 체인이 `topMeta?.turnDebug` → `wrapper?._turnDebugHistory` 순으로 구성되어 있음. 정상 동작하나, 두 필드가 동시에 존재하는 중간 마이그레이션 상태의 실행 결과에서 어떤 쪽이 우선되는지 주석 보완이 필요.

---

## 요약

이번 변경은 노드 핸들러 출력을 `{ config, output, meta, port, status }` 정규 형태로 통일하는 대규모 마이그레이션으로, 아키텍처 일관성 측면에서 방향성이 명확하고 레거시 fallback도 상당 부분 고려됨. 다만 `send-email.handler.ts`의 dead ternary(에러 코드 구분 불가)가 CRITICAL 이슈로, 통합 유형별 에러 라우팅 요구사항을 미충족함. 추가로 `DB_QUERY_FAILED` 코드 변경의 파급 범위, `information-extractor` waiting 상태의 `output.partial` 실 구현 여부, `output.error.code`와 `meta.errorCode` 간 코드 체계 불일치가 요구사항 완전성 관점에서 보완이 필요한 항목임.

## 위험도

**HIGH**