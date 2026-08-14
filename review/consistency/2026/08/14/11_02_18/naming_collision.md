STATUS=success 신규 식별자 충돌 검토 완료 — 실 diff 범위(origin/main...HEAD)에 spec/5-system/ 변경 없음, 코드 diff 는 private 헬퍼 1개만 신설(충돌 없음)
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토

## 조사 방법 및 범위 확정

`--impl-done, scope=spec/5-system/, diff-base=origin/main` 로 지정됐으나, prompt 에 번들된
"target 문서" 는 `spec/5-system/2-api-convention.md`·`6-websocket-protocol.md` 전문(기존
내용)과, 예산 초과로 절단된 `14-external-interaction-api.md`(외부 원인 표시: "본문 생략됨")
및 diff 자체(`<git diff origin/main...HEAD -- code_areas>`, 마찬가지로 절단)로 구성돼 있었다.
prompt 안의 절단 경고에 따라 실제 diff 를 워킹트리에서 직접 재확인했다:

```
git log --oneline origin/main..HEAD
  5df89cda6 fix(security): strip 구현이 __proto__ 를 오염시켰다 + 지연 할당·깊이 상한
  a9574f823 docs(plan): 처방 선택이 뒤집힌 것과 이름 충돌 분리를 실제 상태로 기록
  81f2c60d6 fix(security): 외부 fanout 의 llmCalls strip 이 depth-1 이라 raw 프롬프트가 새고 있었다
  3363f6643 docs(plan): 종결 payload 작업 착수 — impl-prep 이 spec CRITICAL 로 막았다

git diff origin/main...HEAD --stat -- spec/
  (출력 없음 — spec/ 하위 변경 파일 0개)
```

즉 이번 브랜치(`claude/eia-terminal-payload`, 재사용 워크트리 `eia-r8-cache-scope-4ae434`)는
**`spec/5-system/` 를 전혀 건드리지 않았다.** `plan/in-progress/eia-terminal-payload.md` 에
기록된 대로, 종결 payload 정리 작업은 `--impl-prep` 에서 spec CRITICAL(§6.2 봉투 불일치)로
차단돼 아직 planner 턴(→ `spec-draft-eia-62-waiting-payload.md`)을 거치지 않았고, 실제
코드/spec 반영은 진행되지 않은 상태다. 이번 커밋들은 그와 별개로 발견된 보안 결함
(`llmCalls` strip 의 depth-1 누출 + `stripDeep` 리팩토링의 `__proto__` 오염)의 fix 다.

실 diff 파일: `CHANGELOG.md`, `codebase/backend/src/modules/websocket/websocket.service.ts`,
`codebase/backend/src/modules/websocket/websocket.service.spec.ts`, 그리고 `plan/`·`review/`
산출물(신규 식별자 충돌 검토 대상 아님).

## 발견사항

이번 diff 가 새로 도입하는 식별자는 다음 하나뿐이다.

- **[INFO]** 신설 함수 `stripDeep` — 충돌 없음, 명명 적절
  - target 신규 식별자: `stripDeep(value: unknown, depth: number): unknown`
    (`codebase/backend/src/modules/websocket/websocket.service.ts:386`, module-private,
    export 안 됨)
  - 기존 사용처: 저장소 전체(`grep -rn "stripDeep" codebase/`)에 이 diff 가 만든
    4개 참조(정의 1 + 재귀 호출 2 + 최초 호출 1) 외에 다른 정의·사용 없음.
    형제 함수 `sanitizeInner`(같은 파일, credential 마스킹 재귀 순회)와 이름·역할이
    구분되어 혼동 소지도 낮다.
  - 상세: `stripExternalOnlyFields` 의 top-level-only(depth-1) strip 로직을 깊이 무관
    재귀로 교체하며 신설된 helper. `EXTERNAL_STRIPPED_FIELDS`(기존 상수, 값 `['llmCalls']`
    불변) · `MAX_SANITIZE_DEPTH`(기존 export const, 값 10 불변, `websocket.service.ts:226`
    에서 이미 `sanitizeInner` 가 사용 중)를 그대로 재사용한다 — 이 diff 가 새로 정의한
    ENV var·config key·상수는 없다.
  - 제안: 없음(문제 없음, 기록용).

