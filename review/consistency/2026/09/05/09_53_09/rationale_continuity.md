# Rationale 연속성 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

## 검토 방법

scope 델타(2개 파일: `migrations.md` §5 추가 3줄, `review-citations.md` 신설 111줄)와 그에 딸린
코드 diff(`codebase/backend/migrations/README.md`, 54줄)를 아래 기존 Rationale/원칙 문서와
직접 대조했다.

- `spec/conventions/migrations.md` §7 (폐기 대안: 타임스탬프 prefix / `outOfOrder=true` /
  Merge Queue / branch protection) — 이번 diff(§5 3줄 추가)와 주제 중복 여부.
- `codebase/backend/migrations/README.md` §4·§5 실제 파일 — diff 가 새로 쓴 "인덱스 교체는
  DROP-먼저" 절이 §4(`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`)가 이미 해결한 문제를
  재론하는 것인지, 아니면 별개 실패 모드(재실행 시 invalid 잔재)를 다루는지 구분.
- 실제 마이그레이션 `V056`/`V106`/`V110` 파일을 열어 README 표(§5 신설 부분)의 "선례" 서술이
  실물과 line-level 로 일치하는지 재확인 (직전 라운드가 잡은 V056/V106 구분 오류가 실제로
  고쳐졌는지 포함).
