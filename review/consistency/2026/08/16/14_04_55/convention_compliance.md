# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-error-masking-catalog.md`

## 발견사항

- **[CRITICAL] §6.4 캐비엇 추가문의 anchor 가 미완성 placeholder(`#r17-…`)**
  - target 위치: 변경안 `② §6.4 — 페이로드 절에 캐비엇 추가` 인용 블록 —
    `근거·범위·잔여 갭은 [§R17](#r17-…) 의 "종결 이벤트 error" 불릿.`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts`
    (build 차단 가드 — `spec/**.md` 본문의 `[..](#anchor)` 가 실제 렌더러(rehype-slug/github-slugger)
    heading slug 와 대조되어야 한다).
  - 상세: `#r17-…` 는 실제 heading slug 가 아니라 말줄임표(`…`)가 그대로 남은 draft placeholder다.
    실측 결과 `spec/5-system/14-external-interaction-api.md` 의 R17 heading
    (`### R17. getStatus 의 currentNode/context 실값 노출 …`) 의 실제 slug 는
    `#r17-getstatus-의-currentnodecontext-실값-노출-null-placeholder-부분-번복--sse-역할-분담--outputdata-표면-제약-결정-2026-06-25-conversationthread-reload-노출-재조정-2026-07-09`
    다(같은 문서 L698 에 이미 이 정확한 anchor 로 링크한 선례가 있다). 이 draft 블록을 **그대로**
    §6.4 에 반영하면, `spec-link-integrity.test.ts` 가 heading slug 불일치로 즉시 build 를 깨뜨린다 —
    developer 단계에서 처음 발견되면 되짚어야 하는 비용이 커진다.
  - 제안: spec 반영 시점에 `#r17-…` 를 위 실제 slug 로 교체하거나(선례 L698 형식), 혹은 다른 R17
    bullet 인용들처럼(L449, L836) plain-text `§R17` 참조로 낮춰 anchor 의존을 없앤다.

- **[WARNING] 신설 5번째 bullet 의 "내부 표면은 원문 유지" 근거 인용이 잘못된 bullet 을 가리킴**
  - target 위치: 변경안 `① §R17 — 5번째 불릿 신설` 마지막 하위 항목 —
    `**내부 REST 는 마스킹하지 않는다(비대칭 — 의도)**: … 위 ai_message 불릿이 문서화한 "내부 표면은
    원문 유지" 방향과 같은 판단이다.`
  - 위반 규약: `spec/conventions/conversation-thread.md` 가 소유한 **egress-only** 원칙
    (내부 소비처는 faithful 원문 유지, 외부 egress 만 마스킹) 및 그 원칙이 실제로 서술된 위치.
  - 상세: 실측(`spec/5-system/14-external-interaction-api.md` §R17)하면 "내부 소비처는 faithful
    텍스트를 유지한다" 문장은 `conversationThread` bullet 의 **egress-only** 하위 항목(L1427-1428)에
    있다. 반대로 인용 대상으로 지목된 `execution.ai_message` bullet(L1436-1440, "내부 WS·Chat Channel
    도 마스킹됨(수용된 trade-off)")은 **정반대** 주장 — 내부 WS/Chat Channel 도 마스킹된다고 명시한다.
    즉 draft 가 "원문 유지" 근거로 지목한 bullet 이 실제로는 "원문 유지 안 함" 을 말하는 bullet 이다.
    이 오귀속을 그대로 landing 하면, 본 draft 가 스스로 표방하는 목표("인벤토리에 없는 방어는
    없는 것과 같다" — Rationale) 와 반대로 잘못된 근거가 인벤토리에 고정된다.
  - 제안: 인용 대상을 `conversationThread` bullet 의 egress-only 하위 항목으로 정정한다
    (`위 conversationThread 불릿의 egress-only 판단과 같은 방향이다` 등). `ai_message` bullet 을
    인용하려면 그 bullet 이 실제로 뒷받침하는 주장("공유 emit 관문은 audience 분리 없이 전부
    마스킹된다")으로 바꿔야 한다 — 지금 문맥과는 반대 방향이라 그대로 쓸 수 없다.

- **[INFO] plan frontmatter 의 `pending_plans:` 필드명 재사용**
  - target 위치: frontmatter — `pending_plans: - plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 위반 규약: 없음(직접 위반 아님) — 참고: `spec/conventions/spec-impl-evidence.md` §2.1 은
    `pending_plans:` 를 **spec(`spec/**.md`) frontmatter 전용** 필드로 정의한다("미구현 surface 를
    책임지는 plan 경로"). `.claude/docs/plan-lifecycle.md` §4 는 plan frontmatter 에 `priority`/
    `status`/`title` 등 부가 필드를 허용하지만 `pending_plans:` 를 plan-대-plan cross-link 용도로
    쓰는 패턴은 명시돼 있지 않다.
  - 상세: 실제로는 이 저장소가 규약 위반이 아니다 — 형제 draft
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 가 동일 필드·동일 값을 이미
    같은 용도로 쓰고 있어(2개 draft 가 일관), 이 워크플로 내에서 사실상 굳어진 지역 관행이다. build
    가드(`plan-frontmatter.test.ts`)도 이 필드를 검증하지 않으므로 무해하다.
  - 제안(선택): 의미 충돌 방지를 위해 `related_plans:` 같은 plan-전용 키로 이름을 분리하는 편이
    "spec 의 `pending_plans:` = 구현 완료 책임" 의미와 "plan 의 관련 plan 인덱스" 의미를 혼동하지
    않게 한다 — 다만 이는 규약 갱신/명명 정리 제안이지 현재 위반은 아니다.

## 확인된 정합 항목 (참고)

- **문서 구조**: Overview → 본문(`핵심`/`변경안`/`범위 밖`) → `## Rationale` 3섹션 구성이
  `project-planner/SKILL.md` §Spec 문서 구조 권장과 일치.
- **파일 경로 명명**: `plan/in-progress/spec-draft-eia-error-masking-catalog.md` 는
  `project-planner/SKILL.md` L31·`consistency-checker/SKILL.md` L49/L138 이 규정한
  `plan/in-progress/spec-draft-<name>.md` 패턴과 일치.
- **frontmatter 필수 3필드**(`worktree`/`started`/`owner`): `.claude/docs/plan-lifecycle.md` §4 요건
  충족. `pending_plans:` 대상 경로(`spec-sync-external-interaction-api-gaps.md`)·`spec_impact:`
  대상 경로(`spec/5-system/14-external-interaction-api.md`) 모두 실존 확인.
- **§R17 bullet 명명 스타일**: 신설안 `**종결 이벤트 error (강제됨 — 2026-08-16)**:` 형식은 기존
  형제 bullet(`**conversationThread (강제됨)**:`, `**nodeOutput.conversationConfig + terminal
  result/error (강제됨 — bypass 차단)**:`)의 "`**필드 (강제 상태 [— 부가설명])**:`" 패턴을 그대로
  따른다.
- **egress-only 원칙 재사용**: `deepRedactSecrets`/`SECRET_LEAK_PATTERNS`/`shared/utils/
  terminal-error-payload.ts` 등 target 이 인용하는 식별자·파일 경로는 실제 코드
  (`codebase/backend/src/shared/utils/sanitize-error-message.ts`,
  `codebase/backend/src/shared/utils/terminal-error-payload.ts`)와 일치하고, "write-time redaction
  기각" 논리도 `conversation-thread.md`/§R17 이 이미 세운 egress-only 원칙과 같은 방향이라 새 예외를
  만들지 않는다. `error-codes.md` 의 "code 값 공간은 enum 으로 닫혀 있다" 전제와도 모순 없음.
- **API 문서 규약(swagger 데코레이터/DTO)**: target 은 DTO·controller·swagger 데코레이터를 전혀
  건드리지 않는 순수 spec 서술 변경이라 `spec/conventions/swagger.md` 관점은 해당 없음(N/A).

## 요약

target 은 project-planner 의 spec-draft 워크플로(파일명·3섹션 구조·frontmatter 필수 필드)를
정확히 따르고, 인용하는 코드 식별자·파일 경로·기존 egress-only 원칙도 실제 코드/spec 과 합치한다.
다만 두 군데 실질적 결함이 있다 — (1) §6.4 추가문에 남은 미완성 anchor placeholder(`#r17-…`)는
그대로 landing 되면 `spec-link-integrity` build 가드를 깨뜨리는 기계적이지만 확실한 CRITICAL이고,
(2) §R17 신설 5번째 bullet 이 "내부 표면 원문 유지" 근거로 지목한 bullet 이 실제로는 정반대 주장을
하는 bullet 이어서, 이 draft 가 표방하는 "인벤토리 완전성" 목표를 스스로 훼손할 수 있는 WARNING이다.
두 항목 모두 spec 반영(§5 단계) 직전에 손으로 고치면 되는 국소적 수정이며, draft 의 전체 설계 방향
(egress-only, 별도 컬럼 구분, 잔여 갭 명시)은 기존 conventions·spec 관행과 일관된다.

## 위험도
MEDIUM
