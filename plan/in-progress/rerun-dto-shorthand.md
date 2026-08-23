---
title: "`re-run.dto.ts` 의 `type: Object` 축약형을 다수 패턴으로"
status: in-progress
worktree: rerun-dto-shorthand-730035
started: 2026-08-23
owner: developer
spec_impact: none
---

# `inputOverride` 를 열린 map 으로 광고한다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
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
- [ ] `/ai-review`

## 부수 — won't-do 가 열린 체크박스로 남아 있었다

Docker Hub 익명 pull 항목은 사용자가 **처리하지 않기로 결정**한 건인데 `- [ ]` 로 적혀
있었다. 결정이 끝난 항목이 미체크로 남으면 다음 세션이 착수 후보로 읽는다 → `- [x]` 로
정정(취소선·근거는 그대로). 미체크 30 → 27.

## 검증 기준

- 캐너리가 **생성 문서**를 본다 — 메타데이터를 보면 위 오판을 그대로 굳힌다.
- 뮤테이션: 축약형 복귀 → `additionalProperties` 단언 RED.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
