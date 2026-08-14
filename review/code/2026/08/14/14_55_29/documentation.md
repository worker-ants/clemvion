# 문서화(Documentation) 리뷰

이번 라운드(`14_55_29`)의 실질 신규 델타는 커밋 `7fa12301c` 하나다 — 직전 라운드(`14_30_35`
ai-review CRITICAL 1 + `14_30_36` consistency CRITICAL 2, `getStatus` 의 waiting/terminal
비대칭 strip)에 대한 처방으로 `redactAndStrip` 헬퍼 도입, `strip-external-only-fields.ts`
JSDoc 확장, 신규 spec 10건, CHANGELOG 갱신, plan 각주 2건을 포함한다. 소스를 직접 열어
대조한 결과 직전 라운드(`10_32_27`→`11_02_16`→`12_06_20`→`14_30_35`)가 지적한 documentation
항목(CHANGELOG 누락, 체크박스 drift, JSDoc 현재형/옛 파일 포인터, 성능 실측 근거 이관 누락)은
전부 이번 커밋에서 정확히 해소됐음을 확인했다. 다만 그 정정 과정에서 **같은 파일 안에 새로
생긴 모순**을 하나 찾았다.

## 발견사항

- **[WARNING]** `stripExternalOnlyFields` 의 `@param maxDepth` JSDoc 이, 바로 위 모듈
  최상단 JSDoc 이 같은 커밋에서 명시적으로 반증한 문구("같은 값·같은 경계 연산자를 쓴다")를
  그대로 반복하고 있다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:69-72`
    (`@param maxDepth` 블록: `"…같은 값·같은 경계 연산자**를 쓴다 — 상한 밖 서브트리는 그
    sanitizer 가 이미 마스킹한 뒤라 여기서 더 볼 것이 없다."`), 대조: 같은 파일 `:31-40`
    (모듈 상단 신규 절 `## 경계 연산자는 이 함수가 \`>\` 로 고정한다 — 자매와 다를 수 있다`)
  - 상세: 커밋 `7fa12301c`(이번 라운드 델타, W3 "계약 문구가 거짓이었다")는 모듈 최상단
    JSDoc 에 새 절을 추가해 정확히 이렇게 정정했다 — "초판 JSDoc 은 '호출부가 자매와 **같은
    값·같은 경계 연산자**를 쓴다' 고 적었는데, REST 호출부의 자매 `deepRedactSecrets` 는
    `>=` 다 — **계약이 지켜지지 않는 채로 문서만 그렇게 말하고 있었다**"(`:33-35`). 그리고
    "실제 성질은 이렇다: 연산자는 이 함수가 항상 `>` 로 고정하고…"(`:37-40`)로 올바른 계약을
    다시 적었다. 그런데 정확히 8줄 아래, `export function stripExternalOnlyFields` 의
    `@param maxDepth` 태그(`:69-72`)는 여전히 정정 전 문구 그대로 "sanitizer(예:
    `sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH`, `deepRedactSecrets` 의
    `MAX_REDACT_DEPTH`)와 **같은 값·같은 경계 연산자**를 쓴다" 라고 서술한다. `git show
    7fa12301c -- .../strip-external-only-fields.ts` 로 확인한 결과 이번 커밋의 diff hunk 는
    모듈 상단 JSDoc(`+`)만 건드렸고 이 `@param` 블록은 손대지 않았다 — 정정이 한쪽에만
    적용되고 다른 한쪽(정확히 같은 주장을 반복하는 곳)은 갱신에서 빠졌다. 실무 영향은 없다
    (실제 안전은 "자매가 그 깊이에서 서브트리를 non-object 로 collapse 한다" 는 성질이
    지키므로 코드 정확성엔 영향 없음)지만, `@param` 블록은 **IDE 호버/시그니처 도움말이
    실제로 보여주는 텍스트**라 모듈 상단 JSDoc 보다 노출 빈도가 훨씬 높다 — 다음 호출부
    작성자가 이 텍스트만 보고 "경계 연산자도 자매와 맞춰야 한다" 는, 이 커밋이 방금
    반증한 바로 그 오해를 다시 할 수 있다. 이 프로젝트가 반복 지적해 온 "문서한 보장이
    구현보다 넓다" 패턴이, 이번엔 **같은 파일·같은 커밋 안에서 정정한 문장과 정정 안 된
    문장이 공존**하는 형태로 재현됐다.
  - 제안: `@param maxDepth` 블록(`:69-72`)의 "같은 값·같은 경계 연산자를 쓴다" 를 모듈
    상단과 같은 성질로 좁힌다 — 예: "**값**은 자매 sanitizer 와 맞춘다. 경계 연산자는 이
    함수가 항상 `>` 로 고정하며, 자매가 다른 연산자를 쓰더라도 그 경계에서 서브트리를
    non-object 로 collapse 한다면 무해하다 — 상세: 모듈 상단 `## 경계 연산자` 절 참조."

