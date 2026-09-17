# Rationale 연속성 검토 — `plan/in-progress/spec-draft-trigger-lock-gaps.md`

## 검토 범위와 방법

target 이 손대는 4개 spec(`2-trigger-list.md` §3/§4.3/§4.4, `redis-keys.md` §4, `15-chat-channel.md`
§5.4.1.1, `11-workflow.md` §3.1)의 `## Rationale` 을 직접 열어(번들이 예산 초과로 절단한 3개 —
`4-execution-engine.md` · `15-chat-channel.md` · `11-workflow.md` — 는 저장소 원본을 직접 Read) target
draft 의 여섯 처방(1·2·3·4·5·5b) 각각이 인용하거나 건드리는 과거 결정과 대조했다. 추가로 코드
(`trigger-config-lock.ts` · `triggers.service.ts` · `execution-engine.service.ts`)를 열어 target 이
서술하는 설계가 실제 배선과 일치하는지, 그리고 코드 주석 자체가 인용하는 과거 Rationale(Cafe24
advisory lock 기각)이 실재하는지 확인했다.

## 발견사항

- **[INFO]** `redis-keys.md §2` 의 "워크스페이스 세그먼트를 가진 키는 없다" 서술이 B1 적용 후 stale 해진다
  - target 위치: 변경안 B1 (`spec/conventions/redis-keys.md §4` 표에 `exec-cap:<workspaceId>` 행 추가)
  - 과거 결정 출처: `spec/conventions/redis-keys.md` §2 본문 — *"현재 실재하는 키 중 `workspaceId`
    세그먼트를 가진 것은 없다. 전부 execution·trigger·IP·전역 단위 책임이고, `executionId`·`triggerId`
    는 이미 전역 유일 UUID 라 워크스페이스 세그먼트가 정보를 더하지 않는다."* 그리고 같은 파일
    `## Rationale` §"왜 규칙을 코드에 맞췄나"의 동일 주장(*"실재 키 중 워크스페이스 종속이 자연스러운
    것이 없다"*).
  - 상세: `execution-engine.service.ts:2974` 의 `exec-cap:${workspaceId ?? execution.workflowId}` 는
    코드에 이미 존재하고, B1 은 이를 §4 인벤토리에 정식 등재한다. §2 가 명시한 "워크스페이스 세그먼트를
    추가해도 되는 유일한 조건"(*"워크스페이스별 쿼터·격리된 네임스페이스 열거"*)에 `exec-cap` 이 정확히
    해당하므로 **규칙 자체를 위반하지는 않는다** — 그러나 §2 본문의 "지금은 없다"는 사실 진술과 그 진술에
    기대는 Rationale 문장은 B1 이 반영되는 순간 더 이상 참이 아니게 된다. target 은 §4 표만 건드리고
    §2 본문·Rationale 문장은 그대로 둔다.
  - 제안: B1 에 §2 본문 한 문장(예: *"단, `exec-cap:<workspaceId>` 는 워크스페이스별 동시-실행 쿼터라
    위 예외 조건에 해당한다"*) 갱신을 함께 묶거나, 최소한 B2 문단에 "이 등재로 §2 의 '지금은 없다'가
    깨진다"는 한 줄을 남겨 다음 편집자가 §2 를 stale 상태로 방치하지 않게 한다. 규칙 위반이 아니라
    서술 정합 보완이라 WARNING 이 아닌 INFO 로 매긴다.

## 교차검증 결과 (문제 없음 — 기록용)

- **①(chat-channel glob 미확장) 판단은 `R-CC-22`(좁은 glob 채택·통짜 기각·"게이트가 무는 범위는 그
  spec 이 서술하는 표면이어야 한다")의 원칙을 그대로 따른다.** target 이 `trigger-config-lock.ts` 를
  `15-chat-channel.md` 의 glob 에 얹지 않고 `2-trigger-list.md` 의 명시 `code:` 로 둔 것은 이 원칙의
  적용이지 위반이 아니다. `trigger-config-lock.ts` 도 단일 파일이라 "증가가 예정된 집합은 술어로"
  원칙과도 충돌하지 않는다(글로브 대상이 아니라 명시 나열이 맞는 경우).
- **A2 의 "외부 provider 호출은 락 밖" 제약은 `spec/2-navigation/4-integration.md` Rationale
  "BullMQ `cafe24-token-refresh` 큐 — 멀티 인스턴스 race 해소"의 "검토 후 배제한 대안 — PostgreSQL
  advisory lock"** 을 정확히 인용한다(문구까지 일치: *"lock 보유 중 HTTP 요청을 transaction 안에
  묶어야 해 DB 커넥션 점유 시간이 늘고"*). 이 인용은 실재하는 과거 결정이며(가공된 선례 아님),
  `trigger-config-lock.ts` 코드 주석(L134-142)도 동일 문구로 이미 이 구분("기각된 대안의 재도입이
  아니라 그 반론을 받은 설계")을 명시하고 있다. `triggers.service.ts` 의 실제 배선(`setupChannel`
  호출이 락 트랜잭션 **이전**에 완료 — L1281 vs L1318)도 이 서술과 일치한다.
  target 은 기각된 대안을 재도입하지 않았고, 그 대안이 기각된 *이유*를 제약으로 흡수했다 —
  Rationale 연속성 관점에서 모범적인 처리다.
  - 참고: 같은 advisory-lock 패턴의 선례가 하나 더 있다 — `4-execution-engine.md §8`(admission gate,
    `pg_advisory_xact_lock` + "조건부 UPDATE 단독은 불충분"). target 의 B1 이 이 절을 SoT 링크로
    올바르게 인용하며, 두 계열이 32비트 해시 공간을 공유한다는 B2 의 신규 서술도 기존 Rationale 과
    충돌하지 않는다(기존 문서 어디에도 해시 공간 분리를 요구하는 결정이 없다 — 순수 신규 보강).
- **③(`15-chat-channel.md §5.4.1.1` 각주 시제) 판단은 `R-CC-21`(*"§5.4.1.1 이 v1 차단을 선언했지만
  구현이 정반대였다… 매 PATCH 마다 금지된 회전을 강제했다"*)과 정확히 부합한다.** 각주가 과거형
  결함을 서술하고 있고 현재 코드(`update-trigger.dto.ts`)가 표와 일치한다는 target 의 실측은 R-CC-21
  의 서술과 모순 없이 겹친다. "모순 해소"가 아니라 "시제 명시"로 처리한 target 의 판단은 옳다 — 이
  항목에 새 결정이나 새 Rationale 이 필요 없다는 target 자신의 결론과도 일치한다.
- **5b(CASCADE 전수화)는 어떤 과거 결정의 번복도 아니다.** `11-workflow.md` §3.1 다이어그램의 5개
  나열(`nodes/edges/versions/executions/assistant_sessions`)이 왜 4개(trigger·
  integration_usage_log·alert_rule·workflow_test_dataset)를 뺐는지 정당화하는 Rationale 항목은
  존재하지 않는다 — 즉 의도적 제외가 아니라 미완성 열거였다. `11-workflow.md` 자신의 선례("duplicate
  는 캔버스 전체를 복제한다" 항목 — 코드 관측을 그대로 옮겨 적은 drift 산출물을 나중에 정정)와 같은
  종류의 보정이며, 그 선례도 원문을 직접 교체(취소선 없이)하고 정정 근거만 Rationale 에 남기는 방식을
  썼다 — target 의 D1(라벨 직접 교체)도 같은 문서 내부 컨벤션과 일치한다. (반면 target 이 C 절에서
  "원문은 한 글자도 지우지 않는다"고 선언한 것은 `15-chat-channel.md` 자신의 R-2 취소선 관행을 따른
  것으로, 두 문서가 서로 다른 보정 관행을 갖고 있고 target 이 각각 맞게 적용했다.)
- 트래커 참조(`plan/in-progress/spec-draft-nullable-notation-followups.md` "developer 항목 7")는
  실재한다(해당 파일 L4490, "창 1… FK CASCADE 창에 대해 미검증"). 가공 인용 아님.

## 요약

target 은 손대는 4개 문서의 관련 Rationale(R-CC-10·R-CC-21·R-CC-22, redis-keys.md §2·Rationale,
4-integration.md 의 Cafe24 advisory-lock 기각, 4-execution-engine.md §8 admission-gate 근거,
2-trigger-list.md R-1/R-4/R-5)을 실제로 열어 정합성을 확인한 흔적이 뚜렷하고, 기각된 대안을 재도입하는
곳도, 합의된 원칙을 위반하는 곳도, 근거 없이 과거 결정을 뒤집는 곳도 발견되지 않았다 — 오히려 Cafe24
advisory-lock 기각 사유를 설계 제약으로 정확히 흡수하는 등 연속성 처리가 모범적이다. 유일한 지적은
`redis-keys.md` §2 의 "워크스페이스 세그먼트 키가 없다"는 서술이 B1 의 신규 등재로 인해 사실상 stale
해지는데 target 이 그 문장 자체는 갱신하지 않는다는 점으로, 규칙 위반은 아니고 문서 정합 보완 수준의
INFO 다.

## 위험도

LOW
