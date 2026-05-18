### 발견사항

- **[INFO]** `connected-expiry` 잡의 0d 만료 시 Cafe24 행을 `expired` 대신 큐 enqueue 처리 — 번복 Rationale 명시 여부 확인
  - target 위치: §10.5 "0d 만료 자가 회복 (2026-05-18 추가)", §11.1 `connected-expiry` 잡 표·의사코드
  - 과거 결정 출처: target 문서 자체의 Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" — "autoRefresh 통합의 갱신이 실패해 error(*) 로 전이하면 attention 에 포함된다"는 원칙 기록. 또한 §11.2 알림 섹션의 "`integration_expired` 발사 정책: refresh_token 없는 provider 의 `token_expires_at` 만료에만 발사"
  - 상세: 2026-05-18 추가된 `connected-expiry` 0d 분기에서 cafe24 행은 `status=expired` 로 전이하지 않고 `cafe24-token-refresh` 큐 enqueue 후 알림을 발사한다. 이 흐름에서 알림 발사의 내용이 §11.2 의 `integration_expired` 발사 정책("refresh_token 없는 provider 에만 발사")과 표면상 충돌해 보인다. 그러나 §11.1 의사코드가 "status 변경 없음 — worker 가 결과에 따라 connected 유지/error 전이" + 알림 발사를 명시적으로 기록하고 있으며, §10.5 본문에도 "본 정책으로 cafe24 의 `expired` 상태는 사실상 `install_timeout` 한 가지 경로만 남는다"는 의도 설명이 있다. 다만, §11.2 의 `integration_expired` 발사 정책 텍스트("**refresh_token 없는 provider 의 `token_expires_at` 만료(`status_reason='token_expired'`)에만 발사**")가 이번 0d 분기 추가 이후에도 갱신되지 않아 일관성 리스크가 남는다. cafe24 0d 만료 시 알림 발사가 `integration_expired` 인지, 혹은 `integration_action_required` 인지, 아니면 큐 enqueue 전에 발사하는 만료 임박 알림인지가 §11.1 의사코드만으로 확정되지 않는다.
  - 제안: §11.2 `integration_expired` 발사 정책 서술에 "cafe24 의 0d 임계는 `expired` 전이 대신 `cafe24-token-refresh` 큐 enqueue 경로로 처리되며, 이 경우 알림은 큐 enqueue 와 동시에 발사되고 `status_reason='token_expired'` 조건은 적용되지 않는다" 와 같은 단서를 추가해 기존 발사 정책 서술과의 의미 충돌을 해소한다.

- **[INFO]** `pending_install` 필터 칩 미포함 원칙과 새로운 `pending_install` 상태 텍스트·UI 추가 항목 간 연속성
  - target 위치: §2.2 항목 요소 표 — `pending_install` 의 상태 텍스트 "Pending install", 보조 문구 "Complete Cafe24 Test Run to activate", `⋮` 메뉴 "상세 열기 + 삭제만 활성" 상세 기술
  - 과거 결정 출처: target 문서 Rationale "Attention 가상 필터값 (2026-05-16)" — "DB Enum 비확장, 영속화되는 상태와 화면 필터링용 술어를 분리"; §2.3 각주 "상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름 진행 중 정상 전환 상태, 사용자가 명시적으로 필터링할 수요가 낮다"
  - 상세: 이번 개정에서 `pending_install` 카드의 ⋮ 메뉴 비활성 세부 조건("재인증은 cafe24 측 '테스트 실행' 재호출이 정식이며, 연결 테스트는 토큰이 없어 의미가 없다")이 매우 상세하게 기술됐다. 이는 Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)" 의 원칙과 정합한다. 충돌 없음.
  - 제안: 문서 품질 향상 차원에서 §2.2 ⋮ 메뉴 서술 뒤에 "Rationale: Cafe24 Private 앱의 callback 실패 status 보존 항 참고" 를 anchor 참조로 추가하면 독자가 의도를 빠르게 추적할 수 있다.

