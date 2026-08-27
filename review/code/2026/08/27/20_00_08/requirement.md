# 요구사항(Requirement) Review — eia-misc-hygiene (`20_00_08`)

## 검토 방법

이 changeset 은 두 부분으로 구성된다: (a) `044a2e19e` — plan 트래커에 사전 등재된 5개 위생
항목(Swagger 헬퍼 추출·`redactNodeExecutionRow` 리네임·`node-output-allowlist.ts` 재배치·
`EIA-AU-09` JSDoc 오기 정정·`websocket.service.spec.ts` describe 재배치) + spec/plan 문서 동기화,
(b) `7531816ad` — 직전 리뷰 라운드(`review/code/2026/08/27/19_36_17/`)가 낸 WARNING 2건·INFO 2건에
대한 fix 커밋. 프롬프트에 실린 파일 중 다수(`review/code/2026/08/27/19_36_17/*.md`)는 그 직전
라운드의 리뷰 산출물 자체이므로, 이번 요구사항 리뷰는 그 산출물을 "1차 소견"으로 참고하되
**직접 저장소를 열어 각 주장·fix 를 재실측**했다.

실측 항목:
- `swagger-probe.ts`/`websocket.service.spec.ts` 를 `Read` 로 직접 열어 W1·W2 fix 가 실제로
  반영됐는지 확인 (아래 상세).
- `grep -rn "redactNodeExecutionRow\b"`(구 이름, `ForResponse` 제외) — 저장소 전체 0건.
- `grep -rn "shared/utils/node-output-allowlist"`(구 경로) — 코드 0건(plan 문서의 동결된 이력
  인용 1건만 남음, 의도된 것).
- `git show 044a2e19e^:.../shared/utils/node-output-allowlist.ts` 와 이동 후
  `nodes/core/node-output-allowlist.ts` 를 `diff` — **상대 import 경로 한 줄만 다르고 완전
  동일**(`NODE_OUTPUT_ALLOWED_KEYS` 13개 키·`allowlistNodeOutputKeys` 로직 불변).
- `spec/5-system/14-external-interaction-api.md` 전체에서 `EIA-AU-09` 잔존 여부, `EIA-AU-08`/
  `§3.3.1` 실재 여부 확인.
- 영향받는 8개 spec 파일을 `jest` 로 직접 실행 — **8 suites / 159 tests 전부 PASS**.
- 변경 파일 전체에서 `TODO|FIXME|HACK|XXX` grep — 0건.
- `redactNodeExecutionRowForResponse` 신규 `@param`/`@returns` JSDoc 을 실제 구현(3컬럼·
  copy-on-change)과 대조 — 일치.

## 발견사항

(없음 — CRITICAL/WARNING 급 요구사항 결함 없음)

이전 라운드(`19_36_17`)가 낸 두 WARNING 은 이번 커밋(`7531816ad`)에서 **실제로 해소됨을 직접
확인**했다:

- **W1 (`swagger-probe.ts` 고아/중복 JSDoc)** — 해소 확인. 현재 `schemasOf`(:59-63) 위에는
  `schemasOf` 를 설명하는 블록 하나만, `schemaOf`(:83-90, 선언 :91) 위에는 `schemaOf` 를
  설명하는 블록 하나만 있다. 중복·오귀속 없음.
- **W2 (`websocket.service.spec.ts` 이동된 JSDoc 이 엉뚱한 테스트를 설명)** — 해소 확인.
  `_retryState`/`EIA §R17`/`#1205` 근거를 담은 원 JSDoc(:800-811)이 실제 대상인
  `describe('nodeOutput allowlist · fanout 파이프라인 불변식', ...)` 블록의 첫 캐너리
  `it('[캐너리] fanout 의 nodeOutput 에서 allowlist 밖 내부 필드가 제거된다', ...)`(:812) 바로
  위로 옮겨졌고, 이동된 두 llmCalls-strip 테스트(:750-789) 뒤에는 그 describe 분리 이유를
  설명하는 **새 짧은 JSDoc**(:791-798)이 붙었다. 두 관심사(JSDoc)가 더 이상 뒤섞이지 않는다.
