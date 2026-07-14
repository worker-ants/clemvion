# 변경 범위(Scope) 리뷰

## 리뷰 대상

7개 파일 — 모두 `plan eia-command-waiting-surface-guard` 의 F-1(EIA 명령의 `nodeId` 를 실제 대기
노드와 대조·불일치 시 거부, `in_process_trusted` 는 면제)로 일관되게 태깅되어 있다.

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
3. `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`
4. `codebase/backend/src/modules/external-interaction/interaction.service.ts`
5. `codebase/backend/src/modules/hooks/hooks.service.ts`
6. `codebase/backend/test/external-interaction.e2e-spec.ts`
7. `spec/5-system/4-execution-engine.md`

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 스펙-구현 동기화가 같은 변경 세트에 포함됨
  - 위치: 파일 7 (`spec/5-system/4-execution-engine.md` §7.5.1) vs 파일 2 (`execution-engine.service.ts`)
  - 상세: `resolveWaitingNodeExecutionId` 에 `expectedNodeId` optional 파라미터를 추가하고 nodeId
    불일치 거부 케이스·`in_process_trusted` 면제를 spec 표·Rationale 각주에 함께 반영했다. 코드만
    바뀌고 spec 이 stale 해지는 흔한 실수를 피했다 — 범위 위반이 아니라 오히려 바람직한 동반 갱신이므로
    문제로 지적하는 항목이 아니라 확인 차 기록.
  - 제안: 없음 (조치 불필요).

- **[INFO]** `hooks.service.ts` 의 `nodeId: 'chat-channel'` placeholder 제거
  - 위치: 파일 5, hooks.service.ts 743~757행 부근
  - 상세: F-1 이전에는 `assertNodeId` 가 "존재 여부"만 검사했기 때문에 실제 nodeId 가 아닌
    `'chat-channel'` placeholder 를 실어 그 검사를 통과시켰다. 이번 변경으로 `in_process_trusted`
    는 `assertNodeId` 자체를 건너뛰므로 placeholder 가 더 이상 필요 없어져 제거됐고, 제거 이유가
    주석으로 남아 있다. 기능 변경(behavior)이 아니라 새 exemption 경로가 만든 필연적 후속 정리이며
    범위를 벗어나지 않는다.
  - 제안: 없음.

## 점검 관점별 확인

1. **의도 이상의 변경** — 없음. 7개 파일 모두 `expectedNodeId` 전달·매칭·예외(`in_process_trusted`)
   라는 단일 축으로 수렴한다. 관련 없는 로직 변경 없음.
2. **불필요한 리팩토링** — 없음. `assertNodeId(dto)` → `assertNodeId(dto, ctx)` 시그니처 변경은
   면제 판정에 `ctx` 가 필요하기 때문이며, 기존 4개 호출부(`submit_form`/`click_button`/
   `submit_message`/`end_conversation`) 모두 동일 패턴으로만 수정됐다. 그 외 메서드/구조 재배치 없음.
3. **기능 확장(over-engineering)** — 없음. `expectedNodeId` 는 optional 파라미터로만 추가되어
   기존 호출부(WS gateway 등, 이번 diff 범위 밖)와 하위 호환을 유지한다. 새로운 옵션·설정·추상화
   계층 도입 없음.
4. **무관한 수정** — 없음. 프론트엔드·다른 모듈·무관 파일 손대지 않음. 7개 파일 전부 이 기능의
   구현/테스트/스펙에 직접 대응.
5. **포맷팅 변경** — 없음. diff 전부 실질 코드/텍스트 변경이며, 의미 없는 개행·공백 재정렬이
   섞인 hunk 는 발견되지 않았다.
6. **주석 변경** — 모두 이번 변경의 근거·의도(§7.5.1, F-1, exemption 사유)를 설명하는 신규 주석이거나,
   동작이 바뀌어 더 이상 정확하지 않게 된 기존 주석(예: e2e 테스트 G 의 "I-16" 주석, hooks.service.ts
   placeholder 관련 주석)의 갱신이다. 불필요한 주석 삭제·순수 스타일성 주석 변경 없음.
7. **임포트 변경** — `interaction.service.ts` 에 `isInternalCtx` 1개만 추가됐고, 이는 같은 파일에서
   즉시 사용된다(면제 판정). 미사용 임포트나 불필요한 정리 없음.
8. **설정 변경** — 해당 없음. 설정 파일(`.json`/`.yml`/`tsconfig` 등) 변경 없음.

## 요약

7개 파일 diff 전체가 `F-1 (plan eia-command-waiting-surface-guard)` 라는 단일 태그로 일관되게
주석·커밋 맥락이 부여되어 있고, 실행 엔진의 `expectedNodeId` optional 파라미터 추가 → publisher
사전검증 → EIA `interaction.service` 의 `ctx` 기반 면제 판정 → chat-channel placeholder 제거 →
unit/e2e 테스트 보강 → spec 문서 동기화까지 하나의 기능이 필요로 하는 최소 변경 집합으로만
구성되어 있다. 관련 없는 리팩토링, 포맷팅 노이즈, 임포트 정리, 설정 변경, 기능 확장은 발견되지
않았다.

## 위험도

NONE
