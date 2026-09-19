# Rationale 연속성 검토 — 통합 연결 테스트 draft

대상: `plan/in-progress/spec-draft-integration-connection-tests.md` (spec_impact: `spec/2-navigation/4-integration.md`)

## 발견사항

- **[WARNING]** §9.2 preview-test "외부 호출 없음" 원칙의 경계 서술("Cafe24 한정")이 확장 후에도 그대로 남는다
  - target 위치: draft `### E. §9.2 preview-test 행 (810행)` (draft 106~110행) — 「구조 검증만: Cafe24(§5.8) · MakeShop · Google · GitHub · Webhook」로 4개 서비스를 추가. 그리고 `### G. Rationale` 신설 항목(118~121행)에도 이 확장에 대한 개정 언급 없음.
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → **"SMTP 연결 테스트를 `verify()` 로 구현"** 항: *"preview-test 의 '외부 호출 없음' 원칙은 **Cafe24 한정**(§5.8 — OAuth 토큰이 막 발급돼 구조 검증으로 충분)이며, Email 은 SMTP 인증이 외부 네트워크 없이 검증 불가하므로 명시적 예외다."* 같은 취지가 §5.5 본문에도 박혀 있다: *"Cafe24 의 사전 검증이 외부 호출을 하지 않는 것(§5.8)과 의도적으로 다르다."*
  - 상세: 위 Rationale 은 "외부 호출 없음"이 적용되는 서비스를 **Cafe24 하나로 한정**한다고 명시적으로 적어 놓았다. target 은 §9.2 표를 고쳐 이 예외를 MakeShop·Google·GitHub·Webhook 넷으로 확장한다 — 그 자체는 (노드 부재·Google 갱신 미구현이라는) 별도 근거가 있어 "무근거 번복"은 아니지만, **옛 Rationale 문장의 "Cafe24 한정"이라는 경계 서술 자체는 개정하지 않고 그대로 둔다.** 결과적으로 문서에는 "Cafe24 한정"이라고 못 박은 옛 Rationale 항목과, 그 한정을 사실상 무효화하는 §9.2 표가 공존하게 되어, 다음 독자가 두 서술 중 어느 쪽이 최신인지 판단할 근거가 없다(§5.5 본문의 "의도적으로 다르다"는 대조 문장도 함께 낡는다).
  - 제안: `### G.` Rationale 신설 항목에 "**preview-test 외부 호출 없음 원칙의 범위 갱신**" 한 문장을 추가해, 옛 항목의 "Cafe24 한정" 표현을 "Cafe24·MakeShop(OAuth 직후 구조 검증으로 충분) / Google·GitHub·Webhook(쓰는 노드가 없거나 갱신 미구현이라 임시로 구조 검증만)"로 갱신한다고 명시하고, 옛 "SMTP 연결 테스트를 `verify()` 로 구현" 항목 끝에 이 새 항목으로의 forward-reference(또는 취소선 + 정정 각주)를 남긴다. §5.5 본문의 "Cafe24 의 사전 검증이 외부 호출을 하지 않는 것(§5.8)과 의도적으로 다르다" 문장도 같은 타이밍에 "Cafe24·MakeShop·Google·GitHub·Webhook" 으로 갱신해야 §5.5-§9.2-Rationale 세 지점이 다시 정합한다.

