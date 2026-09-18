# 신규 식별자 충돌 검토 — `spec/2-navigation/`

## 검토 배경

- 검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`)
- **scope(`spec/2-navigation/`) 델타: 0개 파일** — 이 PR 은 해당 spec 영역을 변경하지 않는다. 새로 부여되는 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로가 spec 문서 자체에는 전혀 없다.
- 구현 diff(9개 파일 · 217줄)는 전부 `codebase/backend/src/modules/{secret-store,triggers,workspaces}/**` 의 **주석/JSDoc 정정 + 메서드 이름 변경 1건**이다. plan(`plan/in-progress/trigger-release-stale-comments.md`)이 명시하듯 "동작은 바꾸지 않는다 — 주석과 메서드 이름 하나"가 이 PR 의 전체 범위다.

## 신규 식별자 후보 전수 확인

diff 에서 실제로 **새로 도입된 코드 심볼**은 다음 한 건뿐이다. 나머지는 모두 기존에 이미 존재하는 함수/파일/spec 섹션을 주석 안에서 정확히 지칭하도록 고친 것이다.

| 후보 식별자 | 성격 | grep 결과 |
|---|---|---|
| `teardownRegisteredChannel` (← `teardownChannelConfig` 이름 변경) | 새 메서드명 | `chat-channel-binder.service.ts`(정의+호출 2) · `trigger-resource-releaser.service.ts`(호출) · `trigger-resource-releaser.service.spec.ts`(mock) 6곳에서만 등장, 저장소 전체에 다른 의미의 동명 심볼 없음(`RegisteredChannel` 전수 grep 결과 동일 6곳) |
| `deleteTriggerSecretsAfterCommit` | 기존 함수(신규 아님) — 주석이 이 이름을 처음 정확히 인용 | `trigger-resource-release.ts` 정의 포함 8곳에서 기존 사용과 일치, 새 식별자 아님 |
| `secret-store.md §2.1` / `§5.3` | 주석이 인용하는 spec 섹션 | 두 섹션 모두 실재(`### 2.1 호출 규약`, `### 5.3 트리거 행이 없어질 때 — prefix 일괄 삭제`), 내용도 인용 맥락과 부합 |
| `트리거 목록 §4.3` | 주석이 인용하는 spec 섹션 | `spec/2-navigation/2-trigger-list.md`의 `### 4.3 cascade 동작`(및 하위 "트리거 행을 없애는 모든 경로" 절)과 일치 |
| `review/code/2026/09/17/18_45_09` | bare 인용을 세션 경로로 교정 | 해당 리뷰 세션 디렉토리 존재, 인용 형식이 `spec/conventions/review-citations.md §4` 규약에 부합 |

`teardownRegisteredChannel` 이름 변경은 plan 체크리스트에도 "저장소·spec 0건 확인" 으로 사전 검증되어 있고, 이번 재확인에서도 다른 의미의 동명 식별자·유사 이름(`registeredChannel` 등)이 발견되지 않았다.

## 발견사항

없음 — 이 PR 이 새로 부여하는 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수/설정키, spec 파일 경로가 존재하지 않으며, 유일한 코드 심볼 변경(`teardownRegisteredChannel`)도 기존 사용처와 충돌하지 않는다.

## 요약

이 PR 은 `spec/2-navigation/` 을 전혀 수정하지 않는 코드-주석 정정 PR 이며, 구현 diff 도 새 API·엔티티·이벤트·설정키를 도입하지 않는다. 유일한 신규 심볼인 메서드 이름 `teardownRegisteredChannel` 은 저장소 전체에서 6곳(정의·호출·mock)에만 일관되게 등장하고 다른 의미로 쓰이는 동명 식별자가 없다. 주석이 인용하는 기존 spec 섹션(`secret-store.md §2.1·§5.3`, 트리거 목록 §4.3)도 실재하며 문맥이 일치한다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
