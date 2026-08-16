# 테스트(Testing) 리뷰

## 컨텍스트

이번 라운드(`10_41_55`)는 plan 체크리스트상 "fresh `/ai-review` (fix 이후)" 단계다 — 직전 두 라운드
(`09_51_00`, `10_19_30`)가 지적한 테스트 관점 WARNING 은 모두 `RESOLUTION.md` 를 통해 반영됐다고
주장되어 있어, 그 주장이 현재 코드에 실제로 반영됐는지 직접 `Read`+`jest` 실행으로 재검증했다.
이번 라운드 자체의 diff 델타(직전 `10_19_30` 대비)는 `7badf0318` 커밋 하나로 **JSDoc/CHANGELOG/plan
문서 정정뿐**이고(`git show --stat 7badf0318` 확인 — `.ts`/`.spec.ts` 코드 변경 없음), 실제 테스트
코드·마스킹 로직은 이전 커밋(`23d1148d5`, `a50a5764e`)에서 이미 자리 잡았다.

## 실측 검증

- `terminal-error-payload.ts`, `terminal-error-payload.spec.ts` 를 직접 `Read` — 이전 라운드가
  "반영됨"이라 주장한 4개 지점을 코드로 대조했다.
- `npx jest src/shared/utils/terminal-error-payload.spec.ts` 직접 실행 — **26/26 PASS** (RESOLUTION/plan
  이 기록한 "toTerminalErrorPayload 스위트 26/26"과 일치).

## 발견사항

- **[INFO]** `toTerminalErrorPayload` 의 스칼라(`number`/`boolean`/`bigint`)·non-object 반환 분기는
  `redactTerminalError` 래핑 제거를 어떤 테스트로도 판별할 수 없다 — 문서화된 의도적 잔여 갭
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`
    JSDoc "## 검증 범위를 정확히 적는다" 절(74~78행), 대응 반환 분기 `toTerminalErrorPayload`
    134~148행(스칼라·non-object)
  - 상세: 이 두 분기가 만드는 `message` 값(`String(42)`/`'true'`/`'9'`/`''`)은 `SECRET_LEAK_PATTERNS`
    어디에도 매칭될 수 없는 값 공간이라, 래핑을 제거하는 뮤턴트도 출력이 바뀌지 않아 구조적으로
    GREEN 이다. 직전 라운드(`10_19_30` testing WARNING)가 정확히 이 문제를 지적했고, 이번엔
    "테스트를 억지로 추가"하는 대신 JSDoc 에 검증 범위를 정확히 좁혀 적는 방식으로 반영됐다
    (`10_19_30` RESOLUTION W3) — 이 처리는 이 저장소의 관행("주장이 검증 범위보다 넓으면 안 된다")과
    일치하고, 관측 불가능한 분기에 억지로 테스트를 붙이는 것보다 정직한 접근이다. 재지적 대상이
    아니라 확인 기록으로 남긴다.
  - 제안: 조치 불요 — 이미 올바르게 처리됨.

- **[INFO]** JSDoc 위협표의 "자격증명 포함 연결 문자열이 마스킹된다" 행이 `terminal-error-payload.spec.ts`
  안에서 양성(positive) 케이스로 직접 재현되지 않는다 — 부정 케이스(자격증명 없음)만 있다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 84~89행 위협표(
    `postgres://user:pw@db.internal/prod` → `postgres://***@db.internal/prod` 행) vs
    `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` 211~217행(`'자격증명
    **없는** 연결 문자열·호스트명은 통과한다'` — 부정 케이스만 존재)
  - 상세: `toTerminalErrorPayload` 를 경유해 자격증명이 **포함된** URI(`scheme://user:pass@host`
    형태)가 실제로 마스킹되는지 확인하는 양성 케이스가 이 파일에는 없다. 다만 이 변환의 실체는
    `deepRedactSecrets`→`redactSecrets`(shared SoT)이고, 그 URI-userinfo 마스킹 자체는
    `sanitize-error-message.spec.ts`(같은 디렉터리, 이번 diff 밖)의 `'masks URI userinfo
    scheme-preservingly'`/`'masks non-DB URI userinfo too'` 등에서 이미 충분히 직접 검증되어 있다
    (직접 확인). 즉 로직 커버리지 자체의 공백은 아니고, `terminal-error-payload.spec.ts` 한 파일만
    보면 위협표의 "✅" 행 중 하나가 이 파일 안에서 자체 증명되지 않는 비대칭이 있을 뿐이다.
  - 제안: 강한 조치 불요. 문서-코드 정합성을 더 타이트하게 하고 싶다면 부정 케이스(211행) 옆에
    `postgres://user:pw@db.internal/prod` → `postgres://***@db.internal/prod` 를 확인하는 대응
    양성 케이스 1개를 추가해 위협표의 두 행을 이 파일 안에서 대칭적으로 고정할 수 있다(우선순위 낮음).

