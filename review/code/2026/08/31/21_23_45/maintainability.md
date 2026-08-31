# 유지보수성(Maintainability) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`), 5라운드

## 대상 요약

`error-codes.ts` 에 엔진 레이어 전용 `EngineErrorCode` const 를 신설하고, 맨 문자열이던
9개 지점(`ai-turn-orchestrator.service.ts` 4곳·`execution-engine.service.ts` 3곳·
`shutdown-state.service.ts` 2곳)을 `ErrorCode.*`/`EngineErrorCode.*` 참조로 리다이렉트했다.
재발 방지용 AST 기반 가드 3파일(`engine-error-code-anchor-guard.ts`+fixture+spec)이 신규
추가됐고, `CHANGELOG.md`·plan 문서(`exec-intake-followups.md` in-progress→complete 이동)가
동반 갱신됐다. 이번 diff 에는 선행 4개 리뷰 라운드(`20_27_29`/`20_43_35`/`20_59_14`/`21_12_31`)
산출물도 함께 실려 있으나 그건 생성된 검토 기록이라 유지보수성 판단 대상이 아니다.

## 검증 방법

- `Read` 로 `error-codes.ts`(115~175행 `EngineErrorCode` 신설분), `engine-error-code-anchor-guard.ts`,
  `engine-error-code-anchor.spec.ts`, `engine-error-code-anchor-fixture.ts`, `error-codes.spec.ts` 를
  현재 상태 그대로 열어 확인했다(diff 가 잘린 파일 8·9 포함).
- 선행 4라운드의 maintainability 리포트 + 각 RESOLUTION 을 먼저 읽고 이미 지적·처분된 항목
  (매직 넘버 30/20 → 근거 주석 추가로 해소, `ANCHORED_ELSEWHERE` 사유 문자열 중복 → 낮은 우선순위
  INFO 로 미조치, `record()`/생성자-인자 분기 중복 → "3번째 소비처 생기면 착수"로 유예)과 신규
  항목을 구분했다. 이번 라운드에서 소스 코드(TS) 자체는 4라운드째 변경이 없어(코드 diff 는 이미
  origin/main 대비 고정) 새로 지적할 만한 항목이 없었고, 대신 **함께 갱신된 plan 문서 본문**을
  전수로 읽었다.
- `plan/complete/exec-intake-followups.md` 전체(128줄)를 `Read` 로 열어 이번 diff 가 삽입한
  블록과 그 주변 기존 문맥이 논리적으로 이어지는지 확인했다.
- 저장소 트리는 뮤테이션하지 않았다(읽기 전용 리뷰). `git status --short` 로 재확인.

## 발견사항

- **[WARNING]** `plan/complete/exec-intake-followups.md` 의 ARCH#5 완료 기록 블록 안에서
  "완료" 선언 바로 뒤에 **그 완료를 부정하는 옛 상태 메모가 그대로 남아** 자기모순을 만든다
  — 이번 diff 가 새로 삽입
  - 위치: `plan/complete/exec-intake-followups.md:21`(`> **완료 (2026-08-31). 단 "파일 분리"
    는 하지 않았다 — 측정이 그 처방을 반증했다.**` — 이번 diff 가 새로 추가한 완료 선언 시작)
    ~ `:110`(`> 작업은 여전히 미착수임을 확인했다(2026-08-29): ... 그대로 혼재하고,
    \`EXECUTION_QUEUE_WAIT_TIMEOUT\` 은 ... 의 하드코딩 문자열이다.` — **이번 diff 가 건드리지
    않은 기존(2026-08-29 작성) 텍스트**, 즉 diff 컨텍스트 상 unchanged 줄)
  - 상세: 같은 nested blockquote 안에서 21~94행은 이번 커밋이 새로 쓴 "완료(2026-08-31)" 서술
    — ①~④ 근거·리뷰 라운드 이력·뮤테이션 표·자매 항목 I6 종결까지 담아 명시적으로
    "**완료 (2026-08-31)**" 라 선언한다. 그런데 바로 이어지는 95~110행은 **손대지 않은 옛
    텍스트**로, "**차단 근거의 절반이 사라졌다 (2026-08-29 재측정)**" 라는 제목 아래
    "작업은 여전히 미착수임을 확인했다(2026-08-29): `nodes/core/error-codes.ts` 한 파일에
    HTTP·DB·LLM 노드 코드와 엔진 코드가 그대로 혼재하고, `EXECUTION_QUEUE_WAIT_TIMEOUT` 은
    `execution-engine.service.ts` 의 하드코딩 문자열이다" 라고 적고 있다. 이 문장은 이번
    작업으로 **정확히 반증된 상태 서술**이다(`EXECUTION_QUEUE_WAIT_TIMEOUT` 은 이제
    `EngineErrorCode` 참조지 하드코딩이 아니다). 새 "완료" 블록을 삽입하면서 그 아래에 남아
    있던, 착수 전 "왜 아직 안 했는가"를 설명하던 옛 메모를 제거하거나 갱신하지 않아, 같은
    항목 안에 "끝났다" 와 "아직 안 했다" 가 나란히 남았다. 다음에 이 항목을 훑는 사람은
    어느 문장이 최신인지 순서만으로는 판단할 수 없다(완료 선언이 위, 미착수 선언이 아래라
    시간순과도 반대다).
  - 참고: 같은 파일 128행에 이미 이 상황을 다루는 확립된 관례가 있다 —
    `~~Follow-up(developer): webauthn-response.dto.ts:77 stale 주석 정정.~~ **완료
    (2026-07-17)**: ...` 처럼 **옛 문장은 취소선으로 남기고 그 뒤에 완료 서술을 붙이는**
    패턴이다. 이번 편집은 이 패턴을 따르지 않고 새 완료 블록을 옛 미착수 메모 **위에** 얹기만
    해서, 그 파일 자신의 컨벤션과도 어긋난다.
  - 제안: 95~110행(2026-08-29 "차단 근거"/"미착수 확인" 블록)을 취소선으로 표시하거나
    삭제하고, 필요하면 "이 사전 조사는 착수 직전 상태 확인용이었고 21~94행의 완료 기록으로
    대체됨" 한 줄만 남긴다. 최소한 두 서술이 공존하는 이유(예: 이력 보존)를 한 줄로 명시해
    다음 독자가 시간순을 역산하지 않게 한다.