- **[INFO]** `tryRecoverByMallId` 회복 흐름이 본문(§9.2)에서 언급되나 Rationale 에 항목이 존재하지 않는 것으로 보임
  - target 위치: §9.2 `GET /api/3rd-party/cafe24/install/:installToken` 설명 — "직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back 후 여전히 미매칭일 때"
  - 과거 결정 출처: §9.4 에러 코드 표 `CAFE24_INSTALL_INVALID_TOKEN(404)` 주석에 `[Rationale "Cafe24 install_token mismatch 회복 흐름"]` 앵커가 참조되고 있으나, target 문서에서 prompt 파일에 포함된 Rationale 발췌에 해당 항목("Cafe24 install_token mismatch 회복 흐름")의 본문이 확인되지 않는다 (truncated 구간에 있을 가능성 있음).
  - 상세: Rationale 앵커가 인라인 참조되어 있으나 실제 Rationale 항목이 문서 내 확인 범위 안에 없다면 "결정의 배경 없는 참조" 가 된다. 보안적으로 중요한 회복 흐름(`install_token` mismatch 후 `mall_id` 기반 fallback 탐색)이 설계 근거 없이 기술될 경우, 이 경로가 새로운 enumeration attack surface 를 여는지 여부를 독자가 판단하기 어렵다.
  - 제안: Rationale "Cafe24 install_token mismatch 회복 흐름" 항이 실제로 문서에 존재하는지 확인하고, 누락이라면 추가한다. 핵심 내용은 `tryRecoverByMallId` 의 조회 범위(workspace, mall_id 조합), capability token 보안 전제와의 관계, 그리고 왜 이 fallback 이 기존 CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제를 침해하지 않는지에 대한 설명이어야 한다.

- **[WARNING]** `connected-expiry` 0d 분기에서의 알림 발사 — §11.2 발사 정책과 명시적 정합 없음
  - target 위치: §11.1 의사코드 `remain <= 0d` 분기 (cafe24 `AND credentials.refresh_token` 존재 행) — "→ 알림 (status 변경 없음)"
  - 과거 결정 출처: target 문서 Rationale §11.2 의 명시 정책 — "`integration_expired` 발사 정책: **refresh_token 없는 provider 의 `token_expires_at` 만료(`status_reason='token_expired'`)에만 발사**"
  - 상세: §11.1 의사코드는 cafe24 0d 만료 시 "알림 발사" 를 명시하지만, §11.2 의 발사 정책 기술은 "refresh_token 없는 provider 만" 이라는 서술을 포함한다. 두 서술은 같은 시나리오에서 상반된 결론을 암시한다. cafe24 는 refresh_token 을 보유하는 provider 인데 0d 만료 시 알림이 발사되는가? 발사된다면 어느 type(`integration_expired` vs `integration_action_required`)인가? 이 gap 이 명시적 Rationale 없이 남아있어 구현자가 어느 쪽을 따라야 하는지 불분명하다.
  - 제안: §11.1 의사코드의 "→ 알림" 라인에 알림 type 과 "§11.2 의 발사 정책과의 관계" 를 명시하거나, §11.2 발사 정책 서술을 "cafe24 의 0d 임계는 큐 enqueue 경로로 대체되어 발사 정책 예외" 로 갱신한다. 어느 쪽이든 Rationale 에 의도를 한 줄 기록해야 한다.

### 요약

target 문서 `spec/2-navigation/4-integration.md` 는 전반적으로 기존 Rationale 와의 연속성을 잘 유지하고 있다. 주요 설계 번복(install timeout `→ (삭제)` 폐기 → `→ expired` 채택, refresh 실패 시 `expired` → `error(auth_failed)` 전환, callback 실패 시 status 보존, `Attention` 가상 필터값 신설, autoRefresh derived 필드 도입 등)은 모두 Rationale 에 명시적으로 기록되어 있으며, 폐기된 대안도 대부분 근거와 함께 기술됐다. 다만 2026-05-18 에 추가된 `connected-expiry` 0d 분기의 "알림 발사" 서술이 §11.2 의 기존 발사 정책 텍스트("refresh_token 없는 provider 에만 발사")와 표면상 충돌하며, 이 불일치에 대한 새로운 Rationale 항이 없다. 또한 `tryRecoverByMallId` 회복 흐름이 본문에서 Rationale 앵커를 참조하나 해당 항목의 실존 여부가 확인 범위 내에서 검증되지 않아 INFO 수준 보완이 필요하다. CRITICAL 수준의 위반(명시적으로 기각된 대안 재채택, 합의된 invariant 직접 위반)은 발견되지 않았다.

### 위험도

LOW