## 회귀 확인

- 직전 라운드들이 지적한 4개 판별력 문제 — (1) `code`/`nodeId` vacuous 단언, (2) JSON 형태
  `message` 재직렬화 미고정, (3) `details: null` 미테스트, (4) 잔여 갭(자격증명 없는 연결 문자열)
  캐너리 부재 — 전부 현재 스펙 파일에 실제로 존재함을 직접 대조 확인했다:
  `code`/`nodeId` 는 `Bearer sk-live-should-not-be-masked`/`api-key=must-stay-verbatim` 같은
  실제로 패턴에 매칭되는 adversarial 값을 쓰고(165~170행), JSON 파싱 유지 단언이 있으며(172~180행),
  `details: null` 케이스(200~204행)·잔여 갭 캐너리(211~217행)도 존재한다. 이제 전부 판별력 있는
  형태다.
- 신규 `describe` 블록은 mock/stub 없이 실제 `deepRedactSecrets`/`redactSecrets` 를 그대로 태우는
  순수 함수 유닛테스트다. 각 `it` 이 리터럴을 새로 만들어 쓰므로 테스트 간 상태 공유가 없고,
  `DEEP_REDACT_CACHE`(WeakMap, object identity 키, `shared/utils/sanitize-error-message.ts:107`)는
  리터럴마다 새 참조라 캐시 오염으로 인한 flaky 위험이 없다. `message` 필드는 항상 문자열이라 이
  캐시 경로(object 전용) 자체를 타지 않는다 — mock 과 실동작의 괴리 없음.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 뿐이라 대응 테스트 변경 불요라는
  판단은 실제로 로직 diff 가 0줄임을 직접 대조해 타당함을 재확인했다.
- 이번 라운드의 유일한 실제 diff(`7badf0318`, JSDoc/CHANGELOG/plan 문서 정정)는 테스트 대상 코드를
  전혀 건드리지 않아 회귀 위험이 없다.

## 요약

이 PR 은 이미 두 차례의 코드 리뷰 라운드를 거치며 테스트 관점의 실질적 문제(판별력 없는 단언,
검증 범위 과장 주장, 미고정 잔여 갭)를 전부 adversarial 입력·명시적 파싱 단언·문서화된 범위 축소로
교정했고, 이번 라운드에서 직접 파일을 읽고 `jest` 를 재실행해 그 반영이 사실임을 재확인했다(26/26
PASS). 남은 것은 두 건의 경미한 INFO뿐이다 — (1) 스칼라/non-object 분기는 값 공간의 구조적 한계로
어떤 테스트도 판별 불가능하며 이는 이미 정직하게 문서화되어 재지적 대상이 아니고, (2) 위협표의
자격증명-포함 연결 문자열 마스킹 행이 이 스펙 파일 안에서 양성 케이스로 자체 증명되지 않지만 자매
스펙 파일에서 이미 직접 검증되어 있어 실질적 커버리지 공백은 아니다. 신규 Critical/Warning 은
발견되지 않았다.

## 위험도
LOW
