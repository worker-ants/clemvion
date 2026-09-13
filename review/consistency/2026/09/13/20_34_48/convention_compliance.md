# 정식 규약 준수 검토 — error-code-emission-axis

## 검토 범위 재확인

- `--impl-done` scope = `spec/conventions/`, diff-base = `origin/main`.
- **실측**: `spec/conventions/**` 델타 **0개 파일** (`git diff origin/main...HEAD --stat -- spec/conventions/` 공집합). 이 브랜치는 정식 규약 문서 자체를 바꾸지 않았다 — 정상이며 그 자체로는 결함이 아니다.
- 구현 diff 는 4개 파일(`git diff origin/main...HEAD --stat` 로 절대경로 워킹트리에서 직접 확인):
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (+200)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (+358/-5)
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` (+1/-1)
  - `codebase/frontend/src/content/docs/02-nodes/logic.en.mdx` (+1/-1)
- 관련 플랜: `plan/in-progress/error-code-emission-axis.md` (`spec_impact: none`, `owner: developer`).
- 본 검토는 이 4파일 diff + 관련 정식 규약(`spec/conventions/error-codes.md`, `spec/conventions/user-guide-evidence.md`, `spec/conventions/review-citations.md`, `spec/conventions/node-output.md`)을 절대경로로 직접 열어 대조했다 (프롬프트 번들이 컨텍스트 예산으로 `error-codes.md` 본문과 diff 본문을 절단했으므로, 그 지시대로 워킹트리를 직접 읽었다).

## 변경 내용 요약

가이드 문서(`logic.mdx`/`logic.en.mdx`)가 `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` 를 마치 정식 `error.code` 처럼 서술하던 것을 "메시지 접두일 뿐 전용 코드가 없다" 로 정정하고, 그 부정확 서술을 재발 방지하기 위해 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 에 "발행 축"(존재 축과 별개 — 코드가 실제로 `error.code`/카탈로그로 발행되는지)을 추가했다. 기존 `GUIDE_EXTERNAL_VOCABULARY`(존재 축 예외 목록)의 거울상으로 `GUIDE_NON_EMITTED_VOCABULARY`(발행 축 예외 목록, 3종 등록: `MAKESHOP_UNRESOLVED_PATH_PARAM`·`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`)를 신설했다.

## 발견사항

- **[WARNING] "발행 축" 하네스 컨벤션이 `spec/conventions/` 에 대응 문서가 없다**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` / `isMessagePrefixOnly` / `collectCatalogCodes` 등 (신규), 및 기존 `GUIDE_EXTERNAL_VOCABULARY`.
  - 위반(정확히는 "괴리") 규약: CLAUDE.md "정보 저장 위치" 표 — "정식 규약 → `spec/conventions/<name>.md`" 원칙. 참조 선례: `spec/conventions/user-guide-evidence.md` (구조적으로 동일한 "가이드 진실성 하네스 가드" 범주인 `impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`triggers-coverage.test.ts` 를 위해 존재하며, `code:` frontmatter·Overview/본문/Rationale 3섹션·예외 설계 근거(`kind` enum 채택 이유 등)를 모두 담고 있다).
  - 상세: `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`)는 이미 상한(`EXTERNAL_VOCABULARY_CAP`/`NON_EMITTED_VOCABULARY_CAP`)·예외 등록부(`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)·죽은 항목 정리 강제·"두 목록은 제약이 정반대라 합칠 수 없다" 같은 설계 근거를 갖춘, `user-guide-evidence.md` 와 동형인 "정식 규약" 수준의 하네스다. 그런데 이 가드/예외 설계는 **오직 테스트 파일의 JSDoc 안에서만** 문서화돼 있고 `spec/conventions/**` 어디에도 대응 항목이 없다(`grep -rl "guide-identifier\|GUIDE_EXTERNAL_VOCABULARY\|GUIDE_NON_EMITTED_VOCABULARY" spec/` 결과 0건). 같은 "가이드 정확성 하네스" 범주 안에서 한쪽(`impl-anchor-existence` 계열)은 `spec/conventions/`에 SoT가 있고 다른 쪽(`guide-identifier-existence` 계열)은 없어 다음 사람이 "이 예외 목록에 새 토큰을 등록하는 규율이 정식 규약인지, 그냥 테스트 관행인지"를 판단할 근거가 spec 에 없다. 본 PR 이 이 비대칭을 만든 것은 아니다(`GUIDE_EXTERNAL_VOCABULARY`는 선재) — 다만 이번 PR 이 같은 형태의 두 번째 완전한 축(카탈로그 참조·사유 필드·`where` grep 검증까지)을 얹으면서 그 비대칭을 한 단계 더 키웠다.
  - 제안: 이 PR 범위에서 강제하기보다, `plan/in-progress/error-code-emission-axis.md` 가 이미 등재한 planner 트래커 항목(§1.4 backfill 판정) 처리 시점에 함께 `spec/conventions/error-codes.md` 또는 신설 문서에 "가이드가 인용하는 UPPER_SNAKE 토큰의 존재/발행 2축 하네스" 를 SoT 로 승격할 것을 권고. 최소한 `error-codes.md` §1 "적용 범위" 단락에 "메시지 접두로만 등장하고 `.code`로 발행되지 않는 토큰은 본 규율의 적용 대상이 아니다(가이드 하네스는 `guide-identifier-scan.ts` 참고)" 각주를 추가하면 두 문서가 서로를 참조하게 되어 이 괴리가 줄어든다.

