# 요구사항(Requirement) 충족 리뷰 — masking-residuals-0b195b (12_00_05, 누적 diff: `348c2b3ca`→`fa6e2294c`→spec 정정→후속 4곳 정정 + 리뷰 산출물 커밋)

## 검토 방법

이번 라운드의 diff(`origin/main` 대비 44개 파일)는 이 worktree 에서 세 번째로 수행되는 requirement
리뷰다. 앞선 두 라운드(`10_53_52`, `11_25_15`)가 각각 CRITICAL 1건(포함관계 캐너리 미파생)과
WARNING 3건(mirror sweep 불완전 — `node-output.md:256`, `4-execution-engine.md:193`,
`ai-agent.md:755,979` 논리 오류)을 지적했으므로, 이번 라운드는 (a) 그 지적들이 **실제로 코드/spec
현재 상태에 반영됐는지**를 직접 `Read`/`git show HEAD`/`git diff`로 재확인하고, (b) 그 위에서 신규
결함이 있는지를 점검했다. 핵심 함수 4파일(`mask-sensitive-fields.util.{ts,spec.ts}`,
`handler-output.adapter.{ts,spec.ts}`)은 현재 커밋된 전체 내용을 `Read`로 대조했고, 안전 주장의
핵심인 empty-string 캐너리는 `npx jest`로 실제 실행해 동작을 직접 확인했다.

## 발견사항

- **[INFO]** 이전 두 라운드가 지적한 4건(CRITICAL 1 · WARNING 3)이 이번 diff 시점 기준 실제로
  해소되어 있음을 직접 재확인
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10`(`export const
    DEFAULT_SENSITIVE_KEYS`), `:139`(spec, `const KEYS = [...DEFAULT_SENSITIVE_KEYS]`);
    `spec/conventions/node-output.md:256`; `spec/5-system/4-execution-engine.md:193`;
    `spec/4-nodes/3-ai/1-ai-agent.md:755`, `:979`
  - 상세: (1) `10_53_52` CRITICAL — 캐너리가 `Object.keys(maskSensitiveFields({...손으로
    나열...}))` 로 상수와 무관한 리터럴을 순회하던 것을, 상수를 `export`하고
    `[...DEFAULT_SENSITIVE_KEYS]` 로 직접 spread 하도록 재작성했다. 소스를 직접 `Read`로 확인. (2)
    `11_25_15` W1 — `node-output.md:256` 이 여전히 "`maskSensitiveFields` 가 boundary 에서
    strip"이라 쓰던 것을, 지금은 "~~`maskSensitiveFields` boundary~~ **allow-list 로 애초에
    배제**"로 취소선 정정돼 있다(`grep`으로 잔여 미정정 자리 0건 확인 — 유일한 나머지 매치는
    `plan/complete/`의 이미 완결된 과거 기록 1건뿐이며 이 diff 범위 밖). (3) W2 —
    `4-execution-engine.md:193`(`_resumeCheckpoint`)도 `:203`(`_retryState`)과 동일 패턴으로
    정정됐다. (4) W3 — `ai-agent.md:755,979` 의 "미동봉이며 → egress 마스킹"이라는 자기모순 표현이
    "allow-list 로 애초에 배제"로 재정정돼 논리 모순이 사라졌다. 네 건 모두 line-level 로 실측
    확인했다.
  - 제안: 없음(양호, 확인 완료).

- **[WARNING]** 빈 문자열 자격증명 캐너리의 단언이 **자신이 주장하는 동작을 검증하지 못한다** —
  마스킹돼도 통과하는 vacuous 단언
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:160-163`
    (`it('[대조군] 빈 문자열 자격증명은 원문으로 통과한다 (유출 없음, 의도된 사각)'`)
  - 상세: 테스트 제목과 인접 JSDoc(라인 155-159)은 "빈 문자열은 이 PR 이 실제로 동작을 바꾼
    지점"이고 "egress 까지 원문으로 간다"고 명시적으로 주장하는데, 실제 단언은
    `expect(typeof out.apiKey).toBe('string')` 뿐이다. `typeof` 검사는 `out.apiKey` 가 `''`
    (원문 그대로)이든 `'***'`(마스킹됨, `VALUE_MASK_MARKER`)이든 **둘 다 통과**시킨다 — 어느 쪽도
    `string` 이기 때문이다. 즉 이 캐너리는 코드가 뒤로 회귀해(`deepRedactObject` 의 `v !== ''`
    가드가 삭제돼) 빈 문자열도 마스킹하게 바뀌어도 **RED 가 되지 않는다**. 실제 구현
    (`sanitize-error-message.ts` 의 `deepRedactObject`, `v !== null && v !== undefined && v !== ''
    && CREDENTIAL_KEY_PATTERN.test(k)`)은 현재 정확히 빈 문자열을 스킵해 `''` 를 그대로 반환하도록
    돼 있음을 `npx jest` 로 직접 실행해 확인했다(`deepRedactSecrets({ apiKey: '' })` →
    `{"apiKey":""}`, `deepRedactSecrets({ apiKey: 'x' })` → `{"apiKey":"***"}`) — **오늘 시점의
    동작 자체는 캐너리의 서술과 일치한다.** 다만 캐너리의 *단언*이 그 동작을 실제로 고정하지
    못하므로, 이 캐너리가 지키려는 "PR 이 이 사각을 의도로 못박는다"는 목적을 달성하지 못한다.
  - 제안: `expect(out.apiKey).toBe('')` (또는 최소 `expect(out.apiKey).not.toBe('***')`)로
    바꿔 실제로 "마스킹되지 않았다"를 검증하도록 강화한다.

