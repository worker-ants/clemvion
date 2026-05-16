# API 계약(API Contract) Review

## 발견사항

- **[INFO]** Cafe24 외부 API 와이어 포맷 규약이 테스트로 명문화됨
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` 65–153행 (신규 추가 케이스)
  - 상세: 변경된 파일은 순수 테스트 파일로, 이 프로젝트가 외부에 노출하는 REST 엔드포인트나 공개 API 계약에는 직접 영향을 주지 않는다. 다만 `Cafe24ApiClient`가 Cafe24 Admin API에 전송하는 요청 바디의 와이어 포맷(`{ shop_no?, request: { ...rest } }`)이 테스트를 통해 처음으로 명확히 검증되고 있다. 이 포맷은 Cafe24 측 API 계약이며, 클라이언트 내부에서 중앙 처리되므로 호출자(handler, MCP tool provider)와의 인터페이스는 flat body로 유지된다.
  - 제안: `shop_no` 외에 Cafe24 스펙상 top-level에 허용되는 필드가 추가로 있는지(예: `lang`) 확인하고, 있다면 해당 필드도 추출 로직과 테스트에 반영할 것. 현재 `shop_no`만 top-level 예외로 처리하고 있으므로, 사양이 확장되면 `executeWithRateLimit` 내 추출 로직이 함께 갱신되어야 한다.

- **[INFO]** DELETE 메서드에 대한 envelope 동작 테스트 누락
  - 위치: 신규 테스트 케이스 전체 (GET/PUT/POST만 커버)
  - 상세: 변경 diff는 GET, PUT, POST에 대한 envelope 동작을 검증하지만, DELETE 메서드의 경우 body를 포함하는 케이스(일부 Cafe24 API는 DELETE 시 body를 요구함)가 있는지, 그리고 envelope 적용 여부가 테스트되지 않았다.
  - 제안: Cafe24 Admin API에서 DELETE가 body를 사용하는 엔드포인트가 있다면 해당 케이스를 추가하고, envelope 적용 여부를 명확히 명세할 것.

## 요약

이번 변경은 `cafe24-api.client.spec.ts`에 테스트 케이스를 추가하는 순수 테스트 코드 변경이다. 이 프로젝트가 외부 클라이언트에 노출하는 공개 API의 엔드포인트·응답 형식·인증·버전 관리 등 API 계약 핵심 영역에는 직접적인 영향이 없다. 변경의 실질적 의미는 Cafe24 외부 API와의 통신 시 `request` envelope 래핑이 클라이언트 레이어에서 중앙 처리됨을 검증한다는 것으로, 이는 외부 API 계약 준수를 코드 수준에서 보장하는 긍정적 조치다. `shop_no` 이외 top-level 허용 필드 확장 가능성과 DELETE 메서드 커버리지만 추가로 검토하면 충분하다.

## 위험도

LOW
