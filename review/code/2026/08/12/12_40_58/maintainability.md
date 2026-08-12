# 유지보수성(Maintainability) 리뷰 결과

델타 = `origin/main...HEAD` 누적 diff(50개 파일, 커밋 8개). 이 중 앞선 3라운드
(`11_06_12`→`12_05_39`→`12_24_14`)가 이미 상세 검토해 전부 **NONE**(강제 수정 사유 없음)으로
수렴한 부분(실질 소스 12개 파일 + `package.json`/`README.md` 타입 전용 lint 처분, 그리고
`review/code/2026/08/12/{11_06_12,12_05_39,12_24_14}/*` 리뷰 산출물 커밋)은 재확인만 하고,
이번 라운드에서 **진짜 새로 생긴** 부분(커밋 `b0b57366f`)에 집중했다: `idempotency.interceptor.spec.ts`
에 테스트 2건 추가 + 테스트 1건 개명, `plan/in-progress/backend-lint-gate-broken-on-main.md`
백로그 갱신. 후자는 산문 plan 문서라 코드 유지보수성 기준(함수 길이·중첩·매직넘버 등) 적용 대상이
아니다.

## 발견사항

- **[INFO]** `IdempotencyInterceptor` 생성자 호출 인라인 반복이 5곳 → **7곳**으로 늘었다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:169, 200, 218, 247, 267, 294, 328` — 전부 `new IdempotencyInterceptor(undefined, redis as never, undefined)` 동일 형태 (직접 `Read`/`grep -n` 으로 실측)
  - 상세: 이 반복은 이미 두 라운드(`11_06_12`, `12_24_14`)에서 INFO 로 지적됐고 "강제 수정 아님"으로 처분됐다(당시 5곳). 이번 델타가 같은 `describe('IdempotencyInterceptor (캐시 히트 · 응답 형태 방어)')` 블록에 테스트 2건(`:232` R8 캐너리, `:261` 손상 JSON fallback)을 더 추가하면서 동일 3-인자 생성자 호출이 새로 2곳 더 늘어 총 7곳이 됐다. 로직이 복잡하지 않아 심각하지는 않지만, 이 블록에 테스트가 추가될 때마다 반복이 자동으로 늘어나는 패턴이 3라운드째 관찰된다 — 인자 개수·순서가 바뀌면 7곳을 손으로 고쳐야 한다.
  - 제안: 이전 판정(강제 아님)을 뒤집을 근거는 아니지만, 같은 블록 안에서 `bodyHashOf` 는 헬퍼로 뽑아 두고 생성자만 인라인으로 남긴 비일관은 여전하다. `const makeInterceptor = (redis: RedisStub) => new IdempotencyInterceptor(undefined, redis as never, undefined);` 로 추출하면 7곳이 1곳으로 줄어든다. 다음에 이 블록을 또 만질 일이 생기면(테스트가 더 늘어날 가능성이 높은 구조) 이번엔 추출을 권장한다.

- **[INFO]** 신규 테스트 제목에 마크다운 강조 문법(`**...**`)이 섞여 있다 — 파일 내 유일한 예외
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:232` (`it('409 도 캐시되지 않는다 — **R8 위반 상태를 고정하는 캐너리**', ...)`)
  - 상세: 같은 파일의 다른 10개 `it(...)` 제목(`:81`~`:318`)은 전부 순수 텍스트이거나 코드 조각에 백틱(`` ` ``)만 쓴다(예: `:287` `` `status`/`statusCode` 가 없는 응답에서도... `` ). 이번에 추가된 이 제목만 마크다운 굵게 문법(`**...**`)을 썼다 — Jest 리포터는 마크다운을 렌더링하지 않으므로 테스트 실패 로그·CI 콘솔에 `**R8 위반...**` 처럼 별표가 문자 그대로 출력된다. 기능에는 영향 없는 순수 스타일 문제다.
  - 제안: `it('409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리', ...)` 로 별표를 제거해 파일 내 나머지 제목들과 통일. 강제 수정 사유는 아님.

- **[NONE]** 신규 테스트 2건 자체의 구조·가독성은 양호
  - 위치: `idempotency.interceptor.spec.ts:232-259`(409 캐너리), `:261-285`(손상 JSON fallback)
  - 상세: 두 테스트 모두 기존 블록의 `makeRedis`/`makeContext`/`makeCallHandler` 헬퍼를 그대로 재사용하고, 각자 무엇을 고정하는지(캐너리인 이유, catch 분기가 캐시 히트의 다른 갈래라는 것)를 테스트 바로 위 주석으로 명확히 설명한다. 새 매직 넘버·중첩·복잡도 증가 없음.

- **[NONE]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신 — 산문 문서, 코드 유지보수성 기준 비적용
  - 위치: 해당 파일 `## 잔여 warning...` 절 근방(백로그 항목 추가·문구 좁힘)
  - 상세: 함수/클래스/중첩/매직넘버 등 판단 대상이 되는 코드가 아니다.

- **[NONE]** 이전 3라운드가 이미 검토·수렴한 12개 소스 파일(README, package.json 포함) — 재확인 결과 그 사이 변경 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`, `chat-channel.dispatcher.ts`, `execution-engine.service.ts`, `executions.service.ts`, `idempotency.interceptor.ts`, `triggers/dto/chat-channel-config.dto.ts`, `triggers.service.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`, `migrate-node-output-refs.ts`/`.spec.ts`, `README.md`, `package.json`
  - 상세: 전부 `no-unsafe-*` lint warning 처분을 위한 타입 주석/제네릭/단언 추가뿐이며(로직 변경 없음, side_effect 리뷰가 emit md5 동일로 실증 승계), 콜백 시그니처 반복 6곳(`migrate-node-output-refs.ts`)·`HttpResponseLike` 네이밍·`Array.isArray` 주석 반복 2곳 등 앞선 라운드의 상세 판정(전부 조치 불요)이 그대로 유효하다. 이번 diff 에서 이 파일들의 hunk 는 직전 라운드와 바이트 단위로 동일하다.

- **[NONE]** `review/code/2026/08/12/{11_06_12,12_05_39,12_24_14}/*` 리뷰 산출물 커밋 — 코드 아님
  - 상세: RESOLUTION/SUMMARY/reviewer md/meta.json/`_retry_state.json` 전부 산문·구조화 데이터 문서로, 함수 길이·중첩·매직넘버 등 코드 유지보수성 기준이 적용되지 않는다. 저장소 표준 워크플로(구현 완료 후 `/ai-review` 산출물 커밋)에 부합.

## 요약

이번 라운드의 실질 신규 코드 변경은 `idempotency.interceptor.spec.ts` 에 테스트 2건을
추가하고 1건을 개명한 것뿐이며, 둘 다 기존 헬퍼를 재사용하고 의도를 주석으로 명확히 설명해
가독성은 양호하다. 다만 (1) 같은 describe 블록의 생성자 인라인 반복이 5곳에서 7곳으로 더
늘었고(이전 두 라운드가 이미 INFO 로 남긴 지점이 계속 성장 중), (2) 신규 테스트 제목 하나가
파일 내 유일하게 마크다운 굵게 문법을 써 나머지 제목들과 스타일이 어긋난다. 둘 다 INFO 수준의
경미한 사항으로 강제 수정 대상은 아니다. 나머지 12개 소스 파일·README·package.json 은 이전
3라운드의 상세 판정(전부 NONE)이 변경 없이 그대로 유효하고, 이번 델타에 새로 포함된 이전
라운드 리뷰 산출물(md/json)은 코드가 아니라 유지보수성 기준 적용 대상이 아니다. CRITICAL/WARNING
급 유지보수성 결함은 없다.

## 위험도

NONE
