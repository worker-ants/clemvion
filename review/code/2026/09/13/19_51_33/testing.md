# 테스트(Testing) 리뷰 — error-code-emission-axis (라운드 2)

## 검토 범위 · 방법

이 배치의 실질 코드는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY`)와 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`(같은 축의 단언 63종, 라운드 1 대비 46→63)다. 나머지(`CHANGELOG.md`·`PROJECT.md`·두 `logic.mdx`·`plan/**`·`review/**`)는 문서/프로세스 산출물이라 테스트 관점 발견사항 대상이 아니다.

라운드 1(`review/code/2026/09/13/19_23_22/testing.md`)이 낸 WARNING 2건(합성 경계 대조군 부재, `where` 프리텍스트)은 `RESOLUTION.md`가 주장한 대로 이번 판본에 반영돼 있음을 직접 확인했다 — `describe("발행 축 수집기 — 경계 대조군", …)`(existence.test.ts:477-551)와 `where` `파일:줄` 파싱 검증(existence.test.ts:202-231)이 실재한다. 전체 스위트를 직접 실행해 63/63 GREEN을 확인했다.

이번 라운드는 새로 추가된 검증 로직 자체를 **뮤테이션으로 재검증**했다(저장소 밖 scratch에 원본을 `cp`해 두고 대상 파일만 고쳤다가 `cp`로 원복 — `git checkout`/`restore` 미사용, 작업 종료 후 `git status --short`로 원복 확인 완료. 두 파일 모두 원복 후 스위트가 다시 63/63 GREEN임을 재확인했다).

## 발견사항

