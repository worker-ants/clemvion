### 발견사항

- **[WARNING]** `OAuthBeginDto` 신규 필드 — 프론트 ↔ 백엔드 타입 정렬 확인 필요
  - 위치: `frontend/src/lib/api/integrations.ts` +171–178
  - 상세: `appType?: "public" | "private"` 리터럴 유니온이 백엔드 DTO의 enum/string과 정확히 일치해야 함. 프론트엔드 타입이 수동 선언이므로 백엔드 `OAuthBeginDto.appType` 값이 변경될 경우 컴파일 타임 에러 없이 드리프트 발생 가능. 또한 `clientSecret`은 요청 본문에 포함되며 HTTPS 외 전송 차단을 API 레이어에서 강제하는 장치가 없음.
  - 제안: `appType` 타입을 공유 상수 또는 OpenAPI 생성 타입에서 가져오도록 추후 개선. 단기적으로는 백엔드 DTO의 enum 변경 시 프론트를 함께 수정하는 규약을 주석으로 명시.

- **[WARNING]** React Query 캐시 키 변경 — 기존 invalidate 호출 미동반 위험
  - 위치: `mcp-server-selector.tsx` +65 (`queryKey: ["integrations", "mcp-capable"]`)
  - 상세: `["integrations", "mcp"]` 키로 `invalidateQueries`를 호출하는 곳이 다른 컴포넌트에 있다면, 키 변경 이후 해당 무효화가 더 이상 이 쿼리에 적용되지 않음. RESOLUTION.md에서 "다른 컴포넌트에서 동일 키를 공유하지 않는 한 영향 없음 — grep 결과 없음"으로 처리되었으나, 향후 소비자 추가 시 조용한 버그로 재등장 가능.
  - 제안: 쿼리 키를 `MCP_CAPABLE_SERVICE_TYPES`와 같은 상수 파일에 함께 export하여 소비자와 invalidator가 동일 상수를 참조하도록 강제.

- **[INFO]** `MCP_CAPABLE_SERVICE_TYPES` 프론트 ↔ 백 수동 이중 관리 — 계약 드리프트 위험
  - 위치: `frontend/src/lib/integrations/mcp-capable-service-types.ts`
  - 상세: 파일 주석 자체에 "백엔드 twin과 함께 이동해야 함"을 명시하고 있으나, 강제 메커니즘이 없음. 새 Internal Bridge service_type 추가 시 프론트를 누락하면 MCP picker에서 해당 타입의 통합이 노출되지 않는 조용한 결손 발생.
  - 제안: 주석 수준을 넘어 향후 `/api/integrations/services` 엔드포인트로 이 목록을 단일화하는 follow-up을 plan에 포함시킬 것 (RESOLUTION.md W4 follow-up에 이미 기재됨).

- **[INFO]** `OAuthBeginDto` 기존 소비자 하위 호환 — 이상 없음
  - 위치: `frontend/src/lib/api/integrations.ts`
  - 상세: 신규 4개 필드 모두 `?:` 선택적 선언. Google/GitHub 흐름은 해당 필드를 전달하지 않아도 무방. Breaking change 없음.

---

### 요약

이번 변경의 API 계약 관점 핵심은 `POST /integrations/oauth/begin` 요청 본문에 Cafe24 전용 선택적 필드 4개(`mallId`, `appType`, `clientId`, `clientSecret`)를 추가한 것이다. 전부 Optional 선언이므로 기존 OAuth 흐름에 대한 하위 호환성은 유지된다. 이전 리뷰(C1)에서 식별된 `mallId` SSRF 방어 `@Matches` 누락은 RESOLUTION.md 기준으로 수정 완료됨. 남은 위험은 두 가지다: (1) `appType` 리터럴 타입이 백엔드 DTO와 수동 동기화이므로 드리프트 가능성이 있고, (2) React Query 캐시 키 변경이 향후 소비자 추가 시 조용한 무효화 실패를 유발할 수 있다. 전반적으로 계약 위반보다는 장기 유지보수 관점의 드리프트 위험이 주된 이슈다.

### 위험도
**LOW**