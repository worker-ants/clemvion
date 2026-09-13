# 유지보수성(Maintainability) 리뷰 — guide-error-code-truth

## 검토 방법

프롬프트 번들이 절단한 파일(`llm-model-config.controller.spec.ts`, `guide-error-code-existence.test.ts`,
`guide-error-code-scan.ts`)은 저장소 원본을 `Read`로 직접 열어 전문을 확인했다. 이 diff(`origin/main...HEAD`)는
두 커밋으로 구성된다 — 원 구현(`911d9d7dd`)과 그 직전 리뷰 라운드(`review/code/.../10_12_19`) 지적을 처분한
후속 수정(`a68457936`, 커밋 메시지에 "리뷰 라운드 1" 명시). 즉 이전 maintainability 라운드가 낸 WARNING 2건이
**이번 diff 안에서 이미 고쳐졌는지**를 우선 대조했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short`
확인 — 이 리뷰 세션 자신의 산출물 디렉터리만 untracked로 남아 있다).

## 발견사항

- **[INFO]** (확인) 직전 라운드의 WARNING 2건이 이번 diff 안에서 실제로 고쳐졌다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` JSDoc, 현재 파일 299~322행) ·
    `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:147` (`collectBackendTokens`)
  - 상세: (1) "함수 시그니처 중간에 근거 주석이 끼어든다"는 지적에 대해, 현재 파일을 직접 열어 확인한 결과
    그 근거 문단(`## 실패 필드는 message 다`)은 기존 JSDoc 블록 **안**(`@returns` 갱신 포함, `*/`로 닫힌 뒤
    `async testConnection(`이 옴)에 정확히 들어가 있다 — 시그니처를 끊지 않는다. (2) `collectBackendTokens`의
    파라미터명은 `files`에서 `fileTexts`로 바뀌어 실제 값(파일 내용 문자열)과 이름이 일치한다
    (`grep -n "files" guide-error-code-scan.ts guide-error-code-existence.test.ts` 잔존 0건). 커밋
    `a68457936` 메시지도 이 두 처분을 명시적으로 적고 있어 우연이 아니다.
  - 제안: 없음 — 재발 여부 확인 목적의 기록.

- **[INFO]** (확인) 직전 라운드의 testing/architecture WARNING도 이번 diff에서 닫혔다
  - 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx`(신규 실패 토스트
    테스트 2건) · `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`(신규 파일)
  - 상세: "토스트 렌더링 지점에 실패 경로 테스트가 0건"이라는 지적에 정확 문자열 단언 테스트 + 빈 문자열
    대조군을 추가했고, "8갈래 문장표가 SoT와 손으로만 맞춰져 있어 재발 방지가 없다"는 지적에 SoT
    (`sanitize-error.util.ts`)의 반환 리터럴을 텍스트로 추출해 양방향(표→SoT, SoT→표)으로 대조하는 신규
    가드를 추가했다. 두 파일 모두 함수가 짧고 단일 축만 검증하며, 후자는 guides 배열을 `for`로 순회해
    ko/en 두 파일에 대한 `describe`를 중복 작성하지 않는다(DRY).
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** (carry-over, 신규 아님) `CODE_CONTEXT` 정규식이 여전히 한 줄에 다국어 실패 어휘 12종을 담고 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (`CODE_CONTEXT` 상수)
  - 상세: 직전 라운드에서 이미 INFO(저우선순위)로 지적된 항목이며 이번 diff에서 변경되지 않았다. 바로 위
    JSDoc이 술어의 한계를 상세히 설명해 두고 있어 당장 오독 위험은 낮다.
  - 제안: 이전과 동일 — 급하지 않음. 어휘가 더 늘어나면 명명된 배열 + `.join("|")` 형태로 바꾸는 것을 고려.

- **[INFO]** (carry-over, 신규 아님) `llm.service.spec.ts`의 인접한 두 테스트가 동일한 mock 설정을 반복한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` (`should return failure with sanitized error
    on connection refused` 및 바로 다음 `실패 응답이 선언 DTO 와 일치한다 (값 vs 선언)` — 둘 다
    `mockClient.testConnection.mockRejectedValue(new Error('Connection refused'))`)
  - 상세: 직전 라운드에서 이미 확인된 의도적 관심사 분리("값 자체" vs "값이 선언과 일치하는가")이며 이번
    diff에서도 그대로 유지된다. 문제 삼을 정도는 아니다.
  - 제안: 이전과 동일 — 유사 패턴이 더 늘어나면 공용 헬퍼 추출 고려.

## 요약

이번 diff는 별도의 새 코드를 추가했다기보다 직전 `/ai-review` 라운드(10:12:19)가 낸 maintainability WARNING
2건(JSDoc 안에 있어야 할 근거 주석이 시그니처를 끊는 자리에 있었던 것, `collectBackendTokens` 파라미터명이
실제 값과 반대였던 것)과 testing/architecture WARNING 2건(실패 토스트 렌더링 지점 무테스트, 8갈래 문장표의
SoT 대조 부재)을 처분한 후속 커밋이다. 저장소 원본을 직접 열어 네 지적 모두 실제로 고쳐졌음을 확인했다 —
JSDoc 배치·파라미터명·신규 테스트 2종·신규 양방향 parity 가드 전부 소스에 반영돼 있다. 새로 도입된 코드
(`guide-sanitized-message-parity.test.ts`, 신규 실패 토스트 테스트)는 함수가 짧고 단일 책임이며 기존 가드
가족의 명명·구조 관례(순수 스캐너/단언 분리, vacuity floor, 합성 입력 대조군)를 그대로 따른다. 새로운
CRITICAL/WARNING 급 유지보수성 결함은 발견되지 않았고, 남은 것은 이전 라운드에서 이미 저우선순위로 확인된
carry-over INFO 2건뿐이다.

## 위험도

NONE
