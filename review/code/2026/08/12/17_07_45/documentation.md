# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** plan 완료 narrative 가 `16_29_45` 라운드는 두 번 인용하면서 정작 이번 diff 에 포함된 **3번째 라운드(`16_53_26`)의 자매 케이스(400) 누락 발견·조치는 인용하지 않는다**
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:577-610` (특히 592행 `> **⚠️ 위 "완료" 는 1차 시도 기준이고, 그 시도는 실패였다 (\`16_29_45\` CRITICAL).**` 이후 블록, 마지막 줄은 610행 `> 있는지부터 확인해야 한다.`)
  - 상세: 이 항목의 "완료" 인용구는 스스로 확립한 컨벤션 — 각 시도를 리뷰 라운드 ID(`16_29_45`)로 인용해 "무엇을 근거로 몇 차 시도가 실패/성공했는지" 추적 가능하게 하는 것 — 를 갖고 있다. 그런데 이번에 함께 커밋되는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 의 `400 VALIDATION_ERROR` 테스트 주석(246-249행)은 "종전에는 409·410·5xx·404 만 error 채널로 바꾸고 이 400 만 옛 형태로 남겨 뒀는데 … 어떤 테스트도 RED 가 되지 않았다(`16_53_26` WARNING 실측)" 라고 정확히 `16_53_26` 라운드를 인용하고, `review/code/2026/08/12/16_53_26/RESOLUTION.md` 도 이 사실을 상세히 기록한다. 즉 **코드 주석과 review 산출물에는 이 3번째 시도의 근거가 남아 있는데, 그 근거를 요약해 최종 기록으로 남기는 자리인 plan 의 완료 narrative 에는 빠져 있다** — "1차 실패 → 2차 재설계로 성공" 까지만 서술하고 멈춰, 실제로는 2차 성공 이후에도 같은 결함 클래스(mock 이 만드는 상태 ≠ 실제 발생 상태)가 형제 케이스(400)에 한 번 더 남아 있었다는, 이 프로젝트가 반복적으로 중요하게 취급해 온 교훈("자매 자리 누락")이 SoT 문서에서 누락된다. `review/**` 는 이 저장소 컨벤션상 SoT 가 아니므로(사용자 메모리: "review/** 는 SoT 아님 — 미룬 항목은 그 턴에 plan/ 에 적어라"), 이 3차 조치 사실이 plan 에도 남아야 다음에 이 항목을 다시 읽는 사람이 review 디렉토리를 뒤지지 않고도 전체 경위(1차 dead code → 2차 재설계 → 3차 자매 케이스 통일)를 알 수 있다.
  - 제안: 606행(`> \`makeThrowingHandler\` 로 전부 error 채널을 행사하게 바꿨다.`) 뒤에 짧은 문단을 추가 — 예: "**3차(`16_53_26`)에서 자매 자리 하나를 더 놓친 것이 발견됐다** — 409·410·5xx·404 는 error 채널로 바꿨는데 `400` 테스트만 옛 성공-채널 mock 으로 남아 있었다. `isErrorStatusCacheable` 에 `=== 400` 을 잘못 추가해도 어떤 테스트도 RED 가 되지 않는 상태였고, `makeThrowingHandler` 로 교체해 닫았다."

