# 변경 범위(Scope) 리뷰 — CCH-SE-02 update dedup

## 발견사항

- **[WARNING]** `spec/` 파일 직접 수정 — 프로젝트 규약상 `developer` 롤은 `spec/` read-only 이고, "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이 명시 규약이다. 본 diff 는 `codebase/**`(서비스 구현) + `plan/**`(자기 작업 plan 갱신) 뿐 아니라 `spec/5-system/15-chat-channel.md` 의 CCH-SE-02 요구사항 서술 자체를 다시 썼다.
  - 위치: `spec/5-system/15-chat-channel.md:88` (표 행 `CCH-SE-02` — "EIA `Idempotency-Key` 를 어댑터가 자동 발급" → "`ChatChannelDedupService`, Redis `SET NX EX 30`, 키 `cc:dedup:<triggerId>:<updateId>`" 로 재작성)
  - 상세: 내용 자체는 구현과 정합하고(옛 문구가 "HTTP 인터셉터가 막아준다"처럼 읽혀 실제로는 in-process 경로에 적용 안 되는 오류였음을 바로잡음) `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 노트에도 "spec 문면도 고쳤다"고 명시돼 있어 의도된 변경으로 보인다. 다만 CLAUDE.md 의 역할 표(`developer: codebase/**, plan/**, review/**/RESOLUTION.md` 쓰기 권한, `spec/` read-only)를 문자 그대로 적용하면 이 커밋은 그 경계를 벗어난다. 이 변경분이 개발자 세션에서 직접 나온 것이라면 절차 위반이고, 별도 project-planner 턴에서 나온 것이라면 문제 없다 — diff 만으로는 어느 쪽인지 판별 불가.
  - 제안: 이 spec 수정이 project-planner 롤(또는 `consistency-check --spec` 사전 실행)을 거쳤는지 확인. 아니라면 스펙 문구 정정은 별도 project-planner 턴으로 분리하거나, 최소한 스펙 변경 사유를 커밋/PR 설명에 명시해 감사 추적을 남길 것.

- **[INFO]** 나머지 6개 파일은 "CCH-SE-02 update dedup 미배선(dead field)" 이라는 명시된 작업 범위와 1:1로 대응한다 — 신규 서비스(`chat-channel-dedup.service.ts`)·단위 테스트·DI 등록(`chat-channel.module.ts`)·호출부 배선 및 호출부 테스트(`hooks.service.ts`/`hooks.service.spec.ts`)·자기 plan 체크박스 갱신. drive-by 리팩토링, 불필요한 포맷팅, 무관한 import 정리, 기능 확장(over-engineering) 징후는 발견되지 않음.
  - 참고: `chat-channel-dedup.service.ts` 의 `@Optional() @Inject('CHAT_CHANNEL_DEDUP_REDIS')` + `RedisConnectionProvider` fallback 패턴은 같은 디렉터리의 `chat-channel-rate-limiter.service.ts`/`channel-conversation.service.ts` 와 동일한 기존 컨벤션을 그대로 재사용한 것으로 확인(grep 대조) — 새 패턴 도입이 아니라 기존 관례를 따른 것이므로 scope creep 아님.
  - `CHAT_DEDUP_WINDOW_SEC = 30` 은 spec CCH-SE-02 의 "30초" 요구사항 값과 일치하며 별도 설정 옵션(configurable window 등)을 추가하지 않아 요청 이상의 기능 확장도 없음.
  - `hooks.service.ts` 에 삽입된 dedup 체크 블록은 rate-limit 앞에 배치되고 주석으로 그 이유를 설명하는데, 이는 기존 파일의 다른 단계 주석들과 밀도·스타일이 일치하며 불필요한 주석 추가로 보기 어려움.

- **[INFO]** `git diff --stat` 로 실제 변경 파일 집합(7개)과 프롬프트에 제시된 파일 목록이 정확히 일치함을 확인 — 프롬프트 밖에 숨은 추가 변경 없음.

## 요약

핵심 diff(서비스 신설·DI 배선·호출부 통합·테스트·plan 갱신 6개 파일)는 "CCH-SE-02 update dedup 배선" 이라는 단일 목적에 빈틈없이 수렴하며, 불필요한 리팩토링·포맷팅 잡음·기능 확장·무관한 파일 수정은 관찰되지 않았다. 유일한 스코프 우려는 `spec/5-system/15-chat-channel.md` 직접 수정으로, 내용은 구현과 정합하지만 이 저장소의 명시 규약(`developer` 는 `spec/` read-only, spec 변경은 project-planner 위임)과 충돌할 가능성이 있어 절차 확인이 필요하다.

## 위험도

MEDIUM