## 관점별 점검 결과 (전 항목 미해당 확인)

| 관점 | 결과 |
|---|---|
| 1. 요구사항 ID 충돌 | spec/5-system/ 변경 없음 → 신규 ID 부여 자체가 없음. 해당 없음 |
| 2. 엔티티/타입명 충돌 | 신규 엔티티·DTO·인터페이스 없음. `stripDeep` 은 함수이며 타입 선언 아님 |
| 3. API endpoint 충돌 | 신규 endpoint 없음 (컨트롤러·라우트 변경 없음) |
| 4. 이벤트/메시지명 충돌 | 신규 webhook/queue/sse 이벤트명 없음. `EXTERNAL_STRIPPED_FIELDS` 배열값(`llmCalls`) 도 불변 — 신규 strip 대상 필드 추가 없음 |
| 5. 환경변수·설정키 충돌 | 신규 ENV var·config key 없음. `MAX_SANITIZE_DEPTH` 재사용(기존 상수) |
| 6. 파일 경로 충돌 | 신규 spec 파일 없음. `plan/in-progress/eia-terminal-payload.md` · `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 신설은 plan 라이프사이클 규약(`.claude/docs/plan-lifecycle.md`) 상 명명 컨벤션(`<slug>.md`, frontmatter `worktree`/`spec_impact`)을 따르고 있어 파일 경로 충돌 없음 |

## 참고 — target 문서 번들에 나타난 기존 식별자 재확인 (혼동 방지용)

prompt 에 포함된 `2-api-convention.md`·`6-websocket-protocol.md` 전문은 이번 diff 로 신설된
것이 아니라 **기존 spec 본문**이다 (`git diff` 결과가 이를 증명). 그 안의
`execution.retry_last_turn`·`RETRY_STATE_NOT_FOUND`·`AI_RETRY_STATE_TTL_MINUTES` 등은
이미 이전 작업(`retry-turn-terminal-guard` 계열)에서 정의된 기존 식별자이며, 본 검토
대상 diff 가 새로 도입한 것이 아니므로 충돌 판정 범위에서 제외했다. `plan/in-progress/
eia-terminal-payload.md` 가 예고한 종결 payload 필드(`error` 객체 통일·`durationMs`·
`result.outputs`)는 아직 **미착수**(spec CRITICAL 로 차단된 상태)이므로 현재 diff 에는
나타나지 않는다 — 향후 planner 턴 이후 재검토가 필요하다.

## 요약

이번 리뷰 대상 diff(`origin/main...HEAD`)는 `spec/5-system/` 를 전혀 변경하지 않았고,
실제 코드 변경은 `websocket.service.ts` 의 external-fanout strip 로직을 depth-1 에서
깊이 무관 재귀로 바꾸는 보안 fix 한 건뿐이다. 이 diff 가 신설하는 식별자는 module-private
함수 `stripDeep` 하나이며, 저장소 전체에서 이름 충돌이나 의미 중복 사용처가 없다.
`EXTERNAL_STRIPPED_FIELDS`·`MAX_SANITIZE_DEPTH` 는 모두 기존 상수를 재사용할 뿐 신규
ENV var·config key·필드명 추가가 아니다. 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
spec 파일 경로 어느 관점에서도 신규 도입 항목이 없어 충돌 여지 자체가 없다. `plan/
in-progress/eia-terminal-payload.md` 가 예정한 종결 payload 필드 통일 작업은 spec
CRITICAL 로 차단되어 아직 미착수 상태이므로, 그 작업이 실제 진행돼 spec/코드에 반영될
때 별도 회차의 naming-collision 재검토가 필요하다(현재는 검토 대상 자체가 없음).

## 위험도
NONE
