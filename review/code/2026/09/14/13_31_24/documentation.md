# 문서화(Documentation) Review — trigger-canary-hardening, 라운드 6

## 검토 방법

실제 코드 변경은 `origin/main...HEAD` 기준 6개 TS 파일(`trigger-secret-columns-{guard,spec}.ts`
신규, `trigger-workflow-ref.spec.ts` 표기 정리, e2e 3파일 소규모 추가)뿐이다. 이 배치는
이미 5라운드 `/ai-review` + `--impl-done` 을 거치며 documentation 관점에서 WARNING 을 세 번
(라운드1 INFO#4 세는 기준, 라운드3 두 문서 수치 불일치, 라운드5 다섯/여섯 자리 불일치) 냈고
전부 해소됐다고 주장한다. 그 주장을 **신뢰하지 않고** 아래를 직접 재실측했다:

- `trigger-secret-columns-guard.ts`/`.spec.ts` 전문을 읽고 JSDoc 의 각 주장(빈 배열 vs `null`
  구분, 래퍼 3종 unwrap, 분기-대조군 대응표)을 실제 코드·테스트와 대조.
- `trigger-workflow-ref.spec.ts` 헤더가 주장하는 "가드는 11개다" — 실제 헬퍼
  (`trigger-workflow-ref.ts`)의 `expect` 호출을 순서대로 세어 **11개 일치** 확인.
- 헤더가 주장하는 "`grep '가드 [0-9]'` 총 13줄 = 케이스 헤딩 3 · 구획주석 7 · 산문 3" —
  `grep -n '가드 [0-9]' trigger-workflow-ref.spec.ts` 로 직접 재현: **13줄, 3/7/3 분해 정확히 일치**.
- `trigger-workflow-ref.e2e-spec.ts` 헤더가 주장하는 "이 축은 여섯 형태로 고정된다" —
  해당 파일의 `expectTriggerWorkflowRef(` 호출 지점을 grep: **정확히 6곳** 일치.
- `trigger-secret-columns.spec.ts` 헤더가 주장하는 "착수 시 9건 → 최종 12건" — `it(` 블록을
  전수 세어 **12개** 일치.
- CHANGELOG.md 미갱신이 관례 위반인지 — 이 신규 guard 가 직접 인용하는 선례
  `redis-fail-open-catalog-guard.ts` 를 CHANGELOG.md 에서 grep: **0건**. 순수 드리프트 방지용
  guard(활성 버그 없음)는 이 저장소에서 CHANGELOG 대상이 아니라는 기존 관례와 일치 —
  이번 PR 의 미갱신은 예외가 아니라 관례 준수다.

## 발견사항

- **[INFO]** 신규 repo-guard 의 JSDoc·테스트 헤더 서술이 실제 코드와 전수 정합함을 재확인 —
  회귀 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`
    (JSDoc, 게이트 29~45행), `trigger-secret-columns.spec.ts`(게이트 96~114행 대응표),
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts`(게이트 21~29행 헤더).
  - 상세: 위 "검토 방법"에 적은 다섯 개의 수치 주장(가드 11개 · grep 13/3/7/3 · e2e 호출 6곳 ·
    테스트 12개 · CREATOR_PROJECTION 인용의 실재)을 전부 소스를 직접 열어 재현했고 전부 일치했다.
    이 배치는 5라운드에 걸쳐 "문서한 보장이 구현보다 넓다"·"수를 두 문서에 적고 하나만
    고쳤다" 류의 결함을 스스로 찾아 고쳐 온 이력이 있어, 그 수정이 진짜인지(다음 결함을
    만들지 않았는지) 별도로 검증할 가치가 있었다. 새로 만든 불일치는 없다.
  - 제안: 없음.

