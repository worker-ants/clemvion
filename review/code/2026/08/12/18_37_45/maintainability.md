# 유지보수성(Maintainability) 리뷰

## 사전 확인 — 이 라운드의 실제 diff 범위

`git log` 기준 마지막 코드 변경 커밋은 `147075a51`(18:27:21, `IDEM-3` e2e + 순환참조 방어 테스트
추가)이고, 이번 리뷰가 보는 최신 커밋 `02e80d699`(18:37:24)는 `plan/**` 문서 2건만 건드리는
`chore` 커밋(개발자가 §2.2 caveat 을 지운 사실을 planner plan 에 사후 기록)이라 **코드
(`idempotency.interceptor.ts`/`.spec.ts`/`external-interaction.e2e-spec.ts`)에는 이번 커밋으로
인한 변경이 없다.** 즉 이 라운드가 보는 코드는 `16_29_45`~`18_07_36` 네 라운드가 이미 반복
검토·수정한 바로 그 최종 상태다. 아래는 그 최종 상태를 처음부터 다시 정독한 결과다.

## 발견사항

- **[INFO]** (선재·4라운드 연속 유예) `isErrorStatusCacheable` 판정 결과를 소비하는 두 지점
  (`intercept()` 의 캐시 히트 replay, `cacheTapped()` 의 `catchError`)에서 `JSON.parse` 호출이
  타입만 다르게(`Record<string, unknown>` vs `unknown`) 한 번씩 더 반복된다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`,
    `:143` (`intercept()` 내부)
  - 상세: 이미 `16_53_26`~`18_07_36` RESOLUTION 이 "선택적 개선" 으로 4라운드 연속 유예한
    항목과 동일하다 — 새로 발견된 것이 아니라 상태 확인. `intercept()` 자체 길이(약 62줄,
    라인 88-150)와 `err.getResponse()`/`cached.responseJson` 파싱의 비대칭 팩터링도 같은
    사유로 유예됐다.
  - 제안: 지금 손대지 말 것 — 이번 재설계 diff 를 흐린다는 것이 반복된 판단이었고, 이번
    라운드에서도 그 판단을 뒤집을 새 근거가 없다.

- **[INFO]** `cacheTapped()` 의 성공 채널 판정이 `statusCode < 200 || statusCode >= 300` 두
  리터럴 상수로 인라인돼 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177`
  - 상세: `200`·`300` 은 HTTP 상태코드 대역이라 의미가 자명하고 바로 위 주석("성공 채널에서
    오는 것은 2xx 뿐" · "3xx 는 이 API 가 내지 않으므로 목록에 없다")이 근거까지 설명해
    가독성에 실질적 영향은 없다. 다만 파일 상단에 이미 `TTL_SEC`·`MAX_KEY_LENGTH` 같은 이름
    있는 상수 컨벤션이 있으니, 이 대역이 다시 바뀔 일이 생기면(예: 3xx 캐싱 재도입 논의)
    `HTTP_SUCCESS_MIN`/`HTTP_SUCCESS_MAX` 류로 이름을 붙이는 편이 검색성이 조금 더 낫다.
  - 제안: 선택 사항. 지금 바꿀 필요는 없다.

- **[INFO]** (선재·4라운드 연속 유예) `IDEM-1`/`IDEM-2` e2e 테스트가 `node`/`execution`/
  `node_execution` INSERT 3개짜리 셋업 블록(약 25줄)을 완전히 동일하게 반복한다.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:375-399` (`IDEM-1`),
    `:452-476` (`IDEM-2`)
  - 상세: 같은 패턴이 이 파일의 기존 `G`(271행대)·`G-2`(318행대) 테스트에도 이미 존재해,
    이번 diff 가 새로 도입한 스타일이 아니라 파일 전체의 확립된 관행(각 테스트를 독립적으로
    읽을 수 있게 하려는 의도적 선택)을 따른 것이다. `18_07_36` RESOLUTION 이 이미 이 클래스의
    반복을 "유예 유지(4라운드 연속 선택 사항)" 로 처분했다.
  - 제안: 조치 불요. 이런 대기 노드 셋업이 5번째·6번째로 더 늘어나면 그때 헬퍼 추출을
    고려할 문턱으로 남겨 둔다.

- **[INFO]** `isErrorStatusCacheable()` named 함수 추출은 잘 됐다 — 감점이 아니라 긍정 확인.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:255-257`
  - 상세: 직전 라운드(`16_29_45`)에서 인라인 익명 조건식이던 것을 named export 로 뽑아,
    `intercept()`(캐시 히트 replay)와 `cacheTapped()`(`catchError` 적재) 두 소비처가 같은
    단일 출처를 참조한다. 이 프로젝트가 반복 학습한 "판정 로직은 이름 있는 단일 출처로" 원칙과
    정확히 맞고, JSDoc 이 "단일 비교로 축약 금지" 근거(`>= 400`/`=== 400` 각각 왜 틀린지)까지
    코드 옆에 남겨 향후 같은 오답의 재발을 막는다.
  - 제안: 없음.

## 요약

이번 라운드에서 리뷰 대상 코드(`idempotency.interceptor.ts`/`.spec.ts`/
`external-interaction.e2e-spec.ts`)는 직전 4라운드(`16_29_45`~`18_07_36`)의 반복 검토·수정을
거친 최종 상태이며, 이번 최신 커밋은 코드가 아닌 `plan/**` 문서 사후 기록만 건드려 실질적인
새 코드 변경이 없다. 최종 상태 자체를 유지보수성 관점에서 정독한 결과, 캐시 대상 판정이
`isErrorStatusCacheable()` named 함수로 잘 추출돼 두 소비처가 단일 출처를 공유하고, `storeEntry()`
분리로 SET 로직 중복도 제거됐으며, 각 함수는 짧고 이름이 의도를 정확히 드러낸다. 남은 항목
(`JSON.parse` 중복 2곳·`intercept()` 길이·e2e 셋업 반복)은 모두 이전 라운드들이 실측 근거와 함께
반복 검토했고 "선택적 개선, 지금 손대면 diff 를 흐린다" 는 일관된 판단으로 4라운드 연속 유예된
항목들로, 이번 라운드도 그 판단을 유지한다. 새로 발견된 구조적 결함은 없다.

## 위험도

NONE
