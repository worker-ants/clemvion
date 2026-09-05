# Rationale 연속성 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

## 검토 방법

scope 델타(2개 파일: `migrations.md` §5 3줄 추가, `review-citations.md` — 이번 라운드는 최신
커밋 `1b6ce5f8a`가 §3 재구성 + `## Rationale` 신설 항목 추가)와 딸린 코드 diff
(`codebase/backend/migrations/README.md` 54줄, "인덱스 교체는 DROP-먼저" 절 신설)를 관련
spec 의 기존 `## Rationale`/원칙과 대조했다.

- `spec/conventions/migrations.md` §3 Append-only·§7 폐기 대안(타임스탬프 prefix /
  `outOfOrder=true` / Merge Queue / branch protection) — 이번 diff 와 주제·전제 충돌 여부.
- `codebase/backend/migrations/README.md` §4·§5 — 신설 "DROP-먼저" 절이 §4
  (`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`)가 이미 닫은 실패 모드(hang)를 다시 여는지,
  별개 실패 모드(재실행 시 invalid 잔재)인지 재확인. 실제 `V056`/`V106`/`V110` 마이그레이션
  파일을 열어 README 표의 "선례" 서술과 line-level 대조.
- `spec/conventions/spec-impl-evidence.md` §2.1/R-1 (`code:` = "본 spec 이 약속한 surface 의
  구현 경로") — `review-citations.md` 의 `code:` "준수 예시" 용법과의 정합.
- `spec/conventions/swagger.md` §3 (JSDoc은 공개 OpenAPI 로 나가므로 내부 서사는 `//` 주석에)
  — `review-citations.md` §3 신설 "DTO·컨트롤러 JSDoc" 행과의 방향 일치 여부. 실제 DTO/컨트롤러
  소스에 리뷰 인용이 JSDoc 안에 새어 들어간 사례가 있는지 grep 으로 실증.
- `.claude/docs/plan-lifecycle.md` — `review-citations.md` §3 "`review/**` 는 시점 기록이라
  사후 편집 안 함" 인용의 원문 대조.
- 직전 라운드 산출물 `review/consistency/2026/09/05/09_53_09/rationale_continuity.md` (동일
  target 의 이전 형태에 대한 검토, INFO 2건: code: 용법 근거 위치 / plan-lifecycle 출처 미인용)
  — 그 INFO 가 후속 커밋 `1b6ce5f8a`("--impl-done 09_53_09 BLOCK:NO · WARNING 1 + INFO 4 전부
  조치")에서 실제로 반영됐는지 diff 로 재확인.
- `review/code/2026/09/05/00_06_38`, `09_27_04` — `review-citations.md` 가 인용하는 과거 논의
  (PR 번호 전환 미채택, `plan/**` 제외 근거)의 원문 대조.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — README 가 "별도 결정 항목"
  으로 미룬 `mixed=true` 도입, "8건 해소 불가 bare 인용" 이 실제로 등재됐는지.
- `spec/1-data-model.md:977` — 별도로 병행 수정된 Rationale 출처 정정(`#1284`→`#1277`)이 이번
  target 과 얽혀 있는지, 정정 자체가 실제 이력과 일치하는지(`git log`/`merge-base`).

## 발견사항

(없음 — CRITICAL/WARNING/INFO 모두 신규 발견 없음)

## 확인했으나 문제 없음으로 판정한 항목

- **직전 라운드 INFO#1 해소 확인** — `review-citations.md` 의 `code:` "준수 예시" 용법 근거가
  Overview 인용구에서 `## Rationale`(`### code: 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는
  이유`)로 이동했고, **기각한 대안**(`codebase/backend/src/**` 같은 넓은 트리 글롭)도 함께
  적혔다 — CLAUDE.md `## Rationale` = 결정 근거 SoT 원칙과 이제 정합. `spec-impl-evidence.md`
  §2.1/R-1 의 "구현 경로" 정의를 벗어나는 재해석이라는 사실 자체는 남지만, 로컬 문서 자신의
  `## Rationale` 에 명시적으로 정당화하는 패턴은 `swagger.md` §1-4 의 기존 예외 관례("이 예외를
  쓸 때는 해당 DTO 의 `## Rationale` 에 명시")와 동일한 구조라 선례 이탈이 아니다.
- **직전 라운드 INFO#2 해소 확인** — `review/**` 산출물이 "시점 기록이라 사후 편집 대상 아님"
  이라는 §3 셀 주장에 `.claude/docs/plan-lifecycle.md` 링크가 추가됐다. 원문(`plan-lifecycle.md`
  의 "review/** 같은 시점 기록 문서는 옛 경로 유지")과 대조해 인용이 정확하다.
- **신설 §3 "DTO·컨트롤러 JSDoc 은 대상 아님" 행 — swagger.md 와의 방향 일치**: swagger.md §3
  "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사는 `//` 주석에" 원칙과 정확히 같은 분리를 반대
  방향(review-citations 관점)에서 재확인한 것으로, 두 규약이 동일한 결론을 공유하고 서로를
  명시적으로 cross-link 한다 — 개정 커밋 메시지("같은 날 쓴 두 규약이 서로를 모르고 있었다")가
  주장하는 W1 조치와 diff 가 일치. 실제 코드도 DTO/컨트롤러 JSDoc 안에 리뷰 인용이 새어 들어간
  사례는 0건(grep 실증) — "실제 위반 사례는 없지만" 이라는 본문 주장과 일치.
- **§3 확대(scripts/**, .github/** 추가) 수치 실증**: 본문의 "인용 8건 중 6건이 bare" 를
  `scripts/`·`.github/` 전수 grep 으로 재현 — bare 6건(`08_25_10`·`13_00_33`×2·`19_26_54`·
  `14_02_49`·`00_59_56`) + 전체 경로 2건(`review/code/2026/07/14/08_25_10`×2) = 8건, 수치
  일치.
- **README "인덱스 교체는 DROP-먼저" 신설과 §4 의 관계**: 원문이 스스로 "근본 원인은 §4 로
  해결되어 있다"고 먼저 밝힌 뒤 그럼에도 유지하는 별개 이유(재실행 시 invalid 잔재로 인덱스
  0개화)를 나열해, §4 Rationale 을 뒤집지 않고 별개 실패 모드를 다룬다. `V056`/`V106`/`V110`
  세 파일을 직접 열어 대조한 결과 README 표의 "선례" 서술(V056=CREATE+DROP 진짜 교체,
  V106=CREATE 만·신규 추가)이 실물과 일치.
- **"`CREATE INDEX CONCURRENTLY` 정확히 한 개" 컨벤션과의 병치**: 신설 문장이 "제한 대상은
  `CREATE` 의 개수"라고 명시적으로 좁혀 기존 컨벤션과 충돌하지 않는다.
- **append-only 원칙과의 관계**: DROP-먼저 패턴은 신규 작성 마이그레이션 지침이고, README 가
  "이미 성공한 마이그레이션은 append-only 라 소급 수정 대상 아니다"를 명시해 `migrations.md`
  §3 을 우회하지 않는다. V056/V106 은 소급 수정 대상이 아니라고 명시.
- **`mixed=true` 별도 결정 항목 / 8건 bare 인용 등재**: `plan/in-progress/spec-draft-nullable-notation-followups.md:457,463-466`
  에 각각 "planner + 인프라, 2026-09-05 등재" / "developer, 2026-09-05 등재"로 실제 등재돼 있어
  "한 PR 이 단독으로 결정하지 않는다"는 원칙을 그대로 승계 — 결정의 무근거 번복 아님.
- **"PR 번호로 전환하지 않는다" 결정**: `review/code/2026/09/05/00_06_38` 는 권고만 남겼을 뿐
  정식 채택 결정이 아니었고, target 은 실측(107파일·514회, bare 8건 해소 불가)을 근거로 답하며
  새 `## Rationale`("왜 PR 번호로 전환하지 않았나")을 작성했다 — 번복이 아니라 최초 결정.
- **병행 수정 `spec/1-data-model.md:977` `#1284`→`#1277` 정정**: `git log`/`merge-base` 로 재확인
  결과 실제 이력과 일치(`#1277` 등재, `#1278`/`#1280` 갱신 언급 유지) — 이번 target scope 밖의
  독립 수정이지만 그 자체가 Rationale 출처를 지어낸 것이 아님을 확인.

## 요약

두 target 문서(`migrations.md` §5 증분, `review-citations.md` 신설 + 최신 개정)는 관련 spec/
README 의 `## Rationale` 과 대조했을 때 기각된 대안을 이유 없이 되살리거나 합의된 설계 원칙을
위반하는 사례를 만들지 않는다. 특히 직전 라운드(`consistency 09_53_09`)가 낸 두 건의 INFO —
`code:` 재해석 근거의 위치(Overview→Rationale), `review/**` 불변경 관례의 출처 미인용 — 는
후속 커밋(`1b6ce5f8a`)에서 정확히, 근거를 지어내지 않고(원문 대조로 확인) 반영됐다. 새로
등장한 §3 "DTO/컨트롤러 JSDoc 제외" 행도 `swagger.md` §3 과 방향이 일치하고 실제 위반 사례
부재를 grep 으로 재확인했다. `mixed=true`·bare 인용 8건 같은 미결 항목은 즉시 결정하지 않고
트래커에 명시적으로 등재해 "한 PR 이 단독으로 정하지 않는다"는 기존 관행을 그대로 승계한다.
Rationale 연속성 관점에서 이번 라운드가 새로 지적할 사항은 없다.

## 위험도

NONE
