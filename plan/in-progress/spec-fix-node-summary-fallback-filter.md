---
worktree: spec-sync-impl-644d19
started: 2026-06-03
owner: resolution-applier
---
# Spec Fix Draft — node-summary summaryTemplate fallback: filter documentation

## 원본 발견사항

SUMMARY#INFO3: `fallback:` 필터가 spec 어디에도 정의되지 않음. `evaluator.ts` 에 `case 'fallback'` 구현이 존재하며 실제 사용 중이나, spec 문서에 지원 필터 목록 및 각 인수 해석 방식 섹션이 없다.

## 제안 변경

해당 spec 문서(node-summary 또는 canvas 관련 spec, summaryTemplate 을 정의하는 섹션)에 다음 내용을 추가한다:

### `summaryTemplate` 지원 필터 목록

| 필터 | 인수 타입 | 동작 |
|------|-----------|------|
| `upper` | 없음 | 문자열을 대문자로 변환 |
| `lower` | 없음 | 문자열을 소문자로 변환 |
| `default:<literal>` | 리터럴 문자열 | 값이 비어있을 때 인수를 그대로 출력 |
| `fallback:<path>` | config 상대 경로 | 값이 비어있을 때 config 의 해당 경로 값을 조회하여 출력 |

### `fallback:` 상세

- 인수는 리터럴이 아닌 **config 상대 경로** (dot notation 지원: `meta.id`)
- `default:workflowId` 는 문자열 `"workflowId"` 를 출력하지만, `fallback:workflowId` 는 `config.workflowId` 값을 출력
- 필터는 체이닝 가능: `{{ workflowName | fallback:workflowId | upper }}`
- 빈 인수(`fallback:`) 는 빈 문자열을 반환

## 관련 파일

- 구현: `packages/node-summary/src/evaluator.ts` — `case 'fallback'`
- 테스트: `packages/node-summary/src/__tests__/evaluator.spec.ts` — `fallback: filter` describe 블록
