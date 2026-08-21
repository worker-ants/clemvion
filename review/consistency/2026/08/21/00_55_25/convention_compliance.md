# 정식 규약 준수 검토 — `plan/in-progress/spec-update-masked-reject-framing.md`

## 검토 방식

target 은 `spec/` 본문이 아니라 `plan/in-progress/` 의 **정정 지시 plan** 이다(spec_impact 로 3개
spec 파일을 가리키는 draft). 따라서 다음 두 축으로 나눠 봤다:

1. target 문서 자체(frontmatter·구조)가 `.claude/docs/plan-lifecycle.md` 의 plan frontmatter
   스키마·Gate C 를 지키는가.
2. target 이 인용·제안하는 spec 정정 문구가 `spec/conventions/error-codes.md` (명명·표기 규약)
   등 정식 규약과 어긋나지 않는가.

bundle 된 `spec/conventions/**` 파일 중 `node-cancellation.md`·`secret-store.md` 만 본문이
실렸고 나머지(특히 이 target 과 가장 관련 있는 `error-codes.md`)는 컨텍스트 예산 초과로
절단돼 있었다(alert 로 명시됨) — 저장소의 실제 `spec/conventions/error-codes.md` 를 직접 읽어
대체했다. 아울러 target 이 참조하는 3개 spec 파일의 현재 본문, 관련 코드
(`reject-masked-resubmission.ts`), `spec/5-system/14-external-interaction-api.md` §R17,
`CHANGELOG.md`, 그리고 §W3 이 언급하는 커밋 `50f799efd` 의 실제 diff 를 대조해 target 의 인용이
사실과 일치하는지 확인했다 — 전부 일치했다(§6 "직후" 서술, `3-error-handling.md:193` /
`12-webhook.md:312` 의 "재제출 경로 한정" 서술, §R17 의 "Manual 실행 경로 전체다" 캐비엇, 코드
docstring 의 "저작 주체" 문구, CHANGELOG 의 동일 프레이밍 모두 target 인용과 정확히 부합).

## 발견사항

