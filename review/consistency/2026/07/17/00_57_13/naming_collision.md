# 신규 식별자 충돌 검토 (2회차) — `plan/in-progress/ai-node-failed-conversation-preview.md`

## 검토 배경

1회차(`review/consistency/2026/07/17/00_32_29/naming_collision.md`) 결과는 위험도 **NONE** + INFO 1건(§9.3 신규 행 종속 명시 — target 이 처분 완료)이었다. 이번 2회차는 1회차 이후 target 에 발생한 변경점만 재검토한다:

1. 코드 식별자 `isFailedConversation` → `isErroredConversation` 로 개명
2. `conversation-thread.md §9.13` 신설 계획 폐기 (탭 정책 SoT 를 `3-execution.md §10.6.1` 로 유지하는 결정의 일부로, Phase 1 "1회차 BLOCK 사유와 정정" 절에 이미 반영됨)

`Inv-8` / `CT-S15` / `CT-S16` / plan 파일 경로 등 1회차에 검토를 마친 다른 신규 식별자는 이번 target 에서 변경되지 않았음을 재확인했다(아래 "회귀 확인" 참조).

## 발견사항

없음 (변경된 신규 식별자 재조사 결과 충돌 없음).

### 조사한 변경 식별자와 근거

| 식별자 | 종류 | 대상 위치 | 충돌 검사 결과 |
|---|---|---|---|
| `isErroredConversation` (구 `isFailedConversation`) | 신규 지역 변수명 (파생 boolean) | `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (Phase 2 §1) | 코드베이스 전역 grep 결과 `isErroredConversation` 사용처는 target 자기 자신(plan 문서)뿐 — 신규. `Errored` 라는 어휘 자체는 `codebase/backend/src/common/services/s3.service.ts` 의 `deleteMany(): Promise<{ errored: string[] }>` 에도 등장하지만, 이는 S3 삭제 결과 집계용 backend 타입으로 프런트엔드 conversation 렌더 로직과 파일·레이어·의미 모두 분리돼 있어 혼동 소지가 없다(같은 스코프에 공존하지 않음). 기존 `isWaitingConversation` / `isCompletedConversation` 명명 패턴(`is<Adjective>Conversation`)과 정합. `result-detail.tsx` 자체에는 `isError`/`isErrored`/`isFailed` 계열 기존 식별자가 없음(grep 0건) — 개명 후에도 파일 내부 충돌 없음. |
| §9.13 신설 폐기 | spec 섹션 번호 (미도입) | `spec/conventions/conversation-thread.md` | target 은 더 이상 §9.13 을 신설하지 않는다 — 현재 target 본문에서 "§9.13" 은 전부 "폐기된 초안 접근을 설명하는 과거형 서술"(Phase 1 CRITICAL 정정 절, 결정 기록)로만 등장하며 실제 절 생성 지시는 없음. `conversation-thread.md` 의 현재 마지막 `### 9.x` 섹션은 §9.12(요소별 발생 시각 표시)이고 §9.13 은 어디에도 정의돼 있지 않아 dangling reference 도 없다. 신규 식별자가 아예 도입되지 않으므로 충돌 검토 대상에서 제외. |

### 회귀 확인 — 1회차에서 검토 완료된 식별자 (이번 target 에서 불변)

| 식별자 | 확인 |
|---|---|
| `Inv-8` (§9.9) | `spec/conventions/conversation-thread.md` 현재 정의는 `Inv-1`~`Inv-7` 까지(L554-560). `Inv-8` 은 미점유 — 번호 연속성 유지. |
| `CT-S15` / `CT-S16` (§9.10) | 현재 정의는 `CT-S1`~`CT-S14` 까지(L568-580). `CT-S15/16` 은 미점유. |
| `§8.5` (Rationale 신설) | 현재 `## 8. Rationale` 하위는 §8.1~§8.4(L308-352)까지 — §8.5 미점유. |
| `plan/in-progress/ai-node-failed-conversation-preview.md` | 파일 경로 불변, 기존 plan 파일과 동명 충돌 없음(1회차 확인 유지). |
| `ED-EX-13` / `§10.6.1` 예외 확장 | 신규 ID 부여가 아니라 기존 항목(`spec/3-workflow-editor/_product-overview.md:121`, `spec/3-workflow-editor/3-execution.md:515`)의 조건 확장 — ID 충돌 범주 아님. |

## 요약

이번 2회차에서 target 이 실제로 바꾼 신규 식별자는 코드 변수명 개명(`isFailedConversation` → `isErroredConversation`) 하나뿐이며, 전수 grep 결과 코드베이스·spec 어디에도 선점되지 않았고 기존 `is<Adjective>Conversation` 명명 패턴과도 정합해 충돌이 없다. 오히려 이 개명은 Inv-8 이 규정하는 "status 무관 소유권 판정"(즉 `status === 'failed'` 하드코딩 금지, `systemError.nodeId` 존재 여부로만 판정)과 변수명 의미를 더 정확히 일치시켜, 구 이름이 유발할 수 있었던 "status 값과 결부된 이름처럼 보인다"는 잠재적 오독 소지를 줄이는 방향이라 개명 자체가 이전보다 명명 품질을 개선한다. `conversation-thread.md §9.13` 신설 폐기는 신규 식별자를 아예 도입하지 않는 방향으로의 축소이므로 검토 대상 자체가 사라졌으며, dangling 참조도 없음을 확인했다. 1회차에서 검토 완료된 `Inv-8`·`CT-S15`/`CT-S16`·§8.5·plan 파일 경로·ED-EX-13/§10.6.1 예외 확장은 이번 target 에서 번호·이름이 그대로 유지되어 재충돌 위험이 없다.

## 위험도

NONE
