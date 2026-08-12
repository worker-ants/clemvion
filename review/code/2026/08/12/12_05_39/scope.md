# 변경 범위(Scope) 리뷰 — `origin/main...HEAD` (backend lint warning 46→0 처분 + `--max-warnings 0`)

## 검증 방법

- `git log --oneline -15` 로 이 브랜치의 커밋 구성 확인 (`17221ecb9`(round1 25건) →
  `e95201932`(round1 산출물+Pass2 테스트) → `ba93680ab`(오염 revert) →
  `9add2eba7`(plan 결정) → `ee8e44e8f`(round2 21건+게이트) → `67b7d7d77`(plan 정정)).
- `git diff --stat origin/main...HEAD` 로 전체 23파일 변경 목록을 프롬프트의 파일 목록과 대조 —
  정확히 일치.
- `git diff origin/main...HEAD -- <5개 핵심 코드 파일>` 을 직접 재실행해 프롬프트의 unified diff
  가 실제 diff 와 한 글자도 다르지 않음을 확인(생략·왜곡 없음).

## 발견사항

- **[INFO]** `migrate-node-output-refs.spec.ts` 에 타입 주석 작업 범위를 넘어서는 **신규 테스트
  케이스**가 추가됨
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts:56-67`
  - 상세: 이 브랜치의 선언된 목적은 "lint `no-unsafe-*` 경고를 타입 주석으로 처분"인데, 이
    파일에는 `it('rewrites single-nested output.meta.<field> → meta.<field> (Pass 2)', ...)`
    라는 새 테스트 블록(주석 3줄 + `it` 본문 8줄)이 통째로 추가됐다 — 순수 타입 주석이 아니라
    행위 검증 코드다. 다만 이는 은폐된 확장이 아니라 **명시적으로 문서화된 결정**이다:
    `review/code/2026/08/12/11_06_12/RESOLUTION.md:5-21` 과 커밋 `e95201932` 본문이 "방금 타입을
    붙인 Pass 2 콜백이 spec 44건을 돌면서도 한 번도 실행된 적이 없었다"는 실측을 근거로 이
    테스트를 추가했다고 밝히고, 뮤테이션(치환 무력화 → 1건만 RED)으로 판별력까지 확인했다.
    즉 "타입만 붙인다"는 원 선언을 그대로 지키지 못했지만, 그 이탈을 스스로 발견·기록·검증한
    사례다.
  - 제안: 코드 조치 불요. 스코프 관점에서는 이미 충분히 disclosure 됐다.

- **[INFO]** 이번 브랜치 diff에 별도 리뷰 세션(`11_06_12`, round 1)의 산출물 10개 파일(약 837줄)
  이 함께 번들됨 — 실제 코드 수정(약 190줄)보다 4배 이상 큼
  - 위치: `review/code/2026/08/12/11_06_12/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`,
    `meta.json`, `maintainability.md`, `requirement.md`, `scope.md`, `security.md`,
    `side_effect.md`, `testing.md` (전부 신규 파일, diff 게이트 없음 — 파일 단위 신규 추가)
  - 상세: 이 파일들은 이번 세션(`12_05_39`)이 리뷰하는 "backend lint warning 처분" 작업 자체와
    직접 관련이 없고, **직전 라운드(3파일/25건 처분, 커밋 `17221ecb9`)에 대한 `/ai-review` 실행
    결과물**이다. 다만 이 프로젝트 CLAUDE.md는 "구현 완료 후 자동 review/fix 는 상시 승인된
    강제 의무"이고 그 산출물을 커밋하는 것이 표준 워크플로이므로 규약 위반은 아니다. 실제로
    `git log` 상 이 파일들은 코드 수정과 분리된 커밋(`e95201932`)에 들어 있어 커밋 단위로는
    섞이지 않았다 — 단지 브랜치 누적 diff(이번 리뷰의 diff base)에서 함께 보일 뿐이다.
    (참고: 커밋 `ba93680ab` 이력에 따르면 한 차례 병렬 리뷰 sub-agent 가 워크트리를 오염시켜
    `git add -A` 로 무관한 8파일이 섞여 들어갈 뻔했으나, 즉시 발견해 revert 하고 다시 의도적으로
    커밋했다 — 최종 diff 에는 오염의 흔적이 남아 있지 않음을 `git diff --stat` 재실행으로 확인.)
  - 제안: 코드 조치 불요. PR 리뷰 시 "코드 diff"와 "리뷰 산출물 diff"를 구분해서 훑도록 안내하는
    정도로 충분.

그 외 CRITICAL/WARNING 급 스코프 이탈은 **발견되지 않았다.**

## 점검 관점별 확인 내역

1. **의도 이상의 변경** — 코드 파일(1~12) 전부 "라이브러리 경계 `any` 에 타입 주석/제네릭/단언
   추가"라는 단일 목적에 정확히 부합. 유일한 예외는 위 INFO 1(Pass 2 테스트 추가)이며 disclosure
   됨.
2. **불필요한 리팩토링** — 없음. 변수명·함수 구조·제어 흐름 변경 0건(round 1 side_effect 리뷰가
   emit md5 동일까지 실증, round 2 파일들도 diff 상 동일 패턴).
3. **기능 확장** — 없음. `HttpResponseLike` 인터페이스(`idempotency.interceptor.ts`)는 신규
   기능이 아니라 `no-unsafe-*` 를 없애기 위한 최소 구조적 타입이고, express `Response` 를 직접
   박지 않은 이유까지 주석으로 밝혀(방어 코드가 죽지 않게) over-engineering 이 아님을 뒷받침한다.
4. **무관한 수정** — `git diff --stat` 결과 23개 파일 전부가 프롬프트 목록과 일치, 목적과
   무관한 파일(예: 다른 모듈·다른 기능 영역)은 없음.
5. **포맷팅 변경** — `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:196-201`
   의 괄호 재배치·개행, `migrate-node-output-refs.ts` 의 콜백 시그니처 다중 줄 전개는 타입 주석
   추가로 인한 prettier 강제 개행이며(round 1 scope 리뷰가 89자 vs printWidth 80 실측으로 확인),
   순수 포맷팅 개편은 없다.
6. **주석 변경** — 추가된 모든 주석(`chat-channel.dispatcher.ts:193-196`,
   `execution-engine.service.ts:2909-2910`, `executions.service.ts:194-196`,
   `idempotency.interceptor.ts:24-33`, `chat-channel-config.dto.ts:65`,
   `ai-agent.schema.ts:645`, `render-tool-provider.ts:376-377/458-459`,
   `workspace-reflection-canary.ts:87-88`)는 전부 바로 그 줄의 타입 단언/제네릭이 왜 필요한지를
   직접 설명하며, 기존 주석 삭제·무관한 주석 추가는 없음.
7. **임포트 변경** — `triggers.service.ts:31` 한 곳, 기존 import 문의 named specifier 목록에
   `SetupResult` 하나를 추가한 것뿐. import 재정렬·불필요 import 삭제·신규 import 문 없음.
8. **설정 변경** — `codebase/backend/package.json:20` 의 `lint` 스크립트에
   `--max-warnings 0` 추가는 `plan/in-progress/backend-lint-gate-broken-on-main.md:133`
   ("결정 (2026-08-12): 도입한다")에 명시된 목표 그 자체이며, CI(`backend-checks.yml`)가 같은
   스크립트를 호출하므로 로컬·CI 게이트 동기화 의도와 일치. 다른 설정 파일(`.eslintrc`,
   `tsconfig*`, `.prettierrc`)은 diff에 등장하지 않음.

## 요약

이번 브랜치(origin/main...HEAD, 23파일)는 `plan/in-progress/backend-lint-gate-broken-on-main.md`
가 명시한 단일 목표 — backend lint warning 46건 전량을 라이브러리 경계 `any` 처분(타입 주석·
제네릭·단언)으로 없애고 `package.json` 의 `lint` 스크립트에 `--max-warnings 0` 을 걸어 로컬·CI
게이트를 동기화하는 것 — 에서 벗어나지 않는다. 코드 diff 12파일 전부가 이 목적에 정확히
부합하며 로직 분기·리팩토링·기능 확장·무관한 파일·불필요한 설정 변경은 없다. 유일한 두 관찰은
(1) `migrate-node-output-refs.spec.ts` 에 "타입만 붙인다"는 원 선언을 살짝 넘어서는 신규 테스트
케이스가 추가됐지만 이는 은폐가 아니라 실측(뮤테이션 판별력 확인)까지 마친 자기-발견 사례로
`RESOLUTION.md` 에 이미 disclosure 됐고, (2) 직전 리뷰 라운드(`11_06_12`)의 산출물 10개 파일이
이번 브랜치 누적 diff에 함께 보이는데 코드 diff의 4배 이상 크기라 리뷰 시 혼동을 줄 수 있지만
별도 커밋으로 분리돼 있고 이 저장소의 표준 워크플로(리뷰 산출물 커밋)에 부합한다. 두 관찰 모두
INFO 수준이며 CRITICAL/WARNING 대상은 없다.

## 위험도

LOW

STATUS: OK
