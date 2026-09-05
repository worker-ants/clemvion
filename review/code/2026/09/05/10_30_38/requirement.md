# Requirement Review

## 검토 방법

이번 changeset 의 실제 코드/spec 델타는 (`git diff --stat origin/main` 로 확인) 7개 파일뿐이다 —
나머지 53개(`review/code/**`, `review/consistency/**`)는 앞선 5개 code-review 라운드(`09_27_04`,
`09_42_13`, `10_20_57` 등)와 4개 consistency-check 라운드(`09_13_39`, `09_53_09`, `10_04_12`,
`10_13_38`)의 산출물이며 이미 BLOCK:NO·CRITICAL 0·최종 NONE/LOW 로 수렴해 있다.

```
codebase/backend/migrations/README.md                          |  42 +++-
plan/complete/spec-draft-migration-rerun-and-citations.md       | 224 ++++++
plan/in-progress/spec-draft-nullable-notation-followups.md      |  36 +++-
spec/conventions/migrations.md                                  |   5 +
spec/conventions/review-citations.md                            | 127 +++++
spec/conventions/spec-impl-evidence.md                          |   2 +-
spec/data-flow/8-notifications.md                                |   6 +
```

앞선 라운드들의 지적·조치를 재신뢰하지 않고, 최종 워킹트리 상태를 직접 열어 **독립적으로**
재검증했다:

- `codebase/backend/migrations/README.md` §5 전문을 읽고 "인덱스 교체는 DROP-먼저" 3문장 패턴,
  "감수하는 비대칭", 재실행 2-경로 표(수동 재실행 / `repair`+재실행), V056·V106·V110 표를
  실제 SQL 파일(`V056__notification_active_partial_index.sql`,
  `V106__schedule_trigger_id_index.sql`, `V110__schedule_workspace_next_run_index.sql`)과 대조.
- `spec/conventions/migrations.md` §5 의 신규 포인터 문구·위치를 대조.
- `spec/conventions/review-citations.md` 전문을 읽고 §1~4 + Rationale 을 검증.
- `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 각주를 대조.
- `spec/data-flow/8-notifications.md` 의 V056 서술 뒤 신규 캐비엇(⚠️)을 대조.
- `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 "부록" 처리(전문 삭제 후
  포인터 표로 치환)가 실제로 반영됐는지 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 체크박스 상태(완료 2건,
  신규 등재 미결 2건 + 기존 미결 1건)를 대조.
- `review-citations.md` 가 인용하는 정량 주장을 저장소에서 직접 재현: `grep -rohE
  "[0-9]{2}_[0-9]{2}_[0-9]{2}" codebase/` → **514**, `grep -rlE ... codebase/` → **107개 파일**,
  전체경로 패턴 매치 **15회/10파일**(따라서 bare = 514-15 = **499**, 문서 §4 의 "499건"과
  일치), `scripts/ .github/` 대상 동일 패턴 → **8건**(전체경로 2건 → bare **6건**, 문서 §3 의
  "8건 중 6건이 bare"와 일치). 전부 문서가 주장하는 수치와 **정확히 일치**했다.
