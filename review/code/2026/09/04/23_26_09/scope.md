# 변경 범위(Scope) 코드 리뷰

## 검토 방법

프롬프트에 실린 37개 파일은 branch 전체 diff(`origin/main..HEAD`, 커밋 5개:
`6143b8c9f`→`e20fe5b0b`→`8a610e787`→`dd6549796`→`4be23e1ef`)와 일치함을
`git diff --stat origin/main..HEAD` 로 확인했다. 프롬프트에서 생략된 diff(파일 5, 8)와
잘린 diff(파일 7)는 `git diff origin/main..HEAD -- <path>` 로 직접 열어 확인했다.
저장소에 어떤 쓰기도 하지 않았다(`git status --short` 로 확인, 변경 없음).

## 발견사항

- **[INFO]** `(trigger_id)` 인덱스 행 추가는 이번 티켓("`idx_schedule_next_run` 부분
  조건 불일치")과 무관한 V106 문서화 공백을 함께 메우는 드라이브바이
  - 위치: `spec/1-data-model.md:915` (신규 행 `| Schedule | (trigger_id) | ... V106 |`),
    근거는 `plan/in-progress/spec-draft-schedule-index.md` `## 4. 변경안 (B)` 섹션
  - 상세: `idx_schedule_trigger_id` 는 이 PR 이전에 이미 적용된 `V106` 마이그레이션의
    산물이고, 이번 changeset 의 실제 코드 변경(V110)과는 관계가 없다. "같은 표·같은
    테이블이므로 함께 메운다" 는 근거가 plan 본문에 명시돼 있고, 코드·마이그레이션
    변경은 없이 spec 표 행 1개 추가에 그친다. 이 항목은 이미 직전 라운드
    (`review/code/2026/09/04/23_02_51/scope.md`, `SUMMARY.md` WARNING/INFO #4)에서
    동일하게 지적·INFO 판정됐고, `RESOLUTION.md` 가 "PR 설명에 명시" 로 처분을
    확정했다 — 이번 라운드에서 diff 내용 자체는 그대로 유지돼 다시 나타난 것이며
    새로 늘어난 범위는 아니다.
  - 제안: 기존 처분(공개·저위험) 유지로 충분. 향후 유사 "겸사겸사 문서화" 드라이브바이는
    가능하면 별도 plan 항목/커밋으로 분리하면 이런 재확인 비용이 줄어든다.

- **[INFO]** 새 후속 백로그 항목("`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험 —
  규약 차원 처리")이 이번 PR 범위(V110 단일 인덱스 교체) 밖의 일반화된 작업을 등재
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (V110 항목 바로
    다음에 추가된 `- [ ]` 블록)
  - 상세: 리뷰 `23_02_51` WARNING 1(`indisvalid` 미검사)에 대해 V110 자신은 DROP-먼저
    순서로 완전히 고쳤으나, 동일 결함이 남아 있는 선례 `V056`/`V106`(이미 적용된
    append-only 마이그레이션)에 대한 규약·런북 차원 처리는 이 PR 이 구현하지 않고
    plan 항목으로만 등재했다. 코드 변경은 없고 문서 등재뿐이며, `spec/conventions/`
    쓰기는 planner 트랙이라는 이 저장소 규약을 정확히 따른 처리다.
  - 제안: 조치 불요 — 실제 구현 확장이 아니라 위험의 문서화·이관이므로 범위 위반이
    아니다. 참고로만 기록.

## 그 외 확인 결과 (문제 없음)

- 핵심 변경(마이그레이션 `.sql`/`.conf`, e2e 테스트, spec 2개 파일, plan 2개 파일)은
  전부 "쓰이지 않는 `idx_schedule_next_run` 부분 인덱스를 `(workspace_id, next_run_at)`
  로 교체" 라는 단일 목표에 수렴한다. `git diff --stat origin/main..HEAD` 기준
  codebase 변경은 마이그레이션 2파일 + e2e 테스트 1파일뿐이고, controller/service 등
  다른 레이어는 건드리지 않았다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` 전체 diff 는 삭제 줄이 0 —
  순수 추가(신규 schema 테스트 + `J.` API 테스트)이며 기존 테스트 재배치·리팩터링
  흔적이 없다.
- `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 는 해당 인덱스를 서술하는
  정확히 그 행만 수정했고, 무관한 행·섹션에 대한 리플로우나 포맷팅 변경은 없다.
- `dd6549796` 커밋(리뷰 `23_02_51` WARNING 4건 조치)은 각 WARNING 1:1 대응으로만
  구성돼 있다 — W1(DROP-먼저 순서+주석), W2(plan stale 갱신), W3(spec Rationale),
  W4(e2e 추가). 조치 외 리팩토링·무관 수정은 발견되지 않았다.
- `review/code/2026/09/04/23_02_51/**`·`review/consistency/2026/09/04/{22_34_55,22_43_40}/**`
  산출물 커밋(`4be23e1ef` 등)은 이 저장소의 명시 관례("코드 리뷰/일관성 검토 산출물은
  `review/**` 에 커밋")에 따른 것으로, 순수 문서 추가이며 코드 변경이 섞여 있지 않다.
  이를 별도 스코프 위반으로 보지 않았다.
- import 정리, 불필요한 주석 변경, 설정 파일(빌드/lint/CI) 변경은 diff 전체에서
  발견되지 않았다.

## 요약

전체 changeset 은 "schedule 부분 인덱스 → `(workspace_id, next_run_at)` 교체(V110)"
라는 단일 목표에 강하게 수렴하며, 의도 밖 리팩토링·기능 확장·무관 파일 수정·포맷팅
노이즈는 발견되지 않았다. 유일하게 짚을 지점 둘은 (1) V106 `trigger_id` 인덱스
문서화 드라이브바이 — 이미 직전 라운드에서 INFO 로 지적·공개·처분 완료된 항목이 그대로
유지된 것, (2) `IF NOT EXISTS` 재실행 위험의 규약 차원 처리를 코드로 확장하지 않고
plan 항목으로만 등재한 것 — 둘 다 실질적 코드 위험이 없고 근거가 본문에 명시된 저위험
INFO 다. `dd6549796` 의 리뷰 대응 커밋도 지적된 WARNING 4건에 정확히 1:1 대응하며
추가 범위 확장이 없다.

## 위험도

NONE
