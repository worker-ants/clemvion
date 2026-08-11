# 변경 범위(Scope) 리뷰 — `13_04_55` (신규 델타: 커밋 `3db28b205` 단독)

## 조사 방법

`git show 3db28b205 --stat` 와 `git show 3db28b205 -- codebase/ plan/ spec/` 로 이번 라운드의
실제 델타만 직접 확인했다(프롬프트에 첨부된 unified diff 는 누적 `origin/main..HEAD` 전체 —
`f5d485a52` 이전 커밋들에서 이미 NONE 판정을 받은 구간까지 포함하므로 이번 커밋 단독 델타와는
다르다). 이어서 RESOLUTION 이 주장한 두 뮤테이션(A: notification 만 RED, B: interaction 만 RED)을
저장소 안에서 직접 심어 재현했다. 직전 라운드(`12_56_06`)는 NONE + "머지 가능" 이었고, 그
WARNING(자매 두 단언을 한 `it()` 에 담아 판별력이 흐려진다)에 대한 처분이 바로 이 커밋이다.

## `3db28b205` 실제 델타 (직접 확인)

```
codebase/backend/.../triggers.service.spec.ts       | 18 +-   (테스트 1건 → 2건 분리)
plan/in-progress/spec-sync-auth-gaps.md              |  7 +   (체크리스트 1항목 등재, INFO 2건 결합)
review/code/2026/08/11/12_56_06/{RESOLUTION,SUMMARY,
  _retry_state.json,documentation,maintainability,
  meta.json,requirement,scope,security,
  side_effect,testing}.md/.json                       | 11 files (직전 라운드 리뷰 산출물 자체)
```
13 files changed, 1287 insertions(+), 2 deletions(-) — insertion 대부분(1287줄 중 1220줄+)은
`review/code/12_56_06/**` 산출물이고, 실질 코드/문서 변경은 `triggers.service.spec.ts` 18줄 +
`spec-sync-auth-gaps.md` 7줄뿐이다. `triggers.service.ts`(production)·`triggers.controller.ts`·
`triggers.controller.spec.ts`·`CHANGELOG.md`·`audit-action.const.ts` 는 이번 커밋에서 **전혀
건드리지 않았다** — "production 코드 변경 0" 주장은 diffstat 으로 정확히 확인된다.

## 확인 1 — "테스트 하나를 둘로 분리, 그 외 없음" 주장 검증

`git show 3db28b205` 로 old/new 텍스트를 줄 단위로 대조했다.

- **어서션 개수·내용 불변**: 원래 하나의 `it()` 안에 있던 2세트(`rejects.toThrow('db down')` +
  `expect(auditLogs.record).not.toHaveBeenCalled()`, notification 용/interaction 용 각 1세트)가
  그대로 2개의 `it()` 로 재배치됐을 뿐, 어서션이 추가되거나 삭제되지 않았다.
- **`save` mock 설정 중복**: 분리 전엔 `triggerRepo.save.mockRejectedValue` 를 한 번만 쓰고
  두 섹션이 공유했는데, 분리 후엔 각 `it()` 에 한 번씩 — 이는 `it()` 분리가 강제하는 필연적
  중복이지 새 로직이 아니다(각 테스트가 독립 실행되려면 자기 몫의 mock 설정이 필요하다).
- **주석 1줄 추가**: `notification` 케이스의 `config` mock 위에 "validation 을 통과해야
  `save()` 까지 간다 — 여기서 걸리면 검증 예외를 보는 위 테스트와 같아져 이 테스트의 존재
  이유가 사라진다"는 인라인 주석이 새로 붙었다. 분리된 그 테스트를 설명하는 국소 주석이라
  범위 이탈로 보지 않는다.
- **테스트 이름 변경**: `'저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라 save
  가 던진다)'` 하나가 `'rotateNotificationSecret — 저장이 실패하면 감사를 남기지 않는다'` /
  `'revokePerTriggerToken — 저장이 실패하면 감사를 남기지 않는다'` 둘로 갈렸다 — 분리의
  당연한 귀결.
- **docstring 확장**: 위 `describe` 블록 docstring 에 "자매를 각각 자기 `it()` 로 세운다" 단락이
  추가돼 분리 이유(ai-review `12_56_06` 인용 포함)를 설명한다 — 새 로직이 아니라 분리 자체에
  대한 근거 서술.

**결론: 주장 그대로다.** 분리 외에 어서션 로직 변경·삭제·은닉된 동작 변경은 없다.

## 확인 2 — RESOLUTION 이 주장한 뮤테이션 결과 직접 재현

원본 `triggers.service.ts` 를 `cp` 로 백업한 뒤, `rotateNotificationSecret`/`revokePerTriggerToken`
각각에서 `await this.triggerRepository.save(trigger);` 와 `await this.recordAudit({...});` 순서를
단독으로(한쪽만) 반전시켜 두 뮤턴트를 별도로 심었다. 각 뮤턴트마다 `npx tsc --noEmit` 로
컴파일 유효성을 먼저 확인한 뒤(둘 다 `triggers.service.ts` 관련 타입 에러 0건 — 유효한
뮤턴트), 분리된 두 `it()` 를 각각 `-t` 로 좁혀 실행했다.

