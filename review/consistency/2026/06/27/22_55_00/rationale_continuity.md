# Rationale 연속성 검토 — `spec/7-channel-web-chat/3-auth-session.md`

검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [INFO] R6 sessionStorage vs localStorage — 인접 spec 과의 결정 문맥 보완 여지

- **target 위치**: `3-auth-session.md §R6` ("토큰 저장 — sessionStorage (vs localStorage)")
- **과거 결정 출처**: `spec/7-channel-web-chat/5-admin-console.md §R3` ("localStorage = 미저장 편집 캐시 — sessionStorage(탭 닫으면 소실)·쿠키(매 요청 전송)·indexedDB(과한 복잡도)보다 적합")
- **상세**: `5-admin-console.md §R3` 은 admin 콘솔의 편집 캐시 저장소 선택 시 `sessionStorage` 를 "탭 닫으면 소실" 이라는 **단점** 이유로 명시 기각하고 `localStorage` 를 채택했다. `3-auth-session.md §R6` 는 동일 브라우저 스토리지 선택을 반대 방향으로 결정하면서(sessionStorage 채택) — 다른 도메인(인증 토큰 vs 편집 캐시)이므로 결정이 달라지는 것은 정당하나, 두 R 이 서로를 교차 참조하지 않아 관계가 불분명하다. 미래 독자가 "sessionStorage 는 탭 소실이 단점이라 R3 에서 기각됐는데 왜 R6 은 채택하는가"를 보고 불일치로 읽을 수 있다.
- **제안**: `3-auth-session.md §R6` 에 "admin 콘솔 미저장 캐시(`5-admin-console §R3`)는 탭 간 유지 필요성 때문에 localStorage 를 택했으나, 인증 토큰의 보안 목적은 반대로 탭 종료 시 자동 소거가 목표이므로 sessionStorage 가 정합"이라는 한 줄 대조 문구를 추가하면 결정 맥락이 완결된다.

### 2. [INFO] EIA §R4 인용의 "advanced bot 한정" 범위 명시 보완

- **target 위치**: `3-auth-session.md §R3` 마지막 문장 ("per_trigger 는 EIA 가 '사용자가 변환층을 직접 구현하는 advanced 봇' 한정으로 두는데, 공개 브라우저 위젯은 그 조건이 아니므로 노출하지 않는 것이 EIA 의도와 일치한다.")
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R4` ("per_trigger 가 더 편한 시나리오: 다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — 단, 본 시나리오는 사용자가 직접 변환층을 구현하는 advanced 케이스 한정 (§2 사용 시나리오 표 2행).")
- **상세**: target 은 EIA §R4 의 핵심 제약을 정확히 인용하고 있으며, 결정의 방향도 일치한다. 다만 EIA §R4 에는 서버사이드 어댑터(`Chat Channel` 어댑터)가 EIA-AU-08 in-process 우회를 사용해 토큰 사이클 자체가 미적용된다는 추가 맥락이 있는데, target 문서는 이 맥락(위젯은 iframe 내 브라우저 클라이언트이므로 in-process 우회 경로가 없다는 점)을 명시하지 않는다. 기각 근거로는 충분하나, per_trigger 기각이 "advanced bot 한정" 에 더해 "in-process 우회 불가(브라우저 클라이언트)" 이중 근거임을 드러내면 더 강건해진다.
- **제안**: §R3 에 "공개 브라우저 위젯은 in-process 우회(EIA-AU-08) 경로도 없으므로 per_trigger 의 유일한 이점(토큰 교환 비용 회피)도 적용되지 않는다"는 문장을 보완하거나, EIA §R4 의 해당 부분을 각주로 참조하는 것을 고려할 수 있다.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 는 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 내용이 없다. per_execution 단일 지원(§R3), 낙관적 refresh 1회 정책(§R4), TransformInterceptor 봉투 언랩(§R5), sessionStorage 채택(§R6) 모두 EIA spec(§R4, EIA-AU-04), webhook spec(§3.1), 보안 spec(§R5) 의 원칙과 정합한다. 발견된 두 항목은 모두 INFO 수준으로, 기각된 결정의 재도입이나 invariant 위반이 아니라 인접 spec 과의 교차 참조 문구 보완 여지다. `5-admin-console §R3` 이 sessionStorage 를 단점 이유로 기각한 컨텍스트와 본 문서의 sessionStorage 채택이 도메인이 달라 충돌하지 않지만, 두 결정 사이에 명시적 대조 문구가 없어 독자 혼란 가능성이 있다.

## 위험도

NONE
