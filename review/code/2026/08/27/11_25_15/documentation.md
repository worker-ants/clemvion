# 문서화(Documentation) 리뷰 — masking-residuals-0b195b (`10_53_52` CRITICAL fix + 산출물 커밋)

## 검토 범위

이번 diff(`origin/main` 대비 36개 파일)는 (a) `10_53_52` 라운드가 지적한 CRITICAL(포함관계
캐너리가 실제로는 `DEFAULT_SENSITIVE_KEYS` 에서 파생되지 않음)을 고치는 커밋
(`fa6e2294c`) + 그 이전 라운드들의 코드 변경(`348c2b3ca`, `57fb83592`, `126609555`) 전체를
diff base 로 잡고 있고, (b) `review/code/2026/08/27/10_53_52/**` 와
`review/consistency/2026/08/24/19_26_06/**` 산출물 파일 19개를 신규 커밋하는 것이다. 문서
관점에서는 실제 소스 6개 파일(CHANGELOG, mask-sensitive-fields.util.{ts,spec.ts},
handler-output.adapter.{ts,spec.ts}, ai-turn-executor.ts)과 spec 6개(spec_impact) +
plan 2개를 실제 파일(`Read`/`grep`)로 대조했다. `review/**` 산출물 19개는 과거 리뷰의
읽기 전용 기록물이라 재검토 대상에서 제외했다(이미 산출된 시점의 진술이며, 이 문서 리뷰가
그 내용의 정오를 다시 판정할 것은 아님).

## 발견사항

