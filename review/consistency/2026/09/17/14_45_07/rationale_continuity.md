# Rationale 연속성 검토 — trigger-cascade-window-probe (impl-done, scope=spec/2-navigation/)

## 발견사항

- **[WARNING]** §3 「실측되지 않은 잔여」 캐비앗이 이 diff 로 반증됐는데 spec 텍스트가 갱신되지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API, "동시 쓰기 직렬화" 註 하단
    (`> ⚠️ **실측되지 않은 잔여**: PATCH 의 기본 저장 경로(엔티티 통째 저장)는 ① 재읽기와 저장
    사이의 CASCADE 창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 확인되지 않았다 —
    [트래커] developer 항목 7.`)
  - 과거 결정 출처: 이 캐비앗 자체가 `spec/2-navigation/2-trigger-list.md §3`(commit `217fadecb`
    "트리거 동시성 계약을 소유자에 서술한다")에 있는 미확정 서술이며, 같은 §3 위쪽 문단이
    "PATCH 의 기본 저장 경로 = 엔티티 통째 저장"이라고 현재 구현을 서술한다.
  - 상세: 이번 diff(`codebase/backend/src/modules/triggers/triggers.service.ts` +
    `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 신설)는 캐비앗이 명명한 바로 그
    ①②를 **레이블까지 동일하게**(e2e 파일의 `describe('① 재읽기 뒤 workflow 삭제 (FK CASCADE …)')`
    / `describe('② 재읽기 뒤 락 밖 컬럼 한정 갱신')`) 실측했다. ②는 "이론적 TOCTOU 가 아니라 실결함"으로
    확인됐고(`notification_secret_v2`·`last_triggered_at` 이 옛 값으로 되써짐), 처방으로 저장 경로를
    "엔티티 통째 저장"에서 "이 요청이 바꾸는 필드만 담은 부분 객체 저장"으로 바꿨다. 즉:
    1. §3 캐비앗의 "확인되지 않았다"는 이제 거짓이다(확인 완료).
    2. §3 위쪽 문단의 "PATCH 의 기본 저장 경로(엔티티 통째 저장)"라는 현재-구현 서술도 이 diff
       머지 이후에는 거짓이다(부분 객체 저장으로 교체됨).
    - scope(`spec/2-navigation`) 델타는 0개 파일 — 즉 이 diff 는 spec 을 전혀 갱신하지 않은 채
      코드만 캐비앗을 반증했다.
  - 완화 요인 (이미 정상 프로세스로 추적 중): `plan/in-progress/trigger-save-partial-patch.md`
    가 이 정확한 gap 을 `spec_impact: none` + "이 PR 이 **안** 하는 것 — spec 갱신은 planner 턴"
    으로 명시적으로 defer 했고, `/ai-review` 3라운드 전부(`review/code/2026/09/17/13_44_39` W1 ·
    `14_11_48` INFO#12 · `14_34_56` INFO#1)가 이 SPEC-DRIFT 를 지적했으며 "planner 후속"으로
    합의 처분됐다. `--impl-prep`(`review/consistency/2026/09/17/13_04_39`, BLOCK:NO)도 같은 항목을
    "수용"으로 기록했다. 개발자 자신이 "⚠️ 문장은 planner 턴이 썼다"고 판단해 자기-반증형 소정정
    예외(developer 가 spec 을 직접 고치는 유일한 경우)를 **적용하지 않고** planner 위임을
    선택한 것은 CLAUDE.md §자기-반증형 소정정 조건 1(그 문장을 developer 자신이 썼어야 함)에
    부합하는 보수적 판단으로 보인다 — 그 문장은 `217fadecb`(spec 전용 커밋, planner 성격)에서
    도입됐다.
  - 제안: 이 PR 이 머지된 뒤 `plan/in-progress/trigger-save-partial-patch.md` 가 이미 적어 둔
    planner 후속(① §3 ⚠️ 를 "① 시끄러운 실패로 실측·② 실결함이었고 부분 객체 save 로 수정됨"으로
    교체, ② 신규 e2e 특성 테스트를 `2-trigger-list.md` frontmatter `code:` 에 등재, ③
    `15-chat-channel.md §5.4` 404 행에 CASCADE 창 사유 한 줄)를 지연 없이 실행할 것. 머지~planner
    PR 사이의 창에서 §3 텍스트를 읽는 사람은 이미 고쳐진 결함을 "미확인"으로 오인할 수 있다.

## 요약

이번 diff(트리거 `TriggersService.update()`의 PATCH 저장 경로를 "재읽은 엔티티 통째 저장"에서
"이 요청이 바꾸는 필드만 담은 부분 객체 저장"으로 교체)는 `spec/2-navigation/2-trigger-list.md
§3`의 "동시 쓰기 직렬화" 불변식(트리거 단위 advisory lock 안에서 재읽고 병합해 쓴다, 외부
provider 호출은 락 밖, 락으로 못 막는 CASCADE 삭제 경로는 재읽기 결과의 부재/0행으로 판정)을
위반하지 않고 오히려 강화한다 — 새 e2e 특성 테스트(`trigger-update-save-window.e2e-spec.ts`)가
그 불변식이 요구하는 "락 밖 컬럼 커밋 보존"을 실제 Postgres+TypeORM 으로 처음 실측·고정했다.
`#1334`이 "이론적 TOCTOU"로 유예했던 자리를 실결함으로 재확인하고 수정한 것도 이 저장소의
"유예 근거는 실측해야 한다" 관행과 정합한다. chat-channel 의 R-CC-10/R-CC-21(PATCH 는 botToken 등
비밀을 쓰지 않는다)이나 데이터 모델의 "값을 읽는 컬럼은 응답 경계에서 지운다" 원칙과도 충돌이
없다. 유일한 연속성 문제는 §3 의 "⚠️ 실측되지 않은 잔여" 캐비앗과 "엔티티 통째 저장" 서술이
이 diff 로 사실이 아니게 됐는데도 spec 텍스트(scope 델타 0)가 갱신되지 않은 것인데, 이는 발견되지
않은 채 방치된 것이 아니라 3라운드 코드 리뷰 + impl-prep 컨시스턴시 체크 전부가 이미 지적했고
plan 문서에 "planner 후속" 항목으로 명시적으로 등재·추적되고 있다.

## 위험도

LOW