- **[INFO]** (반복, 3회째 미수정) 취소선 정정이 남긴 문법적으로 끊어진 문장 — 기능 영향 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:26-36` (인라인 주석,
    `DEFAULT_SENSITIVE_KEYS` 배열 내부)
  - 상세: `10_53_52/requirement.md`(INFO)와 `11_25_15/documentation.md`(INFO)가 이미 두 차례
    지적한 항목이 이번 diff 에서도 그대로 남아 있다. 원래 한 문장("이 상수는
    `handler-output.adapter.ts` 도 쓰고 … DB·WS·표현식으로 **내보낸다** — 비-자격증명 config
    필드가 …")의 앞부분만 취소선 처리되고 새 문장("2026-08-24 에 그 소비처가 사라졌다 … 표현식은
    원문을 읽는다.")이 끼어들었는데, 원래 문장의 뒷부분("내보낸다 — 비-자격증명 config 필드가 이
    이름들과 겹치면 멀쩡한 값이 가려진다.")이 주어 없이 그대로 남아 문법이 깨진다("…원문을
    읽는다. 내보낸다 — 비-자격증명 …"). 순수 코드 주석 스타일 이슈이고 기능·안전성에 영향 없다.
  - 제안: 남는 절을 유일한 잔여 소비처(`explore-tools.service.ts`)를 주어로 재연결하거나, 원 문장
    전체를 취소선 처리한다.

- **[INFO]** plan 체크리스트·자매 트래커 항목이 이번 diff 기준 실제 상태와 일치함을 확인 (반복
  지적되던 항목의 해소)
  - 위치: `plan/in-progress/masking-expression-egress-split.md:112-129`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:606-623`
  - 상세: 이전 라운드들이 반복 지적한 "체크박스가 실제 완료 상태를 반영하지 못한다"는 문제가
    현재는 해소돼 있다 — `masking-expression-egress-split.md` 는 `/ai-review`(이번 리뷰 자체) 한
    항목만 미체크이고 나머지는 전부 `[x]`이며 뮤테이션 M1-M4 실측이 예측/실측 두 칸으로 기록돼
    있다. `spec-sync-external-interaction-api-gaps.md` 의 두 자매 항목도 `[x]`로 닫히고 해소 근거가
    본문에 명시돼 있다.
  - 제안: 없음(양호).

## 요약

이번 diff 는 `masking-expression-egress-split` 작업의 3라운드 누적 결과로, 핵심 기능 변경
(`handler-output.adapter.ts` 에서 `config` echo 의 storage-time 마스킹 제거 → 표현식/DB 는 원문,
REST/WS egress 만 마스킹)이 의도한 버그(표현식이 마스킹된 리터럴을 읽던 기능 오염)를 정확히
겨냥해 고치고 있음을 확인했다. 앞선 두 라운드가 지적한 CRITICAL 1건(포함관계 캐너리가
`DEFAULT_SENSITIVE_KEYS` 에서 실제로 파생되지 않음)과 WARNING 3건(spec mirror sweep 불완전 —
`node-output.md`·`4-execution-engine.md`·`ai-agent.md`)은 모두 이번 diff 시점 기준 코드/spec
직접 대조로 **실제 해소를 재확인**했다. plan 체크리스트도 실제 상태와 일치한다. 남은 것은 (1)
빈 문자열 캐너리의 단언이 자신이 주장하는 "마스킹되지 않는다"를 실제로는 검증하지 못하는 vacuous
assertion(WARNING — 현재 동작 자체는 정확함을 직접 실행으로 확인) 하나와, (2) 순수 문서/주석
수준의 반복 미수정 문법 오류(INFO, 기능 영향 없음) 하나뿐이다. spec 문서(`node-output.md`,
`4-execution-engine.md`, `1-ai-agent.md`, `14-execution-history.md`, `4-ai-assistant.md`,
`egress-masking.md`) 와 코드 사이의 line-level 불일치는 발견되지 않았다.

## 위험도

LOW
