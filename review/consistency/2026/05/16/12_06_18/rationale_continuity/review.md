# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-16

---

### 발견사항

- **[INFO]** 변경 1 — data-flow spec 의 `install_token=NULL` 텍스트 정정은 기존 Rationale 과 완전 정합
  - target 위치: 변경 1 (`spec/data-flow/integration.md` §1.2.1 line 90)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)"
  - 상세: 2026-05-15 Rationale 이 `pending_install → connected` 전이 시 install_token 을 보존(NULL 처리 제거)으로 명시 결정했고, `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 도 동일. data-flow spec 만 옛 `install_token=NULL` 표현이 남아 있던 doc drift 상태였으므로, 이번 변경은 결정을 번복하는 것이 아니라 누락된 동기화를 수행한다. 추가할 새 Rationale 이 없고, draft 도 이를 "doc drift 정정" 으로 명시해 문제 없다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 변경 2 — `Cafe24AppUrlCard` 신규 UI 요소가 과거 폐기된 대안을 재도입하지 않음
  - target 위치: 변경 2 (`spec/2-navigation/4-integration.md` §4.2 표 행 추가)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale 전체 — install_token 표시 관련 과거 폐기 대안이 명시된 항목 없음
  - 상세: 기존 Rationale 에는 "상세 페이지에서 App URL 을 노출하지 않는다" 는 의도적 결정이 없다. 오히려 "HTML 에러 페이지가 상세 페이지의 App URL 을 비교 기준으로 안내한다" (Rationale "install_token mismatch 회복 흐름") 는 표현이 이미 상세 페이지에 URL 이 표시되어야 함을 암묵적으로 전제하고 있었다. 따라서 이번 변경은 기각된 대안을 재도입하는 것이 아니라 미구현 상태를 해소한다.
  - 제안: 별도 조치 불필요.

- **[INFO]** 변경 3 — `appUrl: string | null` DTO 필드 추가가 `install_token` 별도 노출 금지 원칙을 준수
  - target 위치: 변경 3 (`spec/2-navigation/4-integration.md` §9.1 GET 응답 shape 보강)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" 및 "Cafe24 App URL 상세 페이지 표시 (2026-05-16, 변경 4 추가 예정)" 의 (a)(b)(c) 이유
  - 상세: `install_token` 자체를 별도 DTO 필드로 노출하지 않고 `appUrl` path segment 안에만 포함하는 설계는, 변경 4 의 신규 Rationale 이 명시한 세 이유 — (a) 중복, (b) 식별자 분산, (c) 형식 변경 시 동기화 부담 — 를 정확히 따른다. 합의된 원칙 위반 없음.
  - 제안: 별도 조치 불필요. 다만 §9.1 텍스트에서 "Rationale 참조" 링크가 변경 4 의 Rationale 항 `#cafe24-app-url-상세-페이지-표시-2026-05-16` 앵커로 명확히 연결되는지 구현 시 확인 권장.

- **[INFO]** 변경 4 — 신규 Rationale 항이 기존 결정의 암묵적 가정과 충돌하지 않음
  - target 위치: 변경 4 (`spec/2-navigation/4-integration.md` Rationale 신규 항 추가)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)"
  - 상세: 신규 Rationale 의 "HMAC 검증 진단 로그 보강" 항은 기존 "CAFE24_INSTALL_INVALID_HMAC 으로 단일 응답 코드로 통합" 원칙과 일부 중복될 수 있으나 실제 응답 코드는 변경하지 않고 내부 `logger.warn` 만 보강하는 것이므로 기존 결정("어느 mall_id 에 pending 이 있는지 응답 코드로 새지 않게 하는 안전망", Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제") 과 충돌하지 않는다. `client_secret` 을 절대 로그에 남기지 않는다는 조건도 기존 `SECRET_LEAK_PATTERNS` 보안 원칙과 일관.
  - 제안: 신규 Rationale 항의 "HMAC 진단 로그 보강" 설명에 "응답 코드 자체는 변경 없음, 기존 단일 코드 정책 유지" 를 한 줄 명시하면 미래 독자가 기존 Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 와의 연속성을 즉시 확인할 수 있다.

- **[INFO]** 변경 5 — `spec/4-nodes/4-integration/4-cafe24.md` §9.4 변경 불필요 확인은 정확
  - target 위치: 변경 5 (확인만, 변경 없음)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)"
  - 상세: §9.4 step 5 가 이미 "install_token 은 보존" 으로 일관하므로 변경 불필요. draft 의 판단이 정확하다.
  - 제안: 별도 조치 불필요.

---

### 요약

target draft(`spec-draft-cafe24-app-url-detail.md`) 의 5개 변경 항목 모두 기존 `spec/2-navigation/4-integration.md` Rationale 에서 합의된 결정(install_token persistent 격상, capability-token 보안 전제, 식별자 분산 회피, SECRET_LEAK_PATTERNS) 을 정확히 준수한다. 기각된 대안의 재도입도 없고, 합의 원칙의 위반도 없다. 변경 1 은 누적된 doc drift 정정이고, 변경 2~4 는 기존 Rationale 이 암묵적으로 전제했던 미구현 상태("에러 페이지가 상세 페이지 URL 을 비교 기준으로 안내"했으나 UI 에 URL 이 노출되지 않았던 문제) 를 완성하는 방향이다. INFO 4건은 모두 선택적 보완 제안이며 spec 반영을 차단할 사유가 없다.

### 위험도

NONE
