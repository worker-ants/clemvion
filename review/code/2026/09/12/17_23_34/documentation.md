# 문서화(Documentation) Review — chat-channel-rules-cleanup (round 17_23_34)

## 검토 방법

이번은 4라운드째다(`16_17_57` → `16_39_18` → `17_02_19` → 이번). 앞 세 라운드의 RESOLUTION.md와
documentation.md를 먼저 읽어 이미 확인된 사실을 재확인하지 않도록 했고, 이번 라운드가 새로
추가한 파일(가드 `dto-class-name-collision-guard.ts`/`.spec.ts` + fixture 3개, 파일 9~13)과
직전 라운드까지 이미 검증된 파일(1~8)의 **문서-코드 정합성**을 `Read`/`Grep`으로 재대조했다.
추가로 이번 diff가 새로 삽입한 코드 주석이 `spec/conventions/review-citations.md`의 인용 형식
규약을 지키는지, 신규 가드가 그 가드를 낳은 spec 문서(`swagger.md`)의 `code:` 목록에 반영됐는지
실측했다. 저장소 파일은 쓰지 않았다(`Read`/`grep -n`/`git diff`/`git show`만 사용).

## 발견사항

- **[WARNING]** 이번 diff가 새로 삽입한 코드 주석 5곳이 `spec/conventions/review-citations.md`
  §2("bare `hh_mm_ss`는 쓰지 않는다 — 날짜 없이는 이력으로도 해소 불가")를 위반한다
  - 위치:
    - `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:88`
      — `` (`/ai-review` `16_17_57` testing WARNING). ``
    - `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts:9`
      — `` (`/ai-review` `16_39_18` requirement WARNING) ``
    - 같은 파일 `:23` — `` `/ai-review` `16_17_57` documentation CRITICAL 이 잡았다. ``
    - 같은 파일 `:55` — `` (`/ai-review` `16_17_57` api_contract WARNING). ``
    - `codebase/backend/src/modules/triggers/triggers.service.ts:995`
      — `` (`/ai-review` `16_17_57` api_contract WARNING). ``
  - 상세: `review-citations.md`는 `codebase/**`의 코드·테스트 주석에 인용 규약을 **적용
    대상**으로 명시하고(§3 표 1행), "전체 경로"(`review/code/2026/09/12/16_17_57`)를 권장,
    "날짜+시각"(`2026-09-12 16_17_57`)을 허용, **"bare 시각"(`16_17_57`)은 금지**한다고
    못박는다 — 근거는 세션 시각이 날짜를 넘어 충돌한다는 실측(§2, `origin/main` 기준 46개
    시각 충돌·8개는 이력으로도 해소 불가). 위 5곳은 전부 이번 diff가 **새로 추가한 줄**이고
    (`git diff origin/main..HEAD`에서 전부 `+`), 전부 날짜 없이 `HH_MM_SS`만 적었다. 같은
    작성자가 같은 PR의 `RESOLUTION.md`·`plan/`에서는 전체 경로/날짜+시각 형태를 정확히 쓰는
    것과 대비된다(다만 `plan/**`·`review/**`는 §3 표에서 애초에 규약 적용 대상이 아니다 —
    `codebase/**`만 대상이다). 이 규약은 가드로 강제되지 않는다(문서 자신이 "§2는 가드 없음"
    이라 명시)고, 기존 위반 499건이 이미 있어(§4, 소급 정리 대상 아님) 치명적이진 않지만,
    **새로 쓰는 주석이 굳이 신규 위반을 늘릴 이유는 없다** — 몇 달 뒤 `16_17_57`이 어느 날짜
    세션인지 다시 찾아야 하는 사람은 이 규약이 막으려던 바로 그 상황을 겪는다.
  - 제안: 다섯 곳 모두 `` `/ai-review` `2026-09-12 16_17_57` `` (또는 전체 경로
    `review/code/2026/09/12/16_17_57`) 형태로 날짜를 보강할 것. 강제 가드가 없어 이번 PR을
    막을 사유는 아니지만, 저장소가 이미 겪은 "날짜 없는 인용은 이력으로도 못 찾는다"는 실측
    교훈이 있는 만큼 반영을 권장한다.

