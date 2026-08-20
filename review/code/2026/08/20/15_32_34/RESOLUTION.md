# RESOLUTION — 15_32_34

대상 SUMMARY: `review/code/2026/08/20/15_32_34/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **2**, INFO 8)

**처분: WARNING 2건 전부 조치.** 병행 consistency(`15_33_05`, BLOCK: NO)의 WARNING 1 + INFO 1 도 같은 턴에 처리했다.

---

## WARNING 1 — 무효 JSON 으로 차단이 풀린다 (testing) — **수정**

리뷰어가 **재현까지** 했다. object/array 필드를 편집해 **문법적으로 무효한 JSON**(마커
텍스트는 남긴 채)으로 만들면 차단이 조용히 풀린다:

```
coerceInput("object", '{"apiKey":"***"')  →  JSON.parse 실패  →  raw 문자열로 폴백
hasMaskedMarkerLeaf('{"apiKey":"***"')    →  false            ← 문자열은 정확 일치만 본다
```

backend `resolveTriggerParameters` 의 `isCoerceFailure` 가 `coerce_failed` 로 거부해 **실제
오염까지는 가지 않는다.** 다만 사용자는 *"마커를 채우라"* 대신 일반 오류 토스트를 보고,
3라운드 동안 이 경로를 행사하는 테스트가 없었다.

**세 번째 조건을 더했다** — 선언된 필드 타입이 object/array 인데 현재 값이 문자열이면 파싱
실패 상태이므로 무조건 막는다.

> **첫 시도는 과잉 차단이었다.** *원본 값이 구조였는가* 로 판정했더니, 스키마가 없을 때
> 같은 필드가 string 으로 렌더돼 **정상 편집까지 영구 차단**됐다(기존 언블록 테스트가 RED로
> 잡았다). 값의 모양이 아니라 **선언된 타입**으로 판정해야 한다.

**재검증(뮤테이션)**: 조건을 빼면 신규 캐너리가 **RED**. 캐너리는 `type: "object"` 스키마를
태우고 그 도착을 기다린다 — 스키마 없이는 그냥 string 필드라 이 경로 자체가 없다.

- `codebase/frontend/src/components/executions/rerun-modal.tsx` + 테스트

## WARNING 2 — CHANGELOG 자기모순 (documentation) — **수정**

같은 파일 아래쪽의 **기존 #1180 `Unreleased` 블록**이 *"`Execution.inputData` 만 마스킹하지
않는다 (의도)"* 라고 단언한다. 내 새 최상단 항목과 정반대다.

**이건 내 diff 범위 밖이라 앞선 8라운드(code 3 + consistency 5) 어느 리뷰도 대조하지 못한
사각지대였다.** 릴리스 전이라 두 블록이 공존하는데, 아래 블록에 후방 참조 caveat 을 달아
"이 카브아웃은 2026-08-20 에 닫혔다" 를 가리키게 했다.

- `CHANGELOG.md`

---

## consistency `15_33_05` (BLOCK: NO)

- **WARNING 1** — `3-execution.md` §8 이 *"WebSocket 이벤트에는 inputData 가 포함되지 않음"*
  이라고 **정반대로** 서술. 2026-04 이후 stale 이고, 내가 §R17 에 쓴 flip-flop 전제와 직접
  충돌한다(두 라운드 연속 지적). 코드 실측(`execution-engine.service.ts` emit ·
  `use-execution-events.ts` store 반영)에 맞춰 정정했다.
- **INFO 1** — `13-replay-rerun.md` §10.4 i18n 카탈로그에 `history.rerun.maskedInputBlocked` 행 추가.

## 미반영 INFO (8건)

1·2·3·4 는 전부 트래커 등재분(서버측 마커 거부 · 게이트 통합 · 미러 계약 테스트 · 외부 소비자),
5 는 세는 기준 차이로 이전 라운드가 조치 불요 판정, 6(모달 재사용 리셋)·7(e2e 왕복)·8(제출
함수 내부 가드 캐너리)은 리뷰어가 선택으로 판정했다.

## 검증

TEST WORKFLOW 4단계 PASS — lint / unit(백엔드 427 suites·8,832 · 프런트 6,064) / build /
e2e 276 + playwright 51. 모달 스위트 단독 **28 passed**.