- **[WARNING]** `spec/conventions/node-output.md` 에 이번 PR이 없앤 "boundary masking" 을
  여전히 근거로 인용하는 stale 문장이 **1곳 남아 있다** — 같은 파일 안에서 자기모순
  - 위치: `spec/conventions/node-output.md:256` (게이트 없음 — 이번 diff 가 건드리지 않은
    줄. `grep -n` 으로 현재 파일에서 직접 확인)
  - 상세: 256번째 줄은 지금도 "`_retryState` 포함 필드: … credential 제거 정책은
    `_resumeState` 와 동일 (**`maskSensitiveFields` 가 boundary 에서 strip**)." 이라고
    서술한다. 그런데 정확히 이 PR(커밋 `348c2b3ca`)이 그 boundary(`handler-output.adapter.ts`
    의 `maskSensitiveFields(r.config)` 호출)를 제거했고, 같은 파일의 새로 추가된 블록
    (diff 상 게이트 339~350행, "마스킹은 egress 에서만 한다 — 표현식은 원문을 읽는다")이
    바로 몇 줄 아래에서 그 사실을 명시적으로 서술한다 — 즉 **한 파일 안에서 서로 다른 두
    문장이 상반된 메커니즘을 주장**한다.
    `review/code/2026/08/27/10_53_52/RESOLUTION.md`(WARNING 5, "미러 스윕이 또 4곳을
    놓쳤다")는 `ai-turn-executor.ts` 2곳 · `node-output.md` · `4-execution-engine.md`
    네 곳을 지목하고 "네 곳 모두 … 정정했다" 고 적었고, 이번 PR 의 plan 체크리스트도
    `plan/in-progress/masking-expression-egress-split.md:124`에서 "`10_53_52` 로 stale
    인용 4곳 추가 정정" 이라 못박는다. `git diff origin/main`으로 실측한 결과
    `ai-turn-executor.ts`(:3281, :3356)와 `spec/5-system/4-execution-engine.md`(:203)는
    실제로 취소선+정정 처리됐지만, `node-output.md` 쪽 diff 는 336~351행 구간에 **완전히
    새로운 블록을 추가**했을 뿐 기존 256행을 전혀 건드리지 않았다 — "네 곳 모두 정정했다"
    라는 완결성 주장이 이 파일에 대해서는 **사실과 다르다**. 이 저장소가 반복적으로 겪어 온
    "미러 스윕이 몇 곳을 놓친다" 실패 클래스가, 그 실패를 고쳤다고 선언한 바로 그 커밋에서
    다시 한 번 재발한 사례다.
  - 제안: 256행의 "`maskSensitiveFields` 가 boundary 에서 strip" 을 다른 4곳과 동일한 톤
    (취소선 + "→ egress 마스킹, 2026-08-24 정정" 또는 "allow-list 로 애초에 배제")으로
    정정한다. 아울러 RESOLUTION.md/plan 의 "네 곳 모두"/"4곳 추가 정정" 서술은 이미 병합된
    과거 산출물이라 소급 수정은 불필요하지만, 이번 라운드(`11_25_15`)에서 이 잔여를 후속
    커밋으로 닫아 실제로 "네 곳"을 완성시킬 것을 권한다.

- **[INFO]** 취소선 정정이 남긴 문법적으로 끊어진 문장 (기능 영향 없음, 이전 라운드가 이미
  지적했으나 미수정 상태로 남아 있음)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` — `Read`로 확인한
    실제 줄 번호 26~28 (`DEFAULT_SENSITIVE_KEYS` 배열 내 인라인 주석, "blast radius 를
    실측했다" 문단)
  - 상세: 원래 한 문장("이 상수는 `handler-output.adapter.ts` 도 쓰고 … DB·WS·표현식으로
    **내보낸다** — 비-자격증명 config 필드가 …")의 앞부분만 취소선 처리하고 새 문장
    ("**2026-08-24 에 그 소비처가 사라졌다** … 표현식은 원문을 읽는다.")을 끼워 넣었는데,
    원래 문장 뒤쪽 절("내보낸다 — 비-자격증명 config 필드가 이 이름들과 겹치면 멀쩡한 값이
    가려진다.")이 주어 없이 그대로 남아, "…표현식은 원문을 읽는다. 내보낸다 — 비-자격증명
    config 필드가 …" 로 이어져 문법이 깨진다. `review/code/2026/08/27/10_53_52/requirement.md`
    가 같은 문제를 INFO로 이미 지적했는데(`10_53_52` 라운드), 그 이후 커밋(`fa6e2294c`)에서도
    고쳐지지 않고 그대로 남아 있다.
  - 제안: 남는 절을 `DEFAULT_SENSITIVE_KEYS` 의 잔여 소비처(`explore-tools.service.ts`)를
    주어로 명시적으로 다시 연결하거나("그 유일한 남은 소비처가 DB·WS·표현식으로 내보낸다"
    등), 원 문장 전체를 취소선 처리해 잔여 절이 붕 뜨지 않게 정리한다.

## 잘된 점 (참고)

- `CHANGELOG.md` 에 이 PR 의 운영 영향(config 가 DB 에 원문으로 저장됨)과 안전성이 두
  마스커의 키-집합 포함관계에 의존한다는 점을 명시한 항목이 추가됐다 — `10_53_52` 라운드가
  지적한 WARNING("이 클래스 변경마다 남겨 온 CHANGELOG 관례에 이번만 빠졌다")이 해소됐다.
- `plan/in-progress/masking-expression-egress-split.md` 의 체크리스트는 이번 라운드에서
  전 항목이 실제 상태와 일치하도록 갱신돼 있다(`/ai-review` 만 미체크, 정확).
- `spec/4-nodes/3-ai/1-ai-agent.md` 는 같은 클래스의 stale 인용 4곳(§7.9 config echo 정책·
  `_resumeCheckpoint`/`_retryState` 표·`_retryState` top-level 필드·`requestPayload` 노트)을
  전부 취소선+정정 패턴으로 일관되게 처리했다 — `node-output.md` 만 예외로 남았다.
- `mask-sensitive-fields.util.ts`/`mask-sensitive-fields.util.spec.ts` 의 export·캐너리
  재작성에 붙은 JSDoc 은 "왜 export 했는지·초판이 어떻게 틀렸는지·그 반증이 어떻게
  이뤄졌는지"를 상세히 서술해 코드 자체가 자기 이력을 설명한다.

## 요약

핵심 안전 서사(포함관계 캐너리 재작성·`handler-output.adapter.ts` 마스킹 제거·egress 대조군
캐너리)를 뒷받침하는 문서 갱신은 CHANGELOG·plan 체크리스트·spec 6개 대부분에서 정확하고
일관되게 반영됐다. 다만 이 PR(및 선행 라운드)이 "boundary 참조 4곳을 전부 정정했다" 고
`RESOLUTION.md`·plan 양쪽에서 선언한 것과 달리, `spec/conventions/node-output.md:256` 은
같은 파일 안에서 새로 추가된 블록과 정면으로 모순되는 stale 문장을 그대로 남기고 있다 —
이 리뷰 체인이 반복해 겪어 온 "미러 스윕이 몇 곳을 놓친다" 클래스가, 그것을 닫았다고
주장하는 바로 그 커밋에서 재발한 사례다. 기능·보안 회귀는 아니지만(credential 배제 자체는
allow-list 로 별도 보장됨), 다음 독자가 "boundary strip 이 아직 있다" 고 오독할 수 있는
문서 신뢰성 문제로 남긴다. 부수적으로 `mask-sensitive-fields.util.ts` 의 취소선 정정이
남긴 문법적으로 끊어진 문장(이전 라운드가 이미 지적, 아직 미수정)도 함께 정리 대상이다.

## 위험도

MEDIUM