- **INFO 2 (2:2 → 3:1 비율 서술 오차)** — 해소 확인. `buildSwaggerDocument` JSDoc 이 이제
  "네 스펙 중 셋은 `{ controllers }`, 하나(`re-run.dto.spec.ts`)는 `{ imports }`" 라고 적혀
  있고, 실제로 `re-run.dto.spec.ts` 만 `imports:` 를 쓴다(grep 재확인).
- **INFO 3 (plan 문서 구 경로 안내)** — 해소 확인. `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md` 의 해당 문단이 `nodes/core/
  node-output-allowlist.ts` 로 정정됐다.

새로 도입된 요구사항 결함은 발견되지 않았다. 아래는 참고용 INFO(직전 라운드가 이미 사유를
기록하고 넘긴 항목 — 재지적 아님, 상태만 확인):

- **[INFO]** `buildSwaggerDocument` 의 "`createDocument` 가 던져도 `finally` 로 `app.close()`
  가 실행된다" 는 보장에 대한 직접 회귀 테스트는 여전히 없다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` (`buildSwaggerDocument`,
    36-44행대)
  - 상세: `RESOLUTION.md` 가 "Nest 내부 결합·프레임워크 업그레이드 리스크 > 방어 가치" 로
    명시적으로 넘긴 항목이며 이번 라운드에서도 변경이 없다. 기능 결함이 아니라 커버리지 갭이고,
    이미 근거와 함께 기록됐으므로 차단 사유 아님.
  - 제안: 조치 불요(기록된 판단 유지). 재요청 시에만 재검토.

## 관련 spec 본문 일치 여부 (spec fidelity)

- **EIA §3.3/§3.3.1** (`spec/5-system/14-external-interaction-api.md:112,114`): `EIA-AU-08` 만
  정의돼 있고 `EIA-AU-09` 는 spec 어디에도 정의된 적이 없음을 저장소 전체 재검색으로 확인
  (`plan/complete/spec-text-fixes.md` 의 과거 판정과도 일치). `interaction.guard.ts:27` 의 JSDoc
  이 `[Spec EIA §3.3 EIA-AU-08 + §3.3.1 EIA-AU-09]` → `[Spec EIA §3.3 EIA-AU-08 + §3.3.1]` 로
  바뀐 것은 **spec 이 옳고 코드 주석의 오기를 정정**한 것 — 코드가 spec 을 정확히 반영하도록
  고쳐졌다. `§3.3.1` 참조는 그대로 살렸는데, 그 절이 실재("3.3.1 Implementation Note —
  in-process trusted caller 오염 방지 (EIA-AU-08)")하므로 타당하다.
- **`spec/conventions/node-output.md:60`**, **`spec/5-system/14-external-interaction-api.md:9`
  (`code:` frontmatter)**, **`spec/conventions/egress-masking.md:8`**: 각각
  `node-output-allowlist.ts` 의 새 경로(`nodes/core/`), `redact-stored-error.ts` 의 `code:`
  등재를 실제 코드 위치·구현 존재와 대조 — 전부 일치.
- 이번 diff 가 EIA §R17 의 allowlist **키 집합 자체**(표·배열)를 바꾸지 않았으므로(순수 파일
  이동, 내용 byte-identical 확인) 그 표의 line-level 정합은 이번 changeset 의 스코프 밖이며
  기존 상태가 유지된다.

## 요약

이번 changeset 은 순수 위생(hygiene) 정리로, 직전 리뷰 라운드가 지적한 WARNING 2건(리팩터링
과정에서 JSDoc 이 원래 설명 대상에서 분리되어 엉뚱한 코드를 설명하게 된 것 — 이 PR 이 스스로
표방하는 "주석-코드 일치" 규율을 역설적으로 어겼던 문제)이 후속 fix 커밋에서 실제로 해소됐음을
직접 소스를 열어 확인했다. 리네임(`redactNodeExecutionRow`→`…ForResponse`)·파일 이동
(`node-output-allowlist.ts`)은 grep 전수 재확인 결과 구 이름/구 경로 잔존 0건이고, 이동된
allowlist 상수·함수는 import 경로 한 줄 외 완전히 동일해 fail-closed 보안 경계가 이동 중
훼손되지 않았다. `EIA-AU-09` JSDoc 정정은 spec 본문과 정확히 일치하는 방향의 수정이다. 영향받는
8개 spec 파일을 직접 실행해 159개 테스트 전원 통과를 확인했고, TODO/FIXME 류 미완성 마커는
0건이다. 요구사항 관점에서 CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
