# 문서화(Documentation) 리뷰 — EIA-RL-07 공개 웹채팅 위젯 idle-wait execution 회수 reaper

## 발견사항

- **[WARNING]** `external-interaction.module.ts` 모듈 클래스 JSDoc 의 "Wire-up" 목록이 신규 `WebchatIdleReaperService` 를 누락 — stale 주석
  - 위치: `codebase/backend/src/modules/external-interaction/external-interaction.module.ts` 파일 상단 `@Module` 직전 클래스 docblock (diff 에 미포함 = 무변경 구간)
  - 상세: 동일 PR 에서 `providers`(`WebchatIdleReaperService` 추가)와 `imports`(`BullModule.registerQueue({ name: WEBCHAT_IDLE_REAPER_QUEUE })`)는 갱신됐지만, 모듈 헤더의 "Wire-up:" bullet 목록은 그대로다. 이 목록은 구조적으로 동형인 `TerminalRevokeReconcilerService (EIA-RL-06 — terminal revoke at-least-once sweep, BullMQ repeatable)` 항목은 이미 갖고 있어, 신규 형제 서비스가 빠진 것이 더 두드러진다. 이 docblock 은 모듈이 무엇을 wiring 하는지에 대한 SoT 요약이라, 다음 리더가 목록만 보고 "reaper 미배선" 으로 오판할 수 있다.
  - 제안: `- WebchatIdleReaperService (EIA-RL-07 — 공개 위젯 idle-wait execution 회수, BullMQ repeatable)` 항목을 `TerminalRevokeReconcilerService` 바로 아래에 추가.

- **[INFO]** EIA §3.4 EIA-RL-07 행 / §R19 Rationale 이 grace 값을 제어하는 실제 env 변수명·기본값을 명명하지 않음
  - 위치: `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-07 행, §R19 (라인 ~1254-1264)
  - 상세: 본문은 "grace window(env) 초과 시" 라고만 서술하고 `WEBCHAT_IDLE_REAP_GRACE_MS`/기본 1h 를 명명하지 않는다. 같은 저장소의 자매 개념인 admission 큐 대기 타임아웃은 `spec/5-system/4-execution-engine.md`·`spec/5-system/3-error-handling.md` 양쪽에서 "5분(env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`, 기본 `300000`ms)" 처럼 변수명+기본값을 spec 본문에 직접 명시하는 패턴을 쓴다. `WEBCHAT_IDLE_REAP_GRACE_MS` 자체는 `.env.example`·CHANGELOG 에는 정확히 문서화돼 있으나, EIA spec 만 보는 리더는 실제 튜닝 지점을 찾으려면 코드/`.env.example` 까지 내려가야 한다.
  - 제안: EIA-RL-07 행 또는 R19 본문에 "`WEBCHAT_IDLE_REAP_GRACE_MS`(기본 `3600000`ms/1h)" 를 1회 병기해 기존 컨벤션과 정합.

- **[INFO]** `findIdleWebchatExecutionIds` 의 batchLimit 상한이 다른 기능명을 딴 상수(`RECONCILE_BATCH_MAX`)를 그대로 재사용하며 그 사실이 주석에 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:433-441`
  - 상세: `safeLimit = Math.min(Math.max(1, Math.floor(batchLimit)), RECONCILE_BATCH_MAX)` — `RECONCILE_BATCH_MAX`(1000)는 `terminal-revoke reconcile` sweep 을 위해 명명된 상수인데 `webchat-idle-reap`(별도 기능, 기본 `WEBCHAT_IDLE_REAP_BATCH_LIMIT=500`) 의 상한으로도 재사용된다. 기능상 문제는 없다(기본값 500 < 1000 이라 클램프가 실질 발동하지 않음)와, 메서드 JSDoc 은 "동일 QueryBuilder 패턴" 재사용만 언급하고 이 상수 재사용 의도는 언급하지 않는다. 이름만 보고 따라가는 향후 리더에게 "reconcile 전용 상수가 왜 여기 쓰이나"라는 사소한 의문을 남긴다.
  - 제안: 클램프 라인에 짧은 인라인 주석("상한은 reconcile sweep 과 공유 — batch 개념이 동형이라 상수 재사용") 추가하거나, 장기적으로 공용 이름(`SWEEP_BATCH_MAX` 등)으로 리네임 고려(비긴급).

## 요약

이번 변경은 문서화 관점에서 전반적으로 모범적이다 — `markWebchatIdleTimeout`·`findIdleWebchatExecutionIds`·`WebchatIdleReaperService`·`webchat-idle-reaper.types.ts` 모두 spec 조항(EIA-RL-07/§R19) 인용과 함께 멱등성·fail-open·soft-terminal 등 설계 의도를 상세히 기술한 JSDoc 을 갖췄고, `CHANGELOG.md`·`.env.example`(`WEBCHAT_IDLE_REAP_GRACE_MS`, 파싱 규칙·기본값 명시)·`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 체크박스가 모두 정확히 갱신됐다. 특히 4개 spec 문서(`14-external-interaction-api.md`, `7-channel-web-chat/1-widget-app.md`, `7-channel-web-chat/3-auth-session.md`, `data-flow/0-overview.md`, `data-flow/15-external-interaction.md`)에 흩어져 있던 "Planned/PR-2 대기" 마커를 빠짐없이 "구현됨"으로 동기화했고 잔존 stale 참조도 grep 상 발견되지 않아 spec-code 정합성이 높다. 유일한 실질적 흠은 `external-interaction.module.ts` 클래스 헤더의 "Wire-up" 목록이 신규 서비스를 반영하지 않은 채 stale 상태로 남은 것(WARNING)이며, 나머지 두 건은 사소한 env 변수 명명·상수 재사용 관련 참고 사항(INFO)이다.

## 위험도

LOW
