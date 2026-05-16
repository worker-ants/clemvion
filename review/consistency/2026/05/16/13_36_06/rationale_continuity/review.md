# Rationale 연속성 검토 결과

대상 문서: `spec/2-navigation/4-integration.md`

---

### 발견사항

- **[INFO]** `Attention` 필터 칩의 단일 선택 모델 — 기각된 멀티 선택 방식이 재도입되지 않았음을 확인
  - target 위치: §2.3 검색·필터, §2.4 클릭 동작, §9.1 목록 API
  - 과거 결정 출처: `## Rationale` "Attention 가상 필터값 — Expired ∪ Expiring ∪ Error 를 단일 칩으로 노출 (2026-05-16)"
  - 상세: Rationale 에서 `?status=expiring&status=expired` 같은 multi-value 쿼리 및 멀티 선택 칩 도입이 명시적으로 기각됐다. target 문서는 `Attention` 단일 칩(`?status=attention`)을 채택해 합집합을 제공하며 기각된 대안과 충돌하지 않는다.
  - 제안: 현재 구현이 Rationale 의 의도에 부합하므로 조치 불필요. Rationale 자체가 충분히 명문화되어 있어 향후 개발자가 multi-value 쿼리로 회귀하지 않도록 보호되고 있다.

- **[INFO]** `install_token` 단일 row 조회 우선 + `tryRecoverByMallId` fallback 구조 — 폐기된 "100건 전수 스캔" 패턴과의 충돌 여부
  - target 위치: §9.2 `GET /api/3rd-party/cafe24/install/:installToken` 엔드포인트, §9.4 `CAFE24_INSTALL_INVALID_TOKEN` 에러
  - 과거 결정 출처: `## Rationale` "install_token 을 App URL path 식별 키로 승격 (2026-05-14)", "Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)"
  - 상세: 옛 100건 스캔 방식은 install_token 이 없던 시절의 "모든 호출에 적용된 식별 전략"으로 폐기됐다. 새 회복 흐름(`tryRecoverByMallId`)은 단일 row 조회 실패 시에만 fallback으로 작동하고 HMAC 검증을 동반하며, Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에서 이 구분이 명시적으로 설명돼 있다. target 문서도 "직접 매칭 실패 시 `tryRecoverByMallId` 회복 흐름 fall-back" 이라고 표기해 우선순위를 올바르게 기술하고 있다.
  - 제안: 조치 불필요. Rationale 에서 "이 회복 흐름은 폐기된 전략과 본질적으로 다른 경로"임을 충분히 설명하고 있어 혼동 위험이 낮다.

- **[WARNING]** `pending_install → expired` 상태 전이에서 `install_token=NULL` 소거가 target §6과 §9.2 간 일관성 미세 불일치
  - target 위치: §6 상태 전이 표 `pending_install → expired` 행 ("install_token=NULL 로 자동 전이"), Rationale "Cafe24 App URL 재호출 흐름" 항의 "NULL 처리 유지 경로"
  - 과거 결정 출처: `## Rationale` "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)", "install_token TTL 24h (2026-05-14)"
  - 상세: Rationale "Cafe24 App URL 재호출 흐름" 항은 "`pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로)"을 명시했고, "NULL 처리 유지 경로" 섹션에서 "TTL 만료는 token 을 NULL 로 소거 유지"라고 별도로 명시했다. §6 전이 표에는 `pending_install → expired` 행에 `install_token=NULL` 이 표기되어 있고, §9.2 엔드포인트 설명에는 `install_token` 이 NULL 이 아닌 경우에 `CAFE24_INSTALL_INVALID_TOKEN(404)` 라고 설명되어 있어 두 섹션이 모순 없이 일치한다. 그러나 Rationale 에는 두 경로("connected 시 보존" vs "TTL 만료 시 NULL")가 한 섹션 안에 인접 서술되어 있어 코드 작성자가 혼동할 소지가 있다.
  - 제안: Rationale 에 "install_token NULL 처리 매트릭스 — 전이 경로별 처리" 소절을 추가해 각 전이에서 `install_token` 의 상태를 표로 정리하면 혼동을 예방할 수 있다. target 본문 자체는 수정 불필요.

- **[INFO]** `refresh 실패 → error(auth_failed)` 번복 — Rationale 신규 작성 여부 확인
  - target 위치: §6 상태 전이 표 `connected → error(auth_failed)` 행 (2026-05-16 갱신 주석), §10.5 토큰 자동 갱신 (갱신 실패 시)
  - 과거 결정 출처: `## Rationale` "refresh 실패 시 status_reason 통일 (2026-05-16)"
  - 상세: 기존 spec §6 가 명시한 `connected → expired (refresh fail)` 경로를 번복해 `error(auth_failed)` 로 통일했으며, Rationale 섹션에 이유 (a)(b)(c) 가 명시적으로 기재되어 있다. target 본문의 §6 전이 행에 "(2026-05-16 갱신 — 옛 `connected → expired (refresh fail)` 경로를 본 행으로 통합; Rationale 참고)" 인라인 참조가 있다. 번복이 Rationale 과 함께 제대로 기록되어 있어 "결정의 무근거 번복" 기준에 해당하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `install_timeout` 알림 미발사 — Rationale 근거 존재 여부 확인
  - target 위치: §11.1 스캐너 잡 `pending-install-ttl` 행 ("알림 미발사"), §11.2 알림 발사 정책
  - 과거 결정 출처: `## Rationale` "install_timeout 알림 미발사 (2026-05-16)"
  - 상세: spec 문서가 코드의 의도적 동작을 사후 명문화한 케이스로, Rationale 에 (a)~(d) 사유와 기각된 옵션(install_timeout 알림 발사)까지 충실히 기재되어 있다. target 본문과 Rationale 가 완전히 정합한다.
  - 제안: 조치 불필요.

