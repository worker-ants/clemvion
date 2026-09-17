# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 정정 블록의 방향 참조("아래 항목")가 실제로는 **위 항목**을 가리킨다
  - 위치: `CHANGELOG.md:71`
  - 상세: 이번 diff 가 두 곳을 동시에 건드린다 — (1) 최상단에 **새 항목**("락을 잡아도 못 막는
    세 번째 삭제 경로", `CHANGELOG.md:3-31`)을 prepend 하고, (2) 그 아래에 이미 있던 옛 항목
    (`#1334`, `CHANGELOG.md:33-` 이후)의 본문 중간에 정정 blockquote 를 삽입했다. 그 blockquote 는
    "그 경로가 남긴 창을 `rewriteTriggerConfigLocked` 의 `affected` 판정으로 닫았다(**아래
    항목**)."(`:71`) 라고 적는데, `affected` 판정을 설명하는 항목은 파일 안에서 이 문장보다
    **먼저(위에)** 나온다 — CHANGELOG 관례상 최신 항목이 위에 prepend 되므로, 옛 항목에 나중에
    삽입한 정정문에서 "새로 생긴 위쪽 항목"을 가리키려면 "아래" 가 아니라 "위" 가 맞다. 이 항목
    자체의 나머지 서술(내용) 밖 하위 문단들 어디에도 `affected` 판정을 다시 설명하는 곳이 없어
    "아래" 가 가리킬 대상이 실제로 없다.
  - 제안: "닫았다(아래 항목)" → "닫았다(위 항목)" 또는 "닫았다(바로 위 새 항목 — «락을 잡아도
    못 막는 세 번째 삭제 경로»)" 로 구체적 항목 제목을 인용해 방향 모호성을 아예 없앤다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 `@returns` JSDoc이 새로 추가된 반환 경로를
  괄호 설명으로 정확히 포괄하지 못한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:165`
  - 상세: `@returns 트리거가 그 사이 삭제됐으면 \`false\` (쓰기 skip).` 이라는 문구는 이번 수정
    이전(= `!fresh` 한 가지 경로만 `false` 를 냈던 시절)에는 정확했다. 이번 diff 로
    `m.update()` 가 실행됐지만 `affected === 0` 이라 매치가 없던 경우(`:239-240`)도 `false` 를
    반환하게 됐는데, 이 경로는 "쓰기(=UPDATE 쿼리 실행)를 건너뛴" 것이 아니라 "**UPDATE 는
    나갔지만 0행에 매치**"된 경우다. 결과(“config 가 실제로 갱신되지 않았다”)는 같지만, 괄호
    설명 "쓰기 skip" 은 메커니즘을 좁게 서술하고 있어 두 경로를 구분해야 하는 후속 디버깅
    상황(예: 감사 로그·쿼리 카운트 기반 추론)에서 오독 여지가 있다. 바로 아래(`:218-238`)에
    이 두 경로를 구분하는 인라인 주석이 이미 잘 설명되어 있으므로, `@returns` 자체도 한 문장만
    보강하면 된다.
  - 제안: 예) `@returns 트리거가 그 사이 삭제됐으면 \`false\`(재읽기 시점에 이미 없었거나,
    UPDATE 가 0행에 매치된 경우 — 아래 주석 참조).`

- **[INFO]** `trigger-config-lock.spec.ts` suite-level JSDoc의 "서비스 경유로는 만들 수 없는
  분기" 목록이 이번 diff 로 추가된 두 신규 분기를 반영하지 않음
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:12-24` (특히 `:16-23`)
  - 상세: 이 파일 최상단 JSDoc 은 "여기서는 헬퍼의 계약을 본다 — 특히 서비스 경유로는 만들 수
    없는 분기" 라며 세 가지(재읽기 시 행 소실 `!fresh`, 락 선취 순서, `columns`/`config` 스프레드
    순서)만 나열한다. 이번 diff 가 같은 suite 에 정확히 같은 성격("서비스 경유 테스트로는 못
    만드는 분기")의 새 케이스 두 개를 추가했다 — "UPDATE 가 0행에 매치되면 false"(`:161-174`)와
    "affected 를 보고하지 않는 드라이버에서는 true 유지"(`:176-185`). 둘 다 헬퍼의 계약을
    직접 검증하는 목적이 목록 취지와 정확히 일치하는데, 목록에는 오르지 않아 다음에 이 파일을
    여는 사람이 "이 suite 가 커버하는 특수 분기가 몇 개인지" 를 그 목록만 보고 과소평가하게
    된다.
  - 제안: 목록에 두 항목(0행 매치 → `false`, `affected` null/undefined → `true` 유지)을
    추가한다.

## 요약

이번 PR 은 문서화 관점에서 전반적으로 모범적이다 — CHANGELOG 에 새 결함(락으로 못 막는 세
번째 삭제 경로)을 상세히 기록했고, 이전 항목의 반증된 주장은 삭제 대신 **정정 blockquote**로
투명하게 남겼으며, `trigger-config-lock.ts`/`triggers.service.ts` 의 JSDoc 은 "왜 이렇게
했는가"뿐 아니라 "왜 다른 대안(예: `…ForPatchPrecheck`)을 쓰지 않았는가"까지 근거(저장소 내
`Precheck` 어휘 충돌, `FOR UPDATE` 7개 파일 실측)와 함께 적었다. plan 문서
(`trigger-lock-followups.md`)도 각 항목의 전제를 실측하고 반증 시 성격을 재분류하는 등 규약을
충실히 따른다. 발견된 문제는 모두 사소한 수준이다: CHANGELOG 정정 블록의 "아래 항목" 참조가
실제로는 파일상 위쪽 항목을 가리켜 방향이 뒤집혀 있고(WARNING), `rewriteTriggerConfigLocked`
의 `@returns` 문구와 `trigger-config-lock.spec.ts` suite JSDoc 의 분기 목록이 이번에 추가된
새 반환/테스트 경로를 완전히 반영하지 못해 살짝 뒤처져 있다(INFO 2건). 코드 동작 자체나 spec
계약에는 영향이 없다.

## 위험도
LOW
