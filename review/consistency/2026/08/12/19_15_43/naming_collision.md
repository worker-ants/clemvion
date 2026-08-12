STATUS=success
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — spec/data-flow/ (EIA §R8 idempotency 캐시 스코프 수정)

## 검토 범위 요약

`git diff origin/main...HEAD` 기준 실질 변경은 다음 4개 코드/spec 파일뿐이다 (그 외는 review 산출물·plan 로그):

- `spec/data-flow/15-external-interaction.md` — §2.2 표에서 "⚠️ 현행 구현은 `statusCode >= 400`
  전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" 한 문장 **삭제**만. 신규 식별자 없음.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 신규
  `isErrorStatusCacheable(statusCode)` 함수, 신규 `IdempotencyInterceptor.storeEntry(...)`
  private 메서드, `HttpException`/`throwError` import 추가.
- `idempotency.interceptor.spec.ts` — 신규 테스트 헬퍼 `makeThrowingHandler(err)`.
- `codebase/backend/test/external-interaction.e2e-spec.ts` — 신규 e2e 테스트 3건
  (`IDEM-1`/`IDEM-2`/`IDEM-3`), 신규 로컬 변수 `redis`(ioredis 클라이언트).

target 문서(`spec/data-flow/15-external-interaction.md`)가 새로 **부여**하는 요구사항 ID·엔티티명·
API endpoint·이벤트명·ENV/설정키·파일 경로는 없다 — 이번 변경은 기존 §R8(요구사항 ID `R8`,
`EIA-RL-02`)이 이미 정의한 캐시 정책을 코드가 실제로 준수하도록 고치고, spec 은 그 사실을
반영해 갭 caveat 문장을 지운 것뿐이다. `interaction:idempotency:<key>` Redis 키·`R8`·
`EIA-RL-02`·409/410 상태코드 등은 전부 기존 spec(`spec/5-system/14-external-interaction-api.md`
§R8)에 이미 정의돼 있던 식별자의 재사용이다.

## 발견사항

- **[INFO]** e2e 테스트 ID 접두어 `IDEM-N` 이 파일의 기존 순차 알파벳 컨벤션과 다른 체계
  - target 신규 식별자: `IDEM-1`, `IDEM-2`, `IDEM-3` (`codebase/backend/test/external-interaction.e2e-spec.ts` 371·446·512행)
  - 기존 사용처: 같은 파일의 다른 테스트 케이스 라벨 — `A.`(152행) → `B.`(170행) → `C.`(182행)
    → … → `G.`(271행) → `G-2.`(318행) → `H.`(552행, diff 상 새 위치) → `I.`(590행) →
    `I-2.`(657행) → `J.`(712행)
  - 상세: 이 파일은 지금까지 "알파벳 순번 + 필요 시 `-2` 서브변형" 체계(`A`, `B`, …, `G-2`, `I-2`)
    로 테스트를 식별해 왔다. 이번 PR 은 `G-2` 와 `H` 사이에 `IDEM-1`/`IDEM-2`/`IDEM-3` 라는
    별도 명명 체계(도메인 태그 + 숫자)를 삽입했다. 다른 파일과 충돌하는 식별자는 아니고
    (`grep` 결과 리포지토리 전체에서 `IDEM-1/2/3` 은 이 세 곳 뿐), spec 요구사항 ID 와도
    겹치지 않는다 — 다만 같은 파일 안에서 두 개의 서로 다른 라벨링 규칙이 공존하게 되어,
    다음에 `H` 뒤에 새 케이스를 추가할 사람이 알파벳을 이어갈지 태그 방식을 따라갈지
    판단해야 하는 혼동 여지가 생긴다.
  - 제안: 강제 사항은 아니다(차단 사유 아님). 다음에 이 파일을 만지는 김에 `IDEM-1/2/3` 을
    기존 알파벳 순번(`H-2`/`H-3`/`H-4` 또는 새 문자)으로 재명명하거나, 반대로 앞으로는
    도메인 태그 방식(`IDEM-`, `AUTH-` 등)을 표준으로 전환한다는 결정을 plan 에 남겨 두면
    향후 동일 파일에 대한 리뷰에서 "왜 두 체계가 섞여 있나"를 재조사할 필요가 없어진다.

## 요약

이번 변경은 `spec/data-flow/` 가 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키·spec
파일을 도입하는 작업이 아니라, 기존 §R8 idempotency 캐시 정책(이미 spec 에 정의됨)을 코드가
실제로 지키도록 고치고 spec 의 갭 caveat 한 문장을 지운 것이다. 코드 레벨에서 새로 등장한
식별자(`isErrorStatusCacheable`, `storeEntry`, `makeThrowingHandler`, e2e 변수 `redis`)는
저장소 전체에서 유일하며 기존 식별자와 의미 충돌을 일으키지 않는다. 유일한 관찰 사항은 신규
e2e 테스트 라벨(`IDEM-1/2/3`)이 같은 파일의 기존 알파벳 순번 컨벤션과 다른 체계를 쓴다는
점으로, 이는 명명 "충돌"이 아니라 "일관성" 이슈이며 등급도 INFO 에 그친다.

## 위험도
LOW
