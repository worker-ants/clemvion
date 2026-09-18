# Rationale 연속성 검토 — `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`

## 발견사항

### [INFO] 「닫힌 열거 위반 → 설계 변경」 전환이 목적문서 안에서 이미 정합적으로 처리됨
- target 위치: `## Rationale` > `채팅 채널 트리거 — R-CC-21 과의 관계` 절, `### --spec 2차 처분` 절
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-19 (`CCH-NF-03 rate-limit — replay 큐 대신 skip + degraded` — "degraded 의 두 경로 정합": `chat_channel_health=degraded` 는 CCH-SE-01·CCH-NF-03 두 경로에서만 설정되는 **닫힌 열거**)
- 상세: 이 draft 의 1차 처분 초안은 V131 이 endpoint_path 를 바꾼 채팅 채널 트리거를 `degraded` 로 표시하려 했다. 이는 R-CC-19 가 명시적으로 "두 경로" 로 닫아 둔 상태 열거에 **세 번째 경로**(마이그레이션에 의한 경로 변경)를 근거 갱신 없이 얹는 것이어서, 그대로였다면 CRITICAL(합의된 원칙 위반)에 해당했을 것이다. 그런데 이 draft 는 자체 2차 `--spec` 검토(`review/consistency/2026/09/18/23_54_40`, Critical 2)에서 이미 이 충돌을 발견했고, 최종안은 **상태 컬럼을 전혀 쓰지 않는 방향으로 설계를 변경**했다(NOTICE + 운영 절차로 대체). 즉 "결정의 무근거 번복" 이 아니라 "번복 + 새 근거 기술" 이 이미 같은 문서 안에 존재한다.
- 제안: 조치 불요. 다만 `spec/5-system/15-chat-channel.md` 본문(R-CC-19)에는 이번에 "제3의 경로 후보가 검토되었다가 기각됐다" 는 흔적이 전혀 남지 않는다 — 향후 누군가 같은 유혹(마이그레이션·배치성 원인으로 degraded 를 확장)에 다시 빠질 수 있으므로, S3 나 별도 항목으로 15-chat-channel.md Rationale 에 "제3의 경로 후보 논의·기각 이력" 한 줄을 남기는 것을 고려할 수 있다(선택 사항, 이 draft 의 최소 변경 범위 밖).

### [INFO] `data-flow/10-triggers.md` 정정 형식이 실물과 일치함을 확인
- target 위치: S7 (`spec/data-flow/10-triggers.md` `## Rationale` > `Webhook endpoint_path 의 UNIQUE 범위`)
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` R-2 (「정정 (날짜)」 블록 + 원문 취소선 보존 관례)
- 상세: 대상 파일의 실제 현재 문구(`data-flow/10-triggers.md:247,250`)를 직접 열어 대조한 결과, S7 이 취소선 처리하려는 두 문장(「`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 …」·「충돌 회피는 … UUID 로 자동 발급해 사실상 전역 고유로 만드는 방식에 의존한다」)은 정확히 현재 SoT 문구와 일치한다. R-2 의 정정-블록 관례(원문 보존 + 「정정 (날짜)」 + 링크)를 그대로 재사용하겠다는 계획도 형식이 일치한다. 새 사실을 반증 없이 덮어쓰는 것이 아니라 이력을 보존하며 정정하는 방식이라 원칙 위반이 아니다.
- 제안: 조치 불요.

### [INFO] `endpointPath 가변성` Rationale 과 마이그레이션 경로 변경의 충돌 없음
- target 위치: 결정 2, S4 두 번째 불릿
- 과거 결정 출처: `spec/5-system/12-webhook.md` `## Rationale` > `endpointPath 가변성 — webhook 은 mutable, schedule 만 frozen`
- 상세: 이 Rationale 은 "webhook 트리거의 endpointPath 는 의도적으로 변경 가능" 이라는 원칙만 세우며 변경 경로(서비스 계층 PATCH)를 못박지는 않는다. V131 이 SQL 로 직접 endpoint_path 를 재발급하는 것은 이 원칙과 충돌하지 않고, 오히려 동일 문서의 `inline auth path 폐지` Rationale 이 인용하는 `V066__trigger_config_strip_inline_auth.sql`(서비스 계층을 거치지 않는 정리성 마이그레이션의 선례)과 같은 계열이다. 감사 로그(`trigger.updated`, R-4)를 거치지 않는 것에 대해서도 V066 선례가 있어 새로운 예외를 만드는 것이 아니다.
- 제안: 조치 불요.

### [INFO] R-CC-21 · R-CC-12(d) · CCH-AD-02 인용의 정합성 확인
- target 위치: `채팅 채널 트리거` 절 전체
- 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-21(PATCH 는 비밀을 쓰지 않는다), R-CC-12(d)(auth 401 은 비활성 트리거에도 적용), CCH-AD-02(멱등 재등록 전제)
- 상세: (1) "다시 저장 → `setupChannel` 재호출" 흐름은 CCH-AD-02 의 "`chatChannel` 이 실린 일반 PATCH 시 자동 호출" 전제와 정확히 맞물린다(재저장 PATCH 가 `chatChannel` 필드를 포함해야 발동). (2) 재저장 PATCH 가 `botToken`/`inboundSigningPlaintext` 를 다시 받지 않아도 되는 것은 R-CC-21 의 D-1/D-2(그 두 비밀은 PATCH 로 받지도 쓰지도 않는다) 결정과 모순되지 않는다 — 기존 비밀은 그대로 두고 endpointPath 만 새로 반영하는 재등록이라 R-CC-21 이 막으려던 "비밀 파괴" 시나리오에 해당하지 않는다. (3) "복사된 경로가 채팅 채널이면 원 소유자의 비밀로 서명 검증에 실패해 401" 이라는 주장은 R-CC-12(d)+구현 정합 각주(`handleChatChannelWebhook` 이 `isActive` 검사보다 서명 검증을 먼저 한다)와 정확히 일치한다. 세 인용 모두 원문과 대조해 오용이 없음을 확인했다.
- 제안: 조치 불요.

## 요약

target 문서는 이미 두 차례의 `--spec` 리뷰(1차·2차, 각 BLOCK:YES)를 거치며 Rationale 연속성에 해당하는 지적(특히 R-CC-19 의 "degraded 닫힌 두 경로" 원칙을 무근거로 확장하려던 1차 초안, `data-flow/10-triggers.md` 의 반증된 전제 방치)을 스스로 찾아내고 새 근거와 함께 번복했다. 이번 검토에서 인용된 과거 Rationale(R-CC-19·R-CC-21·R-CC-12(d)·CCH-AD-02·`endpointPath 가변성`·`inline auth path 폐지`)을 실제 spec 원문과 대조한 결과 오용·왜곡 없이 정확히 인용되어 있고, 기각된 대안의 무단 재도입이나 합의 원칙의 직접 위반은 발견되지 않았다. 유일한 잔여 사항은 정보성 제안(3번째 상태 경로 후보가 검토·기각됐다는 이력을 `15-chat-channel.md` 쪽에도 남길지 여부)으로, 이 draft 의 변경 범위를 넘어서는 선택 사항이다.

## 위험도
NONE
