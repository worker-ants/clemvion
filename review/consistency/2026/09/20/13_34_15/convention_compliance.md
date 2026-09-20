# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: 구현 완료 후 검토 (`--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`)

## 검토 방법

프롬프트 번들의 `## 구현 변경 사항`·`<git diff origin/main...HEAD -- code_areas>` 절이 컨텍스트
예산으로 절단돼 있어(본문 미포함), 워킹트리를 절대경로로 직접 조회했다:

```
git diff --stat origin/main...HEAD -- .
git diff origin/main...HEAD -- codebase/backend/test/schedule-trigger.e2e-spec.ts
```

**실제 코드 델타는 1개 파일**(`codebase/backend/test/schedule-trigger.e2e-spec.ts`, e2e 테스트)뿐이다.
나머지 변경분은 전부 `plan/**` · `review/**` 산출물이다. `spec/2-navigation/` 자체의 델타는 0개
파일로, 프롬프트가 예고한 대로다 — 이 자체는 CRITICAL 근거로 삼지 않는다.

번들에 전문이 실린 세 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)과, 이번
diff 가 직접 건드린 e2e 테스트 파일의 신규 주석 블록을 정식 규약 원문과 대조했다. 관련
`spec/conventions/*.md`(`audit-actions.md`·`error-codes.md`·`swagger.md`·`review-citations.md`)는
프롬프트 번들에서 예산 절단된 것을 저장소에서 직접 `Read` 로 확보해 대조했다.

## 발견사항

이번 diff 로 인한 CRITICAL·WARNING 급 정식 규약 위반은 발견하지 못했다.

- **target 위치**: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 신규 주석 블록(D 케이스,
  `PATCH cron → nextRunAt 재계산`)
- **대조 규약**: `spec/conventions/review-citations.md` §2·§3 (`codebase/**` 주석의 리뷰 인용은
  날짜를 포함해야 하며 bare `hh_mm_ss` 금지)
- **결과**: 신규 주석이 인용하는 세 개 리뷰 세션 — `review/code/2026/09/20/09_35_16/RESOLUTION.md`
  (전체 경로), `review/code/2026/09/20/11_54_10` W1, `review/code/2026/09/20/12_17_18` W1 — 전부
  "전체 경로"(§2 "권장" 형태) + 지적 번호 병기로, 규약을 정확히 따른다. bare 시각 인용은 없다.
  (같은 diff 가 남긴 `plan/in-progress/spec-draft-nullable-notation-followups.md` 인용은 §3 표에
  따라 애초에 규약 적용 대상이 아니다.)
- 판정: **위반 아님** — 오히려 직전 라운드(`568fd2ecd`)가 이 규약 위반(순번만 인용)을 이미
  정정한 상태를 diff 가 유지·재확인한다.

target 문서(`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`) 자체는
이번 diff 로 바뀌지 않았으나, 같은 문서에 대해 4시간 전(`review/consistency/2026/09/20/11_21_16`)
`--impl-prep` 라운드가 이미 정식 규약 5개 관점(명명·출력 포맷·문서 구조·API 문서·금지 항목)을
전수 대조했다. 그 결론(NONE, 유일 지적은 `spec/2-navigation/12-*.md` 파일 번호 결번 INFO 1건,
문서 3섹션 구조는 `_product-overview.md` 예외로 위반 아님)을 이번 라운드에서 재확인했다 — 그
사이 target 문서에 변경이 없으므로 결론이 stale 해질 이유가 없다.

### INFO — `spec/2-navigation/` 파일 번호 결번 (12번 없음) — 기지(既知) 사항, 재확인만

- target 위치: `spec/2-navigation/` 디렉터리 전체 (파일 목록)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` 명명 컨벤션 (`spec/<영역>/N-name.md` 정렬)
- 상세: `11-*.md` 다음 `13-*.md` 로 건너뛴다(`12-*.md` 부재, 이력 없음). 정렬 자체는 깨지지
  않아 규약 직접 위반은 아니다. 이번 diff 와 무관한 기존 상태이며 새로 발생한 것이 아니다.
- 제안: 별도 조치 불필요. 이 영역의 파일을 다음에 추가·재배열할 때 메우거나 `_layout.md` 에
  결번 의도를 한 줄로 남기는 정도로 충분 (직전 라운드 제안과 동일, 반복 조치 불필요).

## 검토 범위의 한계

- `spec/2-navigation/`의 나머지 15개 파일(4-integration.md·6-config.md 등)은 이번에도 컨텍스트
  예산으로 절단돼 전문을 재확인하지 않았다 — 이번 diff 가 그 파일들을 건드리지 않았고, 직전
  라운드가 같은 이유로 이미 스코프를 3개 파일로 명시했으므로 결론에 영향 없다.
- `codebase/backend/test/schedule-trigger.e2e-spec.ts`는 스케줄/트리거 도메인 테스트이지 spec
  문서가 아니므로 "문서 구조"·"API 문서 데코레이터" 관점은 적용 대상이 아니며, 주석의 리뷰
  인용 형식(§2 관점 "출력 포맷"과는 별개 축)만 대조했다.

## 요약

이번 `--impl-done` 라운드의 실제 코드 델타는 `spec/2-navigation/` 스코프 내 e2e 테스트 1개
파일(cron 재계산 판정 로직을 "달라졌다" 비교에서 "새 cron 이 만드는 값인가" 판정으로 바꾼
테스트 안정화)뿐이며, spec 문서 자체는 변경되지 않았다. 그 diff 가 남긴 신규 주석은
`review-citations.md`(전체 경로 인용)를 정확히 따르고, 다른 명명·출력 포맷·API 문서 규약을
새로 건드리지 않는다. target 문서 3개 파일에 대해서는 4시간 전 `--impl-prep` 라운드가 이미
전수 대조를 마쳤고 그 사이 변경이 없어 결론(NONE, INFO 1건)이 그대로 유효하다. 종합적으로
이번 라운드에서 CRITICAL·WARNING 급 정식 규약 위반은 없다.

## 위험도

NONE
