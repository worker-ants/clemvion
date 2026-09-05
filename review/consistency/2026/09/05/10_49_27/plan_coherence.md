# Plan 정합성 검토 — `spec/conventions/` (impl-done)

## 검토 범위

- target 델타: `spec/conventions/migrations.md`(§3·§4 소폭 수정) · `spec/conventions/review-citations.md`(신규) · `spec/conventions/spec-impl-evidence.md`(§2.1 `code:` 필드에 각주 1줄)
- 구현 diff: `codebase/backend/migrations/README.md` (§5 "인덱스 교체는 DROP-먼저" 패턴 신설, 39+/3-)
- 대조한 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md`(이 세션에서 함께 갱신됨), `plan/complete/spec-draft-migration-rerun-and-citations.md`(이 세션에서 신설·종결된 planner 턴 산출물)

이 두 plan 파일은 이번 diff 에 포함된(`origin/main` 대비 신규) 문서이고, target 인 `spec/conventions/` 3파일의 변경 근거를 직접 담고 있어 1차 대조 대상으로 삼았다. `harness-review-gate-followups.md` §"신규 가드를 `spec-impl-evidence.md §4.2` SoT 에 등재" 항목도 `spec-impl-evidence.md` 를 언급하지만 대상은 `stray-tool-tags.test.ts` 가드 등재이고 이번 diff 가 건드리는 `code:` 필드 각주와는 무관해 대조에서 제외했다.

## 발견사항

- **[INFO]** `spec_impact` 가 실제 변경 파일보다 좁다
  - target 위치: (target 자체 아님) `plan/complete/spec-draft-migration-rerun-and-citations.md` frontmatter `spec_impact:` (2줄 — `migrations.md`, `review-citations.md`)
  - 관련 plan: 같은 문서 §2.3 및 `review-citations.md` 의 Rationale(`"### code: 가 ... 이유"`) — "이 예외는 `spec-impl-evidence.md §2.1 code:` 필드 정의에도 각주로 등재했다 — 한쪽만 재해석하면 SoT 가 그 사실을 모른다"
  - 상세: 이 planner 턴이 실제로 건드린 spec 파일은 3개(`migrations.md`, `review-citations.md`, `spec-impl-evidence.md`)인데, 그 턴을 기록한 완료 plan 의 `spec_impact` 목록에는 `spec-impl-evidence.md` 가 빠져 있다. §2.3 은 오히려 "`spec-impl-evidence.md` 는 frontmatter 증거 전용이라 이 규약이 들어갈 자리가 아니다" 라고 명시적으로 배제하는데, 실제로는 그 문서의 `code:` 필드 정의 자체를 각주로 수정했다 — 완료 기록과 실제 diff 가 어긋난다.
  - 제안: `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 `spec_impact` 에 `spec/conventions/spec-impl-evidence.md` 추가 (archived 문서라도 사후 1줄 정정은 허용 범위).

- **[INFO]** 후속 항목의 절 번호 인용이 실제 문서와 어긋난다
  - target 위치: `spec/conventions/review-citations.md` §4 "기존 인용은 소급 정리 대상이 아니다" (실제 문서 구조: §1 유지·§2 날짜·§3 적용 범위·§4 소급 정리 안 함)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — "해소 불가 bare 인용 8건 채우기" 항목, "그래서 **§3** 의 '소급 정리 안 함' 과 별개로 이 8건만 따로 둔다"
  - 상세: 이 열린 후속 항목이 가리키는 "소급 정리 안 함" 조항은 실제로는 `review-citations.md` **§4** 다(§3 은 "적용 범위" 절). 이 항목을 나중에 집는 사람이 §3 을 열어 보면 엉뚱한 절을 읽게 된다 — target 신설 당시 절 순서가 확정되기 전에 쓰인 참조가 갱신되지 않은 것으로 보인다.
  - 제안: 해당 plan 항목의 "§3" 을 "§4" 로 정정.

## 정합성이 확인된 지점 (참고)

- target 은 미해결 결정을 우회하지 않았다 — README.md/§5 는 `mixed=true` 전환이 필요한 (c)형(양쪽 위험 회피) 를 실측만 남기고 "도입 여부는 별도 결정 항목입니다" 라고 명시적으로 미룬다. 이는 `spec-draft-nullable-notation-followups.md` 의 신규 미해결 항목("Flyway `mixed=true` 도입 여부 — planner + 인프라")과 정확히 대응한다.
- `V110` 마이그레이션 헤더의 "정상 흐름에서는 발생하지 않는다" 문구는 README §5 정정 이후에도 append-only 원칙에 따라 그대로 남아 있고, 이 괴리는 같은 커밋에서 plan 에 별도 미해결 항목("`V110` 헤더의 … 서술")으로 등재됐다 — 후속 누락이 아니라 의도적 등재.
- 리뷰 인용 규약(성문화 vs PR 번호 전환)은 이전에 "한 PR 이 단독으로 정할 일이 아니다" 로 명시적으로 보류돼 있었는데, 이번 target 은 그 결정을 `owner: planner` 전용 세션(`spec-draft-migration-rerun-and-citations.md`)에서 내렸다 — 우회가 아니라 요구된 트랙을 통한 정상 해소.

## 요약

target(`spec/conventions/` 3파일 + `migrations/README.md`)은 plan 이 남겨둔 미해결 결정(Flyway `mixed=true`, `V110` 헤더 문구 처리)을 일방적으로 결정하지 않고 정확히 그 경계에서 멈췄으며, 리뷰 인용 규약처럼 "단독으로 정할 일이 아니다" 로 보류됐던 항목은 요구된 planner 전용 트랙을 거쳐 정상적으로 해소했다. 발견된 문제는 둘 다 실질적 결정 충돌이 아니라 이 세션이 만든 plan 문서 자체의 사소한 기록 정확도 이슈(spec_impact 누락, 절 번호 오기)다.

## 위험도

LOW
