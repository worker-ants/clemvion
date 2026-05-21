---
status: backlog
created: 2026-05-22
owner: project-planner
priority: v1.x
---

# Plan — Form spec phone type / validation rule 정합

## 배경

[telegram.md §5.3](../../spec/4-nodes/7-trigger/providers/telegram.md#53-form-cch-mp-03) 의 phone 행이 어댑터 측 임시 stub (v1 은 `type: 'text'` + custom phone pattern regex) 로 처리되어 있으나, [Form spec §1](../../spec/4-nodes/6-presentation/4-form.md#1-설정-config) 의 `type` Enum 에 `phone` 이 없고 `ValidationRule.phone` 또는 명시적 pattern 예시도 spec 화되지 않았다 — 어댑터 client-side 1차 검증과 backend server-side 검증 동작 불일치 가능.

본 plan 은 Form spec 차원에서 phone 처리 방식을 결정·정합화한다.

## 범위

### 결정 항목 (선택지)

| 옵션 | 변경 | 영향 |
|---|---|---|
| (A) `type: 'phone'` 신설 | Form spec §1 type Enum 에 `phone` 추가 + 검증 규칙 spec화 | Form 노드 / 어댑터 / DTO 모두 갱신 |
| (B) `type: 'text'` + `ValidationRule.phone` 신설 | type Enum 무변경, ValidationRule 만 추가 | Form 노드 처리 / DTO validator 추가 |
| (C) `type: 'text'` + 임의 pattern (현재 v1 stub) | spec 변경 없음, 어댑터가 임의 정규식 | 어댑터 ↔ backend 검증 불일치 잔존 |

권장: (B) — type Enum 변경 최소화, ValidationRule 카탈로그 확장

### Phase 1 — 결정 + spec 갱신
- 위 옵션 중 선택
- spec/4-nodes/6-presentation/4-form.md 갱신
- spec/4-nodes/7-trigger/providers/telegram.md §5.3 phone 행 stub 해소

### Phase 2 — 구현 (필요 시)
- Form 노드의 phone validation rule 처리
- TelegramAdapter 의 phone 필드 처리 — share_contact 또는 text validation

## 의존 관계

- 관련 spec: spec/4-nodes/6-presentation/4-form.md, spec/4-nodes/7-trigger/providers/telegram.md
- 다른 chat channel provider 추가 시 동일 phone 처리 필요 — 본 결정이 선행

## Out of Scope

- Date / file 등 다른 type 의 validation rule 확장
