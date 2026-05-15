## 발견사항

- **[INFO]** 에러 경로에 DB 쓰기 추가
  - 위치: `integrations.controller.ts` catch 블록 (약 310~318행)
  - 상세: `callbackContextOf(err)` 로 컨텍스트 식별 후 `markIntegrationCallbackError`를 `await` 호출한다. 에러 응답 경로에 DB round-trip이 추가되었으나, (1) 에러 경로는 hot path가 아니고, (2) 팝업은 어차피 4초 지연 후 닫히므로 사용자 체감 지연은 없다. 실질적 문제 없음.

- **[INFO]** `lastError: Record<string, unknown>` 전체 페이로드 노출
  - 위치: `integration-response.dto.ts` `lastError` 필드
  - 상세: `additionalProperties: true`인 JSON 블롭 전체가 integrations 목록 API 응답에 포함된다. 에러 메시지에 긴 스택트레이스나 OAuth 응답 본문이 담겨 저장된 경우 목록 조회 응답 크기가 증가한다. 현재 `last_error`는 `{code, message, at}` 구조로 제한 저장(spec §10.4)되어 있어 실제 크기는 작겠지만, DTO 레벨에서 구조를 명시(`{code: string; message: string; at: string}`)하면 직렬화 최적화와 문서화를 동시에 얻을 수 있다.
  - 제안: 필요 시 타입을 `{ code: string; message: string; at: string } | null`로 구체화.

- **[INFO]** `computeStatus`의 `statusReason` 조건 분기
  - 위치: `status-badge.tsx` `computeStatus` 함수
  - 상세: `pending_install` 블록 내 `integration.statusReason` 조건 분기는 O(1) 문자열 비교이며, `expired` 블록의 `install_timeout` 비교도 동일. 렌더링 경로에서 문제없음.

---

### 요약

이번 변경은 callback 실패 관측성 추가(변경 0)에 집중된 소규모 패치로, 성능 측면에서 실질적 위험은 없다. 에러 경로에 DB 쓰기 한 건이 추가되었으나 popup의 4초 지연 구간 안에서 완료되므로 UX 영향이 없다. `lastError` 필드의 타입을 구체화하면 응답 페이로드를 예측 가능하게 유지할 수 있으나 현재도 스펙상 작은 구조체로 제한되어 있어 즉각 조치가 필요한 수준은 아니다.

### 위험도

**NONE**