- **[INFO]** `pending_install` 칩 미추가 — Rationale 일관성 확인
  - target 위치: §2.3 상태 칩, Rationale "Attention 가상 필터값" 내 pending_install 관련 주석
  - 과거 결정 출처: `## Rationale` "`pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)"
  - 상세: §2.3 본문에 "※ 상태 칩에 `pending_install` 은 포함하지 않는다 — 외부 흐름 진행 중 정상 전환 상태이며, 사용자가 명시적으로 필터링할 수요가 낮다" 라는 명시적 설명이 있고 Rationale 항도 있다. 정합한다.
  - 제안: 조치 불필요.

- **[WARNING]** `Attention` 배너 클릭: "합계 = 1 → detail 직접 이동" 동작의 Rationale 근거가 본문 인라인 설명에만 있음
  - target 위치: §2.4 클릭 동작 (`합계 = 1 → 그 한 건의 detail 페이지로 직접 이동`)
  - 과거 결정 출처: `## Rationale` "Attention 가상 필터값" 3번 항 ("합계 = 1 일 때는 필터링 단계가 잉여이므로 그 한 건의 detail 로 직접 점프")
  - 상세: 이 UX 분기 결정은 §2.4 본문에 약식 설명("UX 단축 — 1건이면 사용자가 어차피 그 건으로 갈 것")으로 기재됐으며, Rationale 에도 동일 내용이 담겨 있다. 그러나 "합계 = 1" 과 "합계 ≥ 2" 분기가 다른 동작을 하는 edge case로서, 향후 개발자가 배너 클릭 로직을 변경할 때 Rationale 참조 없이 본문만 보면 의도를 놓칠 수 있다.
  - 제안: §2.4 해당 항에 `(Rationale "Attention 가상 필터값" §3 참고)` 같은 명시적 cross-reference 를 추가하면 연속성이 강화된다.

- **[INFO]** `OAuthState.mode='reauthorize'` 를 Cafe24 Private 초기 install 에 재사용 — 기각된 별도 mode 신설안 관련
  - target 위치: §10.2 step 4 모드별 분기 (`reauthorize` 항), §3.2 Cafe24 Private 흐름
  - 과거 결정 출처: `## Rationale` "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)"
  - 상세: `mode='cafe24_private_install'` 별도 enum 신설을 기각한 결정이 Rationale 에 기재되어 있고, target 문서는 기존 `reauthorize` mode 를 재사용하는 방향으로 일관되게 기술하고 있다. 기각된 대안이 재도입되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** Cafe24 scope 인코딩 — 공백 구분이 아닌 콤마 구분 사용 (다른 provider 와 다름)
  - target 위치: §3.2 OAuth2 흐름 (Cafe24 Public 앱) step 4 "scope 인코딩"
  - 과거 결정 출처: target 문서 내 인라인 설명 (Cafe24 자체 규약으로 명시됨)
  - 상세: 이 결정은 외부 플랫폼 제약(Cafe24 API 규약)에 의한 것으로, 기존 spec Rationale 와 충돌하지 않는다. 다만 이 규칙이 `## Rationale` 항이 아닌 본문 인라인 주석으로만 설명되어 있다. Google/GitHub 가 공백 구분을 사용하는 반면 Cafe24 만 예외라는 사실이 미래 구현자에게 놀라움의 원인이 될 수 있다.
  - 제안: `## Rationale` 에 "Cafe24 scope 구분자 — RFC 6749 공백 대신 콤마" 소절을 신설하여 외부 플랫폼 제약임을 명시하면 invariant 문서화가 강화된다.

---

### 요약

`spec/2-navigation/4-integration.md` 의 target 문서는 과거 Rationale 에서 명시적으로 기각된 설계 대안(멀티 선택 칩 방식, 100건 전수 스캔 식별, `mode='cafe24_private_install'` 신설, install timeout 자동 삭제 등)을 재도입하지 않았으며, 합의된 원칙(영속 상태 vs 화면 필터 술어 분리, install_token persistent 식별자, reauthorize 버튼 비활성 조건 등)도 충실히 따르고 있다. 결정 번복(`refresh 실패 → error(auth_failed)`, install_timeout 알림 미발사)이 포함되어 있으나 모두 Rationale 신규 근거와 함께 기재되어 있다. 발견된 이슈는 주로 인라인 설명에 머물고 있는 결정을 Rationale 섹션으로 격상하거나 cross-reference 를 보강하는 수준의 정합 보완 제안이며, CRITICAL 또는 합의된 invariant 직접 위반에 해당하는 항목은 없다.

---

### 위험도

LOW