| 뮤턴트 | 주장 | 재현 결과 |
|---|---|---|
| A — `rotateNotificationSecret` 만 반전 | notification **RED** · interaction GREEN | **확인** — `rotateNotificationSecret — 저장이…` 만 FAIL(`:2453`, `trigger.notification_secret_rotated` 1회 호출 감지), `revokePerTriggerToken — 저장이…` 는 단독 실행 시 PASS |
| B — `revokePerTriggerToken` 만 반전 | interaction **RED** · notification GREEN | **확인** — `revokePerTriggerToken — 저장이…` 만 FAIL(`:2467`, `trigger.interaction_token_revoked` 1회 호출 감지), `rotateNotificationSecret — 저장이…` 는 단독 실행 시 PASS |

두 뮤턴트 모두 작업 종료 후 `cp` 로 원복, `git status`/`git diff --stat` 로 잔여 0 확인했다
(중간에 이 세션의 write-scope 격리가 `codebase/` 변경을 자동 복원하는 것을 관찰했다 — 뮤턴트
적용과 `jest` 실행을 같은 Bash 호출 안에 묶어 관측 타이밍을 확보했다).

**결론: RESOLUTION 의 뮤테이션 결과 주장(A→notification 만 RED, B→interaction 만 RED)은
정확히 재현된다.** 분리가 "뮤턴트와 실패 테스트가 1:1 대응한다"는 목적을 실제로 달성했다.

## 확인 3 — plan 등재 2건 실재 확인

`plan/in-progress/spec-sync-auth-gaps.md` 에 새 체크리스트 항목 1개(diff 7줄 추가, 삭제 0)가
등재됐다. 항목은 "`audit-action.const.ts` 주석 비대화" 를 표제로 하되 본문에서 **두 가지**를
함께 지적한다 — (1) 141줄 중 60%+ 가 주석인 비대화, (2) 주석의 자기 이력 서술 비일관(첫
정정은 각주로 남기고 두 번째는 무각주). RESOLUTION 이 말한 "등재 2건"은 별도 두 bullet 이
아니라 **한 bullet 안에 결합된 두 발견**을 가리키며, 실제 커밋 diff 와 정확히 일치한다 —
불일치 아님.

## 그 외 범위 관점 점검

- **불필요한 리팩토링**: 없음 — 테스트 파일 안에서도 분리 목적 밖의 구조 변경(다른 `it()` 재정렬,
  다른 케이스 손질)은 없다.
- **기능 확장**: 없음 — production 코드 무변경.
- **무관한 파일**: 없음 — `review/code/2026/08/11/12_56_06/*` 는 직전 라운드가 이미 생성해
  워크트리에 존재하던 산출물이고(이번 커밋에서 새로 작성된 게 아니라 뒤늦게 커밋된 것), 이는
  `12_56_06/scope.md` 가 같은 패턴(`12_22_23/*`)을 이미 검토해 범위 위반이 아니라고 판정한
  전례와 동일한 구조다. `git log --oneline -- review/code/2026/08/11/12_56_06/` 이 `3db28b205`
  하나뿐임을 확인해 뒷받침한다.
- **포맷팅/주석/임포트/설정**: 분리로 인한 필연적 공백 재배치 외 잡음 없음. import 변경 없음.
  설정 파일 변경 없음.

## 머지 가능 여부

**머지 가능.** 델타는 주장대로 정확히 (a) 테스트 1건→2건 분리, (b) plan 등재 1 bullet(2 findings
결합), (c) 직전 라운드 리뷰 산출물의 사후 커밋으로 구성되고, production 코드는 이번에도
무변경이다. RESOLUTION 이 주장한 두 뮤테이션 결과는 저장소 안에서 독립적으로 재현해 정확히
일치함을 확인했다.

## 수렴 판정

**이 지점이 종착점으로 보인다.** 발견의 성격 궤적을 보면 라운드1(CRITICAL: 회귀 자체 부재) →
라운드2(자매 테스트 커버리지 갭·근거 문장 오류) → 라운드3(구조/진단정밀도: 단언이 한 `it()` 에
몰려 판별력이 흐려짐) → 이번 라운드(그 구조 수정이 실제로 판별력을 회복했는지 확인)로,
매 라운드가 더 얕은 층위로 이동했고 이번 라운드는 순수 검증 성격이다. 검증 결과는 세 항목
모두 주장과 정확히 일치했고, 델타 자체가 18줄+7줄의 순수 기계적 분리·등재라 새로운 범위
이탈이 낄 표면이 거의 없다. 남은 미해결 항목(`rotateBotToken` 5→6 구간 뮤테이션 잔존 갭,
`audit_log` 적재 실패 무관측, 주석 비대화)은 전부 이유가 명시된 채 `plan/` 에 등재돼 있고
이 PR 의 범위 밖으로 처분됐다 — 재론할 근거가 없다. 라운드를 더 돈다면 새 정보가 아니라
이미 세 번 확인된 것의 재확인만 낳을 가능성이 높다. **다음 라운드 없이 지금 머지를 권한다.**

## 위험도

NONE

STATUS: OK
