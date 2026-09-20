# 문서화(Documentation) 리뷰 — schedule-dup-delete (4라운드, `01_16_46`)

## 검토 범위 및 방법

이 diff(`origin/main...HEAD`)는 이미 세 차례 `/ai-review` 를 거쳤다(`00_06_01` → WARNING 4건 조치,
`00_37_06` → WARNING 2건 조치, `00_56_52` → WARNING 1건 조치). 이번 라운드는 `00_56_52` 가 지적한
testing WARNING 1(「`affected === 0` 을 `!affected` 로 되돌리는 뮤턴트가 32건 전건 GREEN 으로
살아남는다」)을 조치한 최신 커밋 `210808701`(`test(schedules): affected === 0 의 이유를 붙드는
대조군`)까지 포함한 상태를 기준으로 검토했다. 실코드 변경은 여전히 3파일
(`schedules.service.ts` · `schedules.service.spec.ts` · 신규 `schedule-delete-concurrency.e2e-spec.ts`)
로 좁고, `210808701` 자체는 `schedules.service.spec.ts` 만 건드렸다(`git show --stat 210808701` 로
확인). 나머지는 `plan/**` · `review/code/2026/09/21/{00_06_01,00_37_06,00_56_52}/**` ·
`review/consistency/2026/09/20/23_37_12/**` — 이전 라운드/consistency-check 산출물이다.

Read/Grep 으로 저장소를 직접 열어 diff 페이로드의 주장과 대조했다. **저장소에 쓰기 작업을
수행하지 않았다** — `git status --short` 는 이 세션이 새로 만든 `review/code/2026/09/21/01_16_46/**`
외 변경이 없음을 확인했다.

## 최신 커밋(`210808701`)의 신규 테스트 문서화 — 정확함

- `schedules.service.spec.ts` 에 추가된 두 대조군 테스트(`for (const affected of [undefined, null])`)의
  JSDoc(트리거 경로) 및 인라인 주석(방어 분기)이 인용하는 근거를 실물 대조했다:
  - "자매 함수 `rewriteTriggerConfigLocked` 가 같은 형태의 대조군을 이미 갖는다" —
    `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:176`
    (`'affected 를 보고하지 않는 드라이버에서는 true 를 유지한다'`,
    `for (const affected of [undefined, null])`) 가 실제로 존재해 인용이 정확하다.
  - "`/ai-review` `review/code/2026/09/21/00_56_52` testing WARNING 1 이 실측했다" —
    해당 라운드 `testing.md` 의 WARNING 이 정확히 이 번호로 존재하며, "32개 테스트 중 어느
    것도 RED 가 되지 않는다" 는 실측 서술과 일치한다.
  - 성공 경로 테스트(`'삭제 — trigger 행을 config 락 안에서 지운다'`)에 새로 추가된
    `expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)` 옆 주석이 인용하는
    "이 줄을 지워도 유닛·e2e 모두 GREEN 이었다(`00_06_01` testing WARNING 1)" 도 해당 라운드
    `testing.md` 의 서술과 일치한다.