- **[INFO]** 신규 `dto-class-name-collision` 가드가 그 가드를 낳은 spec 문서의 `code:`
  목록에 등재돼 있지 않다 — 자매 가드들과 다른 패턴
  - 위치: `spec/conventions/swagger.md` frontmatter `code:` (신규 가드 미등재),
    대조: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`,
    `dto-class-name-collision.spec.ts` (신규)
  - 상세: `@nestjs/swagger`가 스키마를 클래스 `.name`으로 등록해 동명 클래스가 서로를 덮어쓰는
    문제는 명백히 swagger 문서 생성 계약의 일부이고, `swagger.md`는 정확히 이런 성격의
    시행 가드(`swagger-dto-contract-guard.ts`, `user-entity-exposure-guard.ts`)를 이미
    frontmatter `code:`에 "시행 코드"로 등재해 두는 선례를 갖고 있다(`spec-impl-evidence.md`
    SoT: `code:`는 "본 spec이 약속한 surface의 구현 경로"). 새 가드는 `plan/in-progress/
    spec-draft-nullable-notation-followups.md:3052` 트래커 항목에서만 언급되고, `spec/**`
    어디에도 그 존재가 반영되지 않았다 — grep 확인. spec-coverage 같은 자동 감사 도구는
    `code:` 목록을 SoT로 쓰므로, 이 가드는 그 감사의 시야 밖에 남는다.
  - 제안: developer 권한 밖(spec/ 쓰기는 project-planner 축)이므로 이번 PR에서 직접 고칠
    필요는 없다 — 이미 등재된 트래커 항목에 "`swagger.md`의 `code:`에 이 가드를 추가한다"는
    구체적 처분을 덧붙여 다음 planner 턴에서 함께 처리되도록 명시할 것을 권장.

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md`의 체크리스트가 4라운드째
  전항목 미체크 상태다
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md`의 `## 체크리스트` 섹션(92~102행,
    실제 파일 기준 — 이 파일의 diff는 프롬프트 예산 초과로 생략되어 게이트 번호가 없음)
  - 상세: `16_39_18`·`17_02_19` 두 라운드의 documentation 리뷰가 이미 같은 항목을 INFO로
    지적했고, 매번 "라운드 수렴 시 정리"로 낮은 우선순위 처리됐다. 이번 라운드까지도
    `- [x]`는 "뮤테이션 6종" 한 줄뿐이고 나머지(`--impl-prep`, 1~6 작업, `run-test-all.sh`,
    `/ai-review`+`--impl-done`, 트래커 종결, `plan/complete/` 이동)는 전부 `[ ]`다. 다만
    이 상태는 plan 자신의 "정지 규칙"(수렴 조건은 "발견 0"이 아니라 "`codebase/**` 수정
    0으로 끝나는 라운드")과 정합한다 — 직전 라운드(`17_02_19`)가 신규 가드 추가라는
    `codebase/**` 변경을 요구했으므로 아직 수렴 라운드가 아니었다.
  - 제안: 이번 라운드가 다른 reviewer로부터도 CRITICAL/코드 변경 요구 없이 수렴한다면,
    바로 그 시점에 체크리스트 전항목을 실제 완료 상태로 갱신하고 `plan/complete/`로 옮길
    것 — plan 자신의 정지 규칙이 이미 그 절차를 명시하므로 새 규칙은 불필요하다.

## 확인했으나 문제 없음

- **신규 가드(`dto-class-name-collision-guard.ts`/`.spec.ts`)의 JSDoc·주석** — 함수
  `exportedClassNames`/`findDtoClassCollisions` 모두 공개 함수 JSDoc을 갖추고, "정규식이
  아니라 AST로 읽는다"는 설계 근거·"형제 가드가 fixture를 스캔 범위 밖에 둔 이유를 몸으로
  확인했다"는 서사 모두 실측과 일치했다: `find codebase/backend/src -name '*.dto.ts'`
  기준 `modules/`(111)+`common/`(3)=114파일, `grep -rhoE "export class …"`로 **256개** 클래스
  전수·중복 0건 모두 코드의 docstring 수치와 정확히 일치한다. `collectTsFiles`의 기본
  동작(`*.spec.ts` 제외, 절대경로 반환, `node_modules`/`dist`/`.d.ts` skip)도 `@param files
  스캔 대상 절대경로 목록` 서술과 맞는다.
- **응답 DTO 파일(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)의 자리
  선정 서사** — "`15-chat-channel.md`의 `code: dto/chat-channel-*.dto.ts`는 `/`를 안 넘어
  `responses/` 하위를 못 잡지만 `2-trigger-list.md`의 `dto/**`는 잡는다"는 주장을 두 spec
  파일의 실제 frontmatter로 직접 대조해 정확함을 재확인했다. "glob을
  `dto/**/chat-channel-*.dto.ts`로 넓히는 planner 항목이 트래커에 있다"는 서술도
  `spec-draft-nullable-notation-followups.md:3071`에 실재한다.
- **`TriggersService` 귀속 주석 3곳**(`chat-channel-rejection-messages.const.ts:9`,
  `chat-channel-input-rules.ts:22,37`, `dto/chat-channel-config.dto.ts:37`) — 전부
  "떼어냈다/호출한다" 형태의 이력·호출관계 서술이라 stale이 아님을 재확인.
- **README/CHANGELOG** — `CHANGELOG.md`는 이 저장소에서 breaking/behavior-change 전용으로
  쓰이는데(직전 항목 `#1324`가 그 형태), 이번 PR은 3라운드에 걸쳐 "응답 형태 무변경"이
  테스트로 재확인된 순수 리팩터 + additive swagger 문서 보강이라 CHANGELOG 항목 불필요 —
  전회 판단과 동일하게 유지. `repo-guards/__tests__/`에는 어떤 가드도 개별 README를 갖지
  않는 기존 관례가 있어(`find`로 0건 확인) 신규 가드도 README 불필요.