이 외 CRITICAL/WARNING 급 발견은 없다. 확인한 사항(선행 라운드 처분이 여전히 유효함을 재확인):

- 서비스 3파일의 실제 코드 변경은 여전히 `'LITERAL'` → `ErrorCode.X`/`EngineErrorCode.X` 한 줄
  치환뿐이며 값이 byte-identical, 함수 길이·중첩·복잡도에 영향 없음(4라운드째 불변).
- 매직 넘버(`declared.size > 30`, `reason.length > 20`)는 실측 근거(40, 64자)가 인라인 주석으로
  이미 남아 있어 더 이상 "설명 없는 매직 넘버"가 아니다.
- `ANCHORED_ELSEWHERE` 사유 문자열의 4회/2회 반복(21_12_31 라운드 INFO)은 상태 변화 없이 그대로
  남아 있으나 이미 낮은 우선순위로 미조치 처분됨 — 재지적하지 않음.
- `collectBoundCodes` 의 `record()`/생성자-인자 분기 중복(`20_59_14`/`21_12_31` 라운드 INFO)도
  "3번째 소비처 발생 시 착수" 조건이 이번 라운드에도 충족되지 않아 유예 유지.
- `EngineErrorCode`/`EngineErrorCodeValue` 네이밍은 기존 `ErrorCode`/`ErrorCodeValue` 컨벤션
  (UPPER_SNAKE 값·`as const`·`*Value` 파생 타입)을 그대로 계승해 일관적이다.
- `error-codes.spec.ts` 의 `EngineErrorCode` 형식 검사(`key === value` + `/^[A-Z][A-Z0-9_]*$/`)는
  형제 `ErrorCode` 검사와 정규식까지 동일해 컨벤션이 정확히 대칭이다.

## 요약

소스 코드(TS) 축은 4라운드째 변경이 없고 이미 여러 리뷰 라운드가 촘촘히 훑어 새로 지적할
결함이 없다 — `EngineErrorCode` 신설·9지점 리다이렉트·AST 가드 3파일 모두 가독성·네이밍·
함수 길이·중첩·매직 넘버·중복·복잡도·컨벤션 일관성 어느 축에서도 이번 라운드 기준 문제가
없다. 다만 이번 라운드에 처음으로 **plan 문서(`exec-intake-followups.md`) 본문을 전수로
읽으면서, "완료" 로 새로 쓴 서술 바로 아래에 그 완료를 반증하는 옛 "미착수" 메모가 취소선
없이 그대로 남아 자기모순을 이루는 것**을 발견했다. 같은 파일이 이미 취소선+완료 서술이라는
정확히 이 상황을 위한 관례를 갖고 있는데도 이번 편집만 그 관례를 따르지 않았다. 코드 동작에는
영향이 없지만, 이 plan 문서가 향후 "ARCH#5 는 끝났는가"를 확인하는 유일한 SoT 라는 점에서
다음 독자를 오도할 수 있는 실질적 가독성·일관성 결함이다.

## 위험도

LOW
