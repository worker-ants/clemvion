### 발견사항

- **[WARNING]** `MAKESHOP_SERVICE_UNAVAILABLE` — `INTEGRATION_SERVICE_UNAVAILABLE` 대신 노드-별 prefix 사용
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §6 에러 코드 표 — `MAKESHOP_SERVICE_UNAVAILABLE (D4)`
  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.5 / §6` Rationale 및 `spec/4-nodes/4-integration/1-http-request.md`, `2-database-query.md` 동일 조건의 `INTEGRATION_SERVICE_UNAVAILABLE` 사용 패턴; `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙
  - 상세: `__workspaceId 컨텍스트 누락 / ApiClient 미주입 (deployment 오류)`는 모든 통합 노드(http-request, database-query, send-email, cafe24)가 `INTEGRATION_SERVICE_UNAVAILABLE`로 통일하고 있다. 이 코드는 도메인이 아닌 조건의 의미(`INTEGRATION_` prefix = 통합 도메인의 배포 오류)를 기술한다. target은 `MAKESHOP_SERVICE_UNAVAILABLE`이라는 새 코드를 도입하면서 §6 주석에 "Cafe24 §6 대응"이라고 표기만 할 뿐, 왜 공유 코드를 쓰지 않고 새 코드를 신설했는지 Rationale을 제공하지 않는다. `error-codes.md §2`는 "rename은 breaking change"이며 "신규 코드는 처음부터 의미 정확한 이름을 부여"하라고 하지만, 동일한 조건에 이미 합의된 `INTEGRATION_SERVICE_UNAVAILABLE`이 있는 상황에서 그것을 재사용하지 않는 것은 코드 발산이다.
  - 제안: `MAKESHOP_SERVICE_UNAVAILABLE`을 `INTEGRATION_SERVICE_UNAVAILABLE`로 교체하거나, 별도 코드가 필요한 이유(조건이 다른 이유)를 §9 Rationale에 명시한다.

- **[INFO]** §9.1 Client-Credentials 기각 후 "구현 시 재평가 가능" 단서 — 기각 범위 모호
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §9.1 마지막 문장 "(구현 시 재평가 가능)"
  - 과거 결정 출처: 같은 절 §9.1의 기각 근거("cafe24와 다른 흐름이라 신규 인프라가 필요하고 토큰 TTL·throttle 제약이 있어 채택하지 않았다")
  - 상세: §9.1이 Client-Credentials 흐름 (b)를 명시적으로 기각하면서 "구현 시 재평가 가능"이라는 오픈 엔딩을 붙였다. 기각 Rationale과 재평가 허용이 같은 절에 공존하면, 구현자가 기각 결정을 뒤집을 때 새 Rationale 없이 재평가 결과를 적용할 수 있다. 현재 기각 결정이 명확히 기록되어 있어 기각된 대안이 직접 재도입된 것은 아니지만, 재평가 허용 범위와 조건이 명시되지 않아 향후 연속성 감사 시 판단이 어렵다.
  - 제안: "재평가 가능" 조건을 구체화한다. 예: "토큰 TTL·발급 throttle 제약이 완화되거나 cafe24 분기가 통합 인프라와 분리 가능해진 경우" 수준의 조건을 추가하면 재평가 트리거가 명확해진다.

- **[INFO]** §4.1 Timezone semantics 미확인 — 기존 합의된 KST suffix 패턴 미정 처리
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §4.1
  - 과거 결정 출처: `spec/conventions/cafe24-api-metadata.md §5 Timezone semantics` — Cafe24 에서 KST 고정 시 AI Agent 도구 description suffix 도입을 합의
  - 상세: target은 "timezone 규약은 구현 전 미확인(open question)"이라고 명시하고 "KST 고정이면 Cafe24 §4.3과 동일하게 AI Agent 도구 description suffix를 도입한다"고 조건부로 기술한다. 이는 기각이 아니라 올바른 "open question" 처리이므로 Rationale 위반은 아니다. 다만, open question 해소 후 구현자가 메타데이터 컨벤션 갱신을 누락하지 않도록 plan 문서(`makeshop-integration.md`)에도 이 항목이 구현 착수 전 확인 사항으로 명시되어야 한다.
  - 제안: plan 체크리스트 항목으로 추가하거나 §9.7 미확인 항목 목록의 "timezone" 항에 "해소 시 `makeshop-api-metadata.md §5` 갱신 의무" 주석을 추가한다.

- **[INFO]** §9.8 `buildIntegrationMeta` 일반화(C-6) — Rationale 연속성 확인됨
  - target 위치: `spec/4-nodes/4-integration/5-makeshop.md` §9.8
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §9.1` Rationale "자동 갱신 통합을 attention 술어에서 제외" + `spec/1-data-model.md §2.10` `autoRefresh` derived 필드 정의
  - 상세: target §9.8이 `autoRefresh=true`, `appUrl` derived 필드의 service registry 일반화(C-6)를 명시적으로 동반 해소 과제로 지정하고 있다. 이는 기존 Rationale("derived 필드인가": service registry 기반, DB 컬럼 아님)와 정합하며 합의된 원칙을 준수한다. 위반 없음, 확인 사항으로만 기록.

### 요약

target 문서(`spec/4-nodes/4-integration/5-makeshop.md`)의 Rationale 연속성은 대체로 양호하다. OAuth 흐름 선택(§9.1), POST/PUT envelope 미적용(§9.4), restricted scope 미도입(§9.5), 단일 호스트 + shop_uid path segment(§9.3), scope wire format(§9.2) 모두 기존 Cafe24 spec의 합의된 원칙을 참조하거나 메이크샵 고유 근거를 명시하고 있다. 주요 위험은 `MAKESHOP_SERVICE_UNAVAILABLE` 코드가 모든 통합 노드가 공유하는 합의 코드 `INTEGRATION_SERVICE_UNAVAILABLE`을 이유 없이 이탈한 점이다. 이 코드 발산은 `error-codes.md §1` 의미 기반 명명 원칙과 충돌하며 구현 시 ErrorCode enum 분기 불일치를 유발할 수 있다. Client-Credentials 재평가 단서와 timezone open question은 연속성 위반은 아니나 향후 추적 실패 위험이 있으므로 보완이 권장된다.

### 위험도

LOW