- `.claude/docs/plan-lifecycle.md:44` 의 인용문("`review/**` 같은 시점 기록 문서는 옛 경로
  유지")이 `review-citations.md` §3 의 인용과 문자 그대로 일치하는지 확인 — 일치.
- `spec/conventions/swagger.md` §3("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다")이
  `review-citations.md` §3 의 DTO JSDoc 예외 행이 가리키는 근거와 일치하는지 확인 — 일치.
- `V110__schedule_workspace_next_run_index.sql` 헤더 주석("정상 흐름에서는 발생하지 않고")이
  여전히 좁은 서술 그대로 남아 있고(append-only), 그 처분이
  `spec-draft-nullable-notation-followups.md:457` 에 미결 후속으로 등재돼 있는지 확인 — 확인됨.
- 저장소 뮤테이션 없음(`git status --short` 최종 확인 — 이 세션 자신의 출력 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 이번 델타는 순수 문서/spec 변경(마이그레이션 SQL·애플리케이션 코드 변경 0건)이며,
  독립 재검증 결과 CRITICAL/WARNING 급 신규 결함을 찾지 못했다.
  - 위치: `codebase/backend/migrations/README.md` §5, `spec/conventions/migrations.md` §5,
    `spec/conventions/review-citations.md` 전체
  - 상세: 앞선 5개 code-review + 4개 consistency-check 라운드가 이미 발견한 항목(README §5
    스코프 문구, 원인 레이어 통일, V056/V106 표 분리, 부록 A/B 전문 드리프트, `code:` 필드
    재해석 SoT 미동기화, DTO JSDoc 표면 겹침, `8-notifications.md` 옛 순서 캐비엇 부재 등)은
    전부 최종 워킹트리에서 실제로 반영돼 있음을 파일을 직접 열어 확인했다. 회귀는 없다.
  - 제안: 조치 불요 — 확인 기록.

- **[INFO]** 남아 있는 두 개의 유보(defer) 결정은 조작 없이 정직하게 미결 상태로 등재돼 있다
  — 이는 요구사항 완전성 관점에서 "누락"이 아니라 "의도적 스코프 경계"로 판정한다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:457-478`
  - 상세: (1) `V110` 헤더의 "정상 흐름에서는 발생하지 않는다" 라는 좁은 서술은 append-only
    원칙 때문에 그 파일 자체는 고치지 않고 README.md §5 쪽만 정정했다 — 그 비대칭이
    처분 선택지(a/b)와 함께 명시적으로 등재돼 있다. 실측 결과 V110 파일은 실제로 그
    문구 그대로 남아 있다(내가 직접 파일을 읽어 확인). (2) `Flyway -mixed=true` 도입 여부는
    "저장소 전역 가드 해제" 급 결정이라 이 PR 이 단독으로 정하지 않고 별도 결정 항목으로
    남겨뒀다 — 저장소 전체(`Dockerfile`, `.conf`, workflow)에 `mixed=true` 가 어디에도 설정돼
    있지 않음을 직접 grep 으로 확인해 서술과 실제 상태가 일치한다.
  - 제안: 조치 불요. 두 항목 모두 다음 세션에서 별도로 처리될 성격이며, 이번 PR 의 요구사항
    범위(재실행 안전성 패턴 성문화 + 리뷰 인용 규약 성문화) 밖이다.

- **[INFO]** 정량 주장 전수 재현 결과 전부 일치 (신뢰도 근거로 기록)
  - 위치: `spec/conventions/review-citations.md` §1, §2, §3(각주), §4
  - 상세: `107개 파일·514회`, `bare 499건`, `scripts/.github 8건 중 6건 bare`,
    `.claude/docs/plan-lifecycle.md:44` 인용문 일치, `swagger.md §3` 인용 근거 일치 — 5개 항목
    모두 독립 재현 결과 문서 서술과 정확히 일치했다. 이 세션 이력에서 정량 주장이 반복
    오류(거짓 0, 시점 차이 등)를 냈던 만큼, 별도 재현 검증을 남긴다.
  - 제안: 조치 불요.

CRITICAL 급 발견 없음.

## 요약

이번 changeset 은 애플리케이션 코드·SQL 마이그레이션 변경이 전혀 없는 순수 문서/spec PR로,
`CREATE INDEX CONCURRENTLY` 기반 인덱스 교체의 재실행 안전성 패턴("DROP-먼저" 3문장)을
`codebase/backend/migrations/README.md` §5 에 성문화하고 `spec/conventions/migrations.md` 에서
포인터를 걸었으며, 코드 주석의 리뷰 산출물 인용 규약(`spec/conventions/review-citations.md`)을
신설했다. 이미 5개 code-review 라운드 + 4개 consistency-check 라운드를 거쳐 BLOCK:NO·최종
NONE/LOW 로 수렴한 상태였고, 본 라운드에서 최종 워킹트리를 직접 열어 독립적으로 재검증한 결과
(README §5 본문, migrations.md 포인터, review-citations.md 전문, spec-impl-evidence.md 각주,
8-notifications.md 캐비엇, plan 문서의 부록 치환·체크박스 상태, 5개 정량 주장의 grep 재현)
모든 항목이 최종본과 일치했고 신규 CRITICAL/WARNING 을 발견하지 못했다. 남아 있는 두 유보
항목(V110 헤더의 좁은 서술 · Flyway `mixed=true` 도입 여부)은 누락이 아니라 append-only 원칙과
"단독 결정 아님" 판단에 따른 의도적 스코프 경계이며, plan 트래커에 명시적으로 등재돼 있어
요구사항 추적성이 유지된다.

## 위험도
NONE