- **[INFO]** DB 연결 테스트의 "연결 풀 미사용" 선택이 기존 풀 캐시 아키텍처 Rationale과 교차 참조되지 않음
  - target 위치: draft `### A. §5.4 Database — 테스트 (490행)` (draft 61행) — *"저장된(또는 입력한) 자격증명으로 **일회성 연결**을 열어 `SELECT 1` 을 실행하고 닫는다(연결 풀을 쓰지 않는다)."*
  - 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` → **"풀 캐시 멀티 인스턴스 무효화 — Redis pub/sub broadcast"** 항: Database Query 노드의 실행 경로는 integrationId+credsHash 키의 인스턴스-로컬 커넥션 풀을 유지하고, 자격증명 회전 시 Redis pub/sub 로 전 인스턴스 캐시를 무효화하는 정교한 장치를 갖고 있다.
  - 상세: target 의 연결 테스트는 이 풀을 의도적으로 우회한다 — 이것 자체는 Email 의 `verify()` 선례(마찬가지로 1회성 연결)와 일관되어 **모순은 아니다.** 다만 target 문서 어디에도 "이 일회성 연결은 §2-database-query.md 의 풀 캐시·pub/sub 무효화 메커니즘과 무관하며 그 풀에 편입되지 않는다"는 명시적 진술이 없다. 풀 캐시 Rationale 의 "채널은 노드 비종속이라 다른 인스턴스-로컬 자격증명 캐시도 같은 메커니즘에 구독 등록할 수 있다"는 문장이 있어, 향후 구현자가 "연결 테스트도 풀에 편입시켜야 하나"로 혼동할 여지가 있다.
  - 제안: §5.4 테스트 문장 또는 `### G.` Rationale 신설 항목에 한 줄 — "이 일회성 연결은 노드 실행 경로의 커넥션 풀(§2-database-query.md Rationale)과 별개이며 그 풀에 캐시되지 않는다"를 추가해 의도를 명시한다.

- **[INFO]** `consecutive_network_failures` 카운터 제외 원칙을 DB·HTTP 신규 연결 테스트에도 명시하면 좋음 (구조적으로는 이미 안전)
  - target 위치: draft `### A`·`### B` (DB·HTTP 연결 테스트 정의, 57~85행) — 실패 코드 매핑만 정의하고 자동 격하 카운터와의 관계는 언급 없음.
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → **"연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 전환"** 항의 "**transport 실패 카운터 제외**": *"사용자가 직접 누른 연결 테스트는 일회성 진단이라 합산하면 거짓 양성(사용자 클릭만으로 격하) 위험이 커서 명시 제외."* / `spec/1-data-model.md` §2.10 `consecutive_network_failures` 정의: "**노드 실행** / 토큰 갱신 중 transport 실패 카운터".
  - 상세: 이 카운터는 정의상 "노드 실행·토큰 갱신" 경로에만 적용되고 `IntegrationsService.dispatchTest`(연결 테스트 endpoint)는 그 경로가 아니므로 구조적으로 이미 배제된다 — 실제 위반 가능성은 낮다. 다만 그 배제가 지금까지는 Cafe24 `pingConnection()` 사례로만 명시돼 있었고, target 이 DB·HTTP 에도 실제 네트워크 호출을 붙이는 첫 사례이므로, 같은 원칙이 DB·HTTP 실패에도 적용됨을 한 줄로 못박아 두면 다음 구현자가 실수로 두 경로를 연결할 위험을 원천 차단한다.
  - 제안: `### G.` Rationale 신설 항목에 "DB·HTTP 연결 테스트 실패도 `consecutive_network_failures` 에 합산하지 않는다(연결 테스트 endpoint 카운터 제외 선례 확장)"를 한 문장 추가.

## 요약

target 은 DB·HTTP 연결 테스트 신설의 근거(HTTP 4xx 처리, `EMAIL_HOST_BLOCKED` 코드명 선례, `DB_HOST_BLOCKED` SSRF 코드 재사용 등)를 기존 Rationale 과 대부분 정합하게 연결하고 있고, 과거에 명시적으로 기각된 대안을 이유 없이 되살리는 지점은 발견되지 않았다. 다만 §9.2 preview-test 표의 "외부 호출 없음" 예외를 Cafe24 하나에서 넷(MakeShop·Google·GitHub·Webhook)으로 넓히면서, 그 경계를 "Cafe24 한정"이라고 명시했던 옛 Rationale 문장과 §5.5 본문의 대조 서술을 그대로 남겨 두어 두 서술이 병존·상충하게 된다 — 새 근거가 있으니 결정 자체는 방어 가능하지만, 옛 서술의 갱신이 빠져 있다. 커넥션 풀·자동 실패 카운터 관련 두 건은 실제 위반이라기보다 continuity 문서화 보완 제안이다.

## 위험도

MEDIUM (WARNING 1건 — 반영 자체는 쉽고 국소적이나, spec 반영 시점에 옛 Rationale 문구를 함께 고치지 않으면 문서 내부 모순이 커밋된다)
