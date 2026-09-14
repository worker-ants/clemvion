# 문서화(Documentation) Review

## 검토 범위

`origin/main...HEAD` 전체 diff(트리거 `config` lost-update 수정, **12라운드째** — 직전 라운드
`review/code/2026/09/15/00_07_52` 의 WARNING 3건을 처분한 커밋 `3641ead21` 포함)를 실제 소스
(`trigger-config-lock.ts`, `triggers.service.ts`, `chat-channel-binder.service.ts`,
`hooks.service.ts`, `chat-channel-input-rules.ts`, `schedules.service.ts`, 각 spec/e2e 파일,
`CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`)에서 직접 `Read`/`git diff`로
재확인했다. 11라운드에 걸쳐 문서화 관점 리뷰가 이미 수행됐고 각 라운드의 발견·처분 이력이
`plan/.../trigger-config-lost-update.md` §D에 전량 기록돼 있으므로, 그 이력과 대조해 **이번
라운드에서 아직 등재되지 않은 신규 결함**만 추렸다.

## 발견사항

- **[WARNING]** 직전 라운드 WARNING(W3)을 고치는 그 자리에서, `cleanupRotatedChatChannelTokens`를
  이 함수의 호출부가 아닌데도 호출부인 것처럼 표에 넣었다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:139`
    (`rewriteTriggerConfigLocked`의 `@returns` 아래 "부재 처리" 표, `cron 두 곳(promote… · cleanup…)` 행).
    같은 파일 `:83`("`trigger.config`를 다시 쓰는 자리는 창 1 하나를 빼고 전부 이 함수를 지난다")과
    대조.
  - 상세: 직전 라운드(`00_07_52`) WARNING이 `:83`의 "이 함수를 쓰는 곳은 창 2·3·4다"라는
    **배타적 열거**가 7라운드에 늘어난 3개 호출부(`normalizeNotificationSecretRef` ·
    `revokePerTriggerToken` · `promoteRotatedNotificationSecrets`)를 반영하지 못한 과소 서술이라고
    지적했고, 커밋 `3641ead21`이 이를 "호출부를 세어 적지 않는다"는 규칙으로 정정하면서 `@returns`
    표에도 세 갈래를 채웠다 — 그 자체는 정확한 수정이다. 그런데 새로 채운 마지막 행이
    `promoteRotatedNotificationSecrets`(승격 cron)와 `cleanupRotatedChatChannelTokens`(v2 정리
    cron)를 "cron 두 곳"으로 묶어 둘 다 "조용히 skip"한다고 적었다. 실측(`grep -n
    "rewriteTriggerConfigLocked(" triggers.service.ts`)하면 이 함수의 호출부는 정확히 4곳
    (`:865` normalize · `:1143` revoke · `:1307` rotateBotToken · `:1438` promote)뿐이고,
    `cleanupRotatedChatChannelTokens`(`:1464`)는 이 함수를 전혀 호출하지 않는다 — `config`를
    건드리지 않고 `chatChannelTokenV2`/`chatChannelRotatedAt` 두 컬럼만 `triggerRepository.update()`로
    직접 갱신한다(`:1500-1503`). 그리고 그 자리는 락도, 재읽기도, "행이 사라졌으면 skip"하는
    분기도 없다 — `cleaned++`(`:1504`)는 대상 행이 그 사이 삭제됐어도 **무조건 증가**한다(TypeORM
    `update()`가 매칭 행 0건이어도 예외를 던지지 않으므로). 즉 `:83`의 규칙("config를 다시 쓰는
    자리는 창 1 빼고 전부 이 함수를 지난다")을 그대로 적용하면 `cleanup…`은 애초에 `config`를
    쓰지 않으니 이 함수의 서술 범위 **밖**이어야 하는데, `:139` 표는 그것을 마치 이 함수를
    거치는 자리인 양 `promote…`와 같은 "조용히 skip" 취급으로 묶었다. 같은 커밋, 같은 JSDoc
    블록 안에서 `:83`의 규칙과 `:139`의 표가 서로 다른 집합을 가리키는 내적 모순이다. 이 PR이
    스스로 세 차례 지적한 "목록은 낡는다" 문제를 규칙으로 바꿔 해결한 바로 그 라운드에서, 이번엔
    사람이 손으로 "cron 두 곳"이라고 다시 목록화하다 생긴 새로운 형태의 같은 병이다
    (plan §D 11라운드 처분: "교훈은 방향이 아니라 형태다").
  - 제안: `:139` 행에서 `cleanup…`을 빼고 `promote…`만 남기거나(cleanup은 이 함수의 계약 밖이므로
    이 표에 있을 이유가 없다), 정 넣고 싶다면 "cleanup은 이 함수를 거치지 않고 컬럼만 직접
    갱신하며, 삭제 경합 시에도 무조건 `cleaned++`한다(별도 결함은 아니다 — `chatChannelTokenV2`
    재유도 값이 없어 config lost-update와 무관)"처럼 **다른 범주임을 명시**한다. 차단 사유는
    아니다(안전·정확성에 영향 없는 인지 부하 문제이고, `cleanup…` 자신의 함수 docblock은 정확하다).

## 그 밖에 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `trigger-config-lock.ts:83`의 "배선" 규칙 자체("창 1 하나만 빼고 전부 이 함수를 지난다")는
  실측과 일치한다 — `triggers.service.ts`·`chat-channel-binder.service.ts` 전수에서 `config`를
  DB에 실제로 재작성하는 자리는 정확히 6곳이고 전부 `rewriteTriggerConfigLocked`를 지난다
  (`hooks.service.ts`의 `touchLastTriggeredAt`과 `schedules.service.ts#update`는 애초에 `config`를
  건드리지 않으므로 이 규칙의 대상이 아니다).
