# Rationale 연속성 검토 — `spec/4-nodes/4-integration/` (SSRF 가드 통합, `--impl-prep`)

## 검토 대상 재구성

이번 구현(`plan/in-progress/ssrf-guard-integration-unify.md`)은 **spec 변경 없음**(`spec_impact: none`)을 전제로,
`http-request.md` §4-8 / `2-database-query.md` §4 / `3-send-email.md` §4-7 이 이미 "loopback·RFC1918·link-local·CGNAT·
IPv6 사설대역을 **동일 메커니즘·플래그**로 차단한다" 고 적어 놓은 것과, 실제 코드가 SMTP 는 `ssrf.util`(CGNAT 미차단) ·
HTTP/DB 는 `http-safety`(IPv4-mapped IPv6 미차단)로 **갈라져 있는** 것 사이의 괴리를 코드 쪽에서 닫는 작업이다.
따라서 이 검토는 "target 텍스트가 새 결정을 도입하는가" 가 아니라 "지금부터 시작할 구현이 spec 의 `## Rationale`
이 이미 못박은 결정·원칙을 지키는 방향인가" 를 확인하는 형태로 진행했다.

## 발견사항

### 정합 확인 — 위반 없음, 오히려 기존 원칙의 강제 이행

- **[INFO]** SSRF 가드 통합은 기존에 명시적으로 기각된 대안(`SMTP_BLOCK_PRIVATE_HOSTS` 별도 플래그)을 재도입하지 않는다
  - target 위치: 계획 문서 `plan/in-progress/ssrf-guard-integration-unify.md` §"할 것" 3번 (주석 정정)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" — "별도 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS` 안)를 신설하는 대신 기존 `ALLOW_PRIVATE_HOST_TARGETS` … 를 재사용한다"
  - 상세: 코드베이스 주석(`integrations.service.ts` `testEmailTransport`, `send-email.handler.ts`)이 실제로는 폐기된 `SMTP_BLOCK_PRIVATE_HOSTS` opt-in 이름을 아직 가리키고 있어 drift 상태였다. 계획은 이를 실제 동작(`ALLOW_PRIVATE_HOST_TARGETS` opt-out)에 맞춰 정정하는 것으로, 기각된 대안을 되살리는 게 아니라 **기각된 대안의 이름이 코드에 남아있던 잔재를 제거**하는 방향이다.
  - 제안: 없음 — 계획대로 진행. 정정 커밋 본문에 "과거 기각된 `SMTP_BLOCK_PRIVATE_HOSTS` 흔적 제거" 라고 명시하면 다음 검토자가 이력 추적하기 쉬워진다.

- **[INFO]** `http-safety` / `ssrf.util` 이원화 해소는 여러 Rationale 이 반복적으로 못박은 "SSRF posture 일관성" 원칙의 이행이다
  - target 위치: `1-http-request.md` §4-8, `2-database-query.md` §4 SSRF 가드, `3-send-email.md` §4-7 · §8.0
  - 과거 결정 출처:
    - `1-http-request.md` §8.2 "SSRF 가드 전 인증 방식 적용 — `none`/`custom` 무가드 폐지" — "§4 SSRF opt-out callout … 와 정면 모순이었다" 를 이유로 통일 강행, 대안 (B) 플래그 이원화·(C) 현상유지+명문화 모두 기각
    - `1-http-request.md` §8.3 "SSRF 차단 메시지 일반화" — "HTTP Request 만 원본을 노출하는 3-node 비대칭 상태" 를 결함으로 규정하고 통일
    - `2-database-query.md` `## Rationale` "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설" — "세 integration 노드의 SSRF posture 를 일관되게 노출"
    - `spec/2-navigation/4-integration.md` "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"
  - 상세: 네 개 Rationale 항목 모두 "세 노드(HTTP/DB/Email)의 SSRF 차단 범위·플래그·메시지 형식이 갈리는 것 자체를 결함으로 취급하고 통일해왔다" 는 하나의 일관된 노선을 보여준다. 이번 구현이 고치려는 "SMTP 만 CGNAT 통과 / HTTP·DB 만 IPv4-mapped 통과" 는 바로 그 노선이 아직 못 미친 지점이며, 계획대로 `http-safety` 판정 로직 하나로 합치는 것은 이 노선의 자연스러운 다음 단계다. **기각된 대안 재도입도, 무근거 번복도 아니다.**
  - 제안: 없음. 다만 구현 완료 후 `error-codes.ts` 의 "`http-safety.ts` 가 HTTP/DB/Email 공용 SoT" 주석이 이번 변경으로 처음 참이 되므로, 커밋 메시지에 "주석이 기술하던 상태를 코드가 이제 충족한다" 는 실측을 남겨두면 향후 spec-coverage 류 감사에서 재부각되지 않는다.

