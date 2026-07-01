# 정식 규약 준수 검토 결과

**대상 문서**: `spec/4-nodes/3-ai/1-ai-agent.md`
**검토 일시**: 2026-07-01
**검토 모드**: spec draft (--spec)

---

## 발견사항

### [WARNING] 조건 ID 예약 포트 목록이 Principle 6 보다 불완전

- **target 위치**: §5.1 "유효성 검증 규칙" + §10 Pre-flight 에러 표 (`conditions[i].id 가 예약 포트 (out/in/error/user_ended/max_turns)`)
- **위반 규약**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 6 — "시스템 포트 예약어: `out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`. 사용자 설정 ID가 이 값과 충돌하면 프런트엔드에서 거부."
- **상세**: 타겟 문서의 금지 목록에는 `out`/`in`/`error`/`user_ended`/`max_turns` 5개만 있으나, conventions Principle 6 의 전역 예약어 9개(`out`, `error`, `default`, `done`, `user_ended`, `max_turns`, `completed`, `fallback`, `continue`) 중 `default`, `done`, `completed`, `fallback`, `continue` 가 누락되어 있다. 반대로 타겟의 `in` 은 Principle 6 목록에 없는 추가 항목이다. 조건 ID 는 UUID v4 자동 할당(§1 ConditionDef)이므로 실제 충돌이 발생할 가능성은 매우 낮지만, spec 의 backend validate 기준과 frontend 거부 기준이 불일치해 혼선을 야기할 수 있다. 또한 향후 조건 ID 를 API 에서 직접 지정하는 경로가 생길 경우 invariant 가 깨질 수 있다.
- **제안**: §5.1 유효성 검증 규칙과 §10 Pre-flight 에러 표를 Principle 6 전체 예약어 집합을 기준으로 갱신한다. `in` 은 타겟에만 존재하는 합리적 추가이므로 conventions Principle 6 에도 포함시키는 것이 바람직하다.

---

### [INFO] 조건 ID 예시 값이 UUID v4 규약과 불일치

- **target 위치**: §7.2 JSON 예시 `"id": "refund_request"`, §7.6 동일, §1 ConditionDef 표 예시
- **위반 규약**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 ConditionDef 내부 규칙 — "생성 시 UUID v4 할당, 이후 불변". 또한 `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)."
- **상세**: 문서 내 JSON 예시에서 `condition.id` 에 `"refund_request"` 같은 human-readable slug 를 사용하고 있다. §1 에서 조건 ID 는 UUID v4 라고 명시돼 있으므로 예시가 실제 runtime shape 를 오해하게 만들 수 있다. 또한 `port: "refund_request"` 예시도 같은 이유로 실제 runtime 에서는 UUID 형태 포트 ID 가 나올 것임을 혼동하게 한다. 
- **제안**: JSON 예시의 `condition.id` / `port` 값을 UUID v4 형태(예: `"3c7a9b12-4e5f-4a6b-87d3-9f1a2b3c4d5e"`)로 교체하거나, 예시 값이 illustrative 임을 명시하는 주석을 추가한다.

---

### [INFO] 출력 예시 섹션 형식이 Principle 11 패턴과 불일치

- **target 위치**: `## 7. 출력 구조` 하위 `### 7.1 Single Turn 모드 — 정상 완료 (out 포트)` 등 (§7.1 ~ §7.10)
- **위반 규약**: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` Principle 11 — "각 노드 문서의 'Output' 섹션은 다음 형식으로 작성됩니다. `### Case: <케이스 이름>`"
- **상세**: Principle 11 은 출력 예시 섹션 제목을 `### Case: <케이스 이름>` 형식으로 정의하고 있다. 타겟 문서는 번호 포함 형식(`### 7.1 Single Turn 모드 — 정상 완료 (out 포트)`)을 사용한다. Principle 11 에는 강제 테스트가 없으므로 CI 차단은 없지만, 동일 노드 spec 패밀리 안에서 형식 비일관성이 생긴다.
- **제안**: 가능하다면 `### Case: Single Turn 정상 완료 (out 포트)` 등의 형식으로 통일하거나, Principle 11 에 "번호 prefix 를 포함한 표제도 허용" 을 명시적으로 기재한다.

---

### [INFO] Rationale 섹션 제목이 번호 포함 형식

- **target 위치**: `## 12. Rationale` (문서 끝 섹션)
- **위반 규약**: `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". `spec/conventions/audit-actions.md` · `spec/conventions/spec-impl-evidence.md` 등 다른 conventions 문서들은 `## Rationale` (번호 없는 bare heading) 을 사용한다.
- **상세**: CLAUDE.md 는 Rationale 섹션 헤딩을 `## Rationale` 로 명시한다. 이 문서는 `## 12. Rationale` 를 사용해 같은 폴더 내 `1-ai-agent.md` 번호 prefix 스타일과 일관되지만 conventions 표준 헤딩과는 다르다. 목적 자체는 충족하나(문서 끝에 결정 근거 섹션 존재) 기계적 조회나 cross-reference 자동화에 혼선이 생길 수 있다.
- **제안**: 섹션 번호를 제거해 `## Rationale` 로 변경하거나, CLAUDE.md 규약에 "번호 포함 형식도 허용" 을 명시한다.

---

## 요약

`spec/4-nodes/3-ai/1-ai-agent.md` 는 대체로 정식 규약을 잘 따르고 있다. frontmatter (`id`/`status: partial`/`code`/`pending_plans`) 는 `spec-impl-evidence.md` §2 스키마에 부합하며, `## 12. Rationale` 섹션이 문서 끝에 존재해 3섹션 구성 원칙을 실질적으로 충족한다. 출력 포맷은 `node-output.md` Principle 0~9 를 대체로 준수하고, `output.error.details.retryable` (Principle 3.2.1) 의무도 §7.3/§7.9 에 모두 포함돼 있다. `_resumeState`/`_resumeCheckpoint`/`_retryState` top-level internal 필드 예외 처리도 Principle 0/4.2 에 근거해 명시적으로 기술돼 있다. 단, 조건 ID 예약 포트 목록이 conventions Principle 6 전체 예약어 집합 대비 불완전하여 WARNING 1건이 발견됐다. 나머지는 예시값 정확성·섹션 표제 형식에 관한 INFO 사항이다.

## 위험도

LOW