- **[WARNING]** `where` 필드가 **여러 위치를 인용**할 때, 검증 테스트가 **첫 번째 위치만** 확인한다 — 나머지 인용은 검증되지 않은 채 통과한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:202-231` (`` "`where`의 `파일:줄`이 실제로 그 토큰을 담는다 (프리텍스트 방지)" `` 테스트), 대상 데이터는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:346`의 `where: "execution-engine.service.ts:7121·7125 — 템플릿 리터럴 메시지 접두"`.
  - 상세: 검증 로직이 `/([\w./-]+\.ts):(\d+)/.exec(entry.where)` (전역 플래그 없음)를 쓴다. `CONTAINER_MISSING_EMIT` 항목의 `where`는 `7121`과 `7125` **두 줄**을 인용하는데, 이 정규식은 **첫 매치 하나만** 반환하므로 `7121`만 grep 검증되고 `7125`는 한 번도 확인되지 않는다. 뮤테이션으로 직접 확인했다 — `where`를 `"execution-engine.service.ts:7121·9999 — …"`로 고쳐(둘째 줄 번호를 존재하지 않는 값으로) 전체 스위트를 돌리자 **63/63 GREEN 그대로**였다(원복 완료, `git status --short` 클린 확인). 이 라운드가 새로 추가한 "프리텍스트 방지" 테스트(라운드 1 WARNING#6의 fix)가 정확히 겨냥한 결함 클래스("`where`가 단언 없는 산문이면 소스가 움직여도 아무도 모른다")를, **복수-위치 인용 형태에서는 부분적으로만** 막는다는 뜻이다. 이 항목의 `why` 필드도 `where`의 두 줄 다 근거로 언급하므로("`execution-engine.service.ts:7121·7125`"), 검증되지 않은 절반이 조용히 stale 해질 수 있다.
  - 제안: `.exec()` 대신 `matchAll`로 `where` 안의 모든 `파일:줄` 쌍을 걷어 각각을 grep 검증하거나(이 파일이 이미 새 발행 축에서 `matchAll` 관용구를 쓰고 있으므로 패턴이 낯설지 않다), 최소한 `where`에 단일 위치만 적도록 등록 규약을 좁힐 것.

- **[WARNING]** 이 축의 핵심 게이트 술어 `isMessagePrefixOnly`(= `messagePrefixes.has(token) && !quotedLiterals.has(token)`)에 **직접 겨눈 합성 대조군이 없다** — 진단력이 낮은 방식으로만 뮤테이션이 잡힌다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:98-100` (정의부). 이 술어를 실제로 검증하는 자리는 `:255-271`의 `[회귀] MAX_ITERATIONS_EXCEEDED` 테스트(실 코퍼스 토큰 2종, `(T,T)→false`·`(T,F)→true` 두 갈래만 관측)와 `:289-306`의 `[대조군]` 테스트(합성 입력이지만 `isMessagePrefixOnly`를 직접 호출하지 않고 원시 수집기 세 개의 출력만 개별 확인 — 술어 자체는 호출되지 않는다)뿐이다.
  - 상세: 뮤테이션으로 확인했다 — `isMessagePrefixOnly`를 `!quotedLiterals.has(token)`로 바꿔(`messagePrefixes.has(token) &&` 항을 통째로 제거) 스위트를 돌리자 **`RED`가 나긴 했다**(`:167` 베이스라인-0 단언이 `ACTION_ROW`·`MCP_CALL_TIMEOUT_MS` 등 8종을 offender로 쏟아냄, 원복 완료). 즉 이 뮤테이션 자체는 죽지 않는다 — 하지만 실패 메시지가 "8개 토큰이 갑자기 offender가 됐다"는 대량 노이즈이지, "`isMessagePrefixOnly`의 AND-NOT 로직이 깨졌다"는 특정 진단이 아니다. `(F,T)`·`(F,F)` 두 조합(메시지 접두가 아예 아닌 토큰)은 어떤 테스트에서도 직접 관측되지 않는다 — 예컨대 `messagePrefixes.has(token)` 검사 자체를 제거하는 대신 **약화**하는 형태의 뮤턴트(예: `true &&`로 상수화)라면 베이스라인 폭증 없이 통과했을 여지가 있다(이번 세션에서 그 변형까지는 재현하지 않았으므로 확정은 아니고 우려로 남긴다).
  - 제안: `isMessagePrefixOnly`를 `guide-identifier-scan.ts`로 옮겨 export하고(발행 축 수집기들과 같은 위치), `describe("발행 축 수집기 — 경계 대조군", …)`에 형제 블록으로 `describe("isMessagePrefixOnly — 진리표", …)`를 추가해 네 조합(`prefix∧¬quoted`·`prefix∧quoted`·`¬prefix∧quoted`·`¬prefix∧¬quoted`)을 합성 문자열로 직접 고정할 것. 현재는 이 술어가 테스트 파일에만 존재해(export 미공개) 재사용도, 격리된 단위 검증도 안 되는 구조다(테스트 용이성 관점).

## 참고 (INFO — 조치 불요, 확인만)

- 라운드 1 testing.md WARNING(합성 대조군 부재·`where` 프리텍스트)은 이번 판본에서 실제로 고쳐졌고 직접 실행(63/63 GREEN)·뮤테이션(등록 목록 비우기 → RED, `where` 단일-위치 오탐 뮤턴트 → RED)으로 재확인했다. `RESOLUTION.md`가 보고한 6개 뮤턴트 표(등록 비우기·`QUOTED_LITERAL` 역참조·`CATALOG_CODE` 무력화·`MESSAGE_PREFIX` `:` 제거·`collectMatches` 그룹 인덱스·`where` 줄 번호 오프바이원)는 각각 성격이 다른 실패 지점을 겨누고 있어 중복이 아니다.
- `MAX_ITERATIONS_EXCEEDED`가 "카탈로그 덕에 통과한다"던 라운드 1의 잘못된 테스트 제목/JSDoc은 이번 판본에서 "소비자-인용 때문에 통과한다 (카탈로그 아님)"으로 정정됐고(`existence.test.ts:255`), 실제 메커니즘(`quotedLiterals`가 `isMessagePrefixOnly`를 먼저 `false`로 떨어뜨림)과 일치함을 직접 재현해 확인했다.

## 요약

라운드 1이 지적한 두 WARNING(합성 경계 대조군 부재, `where` 프리텍스트)은 실제로 고쳐졌고 스위트 실행·뮤테이션으로 재확인했다. 다만 그 fix 자체가 두 개의 새로운 갭을 남겼다 — (1) `where` 검증이 정규식 단일 매치라 **복수 위치를 인용하는 항목(정확히 `CONTAINER_MISSING_EMIT`, 이 축이 새로 등록한 항목)의 둘째 위치는 한 번도 검증되지 않는다**(뮤테이션으로 확인: 둘째 줄 번호를 존재하지 않는 값으로 바꿔도 GREEN 그대로), (2) 이 축의 핵심 게이트 로직인 `isMessagePrefixOnly`의 AND-NOT 합성 자체를 직접 겨눈 합성 대조군이 없어, 실 코퍼스 토큰 2종에만 의존하고 뮤테이션이 잡히더라도 진단이 뭉툭하다(베이스라인 대량 폭증으로만 드러남). 둘 다 오늘 값은 정확함이 확인됐고 즉시 차단 사유는 아니므로 WARNING으로 분류한다 — 이 저장소가 반복해 강조해 온 "판별 fixture 부재" 클래스의 국소적 재발이다.

## 위험도
LOW
