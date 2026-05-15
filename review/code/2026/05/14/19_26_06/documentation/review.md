## 발견사항

---

### [WARNING] `lastError` DTO 필드 — Swagger 스키마 불완전

- **위치**: `integration-response.dto.ts` — `lastError` 필드 `@ApiPropertyOptional`
- **상세**: `type: 'object', additionalProperties: true` 로 선언되어 있어 Swagger UI 에서 `lastError` 의 실제 구조(`code`, `message`, `at`)가 노출되지 않는다. JSDoc 주석(`/** 마지막 에러 요약 \`{ code, message, at }\` */`)에 구조가 기술되어 있지만, Swagger 문서에는 반영되지 않아 API 소비자(프론트엔드, 연동 개발자)가 Swagger만 보면 필드 형태를 알 수 없다.
- **제안**:
  ```ts
  @ApiPropertyOptional({
    type: 'object',
    nullable: true,
    description: '마지막 에러 진단 스냅샷. callback/노드 실행 실패 시 기록됨.',
    properties: {
      code:    { type: 'string', example: 'OAUTH_TOKEN_EXCHANGE_FAILED' },
      message: { type: 'string', example: 'Failed to exchange authorization code' },
      at:      { type: 'string', format: 'date-time' },
    },
  })
  ```

---

### [WARNING] `status` 필드 enum — `pending_install` 의미 누락

- **위치**: `integration-response.dto.ts:35` — `@ApiProperty({ enum: [..., 'pending_install'] })`
- **상세**: `pending_install` 값이 enum에 추가됐지만 `@ApiProperty`에 `description`이 없다. 기존 값(`connected`, `expired`, `error`)도 의미 없이 나열되어 있어, API 소비자가 이 상태의 의미(「Cafe24 Private 앱 폼 제출 완료, Test Run 콜백 미수신」)를 Swagger에서 파악할 수 없다.
- **제안**: `description` 필드를 추가하거나 최소한 `pending_install` 의미를 주석 형태로 enum 옆에 명시.

---

### [WARNING] `callbackContextOf` — JSDoc 검증 불가

- **위치**: `integrations.controller.ts:52` — `callbackContextOf` import
- **상세**: `integration-oauth.service.ts` 의 diff가 생략되어 `callbackContextOf` 함수의 JSDoc 존재 여부를 확인할 수 없다. 이 함수는 controller가 error 객체에서 컨텍스트를 추출하는 핵심 계약이며, 반환 타입(`{integrationId, workspaceId, mode}` 또는 `null`)과 인자 타입(`unknown`)이 공개 인터페이스로서 문서화되어야 한다.
- **제안**: `callbackContextOf(err: unknown): { integrationId: string; workspaceId: string; mode?: string } | null` 형태의 JSDoc 확인 및 추가.

---

### [INFO] `renderCallbackHtml` 클로즈 딜레이 — 4000ms 선택 근거 미기록

- **위치**: `oauth-callback.template.ts` — `setTimeout(function(){ window.close(); }, 4000)`
- **상세**: 추가된 주석이 WHY(팝업이 postMessage 리스너에 닿지 않아 HTML이 유일한 피드백 채널)를 잘 설명하지만, 구체적인 4000ms 수치의 근거가 없다. 테스트 파일(`:1000ms` 이상 체크)과 실제 구현(4000ms) 사이의 의도적 여유분이 불명확하다.
- **제안**: 주석에 `// 4 s — 충분히 읽을 시간. postMessage 소비 브라우저에서는 이미 닫혔으므로 무해` 한 줄 추가.

---

### [INFO] `status-badge.tsx` — `spec` 섹션 참조 인라인 주석

- **위치**: `status-badge.tsx:22-26`
- **상세**: `// spec/2-navigation/4-integration.md §10.4` 참조가 주석에 포함되어 있다. 이 패턴은 기존 코드베이스에서 일관성이 있는지 확인이 필요하다. 규약으로 정착된 패턴이라면 유지가 맞지만, 단발성이라면 spec 경로가 이동할 경우 dead reference가 된다.
- **제안**: 단일 패턴으로 유지하되, CLAUDE.md 코드베이스 규약에 "spec 참조 주석 허용 여부"를 명시할 것을 권장.

---

### [INFO] 테스트 주석 — non-null assertion 근거 불명확

- **위치**: `oauth-callback.template.spec.ts:88` — `expect(Number(match![1])).toBeGreaterThanOrEqual(1000)`
- **상세**: `match!` 의 non-null assertion은 바로 위의 `expect(match).not.toBeNull()`이 선행 단언이므로 Jest 실행 순서상 안전하지만, 정적 분석 관점에서는 설명이 없다. 테스트 내 주석으로 짧게 명시하면 미래 독자에게 도움이 된다.
- **제안**: `// match is asserted non-null above` 또는 `const [, delayStr] = match ?? [];` 형태로 명시적 처리.

---

## 요약

전체적으로 이번 변경은 **문서화 품질이 양호**하다. 새 필드·동작에 대한 WHY 주석이 의도적으로 삽입됐고(`closeScript`, `callbackContextOf` 호출 맥락, `status-badge` 분기 이유), 테스트 설명도 기대 동작을 명확히 기술한다. 주요 미비는 **`lastError` DTO의 Swagger 스키마 불완전**으로, API 소비자가 실제 응답 구조를 Swagger UI만으로 파악하기 어렵다. 그 외 `pending_install` enum 값의 의미 누락과 `callbackContextOf` JSDoc 검증 불가가 Warning 수준이며, 구현 복잡도 대비 인라인 문서화는 충분히 이루어져 있다.

## 위험도

**LOW** — Critical 위배 없음. Warning 2건(DTO Swagger 스키마, callbackContextOf JSDoc)은 API 소비자 경험에 영향을 주나 기능 동작을 막지 않는다.