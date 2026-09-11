# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-chat-channel-binder-drift.md`

검토 대상: T1(#1319)·T2(#1320) 이동을 SoT 에 반영하는 spec draft(①`code:` glob화, ②§7 5파일
보강, ③귀속 표기 3곳). 대조군: `spec/conventions/spec-impl-evidence.md`,
`spec/conventions/review-citations.md`, `.claude/hooks/_lib/review_guard.py`
(`_glob_to_regex`/`_MAX_GLOB_WILDCARDS`), `.claude/docs/plan-lifecycle.md`, 실제
`spec/5-system/15-chat-channel.md` · `spec/conventions/secret-store.md` ·
`spec/conventions/chat-channel-adapter.md` · `spec/data-flow/14-chat-channel.md` 현재 본문,
`codebase/backend/src/modules/triggers/` 실제 파일 목록.

## 검증 메모 (참고용 — 발견사항 아님)

target 이 제시한 수치 주장을 `review_guard._glob_to_regex` 알고리즘을 그대로 재구현해
실제 저장소 파일 목록에 돌려 재현했다 — **전부 일치**했다:

- 3-glob 합집합 매칭 10 / 차집합 0 (target 주장과 동일)
- `modules/triggers/**` 매칭 27, 그중 좁은 집합 밖 17 (target 주장과 동일)
- `setupChatChannel` 4개 파일 전수 grep → 9건 중 클래스/파일 접두 붙은 것 정확히 3곳
  (`secret-store.md:146`, `chat-channel-adapter.md:369`, `data-flow/14-chat-channel.md:29`),
  나머지 6곳(그중 `secret-store.md` 1곳은 코드 예시 함수 정의 자체) 은 이동 후에도 참
- §7 `triggers/` 블록의 현재 4줄 중 "chat-channel 소스" 는 1개(`chat-channel-token-rotator.service.ts`)뿐,
  나머지 5개 소스 파일(`chat-channel-binder.service.ts`·`chat-channel-input-rules.ts`·
  `chat-channel-rejection-messages.const.ts`·`trigger-callback-url.ts`·`dto/chat-channel-config.dto.ts`)
  누락 확인