- **[INFO]** (기존에 이미 트리아지된 항목, 재확인만) 클래스 상단 요약 JSDoc 이 여전히 "캐시 히트 시 409/410 을 예외로 재현" 을 bullet 로 요약하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:49-71` (클래스 docstring)
  - 상세: 49-57행의 5개 bullet 은 "같은 키로 재요청 시 같은 응답을 그대로 재현", "같은 키+다른 body 는 409 Conflict" 만 언급하고, 이번 라운드들이 새로 구현한 "캐시된 409/410 은 예외로 재throw 해 재현한다"(135-140행)는 사실은 클래스 최상단 요약에 없다. 메서드/필드 수준 docstring(`cacheTapped`, `isErrorStatusCacheable`, `IdempotencyEntry.responseJson`)은 정확하므로 오독 위험은 낮다. 이 항목은 `review/code/2026/08/12/16_53_26/documentation.md` INFO #1 로 이미 지적됐고 `review/code/2026/08/12/16_53_26/RESOLUTION.md` INFO 처분표에서 **"조치 불요"** 로 명시적으로 트리아지됐다 — 새 지적이 아니라 그 결정이 이번 라운드에도 유지되고 있음을 확인하는 기록.
  - 제안: 없음(이미 의도적으로 미조치 결정됨). 다음 라운드에서 재지적할 필요 없음.

- **[INFO]** CHANGELOG·구현 docstring/인라인 주석·spec(`data-flow/15`, `5-system/14-external-interaction-api.md` §R8)·plan 체크리스트·테스트 파일 모듈 docstring 이 최종 상태(3라운드 누적) 기준으로 모두 상호 정합함을 재확인
  - 위치: `CHANGELOG.md:3-29`(특히 26-29행 `requestId` 는 재현 대상이 아니라는 caveat — `16_53_26` 라운드에서 추가된 것이 정확히 반영됨), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:40-241`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-20`(모듈 docstring), `spec/data-flow/15-external-interaction.md:258`, `spec/5-system/14-external-interaction-api.md:1053-1058`(§R8 원문, 이번 diff 밖이지만 SoT — 구현과 완전히 일치), `plan/in-progress/backend-lint-gate-broken-on-main.md:549-611`
  - 상세: (1) CHANGELOG 는 1차 시도가 실패였던 이유(RxJS error 채널·`@HttpCode(202)` 선고정)까지 포함해 정직하게 서술하고, `requestId` 비재현 caveat 도 정확하다. (2) 구현의 클래스/메서드/필드 docstring 은 "선재 결함이다" 류의 옛 서술을 전부 제거하고 새 아키텍처(성공/에러 두 채널)를 정확히 설명하며, `isErrorStatusCacheable` JSDoc 의 "네 경우 모두 spec 에 회귀 테스트가 있다" 주장은 실제 4건(409/410/5xx/404 각 1건)과 정확히 대응한다. (3) 테스트 파일 모듈 docstring(11-15행)은 "R8 위반 상태를 고정하는 캐너리"라는 옛 서술 없이 "닫힌 목록을 고정하는 회귀 테스트"로 정정돼 있다(`16_29_45` WARNING #6 의 fix 가 유지됨). (4) spec `data-flow/15` 의 "⚠️ 현행 구현 갭" caveat 삭제는 실제로 갭이 닫혔으므로 정합하고, `5-system/14` §R8 본문(이번 diff 밖)과 구현이 완전히 일치한다(닫힌 목록 = 2xx·409·410, `>= 400`/`=== 400` 두 오답 모두 명시). (5) plan 체크리스트는 `[x]` 로 완료 처리하면서도 1차 실패 원인·교훈을 감추지 않고 남겼다(단, 위 WARNING 이 지적하듯 3차분만 누락).
  - 제안: 없음 — 참고용 기록.

## 요약

이번 3라운드 누적 diff(`eia-r8-cache-scope` → `16_29_45` CRITICAL 발견 → 재설계 → `16_53_26` WARNING(자매 케이스 400 누락) 발견 → 조치)의 최종 상태를 문서화 관점에서 검토한 결과, CHANGELOG·구현 docstring/인라인 주석·spec 미러(`data-flow/15`, `5-system/14` §R8)·테스트 파일 모듈 docstring 은 모두 코드의 최종 동작과 정확히 일치하며 "오래된 주석" 류의 결함은 없다. 유일한 실질 발견은 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 narrative 가 스스로 확립한 "라운드 ID 인용" 컨벤션을 3번째 라운드(`16_53_26`)에서 지키지 않아, 코드 주석과 review 산출물에만 남아 있는 "자매 케이스 누락" 교훈이 SoT 인 plan 문서에서 빠졌다는 점(WARNING)이다. 그 외 클래스 상단 요약 JSDoc 이 에러 채널 캐시를 bullet 로 요약하지 않는 점은 이전 라운드에서 이미 "조치 불요"로 트리아지된 INFO 이며 새로운 지적이 아니다. README·API 문서·환경변수 문서화가 필요한 새 표면은 없다.

## 위험도

LOW
