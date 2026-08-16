# RESOLUTION — `19_16_28` (7라운드, 최종)

**CRITICAL 0 · WARNING 1** — 조치 완료. **이 라운드는 코드를 한 줄도 바꾸지 않았다.**

## WARNING 1 (maintainability) — 트래커 등재로 처리

*"자매 넷 중 하나만"* 서사가 소스 3곳에 반복돼, 표면 수가 바뀌면 세 곳이 갈릴 수 있다는 지적.

### 전제를 먼저 실측했다

**verbatim 복제가 아니다.** 세 지점을 열어 보면 공유되는 것은 저장소 공용 **관용구**
(패턴 이름)이고, 주변 서술은 각자 다르다:

| 지점 | 고유 내용 |
|---|---|
| `executions.service.ts:802` | `stop` 의 반환 지점 수 · 단일 관문 설계 근거 |
| `background-runs.service.ts:301` | **`@Roles` 게이트 부재** · `NodeExecution.error` 동일성 |
| `executions.service.spec.ts:853` | *"표면마다 따로 단언하는 이유"* · 트래커가 한 줄만 지목했던 사실 |

**다만 지적의 핵심은 유효하다** — *"넷"* 이라는 **수치**가 세 곳에 흩어진 것은 표면이
다섯이 되는 순간 실제 drift 가 된다.

### 왜 이 PR 에서 고치지 않았나 (실측 근거)

코드 주석 정리라 **기능 위험이 0**인데, 이 저장소의 push 게이트는 **코드 편집마다 리뷰
라운드를 다시 요구**한다 — 리뷰의 "완료 시각" 은 세션 디렉토리 타임스탬프이고 코드의 시각은
커밋 author date 라(소스 실측), 편집→커밋하면 그 즉시 직전 리뷰가 stale 이 된다.

이 PR 은 이미 **7라운드**를 돌았고 마지막 3라운드의 발견은 전부 서술 수준이다. 서술 DRY 개선
하나를 위해 전체 게이트를 한 바퀴 더 도는 것은 비용이 이익을 넘는다고 판단했다.

정본화 제안을 **근거와 함께** [정본 트래커](../../../../../plan/in-progress/spec-sync-external-interaction-api-gaps.md)
에 등재했다 — 실측 결과(verbatim 아님)와 유효한 부분(수치 drift), 그리고 미룬 이유까지 적었다.
*"미룬 근거는 실측 대상"* 이라는 이 저장소의 교훈에 맞춰, 근거를 검증 가능한 형태로 남긴다.

## 이 라운드에서 확인된 것 (전부 조치 불요)

- **security(NONE, 7라운드 연속)** — 8개 관점 전수 재검증(인젝션·시크릿·인가·입력검증·
  OWASP·암호화/ReDoS·에러처리·의존성). IDOR 가드·파라미터 바인딩·e2e 백도어 이중 게이트가
  리팩터로 훼손되지 않았음을 소스로 확인.
- **testing(NONE)** — **68 tests 직접 재실행 PASS**, 대상 파일 `tsc` 오류 0.
  `reRun` 이 `findById` 를 재사용한다는 CHANGELOG 주장도 소스로 확인.
- **documentation(NONE)** — 8개 관점 재실측, **결함 0**. `pending_plans`(17·4)를 **파서로
  독립 재현해 일치 확인**했고, 오탐 파일 2곳이 실제로 제외됨까지 검증했다.
  `stopInternal` 의 `return` 3개·`throw` 3개도 직접 세어 JSDoc 과 일치 확인.
- **requirement · scope · side_effect(NONE)** — spec 6곳 line-level 대조, 158파일 diff 에서
  실질 코드가 `executions` 모듈 + 신규 leaf 유틸로 한정됨 확인, 호출자 전수 재확인.

## 검증

- 코드 동결: `9f870fb00` 이후 `codebase/**` diff **0건** (여러 리뷰어가 독립 실측)
- TEST WORKFLOW 4스테이지 — lint / unit(**백엔드 427 suites · 8,776 passed**) / build /
  **e2e 276 passed**
