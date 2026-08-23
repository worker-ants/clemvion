---
title: "`re-run.dto.ts` 의 `type: Object` 축약형을 다수 패턴으로"
status: complete
worktree: rerun-dto-shorthand-730035
started: 2026-08-23
completed: 2026-08-23
owner: developer
spec_impact: none
---

# `inputOverride` 를 열린 map 으로 광고한다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 항목 *"`re-run.dto.ts` 가 열린 map 을 `type: Object` 축약형으로 적는다"*
(2026-08-22 등재, `23_46_23` convention_compliance W1 의 부수 발견).

## "형태 통일" 보다 근거가 강했다 — 실측이 바꿨다

트래커는 이걸 **스타일 정렬**(40 파일 vs 2 파일)로 등재했다. 착수해서 두 형태를 실제로
비교하니 산출이 다르다.

**메타데이터만 보면 오판한다** — 축약형은 그 단계에서 `type` 이 **아예 없다**:

```
SHORT → [{"description":"x","required":false,"isArray":false}]
EXPL  → [{"type":"object","description":"x","additionalProperties":true,...}]
```

여기서 멈췄으면 *"축약형은 타입을 광고하지 않는다"* 고 적었을 것이다. **`createDocument`
까지 돌리니 달랐다** — 축약형도 `type: object` 로 **해석된다**:

| 형태 | 생성 스키마 |
|---|---|
| `type: Object` | `{ type: 'object', description }` — `additionalProperties` **없음** |
| `type: 'object' + additionalProperties: true` | `{ …, additionalProperties: true }` |

**실제 차이는 그 한 칸**이다. OpenAPI 검증 의미는 같지만(부재 시 기본 허용) **생성기**는
전자를 *"선언된 프로퍼티가 없는 닫힌 모델"* 로 읽어 **빈 인터페이스**를 만든다. 열린 map
이라는 의도가 클라이언트에 전달되지 않는다.

## 작업

- [x] `type: 'object' + additionalProperties: true` 로 교체 + 근거 주석
- [x] **OpenAPI 산출 캐너리** 신설 (이 표면에 테스트가 없었다)
- [x] 뮤테이션 — 축약형으로 되돌리면 **RED**(`tsc` 선검증 통과, 유효 뮤턴트)
- [x] 트래커 종결 + **Docker Hub won't-do 를 `[x]` 로 정정**
- [x] TEST WORKFLOW 4단계 PASS(backend 8,950 → **8,952**) + ratchet 199건 baseline 일치
- [x] `/ai-review` — `20_36_01` CRITICAL 0 · WARNING 3 → 전부 반영

## 부수 — won't-do 가 열린 체크박스로 남아 있었다

Docker Hub 익명 pull 항목은 사용자가 **처리하지 않기로 결정**한 건인데 `- [ ]` 로 적혀
있었다. 결정이 끝난 항목이 미체크로 남으면 다음 세션이 착수 후보로 읽는다 → `- [x]` 로
정정(취소선·근거는 그대로). **rebase 후 실측: 31 → 30**(main 이 그 사이 #1205 로 항목을 늘렸고, 이 PR 이 2건 닫고 1건 등재했다).

> **수치를 두 번 고쳤고, 그게 이 항목의 교훈이다** (`20_36_01` requirement INFO 2 →
> `21_03_29` rationale W1). 처음엔 "30 → 27" 이라 적었는데 **다른 브랜치(#1205)의 수치**를
> 가져온 것이었다. 그래서 이 브랜치 base 기준 "29 → 27" 로 고쳤는데, **#1205 가 머지되면서
> 그것도 낡았다** — rebase 후 실측은 31 → 29 다.
>
> **교훈은 "다시 세라" 가 아니라 "닫히는 시점에 세라" 다.** 병렬 브랜치가 같은 트래커를
> 고치는 동안 절대 수치는 계속 움직인다. PR 안의 정량 기록은 **그 PR 이 닫히는 시점**의
> 값이어야 하고, 그 시점은 rebase 이후다.

## 검증 기준

- 캐너리가 **생성 문서**를 본다 — 메타데이터를 보면 위 오판을 그대로 굳힌다.
- 뮤테이션: 축약형 복귀 → `additionalProperties` 단언 RED.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.

## `/ai-review` 처분 (`20_36_01` — CRITICAL 0 · WARNING 3 · LOW)

- **W1·W2 (maintainability)**: 신규 캐너리가 자매 스펙 3개의 확립된 관례를 안 따랐다 —
  `SchemaObject`(swagger 가 공개 export 하지 않아 `ApiResponseSchemaHost['schema']` 에서
  파생) 대신 `Record<string, unknown>` 캐스팅, `createDocument` 가 던질 때 `app.close()` 가
  스킵되는 `try/finally` 누락. 둘 다 자매와 동일 패턴으로 맞췄다. INFO 9(중복 캐스팅)·
  INFO 10(`[가드]` 태그)도 그 편집에서 함께 해소됐다.
- **W3 (scope)**: Docker Hub won't-do 체크박스 동반 플립 — 리뷰어가 *"plan 문서에 부수로
  명시 고지했고 코드 영향 없어 INFO 로 낮춰도 무방"* 으로 판정. 현행 유지.
- **INFO 2 — 내 수치가 틀렸다**: 위 §부수 참조. 병렬 브랜치의 수치를 옮겨 적었다.
- 나머지 INFO(CHANGELOG 생략 근거·상호링크·`required` 캐너리·boilerplate 공유 헬퍼)는
  전부 리뷰어가 "지금 불요" 로 판정. 특히 boilerplate 는 **4번째 사례에서** 추출하라는
  조건부라 지금 손대면 근거 없이 앞선다.

## 부수 — unit 단계에서 `SIGSEGV` (이 세션 두 번째)

무관 파일(`workflow-dto-validation.spec.ts`)이 jest worker 강제 종료로 스위트째 죽었다.
**실패 테스트는 0건**(8,917 passed)이었고 재실행은 PASS. 앞선 `nodeoutput-allowlist` 에서도
다른 파일로 같은 형태가 났다 — 이 저장소의 알려진 phantom 이다.

## `--impl-done` (`21_03_29` — **BLOCK: NO**, CRITICAL 0)

WARNING 2건 둘 다 반영했다.

- **W1 (rationale)**: 이 브랜치가 **#1205 머지 이전**(merge-base `04fe5962f`)에서 갈라져
  정지해 있었다 — 리베이스 없이 머지하면 방금 착지한 fail-closed allowlist 결정이 소실될
  수 있다는 지적. `git rebase origin/main` 으로 흡수하고 **산출물이 살아 있는지 실측**했다:
  `node-output-allowlist.ts` 존재 · §R17 "해소 (2026-08-23)" 문구 2곳 · 트래커 항목 닫힘.
- **W2 (plan_coherence)**: 리뷰가 반복해 내린 *"4번째 유사 스펙에서 공유 헬퍼 추출"* 조건부
  처분의 **그 4번째가 이번 PR** 인데, 그 사실이 review 산출물에만 있었다 → 살아있는 트래커에
  현재 4개·3개 모듈 목록과 함께 등재. **임계값을 만든 PR 이 그 사실을 남기지 않으면 다음
  세션이 문서고고학을 해야 발견한다.**

## 최종 게이트

| 게이트 | 결과 |
| --- | --- |
| `/ai-review` 2R (`20_36_01` → `20_58_05`) | WARNING 3 → **0**, 최종 위험도 **NONE** |
| `--impl-done` (`21_03_29`) | **BLOCK NO** · CRITICAL 0 |
| rebase | `origin/main`(#1205 포함) 흡수 후 산출물 실측 확인 |
