# 문서화(Documentation) 리뷰

## 검토 범위·방법

이번 changeset(51개 파일)의 실질 핵심은 `schedule` 인덱스 교체 마이그레이션(V110, `.sql`+`.conf`) +
그 검증 e2e 테스트(`schedule-trigger.e2e-spec.ts`) + 관련 spec/plan 문서 갱신이며, 나머지는
직전 두 리뷰 라운드(`23_02_51`, `23_26_09`)와 두 consistency-check 라운드(`22_34_55`, `22_43_40`)의
산출물이 이번 diff 로 커밋되는 시점 기록이다. 두 리뷰 라운드가 이미 문서화 관점 WARNING 4건
(plan 체크박스 stale, spec `## Rationale` 부재, e2e JSDoc 갱신 필요, plan `complete/` 미이동)을
지적했고 각각 후속 커밋에서 조치됐다고 주장한다. 이 주장을 재현하지 않고 **소스 대 소스로 직접
재확인**했다(`git log`, `git diff origin/main..HEAD`, 대상 파일 `Read`/`grep`). 저장소에 쓰기는
하지 않았다(`git status --short` 변화 없음 확인).

## 발견사항

- **[INFO]** 이전 두 라운드의 문서화 WARNING 4건은 실제로 해소됨 — 직접 대조 확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:379`(체크박스 `[x]`+본문
    정정), `:465`(종결조건 표 취소선); `spec/1-data-model.md:947-978`(`## Rationale` 신설);
    `codebase/backend/test/schedule-trigger.e2e-spec.ts:15-20`(JSDoc 불릿 2개 추가); `plan/complete/spec-draft-schedule-index.md`(신규 — `git mv` 로 이동 완료, 커밋 `8b0f5ac0c`)
  - 상세: (1) plan 체크박스가 `[x]`로 바뀌고 (a)/(b) 기각·근거·(c) 채택을 표로 남겼다. (2)
    `spec/1-data-model.md`의 `## Rationale`에 네 후보 실측 비교표 + 기각 사유 3건이 기존 형식
    (`alert_rule`, `WorkflowVersion.snapshot` 항목)을 그대로 따라 추가됐다. (3) e2e 스펙 파일
    JSDoc에 신규 축 2줄이 반영됐다. (4) `spec-draft-schedule-index.md`가 `plan/complete/`로
    실제 이동했고, 인입 참조 4곳(SQL 헤더·e2e JSDoc·`spec/1-data-model.md`·
    `spec-draft-nullable-notation-followups.md`) 모두 `plan/complete/spec-draft-schedule-index.md`
    경로로 갱신돼 있음을 `grep` 으로 전수 확인했다 — dangling 링크 없음.
  - 제안: 없음(확인용 기재).

- **[INFO]** 마이그레이션 헤더 주석이 append-only 파일 안에 **일시적 리뷰 세션 ID**를 인용한다
  — 이 저장소 마이그레이션 중 처음 나타나는 패턴
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32`
    (`## \`IF NOT EXISTS\` 만으로는 재실행이 안전하지 않다 (23_02_51 W1)`), `:53`
    (`**비대칭 하나를 감수한다** (23_26_09 W3)`)
  - 상세: `spec/conventions/migrations.md §3` 원칙상 머지된 `V<N>` 파일은 이후 수정 불가한
    **영구 기록**이고, RESOLUTION.md(`23_02_51`) 자신도 "마이그레이션 헤더는 장애 대응 중에
    읽는 자리라 자체 완결적인 수치가 기능"이라고 명시했다. 그런데 이 두 인용(`23_02_51 W1`,
    `23_26_09 W3`)은 `review/code/2026/09/04/<hh_mm_ss>/` 라는, 이 저장소의 리뷰-세션 내부
    타임스탬프 디렉터리를 가리킨다 — GitHub PR/이슈 번호(`#1284`처럼 이 헤더 자신도 §Rationale
    출처 인용에 쓰는 안정적·외부 식별자)와 달리, 이 세션 ID는 이 프로젝트의 로컬 리뷰 도구
    체계에만 의미가 있고 보존 정책이 문서화돼 있지 않다. `codebase/backend/migrations/*.sql`
    전체를 grep 한 결과 `_[0-9]{2}_[0-9]{2}_[0-9]{2}` 형태의 세션 ID 인용은 V110 이 유일하다 —
    선례가 없다. 다행히 인용된 두 단락 모두 **본문 자체가 자기완결적**이라(세션 ID를 몰라도
    "왜 DROP-first 인가"·"왜 비대칭을 감수하는가"를 완전히 이해할 수 있다) 정보 손실 위험은
    낮고, 링크가 아니라 괄호 안 배경 각주에 그친다.
  - 제안: 결함은 아니나(본문이 자기완결적이라 인용이 사라져도 의미가 안 깨진다), 앞으로도
    이 스타일을 반복할 계획이면 세션 ID 대신 커밋 SHA나 PR 번호처럼 저장소 자체에 영구
    보존되는 식별자를 쓰는 편이 append-only 파일의 "영구 기록" 성격과 더 잘 맞는다는 점을
    참고로 남긴다.

