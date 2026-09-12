# Rationale 연속성 검토 — `spec-draft-setup-error-classification.md`

## 발견사항

- **[WARNING]** 신설 `502` 의 판정 축이 기존 502/503 경계 Rationale 과 다른 기준을 쓰는데 그 선례를 인용하지 않는다
  - target 위치: 「결정 (4) `2-api-convention.md §6` 에 **502 행 신설**」 및 하단 `## Rationale` 논지 1·§5.4 결정 (1)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale` → `continuation publish 실패 동기 surface 통일 (C-1·M-7)` — *"HTTP 코드는 **503**으로 정한다 — Redis 의존성 장애 = upstream 불가용이므로 **502(잘못된 게이트웨이 응답)가 아니라 503(일시 불가·재시도)이 맞고**, 이미 `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)이 같은 503 선례를 확립했다."* (동일 판단이 `codebase/backend/src/modules/executions/executions.service.ts:919` 주석에도 `"불가용 → 502 아닌 503"` 로 박혀 있다.)
  - 상세: 이 저장소에 502/503 경계를 다룬 유일한 기존 판단은 **"게이트웨이가 잘못된 응답을 반환했는가(502) vs 일시적으로 이용 불가해 재시도해야 하는가(503)"** 라는 축이다. 반면 target 은 §6 신설 502 행에서 **"외부 제3자(502) vs 우리 인프라(503)"** 라는 **다른 축**을 세운다. 두 축은 겹치는 영역(예: provider 타임아웃 — target 은 이를 "그 밖의 실패(재시도 가능)"로 뭉뚱그려 502 에 넣지만, 기존 축으로 보면 "일시 불가·재시도" 는 503 이 맞다고 판단했던 사례와 같은 성질이다)에서 결론이 갈릴 수 있는데, target 의 새 Rationale(R-CC-23)은 이 선행 판단을 인용도 반박도 하지 않은 채 조용히 지나간다. 두 축이 실제로는 상호 보완적(외부/내부라는 소유 축과 응답유효성/가용성이라는 성질 축은 별개 차원)일 수도 있지만, 그 정합을 명시하지 않으면 다음 사람이 "Redis 도 외부 의존성인데 왜 502 가 아니냐" 혹은 "provider 타임아웃도 일시 불가인데 왜 503 이 아니냐" 는 질문에 부딪힐 때 두 Rationale 이 서로 다른 이유로 각자 502/503 을 정당화하고 있어 통합된 근거를 재구성해야 한다.
  - 제안: `R-CC-23` 논지에 `4-execution-engine.md §7.5.2 Rationale (C-1)` 을 명시적으로 인용하고, "그 결정은 '응답 유효성 vs 일시 가용성' 축이었고 본 결정은 '소유 주체(외부 3rd-party vs 우리 인프라)' 축이다 — 두 축이 어떻게 공존하는지" 한 문장으로 밝힌다. 또는 최소한 §6 신설 502 행에 provider 타임아웃/네트워크 실패가 "재시도 가능"이라는 점에서 503 의미와 닿아 있음을 인지하고 있다는 각주를 남긴다.

