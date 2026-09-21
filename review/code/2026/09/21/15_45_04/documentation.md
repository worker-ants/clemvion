# 문서화(Documentation) 리뷰

## 검증 방법

이 세션은 직전 리뷰(`review/code/2026/09/21/15_18_16`)의 WARNING 1(`CHANGELOG.md` 관례 미이행) +
INFO 5건(문서 관련: INFO1·INFO3·INFO5·INFO7·INFO9)에 대한 **후속(resolution) 커밋**을 포함한
전체 diff를 검토 대상으로 한다. `Read`/`Bash(grep)`으로 저장소 원본을 직접 열어 각 문서·주석·
CHANGELOG 항목의 실측 주장을 재대조했다(저장소에 쓰기 없음).

- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `findById` JSDoc의 호출자
  목록(`findByIdForResponse`/`update`/`regenerate`/`remove`/`reveal`/`getUsage`)을 `findById(`
  전수 grep으로 재대조 → **정확**(6곳 모두 일치, 누락·과잉 없음).
- `spec/5-system/3-error-handling.md` §1.11 — `throwAuthConfigNotFound()` JSDoc이 인용한 "이
  저장소의 유일한 `_NOT_FOUND`≠404 예외" 문구를 원문(§1.11, `AUTH_CONFIG_NOT_FOUND` 400) 대조 →
  **정확**.
- `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts` — e2e 헤더 주석의
  "204, `{ok:true}` 아님" 주장을 `@HttpCode(HttpStatus.NO_CONTENT)` 실물과 대조 → **정확**.
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — RESOLUTION.md가
  주장하는 INFO3(죽은 `remove` mock 필드 제거)·INFO9(no-op `mockClear` 제거)가 실제로 반영됐는지
  현재 파일을 직접 읽어 확인 → **정확**(두 항목 모두 반영 확인).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 여덟 번째(`ModelConfigService`)·
  아홉 번째(WebAuthn) 트래커 항목이 실재하는지, `CHANGELOG.md`의 "남는 것" 서술과 내용이
  일치하는지 대조 → **정확**(캐시 무효화 `notifyInvalidated` 중복·컨트롤러 축 감사라는 세부까지
  양쪽이 일치).
- `CHANGELOG.md`의 형제 서수(일곱 번째/여섯 번째/다섯 번째) 계산을 `#1369(2)+#1370+#1371+#1372(
  +#1373)` 로 직접 재계산 → **정확**.

## 발견사항

- **[INFO]** 인라인 주석이 세션-스코프 리뷰 발견 번호를 영구 식별자처럼 인용한다 — 세션 ID 없이는
  향후 추적 불가.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:302` (`remove()` 진입부,
    `// 아래 delete() 의 affected === 0 판정과 기능적으로 겹친다(리뷰 INFO 1) — 그래도`)
  - 상세: `(리뷰 INFO 1)`은 `review/code/2026/09/21/15_18_16/SUMMARY.md`의 INFO #1을 가리킨다.
    그런데 SUMMARY의 INFO 번호는 **그 리뷰 세션 안에서만** 유일하다 — 다음 번 이 파일을 리뷰하는
    세션(예: 이번 `15_45_04`)도 다시 "INFO 1"부터 번호를 매기므로, 코드에 영구히 남는 주석이
    가리키는 대상이 시간이 지나면 모호해진다. 이 저장소의 기존 관례는 `#1369`~`#1373`처럼
    **전역적으로 유일한 트래커/PR 번호**를 인용하는 것인데(같은 파일의 다른 주석들, `V001__
    initial_schema.sql:210` 등), 이 한 줄만 세션-로컬 식별자를 썼다.
  - 제안: 인용을 `review/code/2026/09/21/15_18_16 SUMMARY INFO 1` 처럼 세션 디렉터리(날짜/시각)를
    포함하거나, 세션 참조 없이 "선행 SELECT가 뒤이은 delete() 판정과 기능적으로 겹친다"는 근거만
    남기고 리뷰 세션 식별은 plan 체크리스트(이미 기록돼 있음)에만 두는 편이 더 오래 간다. 차단
    사유는 아님 — 같은 파일에 실제 근거(SELECT 유지 이유)가 함께 서술돼 있어 주석 자체의 의미는
    "INFO 1" 참조 없이도 이해 가능하다.

