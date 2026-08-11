# 유지보수성(Maintainability) 리뷰 — 확인 라운드 (커밋 `3db28b205` 단독)

## 스코프 확정

`git log`로 확인한 결과 직전 라운드(`12_56_06`) 이후의 실제 코드 delta는 커밋 `3db28b205`
(`test(audit): 자매를 한 it() 에 담은 구조를 분리 — 진단만 쓰고 형태는 안 바꿨었다`) 하나이며,
`git show --stat` 기준 프로덕션 코드 변경은 0 이고 실질 코드 변경은
`codebase/backend/src/modules/triggers/triggers.service.spec.ts` (+16/-2, 18줄) +
`plan/in-progress/spec-sync-auth-gaps.md` (+7줄, 등재) 뿐이다. 나머지는 `review/code/**` 산출물.

이 라운드는 직전 라운드 유일한 WARNING(자매 두 메서드 검증을 한 `it()`에 담아 앞이 뒤를 가림)의
처분을 확인하는 용도로, 지시받은 세 항목을 순서대로 검증했다. **새 CRITICAL 없음.**

## 확인 1 — 분리가 지적을 실제로 해소하는가 / 셋업 중복이 적정한가

`git show 3db28b205 -- .../triggers.service.spec.ts` 로 실제 diff를 직접 확인했다.

- `it('저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라 save 가 던진다)', …)` 하나였던
  것이 `it('rotateNotificationSecret — 저장이 실패하면 감사를 남기지 않는다', …)` /
  `it('revokePerTriggerToken — 저장이 실패하면 감사를 남기지 않는다', …)` 두 개로 갈렸다
  (`codebase/backend/src/modules/triggers/triggers.service.spec.ts:2440`, `:2456`).
- 판별력이 실제로 복원됐다: 커밋 메시지에 남긴 뮤턴트 A(notification 만 반전)/B(interaction 만
  반전) 결과가 서로 정확히 반대 짝(RED/GREEN ↔ GREEN/RED)이라 "어느 자매가 깨졌는지"를 실패한
  `it()` 이름이 그대로 알려준다. 분리 전에는 첫 절반이 깨지면 두 번째 절반이 실행조차 안 돼
  이 구분이 안 됐다는 지적이 정확히 해소됐다.
- 셋업 중복은 적정하다. 실제로 중복되는 것은 `(triggerRepo.save as jest.Mock).mockRejectedValue(new
  Error('db down'));` 한 줄뿐이고, `findOne` mock 은 두 테스트가 서로 다른 `config`
  (`notification` vs `interaction`)를 요구하므로 진짜 중복이 아니라 각자 다른 도메인 입력이다.
  자매를 하나의 `it()`로 묶어 얻는 이득(셋업 몇 줄 절약)보다 분리로 얻는 진단 정밀도가 크다는
  판단이 맞다 — 이 파일의 다른 자매 쌍(`create`/`update` 저장 실패 테스트 등)도 이미 같은 형태로
  각자 별도 `it()`다.

## 확인 2 — 직전 INFO 2건(주석 비대화 / 자기 이력 서술 비일관)의 등재 여부

`plan/in-progress/spec-sync-auth-gaps.md:83-89` 에 실재한다.

```
- [ ] **`audit-action.const.ts` 주석 비대화** (2026-08-11, ai-review `12_56_06`
      maintainability INFO ×2). 141줄 중 60%+ 가 주석이고 회전 3종 도입으로 또 늘었다.
      서술형 논거는 이미 `spec/conventions/audit-actions.md §3` 이 SoT 이므로, 코드에는
      짧은 포인터만 남기는 편이 스케일한다. 함께: 주석의 **자기 이력 서술**이 비일관하다
      (첫 사실 오류는 각주로 남겼는데 두 번째 정정은 무각주). 소스 주석은 "지금 맞는
      사실" 만 진술하고 정정 이력은 git/CHANGELOG/plan 에 맡기는 쪽으로 정리한다.
      **다음에 이 파일을 확장할 때** 함께 처리 — 지금 단독으로 건드릴 이유는 없다.
```

