# Code Review 통합 보고서

세션: `review/code/2026/05/16/08_35_36`
변경 범위: 8 MDX (한/영 페어) + 1 plan + consistency-check 산출물
리뷰어: 13/13 success, 0 pending

## 전체 위험도

**LOW** — 순수 문서 동기화. 런타임 코드 변경 없음. Critical 0건.

## Critical

없음

## Warning (조치 결정)

| # | 분류 | 발견 | 조치 |
|---|---|---|---|
| W1 | testing | `registry.ts` 단위 테스트에 모든 .mdx frontmatter 의 `spec`/`code` 경로 실존 검증이 부재. spec/2-navigation/13-user-guide.md §11 이 명시적으로 요구 | **즉시 조치** — registry.test.ts 에 실제 content/docs 루트 대상 path-existence 테스트 추가 |
| W2 | requirement | `$thread.text` 의 "memoized after first access" 와 본문 Callout 의 "renders every time" 가 상충 | **즉시 조치** — backend 의 `buildThreadView` closure 가 실제로 memoize 함을 확인. Callout 문구를 "expression 호출 1회당 1번 평가, 루프 안에서 여러 번 쓰면 매 iteration 마다 새로 평가" 로 수정 |
| W3 | requirement | `contextInjectionMode: messages` 가 Anthropic system role 비호환 케이스 미경고 | **불요** — messages 모드는 user/assistant role 만 사용. spec 도 system role 제약을 본 모드에 한정해 명시하지 않음. INFO 처리 |
| W4 | architecture | overview.mdx Integration 카테고리 서비스명 직접 열거 | **불요** — 통합 종류 총 4가지로 적고, 사용자가 어떤 통합이 있는지 즉시 파악하는 가치가 추상화 가치보다 큼. 의도된 trade-off |
| W5 | documentation | integrations.mdx 도입부 "세 종류" 문구가 Cafe24 추가로 "네 종류" 로 갱신 필요 | **즉시 조치** — 한/영 모두 |
| W6 | maintainability | 한/영 페어의 장기 drift 위험 | **불요** — 본 작업에서 한/영 페어를 모두 갱신함. 일반 컨벤션 issue 로 별도 다룸. INFO 처리 |

## Info (RESOLUTION 에 추적만)

I1~I20 — 총 20건. 다음만 즉시 추가 조치:

- **I10** — Cafe24 예시 제목 "어제 미발송 주문" 과 `start_date` 가 `$now`(오늘) 로 mismatch. 제목 또는 표현식 정정.
- **I3** — W2 와 묶어 메모이제이션 경계 명시.

나머지(I1, I2, I4~I9, I11~I20)는 RESOLUTION.md 에 추적 항목으로 기록 후 다음 문서 사이클에 반영. spec 본문 변경이 필요한 항목은 `project-planner` 위임 대상.

## 즉시 조치 요약

1. **W1**: `frontend/src/lib/docs/__tests__/registry.test.ts` 에 spec/code 경로 실존 테스트 추가
2. **W2 + I3**: `variables-and-context.{mdx,en.mdx}` `$thread.text` Callout 정합화
3. **W5**: `integrations.{mdx,en.mdx}` 도입부 "세 종류" → "네 종류"
4. **I10**: `integrations.{mdx,en.mdx}` 의 Cafe24 예시 제목 또는 `start_date` 표현식 정정

## 에이전트별

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | NONE | 정보 보강 권고 3건 (INFO) |
| performance | LOW | $thread.text 메모이제이션 경계 명시 (W2/I3 통합) |
| architecture | LOW | overview Integration 열거 (W4 — 의도) |
| requirement | LOW | W2, I6~I11 |
| scope | NONE | 모든 변경 plan 범위 내 |
| side_effect | NONE | 런타임 부작용 없음 |
| maintainability | LOW | 한/영 drift 일반 컨벤션 issue |
| testing | LOW | **W1** registry path-existence 테스트 부재 |
| documentation | LOW | W5, I13~I17 |
| dependency | NONE | 의존성 변경 없음 |
| database | NONE | N/A |
| concurrency | NONE | N/A |
| api_contract | NONE | N/A |
