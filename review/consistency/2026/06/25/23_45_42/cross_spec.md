# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 plan: `plan/in-progress/web-chat-snippet-queue-stub.md`
- 관련 spec: `spec/7-channel-web-chat/2-sdk.md`
- 검토 일시: 2026-06-25

---

## 발견사항

### [INFO] spec/7-channel-web-chat/2-sdk.md §1 스니펫 예시에 큐 스텁 누락 (기존 drift, plan이 해소)

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md` §수정 항목 2
- 충돌 대상: `spec/7-channel-web-chat/2-sdk.md §1` 코드 블록 (lines 23-41) vs 동일 파일 본문 "단일 전역 진입점 + 명령 큐 패턴" 설명 및 `codebase/packages/web-chat-sdk/src/loader.ts:97-108` (`.q` replay 전제)
- 상세: 현재 `spec/7-channel-web-chat/2-sdk.md §1` 의 코드 예시는 로더 IIFE 직후 바로 `ClemvionChat('boot', {...})` 를 호출하는 형태이며 큐 스텁이 없다. 한편 같은 spec §1 본문("단일 전역 진입점 + 명령 큐 패턴")과 `loader.ts:97-108`(`.q` replay 처리)은 스텁이 있음을 전제한다. spec 본문 설명과 코드 예시가 이미 내부 모순 상태이고 plan 이 이를 수정한다. 이는 기존 spec↔구현 drift 를 해소하는 수정이며 다른 영역과의 신규 충돌이 아니다.
- 제안: plan 대로 수정하면 해소된다. 단, `spec/` 수정은 CLAUDE.md 규약상 `project-planner` 역할 소관이므로 owner 확인 필요.

---

### [INFO] spec/ 수정 항목의 역할 권한 확인 권장

- target 위치: `plan/in-progress/web-chat-snippet-queue-stub.md` §수정 항목 2 ("spec/7-channel-web-chat/2-sdk.md §1 스니펫 예시 — 스텁 추가")
- 충돌 대상: CLAUDE.md 규약 ("spec/ 변경 → project-planner")
- 상세: plan 의 항목 2 가 `spec/` 파일 변경을 포함한다. CLAUDE.md 에 따르면 `spec/` 변경은 `project-planner` 역할이고 `developer` 는 `spec/` read-only 다. plan 의 `owner: developer` 와 충돌 가능성이 있다. 단, plan 에 이미 명시돼 있으므로 담당자가 두 역할을 겸하거나 위임 절차를 밟으면 해소된다.
- 제안: `developer` 로 진행 시 spec 수정(항목 2)을 `project-planner` 에 선위임하고 코드(항목 1)·docs(항목 3) 만 먼저 구현. 또는 plan owner 가 양 역할을 겸하는 경우 순서대로 진행.

---

## 추가 확인 (충돌 없음)

1. **데이터 모델 충돌**: 없음. 본 plan 은 DB 스키마·엔티티·API endpoint 에 영향을 주지 않는다.
2. **API 계약 충돌**: 없음. EIA·Webhook·External Interaction API 의 계약은 변경되지 않는다. 스니펫 로더 URL(`j.src`) 패턴도 `spec/7-channel-web-chat/0-architecture.md §4` 의 CDN 도메인 규약과 일치한다.
3. **요구사항 ID 충돌**: 없음. plan 은 신규 요구사항 ID 를 부여하지 않는다.
4. **상태 전이 충돌**: 없음. 위젯 상태기계(`1-widget-app.md`)는 변경 대상이 아니다.
5. **권한·RBAC 모델 충돌**: 없음. 운영 콘솔 스니펫 생성은 기존 RBAC 범위 안에 있다.
6. **계층 책임 충돌**: 없음. 스니펫 생성 로직(`codebase/frontend/src/lib/web-chat/snippet.ts`)은 운영 콘솔 레이어이고, SDK 코어(`codebase/packages/web-chat-sdk/src/loader.ts`)는 이미 `.q` replay 를 올바르게 구현하고 있어 변경 불필요. plan 의 분리 원칙("로더는 이미 `.q` replay 처리 — 백엔드/로더 변경 불필요")과 일치한다.

---

## 요약

`plan/in-progress/web-chat-snippet-queue-stub.md` 는 스니펫 command-queue 스텁 누락 버그 수정이라는 매우 좁은 범위의 plan 으로, `spec/**` 의 다른 영역과 직접 모순되는 사항은 존재하지 않는다. 발견된 두 항목은 모두 INFO 수준이며 각각 (a) plan 이 해소 대상으로 명시한 기존 spec 내부 drift, (b) developer 역할의 spec 수정 권한에 대한 절차적 확인 권고다. 구현 착수를 차단할 Critical 또는 Warning 충돌은 없다.

---

## 위험도

LOW
