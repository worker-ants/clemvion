# Rationale 연속성 검토 — error-code-emission-axis (--impl-done, scope=spec/conventions/)

## 범위 확인

- `spec/conventions/` 델타: **0개 파일** (프롬프트가 명시한 대로 정상 — 이 브랜치는 spec 을 바꾸지 않았다. `plan/in-progress/error-code-emission-axis.md` frontmatter 도 `spec_impact: none`).
- 실제 구현 diff(HEAD, 절대경로 `git -C .../error-code-emission-axis-56c9ff diff origin/main...HEAD -- codebase`)로 직접 확인:
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (+177/-1)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (+427/-2)
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (각 1줄 정정)
- 이 네 파일은 **어떤 spec 의 `code:` 로도 참조되지 않는다**(`grep -rln "guide-identifier" spec/` 0건) — 즉 이 test/guard 파일 자체는 spec 이 소유하지 않는 harness 코드다. Rationale 연속성 판단은 이 파일들이 **인용·의존하는 spec Rationale**(아래)을 기준으로 했다.

## 발견사항

### [INFO] `GUIDE_NON_EMITTED_VOCABULARY` 신설은 "무근거 번복" 이 아니라 "명시된 번복" — spec 미거버넌스라 본 체크 관점 밖
- target 위치: `guide-identifier-scan.ts` 신규 export `GUIDE_NON_EMITTED_VOCABULARY` JSDoc (diff 내 "메시지 접두일 뿐 …" 블록)
- 과거 결정 출처: spec `## Rationale` 아님 — `#1330`(tracker/PR 이력)이 세운 "허용목록 없음" 설계 원칙. 이 원칙은 어떤 spec 문서에도 등재돼 있지 않다(`spec/` grep 0건).
- 상세: target 자신이 코드 주석에 *"`#1330` 은 '허용목록 없음' 을 설계 원칙으로 세웠다. 이것이 그 원칙의 두 번째 부분 번복이다"* 라고 **스스로** 밝히고 있다. 번복이되 (a) 이유가 명시돼 있고(문맥 술어에 숨기지 않고 명시적으로 적어 사유를 강제) (b) 기존 `GUIDE_EXTERNAL_VOCABULARY`(첫 번째 번복)와 대칭 설계(거울상 제약표)로 일관성을 유지한다. 다만 이 원칙 자체가 spec `## Rationale` 에 살고 있지 않으므로, "spec 기각 결정 재도입" 관점에서는 판정 대상이 성립하지 않는다 — plan_coherence 축의 소관에 더 가깝다.
- 제안: 이 test/guard 축이 앞으로 spec 과 연결되거나(`code:` 필드 등재), 이 "허용목록 없음 → 명시적 이중 예외 목록" 패턴이 굳어지면, 그 근거를 코드 주석이 아니라 관련 spec(예: 신설한다면 `spec/conventions/`)의 `## Rationale` 로 승격하는 것을 고려. 지금은 조치 불필요.

