# 문서화(Documentation) 코드 리뷰

## 검토 범위

이번 changeset(37개 파일)의 실질 핵심은 `V110` schedule 인덱스 교체(마이그레이션 2개 + e2e
1건)와, 그 결정을 spec/plan 문서에 반영하는 작업, 그리고 **직전 리뷰 라운드(`23_02_51`)가
낸 문서화 WARNING 2건을 해소하는 후속 커밋**이다. 나머지는 이전 리뷰/consistency-check
세션(`23_02_51`, `22_34_55`, `22_43_40`)의 산출물이 이번 diff 로 커밋되는 시점 기록이다.

직전 라운드의 문서화 WARNING 2건이 이번 changeset 에서 실제로 해소됐는지를 소스 대 소스로
직접 대조했고(`plan/in-progress/spec-draft-nullable-notation-followups.md`,
`spec/1-data-model.md`, `codebase/backend/test/schedule-trigger.e2e-spec.ts` 를 직접 `Read`),
migrations/README.md·CHANGELOG.md 관례와의 정합도 확인했다. 저장소 파일은 건드리지 않았다
(`git status --short` 로 diff 시작 전후 무변화 확인).

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-schedule-index.md` 는 frontmatter `status: complete`
  이고 §6 구현 표의 4개 산출물이 모두 "완료" 로 서술돼 있는데, 파일이 아직 `plan/in-progress/`
  에 남아 있다 (`plan/complete/` 로 `git mv` 되지 않음).
  - 위치: `plan/in-progress/spec-draft-schedule-index.md:6`(frontmatter `status`), `:162-173`(§6 표)
  - 상세: `.claude/docs/plan-lifecycle.md` §3 은 "모든 항목이 완료된 순간 `complete/` 로 이동"
    을 규정하고, §5 자가점검 체크리스트에도 이동 여부가 들어 있다. 이 draft 자신의 종결
    조건(§6 표 4행)은 이번 diff 로 전부 충족됐다. 다만 이 저장소 관례상 "체크와 이동은
    리뷰 뒤 마무리 커밋에서" 이루어지는 것이 정상 흐름이라(직전 `22_43_40` consistency
    라운드도 같은 취지의 INFO#2 를 이미 남겼다), 이번 diff 자체의 결함이라기보다 **이 리뷰
    이후 마무리 커밋에서 반드시 반영돼야 할 잔여 항목**으로 플래그한다. 참고로 이 draft 를
    가리키는 부모 트래커 `spec-draft-nullable-notation-followups.md` 는 아직 열린 항목
    (`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험)이 있어 그 자체는 이동 대상이 아니다.
  - 제안: 마무리 커밋에서 `spec-draft-schedule-index.md` 를 `git mv` 로 `plan/complete/` 이동
    (history 보존), 인입 참조(`spec-draft-nullable-notation-followups.md:379` 의 상대링크
    `./spec-draft-schedule-index.md`)를 `../complete/spec-draft-schedule-index.md` 로 갱신.

- **[INFO]** (확인용, 긍정적 발견) 직전 라운드 문서화 WARNING 2건이 이번 changeset 에서
  실제로 정확히 해소됐다 — 소스 대 소스 직접 대조로 확인.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:379`(체크박스 `[x]`
    전환 + 본문 정정), `:450`(종결조건 표 셀 취소선 처리); `spec/1-data-model.md:947-978`
    (`### Schedule 인덱스 ... (2026-09-04)` Rationale 신설); `codebase/backend/test/schedule-trigger.e2e-spec.ts:18-19`
    (모듈 JSDoc 불릿에 신규 스키마 테스트 축 반영)
  - 상세: (1) plan 체크박스가 `[x]`로 바뀌고 "V110 적용 완료" 서술로 갱신됐으며, (a)/(b)
    후보가 실측으로 기각된 이유까지 표로 남겼다. (2) `spec/1-data-model.md` `## Rationale`
    에 네 후보 실측 비교표 + 기각 사유 3건이 이 문서 기존 관례(`alert_rule`,
    `WorkflowVersion.snapshot` 항목과 같은 형식)를 그대로 따라 추가됐다. (3) e2e 스펙 파일
    상단 JSDoc "검증 대상" 불릿에 신규 스키마 테스트 축 2줄이 추가됐다. 세 곳 모두 마이그레이션
    헤더 주석(`V110__*.sql:14-19`)의 벤치마크 수치(5.99/12.77/0.30 ms, 20배, 2.2배, 6.4배)와
    자릿수까지 정확히 일치해 SoT 드리프트가 없다.
  - 제안: 없음(확인용 기재).

- **[INFO]** CHANGELOG.md 항목 미추가는 이 저장소 관례와 정합 — 결함 아님.
  - 위치: `CHANGELOG.md` (미변경)
  - 상세: `CHANGELOG.md` 의 기존 항목 전부(`grep '^## '` 로 확인한 30여 건)가 API/wire
    behavior 변경 또는 클라이언트가 체감하는 버그 정정을 다룬다. 이번 V110 은 순수 내부 DB
    인덱스 최적화로 요청/응답 계약·클라이언트 가시 동작을 바꾸지 않으므로, 이 관례상 CHANGELOG
    대상이 아니라고 판단한다.
  - 제안: 없음.

- **[INFO]** 신규 등재된 후속 항목("`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험 —
  규약 차원 처리")은 실측·근거·트랙 분리가 명확해 문서 위생 결함 없음.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:395-413`
  - 상세: `migrations/README.md` 를 직접 확인한 결과 `indisvalid`/재실행 edge case 에 대한
    기존 문서화가 전혀 없어(README 전체에서 "재실행"·"invalid" 관련 언급은 `IF NOT EXISTS`
    사용례 주석 한 줄뿐), "아직 성문화되지 않았다"는 항목 본문의 주장이 사실과 일치한다.
    (a) `spec/conventions/` 성문화(planner 트랙)와 (b) 배포 런북 절차(developer 트랙)로
    명확히 분리해 등재해, 이전 라운드에서 반복 지적된 "권한 밖 항목을 developer 트랙에 방치"
    패턴을 피했다.
  - 제안: 없음(확인용 기재).

## 요약

이번 changeset 은 직전 리뷰 라운드(`23_02_51`)가 낸 두 문서화 WARNING(plan 체크박스 stale,
spec `## Rationale` 항목 부재)을 정확히, 그리고 이 저장소의 기존 형식 관례를 그대로 따라
해소했다 — 체크박스·종결조건 표·spec Rationale·e2e JSDoc 네 곳 모두 대조 확인했고 수치 드리프트도
없다. 마이그레이션 헤더 주석은 재실행 안전성 결함(W1)의 재현 과정과 수정 근거를 상세히 서술해
이 저장소 평균 이상의 문서화 밀도를 보인다. 유일하게 남는 지점은 `spec-draft-schedule-index.md`
가 `status: complete` + 작업 완료 상태인데도 아직 `plan/complete/` 로 이동되지 않은 것인데,
이는 이 저장소 관례상 "리뷰 뒤 마무리 커밋에서 이동" 이 정상 흐름이라 이번 리뷰의 차단 사유는
아니며, 마무리 커밋에서 처리될 항목으로 남겨둔다.

## 위험도

LOW
