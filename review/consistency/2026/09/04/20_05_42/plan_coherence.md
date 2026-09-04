# Plan 정합성 검토 — target: `spec/2-navigation/`

## 검토 범위 요약

- `spec/2-navigation/**` 은 이번 diff 로 **변경되지 않았다** (delta 0, 정상 — 이번 PR 은 코드 전용).
- 실제 diff(3파일/213줄)는 `AlertRuleDto.threshold`(number→string 정정) + 신규 repo-guard
  (`findNumericAsNumber`) 다. 이 alerts 모듈은 `spec/2-navigation/9-user-profile.md` 의
  `code:` frontmatter(`codebase/backend/src/modules/alerts/**`, `lib/api/alerts.ts`)에 속하므로,
  본문이 프롬프트 예산으로 생략됐더라도(9-user-profile.md 는 절단 목록에 있었음) 저장소에서
  직접 열어 대조했다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이번 diff 를 자신이 만든 변경으로
  직접 서술하고 있어(§③ "AlertRuleDto.threshold — 진짜 계약 거짓 — 이 PR 이 고쳤다"), diff↔plan
  대조의 1차 자료로 썼다.

## 확인한 것 (충돌 없음)

- `spec/2-navigation/9-user-profile.md` §6.3 은 `POST /api/alerts` 의 **요청** body 만
  `threshold(number, ...)` 로 문서화한다 — 이번 diff 는 **응답** DTO 만 바꿨고 쓰기 경로
  (`CreateAlertRuleDto.threshold: number` → 서비스가 `String(...)` 저장)는 그대로라 이 서술과
  충돌하지 않는다. §5.4 "규칙 목록" 행은 threshold 타입을 명시하지 않아 역시 무충돌.
- `codebase/frontend/src/lib/api/alerts.ts` 는 diff 주석의 주장("프런트는 이미 읽기 타입을
  string 으로 갈라 두었다")대로 **이미** `AlertRule.threshold: string` / `CreateAlertRulePayload.threshold:
  number` 로 분리되어 있다 — 실측 확인, FE 후속 조치 없음.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 남긴 유일한 미해결 후속
  (`spec/1-data-model.md:873` 의 `threshold` `Float` 라벨 재정정)은 **spec/1-data-model.md**
  대상이라 target(`spec/2-navigation/`) 범위 밖이며, 이미 그 plan 자체에 미체크 항목으로
  정확히 등재돼 있어 "후속 항목 누락"에 해당하지 않는다.
  - (참고, 등재 강화용 — 등급 없음) 그 항목이 `Float` 를 문제 삼는 근거를 더 뒷받침하는 정황을
    발견했다: 같은 §2.25 근처 `cost_usd` 필드가 이미 `Numeric(12,6)?` 표기를 쓰고 있어
    (`spec/1-data-model.md:851`), 그 항목이 "DB 타입에 맞춘다"로 향할 때 `Numeric(12,4)` 표기
    선례가 이미 문서 안에 있다는 뜻이다. `spec-sync-auth-gaps.md` 의 2026-08-31 완료 결정
    ("어휘는 Float/Int/BigInt 뿐")이 이 선례를 놓쳤을 가능성이 있으나, 이는 target
    (`spec/2-navigation/`) 밖의 사실이라 정보로만 남긴다 — 별도 조치 요구 아님.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 종결 조건 절이 인용하는
  형제 plan 종결 커밋(`cce8a188b`)·`entity-nullable-column-type-mismatch.md` 의 `plan/complete/`
  이동은 실제 git 이력과 일치했다.

## 발견사항

- **[INFO]** `3-schedule.md` Rationale 의 plan 경로가 stale (`in-progress` → 실제로는 `complete`)
  - target 위치: `spec/2-navigation/3-schedule.md` §Rationale "sort/order 쿼리 반영" 문단
    (`plan/in-progress/spec-sync-schedule-gaps.md 추적` 문구)
  - 관련 plan: `plan/complete/spec-sync-schedule-gaps.md` (2026-07-06 완료, `plan/in-progress/`
    에는 더 이상 존재하지 않음 — 실측: `plan/in-progress/spec-sync-schedule-gaps.md` 파일 부재)
  - 상세: 이번 diff 와는 무관한 기존 drift 다. Rationale 본문 자체는 이미 "이후 구현 완료"라고
    서술해 내용상 오해를 주지 않지만, 인용 경로가 `in-progress` 로 남아 있어 그대로 따라가면
    죽은 링크다. `plan/complete/spec-sync-schedule-gaps.md` 를 열어 대조한 결과, 해당 plan 은
    sort/order 항목을 포함해 관련 항목 전부가 `[x]` 로 닫혀 있고 2026-07-06 자로 이동 완료돼
    있어 서술 내용과도 정확히 일치한다 — 내용 충돌은 없고 경로만 낡았다.
  - 제안: `spec/2-navigation/3-schedule.md` 의 해당 경로 문구를
    `plan/complete/spec-sync-schedule-gaps.md` 로 갱신 (plan 레벨 참조라 build guard 가
    강제하지 않는 지점 — [`.claude/docs/plan-lifecycle.md`](../../../.claude/docs/plan-lifecycle.md)
    §"plan 레벨에는 가드가 없다" 참고).

## 요약

`spec/2-navigation/` 은 이번 diff 로 직접 변경되지 않았고, 실제 코드 변경(`AlertRuleDto.threshold`
number→string 정정 + numeric-as-number repo-guard 신설)은 `9-user-profile.md` 가 관할하는
alerts 모듈에 속하지만 이 spec 이 문서화하는 계약(요청 DTO `number`, 목록 표 무타입)과 충돌하지
않으며, 프런트엔드는 이미 이 비대칭을 반영하고 있었다. 이번 세션의 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 는 이 diff 를 스스로 서술·추적하고 있고, 유일하게
남은 후속(`spec/1-data-model.md` 의 `threshold` 라벨 재정정)도 target 범위 밖에서 이미 미체크
항목으로 정확히 등재돼 있어 "미해결 결정 우회"나 "후속 누락"에 해당하는 사례를 찾지 못했다.
발견된 유일한 문제는 이번 diff 와 무관한 기존 stale plan 경로 참조(INFO) 하나뿐이다.

## 위험도

LOW