- 즉 4개 리뷰 라운드에 걸쳐 코드/테스트 주석이 인용하는 라운드 경로·WARNING 번호가 각 라운드의
  실제 산출물과 계속 어긋나지 않는다 — 지어낸 인용이나 번호 오기재는 이번 라운드에서도 발견되지
  않았다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 스케줄 항목 "고친 것"·"판별력 실측" 서술이 2·3라운드에서
  실제로 굳어진 핵심 설계 결정(`affected === 0` 명시 비교 + 그 이유를 지키는 대조군)을 반영하지
  않는다
  - 위치: `CHANGELOG.md:18`(「락 안 `m.delete(Trigger, triggerId)` 의 `affected` 를 판별자로
    삼는다 — 0 이면 트랜잭션을 롤백하며 404...」), `:27-31`("판별력 실측" 문단)
  - 상세: 이 항목은 커밋 `131296205`(1라운드 조치, SUMMARY#4)에서 작성된 그대로다. 그런데 그
    뒤 두 라운드가 정확히 이 판정 로직을 두 번 더 고쳤다 — (1) `2879e88c7`(2라운드 조치)가
    `!affected` 를 `affected === 0` 명시 비교로 바꿨다(「`null`/`undefined`(«모른다»)를 `0`
    («없다»)으로 읽으면 정상 삭제를 실패로 뒤집는다」는, 자매 함수 `rewriteTriggerConfigLocked`
    의 결정을 근거로 든 변경), (2) `210808701`(3라운드 조치)이 그 결정 자체를 지키는 대조군
    테스트를 추가했다 — 이 테스트가 없었을 때는 「`affected === 0` → `!affected` 되돌리기
    뮤턴트가 32건 전건 GREEN」이었고, 추가 후 「2건 RED」로 바뀌었다(각 라운드 `RESOLUTION.md`
    실측). 이 두 개정 모두 이 저장소가 이 PR 안에서만 세 번 반복해 온 규약 — "설계 근거는 쓰기
    전에 뮤턴트로 반증해 보라" — 이 정확히 적중한 사례이자, 형식상으로도 CHANGELOG 의
    "판별력 실측" 문단이 담기로 되어 있는 바로 그 종류의 내용이다. 그런데 CHANGELOG 는 여전히
    1라운드의 184자 뮤턴트 실측만 담고 있고, 「`affected` 를 판별자로 삼는다 — 0 이면」이라는
    문구는 falsy 체크였던 시절과 `=== 0` 명시 비교인 지금 모두에 들어맞는 모호한 서술이라, 이
    변경 자체가 있었다는 사실도 CHANGELOG 만 읽어서는 드러나지 않는다. 코드 주석(`:341-345`)과
    plan 문서(`schedule-dup-delete.md`)에는 이 근거가 없고, 이 세션의 리뷰 산출물
    (`00_37_06/concurrency.md`, `00_56_52/testing.md`, 각 `RESOLUTION.md`)에만 흩어져 있다 —
    CHANGELOG 는 이 PR 시리즈에서 "형제 PR 대비 판별자가 다른 이유"를 압축해 남기는 단일
    진입점 역할을 해 왔는데(형제 트리거/워크플로 항목도 같은 4단 구성), 그 요약에서 이번
    개정만 빠졌다.
  - 제안: "고친 것" 또는 "판별력 실측" 문단에 한두 문장을 추가한다 — 예: "`affected` 판정은
    `=== 0` 명시 비교다(자매 함수 `rewriteTriggerConfigLocked` 의 결정과 동일 근거) —
    `null`/`undefined`(드라이버 미보고, «모른다»)를 `0`(«없다»)으로 잘못 읽지 않기 위함이다.
    이 대조군 없이는 `=== 0` → `!affected` 되돌리기 뮤턴트가 스위트 전건(32건)을 통과했고,
    전용 대조군 추가 후 2건이 RED 로 바뀌었다." 이 저장소가 트래커 문서에서 쓰는 "해소 각주"
    관례처럼, 기존 문단을 지우지 않고 덧붙이는 형태를 권장한다. 차단 사유는 아니다 — 코드
    주석과 테스트 자체가 이 근거를 이미 정확히 담고 있어 정보 유실은 아니지만, 이 PR 시리즈가
    CHANGELOG 를 "요약 단일 진입점"으로 매우 엄격하게 다뤄 온 관례(1·2라운드 WARNING 두 건 모두
    CHANGELOG 관련)에 비추면 세 번째로 조용히 벗어난 지점이다.

## 그 외 확인 사항 (문제 없음)

- **인라인 주석 정확성**: `schedules.service.ts` 의 `affected === 0` 판정 두 곳(트리거 삭제·
  방어 분기)의 주석이 자매 함수 `rewriteTriggerConfigLocked`(`trigger-config-lock.ts:247-255`)를
  인용하는데, 그 파일의 해당 줄이 실제로 같은 근거(「`affected` 가 `null`·`undefined` 인 경우는
  판정하지 않는다」)를 담고 있어 인용이 정확하다.
- **README/설정 문서/API(Swagger) 문서/예제 코드**: 이번 라운드가 추가한 유일한 실코드 변경
  (`schedules.service.spec.ts` 의 대조군 테스트 2건)은 공개 API·환경변수·설정 표면을 바꾸지
  않는다. 해당 없음.
- **plan 체크리스트 미해소**(`plan/in-progress/schedule-dup-delete.md` 하단 3항목,
  `spec-draft-nullable-notation-followups.md:4773`)는 3라운드(`00_56_52`)documentation 리뷰가
  이미 "의도된 미완료, 세션 마무리 단계 처리 예정, 비차단"으로 처분했고 이번 라운드까지 상태
  변화가 없다 — 재확인만 하고 새 항목으로 올리지 않았다.
- **spec 문서 격차**(`spec/2-navigation/3-schedule.md` 의 동시 삭제 404 서술 부재)도 동일하게
  기존에 등재·처분된 침묵이며 이번 라운드가 새로 발견한 것이 아니다.

## 요약

4라운드째 리뷰에서 최신 커밋(`210808701`)이 추가한 두 대조군 테스트의 JSDoc·인라인 주석은
정확하며, 그것이 인용하는 형제 함수·이전 라운드 WARNING 번호 모두 실물과 일치한다. 다만
`CHANGELOG.md` 의 스케줄 항목은 여전히 1라운드 시점의 서술에 머물러 있어, 이 PR 이 그 뒤 두
라운드에 걸쳐 실제로 굳힌 핵심 설계 결정(`affected === 0` 명시 비교와 그 뮤테이션 근거)을 담지
못한다 — 코드·테스트 자체는 정확하므로 기능적 결함은 아니지만, 이 PR 시리즈가 CHANGELOG 를 유일한
요약 진입점으로 매우 엄격히 다뤄 온 관례(1·2라운드 모두 CHANGELOG WARNING)에 비추면 세 번째로
조용히 벗어난 지점이라 WARNING 으로 남긴다. 그 외 신규 CRITICAL 급 문서화 결함은 없다.

## 위험도

LOW
