# Rationale 연속성 검토

## 검토 개요

target 은 `spec/2-navigation/` 자체를 변경하지 않는 코드 전용 diff(9 파일 / 217줄)이며, 실질 변경은
`codebase/backend/src/modules/triggers/*` · `secret-store/secret-resolver.service.ts` 의 **주석·메서드 이름 정정**뿐이다
(동작 변경 없음 — `plan/in-progress/trigger-release-stale-comments.md` 명시). 이 diff 가 인용하는 두 결정—
`spec/2-navigation/2-trigger-list.md` §4.3 "트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다"(2026-09-17 결정)
와 `spec/conventions/secret-store.md` §6/§R4(2026-09-17 정정, 네 삭제 경로 중 한 곳만 정리하던 결함의 시정)—를
직접 Read 로 대조했다.

## 발견사항

발견 없음. 아래는 주요 대조 근거다(모두 정합 확인, 문제 아님).

- **secret-resolver.service.ts JSDoc** ("프로덕션 직접 호출부는 `trigger-resource-release.ts` 의
  `deleteTriggerSecretsAfterCommit` 한 곳") — `git grep`으로 `.deleteByPrefix(` 실 호출부가 해당 파일
  한 곳(101행)뿐임을 확인. `secret-store.md` §2.1 행 "트리거 행이 없어질 때 (트리거·스케줄·워크플로·워크스페이스
  삭제) ... 행 삭제가 커밋된 뒤에 한다"와 §6 "워크스페이스 삭제도 트리거 단위 prefix 로 정리한다"에 부합. 주석이
  "워크스페이스 단위 접두는 없다"고 명시한 것도 §6 원문과 문장 단위로 일치 — 새 Rationale 도입이 아니라 기존
  §R4/§6(2026-09-17 정정)을 재서술한 것.
- **trigger-config-lock.ts JSDoc 재작성** ("소비자와 그 정리 목록을 여기 적지 않는다 — 규칙만 적는다") —
  과거 두 차례(`review/code/2026/09/15/01_42_04` INFO#17, 이번 실측)에 "소비자 목록을 나열"하는 패턴이 소비자가
  늘 때마다 stale 해졌다는 동일 결함이 반복됐음을 diff 자신이 이력으로 밝히고 있고, 이번 수정은 그 반복을 멈추는
  방향(목록 대신 spec §4.3 참조)이라 이전 결정을 무근거로 뒤집는 것이 아니라 **드러난 실패 패턴에 대한 원칙 강화**다.
  `acquireTriggerConfigLock`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 실사용처를 grep 하여 plan 이 주장하는 "소비자 셋
  (트리거·스케줄·부모 삭제)" 구성도 실측 일치를 확인했다.
- **`teardownChannelConfig` → `teardownRegisteredChannel` 이름 변경** — `spec/5-system/15-chat-channel.md`
  는 CCH-AD-03 에서 provider adapter 인터페이스 메서드 `teardownChannel()`만 언급하고, 내부 서비스 메서드
  이름(`teardownChannelConfig`/`teardownRegisteredChannel`)은 spec 어디에도 인용되지 않는다 — 구현 세부 리네이밍이며
  Rationale 이 고정한 계약을 건드리지 않는다.
- **SUMMARY#24 bare 인용 해소** — 새로 붙인 인용 `review/code/2026/05/22/11_24_03` #24 는 `git log --all`로
  실재 확인됨(해당 리뷰 산출물을 만든 커밋 `ad0ea7cdb`가 이력에 있고, 이후 아카이브 정리 커밋 `f7c56bf0a`로
  디렉토리 자체는 삭제됨 — "워킹트리에선 정리됐고 이력에 있다"는 diff 자신의 서술과 일치). 지어낸 이력이 아니다.
- **triggers.service.ts / triggers.service.spec.ts / trigger-workflow-ref.e2e-spec.ts 주석 갱신** — "네 삭제
  경로가 비밀을 행 삭제 커밋 뒤에 지운다"는 서술로 통일됐고, 모두 트리거 목록 §4.3(외부 해제는 행 삭제 전·비밀은
  커밋 뒤)과 문장 순서·시점까지 일치. 과거 "`remove()` 하나가 teardown·secret 삭제·BullMQ 해제를 모두 마쳤다"는
  구 서술(이미 §4.3/#1346 구현으로 폐기된 전제)을 되살리지 않고 오히려 지운 방향이라 결정 번복이 아니라 잔존
  구 서술의 정리다.

plan 자체가 `/ai-review` 라운드(`review/code/2026/09/18/11_42_35`, Critical 0 · Warning 0)에서 "호출부 수를
안전 근거로 다시 적는 패턴"(INFO 2·8)을 인지하고도 이번 PR 범위 밖으로 명시적으로 유예·트래커 등재했다 — 이는
새로운 미결정 사안이 아니라 이미 식별·기록된 부채이므로 본 검토에서 별도 항목으로 올리지 않는다.

## 요약

이 변경은 spec 을 건드리지 않는 주석·메서드명 정정이며, 인용하는 두 결정(트리거 목록 §4.3의 "네 경로 정리" 2026-09-17
결정, secret-store.md §6/§R4의 동일 날짜 정정)을 정확히 재서술할 뿐 새로운 설계 결정을 내리지 않는다. 과거 기각된
대안을 되살리는 곳, 합의 원칙(단일 호출부·행 삭제 후 비밀 삭제·워크스페이스 단위 접두 미보유)을 벗어나는 곳,
무근거로 뒤집힌 결정은 발견되지 않았다. 오히려 두 차례 반복된 "소비자 목록 나열" 실패 패턴을 원칙(규칙만 적고
소비자는 SoT 인 spec 을 참조)으로 교정하는 방향이라 Rationale 연속성 관점에서 긍정적인 변경이다.

## 위험도

NONE