## 확인했으나 문제 없음 (이전 라운드 지적 조치 재확인)

- **`14_30_35` documentation W1**(REST 회귀 테스트 JSDoc 이 현재형 + 네 번째 재발) —
  `interaction.service.spec.ts:613-625` 를 직접 대조. `stripDeep(websocket.service.ts)` →
  `stripExternalOnlyFields(shared/utils/strip-external-only-fields.ts)` 로 파일 포인터
  정정, "돌려준다"/"나간다" → "돌려주고 **있었다**"/"나갔다" 로 시제 정정 모두 확인됨
  (`git show 7fa12301c` diff 로 실제 변경분 대조).
- **`14_30_35` documentation W5**(CHANGELOG 가 fanout 만 기록) — `CHANGELOG.md` 제목이
  "fanout(depth-1) + REST 스냅샷" 으로 바뀌고 "### 그리고 fanout 만이 아니었다 — REST
  스냅샷도 같은 것을 돌려줬다" 절 신설, `redactAndStrip` 언급까지 확인.
- **`14_30_35` documentation W3**(성능 실측 근거가 이관 중 유실) — `strip-external-only-
  fields.ts:42-56` `## 비용 (실측)` 절에 A/B 수치(0.0112→0.0314ms, 2.80배)와 "두 pass 를
  합치지 않은 이유", 그리고 "이 실측·근거가 딸려오지 않았다" 는 자기 반성 addendum까지
  모두 옮겨졌음을 확인.
- **`14_30_36` cross_spec/plan_coherence** 가 요구한 "형제 plan 반증 각주"(커밋
  `34e32e62f` 가 약속하고 지키지 않았던 것) — `plan/in-progress/spec-draft-eia-
  notification-payload-contract.md:230-237` 에 "소급 정정 (2026-08-14)" 각주로 실제 반영됨.
- **§R17 planner 인계 갱신** — `plan/in-progress/spec-draft-eia-62-waiting-payload.md:130-
  137` (7)번 항목이 "세 출구(waiting `nodeOutput`·terminal `result`·terminal `error`) 전부에
  적용됨을 명시할 것" 으로 갱신돼 이번 커밋이 넓힌 실제 방어 범위와 일치.
- **신규 `strip-external-only-fields.spec.ts`(10건)** — 자기 spec 이 없었다는 지적(`14_30_35`
  architecture/testing W4)이 해소됐고, JSDoc 이 각 테스트의 존재 이유(`__proto__` 판별력
  fixture 조건, deepRedactSecrets 순서 무관성이 `redactAndStrip` "strip 먼저" 최적화의
  전제라는 점, 다원소 배열 부분 clone 이 유예 항목이었다는 이력)를 정확히 서술.
- `websocket.service.ts:294-304` 의 이관 후 남은 orphan 주석 블록("여기 두지 않는 이유")은
  어떤 선언에도 붙지 않은 독립 설명이지만, 이는 `14_30_35` documentation 라운드가 이미
  발견하고 `12_06_20` RESOLUTION INFO 8("세 곳에 흩어진 서사, 다음에 이 로직을 건드릴 때
  함께 갱신")과 함께 의도적으로 유예한 사안이라 재지적하지 않는다. 이번 커밋도 그 파일을
  건드리지 않아 상태 변화 없음.
- README·API 문서(Swagger)·환경 변수 문서 갱신이 필요한 새 공개 인터페이스·설정 항목은
  이번 델타에 없다(내부 함수 리팩터 + 시큐리티 패치 + 테스트뿐).

## 요약

이 브랜치는 같은 결함 클래스("문서한 보장이 실제 계약/구현보다 넓다", "같은 커밋이 고친
코드를 JSDoc이 옛 상태로 서술한다")가 다섯 라운드에 걸쳐 반복 재발하면서도 매번 정확하게
잡아 정정해 온 이례적으로 꼼꼼한 이력을 갖고 있고, 이번 라운드(`7fa12301c`)도 직전
라운드(`14_30_35`)가 낸 세 documentation 지적(현재형 JSDoc, CHANGELOG 누락, 실측 근거 이관
누락)을 모두 정확히 해소했다. 다만 W3("경계 연산자 계약이 거짓이었다")를 고치는 과정에서
모듈 최상단 JSDoc 에는 정정을 반영했지만, **바로 그 문장을 그대로 복제하고 있던 함수 자체의
`@param maxDepth` JSDoc**(IDE 에 실제로 노출되는 텍스트)은 갱신에서 빠졌다 — 정정한 문장과
정정 안 된 문장이 같은 파일·같은 커밋 안에 공존하는 새로운 형태로, 이 프로젝트가 반복
지적해 온 패턴이 한 번 더 나타났다. 기능적 결함은 아니며(실제 안전은 다른 성질이 보장),
새 유틸의 spec 커버리지·CHANGELOG·plan 동기화는 전반적으로 이 저장소의 무거운 주석 관례에
부합하는 높은 품질을 유지하고 있다.

## 위험도

LOW
