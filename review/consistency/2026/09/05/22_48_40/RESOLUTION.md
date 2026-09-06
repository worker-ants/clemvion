# RESOLUTION — `review/consistency/2026/09/05/22_48_40`

**BLOCK: NO** · Critical **0** · WARNING **1** · INFO **2**. **조치 완료.**

직전 라운드(`22_25_00`)의 Critical(`config.interaction.triggerToken` 평문 노출)이
`INTERACTION_RESPONSE_STRIP_KEYS` 로 해소됐음을 **5개 checker 전원이 교차 확인**했다.
`cross_spec` 은 *"`secret-store.md §1.1` 이 열거한 노출 경로 전부 스트립 완료"* 로 적었다.

## WARNING 조치

| # | 지적 | 조치 |
|---|---|---|
| 1 | 응답 DTO **클래스** JSDoc 에 리뷰 인용·경위가 남았다 — 같은 diff 의 **필드** JSDoc 은 규칙을 지켰다는 점에서 일관성 결여 | **두 클래스 모두 `//` 로 이동** |

**또 자매를 뒀다.** 직전 라운드에서 `ScheduleDto.trigger` **필드** JSDoc 의 내부 참조를
`//` 로 옮기면서, 같은 파일의 **클래스** JSDoc 두 개는 그대로 뒀다. checker 가 그 비대칭을
정확히 짚었다.

완화 사유(클래스 JSDoc 은 OpenAPI 로 승격되지 않음)는 여전히 맞지만, `review-citations.md §3`
와 `swagger.md §3` 의 문면은 **DTO 의 `/** */` 전반**을 대상으로 한다. 규칙을 좁히는 대신
코드를 규칙에 맞췄다 — 소비자용 한 줄만 `/** */` 에 남기고 경위는 위 `//` 로.

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `chatChannelHealth`/`notificationHealth` 가 엔티티에서 타입을 `import type` — `swagger.md §5-1` 문면과 어긋나나 저장소 전역 6곳+ 동일 관행 | **조치 불요.** 이번 diff 특유의 이탈이 아니고, 문면-관행 괴리 자체를 정리하는 것은 별도 작업이다 |
| 2 | `toResponse` vs `toResponseExecution` 명명 불일치 | 관찰 — 세 번째가 나오면 규약화 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`23:16:45`) |
| unit | **PASS** (`23:25:26`) |
| build | **PASS** (`23:26:46`) |
| e2e | **PASS** — **297** 통과 (`23:21:32`) |

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다.
