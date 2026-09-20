# Cross-Spec 일관성 검토 — `spec-draft-rotate-conflict.md`

## 발견사항

- **[WARNING]** §② "충돌로 보는 사건" 정의가 `data-flow/5-integration.md` 의 기존 reauthorize 동시성 처리와 어긋난다
  - target 위치: `plan/in-progress/spec-draft-rotate-conflict.md` ②(§9.4 하위 항목, "충돌이 아닌 것") — "충돌로 보는 사건은 **자격증명 자체의 교체(rotate · 재인증 · 토큰 갱신)**뿐이다."
  - 충돌 대상: `spec/data-flow/5-integration.md` §1.2 (라인 100-103) — `reauthorize`/`request_scopes` 콜백 동시 처리를 `SELECT integration FOR UPDATE (pessimistic_write — 동시 callback lost-update 차단)` 로 이미 해소해 두었다. 이 메커니즘은 **거부(409)가 아니라 직렬화 후 마지막 커밋이 조용히 덮어쓰는** 방식이다 — 두 번째 콜백은 잠금이 풀리길 기다렸다가 자기 값으로 `UPDATE` 하고, 먼저 온 요청에게 어떤 에러도 돌아가지 않는다. 같은 표는 `last_rotated_at=now` 도 이 UPDATE 에서 갱신됨을 명시한다(draft 의 §실측 넷째 항목과 일치).
  - 상세: target 의 ②는 "rotate·재인증·토큰 갱신" 셋을 동급의 "교체 사건(=충돌 후보)"으로 나열하지만, 실제로 구현·문서화된 정책은 셋 중 **rotate 하나만** 거부-후-재시도(first-writer-wins, 409) 계약을 갖고, 나머지 둘(재인증·토큰 갱신)은 **정반대 정책**(last-writer-wins, 무거부, pessimistic lock 직렬화)을 이미 채택하고 있다. row 가 OAuth/비-OAuth 로 상호 배타적이라(target §실측 셋째 항목 — rotate 는 `oauth2` 를 `INTEGRATION_ROTATE_UNSUPPORTED` 로 거부) **동일 row 에서 두 정책이 실제로 충돌하지는 않는다**. 그러나 ②의 문장은 "교체 = 충돌" 이라는 **일반 원칙**으로 읽히기 쉬워, 다음 독자(특히 이 트래커의 후속 항목이나 향후 OAuth 쪽 lost-update 논의)가 "재인증 동시 경합도 언젠가 409 로 거부해야 할 대상" 이라고 오해할 위험이 있다 — 실제로는 그 반대가 이미 정책으로 굳어 있다. 같은 문서 §6 상태 전이 표(라인 738) 도 `reauthorize` 와 `rotate` 를 "성공 시 동일 전이" 로 대칭 서술하고 있어, 이번 draft 가 그 대칭성 옆에 **실패 계약의 비대칭**(rotate 만 409, reauthorize 는 무거부)을 새로 만들면서 그 비대칭을 명시하지 않는 점도 같은 문제의 다른 면이다.
  - 제안: ②를 "이 계약(§①·③·④)은 **rotate 대상 행(비-OAuth)에 한정**한다 — 재인증·토큰 갱신은 OAuth 전용 row 에서 `data-flow/5-integration.md §1.2` 의 pessimistic lock 직렬화(마지막 커밋이 유효, 거부 없음)를 그대로 유지하며 본 draft 가 바꾸지 않는다" 정도로 좁히거나, 최소한 그 문서를 상호 참조해 두 정책이 "같은 엔티티의 서로 다른 두 정책" 임을 명시한다. §6 표에도 각주로 "reauthorize 실패는 거부가 아니라 재시도(콜백 재개)이고, rotate 실패(§9.4 `INTEGRATION_ROTATE_CONFLICT`)는 즉시 거부" 를 구분해 두면 다음 사람이 재인증 쪽에도 같은 409 계약을 기대하지 않는다.