- **[INFO]** `spec-conventions-engine-error-code-surface.md` 의 "파일 쌍 7/8" 수치가 이 PR
  자신의 파일 추가로 한 번 더 낡았지만, 그 사실 자체는 새 각주에 명시되지 않았다.
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md:121-131`
    (이번 diff 로 추가된 121~127행 각주 + 그 아래 기존 128~131행 "2026-09-04 실측" 문단).
  - 상세: 이번 diff 가 추가한 각주(121~127행)는 *"가드 14 중 등재 5·미등재 9"*(등재 개수)와
    바로 아래 *"`*-guard.ts` 7 · `*.spec.ts` 8"*(파일 쌍 개수, 2026-09-04 시점)이 **다른
    질문에 대한 답**이니 후자로 전자를 덮어쓰지 말라고 정확히 경고한다. 그런데 이 PR 자신이
    `trigger-secret-columns-guard.ts`/`.spec.ts` 를 새로 추가해 실제 파일 쌍 수는 이제
    `*-guard.ts` **14** · `*.spec.ts` **15**(직접 `ls` 로 확인)로, 2026-09-04 시점의
    "7/8" 과는 **같은 축(파일 쌍 개수)에서도 이미 배 이상 벌어졌다.** 새 각주는 "다른 질문이니
    교체하지 말 것"만 지시할 뿐, "이 PR 이 그 축의 분모 자체도 갱신했다"는 사실은 언급하지
    않는다 — (b) 결정 턴에 재측정하라는 지시가 있어 실무 영향은 작지만, 결정자가 "7/8" 을
    "아직 유효한 오늘의 파일-쌍 수"로 오독할 여지가 남는다.
  - 제안: 차단 사유 아님. 이 각주 또는 128행 문단에 한 줄
    ("이 배치가 파일 쌍을 14/15 로 늘렸다 — 재측정 시 이 수치도 갱신 대상")만 추가하면
    다음 사람이 "다른 질문"과 "낡은 숫자"를 혼동할 여지가 완전히 닫힌다. 이 plan 문서
    자체가 "수치 갱신은 덮어쓰지 않고 날짜 붙여 추가한다"는 관례를 이미 여러 번 보여주므로,
    같은 방식으로 처리하면 된다.

## 나머지 점검 관점 — 조치 불요 확인

- **독스트링/JSDoc**: 신규 함수(`readStringArrayConst`/`readAllTriggerSecretColumnLists`) 모두
  파라미터·반환값·`null` vs `[]` 구분까지 JSDoc 에 명시돼 있고 실제 동작과 일치.
- **README**: `repo-guards/__tests__/` 하위에는 원래 README 가 없고(형제 가드 13종 전부 동일),
  이 PR 이 그 관례를 깨지 않는다.
- **API 문서**: 엔드포인트 계약 변경 없음(응답 필드 추가·제거 없음, 기존 필드에 대한 e2e
  단언만 추가) — API 문서 갱신 대상 아님.
- **주석 정확성**: `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` JSDoc 이 "이제 두 경계에서
  실측했다"고 갱신한 서술과, 자매 파일 `chat-channel-trigger-create.e2e-spec.ts` 가 그 정본을
  가리키기만 하고 서술을 복제하지 않은 것 모두 실제 코드(둘 다 여전히 raw `DELETE FROM trigger`
  만 실행)와 일치.
- **CHANGELOG**: 위 "검토 방법"에서 확인한 대로 조치 불요.
- **설정 문서**: 새 환경변수·설정 옵션 없음.
- **예제 코드**: 신규 guard 의 소비 spec(`trigger-secret-columns.spec.ts`)이 헬퍼의 사용 예시
  역할을 충분히 겸함 — 별도 예제 불요.

## 요약

실제 코드 diff(6개 TS 파일)에 대한 문서화 품질은 이미 5라운드의 자기검증(뮤테이션 실측 포함)을
거쳤고, 이번 라운드에서 독립적으로 재현한 5개 수치 주장(가드 11개·grep 13/3/7/3·e2e 호출
6곳·테스트 12개·CREATOR_PROJECTION 인용) 전부가 실제 소스와 정확히 일치해 새로 도입된
docstring/주석 불일치는 발견되지 않았다. CHANGELOG 미갱신도 직접 인용된 선례 가드의 부재
패턴과 일치해 예외가 아니다. 유일한 관찰 사항은 `spec-conventions-engine-error-code-surface.md`
의 "파일 쌍 7/8" 이라는 기존(2026-09-04) 수치가 이 PR 자신의 파일 추가로 같은 축에서 다시
낡았는데 새 각주가 그 사실까지는 짚지 않는다는 점이며, 차단 사유가 아닌 INFO 로 등재한다.

## 위험도

NONE
