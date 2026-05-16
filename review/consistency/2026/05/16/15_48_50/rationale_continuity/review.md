# Rationale 연속성 검토 — review.md

검토 대상: `plan/in-progress/spec-draft-cafe24-public-dup-guard.md`
검토 기준 Rationale: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`

---

### 발견사항

- **[WARNING]** `tryRecoverByMallId` 회복 흐름과 "O(N) 스캔 폐기" 결정의 경계 재서술 누락
  - target 위치: 변경 1 (§9.2 OAuth begin 행) — 변경 내용이 begin-time SELECT 사전 가드를 공식 스펙 행으로 격상시키지만, 회복 흐름(`tryRecoverByMallId`)이 O(N) HMAC trial을 수행하는 점에 대한 언급 없음
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격" — "100건 mall_id 스캔 + trial HMAC 폐기"를 명시적으로 기각
  - 상세: 기존 Rationale는 O(N) mall_id 스캔 + HMAC trial 방식을 "비결정적·O(N) 비용"을 이유로 폐기했다. target draft가 제안하는 변경 1(begin-time SELECT 사전 가드)에는 이 폐기 결정과의 충돌이 없으나, 동일 spec에 이미 기술된 `Cafe24 install_token mismatch 회복 흐름` Rationale가 O(N) HMAC trial을 404 fallback 경로로 재도입하고 있다. target draft가 이 두 Rationale 항목 간의 경계("정상 흐름은 단일 row 조회 — 회복 분기만 O(N)") 를 §9.2 spec 행에 참조 표기 없이 생략한다. 독자가 "O(N) 스캔 폐기" 결정과 회복 분기의 공존이 모순처럼 보일 수 있다.
  - 제안: 변경 1의 §9.2 begin 행 설명 또는 변경 4 Rationale에 "정상 경로는 install_token 단일 row 조회이며, O(N) HMAC trial은 404 fallback 전용 회복 분기에서만 제한적으로 작동함 — 폐기된 전방위 O(N) 스캔과 구분(Rationale '보안 전제' 항 참조)" 를 명시적으로 서술할 것.

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 의미 확장 — 기존 명명 근거와의 긴장
  - target 위치: 변경 3 (§9.4 errors) — 코드명에 "PRIVATE" 토큰이 있으나 Public 흐름에도 동일 코드를 반환함을 "historical artifact"로 설명
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)" — 코드 신설 당시 Private 흐름 한정이었음을 기록
  - 상세: 기존 Rationale는 이 코드를 Private 흐름 한정으로 신설했다. target draft는 Public 흐름에도 동일 코드를 확장 적용하면서 코드명의 "PRIVATE" 토큰을 "historical artifact"로 처리한다. 코드 이름 변경(예: `CAFE24_APP_ALREADY_CONNECTED`)이나 Public/Private 분리 코드 신설을 명시적으로 검토하고 기각했다는 서술이 변경 4 Rationale에 없다. 새 Rationale("Cafe24 Public 흐름의 begin-time 사전 가드 추가") 항이 이 결정을 다루긴 하지만, 왜 코드명 변경을 하지 않는지의 근거(예: 클라이언트 하위 호환성 비용, 코드 의미 재정의로 충분함)가 명시적으로 기재되어 있지 않다.
  - 제안: 변경 4 Rationale의 "Cafe24 Public 흐름의 begin-time 사전 가드 추가" 항 또는 변경 3 설명에, "코드명 변경(`CAFE24_APP_ALREADY_CONNECTED`) 및 Public/Private 분리 코드 신설 안을 검토했으나 (a) 클라이언트 분기 로직은 코드 의미(mall_id 중복)로 처리하므로 이름 변경으로 얻는 이득 없음, (b) 기존 연동 클라이언트의 재작업 비용, (c) swagger 규약상 409 코드 통일 정책과 일관 — 세 이유로 코드명 그대로 유지"를 명시할 것.

- **[INFO]** `pending_install`/`expired`/`error` 행의 begin-time 비차단 근거가 Rationale 신설 항에 충분하지 않음
  - target 위치: 변경 1, 변경 4 "Cafe24 Public 흐름의 begin-time 사전 가드 추가" 항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)" — `pending_install` 재사용 정책 언급
  - 상세: target draft는 "다른 status(pending_install/expired/error)는 begin 단계에서 차단하지 않는다"고 명시하고, "Private 흐름의 pending_install 재사용 정책과의 호환성"을 이유로 든다. 그러나 `error` 및 `expired` 행이 비차단인 이유(새 OAuth 시도를 허용해 덮어쓰기 의도)는 서술되어 있지 않다. `error(auth_failed)` 상태 행이 있을 때 Public 흐름으로 재시작을 허용하는 것이 의도된 설계임을 독자가 확신할 수 없다.
  - 제안: 변경 4 Rationale에 "`error`/`expired` 행이 존재할 때도 begin을 통과시키는 이유: 사용자가 재연동(reconnect) 의도로 OAuth를 새로 시작하는 합법적 흐름이며, finalize 단계의 V045 race backstop이 연결된 row와의 충돌을 여전히 차단함"을 1~2문장으로 보완할 것.

- **[INFO]** precheck endpoint 응답 필드 `existingName`의 정보 노출 범위가 Rationale에서 미검토
  - target 위치: 변경 2 (§9.2 신규 endpoint 행) — `{ conflict, existingIntegrationId?, existingName?, status? }` 응답 shape
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 및 "install_token mismatch 회복 흐름 — 보안 전제" — cross-workspace enumeration 차단 원칙
  - 상세: 변경 4 Rationale "precheck endpoint" 항은 "자격 증명·토큰·timestamps·workspace 메타 비포함"을 명시하나, `existingIntegrationId`와 `existingName`은 current workspace 기준 Integration의 식별자·이름이다. 이 두 필드가 authenticated user의 current workspace에 속하는 자기 데이터임을 Rationale에 명시하지 않으면, 기존 "cross-workspace enumeration 차단" 원칙과의 관계가 불분명하다.
  - 제안: 변경 4 Rationale "precheck endpoint" 항에 "`existingIntegrationId`/`existingName`은 인증된 사용자의 current workspace에 소속된 row의 데이터만 반환하므로 cross-workspace 데이터 접근 경로가 아님"을 명시할 것.

---

### 요약

target draft(spec-draft-cafe24-public-dup-guard.md)는 전반적으로 기존 Rationale와 충돌하는 결정을 이유 없이 재도입하거나 합의된 원칙을 직접 위반하는 사례는 없다. 변경 4에서 2개의 신규 Rationale 항목을 명시적으로 추가하는 것은 "결정 번복 시 Rationale 동반" 원칙을 준수한다. 다만 두 가지 WARNING이 존재한다. 첫째, O(N) mall_id 스캔 폐기 결정과 회복 분기의 공존 관계를 spec 행 수준에서 참조 연결 없이 두면 독자가 모순으로 오독할 수 있다. 둘째, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 유지 결정(코드명 변경/분리 안 기각 근거)이 Rationale에 서술되지 않아 향후 코드명 변경 논의가 재개될 여지가 있다. 두 INFO 항목은 기존 보안 원칙과의 정합 보완을 제안하는 경미한 수준이다.

---

### 위험도

LOW
