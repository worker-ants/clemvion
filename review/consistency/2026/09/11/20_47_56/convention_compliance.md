# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-binder-drift.md`

## 검토 범위·방법

`spec/conventions/**` 정식 규약 대비 target draft 를 검토했다. 프롬프트 예산 초과로
`spec/conventions/secret-store.md`·`chat-channel-adapter.md`·`spec-impl-evidence.md`·
`review-citations.md` 4개는 직접 `Read` 했다. 아울러 target 이 스스로 "정본 매처로 검증했다"고
주장하는 수치(`code:` glob 매칭 수·wildcard 상한)는 `.claude/hooks/_lib/review_guard.py` 의
`_glob_to_regex`/`_MAX_GLOB_WILDCARDS` 를 직접 실행해 재현했고, 인용된 코드 심볼
(`setupChatChannel`·`teardownChatChannel`·`assertInboundSigningPlaintextByProvider` 의 소재,
`TriggersService.update()`/`remove()` 잔류 등)은 실제 소스로 대조했다. **결론: glob 매칭 수(10/27/2),
wildcard 상한(6), 이동 후 심볼 소재, 인용된 spec 원문(secret-store.md/chat-channel-adapter.md/
data-flow/14-chat-channel.md/providers 3종/15-chat-channel.md §7·frontmatter) 은 전부 현재
저장소 상태와 정확히 일치했다** — 이 draft 는 이례적으로 실측 기반이 견고하다. 아래 두 건만
정식 규약(특히 `spec-impl-evidence.md`) 인용·수치의 정확성 문제로 남는다.

## 발견사항

- **[WARNING] `spec-impl-evidence.md` R-1 인용이 가리키는 절이 실제 인용문 위치와 다르다**
  - target 위치: `## Rationale (spec 본문에 실을 근거)` 단락, "**상위 원칙은 이미 있다**" 문단
    (`[spec-impl-evidence.md R-1](../conventions/spec-impl-evidence.md#r-1-code-글로브-허용-vs-명시-파일만)`
    앵커 뒤 "바로 그 절에서 … 못박고 있다" 부분)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` 의 섹션 구조 (`## 2. Frontmatter 스키마`
    → `### 2.1 필드 정의` vs `## Rationale` → `### R-1`)
  - 상세: target 은 *"글로브 허용을 채택"* 문구는 R-1(`### R-1. code: 글로브 허용 vs 명시 파일만`,
    199~203행)에서 정확히 인용했지만, 바로 이어 *"바로 그 절에서"* 못박았다고 인용하는 문장 —
    *"넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다"* — 는 **R-1
    절(199~203행)에 없다.** 그 문장은 실제로는 완전히 다른 섹션인 `### 2.1 필드 정의`(75~84행)
    의 `code` 필드 정의 표 셀 끝부분(81행)에 있다 — `review-citations.md` 의 Rationale
    ("기각한 대안" 문단, 150~152행)에서 가져와 §2.1 표에 인용해 둔 문장이다. 앵커
    (`#r-1-code-글로브-허용-vs-명시-파일만`)는 GitHub slug 규칙상 정확히 R-1 헤딩으로 착지하므로,
    이 문구를 그대로 `15-chat-channel.md` `## Rationale` `R-CC-22` 에 실으면 **"그 절에서 못박고
    있다"는 서술과 앵커가 가리키는 실제 절의 내용이 어긋난다** — 다음 사람이 링크를 눌러 R-1 절만
    읽으면 인용문을 찾지 못한다.
  - 제안: 인용 문구의 출처를 `### 2.1 필드 정의`(§2.1)로 정정하거나, 앵커를 유지하려면
    "R-1 이 글로브 허용을 채택하는 근거는 §2.1 필드 정의의 같은 논지(스코프 없는 glob 은
    아무것도 가리키지 않는다)와 맞닿아 있다" 처럼 **두 절 다 인용**하는 문장으로 바꾼다. 이
    저장소는 Rationale 인용 부정확을 반복적으로 critical 로 잡아 온 이력이 있으므로(예:
    `review-citations.md` 자신이 "지어내면 안 된다" 는 규율을 다룸), 실제 spec 반영 전 앵커별로
    절 본문을 다시 열어 대조할 것을 권한다.

- **[WARNING] "633개 중 528개가 `*` 없음" 수치가 정본 파서로 재현되지 않는다**
  - target 위치: 같은 `## Rationale` 단락, *"다음 사람이 '왜 여기만 glob 인가' … 를 묻기
    때문이다"* 문장의 괄호 안 수치 (`633개 중 528개가 * 없음`)
  - 위반 규약: 이 수치 자체가 `spec/conventions/spec-impl-evidence.md` R-1 의 "글로브는
    예외적으로만" 이라는 논지를 뒷받침하는 근거 데이터인데, 목 §① 이 보여준 "정본 매처로
    검증했다(추정이 아니라 실행)" 는 이 저장소의 확립된 실측 규율(예: `review-citations.md`
    의 여러 수치가 "실측 2026-09-05" 로 방법·시점을 명시)을 이 문장만 따르지 않는다 — 측정
    방법·시점이 전혀 적혀 있지 않다.
  - 상세: `review_guard._parse_frontmatter_code` (§① 이 스스로 "정본" 이라 부른 그 함수) 로
    `spec/**/*.md` 전체의 `code:` entry 를 직접 세면 **748개 중 607개가 `*` 없음** — target 이
    주장하는 633/528 과 전혀 재현되지 않는다. `status: implemented` 로만 필터링해도
    **595/484**로 여전히 어긋난다 (`cafe24-api-catalog`/`makeshop-api-catalog` 제외,
    `codebase/` 접두만, 개별 파일 단위 등 여러 계산법을 시도했으나 모두 633/528 에 도달하지
    못했다). 이 자체가 §① 의 나머지 수치(10/27/2, wildcard 6)가 전부 정확히 재현된 것과
    대비된다 — 같은 문단 안에서 한쪽은 실행으로 검증하고 한쪽은 짐작(혹은 오래된/다른 방법의
    스냅샷)을 썼을 가능성이 크다.
  - 제안: `R-CC-22` 로 spec 에 반영하기 전 이 수치를 `_parse_frontmatter_code` 로 재실행해
    갱신하거나, 재현되지 않으면 "다른 spec 은 대부분 명시 경로다(대략, 재현 방법 미기재)"
    처럼 정성적 표현으로 낮추거나 삭제한다. 근거 문장이 부정확한 채로 `## Rationale` 에
    들어가면, 이 저장소가 여러 차례 반복 지적해 온 "미측정/오측정 전제가 SoT 에 고정된다"
    패턴의 재발이 된다.

