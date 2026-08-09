# 유지보수성(Maintainability) 리뷰

## 검토 범위

`codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(신설)·spec,
`app.module.ts`, `main.ts`, `common/utils/uuid.ts`/spec, `common/utils/workspace-context.util.ts`/spec,
`common/decorators/workspace.decorator.spec.ts`, `common/guards/roles.guard.spec.ts` 를 실제 소스
라인 번호 기준으로 대조했다. 본 라운드는 이전 라운드(`review/code/2026/08/09/14_36_39/`)의 WARNING·INFO
수정 커밋(`d40f75fbd`)이 반영된 이후 상태를 검토 대상으로 한다 — 그 커밋의 diff(`roles.guard.spec.ts`,
`workspace-context.util.spec.ts`)를 직접 열어 수정이 실제로 반영됐는지 확인했다. `CHANGELOG.md`,
`plan/**`, `review/**` 산출물은 산문/자동 생성 아티팩트라 함수 길이·중첩·복잡도 심사에서 제외했다(이전
라운드와 동일 스코핑).

## 발견사항

- **[WARNING]** 같은 PR 이 한 파일에서 고친 "이중 호출 assert" 안티패턴을 같은 커밋에서 신설한 다른 파일에 다시 심었다
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:358-371` (`expectValidationError` 함수, 특히 360행 `await expect(guard.canActivate(ctx)).rejects.toThrow(...)` 와 364행 `await buildGuard('owner').guard.canActivate(ctx);`)
  - 상세: 이전 라운드(14_36_39) 리뷰가 WARNING W4 로 지적한 "동일 인자로 `toThrow()` 용 1회 + 결과 확인용 1회, 총 두 번 호출" 패턴은 커밋 `d40f75fbd`(제목: "ai-review 2차 WARNING 6건")에서 `workspace-context.util.spec.ts` 의 `it.each` 블록을 캡처-재던지기(단일 호출) 방식으로 정확히 고쳤다(`workspace-context.util.spec.ts:114-125`, `workspace.decorator.spec.ts:46-61,95-113` 도 동일 패턴). 그런데 **그 똑같은 커밋**이 새로 추가한 `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼는 `guard.canActivate(ctx)` 를 서로 다른 `buildGuard('owner')` 인스턴스로 **두 번 호출**한다(360행: `.rejects.toThrow()` 용, 364행: `getResponse()` 캡처용) — 바로 이웃 파일에서 근거를 남기며 기각한 그 패턴 그대로다. `git log -p -- .../roles.guard.spec.ts | grep expectValidationError` 로 확인한 결과 이 함수는 오직 `d40f75fbd` 에서만 추가됐고, 그 커밋 메시지 자체가 "W4: 이중 호출 assert… 캡처-재던지기로 통일" 이라고 적어 두어 자기모순이 뚜렷하다. 기능적으로는 `canActivate` 가 순수 동기 판정에 가까워 실제 flaky 위험은 낮지만, 세 개 spec 파일(`workspace.decorator.spec.ts`, `workspace-context.util.spec.ts`, `roles.guard.spec.ts`)이 정확히 같은 결함(malformed `X-Workspace-Id` → 400 `VALIDATION_ERROR`)을 검증하면서 그중 하나만 저장소가 방금 명시적으로 기각한 방식을 쓰는 것은 "이 저장소의 표준은 무엇인가"를 다음 리더가 다시 혼동하게 만든다.
  - 제안: `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 와 동일한 캡처-재던지기 단일 호출 패턴으로 통일한다(예: `buildGuard('owner')` 를 한 번만 만들고, `expect(async () => { try { await guard.canActivate(ctx); } catch (err) { caught = err; throw err; } }).rejects.toThrow(BadRequestException)` 형태).

- **[INFO]** 워크스페이스 UUID 픽스처 상수가 3개 spec 파일에 사실상 동일한 값으로 중복 선언됨 (이전 라운드에서도 지적, 아직 미조치)
  - 위치: `codebase/backend/src/common/decorators/workspace.decorator.spec.ts:28-30`(`HEADER_WS`/`TOKEN_WS`/`DECOY_WS`), `codebase/backend/src/common/guards/roles.guard.spec.ts:13-18`(`WS1`/`OWN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`), `codebase/backend/src/common/utils/workspace-context.util.spec.ts:12-14`(`HEADER_WS`/`TOKEN_WS`/`OTHER_WS`)
  - 상세: 세 파일 모두 `'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'` 등 동일 리터럴을 파일마다 다른 이름으로 반복 정의한다. RESOLUTION.md(`review/code/2026/08/09/14_36_39/RESOLUTION.md` "INFO 13·14")도 "다음 관련 PR 에서 공용 fixture 로 승격" 하기로 명시적으로 미룬 항목이라 이번 라운드에서 새로 조치할 필요는 없다.
  - 제안: 조치 불필요(이미 후속 계획에 등재됨). 참고로만 다시 기록.

- **[INFO]** `roles.guard.spec.ts` 픽스처 상수 네이밍이 자기 파일 안에서 일관되지 않음 (이전 라운드에서도 지적, 아직 미조치)
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts:13-18`
  - 상세: `OWN_WS`·`VICTIM_WS`·`OTHER_WS`·`DECOY_WS`·`SAME_WS` 는 전부 `_WS` 접미사로 역할을 드러내는데 `WS1` 만 숫자 접미사라 패턴이 깨진다.
  - 제안: 위 fixture 공용화 작업 시 함께 정리(강제 아님).

## 확인한 정합성 (문제 없음)

- `workspace-context.util.ts:resolveRequestWorkspaceContext`(69-85행) 는 여전히 짧고 책임이 분명하며, 새 검증 분기(74-79행)도 중첩 1단계에 그친다.
- `workspace-reflection-canary.ts` 의 `countWorkspaceIdConsumingRoutes`(66-84행)·`assertWorkspaceIdReflectionWorks`(91-116행) 는 이번 라운드 diff 에서 변경되지 않았고, 함수 길이·중첩(최대 2단계 `for`)·네이밍 모두 이전 라운드 평가(LOW)와 동일하게 양호하다.
- `'VALIDATION_ERROR'` 문자열 리터럴을 `BadRequestException({ code: ... })` 형태로 직접 쓰는 것은 새 관례가 아니라 `password.util.ts`·`validation.pipe.ts`·`workspace.decorator.ts`(`WORKSPACE_ID_REQUIRED`) 등 기존 코드베이스 전반의 확립된 패턴과 일치한다(공용 enum 부재는 이번 PR 범위 밖).
- `uuid.ts` 의 `isValidUuid`/`isUuidShaped` 두 정규식 병렬 유지, `WorkspaceIdReflectionBrokenError` 의 `+` 문자열 연결 스타일은 이전 라운드에서 이미 INFO 로 다뤄졌고 이번 diff 에서 변경이 없어 재론하지 않는다.

## 요약

이번 라운드는 이전 ai-review 의 WARNING 6건 수정 커밋(`d40f75fbd`)이 실제로 반영됐는지 소스를 직접 대조해 확인했다. 대부분의 수정(W1~W3, W5, W6)은 의도대로 반영됐고 `workspace-context.util.spec.ts` 의 이중 호출 assert(W4)도 정확히 캡처-재던지기로 정정됐다. 다만 그 **같은 커밋**이 신설한 `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼가 바로 그 이중 호출 패턴을 다시 심어, 같은 검증(malformed 헤더 → 400 VALIDATION_ERROR)을 검사하는 세 스펙 파일 중 하나만 저장소가 방금 문서로 기각한 방식을 쓰는 자기모순이 생겼다 — 이번 라운드의 유일하고 가장 눈에 띄는 신규 발견이다(WARNING). 나머지는 이전 라운드에서 이미 후속 처리로 미뤄진 INFO 항목(픽스처 중복·네이밍)의 재확인이며, 함수 길이·중첩·복잡도·매직넘버 관점에서 새로 도입된 구조적 결함은 없다.

## 위험도

LOW