`code:` 를 glob 으로 바꾸는 결정은 `spec-impl-evidence.md` §2.1 필드 정의("`code:` 는
string[], glob 허용")·같은 절의 명시적 경고("넓은 트리 글롭으로 가드만 통과시키는 것은
아무것도 가리키지 않는 것과 같다")와 정확히 정합한다 — target 은 넓은 `triggers/**` 를
스스로 기각하고 좁은 glob 3개(와일드카드 각 1개, 가드 상한 6 에 한참 못 미침)를 채택해 이
회피 대상 안티패턴을 재현하지 않는다.

## 발견사항

- **[WARNING] §③(c) 편집 지시의 경로 표기가 target 문서·대상 문서 양쪽의 기존 관례와 다르다**
  - target 위치: `## ③ 귀속 표기 3곳` → `(c) spec/data-flow/14-chat-channel.md §0` 의
    "변경" 두 줄 — ``` `…/chat-channel-binder.service.ts` — ... ``` / ``` `…/triggers.service.ts` — ... ```
  - 위반 규약: 명시 규약 파일 조항은 없으나, **대상 문서 자신의 확립된 표기 관례**(`spec/data-flow/14-chat-channel.md` §0 의 다른 모든 불릿은 `codebase/backend/src/modules/...` 전체 경로를 backtick 으로 그대로 적는다 — 같은 절의 "현행" 인용 줄도 전체 경로다)와 어긋난다. `spec/data-flow/**`·`spec/5-system/**` 전체를 grep 해도 `…/` 축약 표기 선례가 **0건**이다.
  - 상세: target 의 "현행" 인용은 전체 경로(`codebase/backend/src/modules/triggers/triggers.service.ts`)를 그대로 보여주는데, 바로 아래 "변경" 인용은 갑자기 `…/` 생략 표기로 바뀐다. 이 초안은 실행자(다음 planner 턴)를 위한 편집 지시문이므로, `…/` 가 "위와 같은 접두사 생략" 이라는 의도인지 **문자 그대로 spec 본문에 들어갈 텍스트**인지가 문서 안에서 모호하다. 후자로 실행되면 그 절에서 유일하게 축약 경로를 쓰는 불릿이 생겨, 정식 규약이 명문화하진 않았지만 이 문서 스스로가 지금까지 지켜온 "구현 파일 목록 = 전체 경로 나열" 관례를 깬다.
  - 제안: 실제 spec 편집 시 `…/` 를 전체 경로(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 등)로 명시적으로 펼쳐 쓴다. draft 자체를 고칠 필요는 없지만(임시 산출물이 아니라 `plan/complete/` 보존 대상이므로), 다음 실행자가 오독하지 않도록 "위 경로 접두 생략, 실제 spec 에는 전체 경로 사용" 주석을 한 줄 붙이는 편이 안전하다.

- **[INFO] §② §7 편집안의 `**호출만**` 이 코드펜스 안에서 리터럴로 남는다**
  - target 위치: `## ② §7 구현 파일 구조 — 5파일 누락` 코드블록의 `triggers.service.ts` 행 —
    `# 기존 — chat-channel 은 **호출만** 한다 (...)`
  - 위반 규약: `spec/5-system/15-chat-channel.md` §7 은 3-backtick 코드펜스(언어 태그 없음)로 감싼 ASCII 트리다. GFM 은 코드펜스 내부의 `**...**` 를 볼드로 렌더링하지 않고 별표 문자 그대로 출력한다. 명문 규약은 없지만, 같은 블록의 다른 모든 주석(예: `triggers.controller.ts` 의 `C-2: ...`)은 순수 텍스트만 쓰고 강조 마크업을 쓰지 않는다 — 이 블록 **내부의 기존 스타일과 어긋난다**(저장소 전체적으로는 `1-auth.md`·`4-execution-engine.md` 등 다른 코드펜스에 `**` 사용 선례가 소수 있어 절대 금지까지는 아니다).
  - 상세: 렌더링 결과가 `**호출만**` 그대로 노출돼 강조 의도가 전달되지 않고, 동일 트리 안에서 이 줄만 시각적으로 이질적이다.
  - 제안: 강조가 꼭 필요하면 `# 기존 — chat-channel 은 호출만 한다 (대문자/따옴표 등 비-마크다운 강조)` 처럼 순수 텍스트로 바꾸거나, 의도적으로 리터럴 별표를 남기는 것이라면 그대로 두어도 CRITICAL/WARNING 급은 아니다.

## 요약

target 초안은 `spec/conventions/spec-impl-evidence.md` 의 `code:` glob 허용 규정과 "넓은
글롭 금지" 원칙을 정확히 준수하며, 제시한 파일 매칭 수치(10/27/17)·`setupChatChannel` 출현
9건 중 드리프트 3곳·§7 누락 5파일을 `review_guard._glob_to_regex` 로 재구현해 실제
저장소에 돌려 전부 재현했다 — 명명·구조·게이트 술어 축에서 정식 규약 위반은 발견되지
않았다. plan frontmatter(`worktree`/`started`/`owner`/`spec_impact`)·문서명(`spec-draft-*.md`
선례)·Overview/본문/Rationale 3섹션·`R-CC-NN` Rationale ID 패턴도 기존 관례와 일치한다.
API 문서(OpenAPI 데코레이터) 축은 명시적으로 스코프 밖으로 분리해 developer 트래커에 남겨
두어 역할 경계도 지킨다. 유일한 흠은 편집 지시문 자체의 표기 방식(③(c) 의 `…/` 경로 축약이
대상 문서의 "전체 경로 나열" 관례와 충돌할 소지, §7 편집안의 코드펜스 내 마크다운 볼드)이며
둘 다 실제 spec 문서에 반영되기 *직전*에 바로잡을 수 있는 경미한 사안이다.

## 위험도

LOW