### [INFO] §1.4 "앵커 없는 맨 문자열" 원칙과 정합 — 위반 없음
- target 위치: `guide-identifier-scan.ts`의 `collectQuotedLiterals`/`collectCatalogCodes` JSDoc, `logic.mdx`/`logic.en.mdx` 문장 정정
- 과거 결정 출처: [`spec/5-system/3-error-handling.md §1.4`](../../../../spec/5-system/3-error-handling.md) 머리말 — *"`shadow-workflow.ts`·`execution-failure-classifier.ts` 에 같은 이름이 나오지만 그것은 소비자·분류기 쪽 어휘이지 엔진 발행 경로의 앵커가 아니다"* (Rationale 절은 아니지만 §1.4 를 지배하는 locked 설계 원칙 — `MAX_ITERATIONS_EXCEEDED`·`RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등이 "앵커 없음"으로 명시 등재됨).
- 상세: target 이 이 원칙을 **정확히 재확인**한다 — `MAX_ITERATIONS_EXCEEDED` 가 소비자 Set(`execution-failure-classifier.ts:76`) 인용 때문에 첫 술어를 우회(거짓 PASS)함을 실측으로 잡아내고, "정확히-T 리터럴 존재 = 방출" 이라는 **자신이 처음 세운 술어를 spec 이 이미 반증하고 있었음**을 인정한 뒤 술어를 "메시지 접두 ∧ ¬카탈로그 ∧ ¬등록" 으로 좁혔다. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가이드 문장도 §1.4 의 원칙(앵커 없는 문자열은 코드가 아니라 메시지로 다뤄야 한다)에 맞춰 "코드처럼 읽히는" 문장에서 "메시지 접두 — 전용 코드 없음" 문장으로 정정됐다. 원칙 위반이 아니라 **원칙의 새로운 적용 사례**다.
- 제안: 조치 불필요. (참고: `spec/5-system/4-execution-engine.md §3.0` 이 여전히 "`CONTAINER_MISSING_EMIT` 에러로 실행 실패" 라는 옛 표현을 쓰고 있어 §1.4 원칙과 어긋나는 잔존 drift 가 spec 안에 남아 있으나, 이는 **이 diff 가 만든 것이 아니라 기존 spec 텍스트**이고 이미 tracker(`plan/in-progress/spec-draft-nullable-notation-followups.md` 3404행 부근)에 별건으로 등재돼 있다 — 이 delta 의 신규 결함으로 보고하지 않는다.)

### [INFO] `review-citations.md §4` ("기존 bare 인용 소급 정리 금지") 위반 회피 — 정합 사례
- target 위치: plan `H. 라운드 3` 절 "4번째 재발에 «코드로» 막으려다 규약을 어길 뻔했다"
- 과거 결정 출처: [`spec/conventions/review-citations.md §4`](../../../../spec/conventions/review-citations.md#4-기존-인용은-소급-정리-대상이-아니다) — *"기존 bare 인용은 다음에 건드릴 때 함께 맞춘다. 일괄 치환은 하지 않는다"*.
- 상세: target 이 폴더 스코프 가드(기계 강제)를 세우려다 그 가드가 같은 폴더의 **선재 bare 인용 3건**까지 강제로 정리하게 됨을 인지하고 §4 위반이라 판단, 가드 신설을 철회했다. 실제 코드 diff 를 확인한 결과(`git diff origin/main...HEAD` 의 review-path 인용 15건 전수) bare `hh_mm_ss` 인용은 0건이며 전부 `review/(code|consistency)/YYYY/MM/DD/hh_mm_ss` 전체 경로 형식을 쓴다 — §2/§3 규약 준수.
- 제안: 조치 불필요. 규약 준수의 좋은 선례로 기록해 둘 만하다.

## 요약

이번 delta(`spec/conventions/` 0건, 실제 코드 diff 4개 파일)는 spec `## Rationale` 이 기각한 대안을 재도입하거나 합의된 설계 원칙을 위반하는 지점을 만들지 않았다. 오히려 `spec/5-system/3-error-handling.md §1.4`(발행 앵커 없는 문자열 원칙)와 `spec/conventions/review-citations.md §4`(소급 일괄정리 금지)를 정확히 재확인·준수하는 방향으로 움직였고, 자신이 세션 초반 세운 술어가 spec 이 이미 명시한 함정(§1.4 소비자 어휘 vs 발행 앵커 구분)에 걸려 반증되자 그 반증을 숨기지 않고 술어를 좁혀 재설계했다. 유일하게 "번복"이라 부를 만한 지점(`GUIDE_NON_EMITTED_VOCABULARY` — `#1330` "허용목록 없음" 원칙의 두 번째 부분 예외)은 spec `## Rationale` 이 아니라 코드/tracker 이력에 속한 결정이라 본 체크의 직접 관할은 아니며, 그 안에서도 사유가 명시적으로 기록돼 은폐형 번복이 아니다.

## 위험도

NONE
