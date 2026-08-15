STATUS=success

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드)

## 검토 방법

프롬프트 번들이 대용량 파일(`execution-engine.service.{ts,spec.ts}` 등)의 diff 를 예산 초과로
생략했고, 이번 라운드는 `review/code/2026/08/15/{09_58_24,10_18_38,10_34_51,10_52_08,11_09_44}/`
에 걸쳐 **5차례** 선행 scope 라운드가 이미 동일 changeset 을 상세 검토한 이력이 있다. 5차 라운드가
내린 결론(전체 16개 소스/문서 파일이 "종결 3종에 `durationMs` 를 싣는다"는 단일 의도로 수렴,
LOW)을 그대로 재사용하지 않고, `git`(`fetch origin main`, `diff origin/main --stat`,
`log --oneline`, `show <commit>`)으로 **직접 실측**해 (a) 5차 라운드 이후 새로 추가된 커밋
3개(`a67ec89b7`·`bd611be81`·`2c9b490fd`)가 실제로 선언된 의도(문서 캐비엇 보강·미룬 단언 추가·
JS int4 클램프 CRITICAL 수정)와 정확히 일치하는지, (b) 전체 changeset(122 files, `codebase/`
기준 9 files)에 여전히 무관 파일이 없는지를 재확인했다.

## 발견사항

- **[INFO]** 5차 라운드 이후 신규 커밋 3건 전부 각자 선언한 단일 목적에서 벗어나지 않음 — 실측 확인
  - 위치: 커밋 `a67ec89b7`(`spec/5-system/14-external-interaction-api.md` +6줄, 재진입 레이스
    캐비엇), `bd611be81`(`execution-engine.service.spec.ts` +13줄, 미뤄진 단언 2건),
    `2c9b490fd`(`execution-engine.service.ts` 6줄·`terminal-duration.{ts,spec.ts}`·
    `spec/5-system/14-external-interaction-api.md` 9줄·`spec-sync-external-interaction-api-gaps.md`
    6줄, `PG_INT4_MAX` 공유 상수 도입)
  - 상세: `git show <sha>`로 세 커밋의 코드 diff 를 전문 대조했다. `a67ec89b7`는 커밋 메시지가
    예고한 "이미 아는 반례에 캐비엇 없음" 결함을 spec 문단 한 곳에 정확히 반영했을 뿐이고,
    `bd611be81`는 `driveCallStackResume`/`markExecutionCancelled` emit 값에 대한 `durationMs`
    단언 2건만 추가했다(프로덕션 코드 변경 0줄). `2c9b490fd`는 CRITICAL(JS 경로 int4 미클램프)을
    고치며 SQL 상수(`TERMINAL_DURATION_MS_SQL`)와 JS 상수(`resolveTerminalDurationMs`)가 같은
    `PG_INT4_MAX` export 를 공유하도록 통합했고, JSDoc 오류(W6)·spec 캐비엇 누락(W7) 정정도
    커밋 메시지가 명시한 범위 안에 있다. 세 커밋 모두 durationMs 기능·이전 리뷰 라운드가 지적한
    결함의 직접적 후속 조치이며, 별개 관심사가 섞여 있지 않다.
  - 제안: 없음(조치 불필요, 기록 목적).