- **[WARNING] frontmatter `spec_impact` 가 본문이 명시적으로 편입한 4번째 파일을 빠뜨렸다**
  - target 위치: frontmatter `spec_impact:` 목록 (L8-11) vs 본문 "⚠️ 절차 위반을 먼저 적는다 (W3)"
    절 (L41-55)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4/§5` Gate C — "완료 plan 은 spec 정합 결정을
    frontmatter 에 명시", 자가 점검 체크리스트 "frontmatter 에 `spec_impact` 가 선언됐는가"
  - 상세: frontmatter `spec_impact` 는 `1-manual-trigger.md` / `3-error-handling.md` /
    `12-webhook.md` 3개만 나열한다. 그러나 본문 §W3 는 developer 커밋 `50f799efd` 가 이미 고친
    `spec/5-system/14-external-interaction-api.md` 표 행(§R17)을 "이 문서의 승인 범위 안에
    명시적으로 편입한다" 고 **명시**한다 — `git show 50f799efd -- spec/5-system/14-external-interaction-api.md`
    로 확인하면 실제로 그 커밋이 이 파일의 §R17 표 행 라벨(`서버 (재제출 API)` →
    `서버 (Manual 실행 경로)`)을 고쳤다. 즉 본문이 선언한 승인 스코프가 frontmatter 선언보다
    넓다 — 두 선언이 어긋난 상태로 완료(`complete/`) 이동 시점에 도달하면 Gate C 판정(빌드
    가드 `spec-plan-completion.test.ts`)이 이 plan 이 실제로 다룬 spec 파일 하나를 누락한 채
    통과하게 된다.
  - 제안: `spec_impact` 목록에 `spec/5-system/14-external-interaction-api.md` 를 추가한다(지금
    당장은 Gate C 가 in-progress 단계에서 강제되지 않지만, 이 문서 자신이 §정정 2 에서 "자매
    발산이 반복된다 ... 그 문구를 쓴 자리를 grep 으로 전수로 세는 게 유일하게 통한 방법" 이라고
    스스로 진단한 실패 패턴과 정확히 같은 모양이다 — 본문 스코프 선언과 frontmatter 선언이
    서로 다른 세 곳 문제를 지금 겪고 있다).

- **[INFO] 정정 대상 위치를 절대 라인 번호로 고정**
  - target 위치: "정정 2" 절 "`3-error-handling.md:193` 과 `12-webhook.md:312`" (L53)
  - 위반 규약: 없음 (정식 규약 미비 — 참고용 제안)
  - 상세: 두 라인 번호는 검토 시점(2026-08-21) 기준 현재 spec 본문과 정확히 일치한다(직접
    대조 완료). 다만 라인 번호 고정 참조는 이 draft 가 실행되기 전 다른 편집이 두 파일에
    들어오면 조용히 stale 해진다 — 이 저장소 관례(`spec/` 상호 참조)는 대개 `#anchor` 앵커나
    절 제목으로 위치를 고정한다.
  - 제안: 급하지 않으나, 실제 편집 시점에 라인 번호 대신 절 제목(예: "`MASKED_VALUE_RESUBMITTED`
    범위 캐비엇 문단")으로 재확인 후 진행 권장. target 자체를 지금 고칠 필요는 없다.

## 그 외 확인했으나 위반 없음

- frontmatter 필수 3필드(`worktree`/`started`/`owner`) 모두 존재, `worktree` 값은 실제 작업
  중인 worktree 디렉토리명과 일치, `started` 는 오늘 날짜(2026-08-21)와 일치.
- `spec_impact` 는 (누락 1건을 빼면) 리스트 형식으로 올바르게 선언 — bare string·빈 배열
  실패형 아님 (`spec/conventions/spec-impl-evidence.md` / Gate C 스키마 준수).
- 문서 구조는 spec 문서 전용 "Overview/본문/Rationale" 3섹션 강제 대상은 아니지만(대상은
  `spec/<영역>/*.md`), 자발적으로 말미에 `## Rationale` 을 두어 그 정신을 따르고 있다 — 위반
  아님, 오히려 부합.
- target 이 제안하는 spec 문구 정정(§6 시점 표기 "전후", 두 자매 문서의 "Manual 실행 경로
  한정(저작 주체 기준)")은 `spec/conventions/error-codes.md` 의 명명·표기 규약(§1 의미 기반
  명명, 내부 `lower_snake_case` reason ↔ 응답 `UPPER_SNAKE_CASE` field code 이원 표기)과 충돌하지
  않는다 — 새 코드를 신설하거나 기존 코드를 rename 하는 제안이 아니라 **시점·범위 서술**만
  교정하므로 §2 rename 안정성 정책의 적용 대상도 아니다.
- API 문서(OpenAPI/Swagger 데코레이터·DTO 명명) 규약과는 무관한 대상 — target 이 건드리는
  변경은 파라미터 검증 reason 서술·범위 캐비엇 뿐이며 신규 API 표면·DTO 를 도입하지 않는다.
- §W3 가 스스로 지적한 절차 위반(`developer` 가 `spec/` 을 직접 수정)은 CLAUDE.md skill
  권한표를 정확히 인용하고 있고, 이 draft 자체가 그 위반을 사후 정규 경로로 바로잡는
  행위이므로 이 draft 의 존재 자체는 위반이 아니라 위반의 교정이다.

## 요약

target plan 이 인용하는 spec 현재 문구·코드 docstring·CHANGELOG·§R17 캐비엇은 실측과 전부
일치하며, 제안된 정정 문구도 `error-codes.md` 명명 규약과 충돌하지 않는다. 유일한 실질
발견은 frontmatter `spec_impact` 가 본문이 명시적으로 선언한 승인 스코프(4번째 파일,
`14-external-interaction-api.md`)를 누락하고 있다는 점이다 — 지금은 Gate C 가 in-progress
단계라 빌드를 막지 않지만, 이 문서 자신이 반복 지적하는 "자매 발산" 패턴과 형태가 같아 완료
이동 전에 반드시 정정해야 한다. 그 외에는 문서 구조·프론트매터 스키마·명명 규약 모두 준수
상태다.

## 위험도

LOW