두 지적 모두 정확히 담겼다 — ① 파일 대비 주석 비중 60%+ 및 spec Rationale 이 이미 SoT 이니
코드는 짧은 포인터로 남기라는 제안, ② "첫 오류는 각주화·두 번째 정정은 무각주"라는 비일관 사례가
그대로 재진술됐다. 처리 시점("다음에 이 파일을 확장할 때")도 내가 낸 제안과 일치한다. **재지적하지
않는다.**

## 확인 3 — 분리된 두 테스트의 docstring 이 주석 비대화 경향을 답습하는가

이번 delta가 실제로 추가한 주석은 두 군데뿐이다(diff로 직접 확인):

- 공유 docstring에 5줄 추가(`:2432-2436`) — "자매를 각각 자기 `it()`로 세운다"는 분리 근거와,
  이 PR에서 세 번째로 반복된 형태라는 진단, `ai-review 12_56_06` 인용.
- 각 `it()` 안에 인라인 2줄(`:2444-2445`) — `findOne` mock의 `config` 가 검증 예외를 유발하는
  위 테스트의 `config: {}` 와 달라야 하는 이유.

나머지 docstring(`:2406-2427`, "실패하면 남기지 않는다"/"위 테스트만으로는 부족하다" 두 문단)은
직전 라운드(`f5d485a52`)에서 이미 존재했고 이번 delta가 아니다. 순수 증분은 ~7줄로 작고, 내용도
"무엇"이 아니라 "왜 이 구조·이 config 값인가"를 설명하는 실질적 정보라 `audit-action.const.ts`가
보인 문제(서술형 논거가 이미 spec에 있는 SoT를 코드에 중복 보관)와는 성격이 다르다. **과잉으로
보지 않는다.**

다만 결이 같은 요소 하나는 확인해 둔다: `ai-review 12_56_06 maintainability WARNING · testing
INFO` 처럼 리뷰 라운드 ID를 코드 주석에 직접 인용하는 관행이다. 이는 INFO 2가 짚은 "review round
ID는 `review/code/**`가 정리·아카이브되면 죽은 포인터가 된다"는 리스크와 같은 종류이지만 — (a) 이
파일에는 이미 직전 라운드(`f5d485a52`)가 `ai-review 12_37_14` 를 인용해 놓았고(`:2426`), 그
직후 라운드(`12_37_14/maintainability.md`)가 이 정확한 docstring 을 검토해 "이 파일이 이미
확립한 관례를 그대로 따른다"며 CRITICAL 없음으로 통과시킨 이력이 있어 새로 발견된 패턴이 아니고,
(b) 등재된 INFO 2는 명시적으로 `audit-action.const.ts` 대상이었지 이 테스트 파일을 겨냥한 것이
아니었다. 새 등재 항목으로 만들 만큼의 무게는 아니라고 판단해 formal finding으로 올리지 않는다
— 참고로만 남긴다.

## 발견사항

새 CRITICAL 없음. 새 WARNING 없음. 새로 등재할 INFO도 없음 — 직전 라운드가 등재한 2건은 정확한
문구로 이미 반영돼 있어 재지적하지 않는다.

## 요약

이번 라운드(커밋 `3db28b205`)는 직전 라운드의 유일한 WARNING을 실제로 해소했다. 자매 두 메서드의
저장 실패 검증이 각자 독립된 `it()`로 갈려 뮤턴트-실패테스트 1:1 대응이 복원됐고, 셋업 중복은
`save` mock reject 한 줄뿐으로 과하지 않다 — 나머지는 도메인상 서로 다른 `config` 값이라 진짜
중복이 아니다. 직전 라운드가 낸 INFO 2건(주석 비대화, 자기 이력 서술 비일관)은
`plan/in-progress/spec-sync-auth-gaps.md:83-89`에 문구까지 정확히 등재돼 있어 재지적하지
않는다. 새로 추가된 docstring 증분(~7줄)은 "왜 이 구조인가"를 설명하는 실질적 내용으로, 분량도
작고 성격도 `audit-action.const.ts`의 서술형 논거 중복과 달라 주석 비대화 경향을 답습한다고
보지 않는다. 발견의 성격이 동작(라운드1 CRITICAL) → 커버리지(라운드2) → 구조/진단정밀도(라운드3)
→ **확인(라운드4, 이번)**으로 얕아지는 궤적이 이 라운드에서도 이어져 수렴 신호로 읽힌다.

## 위험도

NONE