- **[INFO]** `CREATE INDEX CONCURRENTLY` 재실행 안전성 규약화 후속 항목은 실제 갭이 맞고,
  올바른 트랙으로 등재돼 있음 — 확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428`,
    대조: `codebase/backend/migrations/README.md`, `spec/conventions/migrations.md`
  - 상세: 이 항목 본문은 "`indisvalid`/재실행 edge case가 아직 성문화되지 않았다"고 주장한다.
    두 후보 문서를 직접 grep 한 결과 `indisvalid`·"invalid" 인덱스 재실행 관련 서술은 어디에도
    없어(README.md·migrations.md 전수 확인) 그 주장은 사실과 일치한다. (a) `spec/conventions/`
    성문화(planner 트랙)와 (b) 배포 런북 절차(developer 트랙)로 분리 등재한 것도 이 저장소의
    역할 분리 규약과 맞는다. V056/V106(선례, DROP-first 없음)이 여전히 이 위험을 안고 있다는
    사실도 정확히 기술돼 있다.
  - 제안: 없음(이번 PR 범위 밖의 정상적인 후속 등재).

- **[INFO]** CHANGELOG.md 미변경은 이 저장소 관례와 정합
  - 위치: `CHANGELOG.md`(미변경)
  - 상세: 기존 항목이 전부 API/wire 계약 변경 또는 클라이언트 체감 버그 수정을 다루는데, 이번
    변경은 순수 내부 DB 인덱스 최적화로 요청/응답 계약이나 클라이언트 가시 동작을 바꾸지
    않는다. 직전 라운드가 이미 같은 결론을 냈고, 재확인 결과도 동일하다.
  - 제안: 없음.

## 요약

이 changeset 은 이전 두 리뷰 라운드에서 지적된 문서화 WARNING 4건(plan 체크박스 stale, spec
`## Rationale` 부재, e2e JSDoc 신규 축 미반영, `plan/complete/` 미이동)을 모두 실제로 해소했다 —
주장을 그대로 받아들이지 않고 소스 대 소스로 재확인했으며, 인입 참조 링크도 전수 확인해
dangling 링크가 없다. 핵심 산출물(`V110__*.sql`/`.conf`, e2e 테스트, spec Rationale)의 문서화
밀도는 이 저장소 평균을 웃돈다. 새로 발견한 것은 결함이 아니라 참고 사항 하나뿐이다 —
append-only 마이그레이션 헤더가 처음으로 일시적 리뷰-세션 ID(`23_02_51 W1`, `23_26_09 W3`)를
인용하는데, 본문 자체가 자기완결적이라 그 인용이 훗날 해석 불가능해져도 의미 손실은 없다.
CHANGELOG 미변경, `indisvalid` 규약화 후속 등재 모두 근거가 명시돼 있고 이 저장소 관례와
정합한다. Critical/Warning 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