- **[INFO]** 전체 changeset 의 비-리뷰 파일 16개가 여전히 단일 의도로 수렴함 — 재실측
  - 위치: `git diff origin/main --name-only | grep -v '^review/'` 결과 16개
    (코드 9 + plan 3 + spec 3 + `CHANGELOG.md` 1)
  - 상세: 코드 9개(`chat-channel.dispatcher.{ts,spec.ts}`, `types.ts`,
    `execution-engine.service.{ts,spec.ts}`, `retry-turn.service.{ts,spec.ts}`,
    `terminal-duration.{ts,spec.ts}` 신규)는 전부 `durationMs` 계산/배관/타입/테스트. plan
    3개(`eia-terminal-payload.md`, `spec-draft-eia-notification-payload-contract.md`,
    `spec-sync-external-interaction-api-gaps.md`)는 같은 작업의 진행/트래커 문서. spec 3개
    (`14-external-interaction-api.md`, `3-workflow-editor/3-execution.md`,
    `conventions/chat-channel-adapter.md`)는 `durationMs` 필드 추가에 따른 이벤트 표·유니온
    타입 갱신(`durationMs`, `durationMs?: number|null` 반영)이다. `CHANGELOG.md` 신규 항목도
    이 PR 의 breaking 변경(payload 필드 추가) 고지다. `codebase/frontend/**` 변경 없음(재확인).
  - 제안: 없음.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` `/v1/` 오탈자 정정 1줄 — 과거
  라운드가 이미 검토·정당화(신규 재론 불필요)
  - 위치: `spec/5-system/14-external-interaction-api.md` §12 (별도 커밋 `cdaa4291d`)
  - 상세: `09_58_24`/`10_52_08` scope 라운드가 이미 "durationMs 와 직접 무관하지만 별도 커밋으로
    격리돼 있고, 구현 착수 직전 의무 `consistency-check --impl-prep`(`08_45_50`
    convention_compliance CRITICAL)이 지적한 항목을 그 자리에서 해소한 것"으로 판정했다.
    이번 라운드에서도 그 판정을 뒤집을 새 근거는 없다.
  - 제안: 없음(강제 사항 아님 — 향후 이런 무관 spec 오탈자 정정은 가능하면 별도 PR 선행 머지 권장).

- **[INFO]** 테스트 mock(`setParameter`/`returning`) 확산은 공유 default mock 구조에서 비롯된
  필연적 파급 — 과거 라운드 실측 결론 유효, 이번 diff 로 재확인
  - 위치: `execution-engine.service.spec.ts` 다수 `createQueryBuilder` mock 리터럴
  - 상세: `09_58_24`/`10_52_08` scope 라운드가 이미 "프로덕션 diff 는 5경로만 `.setParameter`/
    `.returning` 을 추가했는데, 이 파일의 **파일 전역 기본 mock**을 오버라이드하지 않는 무관
    테스트들이 그 default 를 공유하므로 확산이 불가피하다"고 실측 판정했다. 이번 라운드
    diff(`git diff origin/main --stat -- codebase/`)에서도 `execution-engine.service.spec.ts`
    변경폭(120줄)이 프로덕션 diff(152줄)와 비슷한 규모로 남아 있어 그 구조가 그대로 유지됨을
    확인했다.
  - 제안: 없음(이미 기록됨, 장기적으로 공유 default mock 축소는 이 PR 범위 밖 후속 과제).

## 요약

이번(6차) 라운드는 신규 scope 이탈을 만들지 않았다. 5차 라운드(`11_09_44`) 이후 추가된 3개
커밋(`a67ec89b7`·`bd611be81`·`2c9b490fd`)을 `git show` 로 전문 대조한 결과, 각각 문서 캐비엇
보강·미뤄진 단언 추가·CRITICAL(int4 클램프 JS/SQL 쌍둥이 불일치) 수정이라는 선언된 목적을
정확히 벗어나지 않았고 프로덕션 코드 변경도 각 커밋의 diff 범위(6~9줄) 안에 머물렀다. 전체
changeset(코드 9 + plan 3 + spec 3 + CHANGELOG 1, `codebase/frontend/**` 0)은 여전히 "종결
이벤트 3종에 `durationMs` 를 싣는다"는 단일 의도로 수렴한다. 유일하게 기능과 직접 무관한 변경
(spec `/v1/` 오탈자 정정 1줄)은 별도 커밋으로 격리돼 있고 의무 절차(impl-prep consistency-check
CRITICAL 해소)로 정당화된 상태가 유지된다. `review/code/**`·`review/consistency/**` 하위 다수
산출물이 diff 에 포함된 것도 이 저장소의 표준 워크플로(구현 전후 의무 리뷰·consistency-check
산출물 커밋)에 해당하는 기대된 변경이며 scope 이탈이 아니다.

## 위험도

LOW