- `spec/conventions/spec-impl-evidence.md` §2.1/§4 (`code:` = "본 spec 이 약속한 surface 의
  구현 경로", `spec-code-paths.test.ts` 는 글로브 매치만 검증) — `review-citations.md` 의
  `code:` 가 "처방 형태를 실제로 쓰는 예시 파일"을 가리키는 이례적 용법과 충돌 여부.
- `spec/conventions/swagger.md` §1-4/§3, `execution-context.md` §원칙 3 — "기존 것은 소급
  정리 대상 아님" 원칙을 `review-citations.md` §4 가 차용한 것이 실재하는 선례인지 원문 대조.
- `.claude/docs/plan-lifecycle.md` — `review-citations.md` §3 이 주장하는 "`review/**` 는
  시점 스냅샷이라 사후 편집 안 함" 관례의 출처 확인.
- `review/code/2026/09/05/00_06_38/{SUMMARY,documentation,RESOLUTION}.md` — `review-citations.md`
  가 "PR 번호 전환을 권고했으나 정식 결정은 아니었다"고 인용한 근거의 원문 대조.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — README 가 "별도 결정 항목"
  으로 미룬 `mixed=true` 도입 여부, "8건 해소 불가 bare 인용" 이 실제로 등재됐는지.
- 직전 라운드 산출물 `review/consistency/2026/09/05/09_13_39/rationale_continuity.md` (같은
  draft 의 이전 형태 검토) 및 `review/code/2026/09/05/09_27_04`·`09_42_13` (코드 리뷰가 잡은
  V056/V106 정정, 부록 중복 제거) — 지적된 항목이 최종본에 실제로 반영됐는지.

## 발견사항

- **[INFO]** `review-citations.md` 의 `code:` 가 spec-impl-evidence.md 의 "구현 경로" 의미를
  벗어난 이례적 용법인데, 그 정당화가 `## Rationale` 이 아니라 `## Overview` 인용구에만 있음
  - target 위치: `spec/conventions/review-citations.md` frontmatter `code:` + Overview 블록쿼트
    ("`code:` 는 이 규약이 처방하는 형태를 실제로 쓰는 파일을 가리킨다 …")
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의 표 —
    `code` = "본 spec 이 약속한 surface 의 **구현 경로**" (R-1 은 글로브 vs 명시파일만 다룰 뿐,
    "구현" 대신 "예시 사용처"를 가리키는 용법은 어디에도 전례가 없다). 대조로 `swagger.md`·
    `execution-context.md`·`node-cancellation.md` 등 다른 conventions 문서는 전부 `code:`에
    실제 시행/구현 파일(가드 스크립트, 서비스, 인터페이스)만 등재하고 "패턴을 따르는 예시 파일"
    은 등재하지 않는다.
  - 상세: `spec-code-paths.test.ts` 는 글로브가 ≥1 파일에 매치하는지만 보므로 이 용법도
    기계적으로는 가드를 통과한다 — 즉시 깨지는 충돌은 아니다. 다만 spec-impl-evidence.md 의
    필드 정의를 문자 그대로 어기는 재해석이며, 이 재해석의 근거가 `## Rationale` 에 없어 다음
    사람이 "code: 는 예시를 가리켜도 된다"는 선례로 오인해 다른 conventions 문서에 전파할 위험이
    있다. (참고: 같은 재해석은 이미 `review/code/2026/09/05/09_27_04` 코드 리뷰 INFO#4 가
    "이례적 용법이나 문서가 스스로 정당화"로 지적했고 `09_42_13` RESOLUTION 이 "확인 보고 —
    조치 불요"로 처분한 바 있다 — 이번 지적은 그 처분을 뒤집는 것이 아니라, 근거의 **위치**가
    Overview 가 아니라 `## Rationale` 이어야 CLAUDE.md 의 "결정의 배경·근거 = `## Rationale`"
    SoT 원칙과 맞는다는 점을 보탠다.)
  - 제안: 현재 Overview 인용구를 `## Rationale`에 "R-1. `code:` 를 예시 파일로 쓰는 이유"
    항목으로 옮기거나 복제하고, `spec-impl-evidence.md` R-1 을 명시적으로 인용해 "본 컨벤션은
    시행 코드가 없는 순수 문서 규약이라 `code:` 를 준수 예시로 대체한다"는 한 줄을 덧붙일 것
    (선택적 — 가드 통과에는 영향 없음).

- **[INFO]** `review-citations.md` §3 "`review/**` 산출물은 사후 편집 대상 아님" 주장의 출처가
  본문에 인용돼 있지 않음
  - target 위치: `spec/conventions/review-citations.md` §3 적용 범위 표, `review/**` 행
    ("**시점 스냅샷**이라 사후 편집하지 않는다는 별도 관례가 있다")
  - 과거 결정 출처: `.claude/docs/plan-lifecycle.md:44` "인입 참조: `review/**` 같은 시점 기록
    문서는 옛 경로 유지."
  - 상세: 주장 자체는 지어낸 것이 아니라 실재하는 관례를 정확히 반영한다(확인 완료) — 다만
    `review-citations.md` 본문에 그 출처를 밝히지 않아, 이 문서만 읽는 독자는 "별도 관례"가
    어디에 있는지 추적할 수 없다. §1 이 정리 이력(`f7c56bf0a`)까지 커밋 SHA 로 밝히는 것과
    대비된다.
  - 제안: 해당 셀에 `.claude/docs/plan-lifecycle.md:44` 링크를 추가.

## 그 외 확인했으나 문제 없음으로 판정한 항목

- **README §5 "인덱스 교체는 DROP-먼저" 신설**: §4(`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`)
  가 해결한 것은 *hang*(V022/V030 배경) 이고, 이번 신설은 *재실행 시 invalid 잔재로 인덱스
  0개가 되는* 별개 실패 모드를 다룬다 — 원문이 이 구분을 명시("근본 원인은 §4 로 해결되어
  있다"고 먼저 밝힌 뒤 그럼에도 유지하는 이유를 별도 나열)해 기존 Rationale 을 뒤집지 않는다.
- **`CREATE INDEX CONCURRENTLY` "정확히 한 개" 컨벤션과의 병치**: 신설 문장이 "제한 대상은
  `CREATE` 의 개수"라고 명시적으로 좁혀, 직전 라운드(`09_13_39` rationale_continuity INFO)가
  지적한 제목-본문 모호성을 정확히 해소했다 — 직전 INFO 의 제안 문구와 diff 의 실제 추가 문장이
  거의 동일하다.
- **V056/V106/V110 "선례" 표**: 세 파일을 직접 열어 대조한 결과 README 표(V056=CREATE+DROP
  진짜 교체, V106=CREATE 만·신규 추가)가 실물과 정확히 일치 — `09_27_04` 코드 리뷰가 잡은
  V056/V106 혼동은 최종본에서 해소돼 있다.
- **`mixed=true` 별도 결정 항목**: 저장소 히스토리에 `mixed=true` 를 다룬 과거 결정이 없어
  새 선택지 제안이며, README 는 즉시 채택하지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md:457`
  에 "planner + 인프라, 2026-09-05 등재"로 명시적으로 미뤄 뒀다 — 단독 결정 회피 원칙과 정합.
- **"PR 번호로 전환하지 않는다" 결정**: `review/code/2026/09/05/00_06_38/{SUMMARY,documentation,RESOLUTION}.md`
  원문 대조 결과 해당 라운드는 "권고"만 남겼을 뿐 정식 채택 결정이 아니었고, target 은 실측
  (107파일·514회, bare 인용 8건 해소 불가)을 근거로 답하며 새 `## Rationale`("왜 PR 번호로
  전환하지 않았나")을 함께 작성했다 — 결정 무근거 번복 아님.
- **"기존 인용 소급 정리 대상 아님" 원칙 차용**: `swagger.md:123,320,470`, `execution-context.md`
  §원칙 3(:54) 실물 확인 결과 동일 원칙("신규 변경에만 적용, 기존 것은 다음에 손댈 때 맞춘다")이
  실재해 지어낸 선례가 아니다.
- **append-only 원칙과의 관계**: DROP-먼저 패턴은 *새로 작성하는* 마이그레이션에 대한 지침이고,
  README 스스로 "이미 성공한 마이그레이션은 append-only 라 소급 수정 대상 아니다"를 명시해
  `migrations.md` §3 append-only 원칙을 우회하지 않는다.
- **8건 해소 불가 bare 인용 등재**: `plan/in-progress/spec-draft-nullable-notation-followups.md:463-466`
  에 "developer, 2026-09-05 등재"로 실제 등재돼 있어 §4 "소급 정리 대상 아님"과 모순되지 않는다
  (예외 8건만 별도 트랙).

## 요약

두 target 문서(migrations.md §5 증분, review-citations.md 신설)는 기존 spec/README 의
`## Rationale` 과 대조했을 때 기각된 대안을 이유 없이 되살리거나 합의된 설계 원칙을 위반하는
사례를 만들지 않는다. 오히려 직전 라운드(consistency `09_13_39`, 코드 리뷰 `09_27_04`)가 잡은
V056/V106 혼동·제목-본문 모호성이 최종본에서 정확히 해소돼 있고, `mixed=true`·bare 인용 8건 같은
새 선택지는 즉시 결정하지 않고 트래커에 명시적으로 등재해 "한 PR 이 단독으로 정하지 않는다"는
원 원칙을 그대로 승계했다. 유일하게 남는 것은 `review-citations.md` 의 `code:` 필드가
spec-impl-evidence.md 의 "구현 경로" 정의를 벗어나 "준수 예시 파일"을 가리키는 재해석인데,
이는 이미 코드 리뷰가 인지하고 수용한 사안이며 가드 통과에도 영향이 없다 — 다만 그 정당화가
`## Rationale` 이 아니라 Overview 에 있어 향후 다른 conventions 문서가 이를 무비판적 선례로
차용할 위험이 남는다. 두 건 모두 INFO 수준이며 target 을 막을 이유는 없다.

## 위험도

LOW