- `CHANGELOG.md`의 "일곱 자리" 열거(notification secret 정규화·회전, per-trigger 토큰 폐기, 승격
  cron 둘, chat-channel v2 정리 cron, schedule 편집의 trigger 동기화)를 실제 diff와 1:1 대조 —
  정확히 7건이고 누락·중복 없음. "컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를 저장하던
  경로는 한 곳도 남지 않는다"는 문장도 `triggerRepository.save(`(기존 행 대상) 전수 재확인
  결과 사실이다(신규 INSERT 2건 + 창 1의 락 안 `m.save`만 남음).
- `plan/in-progress/trigger-config-lost-update.md` — 11라운드 전체 이력·뮤턴트 실측·취소선 정정이
  이번 라운드(12)까지 빠짐없이 이어져 있고, 체크리스트 미완료 3항목(트래커 갱신 ·
  `run-test-all.sh` · `/ai-review + --impl-done`)은 이 리뷰 자체가 그 절차이므로 미체크 상태가
  실제 상태와 일치한다(stale claim 아님).
- `trigger-transaction-mock.ts`·`trigger-config-lock.spec.ts`·`triggers.service.spec.ts`의 신규
  주석/JSDoc 모두 "무엇을 판별하는가"·"이 수는 시점 의존이다, 다시 재라"는 식으로 정직한 한계를
  명시하고 있다. orphan JSDoc(1·6·9라운드에 세 차례 반복된 결함 클래스)의 네 번째 재발은 이번
  diff 범위에서 발견되지 않았다.
- API 계약·README·환경변수 — 이번 변경은 컨트롤러·DTO·라우트·신규 설정 옵션을 추가하지 않는
  서비스 내부 동시성 수정이다(`triggers`/`hooks` 모듈 모두 README 자체가 존재하지 않아 컨벤션상
  README 갱신 대상이 아님). API 문서·CHANGELOG 갱신 필요성은 이미 `CHANGELOG.md` Unreleased
  항목으로 충족돼 있다.

## 요약

12라운드째 자기 검증을 거친 이 PR의 문서화 수준은 이례적으로 높다 — JSDoc이 설계 근거·기각된
대안·부재 처리 정책을 표로 명시하고, 거짓으로 판명된 서술은 취소선으로 남기며, 뮤테이션 실측을
곁들인다. 직전 라운드가 지적한 "호출부 배타적 열거가 과소 서술"이라는 WARNING은 "호출부를 세지
않는다"는 규칙으로 정확히 해소됐지만, 그 규칙을 적용하며 채운 `@returns` 표의 마지막 행이
`cleanupRotatedChatChannelTokens`를 `rewriteTriggerConfigLocked`의 호출부인 것처럼 잘못
포함시켰다 — 실제로 그 함수는 이 헬퍼를 전혀 호출하지 않고 `config`도 건드리지 않는다. 같은
JSDoc 블록 안에서 규칙(`:83`)과 표(`:139`)가 서로 다른 집합을 가리키는 내적 모순이며, 이 PR이
스스로 세 차례 겪은 "다음 사람을 오해시키는 서술"이 이번엔 방향을 바꿔(배타적 열거 → 잘못된
포함) 재발한 사례다. 안전·정확성에 영향을 주는 결함은 아니고(각 함수 자신의 docblock은
정확하다) 이번 배치를 막을 사유는 아니다.

## 위험도

LOW