- **`--impl-prep` naming-collision 트래커 항목** — `3c9f4dd12`가 `- [ ]`→`- [x]`로 정확히
  체크하고 실측 근거(RED 재현, fixture 2종, 114파일 스캔)를 함께 남겼다 — 해소 확인.

## 요약

이번 라운드의 유일한 신규 코드(`dto-class-name-collision` 가드 4파일)는 문서화 품질이
높다 — JSDoc·설계 근거·수치가 전부 실측과 정확히 일치한다. 새로 발견된 것은 두 갈래다:
(1) 이번 diff가 새로 쓴 코드 주석 5곳이 저장소 자신의 `review-citations.md` §2("bare
`hh_mm_ss` 금지")를 위반한다 — 가드는 없지만 명시된 SoT 규약이고 같은 PR 안에서 다른 곳은
정확한 형태를 쓰는 것과 대비된다. (2) 신규 가드가 그것이 강제하는 swagger 스키마 계약의
spec 문서(`swagger.md`)의 `code:` 목록에 등재되지 않아, 자매 가드들과 달리 spec-coverage
감사의 시야 밖에 남는다 — developer 권한 밖이므로 트래커에 처분을 구체화해 남기는 것을
권장. 그 외 3라운드째 이월되는 plan 체크리스트 미갱신은 plan 자신의 정지 규칙에 부합하는
상태로, 이번 라운드가 수렴하면 그 즉시 정리돼야 할 항목이다. 세 항목 모두 병합을 막을
CRITICAL은 아니다.

## 위험도

LOW