- **[WARNING]** (병렬 리뷰어 `naming_collision` 이 상세히 다룬 사안의 cross-spec 측면만 보강) 신규 코드 도입 근거 "범용 conflict 코드가 없다" 가 `spec/5-system/3-error-handling.md` 의 기존 카탈로그와 충돌
  - target 위치: draft "실측" 절 — "**범용 conflict 코드가 없다**: 백엔드의 `code: '...'` 리터럴을 전수 집계해도 409 계열은 도메인 전용 둘뿐이다."
  - 충돌 대상: `spec/5-system/3-error-handling.md:90` — `WORKFLOW_VERSION_CONFLICT` (409) "동시 캔버스 저장 경합 — 동일 워크플로우 버전 번호 unique 위반을 감지해 재시도 권고와 함께 반환". 이는 target 이 이번에 만들려는 것과 **문제 형태가 사실상 동일**하다(동시 쓰기 경합 · first-committer-wins · 409 · 재시도 안내) — 다만 소속 spec 영역이 다르다(`5-system/` 시스템 공통 에러 카탈로그 vs `2-navigation/4-integration.md` 도메인 화면 spec).
  - 상세: 이 영역 간 불일치는 두 갈래다. (1) target 의 "실측"이 검증한 범위는 사실 `4-integration.md §9.4` 카탈로그 **안**뿐인데 문장은 "백엔드 전수"로 넓게 서술돼, `5-system/` 영역의 기존 선례를 놓친 것처럼 읽힌다(naming_collision 리포트가 코드 레벨 근거까지 상세히 짚었다). (2) `spec/5-system/2-api-convention.md` §5.3 이 "도메인 특화 사유가 있으면 새 top-level 코드"를 선례(`WORKFLOW_VERSION_CONFLICT` 포함)로 이미 규약화해 두었으므로, target 의 결론(신규 `INTEGRATION_ROTATE_CONFLICT` 도입) 자체는 그 규약을 따르는 것이라 뒤집히지 않는다 — 다만 Rationale ⑤가 이 규약·선례를 인용하지 않아, "이 형태의 충돌엔 프로젝트 전례가 없다"는 인상을 주고 있고, 이는 다른 spec 영역(`5-system/`)의 기존 결정을 놓친 서술이다.
  - 제안: naming_collision 리포트의 제안과 동일 — 실측 문장 범위를 "Integration 모듈 카탈로그 안" 으로 좁히고, Rationale ⑤에 `spec/5-system/2-api-convention.md §5.3` 과 `WORKFLOW_VERSION_CONFLICT` 선례를 인용해 "왜 재사용이 아니라 신규 top-level 코드인가" 를 규약 근거로 명시한다.

## 그 외 확인 — 충돌 없음

- **데이터 모델**: `Integration` 엔티티·`last_rotated_at` 컬럼 정의는 그대로이며 draft 는 새 컬럼·필드를 추가하지 않는다. `spec/1-data-model.md §2.10` 과 충돌 없음.
- **API 계약**: `POST /api/integrations/:id/rotate` 는 기존 §9.2(829행) endpoint 를 재사용 — 신규 endpoint·request/response shape 변경 없음(에러 분기 하나만 추가).
- **요구사항 ID**: 신규 ID 체계 도입 없음.
- **권한·RBAC**: §8 권한 규칙 표(Rotate: 본인/Admin)는 draft 가 건드리지 않으며, 새 409 분기는 인가 이후 단계라 RBAC 모델과 무관.
- **계층 책임**: 서버가 커밋 여부를 판정하고 프런트는 안내만 표시하는 기존 분할을 그대로 따른다 — cross-layer 책임 변경 없음.

## 요약

Cross-spec 관점에서 가장 중요한 지점은, 이 draft 가 §②에서 선언하는 "자격증명 교체(rotate·재인증·토큰 갱신) = 충돌 사건" 이라는 일반화가 이미 `spec/data-flow/5-integration.md` 가 문서화한 재인증/토큰 갱신의 실제 정책(거부 없는 pessimistic-lock 직렬화, last-writer-wins)과 형태가 반대라는 점이다 — row 가 OAuth/비-OAuth 로 배타적이라 실제 동작 충돌은 없지만, 문장 그대로 읽으면 다음 독자가 재인증에도 같은 거부 계약을 기대할 위험이 있어 명시적 범위 한정이 필요하다. 부차적으로 신규 코드 도입 근거인 "범용 conflict 코드 부재" 서술이 `5-system/3-error-handling.md` 의 `WORKFLOW_VERSION_CONFLICT` 선례(같은 문제 형태의 이미 존재하는 해법)를 놓치고 있다는 점도 영역 간 근거 불일치로 짚을 만하다(단, 이 결론 자체를 뒤집지는 않는다 — API 규약 §5.3 이 신규 top-level 코드 도입을 이미 정당화한다). 두 항목 모두 즉시 작동 불가를 유발하는 직접 모순은 아니며, spec 반영 전 문구 보강으로 해소 가능한 수준이다.

## 위험도

LOW