- **[INFO] 인용 형식은 `review-citations.md` 를 정확히 준수**
  - target 위치: `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 전역의 `` `/ai-review`(`review/code/2026/09/13/19_23_22` maintainability WARNING#7) `` 류 인용 다수.
  - 관련 규약: `spec/conventions/review-citations.md` §2(날짜 포함)·§3(codebase/** 적용 대상).
  - 상세: 신규로 추가된 모든 리뷰 인용이 "전체 경로"(`review/code/YYYY/MM/DD/hh_mm_ss`, 권장 형태) + 지적 번호(`WARNING#7`)를 갖춰 §2 최고 등급을 만족한다. bare `hh_mm_ss` 형태는 diff 안에서 발견되지 않았다. 위반 아님 — 준수 사례로 기록.

- **[INFO] `error-codes.md` §1 명명 규율과 실제 정합 — 위반 아님**
  - target 위치: `GUIDE_NON_EMITTED_VOCABULARY` 등록 3종의 `token` 값.
  - 관련 규약: `spec/conventions/error-codes.md` §1(의미 기반 명명, `UPPER_SNAKE_CASE`).
  - 상세: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`/`MAKESHOP_UNRESOLVED_PATH_PARAM` 은 모두 `UPPER_SNAKE_CASE` 이고 의미 기반 이름(무엇이 잘못됐는지 이름만으로 드러남)이다. 다만 이들은 `error-codes.md` §1 이 규율하는 "실제 발행되는 `error.code` 문자열" 이 아니라 **메시지 접두 문자열**이므로 애초에 §1 적용 대상 밖이다(§1 "적용 범위" 문단은 "프로젝트 전체의 에러 코드 *문자열*" 이라 명시하나, 이 토큰들은 `.code` 필드로 발행되지 않는다). 가이드 정정 문구("전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요")가 이 경계를 정확히 서술하고 있어 규약과 충돌하지 않는다. `node-output.md` §3.2/§3.3 관점에서도 Loop/ForEach/Map 컨테이너는 `error` 포트 보유 노드 목록(§3.3)에 없고, 이 실패는 `output.error.code` 형식이 아니라 §3.1 의 "Pre-flight 에러 → throw → 엔진 실행 실패" 경로이므로 node-output.md 위반도 아니다.

- **[INFO] spec/ 경계 준수 — developer 가 spec 을 건드리지 않고 planner 트래커로 위임**
  - target 위치: `plan/in-progress/error-code-emission-axis.md` §impl-prep 체크리스트 항목 ("그 택일은 `spec/` 이라 planner 몫이고 트래커에 등재했다").
  - 관련 규약: CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" + "자기-반증형 소정정" 5조건(해당 없음 — 예고 문장 반증이 아니라 신규 설계 결정이므로 예외 조건 자체가 적용될 사안이 아님, 그리고 실제로 devloper 는 이 예외를 주장하지 않고 정상적으로 트래커 위임 경로를 탔다).
  - 상세: `CONTAINER_*` 를 `3-error-handling.md §1.4` 카탈로그에 backfill 할지 여부는 spec 본문(카탈로그) 변경 사안인데, developer 는 이를 직접 편집하지 않고 `spec-draft-nullable-notation-followups.md` 트래커에 등재한 채 `spec_impact: none` 으로 이번 PR 을 마감했다. 역할 경계를 정확히 지킨 사례로, 위반 없음.

## 요약

이 PR 은 `spec/conventions/**` 를 전혀 수정하지 않으며(델타 0, 코드 전용 PR 로서 정상), 구현 diff(가이드 문구 정정 2줄 + 하네스 확장 558줄)는 기존 정식 규약(`review-citations.md` 인용 형식, `error-codes.md` §1 명명·적용범위, `node-output.md` §3.1~3.3 에러 라우팅 경계)과 충돌하지 않는다. spec 레벨 판단(카탈로그 backfill 여부)이 필요한 지점은 developer 가 직접 손대지 않고 planner 트래커로 정확히 위임했다. 유일하게 지적할 만한 것은 CRITICAL/위반이 아니라 구조적 공백 하나다 — 이번에 두 번째 완전한 축으로 성숙한 "가이드 존재/발행 2축 하네스"(`GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY`)가, 같은 범주의 자매 하네스(`user-guide-evidence.md` 가 다루는 `impl-anchor-existence` 계열)와 달리 `spec/conventions/` 에 SoT 문서가 없어 정식 규약 체계 밖에 머무르고 있다는 점이다. 이는 이번 PR 이 만든 결함이 아니라 기존 비대칭을 계승·확장한 것이므로 WARNING 수준으로 기록한다.

## 위험도

LOW