- **[INFO]** `_resolution_log.md`의 타임스탬프가 파일 내 등장 순서와 시간 순서가 어긋난다 — 감사
  로그로서의 신뢰도를 낮춘다.
  - 위치: `review/code/2026/09/21/15_18_16/_resolution_log.md` (7~9번째 줄 `stage=lint/unit/build`,
    10~11번째 줄 `item=WARNING1`/`e2e attempt=1`)
  - 상세: 파일에 적힌 순서대로 타임스탬프를 읽으면 `06:30:16`(init) → `06:35:00`(INFO5) →
    `06:35:00`(INFO1) → `06:36:00`(INFO3) → `06:36:00`(INFO9) → `06:37:00`(INFO7) →
    **`06:30:59`(lint)** → **`06:31:51`(unit)** → **`06:33:09`(build)** → `06:42:00`(WARNING1) →
    **`06:39:15`(e2e 시작)** → `06:43:00`(done) 순으로, lint/unit/build 줄과 e2e 시작 줄이 그
    앞뒤 줄보다 **더 이른 시각**을 기록하고 있다(시간이 거꾸로 간다). 로그가 실행 순서대로
    append됐다는 전제로 읽으면 혼란스럽고, "이 로그로 무슨 일이 언제 일어났는지 재구성한다"는
    감사 로그의 목적을 부분적으로 훼손한다. 결과 자체(`_resolution_state.json`의 합계 1+4+1+8=14
    가 SUMMARY 총 14건과 일치, `RESOLUTION.md` 표와도 일치)는 정확해 실질적 오도는 없다.
  - 제안: 차단 사유 아님(하네스가 자동 생성하는 로그이고 결론 수치는 정확). 다음에 이 로그
    포맷을 다룰 일이 있으면 타임스탬프 기준 정렬 또는 "단계(stage)"와 "항목(item)" 로그를
    분리된 절로 묶어 순서 혼동을 없애는 것을 고려.

## 확인된 항목 (문제 없음)

- `CHANGELOG.md`의 신규 두 항목(`auth_config.delete` 일곱 번째, `member.removed` 여섯 번째
  backfill) — 서수 계산·판별자 서술·판별력 실측 수치(`[204,404]`/`[200,404]`, 감사 1건)가 모두
  실제 코드·plan·e2e 주석과 일치한다.
- `findById()` JSDoc의 호출자 목록 재작성(직전 리뷰 INFO 5 대응) — 전수 grep 대조 결과 정확.
- `throwAuthConfigNotFound()` JSDoc의 "형제 자리(`triggers.service.ts`의 400
  `AUTH_CONFIG_NOT_FOUND`)와 다른 자리" 서술 — `spec/5-system/3-error-handling.md` §1.11 원문과
  정확히 일치.
- `remove()` 본문의 상세 인라인 주석(원자적 DELETE 근거, `affected === 0` 명시 비교 규율,
  `remove(entity)`→`delete(criteria)` 무영향 근거) — 모두 실측 근거(entity 파일, migration 파일)로
  뒷받침되며 코드 동작과 일치.
- 신규 e2e 스펙(`auth-config-delete-concurrency.e2e-spec.ts`)의 헤더 주석 — 204/`RESOURCE_NOT_FOUND`
  실측 주장이 컨트롤러 원본과 일치, "형제와 다른 자리"를 미리 실측해 착수 전 오판을 방지한 사례.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`의 두 정정 — 자기 자신이 등재한
  틀린 근거(`RolesGuard` 없음)를 취소선 + 정정 문단으로 투명하게 고쳤고(CLAUDE.md
  "자기-반증형 소정정" 정신과 부합하는 rationale-continuity 모범 사례), 열거형 항목의
  고정 목록→재열거형 전환도 "다섯 번 확장됐다"는 근거를 실측(grep)으로 뒷받침한다.
- `RESOLUTION.md`/`_resolution_state.json`/`_resolution_log.md` 3파일 간 수치 정합 — 처리 항목
  개수(1+4+1+8=14)가 SUMMARY.md 총 14건과 정확히 일치, 무조치 사유 서술도 SUMMARY 원문과 부합.
- README/API 문서 갱신 불요 판단 — 이번 변경은 외부 API 계약(204/404 `RESOURCE_NOT_FOUND`)을
  바꾸지 않고 신규 환경변수·설정도 없어 README·API 문서 갱신 대상이 아니라는 이전 라운드의
  결론이 실측과 일치한다(직접 재확인).

## 요약

직전 라운드(`15_18_16`)가 지적한 유일한 WARNING(`CHANGELOG.md` 관례 미이행)은 이번 diff의
`197425f51` 커밋으로 정확히 해소됐고, 함께 지적된 문서 관련 INFO(JSDoc 호출자 목록 재작성,
죽은 mock 필드·no-op `mockClear` 제거, e2e 감사 필터 정렬)도 실측 대조 결과 모두 정확히
반영됐다. `CHANGELOG.md` 신규 두 항목·`throwAuthConfigNotFound()` JSDoc·`remove()` 인라인
주석·신규 e2e 헤더 주석은 실제 코드·spec 원문과 전부 일치했고, plan 문서의 자기 정정도
투명하게 기록돼 있다. 새로 발견한 것은 차단 사유가 아닌 INFO 2건뿐이다: (1) 코드에 영구히
남는 주석이 세션-스코프 리뷰 발견 번호("리뷰 INFO 1")를 인용해 향후 추적성이 떨어질 수 있는
점, (2) `_resolution_log.md`의 타임스탬프가 파일 내 등장 순서와 어긋나 감사 로그로서의
가독성이 다소 떨어지는 점. 둘 다 결론 수치나 코드 정확성에는 영향이 없다.

## 위험도

LOW
