# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** cafe24 install Redis 키의 "degradation SoT" 를 §9.8 로 지목하는 크로스 레퍼런스가 이번 §4.4 신설과 어긋난 채 남았다
  - 위치: `spec/2-navigation/4-integration.md:1294` (본 diff 대상 파일은 아니지만, 이번 PR 이 만든 SoT 재배치의 직접적 부작용)
  - 상세: 이번 diff 는 `spec/4-nodes/4-integration/4-cafe24.md` 에 신설 §4.4 를 만들고 그 안에서 "용도·TTL·**degradation** 은 이 절(§4.4)이 SoT" 라고 명시했으며, §9.8 은 그 갱신된 안내문(같은 diff)에서 "이 절(§9.8)은 **왜 그렇게 설계했는지**를 담는다" 로 스스로 역할을 좁혔다. `spec/conventions/redis-keys.md` 인벤토리도 이에 맞춰 포인터를 `#98-...` → `#44-...` 로 갱신했다.
    그런데 `spec/2-navigation/4-integration.md:1294` 는 여전히 "상수(`INSTALL_FAIL_THRESHOLD=10`, `INSTALL_FAIL_WINDOW_SEC=600`)·**키 구성·degradation** 의 SoT 는 [Spec Cafe24 §9.8]... Rate limiting note 와 '관련 코드 상수' 테이블" 이라고 적어, **degradation 의 SoT 가 §9.8 이라는 이제는 틀린 주장을 그대로 유지**하고 있다. 두 문서가 같은 사실(Redis 미가용 시 동작)에 대해 서로 다른 절을 SoT 로 지목하는 상태 — 이 PR 이 원래 고치려던 "규범 문장 이중화" 클래스의 새 사례다.
    (같은 파일의 `:808`, `:858` 두 인용은 "Rate limiting note"(Layer1/Layer2 서술) 자체를 가리키는 것이고 그 내용은 §9.8 에 그대로 남아 있어 무관 — `:1294` 하나만 "degradation SoT" 를 명시적으로 §9.8 로 못박아 문제된다.)
  - 제안: `spec/2-navigation/4-integration.md:1294` 의 "키 구성·degradation 의 SoT 는 §9.8" 문구를 "degradation 의 SoT 는 [§4.4](../4-nodes/4-integration/4-cafe24.md#44-private-앱-install-endpoint-의-redis-키-normative), 상수·알고리즘·rate-limit 서술은 §9.8" 형태로 분리 갱신. `spec/data-flow/5-integration.md:156` 은 "상세" 라는 일반 표현이라 급하지 않지만 같은 정리 타이밍에 함께 훑어볼 가치는 있음.

## 요약

핵심 diff(3건)는 문서화 관점에서 전반적으로 견고하다. ① `public-webhook-quota.service.ts` 의 `MINUTE_WINDOW_SEC`/`HOUR_WINDOW_SEC` 독스트링을 "슬라이딩 윈도우" → "fixed-window" 로 정정한 것은 실제 구현(`INCR`+`EXPIRE ... NX`, 같은 파일 `incrWithWindow` 독스트링의 기존 서술)과 스펙(`12-webhook.md`)에 이미 부합하던 사실을 코드 주석만 뒤늦게 맞춘 것으로, 저장소 전체(`ChatChannelRateLimiterService`·`OutboundNotificationRateLimiterService` 등)에 잔존하는 "슬라이딩" 오기가 없음을 grep 으로 확인했다. ② `4-cafe24.md` 는 CLAUDE.md 의 "본문=기술 명세 / Rationale=배경" 원칙을 어기고 있던 §9.8 의 normative 내용(Redis 키 용도·TTL·degradation)을 새 §4.4 로 이관하고 §9.8 자체·`redis-keys.md` 인벤토리 포인터를 함께 갱신했다 — 앵커도 실제 헤딩과 일치함을 확인했다. ③ `15-chat-channel.md` CCH-SE-02 요구사항 행의 구현 리터럴을 걷어내고 `data-flow/14 §2.2` 로 포인터화한 것도 그 대상 절에 동일 내용(`SET NX EX 30`, TTL 30초, 키 포맷)이 실제로 존재함을 확인했다. 다만 §4.4 신설로 SoT 를 재배치하면서 그 사실을 참조하던 **제3의 문서**(`2-navigation/4-integration.md`)의 포인터 한 곳을 갱신하지 못해 두 spec 문서가 같은 사실에 대해 다른 SoT 를 주장하는 상태가 생겼다 — 이 PR 자체가 겨냥한 "이중 SoT" 결함의 축소판 재발이다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크리스트 완료 서술은 실측(자매 서비스 grep, 앵커 대조)과 부합해 과장이 없다.

## 위험도

LOW
