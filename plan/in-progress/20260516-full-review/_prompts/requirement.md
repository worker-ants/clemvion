# 요구사항(Requirement) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준의 코드베이스 **전체** — `spec/`, `packages/`, `codebase/backend/`, `codebase/frontend/` — 를 요구사항 충족 관점에서 면밀히 검토한다. 본 검토는 단일 diff 가 아니라 누적 상태에 대한 전체 audit 이다.

## 사용자 강조 관점

병렬 작업(워크트리 다수, cafe24 followup-backlog 30+ 커밋 누적)으로 인해 **드리프트**가 발생했을 가능성이 높다. 다음을 특히 주의:

1. **일관성** — 같은 요구사항이 여러 영역에서 다르게 구현/문서화되지 않았는지
2. **스펙 준수** — `spec/` 에 명시된 요구사항이 코드에서 빠짐없이 구현되었는지, 또는 코드가 spec 을 넘어선 기능을 갖고 있지는 않은지
3. **보안** — 인증·인가 요구사항이 모든 진입점에서 일관 적용되는지
4. **리팩토링 기회** — TODO·임시조치·미완 항목이 누적되어 있는지

## 최근 병렬 작업 컨텍스트

- 진행 중 worktree: `harness-review-router-c4f1a2`, `node-improvement-docs-37aad5`
- 최근 cafe24 followup-backlog: A-1(`integration_action_required` 알림), B-1-3(timestamp replay Redis nonce), B-3(요구사항/API 계약 Medium 7건), B-4(DB Medium 5건), B-5-8(install e2e), C-1(prod DB encryption check), mall-dup-followup-b(W9·W11·INFO 10/12/13)
- `plan/in-progress/` 에 잔여 follow-up 다수 존재 가능 — 누락된 요구사항 추적

## 검토 범위 (재귀)

- `spec/` — 116 개 MD 파일. 0-overview, 1-data-model, 2-navigation/, 3-workflow-editor/, 4-nodes/, 5-system/, 6-brand, conventions/, data-flow/
- `packages/` — expression-engine, node-summary
- `codebase/backend/src/` — modules/ (20+ 모듈), nodes/ (7 카테고리), common/, shared/
- `codebase/frontend/src/` — app/((editor|main|auth)), components/, lib/

## 작업 지침

1. spec/ 를 먼저 훑어 핵심 요구사항을 머릿속에 적재한 뒤, 코드와 대조하라.
2. 모든 파일을 다 읽을 필요는 없다 — 영역별로 **요구사항 누락이 일어나기 쉬운 지점**(에러 경로, 권한 검증, 엣지 케이스, 회복 흐름)을 우선 점검.
3. `plan/in-progress/**/*.md` 의 미체크 항목(`[ ]`)·TODO·"defer" 표기는 요구사항 미충족 후보로 간주.
4. 발견사항은 파일·라인 인용 필수. 같은 패턴 다수 반복 시 대표 1-2 건만 인용하고 "동일 패턴 N건" 표기.
5. 결과는 `output_file` 인자 경로에 Write. STATUS 한 줄만 반환.

## Requirement-specific 강조 포인트

- **기능 완전성**: spec 의 요구사항 ID(B-`*`, A-`*`, F-`*` 등) 가 코드에 매핑되는가
- **엣지 케이스**: 0 row, null, empty, 시간 경계, 동시 요청, 권한 경계 (read-only 사용자, 워크스페이스 외부 등)
- **TODO/FIXME/HACK**: 잔존 임시조치
- **의도/구현 괴리**: spec 본문과 코드 동작이 실제로 일치하는가 (특히 cafe24 OAuth replay, HMAC 검증, nonce, 알림 타입 같은 최근 변경 영역)
- **에러 시나리오**: 4xx/5xx 시나리오의 사용자·운영자 가시성, retry 정책, 회복 가능성
- **plan 백로그 미해소**: `plan/in-progress/` 에 남아있는 follow-up 이 코드 현황과 일치하는지

## 출력 형식

`output_file` 에 다음 구조의 markdown 을 Write:

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <path>:<line> (혹은 <path>)
  - 상세: 무엇이/왜 문제인가
  - 제안: 권장 조치

### 요약
1 문단 — 전체 요구사항 충족도 평가

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: spec 핵심 요구사항 누락·잘못 구현. WARNING: 부분 누락·엣지 처리 미흡. INFO: 정리·문서화 권고.
