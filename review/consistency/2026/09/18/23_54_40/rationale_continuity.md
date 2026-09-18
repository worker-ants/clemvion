# Rationale 연속성 검토 — `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`

## 발견사항

### [CRITICAL] `chat_channel_health=degraded` 의 "두 경로" 닫힌 열거를 세 번째 경로로 깨면서 그 문장을 갱신하지 않음

- **target 위치**: 결정 2 (`## 결정 (2026-09-18 사용자)` 항목 2) · 「채팅 채널 트리거 — R-CC-21 과의 관계」절 · 구현 절 V131. `spec_impact` 목록에 `spec/5-system/15-chat-channel.md` 가 **없다**.
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md`
  - §3.4 `CCH-SE-01` 표 행(필수 요구사항 본문, `## Rationale` 아님): *"`degraded` 설정 경로는 본 CCH-SE-01(외부 API 호출 실패) 외에 CCH-NF-03(per-chat rate-limit 초과)도 포함 — **두 경로 모두** 동일 health 자원·자동 비활성화 금지 (R-CC-19)"*
  - `## Rationale` → `R-CC-19. CCH-NF-03 rate-limit — replay 큐 대신 skip + degraded`: *"**degraded 의 두 경로 정합**: `chat_channel_health=degraded` 는 CCH-SE-01(어댑터 외부 API 호출 실패)과 본 CCH-NF-03(rate-limit 초과) **두 경로**에서 설정되며, 둘 다 …"*
- **상세**: 이 두 문장은 `chat_channel_health=degraded` 를 설정하는 코드 경로가 **정확히 둘**이라고 닫힌 집합으로 못박아 두었다(둘 다 "필수" 급 정의). 그런데 target 의 결정 2·V131 은 **일회성 SQL 마이그레이션**이 채팅 채널 트리거의 `endpoint_path` 를 바꾸면서 `chat_channel_health='degraded'` + `chat_channel_last_error` 를 직접 세팅한다 — CCH-SE-01(어댑터 외부 API 호출 실패)도 CCH-NF-03(rate-limit 초과)도 아닌 **세 번째 경로**(마이그레이션에 의한 provider 등록 불일치)다. `1-data-model.md`·`12-webhook.md`·`2-trigger-list.md`·`3-error-handling.md`·`data-flow/10-triggers.md` 만 `spec_impact` 에 있고 `15-chat-channel.md` 는 빠져 있어, 이 draft 가 그대로 반영되면 CCH-SE-01 표 행과 R-CC-19 의 "두 경로" 서술이 **거짓**이 된 채로 남는다. target 의 「채팅 채널 트리거」 절 자신도 "`degraded`·`chat_channel_last_error` 는 이미 채팅 채널 실패를 드러내는 표준 자원이다(CCH-SE-01·CCH-NF-03)" 라고 그 두 항목만 인용해 재사용을 정당화하는데, 정작 그 두 항목이 스스로 "이 자원을 세팅하는 경로는 이 둘뿐" 이라고 선언하고 있다는 점은 다루지 않았다. 1차 검토(`review/consistency/2026/09/18/23_39_46`)의 Critical 1 은 R-CC-21(재등록 경로) 과의 관계만 짚었고, 이 "두 경로 닫힌 열거" 충돌은 별개 지점이라 아직 처분되지 않았다.
- **제안**: (a) `spec_impact` 에 `spec/5-system/15-chat-channel.md` 를 추가하고, (b) CCH-SE-01 표 행과 R-CC-19 Rationale 의 "두 경로" 를 "세 경로"(또는 "N 경로")로 갱신하며 세 번째 경로(마이그레이션에 의한 endpoint_path 재발급)를 명시하거나, (c) 대안으로 이 상태를 `chat_channel_health=degraded` 재사용 대신 `chat_channel_last_error` 만 채우고 health 는 건드리지 않는 방식으로 바꿔 두 경로 불변식을 보존할지 결정한다. 어느 쪽이든 "두 경로" 문장이 지금처럼 반증된 채 방치되면 안 된다.

## 요약

이 draft 는 이미 한 차례 `--spec` 차단(Critical 2·WARNING 1)을 통과하며 R-CC-21(재등록 경로)·데이터 모델 UNIQUE 범위·409 카탈로그 서술을 신중하게 재정합했고, WH-SC-01/`endpointPath 가변성`의 "고엔트로피가 squatting·enumeration 을 막는다" 는 반증된 전제도 자기-반증형 소정정과 같은 취소선+정정 관례로 올바르게 처리했다 — 과거 Rationale 을 인용 없이 뒤집거나 근거 없이 번복한 지점은 보이지 않는다. 다만 결정 2(V131)가 재사용하는 `chat_channel_health=degraded` 자원은 `15-chat-channel.md` 의 CCH-SE-01/R-CC-19 가 "정확히 두 경로에서만 설정된다" 고 닫아 둔 불변식이며, 이 draft 는 그 문서를 `spec_impact` 에 넣지 않은 채 세 번째 경로를 추가해 그 문장을 반증한다. 전체적으로 연속성 관리는 성숙하지만 이 한 지점은 놓쳤다.

## 위험도

HIGH
