# 변경 범위(Scope) Review

> 대상: 직전 ai-review 세션(`review/code/2026/07/17/02_04_13/`)이 보고한 **C1(CRITICAL)/W1/W2/W3/SD1/I1/I2** 에 대한 fix 커밋 + 그 review 세션 자체의 산출물 커밋.

## 발견사항

- **[INFO]** backend webauthn 테스트 파일이 이번에도 channel-web-chat 위젯 fix 커밋에 번들
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` (`use-widget.ts`/`use-widget-eager-start.test.ts` 와 동일 커밋 추정)
  - 상세: 두 모듈(`backend/auth/webauthn` vs `channel-web-chat/widget`)의 fix 가 한 커밋에 담기는 패턴이 이번 라운드까지 3회 연속 반복된다. 다만 이는 사용자가 "⑨ 를 묶음으로 처리"로 지시한 것이 근거였고, 직전 두 차례 scope 리뷰(`01_42_44`→`02_04_13`) 모두 "위반 아님, 기존 사용자 의도의 연장"으로 판정했다(`02_04_13/RESOLUTION.md` I4). 이번 fix 도 그 계보를 그대로 잇는다 — I1(null 필드 테스트)이 그 대상.
  - 제안: 조치 불필요(기존 결정 계승). 반복 패턴이므로 향후 라운드에서 굳이 재언급할 실익은 낮음 — 이번을 마지막 기록으로 남긴다.

- **[INFO]** review 산출물 신규 커밋 포함 — `review/code/2026/07/17/02_04_13/*`(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·meta.json·10개 reviewer `.md`)
  - 상세: 코드 변경이 아니라 CLAUDE.md 컨벤션(`review/code/<date>/` 산출물 저장)에 따른 직전 리뷰 세션 기록. fix 커밋과 함께 묶였지만 이 워크플로 자체가 "fix + 해당 리뷰 산출물"을 한 세트로 다루는 기존 관례이며, 직전 라운드도 동일 패턴(`01_42_44/*` 커밋)을 scope 위반 아님으로 판정했다.
  - 제안: 조치 불필요.

## 확인된 정합 사항 (긍정)

이번 diff 의 실질 코드 변경(`use-widget.ts`)을 RESOLUTION.md 의 처분표(C1/W1/W2/W3/SD1/I1/I2)와 1:1 대조:

| 발견 | 요구된 fix | 실제 diff 반영 | 대응 |
|---|---|---|---|
| C1 | `Promise<boolean>` 반환 계약 + 3개 호출부 게이팅 | `seedWaitingFromStatusRef` 타입 `Promise<boolean>` 로 변경(158행), `start()` `if (ended) return;`(279행), `applyConfig` `if (ended) return;`(300-303행), `seedWaitingFromStatus` 자체가 `boolean` 반환(229/237/250/258/264행) | 정확히 일치 |
| W1 | 중복 3줄을 헬퍼로 추출 | `finalizeEnded(reason)` 신규 `useCallback`(180-190행), `handleEiaEvent`(202행)·`seedWaitingFromStatus`(249행) 양쪽이 호출 | 정확히 일치. 이름을 reviewer 제안 그대로 안 쓰고 `finalizeEnded` 로 개명한 이유(기존 공개 액션 `endConversation()` shadow 회피)가 RESOLUTION.md 에 명시돼 근거 있음 |
| W2 | `sessionRef.current !== session` staleness 가드 | `seedWaitingFromStatus` 내부 237행에 정확히 그 형태로 추가 | 정확히 일치 |
| W3 | `endedRef` 1회 가드 | `endedRef` 선언(154행) + `finalizeEnded` 내부 체크(182-183행) + `resetSessionRefs`(newChat)에서 해제(287행) | 정확히 일치, 해제 시점(새 대화)도 W3 취지에 부합 |
| SD1 | `spec §3.1` terminal 예외 문구 추가 | `spec/7-channel-web-chat/1-widget-app.md:103-116` 에 정확히 그 예외(gap 중 종료 유실 근거 + 복원 경로 동일 적용 + SSE 재오픈/토큰갱신 skip 이유) 추가 | 정확히 일치 |
| I1 | `mapCredential` null 필드 pin 테스트 | `webauthn.controller.spec.ts` 에 `deviceName:null`/`lastUsedAt:null` 케이스 1건 추가 | 정확히 일치 |
| I2 | `applyConfig` 복원 경로 terminal 회귀 테스트 | `use-widget-eager-start.test.ts` 에 "복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음" 신규 `it` 추가(SSE 미오픈·storage 미부활·refresh 미호출 3중 단언) | 정확히 일치 |

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 갱신은 위 fix 내용을 그대로 서술하는 완료 기록 — 새 결정·새 범위 도입 없음, 기존 체크리스트 항목의 하위 불릿만 확장.
- 신규 헬퍼(`finalizeEnded`) 외에 새 상수·새 모듈·새 의존성 도입 없음. 기존 `TERMINAL_EVENTS`/`teardownSession`/`sessionRef`/`startGenRef` 등 기존 프리미티브만 재사용 — over-engineering 없음.
- `seedWaitingFromStatusRef` 타입이 `Promise<void>` → `Promise<boolean>` 로 바뀐 것은 C1 계약 변경의 직접 파생이며 그 자체로 독립적인 리팩토링이 아님.
- 요청 범위를 넘어서는 추가 조치 없음 — RESOLUTION.md 가 "fix 불요"로 판정한 항목(예: `useWidget` 훅 분리 제안, JSDoc 요약 줄 보강 제안, CHANGELOG 등재 제안 등 maintainability/documentation INFO)은 실제로 손대지 않음.
- 임포트·설정 파일 변경 없음. 포맷팅만 변경된 hunk 없음 — 모든 diff 라인이 실질 로직/주석(근거 설명)/테스트.
- 주석 추가량이 많지만(각 fix 지점마다 상세 JSDoc) 전부 "왜 이렇게 고쳤는지"를 `ai-review 02_04_13` 특정 항목(C1/W1/W2)에 교차참조하는 근거 설명 — 코드베이스의 기존 관례(리뷰 인용 주석)와 일치하며 무관한 주석 편집이 아니다.

## 요약

이번 diff 는 직전 ai-review 세션(`02_04_13`)의 처분표에 오른 7개 발견사항(C1/W1/W2/W3/SD1/I1/I2) 전부에 1:1로 정확히 대응하는 fix 이며, 대조 결과 요청 범위를 벗어나는 추가 수정·불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 노이즈·불필요한 임포트/주석 변경·의도치 않은 설정 변경이 전혀 발견되지 않았다. `finalizeEnded` 헬퍼 신설과 반환 타입 변경(`Promise<void>`→`Promise<boolean>`)은 C1/W1 fix 의 구조적 요구에서 직접 파생된 최소 변경이다. backend webauthn 테스트 번들과 review 산출물 동반 커밋은 3라운드째 반복되는 패턴이나 이미 이전 두 차례 scope 리뷰에서 사용자 의도·프로젝트 컨벤션에 부합함이 확인된 것의 연장이라 새로운 위반이 아니다.

## 위험도

NONE
