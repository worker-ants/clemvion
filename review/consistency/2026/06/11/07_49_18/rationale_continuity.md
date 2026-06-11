# Rationale 연속성 검토 결과

검토 모드: --impl-done (V-06/V-08 makeshop catalog 구현 완료)
diff-base: origin/main

---

## 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` Rationale L1147 — "왜 초기엔 cafe24 만 응답하나" stale
  - target 위치: `integrations.service.ts` `getServiceCatalog()` + controller Swagger 설명 + frontend `renderApiCell` 주석 — makeshop 을 catalog 지원 provider 로 추가.
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale 절 "활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설" L1147.
  - 상세: Rationale L1147 은 "**왜 초기엔 cafe24 만 응답하나** — 나머지 3종은 활동 로그 `apiLabel` 이 NULL 이라 catalog lookup 자체가 발생하지 않는다 … 향후 다른 서비스가 catalog 를 가질 때 추가 row 만 채우면 되도록" 로 쓰여 있다. 구현은 makeshop 을 catalog 지원 provider 로 추가해 이 "향후" 시나리오를 실행했으나, Rationale 은 여전히 "초기엔 cafe24 만" 으로 남아 있다. 같은 Rationale 절의 3-컬럼 이유 설명 표(L1132–1134) 에도 cafe24 행만 있고 makeshop 행이 없어 논리가 끊긴다. 한편 spec 본문 §9.3 테이블(L816) 과 §4.6 하단 catalog i18n 주석(L378) 은 이미 makeshop 을 명시해 본문·Rationale 사이에 분기가 생겼다. 이는 설계 방향 번복이 아니라 Rationale 갱신 누락이다 — 구현이 Rationale 에 기록된 "향후" 확장 경로를 밟은 것이므로 기각된 대안 재도입에 해당하지 않는다. 그러나 Rationale 이 현행 상태와 어긋나면 새 contributor 가 "초기엔 cafe24 만" 을 읽고 makeshop catalog 응답이 의도치 않은 추가라고 오독할 위험이 있다.
  - 제안: Rationale L1147 을 "**왜 초기엔 cafe24·makeshop 만 응답하나**" 로 제목 변경하고 본문을 "cafe24·makeshop 은 `api_label` 을 채우는 두 provider 이므로 backend 메타데이터에서 operations 를 반환한다. 그 외 통합(http/database/email/mcp/google/github)은 활동 로그 `apiLabel` 이 NULL 이라 catalog lookup 이 발생하지 않는다 — endpoint-only fallback 으로 충분. 향후 추가 provider 가 `api_label` 을 채우게 되면 동일하게 row 를 추가하면 된다." 로 갱신. 3-컬럼 이유 설명 표(L1132–1134)에 makeshop 행을 추가해 asymmetric 설명을 보완.

- **[INFO]** `tryTranslateLabel` 구현 — `t: TFunction` → `locale: Locale` + flat-dict helper 로 교체
  - target 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` `tryTranslateLabel` 함수.
  - 과거 결정 출처: 기존 구현 코드 (spec Rationale 에 `t()` 경로를 명시한 항목 없음). `spec/2-navigation/4-integration.md` Rationale "활동 로그 API 식별" L1144 — "frontend i18n dict — `labelKey` → KO/EN 사람 친화 라벨로 매핑".
  - 상세: 기존 코드는 `t(\`cafe24Catalog.${catalogKey}\`)` 패턴으로 nested i18n `t()` 를 사용해 lookup 했으나, dotted-key (`"makeshop.shop.get-authority"` 등) 가 `t()` 의 점 분리 nested 순회와 충돌해 반드시 miss 가 된다. 새 코드는 `locale` + provider 전용 flat lookup helper 로 교체해 이를 해소했다. spec Rationale 은 "frontend i18n dict 가 라벨로 변환" 이라는 책임 귀속만 정의하고 `t()` 호출 형태를 mandating 하지 않으므로 Rationale 위반이 아니다. 단, 기존 코드의 "이유 없는" `t()` 경로 의존이 주석 외 어딘가에 명시된 결정이라면 재확인 필요. 신규 코드 주석이 "왜 `t()` 가 동작하지 않는가" 를 이미 설명하고 있어 충분한 self-documenting 이 있다.
  - 제안: 별도 spec Rationale 갱신 불필요. 기존 `plan/in-progress/cafe24-catalog-i18n.md` follow-up plan 에 "cafe24 dict 도 동일 flat lookup helper 경로로 채워야 한다" 는 주석을 추가해 같은 패턴 확장 시 혼선을 예방하는 것을 권장.

---

## 요약

이번 구현(V-06/V-08)은 `spec/2-navigation/4-integration.md` Rationale 의 "향후 다른 서비스가 catalog 를 가질 때 추가 row 만 채우면 되도록" 이라는 확장 경로를 의도적으로 밟은 것이다. 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 부분은 없다. 유일한 Rationale 연속성 문제는 L1147 Rationale 항목이 구현 완료 후에도 "초기엔 cafe24 만" 으로 남아 있어 spec 본문(§9.3/§4.6)과 분기가 생긴 점이며, 이는 갱신 누락(WARNING)이다. `tryTranslateLabel` 의 `t()` → flat-dict helper 교체는 Rationale 위반이 아니고 구현 내부 결정으로 INFO 수준의 보완 제안만 있다.

---

## 위험도

LOW
