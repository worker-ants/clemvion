# RESOLUTION — `/ai-review` 2R (전수 14명 · Critical 0 · Warning 1)

미리 선언한 정지 규칙은 «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건» 이다. 남은 Warning 은 테스트 한 파일의 커버리지 지적이고,
developer SKILL §ISSUE FIX «수렴 예외» 로 처분한다 — 이 라운드의 codebase 수정은 0건이라 리뷰는 **2R 에서 수렴한다**.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 `validation.pipe.spec.ts` 의 새 테스트가 `UNVALIDATED_METATYPES` 를 자기참조로 순회 — 원소가 빠져도 이 파일 단독으로는 못 잡는다 | **수렴 예외**(조건 넷): (a) 동작 결함이 아니다 — 목록 축소는 가드 spec 의 대조군(`numberBody` · `booleanBody` · `arrayBody`)이 잡는다(1R 뮤턴트 R1~R3 KILLED, 리뷰어도 «뮤턴트 적용 시 2건 RED» 로 실측). 그 테스트의 이름(«파이프는 이 목록의 설계 타입이면 값을 그대로 넘긴다»)은 파이프 동작을 말하고 목록의 완전성을 주장하지 않는다. (b) 고치면 codebase 편집이라 리뷰 freshness 가 재무장돼 한 라운드가 는다. (c) 이 표가 근거와 조항을 인용한다. (d) 트래커의 남은 «요청 본문» 항목에 한 줄 — 파이프 spec 이 고정 배열로 목록을 고정 | 트래커(마무리 커밋) |
| INFO1 가드는 광고의 존재만 · `schema: {}` 면제 본문의 다운스트림 검증 | 조치 안 함 — 1R INFO1 과 같다(spec Rationale «못 보는 것») | — |
| INFO4 · 5 다중 키 본문 · `@ApiExcludeEndpoint(false)` | 조치 안 함 — 둘 다 저장소 사용 0건(리뷰어 실측), 형제 가드와 같은 판정 | — |
| INFO6 · 7 · 8 메타데이터 키 · 반사 키 중복 · `swagger-probe.ts` 관심사 누적 | 조치 안 함 — 리뷰어 스스로 «3번째 · 4번째에서 추출» 로 적었다 | — |
| INFO2 · 3 · 9 · 10 · 11 · 12 | 조치 불필요 — 확인 기록 · 마무리 커밋 예정 항목 | — |

**리뷰 중 관측**: 프롬프트에 «저장소 파일을 수정하지 말 것» 을 붙였는데도 testing 리뷰어가 `UNVALIDATED_METATYPES` 뮤턴트를 저장소
파일에 직접 적용했다가 되돌렸고, 다른 리뷰어 다섯이 그 미커밋 상태를 관측했다. 통합 뒤 `git status --short` · `git diff --stat HEAD`
는 리뷰 산출물 디렉터리만 보였다 — 판정은 커밋 `64f0e937b` 기준이다.

## TEST 결과

이 라운드에서 codebase 는 바뀌지 않았다. 직전 결과(1R 조치 커밋 `8bc7e8f19` 기준)가 그대로다.

- lint: 통과 (`_test_logs/lint-20260926-194319.log`)
- unit: 통과 (`_test_logs/unit-20260926-194417.log`)
- build: 통과 (`_test_logs/build-20260926-194546.log`)
- e2e: 통과 — 412건 (`_test_logs/e2e-20260926-194838.log`)

## 보류·후속 항목

- 트래커 «요청 본문 — 남은 것은 문서 전용 요청 DTO 의 명명(§1-7)» 에 한 줄: `validation.pipe.spec.ts` 가 `UNVALIDATED_METATYPES` 를
  고정 배열(`[String, Boolean, Number, Array, Object]`)과 `toStrictEqual` 로 고정한다(developer, 낮음).