- **[INFO]** DNS 해석 실패 시 fail-open 은 유지되지만, 그 자체가 어느 spec `## Rationale` 에도 명시적으로 근거를 두고 있지 않다
  - target 위치: `1-http-request.md` §4-8 (`assertSafeOutboundHostResolved`), `3-send-email.md` §4-7, `2-database-query.md` §4 SSRF 가드
  - 과거 결정 출처: 해당 없음 (검색 결과 0건 — `fail-open`/DNS 해석 실패 처리에 대한 Rationale 서술을 번들 내에서 찾지 못함)
  - 상세: 계획 문서는 "DNS 실패는 지금처럼 통과(fail-open — 두 구현이 같다)" 라고 명시하지만, 이는 새로 만드는 동작이 아니라 `http-safety`/`ssrf.util` 양쪽에 이미 있던 동작을 그대로 유지하는 것이다. 세 노드 spec 모두 "DNS resolve 후 IP 재검사(DNS rebinding 방어)" 까지만 서술하고, 해석 자체가 실패했을 때(NXDOMAIN, 타임아웃 등) 무엇을 하는지는 spec 에 없다 — 즉 이번 구현이 건드리는 지점이지만 spec 이 아직 다루지 않는 암묵적 invariant다. 위반은 아니지만, SSRF 가드 세 곳을 한 판정기로 합치는 이번 작업이 "판정기의 완전한 계약"을 문서화할 자연스러운 기회다.
  - 제안: 필수는 아니나, 구현 PR 에서 `http-safety` 쪽 Rationale(또는 각 노드 §4 서술)에 "DNS 해석 실패 시 차단하지 않는다(가용성 우선, 상세 근거)" 한 줄을 추가하면 다음 사람이 이 침묵을 "미검토" 로 오인해 재조사하는 비용을 줄인다. `plan/complete/` 이관 시 `spec_impact: none` 을 유지할지, 이 한 줄만 §Rationale 에 추가할지는 developer 판단.

- **[INFO]** `ssrf.util`(LLM·S3)을 비대상으로 남기는 결정의 근거가 LLM 전용이며 S3 몫은 암묵적으로 얹혀 있다
  - target 위치: `plan/in-progress/ssrf-guard-integration-unify.md` §"비대상" 1번
  - 과거 결정 출처: `spec/5-system/7-llm-client.md` `## Rationale` "왜 SSRF 가드·secret-store 는 재사용하는가" — `tei` 셀프호스팅 리랭커에 §5.5 사설망 예외 규칙 재사용
  - 상세: 계획은 "CGNAT 를 더하면 Tailscale(100.64/10) 너머의 비-`local` 프로바이더가 막힐 수 있고 LLM 쪽엔 opt-out 플래그가 없다" 는 이유로 `ssrf.util` 전체(LLM **및 S3**)를 이번 변경 범위에서 제외하고 트래커로 넘긴다. 이 근거는 LLM 프로바이더의 사용 패턴(Tailscale 경유 self-host)에 특정된 것이라, S3 설정이 같은 이유로 제외되어야 하는지는 계획 문서 자체에 별도로 논증되어 있지 않다 — 다만 이는 spec 상의 기각된 결정과 충돌하는 것이 아니라 **아직 spec/Rationale 화되지 않은 신규 스코프 판단**이며, target(`spec/4-nodes/4-integration/`) 범위 밖의 사안이라 이번 문서 자체의 Rationale 연속성 위반은 아니다.
  - 제안: 이 판단이 트래커 항목으로 격상되어 실제 결정될 때, S3 몫은 LLM 과 별도로 "왜 제외하는가"를 한 줄 추가해 두면 나중에 "왜 얹혀갔지" 라는 재질문을 막을 수 있다. 지금 이 PR 의 범위는 아니다.

## 요약

이번에 검토한 target(`spec/4-nodes/4-integration/` 세 노드 spec + `plan/in-progress/ssrf-guard-integration-unify.md`)은 spec 텍스트를 바꾸지 않고 코드를 spec 이 이미 서술한 상태로 맞추는 작업이다. 번들에 포함된 관련 `## Rationale` 전량(1-http-request §8.2/§8.3, 2-database-query `DB_HOST_BLOCKED` 신설, 2-navigation/4-integration "SMTP SSRF 가드 통일", 5-system/7-llm-client "SSRF 가드 재사용")을 대조한 결과, 이번 구현은 과거에 기각된 대안(별도 SMTP opt-in 플래그)을 되살리지 않고, 오히려 "세 Integration 노드의 SSRF posture 를 하나로 유지한다"는 반복적으로 확인된 원칙을 완성하는 방향이다. 새 Rationale 없이 결정을 번복하는 지점도 발견되지 않았다. 다만 DNS 해석 실패 시 fail-open 이라는 보안 관련 암묵적 가정이 어느 spec 에도 명문화되어 있지 않아 이번 통합 작업 중에 한 줄 추가해 두는 것을 권고하며(INFO), `ssrf.util` 비대상 처리에서 S3 의 개별 근거가 LLM 근거에 얹혀 있는 점도 향후 트래커 항목 격상 시 보완할 만하다(INFO). 두 항목 모두 진행을 막을 사유는 아니다.

## 위험도

NONE
