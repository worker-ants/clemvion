# 정식 규약 준수 검토 — `plan/in-progress/harness-probe-isolation.md`

## 검토 범위에 대한 전제

target 은 `spec/**` 문서가 아니라 `plan/in-progress/**` 작업 추적 문서다(frontmatter
`spec_impact: none`, 본문 전체가 pytest 하네스의 fixture 격리 문제만 다룬다 — API 응답,
DTO, audit action, error code, node output, cafe24/makeshop 카탈로그 등 `spec/conventions/**`
가 규율하는 어떤 표면도 건드리지 않는다). 따라서 점검 관점 1(API endpoint 명명)·2(출력
포맷)·4(API 문서 데코레이터/DTO) 는 **적용 대상이 없다** — 위반이 없다기보다 규약이
다루는 도메인 자체가 이 문서에 등장하지 않는다.

실제로 교차하는 유일한 규약은 **`spec/conventions/review-citations.md`**(§3 인용 규약)이며,
아래에서 검증했다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 위반은 발견되지 않았다. 참고용 INFO 1건만 기록한다.

- **[INFO]** bare `hh_mm_ss` 리뷰 인용은 규약상 `plan/**` 제외 대상 — 위반 아님을 확인
  - target 위치: 본문 도입부, "등재 근거는 `` `/ai-review` `` `review/code/2026/09/25/00_39_02`
    INFO 12 · `` `01_31_05` `` W1 이다."
  - 관련 규약: `spec/conventions/review-citations.md` §2 (bare `hh_mm_ss` 금지) / §3 (적용 범위)
  - 상세: 두 번째 인용 `` `01_31_05` `` W1 은 날짜 없는 bare 시각으로, §2 표만 보면
    "금지" 패턴과 글자 그대로 일치한다. 그러나 §3 은 `plan/**` 문서를 명시적으로
    **적용 대상에서 제외**한다("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그
    맥락을 담는다"). 실제로 이 문서에서 `01_31_05` 는 바로 앞 문장의 `2026-09-25`·
    `review/code/2026/09/25/00_39_02` 와 같은 문단·같은 날짜 맥락 안에 있어, 규약이
    이 예외를 둔 근거(같은 세션 내 맥락 자기완결성)에 정확히 부합한다.
  - 결론: **규약 위반 아님.** 수정 제안 없음 — 오히려 이 문서에 별도 조치를 요구하면
    §3 이 이미 내린 결정(plan 문서는 세션 맥락으로 충분히 해소된다)과 어긋난다.

기타 확인 사항(모두 이상 없음, 별도 발견사항으로 등재하지 않음):

- frontmatter `spec_impact: none` — bare sentinel 형태로 `spec-impl-evidence.md` R-8(Gate C)
  이 요구하는 형식(`none`/`없음`/`n/a`/`na` 중 하나, 또는 실재 spec 경로 리스트)과 일치한다.
  Gate C 자체는 `plan/complete/`(완료 시점)에만 강제되므로 `in-progress` 단계인 이 문서에는
  아직 적용되지 않지만, 미리 맞춰 둔 값이 형식을 어기지 않는다.
  (참고: `spec/conventions/spec-impl-evidence.md` §R-8)
- 문서 구조(Overview/본문/Rationale 3섹션) — 이 3섹션 관례는 CLAUDE.md 가 **spec 문서**에
  요구하는 구조이며 plan 문서에는 적용되지 않는다(plan 문서는 `.claude/docs/plan-lifecycle.md`
  가 정한 별도 frontmatter 스키마를 따른다). target 은 그 spec 3섹션 관례의 적용 대상이
  아니므로 미준수를 지적할 근거가 없다.
- `_harness.make_probe_repo` 등 신규 함수/모듈 명명, `CONSISTENCY_OUTPUT_DIR` 등 — 하네스
  내부(Python 테스트 인프라) 식별자이며 `spec/conventions/**` 어느 문서도 이 계층의 명명을
  규율하지 않는다.

## 요약

target 은 pytest 하네스의 fixture 격리 문제를 다루는 `plan/in-progress/` 작업 문서로,
`spec/conventions/**` 가 규율하는 API 명명·출력 포맷·DTO/Swagger 데코레이터·audit action 등의
표면을 전혀 건드리지 않아 대부분의 정식 규약이 적용 대상 밖이다. 유일하게 교차하는
`review-citations.md` 의 리뷰 인용 형식은, 언뜻 금지된 bare `hh_mm_ss` 패턴처럼 보이는 자리가
있으나 그 규약이 `plan/**` 문서를 명시적으로 예외 처리하고 있고 실제 문맥도 그 예외 근거(같은
세션 안에서 날짜가 인접 문장으로 해소됨)에 부합해 위반이 아니다. frontmatter `spec_impact`
값도 Gate C 가 요구하는 sentinel 형식을 선제적으로 만족한다. CRITICAL/WARNING 없음.

## 위험도

NONE