## 비대상으로 확인한 것 (오탐 방지용 기록)

- `code:` glob 3종(`chat-channel-*.ts` / `dto/chat-channel-*.dto.ts` / `trigger-callback-url*.ts`)
  — `_glob_to_regex` 로 직접 컴파일해 대조. **10개 매칭 = 의도한 집합과 차집합 0**,
  `modules/triggers/**` 는 **27개**(실제 디렉터리 파일 수와 일치) — target 의 "채택/기각" 표는
  정확하다.
  - 와일드카드 개수: 각 glob 1개, 가드 상한 `_MAX_GLOB_WILDCARDS = 6` 대비 정확히 인용됨.
- 이동 후 심볼 소재: `setupChatChannel`/`teardownChatChannel` → `ChatChannelBinderService`
  (공개 메서드), `assertInboundSigningPlaintextByProvider` → `chat-channel-input-rules.ts`
  module-level 함수, `rotateBotToken`/`cleanupRotatedChatChannelTokens`/`update()`/`remove()`
  → `TriggersService` 잔류 — 전부 실제 소스와 일치.
- 편집 대상 "verbatim 원문" 6개 블록(ⓐ~ⓘ, `secret-store.md`·`chat-channel-adapter.md`·
  `data-flow/14-chat-channel.md` §0/§1.3·`15-chat-channel.md` frontmatter/§7·providers
  3종) 을 각각 현재 파일과 바이트 단위로 대조 — 전부 정확히 일치. draft 가 stale 하지 않다.
  discord.md:76 에도 `assertInboundSigningPlaintextByProvider` 가 접두 없이 등장하는데, target
  이 스스로 "접두 없이 함수명만 쓰는 9곳 은 이동 후에도 참" 이라 분류한 것과 일치하므로 누락이
  아니다.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 관련 트래커 항목 3건(2335행
  "`setupChatChannel` 귀속 표기 3곳" · 2210행대 "code: 6→8개" · (e)(f) 의 근거가 된 W2 지적)도
  실재하고 미해소(`[ ]`) 상태 — target 이 종결하려는 항목이 실재한다.
  `20_33_26` 세션 SUMMARY 대조 결과 target 의 체크리스트 인용("BLOCK: NO · CRITICAL 0 ·
  WARNING 3")도 정확했고, 그 라운드가 지적한 세 WARNING(스코프 3→7·§1.3 헤더 상충·경로 축약)은
  현재 draft 본문에 모두 반영돼 있다.
- `worktree:` frontmatter 가 `.claude/worktrees/<name>` 전체 경로 형태인 것은 `plan-lifecycle.md`
  예시(bare basename)와 다르지만, `plan/complete/**` 다수 선례가 같은 전체-경로 형태를 쓰고
  `plan_guard.py` 가 명시적으로 이를 정규화(`.claude/worktrees/x` → `x`)해 처리하므로 위반
  아님.
- 문서 구조(Overview/본문/Rationale), `pending_plans`/`spec_impact` 스키마, review 세션 인용
  형식(`review-citations.md` §2 "전체 경로" 권장 형태 준수), Rationale ID 결번 확인
  (`R-CC-14` 결번·`R-CC-21` 최대, grep 으로 재확인) — 전부 규약대로다.

## 요약

이 draft 는 `code:` glob 전환·§7 열거·귀속 정정이라는 세 축 모두에서 이례적으로 높은 실측
정확도를 보인다 — glob 매칭 수·wildcard 상한·이동 후 심볼 소재·인용된 spec 원문 6블록이 전부
현재 저장소와 정확히 일치했고, 직전 `--spec` 라운드(`20_33_26`)가 지적한 세 WARNING 도 이미
반영됐다. 다만 새로 추가하는 `## Rationale` `R-CC-22` 초안 안에 (1) `spec-impl-evidence.md` R-1
인용이 실제로는 다른 절(§2.1)의 문장을 그 절에서 나온 것처럼 못박고 있는 점, (2) "633개 중
528개" 수치가 그 절이 정본이라 부르는 파서로 재현되지 않는 점 — 두 건의 인용/수치 정확성
문제가 남아 있다. 둘 다 spec 반영 직전에 원문 대조·재계산으로 쉽게 고칠 수 있는 수준이며,
gate 를 깨는 CRITICAL 은 아니다.

## 위험도
LOW
