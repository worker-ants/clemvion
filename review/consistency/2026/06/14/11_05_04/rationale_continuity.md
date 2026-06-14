# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 문서: `spec/2-navigation/6-config.md`
기준 Rationale 출처: 관련 spec 전체 `## Rationale` 발췌 (prompt_file 제공분)

---

## 발견사항

- **[INFO]** 편집 폼(edit form) 미정의 — Rationale 부재 상태로 구현 gap 만 표기
  - target 위치: `spec/2-navigation/6-config.md §A.2` 구현 현황 주석 마지막 문장 ("생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공")
  - 과거 결정 출처: 동일 파일 `## Rationale R-2` ("bearer_token 자동 발급 강제", "항상 마스킹 + Reveal 엔드포인트") 및 `spec/1-data-model.md §2.17.3 Rationale`
  - 상세: target 문서는 편집 폼이 없음을 사실로 기록하고 있으나, 편집 폼 신설 시 지켜야 할 Rationale 상 설계 원칙(bearer_token 은 사용자 입력 불가·자동 발급 전용, secret 류는 편집 시 마스킹 유지 + Reveal 경로만 평문, ip_whitelist PATCH 경로 포함 등)에 대한 사전 Rationale 주석이 target 본문 어디에도 없다. 이 상태에서 편집 폼을 구현하면 "사용자 입력 허용"이나 "인라인 평문 노출" 같은 기각된 패턴이 재도입될 위험이 있다.
  - 제안: 편집 폼 구현 착수 전, `§A.2` 또는 `## Rationale` 에 "편집 폼은 생성 폼과 동일 자동 발급 정책 — bearer_token·api_key·hmac_secret 은 재입력 없이 마스킹 표시만, 변경은 regenerate 경로로 일원화" 를 한 항 추가해 두면 충분하다. Rationale R-2 의 "자동 발급 강제" + "항상 마스킹 + Reveal 엔드포인트" 원칙이 편집 경로에도 적용됨을 명시.

- **[INFO]** §A.3 미구현 gap 의 "소스 IP 저장 경로" 결정 보류 — Rationale 없이 "결정 필요"만 표기
  - target 위치: `spec/2-navigation/6-config.md §A.3` (호출 이력 테이블 소스 IP·응답 코드 컬럼)
  - 과거 결정 출처: 해당 Rationale 없음 (선행 결정이 없어 기각 사례는 아님)
  - 상세: 기각된 대안이 아니라 미결정 항목이므로 Rationale 연속성 위반은 아니다. 다만 plan 에 "결정 필요"로 분류됐으나 target spec 본문에도 `🚧 미구현 (Planned)` 만 있고 결정 전제나 제약이 없어, 구현 시 integration_usage_log(통합 활동 로그) 의 PII 제거 원칙(Rationale "왜 send-email 은 recipient 를 저장 안 함", "왜 http-request 의 path 에 query string 제거")과 충돌하는 소스 IP 전면 저장이 슬그머니 들어올 수 있다.
  - 제안: §A.3 소스 IP 컬럼 결정 시, `spec/2-navigation/4-integration.md Rationale "활동 로그 API 식별"` 의 PII 최소화 원칙(수신자 email 미저장, query string 제거 근거)을 참조해 저장 범위를 결정하고, 결정 근거를 `## Rationale` 에 기록하는 것을 권장한다.

---

## 요약

`spec/2-navigation/6-config.md` 는 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목이 없다. R-3(번복)·R-4·R-5 는 모두 새 Rationale 를 동반하고 있으며, bearer_token 자동 발급 강제·inline auth path 폐지·select-only 모델 선택 등 핵심 합의 원칙은 본문과 Rationale 에 일관되게 반영돼 있다. 다만 "편집 폼 신설"이 plan 의 후속 범위로 남아있는 상황에서, 편집 경로에서도 자동 발급 전용·마스킹 유지 원칙이 유지돼야 한다는 Rationale 가 target 문서에 선제적으로 기록돼 있지 않아 구현자가 간과할 위험이 있다. 두 항 모두 INFO 수준으로, 과거 결정의 직접 위반이 아니라 Rationale 보강 권고다.

---

## 위험도

LOW