- **[WARNING]** 대체된 백로그 처방("adapter가 status를 메시지에 싣게 통일")이 신규 typed-`code` 결정과 충돌한 채로 방치될 위험
  - target 위치: 「결정 (2) 판별을 **typed `code`** 로」 및 체크리스트 "트래커 항목을 developer → planner 완료 + developer 후속으로 재기술"
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` L2766-2775 — *"`translateSetupChannelError` 가 discord verify_key 불일치를 502 로 떨어뜨린다"* 항목의 처방 후보: *"(a) 판별식을 `BOT_TOKEN_INVALID` 리터럴까지 보게 확장 (b) adapter 가 status 를 메시지에 싣게 통일. **(b) 가 근본이다**"*
  - 상세: 이 백로그 항목은 아직 `in-progress` 로 살아 있고, "근본 처방은 (b) adapter가 status 코드를 message 문자열에 싣도록 통일하는 것"이라고 **명시적으로 결론**을 내려 두었다. target 은 이 방향(메시지에 정보를 실어 문자열로 판별하는 접근)을 §113-134 「처음엔 message 접두로 제안했다가 `--spec` 지적을 받고 바꿨다」에서 **정확히 같은 형태(문자열 기반 판별)의 변형**으로 취급해 기각하고 typed `code` 로 대체했다. 이는 정당한 재검토처럼 보이지만, 원 백로그 파일의 "(b) 가 근본이다" 문장 자체는 아직 지워지지도 정정되지도 않았다 — target 의 체크리스트는 "재기술" 이라고만 적어 **그 특정 문장을 어떻게 처리할지**를 명시하지 않는다. 이 상태로 세션이 끝나면 다음 사람이 `spec-draft-nullable-notation-followups.md` 를 SoT 로 읽고 "adapter가 status를 message에 싣는" 접근(=이번에 기각된 대안)을 다시 채택할 수 있다.
  - 제안: 이 턴에서 `spec-draft-nullable-notation-followups.md` L2766-2775 항목에 취소선 또는 정정 각주를 남겨 *"근본 처방은 (b) 가 아니라 typed `code` (R-CCA-9 §1.1.2) 로 대체됐다"* 를 명시한다. 체크리스트의 "재기술"을 이 구체적 조치로 좁혀 적어 둘 것.

- **[INFO]** `R-CCA-5` 인용이 실제 화이트리스트 정의처와 다르다
  - target 위치: 「결정 (2)」 본문 — *"[`chat-channel-adapter.md R-CCA-5`](../../spec/conventions/chat-channel-adapter.md) — 분류 입력은 화이트리스트(`error.code` + `details.statusCode`)만, `error.message` 원문은 배제."*
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` `R-CCA-5` 본문은 "분류 helper 를 Convention 에 두는 이유(layer 분리)"와 "`error.message` 원문을 그대로 전달하지 않는 이유(PII/누출 위험)"만 서술한다. `error.code` + `details.statusCode` **2필드 화이트리스트**를 실제로 정의하는 곳은 `spec/5-system/15-chat-channel.md` **`R-CC-15`** ("Execution Failed 안내 — 분류 입력 화이트리스트 + placeholder 1종 정책") 쪽이다. R-CCA-5 자신도 그 세부를 `"본 결정의 PII 위험 평가 상세는 Spec Chat Channel R-CC-15 대안 2 참조"` 로 위임하고 있다.
  - 상세: 인용 오류 자체가 새로운 설계 결함을 만들지는 않으나(둘 다 "message 배제, 구조적 판별자 사용"이라는 같은 결론을 공유), 정확한 출처 표기가 없으면 다음 검토자가 "R-CCA-5 를 열어봤는데 그 화이트리스트가 안 보인다"며 target 의 근거를 반증된 것으로 오판할 수 있다. cf. 이 저장소가 이미 겪은 실패 유형(잘못된 근거 소급 부여)과 같은 클래스.
  - 제안: 인용을 `R-CC-15`(화이트리스트 정의처) + `R-CCA-5`(그 결정을 Convention 층에 두는 이유)로 분리해 명시하거나, "R-CCA-5(→ R-CC-15 위임)" 형태로 정정한다.

## 요약

target 은 이 저장소가 이미 확립한 두 핵심 원칙 — ①"판별자는 message 파싱이 아니라 구조적 `code` 프로퍼티"(§7.5.2, R-CCA-5/R-CC-15) ②"client 응답에 provider/내부 원문을 echo 하지 않는다"(§7.5.2 보안 게이트, R-CCA-5) — 를 정확히 인식하고 그 위에서 설계를 일반화하고 있으며, 기각한 대안(503 재사용, message 접두 유지)에 대해서도 근거를 구체적으로 제시해 "기각된 대안의 무근거 재도입"이나 "합의 원칙의 명백한 위반"에 해당하는 CRITICAL 사안은 발견되지 않았다. 다만 신설하는 `502` 상태 코드의 판정 축이 `4-execution-engine.md` 의 기존 502/503 관련 Rationale(C-1)과 다른 차원의 기준(외부/내부 소유 vs 응답유효성/가용성)을 쓰면서도 그 선례를 인용·정합화하지 않은 점, 그리고 이번 결정이 대체하는 백로그의 "근본 처방" 문장이 아직 살아있어 향후 그 문장을 SoT 로 오인해 기각된 접근이 되살아날 위험이 있는 점은 이 턴 안에서 닫아야 할 WARNING 급 gap 이다. R-CCA-5 인용 출처 오류는 경미한 정정 사안이다.

## 위험도
MEDIUM
