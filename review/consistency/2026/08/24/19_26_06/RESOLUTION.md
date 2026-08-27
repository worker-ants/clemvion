# RESOLUTION — `19_26_06` (`--impl-prep`, BLOCK: YES)

CRITICAL 1 · WARNING 7 · INFO 5. **Critical 은 전적으로 옳았다** — 내 plan 이 범위를 작게 봤다.

## CRITICAL 1 — 이 변경은 **보안 설계 Rationale 을 무효화**한다

지적: `spec/2-navigation/14-execution-history.md` R-5 가 *"config echo 는 엔진 boundary
(`handler-output.adapter.ts` 의 `maskSensitiveFields`)에서 … **저장 시점에 이미 마스킹** …
안전성은 롤 게이팅이 아니라 서버 **boundary masking parity** 에 의존"* 이라 못박는데,
이 PR 이 정확히 그 boundary 를 제거한다.

**맞다.** 그리고 그 문장은 내가 쓴 예고가 아니라 **보안 설계 근거**라 자기-반증형 소정정
대상이 아니다 — planner 턴이 필요하다. `spec_impact` 를 **1건 → 6건**으로 넓혔다.

R-5 는 원문을 취소선으로 남기고 정정했다: 마스킹 **시점**이 storage→egress 로 옮겨졌고,
**Config 탭의 안전성 결론은 그대로**(그 엔드포인트가 REST egress 를 지난다)이며, 바뀐 것은
*어디서* 가려지느냐와 **DB 직접 열람자는 이제 원문을 본다**는 것이다(§R17 이 수용한 trade-off).

### 미러 스윕이 게이트보다 많이 찾았다

게이트는 정정 대상으로 `1-ai-agent.md:480` **한 자리**를 지목했다. `maskSensitiveFields` 를
**주장 기반으로** 훑으니 그 파일에만 **4자리**였고, 표현이 세 가지로 달랐다
(`boundary strip` ×2 · `adaptHandlerReturn boundary` · `boundary 에서 자동 마스킹`).
전체로는 8개 파일이 걸렸고 그중 **4개는 다른 소비처**(workflow-assistant 등)라 손대지 않았다.

**이 세션이 네 번 놓쳤던 그 자리다.** 이번엔 게이트 목록을 그대로 집행하지 않고 다시 셌다.

## WARNING 3 — "표현식 경로만 제외" 는 실제 범위보다 좁은 표제

정확하다. 어댑터를 걷어내면 **DB 저장도 원문**이 된다. 별도 결정으로 명시하고 근거를 적었다 —
EIA §R17 의 **egress-only 원칙**과 정렬이고, `Execution.error`·`outputData` 는 이미 그랬으며
**config 만 storage-time 마스킹으로 예외**였다.

## WARNING 6 — 사실은 맞고 추론은 틀렸다

지적: *"`CREDENTIAL_KEY_PATTERN` 이 REST 와 WS 에 독립 선언됐고 오늘도 다르다. 포함관계를
단수로 서술하면 '동명이인 상수' 실수를 재현한다."*

**중복과 차이는 사실이다**(REST 만 `x[_-]api[_-]?key`). 다만 실측하니 **config echo 경로는
그 중복 위를 지나지 않는다** — WS 의 `maskWireEnvelope` 도 **공유** `deepRedactSecretsPreserving`
를 쓰고, 로컬본은 `sanitizePayloadForWs(ctx.chatChannel)` **라우팅 컨텍스트 전용**이다.

**그래도 지적이 진짜를 드러냈다** — 로컬본이 공유본보다 좁아 **라우팅 컨텍스트만** `x-api-key`
를 못 가린다. 별건으로 등재했고, 합칠 때는 **넓은 쪽으로** 합쳐야 함(좁은 쪽으로 합치면 REST
가 후퇴한다)을 함께 적었다.

## WARNING 1 · 5 — egress-masking §1 · 자매 트래커

- **§1 좌표계 표**: `maskSensitiveFields` 는 **깊이 상한이 없어** 그 표(깊이 축)의 행이 아니다.
  대신 *"config echo 가 이제 egress 하나에만 의존하므로 포함관계가 지켜져야 한다"* 를 명시했다.
- **자매 트래커**: 두 항목을 닫았다. 그중 *"값 축은 아직 열려 있다"* 는 **전제가 바뀌어 대상이
  소멸**했다 — 어댑터가 마스킹을 안 하니 *"키 축만 걸려 있다"* 가 성립하지 않는다. 남는 질문은
  **방향이 반대**(egress 값 축이 충분한가)라 기존 잔여 항목으로 합류시켰다.

## WARNING 2 · 4 · 7 · INFO

- **W2** (Cafe24/Makeshop 에러 카탈로그 drift) — 이 작업과 무관한 오래된 drift. 범위 밖.
- **W4** (*"중복 한 겹 제거"* 프레이밍이 §R17 의 *"두 층은 쌓인다"* 와 상충) — 타당한 지적이라
  표현을 바꿨다: 같은 자리의 중복이 아니라 **키 완전일치 검사를 정규식 검사로 대체**하는 것이고,
  포함관계가 성립하므로 방어가 줄지 않는다.
- **W7 · INFO 4** (`1-ai-agent.md:480` · `4-ai-assistant.md:261`) — 위 스윕에 포함해 처리.
- **INFO 3** (`mask-sensitive-fields.util.ts` 헤더 주석이 stale) — 같은 커밋에서 정정.
- **INFO 1** (`4-execution-engine.md` 가 침묵) — *"config 는 storage-time 마스킹이 없다"* 를
  `Engine Raw Config Exposure` 절에 명문화. **침묵이 두 문서가 서로 다른 가정을 채운 원인**이라는
  진단이 정확했다.
